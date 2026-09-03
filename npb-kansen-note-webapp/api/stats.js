// Vercel Serverless Function: /api/stats?team={球団名}
//
// 指定球団の「今季（現在シーズン）の個人打撃成績・投手成績」を、NPB公式サイト（npb.jp）の
// 成績一覧ページからその場で取得して返す。data/teams/{team}.json 内の currentStats
// （打率・本塁打・打点・防御率・勝敗など）は、これまでは手動でファイルを作り直して
// GitHubへpushしないと更新されなかった（＝ホームラン数などが実際の試合結果と
// ズレていく）。このAPIをアプリ起動時に自動で叩き、取得できた最新の数字で
// currentStats を上書きすることで、GitHubへの反映なしに「毎日自動で成績が最新化される」
// 状態を実現する。
//
// ===== 実装にあたっての注意（api/lineup.js・api/schedule.jsと同じ事情） =====
// このAPIもnpb.jpの実際のページを、開発時にはWebFetchでの要約確認しかできない状態で
// 書いている（開発環境からnpb.jpへ直接HTTP接続できないため、生のHTML構造までは
// 確認できていない）。そのため特定のclass名等には依存せず、各成績表の「見出し行
// （試合・打席・本塁打・打率…／登板・勝利・防御率…といった項目名が並ぶ行）」を
// 手がかりに列の並びを動的に判定する作りにしてある（列の並び順がページ側で変わっても
// 追従できるようにするため）。取得・解析に失敗した選手は単に更新をスキップするだけで
// アプリ全体が壊れないようにしてある。
// Vercel上で実際に取得・解析がうまくいかない場合は `?debug=1` を付けて呼び出すと、
// 見つかった見出し行・列マッピング・取得できた選手数などがレスポンスに含まれるので、
// それを見ながら調整する。

import axios from "axios";
import * as cheerio from "cheerio";

const TEAM_CODES = {
  "楽天": "e", "日本ハム": "f", "ソフトバンク": "h", "西武": "l",
  "ロッテ": "m", "オリックス": "b", "巨人": "g", "阪神": "t",
  "中日": "d", "DeNA": "db", "広島": "c", "ヤクルト": "s",
};

const HTTP_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; NPBKansenNoteBot/1.0; +https://npb-kansen-note.vercel.app/)",
  "Accept-Language": "ja,en;q=0.8",
};

// 見出しラベル → アプリ側 currentStats のフィールド名
const BATTING_FIELD_MAP = {
  "試合": "games",
  "打席": "plateAppearances",
  "本塁打": "hr",
  "打点": "rbi",
  "盗塁": "stolenBases",
  "打率": "avg",
};
const PITCHING_FIELD_MAP = {
  "登板": "games",
  "投球回": "inningsPitched",
  "防御率": "era",
  "勝利": "wins",
  "敗北": "losses",
  "セーブ": "saves",
  "三振": "strikeouts",
};

function normalizeName(raw) {
  return (raw || "").replace(/[\s　]/g, "").trim();
}

// 数字（半角/全角）とカンマ・ドットのみで構成されるセルかどうか（＝名前列ではなく数値列）
function isNumericCell(text) {
  const t = (text || "").trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (t === "" || t === "-" || t === "−" || t === "ー") return true; // 空欄・未記録
  return /^-?\d+(\.\d+)?$/.test(t);
}

function toHalfWidthNumberString(text) {
  return (text || "").trim().replace(/[０-９．]/g, (c) => {
    if (c === "．") return ".";
    return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
  });
}

// NPB公式の投球回表記（例："53.2" = 53回2/3）を、このアプリで採用している
// 小数（1/3=.33, 2/3=.67）表記に変換する
function parseInningsPitched(raw) {
  const s = toHalfWidthNumberString(raw);
  if (!/^\d+(\.\d)?$/.test(s)) return null;
  const parts = s.split(".");
  const whole = parseInt(parts[0], 10);
  const frac = parts[1] ? parseInt(parts[1], 10) : 0;
  if (frac === 0) return whole;
  if (frac === 1) return Math.round((whole + 1 / 3) * 100) / 100;
  if (frac === 2) return Math.round((whole + 2 / 3) * 100) / 100;
  return whole;
}

function parseAvgLike(raw) {
  // ".217" や "0.217" や "1.000" などを受け付ける
  const s = toHalfWidthNumberString(raw);
  const m = s.match(/^-?(\d*)\.(\d+)$/) || s.match(/^-?(\d+)$/);
  if (!m) return null;
  const num = parseFloat(s.indexOf(".") === 0 ? "0" + s : s);
  if (isNaN(num)) return null;
  return num;
}
function formatAvgDisplay(num) {
  // 打率は先頭の "0" を省略した表記（.217）、防御率はそのまま（2.67）にするため
  // 呼び出し側で使い分ける。ここは打率用。
  if (num >= 1) return num.toFixed(3);
  return num.toFixed(3).replace(/^0/, "");
}

// ページ内の各<table>を調べ、見出しラベルが一定数以上一致する行を「成績表の見出し行」とみなし、
// 見出し行以降の各行から choices の各フィールドを抽出して {正規化済み選手名: {フィールド:値}} を返す
function extractStatsTable($, fieldMap, statKind) {
  const results = {};
  const debugRows = [];
  const labelToKey = fieldMap;
  const knownLabels = Object.keys(labelToKey);

  $("table").each((_, table) => {
    const $table = $(table);
    let headerRow = null;
    let headerCells = null;
    $table.find("tr").each((__, tr) => {
      if (headerRow) return;
      const cells = $(tr).find("th,td").map((___, c) => $(c).text().trim()).get();
      const matchCount = cells.filter((c) => knownLabels.indexOf(c) !== -1).length;
      if (matchCount >= 3) {
        headerRow = tr;
        headerCells = cells;
      }
    });
    if (!headerRow) return; // このtableは成績表ではない

    const colIndex = {};
    headerCells.forEach((label, idx) => {
      if (labelToKey[label]) colIndex[labelToKey[label]] = idx;
    });

    $table.find("tr").each((__, tr) => {
      if (tr === headerRow) return;
      const cells = $(tr).find("th,td").map((___, c) => $(c).text().trim()).get();
      if (!cells.length) return;
      // 名前列：数値セルではないセルのうち、最も文字数が多いもの（背番号等の数値セルや、
      // 万一「投」等の1文字ポジション略号の列が名前より手前にあってもそれを誤って
      // 選ばないよう、単純に「先頭の非数値セル」ではなく最長のものを選ぶ）
      let nameRaw = null;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c && !isNumericCell(c) && (!nameRaw || c.length > nameRaw.length)) nameRaw = c;
      }
      if (!nameRaw) return;
      const name = normalizeName(nameRaw);
      if (!name) return;

      const out = {};
      Object.keys(colIndex).forEach((key) => {
        const raw = cells[colIndex[key]];
        if (raw === undefined) return;
        if (key === "inningsPitched") {
          const v = parseInningsPitched(raw);
          if (v !== null) out.inningsPitched = v;
        } else if (key === "avg") {
          const v = parseAvgLike(raw);
          if (v !== null) { out.avg = v; out.avgDisplay = formatAvgDisplay(v); }
        } else if (key === "era") {
          const v = parseAvgLike(raw);
          if (v !== null) { out.era = v; out.eraDisplay = v.toFixed(2); }
        } else {
          const s = toHalfWidthNumberString(raw);
          const n = parseInt(s, 10);
          if (!isNaN(n)) out[key] = n;
        }
      });
      if (Object.keys(out).length) {
        results[name] = out;
        if (debugRows.length < 3) debugRows.push({ name, cells, parsed: out });
      }
    });
  });

  return { results, debugRows, headerFound: Object.keys(results).length > 0 };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  const teamName = (req.query.team || "").toString();
  const debug = req.query.debug === "1";
  const teamCode = TEAM_CODES[teamName];
  if (!teamCode) {
    return res.status(400).json({ success: false, error: "対応していない球団名です: " + teamName });
  }

  const year = (req.query.year || new Date().getFullYear()).toString();
  const debugInfo = {};

  try {
    const battingUrl = "https://npb.jp/bis/" + year + "/stats/idb1_" + teamCode + ".html";
    const pitchingUrl = "https://npb.jp/bis/" + year + "/stats/idp1_" + teamCode + ".html";

    const [battingRes, pitchingRes] = await Promise.all([
      axios.get(battingUrl, { headers: HTTP_HEADERS, timeout: 8000 }).catch((e) => ({ error: e })),
      axios.get(pitchingUrl, { headers: HTTP_HEADERS, timeout: 8000 }).catch((e) => ({ error: e })),
    ]);

    let batting = { results: {} };
    let pitching = { results: {} };

    if (battingRes && !battingRes.error) {
      const $b = cheerio.load(String(battingRes.data));
      batting = extractStatsTable($b, BATTING_FIELD_MAP, "batting");
    } else if (battingRes && battingRes.error) {
      debugInfo.battingError = String(battingRes.error.message || battingRes.error);
    }
    if (pitchingRes && !pitchingRes.error) {
      const $p = cheerio.load(String(pitchingRes.data));
      pitching = extractStatsTable($p, PITCHING_FIELD_MAP, "pitching");
    } else if (pitchingRes && pitchingRes.error) {
      debugInfo.pitchingError = String(pitchingRes.error.message || pitchingRes.error);
    }

    const players = {};
    Object.keys(batting.results).forEach((name) => {
      players[name] = Object.assign({ season: year }, batting.results[name]);
    });
    Object.keys(pitching.results).forEach((name) => {
      players[name] = Object.assign({ season: year }, players[name] || {}, pitching.results[name]);
    });

    const success = Object.keys(players).length > 0;

    if (debug) {
      debugInfo.battingUrl = battingUrl;
      debugInfo.pitchingUrl = pitchingUrl;
      debugInfo.battingCount = Object.keys(batting.results).length;
      debugInfo.pitchingCount = Object.keys(pitching.results).length;
      debugInfo.battingSample = batting.debugRows;
      debugInfo.pitchingSample = pitching.debugRows;
    }

    return res.status(200).json({
      success,
      teamName,
      updatedAt: new Date().toISOString(),
      players, // { "正規化済み選手名（スペース無し）": {games, plateAppearances, hr, rbi, stolenBases, avg, avgDisplay} または {games, inningsPitched, era, eraDisplay, wins, losses, saves, strikeouts} }
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
