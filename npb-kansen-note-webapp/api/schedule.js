// Vercel Serverless Function: /api/schedule?team={球団名}
//
// 指定球団の「次の試合（本日開催 or 直近の未来の試合。無ければ直近の終了済み試合）」を
// NPB公式サイト（npb.jp）の月間日程ページから取得して返す。
// data/schedule.json（球団ごとの静的な「次の試合」データ）を手動で作り直さなくても、
// ホーム画面の「日程を更新」ボタンからその場で最新化できるようにするための機能。
//
// ===== 実装にあたっての注意（api/lineup.jsと同じ事情） =====
// このAPIもnpb.jpの実際のページを、開発時にはWebFetchでの要約確認しかできない状態で
// 書いている（開発環境からnpb.jpへ直接HTTP接続できないため、生のHTML構造までは
// 確認できていない）。そのためテーブル解析は、特定のclass名等に依存せず、
// 「試合結果ページへのリンク（/scores/年/月日/球団コードA-球団コードB-番号/）」という
// 確実な手がかりを起点に、その行のセルテキストから球場名を緩めに推測する作りにしてある。
// 球場名の抽出に失敗しても（venue: null になるだけで）試合日・対戦相手・開催地（本拠地/
// ビジター）は問題なく返せるようにしてある。
// Vercel上で実際に取得に失敗する場合は `?debug=1` を付けて呼び出すと、取得した月間日程
// ページの中からこの球団に関する試合行の生セル内容がレスポンスに含まれるので、それを見ながら
// 調整する。

import axios from "axios";
import * as cheerio from "cheerio";

const TEAM_CODES = {
  "楽天": "e", "日本ハム": "f", "ソフトバンク": "h", "西武": "l",
  "ロッテ": "m", "オリックス": "b", "巨人": "g", "阪神": "t",
  "中日": "d", "DeNA": "db", "広島": "c", "ヤクルト": "s",
};
const CODE_TO_TEAM_NAME = {};
Object.keys(TEAM_CODES).forEach((name) => { CODE_TO_TEAM_NAME[TEAM_CODES[name]] = name; });

const HTTP_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; NPBKansenNoteBot/1.0; +https://npb-kansen-note.vercel.app/)",
  "Accept-Language": "ja,en;q=0.8",
};

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

// npb.jpの日程ページに出てくる球場の略称 → アプリで表示している正式名称（分かっているものだけ）。
// ここに無い略称は略称のままvenueとして返す（無理に正式名称化しない＝誤変換を避けるため）。
const VENUE_FULL_NAMES = {
  "楽天モバイル": "楽天モバイルパーク宮城",
  "盛岡": "きたぎんボールパーク（盛岡）",
  "秋田": "こまちスタジアム",
  "いわき": "ヨーク開成山スタジアム",
  "エスコンＦ": "エスコンフィールドHOKKAIDO",
  "エスコンF": "エスコンフィールドHOKKAIDO",
  "みずほペイペイ": "みずほPayPayドーム福岡",
  "ペイペイドーム": "みずほPayPayドーム福岡",
  "ベルーナ": "ベルーナドーム",
  "ZOZO": "ZOZOマリンスタジアム",
  "京セラ": "京セラドーム大阪",
  "東京D": "東京ドーム",
  "甲子園": "阪神甲子園球場",
  "バンテリン": "バンテリンドームナゴヤ",
  "横浜": "横浜スタジアム",
  "マツダ": "MAZDA Zoom-Zoom スタジアム広島",
  "神宮": "明治神宮野球場",
};
function fullVenueName(short) {
  var s = (short || "").trim();
  if (!s) return null;
  return VENUE_FULL_NAMES[s] || s;
}

function jstNow() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC+9に補正したDateオブジェクト（UTCメソッドで年月日を読む）
}
function ymd(d) {
  return { year: d.getUTCFullYear(), mm: String(d.getUTCMonth() + 1).padStart(2, "0"), dd: String(d.getUTCDate()).padStart(2, "0") };
}
function addMonths(year, mm, delta) {
  let y = parseInt(year, 10);
  let m = parseInt(mm, 10) - 1 + delta;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return { year: y, mm: String(m + 1).padStart(2, "0") };
}
function weekdayJaFor(year, mm, dd) {
  // JSTのカレンダー日として曜日を出したいので、UTC正午を使うことでタイムゾーン境界の
  // ずれ（日付が前後にずれる事故）を避ける
  const d = new Date(Date.UTC(parseInt(year, 10), parseInt(mm, 10) - 1, parseInt(dd, 10), 12, 0, 0));
  return WEEKDAY_JA[d.getUTCDay()];
}
function resolveHref(href, baseUrl) {
  try { return new URL(href, baseUrl).href; } catch (e) { return href; }
}

// 月間日程ページから、対象球団の試合を全て集める。1試合＝1つの結果ページへのリンクを起点に、
// そのリンクを含む<tr>の全セルテキストも一緒に保持しておく（球場名の推測・調査用）。
function collectTeamGames($, year, teamCode, baseUrl) {
  const re = new RegExp("/scores/" + year + "/(\\d{4})/([a-z]+)-([a-z]+)-(\\d+)/");
  const results = [];
  const seen = {};
  $("a[href]").each((_, el) => {
    const rawHref = $(el).attr("href") || "";
    if (rawHref.indexOf("/scores/") === -1 && rawHref.indexOf("scores/") === -1) return;
    const abs = resolveHref(rawHref, baseUrl);
    const m = abs.match(re);
    if (!m) return;
    const mmdd = m[1], codeA = m[2], codeB = m[3], num = m[4];
    if (codeA !== teamCode && codeB !== teamCode) return;
    const key = mmdd + "-" + codeA + "-" + codeB + "-" + num;
    if (seen[key]) return;
    seen[key] = true;
    const $tr = $(el).closest("tr");
    const rowCells = $tr.length
      ? $tr.find("th,td").map((__, td) => $(td).text().trim()).get().filter((t) => t.length > 0)
      : [];
    // codeAが本拠地球団、codeBが相手（先に確認済みの命名規則：/scores/年/月日/ホーム-ビジター-番号/）
    results.push({ mmdd, homeCode: codeA, awayCode: codeB, rowCells });
  });
  return results;
}

// その試合の行セルの中から、時刻表記（H:MM）を手がかりに球場名らしき文字列を推測する。
// 見つからなければnull（無理に当てにいかない）。
function guessVenue(rowCells) {
  for (const cell of rowCells) {
    const m = cell.match(/^(.*?)\s*(\d{1,2}:\d{2})/);
    if (m && m[1] && m[1].trim()) {
      return fullVenueName(m[1].trim());
    }
  }
  return null;
}

function pickGame(games, todayMmdd) {
  // 1) 本日開催の試合があればそれ
  const today = games.filter((g) => g.mmdd === todayMmdd);
  if (today.length) return { game: today[0], relation: "today" };
  // 2) 本日より後で最も近い試合
  const future = games.filter((g) => g.mmdd > todayMmdd).sort((a, b) => (a.mmdd < b.mmdd ? -1 : 1));
  if (future.length) return { game: future[0], relation: "future" };
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");

  const teamName = (req.query.team || "").toString();
  const debug = req.query.debug === "1";
  const teamCode = TEAM_CODES[teamName];
  if (!teamCode) {
    return res.status(400).json({ success: false, error: "対応していない球団名です: " + teamName });
  }

  const debugInfo = {};

  try {
    const now = jstNow();
    const { year, mm, dd } = ymd(now);
    const todayMmdd = mm + dd;

    const fetchMonthPage = async (y, monthMm) => {
      const url = "https://npb.jp/games/" + y + "/schedule_" + monthMm + "_detail.html";
      const r = await axios.get(url, { headers: HTTP_HEADERS, timeout: 8000 });
      const $ = cheerio.load(String(r.data));
      return { url, games: collectTeamGames($, y, teamCode, url) };
    };

    const cur = await fetchMonthPage(year, mm);
    debugInfo.currentMonthUrl = cur.url;
    debugInfo.currentMonthGames = cur.games.map((g) => g.mmdd + ":" + g.homeCode + "-" + g.awayCode);

    let picked = pickGame(cur.games, todayMmdd);
    let usedMonth = { year, mm };

    if (!picked) {
      // 今月分に「本日以降」の試合が無ければ、来月分もチェックする（月末〜月初のまたぎ対策）
      const next = addMonths(year, mm, 1);
      try {
        const nxt = await fetchMonthPage(next.year, next.mm);
        debugInfo.nextMonthUrl = nxt.url;
        debugInfo.nextMonthGames = nxt.games.map((g) => g.mmdd + ":" + g.homeCode + "-" + g.awayCode);
        if (nxt.games.length) {
          const sorted = nxt.games.slice().sort((a, b) => (a.mmdd < b.mmdd ? -1 : 1));
          picked = { game: sorted[0], relation: "future" };
          usedMonth = next;
        }
      } catch (nextErr) {
        debugInfo.nextMonthError = String(nextErr.message || nextErr);
      }
    }

    let isPastGame = false;
    if (!picked) {
      // 来月分にも見つからない場合（オフシーズン等）は、今月分の中の直近の終了済み試合にフォールバック
      const past = cur.games.filter((g) => g.mmdd < todayMmdd).sort((a, b) => (a.mmdd < b.mmdd ? 1 : -1));
      if (past.length) {
        picked = { game: past[0], relation: "past" };
        isPastGame = true;
        usedMonth = { year, mm };
      }
    }

    if (!picked) {
      return res.status(200).json({
        success: false,
        error: teamName + "の試合日程が見つかりませんでした",
        ...(debug ? { debug: debugInfo } : {}),
      });
    }

    const g = picked.game;
    const isHome = g.homeCode === teamCode;
    const opponentCode = isHome ? g.awayCode : g.homeCode;
    const opponent = CODE_TO_TEAM_NAME[opponentCode] || null;
    const gDd = g.mmdd.slice(2, 4);
    const gMm = g.mmdd.slice(0, 2);
    const dateStr = usedMonth.year + "-" + gMm + "-" + gDd;
    const dateDisplay = String(parseInt(gMm, 10)) + "/" + String(parseInt(gDd, 10)) + "(" + weekdayJaFor(usedMonth.year, gMm, gDd) + ")";
    const venue = guessVenue(g.rowCells);

    if (debug) debugInfo.pickedRowCells = g.rowCells;

    return res.status(200).json({
      success: true,
      game: {
        teamName,
        date: dateStr,
        dateDisplay,
        opponent,
        home: isHome,
        venue,
        updatedAt: year + "-" + mm + "-" + dd,
      },
      isPastGame,
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
