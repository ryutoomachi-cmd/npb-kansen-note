// Vercel Serverless Function: /api/highlights?team={球団名}
//
// 指定球団の「見どころ」（or それに相当する試合ごとの短いテキスト）を、その球団の
// 公式サイトから取得して返す。ユーザーが公式アプリのスクリーンショットで見せてくれた
// 「見どころ」欄と同じ内容を、アプリのホーム画面（NEXT GAMEカード）にも自動で表示する
// ための機能。当初は楽天のみ対応していたが、他球団の公式サイトも調査し対応を広げた。
//
// ===== 各球団の対応状況（調査結果のまとめ） =====
// 開発時点でどの球団の公式サイトにも直接HTTP接続できない環境で書いているため、
// 「実際に生HTMLを見て確認できたもの」と「間接的な情報から推測しているもの」が
// 混ざっている。以下、球団ごとの対応方針と確度：
//
// ・パ・リーグ6球団（楽天／日本ハム／ソフトバンク／西武／ロッテ／オリックス）は
//   共通の公式サイト基盤（いわゆる「パ・リーグ.com」系CMS）を使っており、
//   https://{球団ドメイン}/gamelive/hero/{YYYYMMDD}{試合番号2桁}/ に試合ごとの
//   短いテキストが載っている（confirmed: ロッテ・オリックスは実際にfetchして
//   「試合戦評」という見出しの本文を確認済み。楽天は当初 /gamelive/result/ を
//   見ていたが、これは間違いで正しくは /gamelive/hero/ 側だった。日本ハム／
//   ソフトバンク／西武は同一基盤である可能性が高いという推測に留まる）。
//   ラベルは「見どころ」または「試合戦評」のどちらの可能性もあるため両方試す。
//
// ・阪神タイガースはパ・リーグ系とは別の基盤。モバイルサイト
//   （m.hanshintigers.jp）の「戦評」ページ（URLが試合当日0時JSTのUNIX秒
//   タイムスタンプになっている）に、試合ごとの短い総括文が載っていることを
//   実際にfetchして確認済み。
//
// ・中日／DeNA／広島／ヤクルト／巨人は、公式サイトを調査した範囲では同等の
//   コンテンツが見つからなかった（広島は全ページがJavaScriptで描画される
//   作りで生HTMLからは本文が取得できず、巨人はそもそも調査自体ができなかった
//   ため「無い」と断定はできないが、少なくとも今回は対応を見送っている）。
//   これらの球団は success:false（unsupported:true）を返し、フロント側では
//   見どころ欄を単純に非表示にする。
//
// Vercel上で実際に取得してみて上手く抜き出せない場合は `?debug=1&team=球団名`
// を付けて呼び出すと、ラベル文字列が見つかった前後のテキストがレスポンスに
// 含まれるので、それを見ながら抽出ロジック（URL・ラベル）を調整する。

import axios from "axios";
import * as cheerio from "cheerio";

const TEAM_CODES = {
  "楽天": "e", "日本ハム": "f", "ソフトバンク": "h", "西武": "l",
  "ロッテ": "m", "オリックス": "b", "巨人": "g", "阪神": "t",
  "中日": "d", "DeNA": "db", "広島": "c", "ヤクルト": "s",
};

// パ・リーグ系（/gamelive/hero/ 方式）に対応している球団のドメイン
const PALG_DOMAINS = {
  "楽天": "www.rakuteneagles.jp",
  "日本ハム": "www.fighters.co.jp",
  "ソフトバンク": "www.softbankhawks.co.jp",
  "西武": "www.seibulions.jp",
  "ロッテ": "www.marines.co.jp",
  "オリックス": "www.buffaloes.co.jp",
};
const PALG_LABELS = ["見どころ", "試合戦評"];
const HANSHIN_TEAM_NAME = "阪神";
const HANSHIN_LABELS = ["戦評"];

const HTTP_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; NPBKansenNoteBot/1.0; +https://npb-kansen-note.vercel.app/)",
  "Accept-Language": "ja,en;q=0.8",
};

function jstNow() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC+9に補正したDateオブジェクト（UTCメソッドで年月日を読む）
}
function ymd(d) {
  return { year: d.getUTCFullYear(), mm: String(d.getUTCMonth() + 1).padStart(2, "0"), dd: String(d.getUTCDate()).padStart(2, "0") };
}
// 指定した日付（年月日）の「JSTで午前0時」を表すUNIX秒タイムスタンプ。
// 阪神モバイルサイトのURL（today_review_detail/{タイムスタンプ}）に使う。
// JSTの0:00は「UTCでは前日の15:00」なので、UTCでの0:00から9時間分を引けばよい。
function jstMidnightUnixSeconds(year, mm, dd) {
  const ms = Date.UTC(year, mm - 1, dd, 0, 0, 0) - 9 * 60 * 60 * 1000;
  return Math.floor(ms / 1000);
}
function resolveHref(href, baseUrl) {
  try { return new URL(href, baseUrl).href; } catch (e) { return href; }
}

// npb.jpの月間日程ページから、対象球団の試合を全て集める（api/schedule.jsと同じ考え方）。
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
    results.push({ mmdd, homeCode: codeA, awayCode: codeB, num });
  });
  return results;
}

function pickGame(games, todayMmdd) {
  // 1) 本日開催の試合があればそれ
  const today = games.filter((g) => g.mmdd === todayMmdd);
  if (today.length) return { game: today[0], relation: "today" };
  // 2) 無ければ直近の終了済み試合（見どころ/戦評は基本その試合の内容についてのテキストなので、
  //    本日試合が無い日は直近の終了済み試合の内容を出しておく）
  const past = games.filter((g) => g.mmdd < todayMmdd).sort((a, b) => (a.mmdd < b.mmdd ? 1 : -1));
  if (past.length) return { game: past[0], relation: "past" };
  // 3) それも無ければ直近の未来の試合
  const future = games.filter((g) => g.mmdd > todayMmdd).sort((a, b) => (a.mmdd < b.mmdd ? -1 : 1));
  if (future.length) return { game: future[0], relation: "future" };
  return null;
}

// ラベルの後に出てくる、抽出を打ち切るべき境界ワード
// （本文が終わって次のセクション・関連リンク等に入ったと判断する目印）
const STOP_WORDS = [
  "VIDEOS", "PHOTOS", "PHOTO", "動画", "写真", "関連ニュース", "SNS",
  "一覧を見る", "スコアボード", "スタメン", "試合結果", "シェア", "ツイート", "SHARE",
];

function extractLabel(pageText, label) {
  const idx = pageText.indexOf(label);
  if (idx === -1) return null;
  let rest = pageText.slice(idx + label.length);
  rest = rest.replace(/^[\s　:：\-−—]+/, ""); // 先頭の記号・空白・コロン類を除去
  let cutAt = rest.length;
  STOP_WORDS.forEach((w) => {
    const p = rest.indexOf(w);
    if (p !== -1 && p < cutAt) cutAt = p;
  });
  cutAt = Math.min(cutAt, 600); // 見出しの誤検出等で異常に長く続いてしまう場合への安全策
  let text = rest.slice(0, cutAt).trim();
  text = text.replace(/\s+/g, " ").trim(); // 連続する空白を1つにまとめる
  if (text.length < 20 || text.length > 500) return null; // 短すぎ/長すぎる場合は抽出失敗とみなす
  return text;
}

// 候補ラベルを順番に試し、最初に条件を満たしたものを採用する
// （球団・時期によって実際に使われているラベル文言が違う可能性があるため）
function extractHighlights(pageText, labels) {
  for (let i = 0; i < labels.length; i++) {
    const text = extractLabel(pageText, labels[i]);
    if (text) return { text, label: labels[i] };
  }
  return null;
}

// ページ全文のテキストを、ブロック要素の切れ目に空白を挟みながら取り出す
// （挟まないと単語同士がくっついてしまい、ラベル検索・切り出しの精度が落ちるため）
function buildPageText($) {
  $("script,style,noscript").remove();
  $("p,div,li,br,h1,h2,h3,h4,h5,section,article,tr").after(" ");
  return $("body").text();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");

  const teamName = (req.query.team || "楽天").toString();
  const debug = req.query.debug === "1";
  const debugInfo = {};

  const teamCode = TEAM_CODES[teamName];
  if (!teamCode) {
    return res.status(400).json({ success: false, error: "対応していない球団名です: " + teamName });
  }

  const isPalg = !!PALG_DOMAINS[teamName];
  const isHanshin = teamName === HANSHIN_TEAM_NAME;
  if (!isPalg && !isHanshin) {
    // 中日・DeNA・広島・ヤクルト・巨人：公式サイトに同等のコンテンツが見つからなかった
    // （もしくは調査できなかった）ため、現時点では非対応として扱う
    return res.status(200).json({
      success: false,
      error: teamName + "は現在このアプリでは見どころの自動取得に対応していません",
      unsupported: true,
    });
  }

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
    debugInfo.monthUrl = cur.url;
    debugInfo.games = cur.games.map((g) => g.mmdd + ":" + g.homeCode + "-" + g.awayCode + "-" + g.num);

    const picked = pickGame(cur.games, todayMmdd);
    if (!picked) {
      return res.status(200).json({
        success: false,
        error: "対象の試合が見つかりませんでした",
        ...(debug ? { debug: debugInfo } : {}),
      });
    }

    const g = picked.game;
    const gMm = g.mmdd.slice(0, 2);
    const gDd = g.mmdd.slice(2, 4);
    const gameDate = year + "-" + gMm + "-" + gDd;

    let targetUrl, labels;
    if (isPalg) {
      // 試合結果ページと同じ命名規則（年月日＋2桁の試合番号）と推測している。
      // ダブルヘッダー2試合目（末尾02）は現状未対応で、常に01のみを試す。
      targetUrl = "https://" + PALG_DOMAINS[teamName] + "/gamelive/hero/" + year + gMm + gDd + "01/";
      labels = PALG_LABELS;
    } else {
      const ts = jstMidnightUnixSeconds(parseInt(year, 10), parseInt(gMm, 10), parseInt(gDd, 10));
      targetUrl = "https://m.hanshintigers.jp/game/today_review_detail/" + ts;
      labels = HANSHIN_LABELS;
    }
    debugInfo.targetUrl = targetUrl;

    let pageHtml;
    try {
      const pageRes = await axios.get(targetUrl, { headers: HTTP_HEADERS, timeout: 8000 });
      pageHtml = String(pageRes.data);
    } catch (fetchErr) {
      return res.status(200).json({
        success: false,
        error: "見どころページの取得に失敗しました",
        gameDate,
        ...(debug ? { debug: { ...debugInfo, fetchError: String(fetchErr.message || fetchErr) } } : {}),
      });
    }

    const $page = cheerio.load(pageHtml);
    const pageText = buildPageText($page);

    if (debug) {
      debugInfo.labelHits = {};
      labels.forEach((label) => {
        const idx = pageText.indexOf(label);
        debugInfo.labelHits[label] = idx === -1 ? null : pageText.slice(idx, idx + 400);
      });
    }

    const extracted = extractHighlights(pageText, labels);

    if (!extracted) {
      return res.status(200).json({
        success: false,
        error: "見どころの抽出に失敗しました",
        gameDate,
        isPastGame: picked.relation === "past",
        ...(debug ? { debug: debugInfo } : {}),
      });
    }

    return res.status(200).json({
      success: true,
      highlights: extracted.text,
      label: extracted.label,
      gameDate,
      isPastGame: picked.relation === "past",
      sourceUrl: targetUrl,
      updatedAt: year + "-" + mm + "-" + dd,
      ...(debug ? { debug: debugInfo } : {}),
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      error: "通信に失敗しました（NPB公式サイト／球団公式サイトに接続できませんでした）",
      ...(debug ? { debug: { ...debugInfo, errorMessage: String(err.message || err) } } : {}),
    });
  }
}
