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

// 守備位置表記のゆれ吸収用。DH制のチームで指名打者の表記が「指」ではなく
// 別表記（アルファベットの「DH」、「打」など）になっているケースが実際にあった
// （オリックスの試合で打順1番が「DH」、打順5番が「打」と表記され、
// POSITION_ABBRのどれとも一致せず、その打順が丸ごと欠落するバグが発生していた）。
// 打順の数字（1〜9）自体は正しく取れている前提のもとで、守備位置の表記だけを
// 補正する。ここに無い未知の表記が今後出てきても、下のparseOrderTable側で
// 「守備位置が不明でも、打順番号と選手名さえあれば行を捨てない」ようにしてあるため、
// 選手が丸ごと消えることはない。
const POSITION_ALIASES = {
  "DH": "指",
  "ＤＨ": "指",
  "指名打者": "指",
  "打": "指",
};

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
  for (const alias in POSITION_ALIASES) {
    if (text.indexOf(alias) !== -1) return POSITION_ALIASES[alias];
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
        // 守備位置の表記は揺れがあり（例:「DH」「打」など、POSITION_ABBR/POSITION_ALIASES
        // のどちらにも一致しない未知の表記が今後出てくる可能性もある）、ここで正規化に
        // 失敗しても、打順番号と選手名さえ取れていれば行を捨てない
        // （守備位置が不明なせいで選手そのものが打順から消えるのを防ぐため）。
        const posRaw = (cells[1] || "").trim();
        const pos = normalizePosition(posRaw) || posRaw || "不明";
        // 終了済みの試合では、同じ打順番号の行に代打・代走・守備交代が「→選手名」のような
        // 矢印付きで追加されていることがある。矢印以降（＝実際に途中出場した選手）を優先し、
        // 矢印自体は選手名として残さないよう取り除く。
        const rawName = (cells[2] || "").replace(/[\s　]/g, "");
        const name = rawName.split(/[→←]/).pop();
        if (name) rows.push({ order: orderNum, position: pos, name });
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
//
// 【重要】以前は「対象球団名を一度でも見たら、その後に最初に見つかったテーブルを
// 問答無用で採用する」実装だった。これだと、対象球団名がページ中の離れた場所
// （対戦カードの見出し等）に先に出てきて、その直後にたまたま相手球団の打順表がある場合、
// 相手球団のデータを誤って対象球団のものとして取得してしまう不具合があった
// （実例：楽天のスタメンを要求したのに、オリックスの打順がそのまま返ってきていた。
// 　実際の試合ページでは楽天とオリックスの対戦カードが先に出た後、打順表の並びの都合で
// 　オリックスの表が先に来ており、「楽天」という文字列を一度見た時点でロックしていたため、
// 　直後に来たオリックスの表をそのまま採用してしまっていた）。
// これを防ぐため、対象球団・相手球団どちらの名称が「直近で単独に」言及されていたかを
// 常に追跡し続け、「直近の単独言及が対象球団だったときに出てくるテーブル」だけを候補とする
// （対象球団名を見た後でも、相手球団名を先に見ればロックは相手側に切り替わる）。
// 両チーム名が同じテキスト内に混在する場合（対戦カード見出し等、"東北楽天ゴールデン
// イーグルス vs オリックス・バファローズ" のような1つのテキストに両方含まれる場合）は、
// どちらの打順表の直前見出しでもない可能性が高いため、文脈の更新には使わない。
function findTeamOrderTable($, fullTeamName, opponentFullTeamName) {
  let currentTeam = null;
  let best = null;
  $("body *").each((_, el) => {
    if (best) return;
    const $el = $(el);
    const ownText = $el
      .contents()
      .filter(function () { return this.type === "text"; })
      .text();
    if (ownText) {
      const hasTarget = ownText.indexOf(fullTeamName) !== -1;
      const hasOpponent = !!opponentFullTeamName && ownText.indexOf(opponentFullTeamName) !== -1;
      if (hasTarget && !hasOpponent) currentTeam = fullTeamName;
      else if (hasOpponent && !hasTarget) currentTeam = opponentFullTeamName;
    }
    if ((el.tagName === "table" || el.name === "table") && currentTeam === fullTeamName) {
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

// 指定した1試合（game）について、試合ページ・登録選手ページを取得し、対象球団の
// スタメン・先発投手・ベンチを解析する。「見つからなかった」場合はteamTable: nullで返し、
// 呼び出し側で成功／失敗・フォールバックの要否を判断できるようにする（この関数自体は
// 例外を投げるのはネットワークエラー等の異常時のみ）。
async function fetchGameLineup(game, teamCode, fullName, debugInfo, debugKeyPrefix) {
  const gameUrl = game.url;
  const opponentCode = game.codeA === teamCode ? game.codeB : game.codeA;
  const opponentFullName = CODE_TO_FULL_NAME[opponentCode] || null;

  const indexUrl = gameUrl + "index.html";
  debugInfo[debugKeyPrefix + "IndexUrl"] = indexUrl;
  const gameRes = await axios.get(indexUrl, { headers: HTTP_HEADERS, timeout: 8000 });
  const pageText = String(gameRes.data);
  const $game = cheerio.load(pageText);

  const teamTable = findTeamOrderTable($game, fullName, opponentFullName);
  if (teamTable) debugInfo[debugKeyPrefix + "RawTableRows"] = teamTable.rawRows;

  if (!teamTable || !teamTable.rows.length) {
    return { teamTable: null, notAnnouncedYet: isBeforeAnnouncement($game.text()), pageText, opponentFullName };
  }

  const starters = teamTable.rows
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((r) => ({ order: r.order, position: r.position, name: r.name }));
  const pitcherFromOrder = teamTable.rows.find((r) => r.position === "投");
  const pitcher = pitcherFromOrder ? pitcherFromOrder.name : teamTable.pitcherOutsideOrder;

  let bench = [];
  try {
    const rosterUrl = gameUrl + "roster.html";
    debugInfo[debugKeyPrefix + "RosterUrl"] = rosterUrl;
    const rosterRes = await axios.get(rosterUrl, { headers: HTTP_HEADERS, timeout: 8000 });
    const allNames = fetchRosterNames(rosterRes.data, fullName, opponentFullName);
    const startingNames = new Set(starters.map((s) => s.name));
    if (pitcher) startingNames.add(pitcher);
    bench = allNames.filter((n) => !startingNames.has(n));
  } catch (rosterErr) {
    debugInfo[debugKeyPrefix + "RosterError"] = String(rosterErr.message || rosterErr);
  }

  return { teamTable, starters, pitcher: pitcher || null, bench, opponentFullName, pageText };
}

// monthGames（当月の対象球団の全試合）の中から、beforeMmdd より前で一番直近の試合を探す。
// 当月に無ければ前月の日程ページも確認する（月初めで前回の試合が先月分だったケース向け）。
async function findMostRecentPastGame(monthGames, beforeMmdd, year, mm, teamCode, debugInfo, debugKey) {
  const pastThisMonth = monthGames.filter((g) => g.mmdd < beforeMmdd).sort((a, b) => (a.mmdd < b.mmdd ? 1 : -1));
  if (pastThisMonth.length) return pastThisMonth[0];

  const prev = prevMonthOf(year, mm);
  const prevScheduleUrl = "https://npb.jp/games/" + prev.year + "/schedule_" + prev.mm + "_detail.html";
  debugInfo[debugKey + "PrevScheduleUrl"] = prevScheduleUrl;
  try {
    const prevRes = await axios.get(prevScheduleUrl, { headers: HTTP_HEADERS, timeout: 8000 });
    const $prev = cheerio.load(String(prevRes.data));
    const prevGames = collectTeamGameLinks($prev, prev.year, teamCode, prevScheduleUrl)
      .sort((a, b) => (a.mmdd < b.mmdd ? 1 : -1));
    if (prevGames.length) return prevGames[0];
  } catch (prevErr) {
    debugInfo[debugKey + "PrevScheduleError"] = String(prevErr.message || prevErr);
  }
  return null;
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
    const todayGame = monthGames.find((g) => g.mmdd === mmdd) || null;
    let game = todayGame;
    let isPastGame = false;

    if (!game) {
      game = await findMostRecentPastGame(monthGames, mmdd, year, mm, teamCode, debugInfo, "noGameToday");
      isPastGame = true;
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

    // 2. 試合ページから、スタメン・先発投手・ベンチを取得する
    let result = await fetchGameLineup(game, teamCode, fullName, debugInfo, "primary");

    // 3. 本日の試合はあるが、まだスタメンが発表されていない場合（例：試合開始の数時間前）は、
    //    エラーで終わらせず、直前の「終了済みの試合」のスタメンを代わりに取得して返す。
    //    ユーザーからの要望：「今日のスタメンが未発表のときは、代わりに前回の試合のスタメンを見せてほしい。
    //    ただし今日のものではないことがはっきり分かるように」。そのため notAnnouncedYet フラグを
    //    レスポンスに含め、フロント側で「これは本日のスタメンではありません」という警告を必ず出せるようにする。
    let usedFallbackForUnannounced = false;
    if ((!result.teamTable || !result.teamTable.rows || !result.teamTable.rows.length) && !isPastGame && result.notAnnouncedYet) {
      const fallbackGame = await findMostRecentPastGame(monthGames, mmdd, year, mm, teamCode, debugInfo, "fallback");
      debugInfo.fallbackGame = fallbackGame;
      if (fallbackGame) {
        const fallbackResult = await fetchGameLineup(fallbackGame, teamCode, fullName, debugInfo, "fallback");
        if (fallbackResult.teamTable && fallbackResult.teamTable.rows && fallbackResult.teamTable.rows.length) {
          result = fallbackResult;
          game = fallbackGame;
          isPastGame = true;
          usedFallbackForUnannounced = true;
        }
      }
    }

    if (!result.teamTable || !result.teamTable.rows || !result.teamTable.rows.length) {
      const notAnnouncedYet = !isPastGame && result.notAnnouncedYet;
      return res.status(200).json({
        success: false,
        error: notAnnouncedYet
          ? "本日のスタメンはまだ発表されていません。試合開始が近づいたら、もう一度お試しください"
          : "スタメン情報の取得に失敗しました（ページの形式が変わった可能性があります）",
        ...(debug ? { debug: { ...debugInfo, notAnnouncedYet, pageTextSnippet: (result.pageText || "").slice(0, 2000) } } : {}),
      });
    }

    return res.status(200).json({
      success: true,
      pitcher: result.pitcher || null,
      starters: result.starters,
      bench: result.bench,
      isPastGame,
      gameDate: isPastGame ? gameDateLabel(game.mmdd) : null,
      // 本日の試合自体は存在するが、まだスタメンが発表されておらず、代わりに直前の
      // 終了済み試合のスタメンを返している場合にtrue（フロント側で強めの警告文言に使う）。
      notAnnouncedYet: usedFallbackForUnannounced,
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
