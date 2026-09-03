// Vercel Serverless Function: /api/lineup?team={球団名}
//
// 本日のNPB公式戦から、指定球団の「本日のスタメン・先発投手・ベンチ入り選手」を
// NPB公式サイト（npb.jp）から取得して返す。
//
// ===== 実装にあたっての注意（重要・必ず読んでください） =====
// このAPIはnpb.jpの実際のページ（日程ページ／試合ページ／登録選手ページ）を
// 開発時にWebFetchで内容を確認しながら書きましたが、生のHTML（タグ名やclass属性）
// までは確認できていません（開発環境からnpb.jpへ直接HTTP接続できず、内容の要約しか
// 取得できなかったため）。そのためテーブル解析は、特定のclass名に依存せず、
// 「打順として妥当な数字」「守備位置の略号（投/捕/一/二/三/遊/左/中/右/指）」
// といった内容の特徴で判定する、多少ゆるめの作りにしてあります。
// Vercel上（実際にnpb.jpへ通信できる環境）でテストして、もし取得に失敗する場合は
// `?debug=1` を付けて呼び出すと、実際に取得したページの断片やマッチング状況が
// レスポンスに含まれるので、それを見ながら調整してください。
//
// また、npb.jpは公式サイトであり自動取得（スクレイピング）に関する利用規約を
// 事前にご確認のうえ、ご自身の判断でご利用ください。過度なアクセスを避けるため
// レスポンスは5分間キャッシュする設定にしています。

import axios from "axios";
import * as cheerio from "cheerio";

const TEAM_CODES = {
  "楽天": "e", "日本ハム": "f", "ソフトバンク": "h", "西武": "l",
  "ロッテ": "m", "オリックス": "b", "巨人": "g", "阪神": "t",
  "中日": "d", "DeNA": "db", "広島": "c", "ヤクルト": "s",
};

// npb.jpの試合ページで、各球団のスタメン表の直前に見出しとして出てくる正式球団名
const TEAM_FULL_NAMES = {
  "楽天": "東北楽天ゴールデンイーグルス",
  "日本ハム": "北海道日本ハムファイターズ",
  "ソフトバンク": "福岡ソフトバンクホークス",
  "西武": "埼玉西武ライオンズ",
  "ロッテ": "千葉ロッテマリーンズ",
  "オリックス": "オリックス・バファローズ",
  "巨人": "読売ジャイアンツ",
  "阪神": "阪神タイガース",
  "中日": "中日ドラゴンズ",
  "DeNA": "横浜DeNAベイスターズ",
  "広島": "広島東洋カープ",
  "ヤクルト": "東京ヤクルトスワローズ",
};

const CODE_TO_FULL_NAME = {};
Object.keys(TEAM_CODES).forEach((name) => {
  CODE_TO_FULL_NAME[TEAM_CODES[name]] = TEAM_FULL_NAMES[name];
});

const POSITION_ABBR = ["投", "捕", "一", "二", "三", "遊", "左", "中", "右", "指"];

const HTTP_HEADERS = {
  // 一般的なブラウザからのアクセスに近いUser-Agentを指定（一部サイトはUAが無いと弾くことがあるため）
  "User-Agent": "Mozilla/5.0 (compatible; NPBKansenNoteBot/1.0; +https://npb-kansen-note.vercel.app/)",
  "Accept-Language": "ja,en;q=0.8",
};

function jstToday() {
  // Vercelの実行環境はUTC基準なので日本時間に補正する
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const mm = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jst.getUTCDate()).padStart(2, "0");
  return { year, mm, dd, mmdd: mm + dd };
}

function resolveHref(href, baseUrl) {
  try { return new URL(href, baseUrl).href; } catch (e) { return href; }
}

// 日程ページ（月間）の中から、対象球団が出てくる試合リンクを全て集める。
// hrefは相対パス（例: "../scores/2026/0902/e-b-23/"）で書かれている可能性があるため、
// 文字列の部分一致ではなく、URLとして解決した絶対URLで判定する（部分一致だと、
// 相対パスの書き方次第で一致しないことがあるため）。
// 「本日の試合」だけでなく「今月の対象球団の全試合」を集めることで、本日試合が
// 無い日（オフ日）には直近の過去の試合にフォールバックできるようにする。
function collectTeamGameLinks($, year, teamCode, baseUrl) {
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
    results.push({
      mmdd,
      codeA,
      codeB,
      url: "https://npb.jp/scores/" + year + "/" + mmdd + "/" + codeA + "-" + codeB + "-" + num + "/",
    });
  });
  return results;
}

function prevMonthOf(year, mm) {
  let y = parseInt(year, 10);
  let m = parseInt(mm, 10) - 1;
  if (m < 1) { m = 12; y -= 1; }
  return { year: y, mm: String(m).padStart(2, "0") };
}

function gameDateLabel(mmdd) {
  return String(parseInt(mmdd.slice(0, 2), 10)) + "月" + String(parseInt(mmdd.slice(2, 4), 10)) + "日";
}

// 守備位置の略号だけを取り出す（"(右)左" のような表記からも1文字取り出せるようにする）
function normalizePosition(raw) {
  const text = (raw || "").trim();
  for (const abbr of POSITION_ABBR) {
    if (text.indexOf(abbr) !== -1) return abbr;
  }
  return null;
}

// テーブル1個からスタメン表らしき行（打順1〜9・守備位置・選手名）を抜き出す。
// 打順として妥当な行が5つ以上見つからなければ「スタメン表ではない」と判定する。
function parseOrderTable($, table) {
  const rows = [];
  const rawRows = []; // 調査用：現在の解析ロジックが拾わなかった行も含め、全行の生セルをそのまま記録
  let pitcherOutsideOrder = null;
  $(table)
    .find("tr")
    .each((_, tr) => {
      const cells = $(tr)
        .find("th,td")
        .map((__, td) => $(td).text().trim())
        .get()
        .filter((t) => t.length > 0);
      if (cells.length < 2) return;
      rawRows.push(cells);

      const orderNum = parseInt(cells[0], 10);
      if (!isNaN(orderNum) && orderNum >= 1 && orderNum <= 9) {
        const pos = normalizePosition(cells[1]);
        // 終了済みの試合では、同じ打順番号の行に代打・代走・守備交代が「→選手名」のような
        // 矢印付きで追加されていることがある。矢印以降（＝実際に途中出場した選手）を優先し、
        // 矢印自体は選手名として残さないよう取り除く。
        const rawName = (cells[2] || "").replace(/[\s　]/g, "");
        const name = rawName.split(/[→←]/).pop();
        if (pos && name) rows.push({ order: orderNum, position: pos, name });
        return;
      }
      // DH制の場合、先発投手は打順に入らず「投｜選手名」だけの行になっていることがある
      if (normalizePosition(cells[0]) === "投" && !pitcherOutsideOrder) {
        const rawName = (cells[1] || "").replace(/[\s　]/g, "");
        const name = rawName.split(/[→←]/).pop();
        if (name) pitcherOutsideOrder = name;
      }
    });
  return { rows, pitcherOutsideOrder, rawRows };
}

// ページ内で対象球団の正式名称が出てくる場所を探し、それより後（文書順で最初）に
// 出てくる「スタメン表らしきテーブル」を返す。class名等の具体的な構造に依存せず、
// 「文書順で見出し→表」という並び方だけを頼りにしているので、入れ子の深さが
// 見出しと表とで違っていても対応できる。
function findTeamOrderTable($, fullTeamName) {
  let seenName = false;
  let best = null;
  $("body *").each((_, el) => {
    if (best) return;
    const $el = $(el);
    if (!seenName) {
      const ownText = $el
        .contents()
        .filter(function () { return this.type === "text"; })
        .text();
      if (ownText.indexOf(fullTeamName) !== -1) seenName = true;
      return;
    }
    if (el.tagName === "table" || el.name === "table") {
      const { rows, pitcherOutsideOrder, rawRows } = parseOrderTable($, el);
      if (rows.length >= 5) best = { rows, pitcherOutsideOrder, rawRows };
    }
  });
  return best;
}

// 「試合開始前」等、スタメン未発表を示す文言がページに含まれるか
function isBeforeAnnouncement(pageText) {
  return (
    pageText.indexOf("試合開始前") !== -1 ||
    pageText.indexOf("スタメン発表前") !== -1 ||
    pageText.indexOf("先発予想") !== -1
  );
}

// roster.htmlには両チームの登録選手が並んでいるため、対象球団の見出しが出てから
// 相手球団の見出しが出るまでの範囲だけを対象に、選手名を拾う（相手選手の混入を防ぐ）。
function fetchRosterNames(rosterHtmlText, fullTeamName, otherFullTeamName) {
  const $ = cheerio.load(rosterHtmlText);
  const names = [];
  let inTargetSection = false;
  $("body *").each((_, el) => {
    const $el = $(el);
    const ownText = $el
      .contents()
      .filter(function () { return this.type === "text"; })
      .text();
    if (ownText.indexOf(fullTeamName) !== -1) { inTargetSection = true; return; }
    if (otherFullTeamName && ownText.indexOf(otherFullTeamName) !== -1) { inTargetSection = false; return; }
    if (!inTargetSection) return;
    if (el.tagName === "tr" || el.name === "tr") {
      const cells = $(el)
        .find("th,td")
        .map((__, td) => $(td).text().trim())
        .get();
      // 背番号列（数字）＋選手名列、という並びの行から選手名だけを拾う
      if (cells.length >= 2 && /^\d{1,3}$/.test(cells[0])) {
        const name = (cells[1] || "").replace(/[\s　]/g, "");
        if (name) names.push(name);
      }
    }
  });
  return names;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");

  const teamName = (req.query.team || "").toString();
  const debug = req.query.debug === "1";
  const teamCode = TEAM_CODES[teamName];
  const fullName = TEAM_FULL_NAMES[teamName];

  if (!teamCode || !fullName) {
    return res.status(400).json({
      success: false,
      error: "対応していない球団名です: " + teamName,
    });
  }

  const debugInfo = {};

  try {
    const { year, mmdd } = jstToday();

    // 1. 月間日程ページから、対象球団の試合リンクを全て集める
    const mm = mmdd.slice(0, 2);
    const scheduleUrl = "https://npb.jp/games/" + year + "/schedule_" + mm + "_detail.html";
    debugInfo.scheduleUrl = scheduleUrl;

    const scheduleRes = await axios.get(scheduleUrl, { headers: HTTP_HEADERS, timeout: 8000 });
    const scheduleHtml = String(scheduleRes.data);
    const $schedule = cheerio.load(scheduleHtml);
    const monthGames = collectTeamGameLinks($schedule, year, teamCode, scheduleUrl);
    debugInfo.monthGamesFound = monthGames.map((g) => g.mmdd + ":" + g.codeA + "-" + g.codeB);
    debugInfo.mmddAppearsInPage = scheduleHtml.indexOf(mmdd) !== -1;

    // 本日の試合があればそれを使う。無ければ、今月分の中から一番直近の「過去の」試合を
    // 探す（＝オフ日でも、前回の試合のスタメンを「終了済みの試合」として表示できるようにする）。
    // 今月分に対象球団の試合が1件も見つからない場合（月初めで前回の試合が先月分など）は、
    // 先月の日程ページも確認する。
    let game = monthGames.find((g) => g.mmdd === mmdd) || null;
    let isPastGame = false;

    if (!game) {
      const pastThisMonth = monthGames.filter((g) => g.mmdd < mmdd).sort((a, b) => (a.mmdd < b.mmdd ? 1 : -1));
      if (pastThisMonth.length) {
        game = pastThisMonth[0];
        isPastGame = true;
      } else {
        const prev = prevMonthOf(year, mm);
        const prevScheduleUrl = "https://npb.jp/games/" + prev.year + "/schedule_" + prev.mm + "_detail.html";
        debugInfo.prevScheduleUrl = prevScheduleUrl;
        try {
          const prevRes = await axios.get(prevScheduleUrl, { headers: HTTP_HEADERS, timeout: 8000 });
          const $prev = cheerio.load(String(prevRes.data));
          const prevGames = collectTeamGameLinks($prev, prev.year, teamCode, prevScheduleUrl)
            .sort((a, b) => (a.mmdd < b.mmdd ? 1 : -1));
          if (prevGames.length) {
            game = prevGames[0];
            isPastGame = true;
          }
        } catch (prevErr) {
          debugInfo.prevScheduleError = String(prevErr.message || prevErr);
        }
      }
    }

    debugInfo.game = game;
    debugInfo.isPastGame = isPastGame;

    if (!game) {
      return res.status(200).json({
        success: false,
        error: "本日および直近の" + teamName + "の試合が見つかりませんでした",
        ...(debug ? { debug: debugInfo } : {}),
      });
    }

    const gameUrl = game.url;
    const opponentCode = game.codeA === teamCode ? game.codeB : game.codeA;
    const opponentFullName = CODE_TO_FULL_NAME[opponentCode] || null;

    // 2. 試合ページから、スタメン・先発投手を取得する
    const indexUrl = gameUrl + "index.html";
    debugInfo.indexUrl = indexUrl;
    const gameRes = await axios.get(indexUrl, { headers: HTTP_HEADERS, timeout: 8000 });
    const pageText = String(gameRes.data);
    const $game = cheerio.load(pageText);

    // 「試合開始前」の表示は、スタメンが発表済みでも試合が始まるまでは出続ける可能性があるため、
    // これだけでブロックせず、まずスタメン表の取得を試み、失敗した場合の判定材料として使う。
    const teamTable = findTeamOrderTable($game, fullName);
    // 調査用：現在の解析ロジックが実際に何を拾っているか（拾えていない行も含めて）確認できるよう、
    // テーブルの生のセル内容をそのままdebugInfoに残しておく（`?debug=1`のときだけレスポンスに含まれる）。
    if (teamTable) debugInfo.rawTableRows = teamTable.rawRows;
    if (!teamTable || !teamTable.rows.length) {
      const notAnnouncedYet = !isPastGame && isBeforeAnnouncement($game.text());
      return res.status(200).json({
        success: false,
        error: notAnnouncedYet
          ? "本日のスタメンはまだ発表されていません。試合開始が近づいたら、もう一度お試しください"
          : "スタメン情報の取得に失敗しました（ページの形式が変わった可能性があります）",
        ...(debug ? { debug: { ...debugInfo, notAnnouncedYet, pageTextSnippet: pageText.slice(0, 2000) } } : {}),
      });
    }

    const starters = teamTable.rows
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((r) => ({ order: r.order, position: r.position, name: r.name }));

    // 先発投手: 打順の中に「投」がいればそれ（DH無し）、無ければ打順外の「投｜選手名」行（DH制）
    const pitcherFromOrder = teamTable.rows.find((r) => r.position === "投");
    const pitcher = pitcherFromOrder ? pitcherFromOrder.name : teamTable.pitcherOutsideOrder;

    // 3. 登録選手一覧（ベンチ入り選手を含む）を取得し、スタメン・先発投手を除いたものをベンチとする
    let bench = [];
    try {
      const rosterUrl = gameUrl + "roster.html";
      debugInfo.rosterUrl = rosterUrl;
      const rosterRes = await axios.get(rosterUrl, { headers: HTTP_HEADERS, timeout: 8000 });
      const allNames = fetchRosterNames(rosterRes.data, fullName, opponentFullName);
      const startingNames = new Set(starters.map((s) => s.name));
      if (pitcher) startingNames.add(pitcher);
      bench = allNames.filter((n) => !startingNames.has(n));
    } catch (rosterErr) {
      // ベンチ情報の取得に失敗しても、スタメン自体は返す（bench: [] のまま）
      debugInfo.rosterError = String(rosterErr.message || rosterErr);
    }

    return res.status(200).json({
      success: true,
      pitcher: pitcher || null,
      starters,
      bench,
      isPastGame,
      gameDate: isPastGame ? gameDateLabel(game.mmdd) : null,
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
