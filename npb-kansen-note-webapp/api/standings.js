// Vercel Serverless Function: /api/standings
//
// セ・パ両リーグの「順位表」と「チーム成績（チーム打率・チーム本塁打・チーム防御率）」を
// NPB公式サイト（npb.jp）の成績ページから取得して返す。ホーム画面に常設で表示する想定。
//
// ===== 実装にあたっての注意 =====
// このAPIは、npb.jp/bis/{年}/stats/std_c.html（セ・リーグ チーム勝敗表）
// / std_p.html（パ・リーグ） / tmb_c.html・tmb_p.html（チーム打撃成績）
// / tmp_c.html・tmp_p.html（チーム投手成績）の6ページを取得する。
// 他のAPI（schedule.js・stats.js等）と異なり、このAPIについては開発時にWebFetchで
// 実際のページ内容（見出し・列の並び順・実データ）を確認できている（2026年9月時点）。
// ただし取得できたのはAIによる要約テキストであり、生のHTML構造（class名やtable構造）までは
// 見えていないため、依然として「見出しラベルを手がかりに列を動的判定する」api/stats.jsと
// 同じ堅牢な作りにしてある（レイアウトが多少変わっても追従できるように）。
// 取得・解析に失敗したリーグ/球団は単に欠落するだけで、アプリ全体は壊れないようにしてある。
// `?debug=1` を付けると見つかった見出し行・列マッピングなどがレスポンスに含まれる。

import axios from "axios";
import * as cheerio from "cheerio";

const HTTP_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; NPBKansenNoteBot/1.0; +https://npb-kansen-note.vercel.app/)",
  "Accept-Language": "ja,en;q=0.8",
};

// 表示用の球団名（アプリ内の他の場所と表記を揃える）と、npb.jp側の表記ゆれを吸収するための
// エイリアス一覧。「完全一致」ではなく「どちらかがどちらかを含む」形で緩く照合する。
const TEAM_ALIASES = {
  "楽天": ["楽天", "東北楽天ゴールデンイーグルス", "イーグルス"],
  "日本ハム": ["日本ハム", "北海道日本ハムファイターズ", "ファイターズ"],
  "ソフトバンク": ["ソフトバンク", "福岡ソフトバンクホークス", "ホークス"],
  "西武": ["西武", "埼玉西武ライオンズ", "ライオンズ"],
  "ロッテ": ["ロッテ", "千葉ロッテマリーンズ", "マリーンズ"],
  "オリックス": ["オリックス", "オリックス・バファローズ", "バファローズ"],
  "巨人": ["巨人", "読売ジャイアンツ", "ジャイアンツ"],
  "阪神": ["阪神", "阪神タイガース", "タイガース"],
  "中日": ["中日", "中日ドラゴンズ", "ドラゴンズ"],
  "DeNA": ["DeNA", "ＤｅＮＡ", "横浜DeNAベイスターズ", "ベイスターズ"],
  "広島": ["広島", "広島東洋カープ", "カープ"],
  "ヤクルト": ["ヤクルト", "東京ヤクルトスワローズ", "スワローズ"],
};
const CENTRAL_TEAMS = ["巨人", "阪神", "中日", "DeNA", "広島", "ヤクルト"];
const PACIFIC_TEAMS = ["楽天", "日本ハム", "ソフトバンク", "西武", "ロッテ", "オリックス"];

function matchTeamName(rawCell) {
  const cell = (rawCell || "").trim();
  if (!cell) return null;
  let best = null;
  Object.keys(TEAM_ALIASES).forEach((teamName) => {
    TEAM_ALIASES[teamName].forEach((alias) => {
      if (cell.indexOf(alias) !== -1 || alias.indexOf(cell) !== -1) {
        if (!best || alias.length > best.aliasLen) best = { teamName, aliasLen: alias.length };
      }
    });
  });
  return best ? best.teamName : null;
}

function toHalfWidthNumberString(text) {
  return (text || "").trim().replace(/[０-９．－]/g, (c) => {
    if (c === "．") return ".";
    if (c === "－") return "-";
    return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
  });
}
function isNumericCell(text) {
  const t = toHalfWidthNumberString(text);
  if (t === "" || t === "-" || t === "−" || t === "ー" || t === "--") return true;
  return /^-?\d+(\.\d+)?$/.test(t);
}
function parseNum(raw) {
  const s = toHalfWidthNumberString(raw);
  if (s === "" || s === "-" || s === "−" || s === "ー" || s === "--") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
function parseAvgLike(raw) {
  const s = toHalfWidthNumberString(raw);
  const n = parseFloat(s.indexOf(".") === 0 ? "0" + s : s);
  return isNaN(n) ? null : n;
}

// 見出しラベルを手がかりに、球団ごとの行を抽出する（api/stats.js の extractStatsTable と同じ考え方）。
//
// 【重要】std_c/std_p.html（順位表）のページには、シーズン全体の成績表（ページ上部）とは別に、
// その下に「交流戦」だけの成績表がもう1つ載っている。この交流戦表も見出しが
// 「試合・勝利・敗北・引分・勝率」とほぼ同じ（「差」列が無いだけ）なので、見出しラベルの
// 一致数だけで判定すると交流戦表まで「成績表」だと誤認識してしまう。以前の実装は
// $("table").each でページ内の全<table>を素通りし、後から出てきた表のデータで
// 同じ球団名のresultsを無条件に上書きしていたため、最終的に交流戦だけの少ない試合数
// （例：18試合14勝4敗）がシーズン成績として表示されてしまっていた
// （「リーグ順位がめちゃくちゃ昔の情報に見える」「14勝4敗のような記録になる」という不具合の
// 実際の原因。古いキャッシュの問題ではなく、この誤ったテーブルを都度正しく取得し続けていた
// ために起きていた）。NPB公式サイトの各ページでは、シーズン全体の成績表が必ずページの最初に
// 来る作り（交流戦だけの内訳などの補足表は必ずその後に続く）になっているため、「最初に見出し
// 行が見つかり、実際に1球団以上のデータが取れた表」だけを採用し、それ以降の<table>は見ない、
// という方式に変更する。
function extractTeamTable($, wantedLabels) {
  const results = {};
  const debugInfo = { headerFound: false };
  const tables = $("table").toArray();
  for (let t = 0; t < tables.length; t++) {
    const $table = $(tables[t]);
    let headerRow = null;
    let headerCells = null;
    $table.find("tr").each((__, tr) => {
      if (headerRow) return;
      const cells = $(tr).find("th,td").map((___, c) => $(c).text().trim()).get();
      const matchCount = cells.filter((c) => wantedLabels.indexOf(c) !== -1).length;
      if (matchCount >= 2) { headerRow = tr; headerCells = cells; }
    });
    if (!headerRow) continue;

    const colIndex = {};
    headerCells.forEach((label, idx) => { if (wantedLabels.indexOf(label) !== -1) colIndex[label] = idx; });

    const tableResults = {};
    $table.find("tr").each((__, tr) => {
      if (tr === headerRow) return;
      const cells = $(tr).find("th,td").map((___, c) => $(c).text().trim()).get();
      if (!cells.length) return;
      // チーム名列：数値セルではない最初のセル
      let nameRaw = null;
      for (let i = 0; i < cells.length; i++) {
        if (cells[i] && !isNumericCell(cells[i])) { nameRaw = cells[i]; break; }
      }
      if (!nameRaw) return;
      const teamName = matchTeamName(nameRaw);
      if (!teamName) return;

      const out = {};
      Object.keys(colIndex).forEach((label) => {
        const raw = cells[colIndex[label]];
        if (raw === undefined) return;
        out[label] = raw;
      });
      if (Object.keys(out).length) tableResults[teamName] = out;
    });

    if (Object.keys(tableResults).length) {
      // 最初に球団データが取れた表だけを採用し、以降の表（交流戦だけの内訳表など）は無視する
      debugInfo.headerFound = true;
      debugInfo.headerCells = headerCells;
      Object.assign(results, tableResults);
      break;
    }
  }
  return { results, debugInfo };
}

async function fetchPage(url) {
  const r = await axios.get(url, { headers: HTTP_HEADERS, timeout: 8000 });
  return cheerio.load(String(r.data));
}

function jstYear() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.getUTCFullYear();
}

async function buildLeague(year, suffix, teamOrder, debug, debugInfo) {
  const stdUrl = "https://npb.jp/bis/" + year + "/stats/std_" + suffix + ".html";
  const tmbUrl = "https://npb.jp/bis/" + year + "/stats/tmb_" + suffix + ".html";
  const tmpUrl = "https://npb.jp/bis/" + year + "/stats/tmp_" + suffix + ".html";

  const [stdRes, tmbRes, tmpRes] = await Promise.all([
    fetchPage(stdUrl).catch((e) => ({ error: e })),
    fetchPage(tmbUrl).catch((e) => ({ error: e })),
    fetchPage(tmpUrl).catch((e) => ({ error: e })),
  ]);

  let standings = { results: {} };
  let batting = { results: {} };
  let pitching = { results: {} };

  if (stdRes && !stdRes.error) {
    standings = extractTeamTable(stdRes, ["試合", "勝利", "敗北", "引分", "勝率", "差"]);
  } else if (debug) {
    debugInfo["stdError_" + suffix] = String(stdRes.error && (stdRes.error.message || stdRes.error));
  }
  if (tmbRes && !tmbRes.error) {
    batting = extractTeamTable(tmbRes, ["打率", "本塁打"]);
  } else if (debug) {
    debugInfo["tmbError_" + suffix] = String(tmbRes.error && (tmbRes.error.message || tmbRes.error));
  }
  if (tmpRes && !tmpRes.error) {
    pitching = extractTeamTable(tmpRes, ["防御率"]);
  } else if (debug) {
    debugInfo["tmpError_" + suffix] = String(tmpRes.error && (tmpRes.error.message || tmpRes.error));
  }

  // 順位表ページに出てきた順（=順位順）でチームを並べる。順位表が取れなければ既定の並び順にフォールバック。
  const rankedNames = Object.keys(standings.results).length
    ? Object.keys(standings.results)
    : teamOrder;

  const teams = rankedNames.map((teamName, idx) => {
    const s = standings.results[teamName] || {};
    const b = batting.results[teamName] || {};
    const p = pitching.results[teamName] || {};
    return {
      team: teamName,
      rank: idx + 1,
      games: s["試合"] != null ? parseInt(toHalfWidthNumberString(s["試合"]), 10) : null,
      wins: s["勝利"] != null ? parseInt(toHalfWidthNumberString(s["勝利"]), 10) : null,
      losses: s["敗北"] != null ? parseInt(toHalfWidthNumberString(s["敗北"]), 10) : null,
      draws: s["引分"] != null ? parseInt(toHalfWidthNumberString(s["引分"]), 10) : null,
      winPct: s["勝率"] != null ? parseAvgLike(s["勝率"]) : null,
      gamesBehind: s["差"] != null ? (toHalfWidthNumberString(s["差"]) === "--" ? 0 : parseNum(s["差"])) : null,
      teamAvg: b["打率"] != null ? parseAvgLike(b["打率"]) : null,
      teamHr: b["本塁打"] != null ? parseInt(toHalfWidthNumberString(b["本塁打"]), 10) : null,
      teamEra: p["防御率"] != null ? parseNum(p["防御率"]) : null,
    };
  });

  return teams;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");
  const debug = req.query.debug === "1";
  const year = (req.query.year || jstYear()).toString();
  const debugInfo = {};

  try {
    const [central, pacific] = await Promise.all([
      buildLeague(year, "c", CENTRAL_TEAMS, debug, debugInfo),
      buildLeague(year, "p", PACIFIC_TEAMS, debug, debugInfo),
    ]);

    const ok = central.some((t) => t.wins != null) || pacific.some((t) => t.wins != null);

    return res.status(200).json({
      success: ok,
      season: year,
      leagues: { central, pacific },
      updatedAt: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " "),
      ...(debug ? { debug: debugInfo } : {}),
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      error: "通信に失敗しました（NPB公式サイトに接続できませんでした）",
      ...(debug ? { debug: { ...debugInfo, errorMessage: String(err.message || err) } } : {}),
    });
  }
}
