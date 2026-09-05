(function () {
  "use strict";

  /* ===================== 選手データ（旧: data.js内の定数。現在はfetchで非同期取得して埋める） ===================== */
  var PLAYERS = [];
  var RELATIONS = [];
  var TEAM_NEXT_GAMES = [];
  var NEWS = [];
  var LEGENDS = null; // レジェンド機能用データ（起動直後の描画をブロックしないよう、boot()後にバックグラウンドで取得）
  var legendsLoadFailed = false;
  var STATS_LAST_UPDATED = null; // 今季成績（打率・本塁打など）をapi/stats.jsで自動更新した最新日時（表示用）
  var SCHEDULE_LAST_UPDATED = null; // 試合日程をapi/schedule.jsで自動更新した最新日時（表示用）
  var HIGHLIGHTS_TEXT = null; // 「見どころ」テキスト（api/highlights.jsで自動取得。対応球団のみ）
  var HIGHLIGHTS_GAME_DATE = null; // 上記「見どころ」がどの試合日のものか（YYYY-MM-DD）
  var HIGHLIGHTS_TEAM = null; // 上記「見どころ」がどの球団向けに取得したものか（球団切り替え時の一瞬の表示ズレ防止用）
  var legendsLoadPromise = null;
  var STANDINGS_DATA = null; // リーグ順位表・チーム成績（api/standings.jsで自動取得。リーグ全体のため球団非依存）
  var TODAY_STARTER_HOME = null; // 本日の実際の先発投手（ホーム球団側）。api/lineup.jsの確定スタメンから取得（{pitcherName, player}）
  var TODAY_STARTER_AWAY = null; // 本日の実際の先発投手（対戦相手側。今日の実際の対戦相手のぶん）
  var TODAY_STARTER_KEY = null; // 上記がどの対戦カード向けに取得したものか（"ホーム球団|相手球団|日付"）
  var WEATHER_DATA = null; // 次の試合会場の天気（api/weather.jsで自動取得）
  var WEATHER_KEY = null; // 上記がどの球場・日付向けに取得したものか（"球場名|YYYY-MM-DD"）

  /* ===================== Icons (hand-drawn, minimal) ===================== */
  var ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    x: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
    chevronLeft: '<polyline points="15 6 9 12 15 18"/>',
    sort: '<polyline points="7 4 7 20"/><polyline points="4 7 7 4 10 7"/><polyline points="17 20 17 4"/><polyline points="14 17 17 20 20 17"/>',
    mapPin: '<path d="M12 21s-7-7.2-7-12a7 7 0 0 1 14 0c0 4.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.4"/>',
    alertTriangle: '<path d="M12 3 L22 20 L2 20 Z" stroke-linejoin="round"/><line x1="12" y1="9.5" x2="12" y2="14.5"/><circle cx="12" cy="17.3" r="0.9" fill="currentColor" stroke="none"/>',
    music: '<circle cx="6.5" cy="18" r="2.6"/><circle cx="17.5" cy="16" r="2.6"/><path d="M9.1 18V4.6L20.1 2.6V16"/>',
    sparkles: '<path d="M12 3.2l1.7 5.1 5.1 1.7-5.1 1.7-1.7 5.1-1.7-5.1-5.1-1.7 5.1-1.7z" stroke-linejoin="round"/>',
    network: '<circle cx="6" cy="6.5" r="2.4"/><circle cx="18" cy="6.5" r="2.4"/><circle cx="12" cy="18" r="2.4"/><line x1="8" y1="7.8" x2="10.6" y2="15.8"/><line x1="16" y1="7.8" x2="13.4" y2="15.8"/><line x1="8.3" y1="6.5" x2="15.7" y2="6.5"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9"/><path d="M9.5 20v-6h5v6"/>',
    info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.9" fill="currentColor" stroke="none"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 5H4.5a1 1 0 0 0-1 1.2c.4 2 1.9 3.5 4 3.8"/><path d="M16 5h3.5a1 1 0 0 1 1 1.2c-.4 2-1.9 3.5-4 3.8"/><path d="M10 13.2v2.6M14 13.2v2.6"/><path d="M8 20h8"/><path d="M9.5 16.8h5l.6 3.2h-6.2z"/>',
    users: '<circle cx="8.5" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M2.8 19c.6-3.3 3-5.2 5.7-5.2s5.1 1.9 5.7 5.2"/><path d="M14.8 14.3c2.2.2 4 1.9 4.5 4.7"/>',
    clipboard: '<rect x="5.5" y="4.5" width="13" height="16" rx="2"/><path d="M9 4.5V3.8a1.8 1.8 0 0 1 1.8-1.8h2.4A1.8 1.8 0 0 1 15 3.8v.7"/><line x1="8.5" y1="10.5" x2="15.5" y2="10.5"/><line x1="8.5" y1="14" x2="15.5" y2="14"/><line x1="8.5" y1="17.5" x2="12.5" y2="17.5"/>',
    filter: '<path d="M3.5 5h17" /><path d="M6.5 12h11" /><path d="M10 19h4" />',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 17.42a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 13 1.65 1.65 0 0 0 3.17 12H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 6.9a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 2.2l.06.06A1.65 1.65 0 0 0 8.92 2.6 1.65 1.65 0 0 0 9.9 1.1V1a2 2 0 1 1 4 0v.09c0 .68.4 1.28 1 1.51.62.25 1.33.12 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.45.49-.58 1.2-.33 1.82.23.6.83 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.68 0-1.28.4-1.51 1z" stroke-linejoin="round"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    download: '<path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M4 19h16"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'
  };
  function icon(name, size, extraClass) {
    size = size || 16;
    return '<svg class="' + (extraClass || "") + '" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + "</svg>";
  }

  /* ===================== 球団マスタ（テーマ・地元判定・規定計算の基準） ===================== */
  var TEAMS = [
    { name: "楽天", fullName: "東北楽天ゴールデンイーグルス", league: "パ", color: "#870010", ink: "#FFFFFF", accent: "#C8A45C", emoji: "🦅", gamesPlayed: 117,
      regionLabel: "東北", regionKeywords: ["宮城", "岩手", "青森", "秋田", "山形", "福島", "東北", "仙台"] },
    { name: "日本ハム", fullName: "北海道日本ハムファイターズ", league: "パ", color: "#0068B7", ink: "#FFFFFF", accent: "#B4B4B4", emoji: "🐻", gamesPlayed: 121,
      regionLabel: "北海道", regionKeywords: ["北海道", "札幌", "函館", "旭川", "帯広", "釧路"] },
    { name: "ソフトバンク", fullName: "福岡ソフトバンクホークス", league: "パ", color: "#F2A900", ink: "#111111", accent: "#000000", emoji: "🦅", gamesPlayed: 118,
      regionLabel: "福岡・九州", regionKeywords: ["福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "九州"] },
    { name: "西武", fullName: "埼玉西武ライオンズ", league: "パ", color: "#1C3F94", ink: "#FFFFFF", accent: "#93C7EC", emoji: "🦁", gamesPlayed: 121,
      regionLabel: "埼玉", regionKeywords: ["埼玉", "所沢", "川越", "さいたま"] },
    { name: "ロッテ", fullName: "千葉ロッテマリーンズ", league: "パ", color: "#2B2B2B", ink: "#FFFFFF", accent: "#B0B7BC", emoji: "🌊", gamesPlayed: 115,
      regionLabel: "千葉", regionKeywords: ["千葉", "船橋", "市川", "松戸", "柏"] },
    { name: "オリックス", fullName: "オリックス・バファローズ", league: "パ", color: "#00174A", ink: "#FFFFFF", accent: "#B08D4E", emoji: "🐃", gamesPlayed: 120,
      regionLabel: "大阪・近畿", regionKeywords: ["大阪", "兵庫", "京都", "奈良", "和歌山", "滋賀", "神戸"] },
    { name: "巨人", fullName: "読売ジャイアンツ", league: "セ", color: "#F97709", ink: "#111111", accent: "#000000", emoji: "🟠", gamesPlayed: 119,
      regionLabel: "東京", regionKeywords: ["東京", "神奈川", "埼玉", "千葉"] },
    { name: "阪神", fullName: "阪神タイガース", league: "セ", color: "#FFE100", ink: "#111111", accent: "#000000", emoji: "🐯", gamesPlayed: 117,
      regionLabel: "兵庫・関西", regionKeywords: ["兵庫", "大阪", "京都", "奈良", "和歌山", "滋賀", "西宮", "神戸"] },
    { name: "中日", fullName: "中日ドラゴンズ", league: "セ", color: "#002569", ink: "#FFFFFF", accent: "#5F9BD5", emoji: "🐉", gamesPlayed: 121,
      regionLabel: "東海", regionKeywords: ["愛知", "岐阜", "三重", "静岡", "名古屋"] },
    { name: "DeNA", fullName: "横浜DeNAベイスターズ", league: "セ", color: "#0091D2", ink: "#FFFFFF", accent: "#00355F", emoji: "⭐", gamesPlayed: 118,
      regionLabel: "神奈川", regionKeywords: ["神奈川", "横浜", "川崎", "湘南", "相模"] },
    { name: "広島", fullName: "広島東洋カープ", league: "セ", color: "#E60012", ink: "#FFFFFF", accent: "#231815", emoji: "🎏", gamesPlayed: 114,
      regionLabel: "広島・中国地方", regionKeywords: ["広島", "山口", "岡山", "島根", "鳥取"] },
    { name: "ヤクルト", fullName: "東京ヤクルトスワローズ", league: "セ", color: "#00468C", ink: "#FFFFFF", accent: "#E4002B", emoji: "🐦", gamesPlayed: 117,
      regionLabel: "東京", regionKeywords: ["東京", "神奈川", "埼玉", "千葉"] }
  ];
  var TEAM_NAMES = TEAMS.map(function (t) { return t.name; });
  var DEFAULT_HOME_TEAM = "楽天";
  var DATA_AS_OF = "2026年9月3日時点（NPB公式記録・Wikipediaほか、全12球団769選手）";
  // ↑ プロフィール等の基本情報の基準時点。今季成績（打率・本塁打など）はこれとは別に
  //   api/stats.js経由でNPB公式サイトから自動更新される（statsFreshnessText参照）
  function getTeam(name) {
    for (var i = 0; i < TEAMS.length; i++) if (TEAMS[i].name === name) return TEAMS[i];
    return TEAMS[0];
  }
  function teamColor(name) { var t = getTeam(name); return { bg: t.color, fg: t.ink }; }

  // 各球団の直近の試合情報（TEAM_NEXT_GAMES は data.js 内の実データ。各球団公式サイト等を
  // 突き合わせて確認したもので、架空の日程は含みません。週1回、自動で更新されます）
  function nextGameFor(teamName) {
    for (var i = 0; i < TEAM_NEXT_GAMES.length; i++) {
      if (TEAM_NEXT_GAMES[i].teamName === teamName) return TEAM_NEXT_GAMES[i];
    }
    return null;
  }

  /* ===================== データの非同期取得＋キャッシュ =====================
     選手データ（旧data.js）は /data/teams/{teamId}.json 等の外部JSONに分離済み。
     初期表示はホーム球団ぶんのみ取得して即描画し、残り11球団は裏で取得して後から
     マージ・再描画する（初期通信量を最小化するため）。取得済みデータはlocalStorageに
     キャッシュし、次回起動時はまずキャッシュを即表示 → 裏で最新版を取得して更新する
     （stale-while-revalidate）。キャッシュもネットワークも無い場合のみ失敗として扱う。 */
  var TEAM_ID_MAP = {
    "楽天": "rakuten", "日本ハム": "nipponham", "ソフトバンク": "softbank", "西武": "seibu",
    "ロッテ": "lotte", "オリックス": "orix", "巨人": "giants", "阪神": "hanshin",
    "中日": "chunichi", "DeNA": "dena", "広島": "hiroshima", "ヤクルト": "yakult"
  };
  // 各 data/teams/{teamId}.json の中では「その球団の選手だけ」しか入っておらず currentTeamName は
  // 全レコードで同じ値になり冗長（通信量の無駄）なので、JSON側からは削除し、取得直後にここで
  // 付け直す（既存のレンダリング/フィルタ処理は p.currentTeamName が付いている前提のまま変更不要）
  var TEAM_ID_TO_NAME = {};
  for (var _teamName in TEAM_ID_MAP) { TEAM_ID_TO_NAME[TEAM_ID_MAP[_teamName]] = _teamName; }
  var CACHE_PREFIX = "nsnCacheV1_";
  var CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6時間：週次更新データなので、これより新しければキャッシュを信用する

  function cacheRead(key) {
    try {
      var raw = window.localStorage && localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      var wrapped = JSON.parse(raw);
      return wrapped && typeof wrapped.t === "number" ? wrapped : null;
    } catch (e) { return null; }
  }
  function cacheWrite(key, data) {
    try {
      if (window.localStorage) localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), d: data }));
    } catch (e) { /* 容量超過等はキャッシュを諦めるだけで致命的ではないので無視 */ }
  }

  function fetchWithCache(key, url) {
    var cached = cacheRead(key);
    var fresh = fetch(url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
      return res.json();
    }).then(function (data) {
      cacheWrite(key, data);
      return data;
    });
    if (cached && (Date.now() - cached.t) <= CACHE_MAX_AGE_MS) {
      fresh.catch(function () { /* オフライン時のバックグラウンド更新失敗は正常な状態なので無視 */ });
      return Promise.resolve(cached.d);
    }
    // キャッシュが無い/古い場合はネットワーク取得を待つ。取得に失敗しても、古いキャッシュがあれば
    // それで救済する（電波が弱い球場でも、一度でも開いていれば古いデータで表示を続けられる）。
    return fresh.catch(function (err) {
      if (cached) return cached.d;
      throw err;
    });
  }

  // ヘッダーの更新ボタン用：キャッシュ（localStorageの6時間キャッシュ・Service Workerのデータキャッシュ）を
  // 一切信用せず、必ずネットワークから最新のJSONを取りに行く。URLにキャッシュ避けのクエリを付けることで、
  // service-worker.js側のstale-while-revalidate（＝まずキャッシュ済みの古い応答を即返す挙動）も回避する。
  function forceFetchJson(url) {
    var bustUrl = url + (url.indexOf("?") === -1 ? "?" : "&") + "_r=" + Date.now();
    return fetch(bustUrl, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
      return res.json();
    });
  }

  function loadTeamPlayers(teamId) {
    return fetchWithCache("team_" + teamId, "data/teams/" + teamId + ".json").then(function (list) {
      var teamName = TEAM_ID_TO_NAME[teamId];
      list.forEach(function (p) { p.currentTeamName = teamName; });
      return list;
    });
  }
  function loadRelations() { return fetchWithCache("relations", "data/relations.json"); }
  function loadSchedule() { return fetchWithCache("schedule", "data/schedule.json"); }
  function loadNews() { return fetchWithCache("news", "data/news.json"); }

  // レジェンドデータ（50人超）は初回描画には不要なため、boot()完了後にバックグラウンドで
  // 取得する（レジェンドタブを開いたとき・選手詳細の「似た成績のレジェンド」表示のときに使う）。
  // 既に取得済み/取得中ならその結果を再利用する。
  function ensureLegendsLoaded() {
    if (LEGENDS) return Promise.resolve(LEGENDS);
    if (!legendsLoadPromise) {
      legendsLoadFailed = false;
      legendsLoadPromise = fetchWithCache("legends", "data/legends.json").then(function (list) {
        LEGENDS = list || [];
        return LEGENDS;
      }).catch(function (err) {
        console.error("レジェンドデータの取得に失敗しました", err);
        legendsLoadPromise = null;
        legendsLoadFailed = true;
        throw err;
      });
    }
    return legendsLoadPromise;
  }

  function mergeTeamPlayers(list) {
    if (!list || !list.length) return;
    var existingIds = {};
    PLAYERS.forEach(function (p) { existingIds[p.id] = true; });
    list.forEach(function (p) { if (!existingIds[p.id]) PLAYERS.push(p); });
  }

  // ホーム球団以外の残り11球団を裏で取得し、揃い次第マージして再描画する
  // （検索・「全球団」表示・他球団選手とのつながり表示が完全になるのはこの時点）
  function loadRemainingTeamsInBackground(homeTeamId) {
    var ids = [];
    for (var name in TEAM_ID_MAP) {
      if (TEAM_ID_MAP[name] !== homeTeamId) ids.push(TEAM_ID_MAP[name]);
    }
    Promise.all(ids.map(loadTeamPlayers)).then(function (lists) {
      lists.forEach(mergeTeamPlayers);
      render();
      // 全12球団分のPLAYERSが揃ったところで、今季成績（打率・本塁打など）の
      // 自動更新チェックを行う（前回更新から18時間未満ならスキップされる）
      maybeRefreshLiveStats();
      // 「本日の先発」対戦カードは起動直後（まだホーム球団しかPLAYERSに無い時点）にも
      // 一度取得を試みているため、対戦相手が他球団だった場合はその時点では投手名は取れても
      // 今季成績（勝敗・防御率）まではひも付けられていないことがある。全球団分のPLAYERSが
      // 揃ったこのタイミングで、間隔にかかわらず一度だけ取り直して成績を反映する。
      refreshTodayStarterNow();
    }).catch(function (err) {
      console.error("残り球団データの取得に失敗しました（電波状況などが原因の可能性があります）", err);
    });
  }

  // ヘッダーの更新ボタンの見た目（回転アイコン・操作可否）を直接書き換える。
  // ヘッダー自体は起動時に一度だけ作られDOMがrender()で作り直されることは無いため、ここで直接触る。
  function updateRefreshBtnUi() {
    if (!els.refreshBtn) return;
    els.refreshBtn.innerHTML = icon("refresh", 16, state.dataRefreshing ? "spin-icon" : "");
    els.refreshBtn.disabled = state.dataRefreshing;
    els.refreshBtn.setAttribute("aria-busy", state.dataRefreshing ? "true" : "false");
  }

  // ヘッダーの更新ボタン：localStorageの6時間キャッシュ・Service Workerのデータキャッシュを両方
  // 無視して、全12球団の選手データ・つながり・日程・ニュース・レジェンドを取り直す。
  // 取得できたデータはcacheWriteで上書きするので、以後6時間はこの最新データがそのまま使われる。
  function refreshAllData() {
    if (state.dataRefreshing) return; // 二重押し防止
    state.dataRefreshing = true;
    updateRefreshBtnUi();

    var teamIds = TEAM_NAMES.map(function (name) { return TEAM_ID_MAP[name]; });
    var teamFetches = teamIds.map(function (id) {
      return forceFetchJson("data/teams/" + id + ".json").then(function (list) {
        cacheWrite("team_" + id, list);
        return { id: id, list: list };
      });
    });
    var extraFetches = [
      forceFetchJson("data/relations.json").then(function (d) { cacheWrite("relations", d); return d; }),
      forceFetchJson("data/schedule.json").then(function (d) { cacheWrite("schedule", d); return d; }),
      forceFetchJson("data/news.json").then(function (d) { cacheWrite("news", d); return d; }),
      forceFetchJson("data/legends.json").then(function (d) { cacheWrite("legends", d); return d; })
        .catch(function () { return null; }) // レジェンドが無くても致命的ではないので個別に握りつぶす
    ];

    Promise.all(teamFetches.concat(extraFetches)).then(function (results) {
      var teamResults = results.slice(0, teamIds.length);
      var relations = results[teamIds.length];
      var schedule = results[teamIds.length + 1];
      var news = results[teamIds.length + 2];
      var legends = results[teamIds.length + 3];

      var freshPlayers = [];
      teamResults.forEach(function (r) {
        var teamName = TEAM_ID_TO_NAME[r.id];
        (r.list || []).forEach(function (p) { p.currentTeamName = teamName; });
        freshPlayers = freshPlayers.concat(r.list || []);
      });
      PLAYERS = freshPlayers;
      RELATIONS = relations || [];
      TEAM_NEXT_GAMES = schedule || [];
      NEWS = news || [];
      if (legends) LEGENDS = legends;

      state.dataRefreshing = false;
      updateRefreshBtnUi();
      render();
      refreshSettingsIfOpen();
      showToast("最新データに更新しました（選手" + PLAYERS.length + "名）", 2600);
      // 上記で取り直した選手データ（data/teams/*.json）や日程（data/schedule.json）は、
      // あくまで「現在デプロイされている静的ファイル」の再取得であり、打率・本塁打などの
      // 今季成績や、NPB公式サイト上の本当に最新の試合日程そのものは含まれていない
      // （それらはapi/stats.js・api/schedule.js経由でnpb.jpから直接取ってPLAYERS/
      // TEAM_NEXT_GAMESに後乗せしているだけなので、直前の TEAM_NEXT_GAMES = schedule で
      // 静的ファイルの内容にいったん巻き戻ってしまっている）。手動更新ボタンを押した＝
      // 「今すぐ最新の状態にしたい」という明確な意思表示なので、通常のキャッシュ間隔を
      // 待たず、ここで強制的に今季成績・試合日程の両方をnpb.jpから直接取り直す。
      refreshLiveStatsNow();
      refreshScheduleNow();
      refreshHighlightsNow(state.homeTeam);
      refreshStandingsNow();
      refreshTodayStarterNow();
      refreshWeatherNow(state.homeTeam);
    }).catch(function (err) {
      console.error("データの手動更新に失敗しました", err);
      state.dataRefreshing = false;
      updateRefreshBtnUi();
      showToast("更新に失敗しました。通信状況をご確認のうえ、もう一度お試しください", 2600);
    });

    // ついでにアプリ本体（JS/CSS）に新しいバージョンが無いかも確認し、見つかったら
    // キャッシュを意識させずに済むよう自動でページを再読み込みする（forceCodeUpdateCheck）。
    forceCodeUpdateCheck();
  }

  // 更新ボタンが押されたタイミングで、Service Workerに新しいバージョン（＝新しい
  // CACHE_VERSION）が無いか確認する。見つかった場合、そのService Workerは
  // install時に自動でskipWaiting()するようになっているので、まもなく有効化されて
  // このページの「controllerchange」イベントが発火する。それを合図に、ユーザーが
  // 何もしなくてもアプリ本体（JS/CSS）が最新の状態でページが再読み込みされる。
  // ＝データだけでなく、コードの更新も更新ボタン1つで即座に反映されるようにする。
  //
  // リスナーはこの1回の更新チェックのためだけに一時的に付け、既定時間（20秒）以内に
  // 変化がなければ自動的に外す。そうしないと、ブラウザが自分のタイミングで行う
  // バックグラウンドのService Worker更新チェック（更新ボタンとは無関係に発生しうる）
  // まで拾ってしまい、ユーザーが何か入力中の画面が予期せず再読み込みされてしまう
  // おそれがあるため。
  function forceCodeUpdateCheck() {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.getRegistration) return;
    navigator.serviceWorker.getRegistration().then(function (reg) {
      if (!reg) return;
      var handled = false;
      function onControllerChange() {
        if (handled) return;
        handled = true;
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        showToast("アプリの新しいバージョンを読み込んでいます…", 1500);
        setTimeout(function () { window.location.reload(); }, 400);
      }
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      setTimeout(function () {
        if (!handled) navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      }, 20000);
      reg.update().catch(function () {});
    }).catch(function () {});
  }

  // NEXT GAMEカードの「日程を更新」ボタン：本日のスタメン取得（/api/lineup）と同じ考え方で、
  // ホーム球団の「次の試合」だけをその場でnpb.jpから取り直す。data/schedule.json全体を
  // 作り直す（＝GitHubへの反映が必要になる）のではなく、取得できた1球団ぶんのデータで
  // TEAM_NEXT_GAMES（表示に使っている配列）とローカルキャッシュを差し替えるだけなので、
  // アプリを開いている人が誰でもその場で最新化できる。
  function fetchLatestSchedule() {
    if (state.scheduleFetching) return; // 二重押し防止
    var teamName = state.homeTeam;
    state.scheduleFetching = true;
    render();

    fetch("/api/schedule?team=" + encodeURIComponent(teamName))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        state.scheduleFetching = false;
        if (data && data.success && data.game) {
          var idx = -1;
          for (var i = 0; i < TEAM_NEXT_GAMES.length; i++) {
            if (TEAM_NEXT_GAMES[i].teamName === teamName) { idx = i; break; }
          }
          if (idx !== -1) TEAM_NEXT_GAMES[idx] = data.game; else TEAM_NEXT_GAMES.push(data.game);
          cacheWrite("schedule", TEAM_NEXT_GAMES);
          render();
          showToast("最新の日程を取得しました（" + data.game.dateDisplay + " " + teamName + " vs " + (data.game.opponent || "-") + "）", 2600);
        } else {
          render();
          showToast((data && data.error) || "日程の取得に失敗しました。もう一度お試しください", 2600);
        }
      })
      .catch(function () {
        state.scheduleFetching = false;
        render();
        showToast("通信に失敗しました。電波状況をご確認のうえ、もう一度お試しください", 2600);
      });
  }

  /* ===================== 今季成績（打率・本塁打など）の自動更新 =====================
     「ホームラン数などは毎日更新してほしい」という要望に応えるための仕組み。
     data/teams/*.json 内のcurrentStats（打率・本塁打・打点・防御率・勝敗等）は本来
     手動でファイルを作り直しGitHubへpushしないと更新できないが、それでは自動更新に
     ならない。そこで、アプリ起動のたびに（ただし前回の自動更新から一定時間が経って
     いる場合のみ）api/stats.jsを12球団ぶん叩き、NPB公式サイトの最新の成績で
     PLAYERS配列の currentStats をその場で上書きする。GitHubへの反映は一切不要で、
     ボタン操作も不要（勝手に裏側で完結する）。 */
  var STATS_REFRESH_INTERVAL_MS = 18 * 60 * 60 * 1000; // 18時間：1日1回程度のペースで十分なため
  var statsRefreshing = false;

  function stripSpacesForMatch(s) {
    return (s || "").replace(/[\s　]/g, "");
  }

  function applyLiveStatsResult(teamName, players) {
    if (!players) return 0;
    var applied = 0;
    for (var i = 0; i < PLAYERS.length; i++) {
      var p = PLAYERS[i];
      if (p.currentTeamName !== teamName) continue;
      var key = stripSpacesForMatch(p.name);
      var found = players[key];
      if (!found) continue;
      p.currentStats = Object.assign({}, p.currentStats || {}, found);
      applied++;
    }
    return applied;
  }

  function refreshLiveStatsNow() {
    if (statsRefreshing) return;
    statsRefreshing = true;
    var totalApplied = 0;
    var fetches = TEAM_NAMES.map(function (teamName) {
      return fetch("/api/stats?team=" + encodeURIComponent(teamName))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.success) totalApplied += applyLiveStatsResult(teamName, data.players);
        })
        .catch(function () { /* 1球団分の取得失敗は無視し、他の球団の更新は続ける */ });
    });
    Promise.all(fetches).then(function () {
      statsRefreshing = false;
      // 「試みた」ことは成否によらず必ず記録する（npb.jp側の障害等で毎回全滅する場合に、
      // 起動のたびに12球団ぶん無駄打ちし続けないようにするため）
      cacheWrite("liveStatsAttempt", { done: true });
      // 一方、ユーザーに見せる「最終更新」表示は、実際に1件以上のデータが反映できた
      // 場合のみ更新する（全滅していたら「更新済み」と偽って見せないため）
      if (totalApplied > 0) {
        STATS_LAST_UPDATED = new Date();
        cacheWrite("liveStatsSuccess", { done: true });
      }
      render();
    });
  }

  function maybeRefreshLiveStats() {
    var cached = cacheRead("liveStatsAttempt");
    if (cached && (Date.now() - cached.t) < STATS_REFRESH_INTERVAL_MS) return; // 前回の試行から間もない場合はスキップ
    refreshLiveStatsNow();
  }

  // 選手一覧下部のフッターに表示する、今季成績の自動更新状況の一言
  // （実際に1件以上更新できたことがある場合のみ「更新済み」と表示し、
  //  一度も成功していない場合は誤解を招かないよう控えめな文言にする）
  function statsFreshnessText() {
    if (STATS_LAST_UPDATED) {
      var hh = String(STATS_LAST_UPDATED.getHours()).padStart(2, "0");
      var mm = String(STATS_LAST_UPDATED.getMinutes()).padStart(2, "0");
      return " 打率・本塁打などの今季成績はNPB公式サイトから自動更新されます（本日" + hh + ":" + mm + "更新済み）。";
    }
    var cached = cacheRead("liveStatsSuccess");
    if (cached) {
      var d = new Date(cached.t);
      return " 打率・本塁打などの今季成績はNPB公式サイトから自動更新されます（" + (d.getMonth() + 1) + "/" + d.getDate() + "更新）。";
    }
    return " 打率・本塁打などの今季成績はNPB公式サイトから自動更新されます。";
  }

  /* ===================== 試合日程（NEXT GAME）の自動更新 =====================
     以前は「日程を更新」ボタンを自分で押さない限り、data/schedule.json（GitHubへの
     反映が必要な静的ファイル）の内容がそのまま表示され続けていた。このファイルは
     試合が進むたびに古くなっていくため、「本日開催のはずなのに実際には試合が無い」
     （つまりホーム画面のNEXT GAMEカードと、本日のスタメン取得の結果が食い違う）と
     いった不整合が起きうる。今季成績の自動更新（refreshLiveStatsNow）と全く同じ
     考え方で、アプリ起動のたびに（前回の自動更新から一定時間が経っている場合のみ）
     api/schedule.jsを12球団ぶん叩き、NPB公式サイトの実際の日程でTEAM_NEXT_GAMESを
     その場で上書きする。GitHubへの反映もボタン操作も不要。 */
  var SCHEDULE_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6時間：試合日は日々変わるため、成績より短めの間隔にしている
  var scheduleAutoRefreshing = false;

  function refreshScheduleNow() {
    if (scheduleAutoRefreshing) return;
    scheduleAutoRefreshing = true;
    var totalApplied = 0;
    var fetches = TEAM_NAMES.map(function (teamName) {
      return fetch("/api/schedule?team=" + encodeURIComponent(teamName))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data || !data.success || !data.game) return;
          var idx = -1;
          for (var i = 0; i < TEAM_NEXT_GAMES.length; i++) {
            if (TEAM_NEXT_GAMES[i].teamName === teamName) { idx = i; break; }
          }
          if (idx !== -1) TEAM_NEXT_GAMES[idx] = data.game; else TEAM_NEXT_GAMES.push(data.game);
          totalApplied++;
        })
        .catch(function () { /* 1球団分の取得失敗は無視し、他球団の更新は続ける（npb.jp側の一時的な不調等） */ });
    });
    Promise.all(fetches).then(function () {
      scheduleAutoRefreshing = false;
      cacheWrite("scheduleLiveAttempt", { done: true });
      if (totalApplied > 0) {
        cacheWrite("schedule", TEAM_NEXT_GAMES);
        SCHEDULE_LAST_UPDATED = new Date();
        // 日程データが変わった可能性があるため、対戦相手の自動選択（実際の次の試合の相手）も
        // 併せてやり直す。ユーザーが設定画面から明示的に対戦相手を選び直している場合
        // （OPPONENT_MANUAL_KEY）のみ、その選択を尊重して上書きしない。
        if (!loadOpponentIsManual()) {
          var recomputed = computeDefaultOpponent(state.homeTeam);
          if (recomputed !== state.opponentTeam) {
            state.opponentTeam = recomputed;
            saveOpponentTeam(recomputed);
            state.lineup = loadLineup(state.homeTeam, state.opponentTeam);
          }
        }
      }
      render();
    });
  }

  function maybeRefreshSchedule() {
    var cached = cacheRead("scheduleLiveAttempt");
    if (cached && (Date.now() - cached.t) < SCHEDULE_REFRESH_INTERVAL_MS) return; // 前回の試行から間もない場合はスキップ
    refreshScheduleNow();
  }

  /* ===================== 「見どころ」（NEXT GAMEカード）の自動取得 =====================
     ホーム球団の公式サイトに載っている、その試合の「見どころ」的なプレビュー・総括文を
     api/highlights.js経由で自動取得し、ホーム画面のNEXT GAMEカードに表示する。
     各球団公式サイト自身のデータのため、対応している球団は一部のみ（api/highlights.js側で
     非対応の球団はsuccess:falseを返すので、フロント側は「取得できなかった＝非表示」として
     扱えばよく、対応球団かどうかをここで意識する必要はない）。
     日程・成績の自動更新と同じ考え方で、起動のたびに（前回の取得から一定時間が経っている
     場合のみ）裏側で取得し、GitHubへの反映もボタン操作も不要にする。
     ホーム球団を切り替えた場合は「見どころ」も球団に紐づくデータなので、間隔を待たず
     その場で新しいホーム球団向けに取得し直す（setHomeTeam参照）。 */
  var HIGHLIGHTS_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6時間：試合日程の自動更新と同じ間隔にしている
  var highlightsRefreshing = false;

  function refreshHighlightsNow(teamName) {
    var team = teamName || state.homeTeam;
    if (highlightsRefreshing) return;
    highlightsRefreshing = true;
    fetch("/api/highlights?team=" + encodeURIComponent(team))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        highlightsRefreshing = false;
        cacheWrite("highlightsAttempt", { done: true, team: team });
        if (data && data.success && data.highlights) {
          HIGHLIGHTS_TEXT = data.highlights;
          HIGHLIGHTS_GAME_DATE = data.gameDate || null;
          HIGHLIGHTS_TEAM = team;
          cacheWrite("highlights", { team: team, highlights: data.highlights, gameDate: data.gameDate || null });
        } else if (HIGHLIGHTS_TEAM === team) {
          // 同じ球団向けの取得が失敗/非対応だった場合のみ表示をクリアする（別球団に切り替えた
          // 直後の取得が失敗した際に、たまたま残っている前の球団の表示まで巻き込んで消さないため）
          HIGHLIGHTS_TEXT = null;
          HIGHLIGHTS_GAME_DATE = null;
        }
        render();
      })
      .catch(function () {
        highlightsRefreshing = false;
        // 取得できなくても致命的ではない（NEXT GAMEカードの見どころ欄が非表示のままになるだけ）ので、
        // エラーをユーザーに通知したりはしない
      });
  }

  function maybeRefreshHighlights(teamName) {
    var team = teamName || state.homeTeam;
    var cached = cacheRead("highlightsAttempt");
    // 前回の取得対象が今のホーム球団と同じで、かつ間もない場合のみスキップする
    // （球団を切り替えた直後は、間隔にかかわらずその場で取得し直したいため）
    if (cached && cached.d && cached.d.team === team && (Date.now() - cached.t) < HIGHLIGHTS_REFRESH_INTERVAL_MS) return;
    refreshHighlightsNow(team);
  }

  /* ===================== リーグ順位表・チーム成績の自動更新 =====================
     見どころ・日程と同じ考え方で、api/standings.js経由でNPB公式サイトの実際の順位表・
     チーム打率/本塁打/防御率を取得する。ホーム球団に紐づく情報ではなくリーグ全体の
     データなので、球団切り替え時に取り直す必要はない。 */
  var STANDINGS_REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3時間：試合結果は毎日進むが、順位表自体はそこまで頻繁でなくてよい
  var standingsRefreshing = false;

  function refreshStandingsNow() {
    if (standingsRefreshing) return;
    standingsRefreshing = true;
    fetch("/api/standings")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        standingsRefreshing = false;
        cacheWrite("standingsAttempt", { done: true });
        if (data && data.success) {
          STANDINGS_DATA = data;
          cacheWrite("standings", data);
        }
        render();
      })
      .catch(function () { standingsRefreshing = false; });
  }

  function maybeRefreshStandings() {
    var cached = cacheRead("standingsAttempt");
    if (cached && (Date.now() - cached.t) < STANDINGS_REFRESH_INTERVAL_MS) return;
    refreshStandingsNow();
  }

  /* ===================== 「本日の先発」対戦カードの自動更新 =====================
     以前は予告先発（ファンサイトからの推測取得）を使っていたが、信頼度の低さから方針転換。
     試合直前（概ね1〜1.5時間前）にNPB公式サイトで確定するスタメン表を取得している
     api/lineup.js（既存の「本日のスタメンを登録」機能と同じAPI）から、両チームの
     「本日・確定済み」の先発投手だけを取り出して表示する。予告先発と違い試合前日には
     まだ出ないが、その代わり公式ソースの確定情報なので確度が高い。
     この機能は既存の「本日のスタメンを登録」ボタン（state.lineup を書き換える手動操作）
     とは完全に別系統のデータとして扱う（自動更新でユーザーが手動登録したスタメンを
     勝手に上書きしないようにするため）。
     対戦相手は、ユーザーが設定画面で選んでいる可能性のあるstate.opponentTeam（つながり
     閲覧用）ではなく、必ず「今日の実際の対戦相手」（nextGameFor(homeTeam).opponent）を使う。 */
  var TODAY_STARTER_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30分：先発発表は試合直前に行われるため、他の自動更新より短い間隔で確認する
  var todayStarterRefreshing = false;

  function fetchTodayStarterSide(teamName) {
    return fetch("/api/lineup?team=" + encodeURIComponent(teamName))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        // 「今日・発表済み」の確定スタメンでなければ（試合が無い日／まだ未発表／取得失敗）
        // このカードとしては「まだ出せない」ものとして扱う
        if (!data || !data.success || !data.pitcher || data.isPastGame || data.notAnnouncedYet) return null;
        var player = findPlayerBySurname(teamName, data.pitcher);
        return { pitcherName: data.pitcher, player: player || null };
      })
      .catch(function () { return null; });
  }

  function refreshTodayStarterNow() {
    var homeTeam = state.homeTeam;
    var game = nextGameFor(homeTeam);
    if (!game || !game.opponent) {
      TODAY_STARTER_HOME = null; TODAY_STARTER_AWAY = null; TODAY_STARTER_KEY = null;
      render();
      return;
    }
    var awayTeam = game.opponent;
    var key = homeTeam + "|" + awayTeam + "|" + game.date;
    if (todayStarterRefreshing) return;
    todayStarterRefreshing = true;

    Promise.all([fetchTodayStarterSide(homeTeam), fetchTodayStarterSide(awayTeam)]).then(function (results) {
      todayStarterRefreshing = false;
      cacheWrite("todayStarterAttempt", { done: true, key: key });
      if (results[0] && results[1]) {
        TODAY_STARTER_HOME = results[0];
        TODAY_STARTER_AWAY = results[1];
        TODAY_STARTER_KEY = key;
        cacheWrite("todayStarter", { key: key, home: results[0], away: results[1] });
      } else {
        TODAY_STARTER_HOME = null;
        TODAY_STARTER_AWAY = null;
        TODAY_STARTER_KEY = key; // このキーでは出せなかったことを記録し、30分間は再試行せずおく
      }
      render();
    });
  }

  function maybeRefreshTodayStarter() {
    var game = nextGameFor(state.homeTeam);
    if (!game || !game.opponent) return;
    var key = state.homeTeam + "|" + game.opponent + "|" + game.date;
    var cached = cacheRead("todayStarterAttempt");
    if (cached && cached.d && cached.d.key === key && (Date.now() - cached.t) < TODAY_STARTER_REFRESH_INTERVAL_MS) return;
    refreshTodayStarterNow();
  }

  /* ===================== 次の試合会場の天気の自動更新 =====================
     nextGameFor()で分かる「次の試合の開催球場・日付」を使ってapi/weather.jsを叩く
     （このAPI自身は日程を取りに行かず、渡された球場・日付をそのまま使う）。
     日程が変わればキャッシュキー（球場|日付）も変わるので、試合が近づいて日程が
     更新された場合も自然に取り直される。 */
  var WEATHER_REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
  var weatherRefreshing = false;

  function refreshWeatherNow(teamName) {
    var team = teamName || state.homeTeam;
    var game = nextGameFor(team);
    if (!game || !game.venue || !game.date) { WEATHER_DATA = null; WEATHER_KEY = null; render(); return; }
    var key = game.venue + "|" + game.date;
    if (weatherRefreshing) return;
    weatherRefreshing = true;
    fetch("/api/weather?venue=" + encodeURIComponent(game.venue) + "&date=" + encodeURIComponent(game.date))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        weatherRefreshing = false;
        cacheWrite("weatherAttempt", { done: true, key: key });
        if (data && data.success) {
          WEATHER_DATA = data;
          WEATHER_KEY = key;
          cacheWrite("weather", { key: key, data: data });
        } else {
          WEATHER_DATA = null;
          WEATHER_KEY = key;
        }
        render();
      })
      .catch(function () { weatherRefreshing = false; });
  }

  function maybeRefreshWeather(teamName) {
    var team = teamName || state.homeTeam;
    var game = nextGameFor(team);
    if (!game || !game.venue || !game.date) return;
    var key = game.venue + "|" + game.date;
    var cached = cacheRead("weatherAttempt");
    if (cached && cached.d && cached.d.key === key && (Date.now() - cached.t) < WEATHER_REFRESH_INTERVAL_MS) return;
    refreshWeatherNow(team);
  }

  /* ===================== ホーム球団・対戦相手の永続化 ===================== */
  var HOME_TEAM_KEY = "eaglesScoutHomeTeam_v1";
  // v2: 対戦相手のデフォルトを「実際の次の試合の相手」から決めるよう仕様変更したため、
  // 過去に保存された（実際の日程とは無関係な）古いデフォルト値を無効化してキーを更新
  var OPPONENT_TEAM_KEY = "eaglesScoutOpponentTeam_v2";

  function loadHomeTeam() {
    try {
      var v = window.localStorage ? localStorage.getItem(HOME_TEAM_KEY) : null;
      return v && TEAM_NAMES.indexOf(v) !== -1 ? v : DEFAULT_HOME_TEAM;
    } catch (e) { return DEFAULT_HOME_TEAM; }
  }
  function saveHomeTeam(name) {
    try { if (window.localStorage) localStorage.setItem(HOME_TEAM_KEY, name); } catch (e) { /* ignore */ }
  }
  function loadOpponentTeam() {
    try {
      var v = window.localStorage ? localStorage.getItem(OPPONENT_TEAM_KEY) : null;
      return v && TEAM_NAMES.indexOf(v) !== -1 ? v : null;
    } catch (e) { return null; }
  }
  function saveOpponentTeam(name) {
    try { if (window.localStorage) localStorage.setItem(OPPONENT_TEAM_KEY, name); } catch (e) { /* ignore */ }
  }

  // 対戦相手が「ユーザーが設定画面で明示的に選んだもの」か「アプリが自動計算しただけのもの」かを
  // 区別するためのフラグ。以前はOPPONENT_TEAM_KEYに値が保存されているかどうかだけで判定していたが、
  // setHomeTeam()が自動計算した対戦相手も同じキーに保存してしまうため「一度でもホーム球団を
  // 切り替えたことがある＝手動で選んだことになる」という誤判定が起き、日程の自動更新（NEXT GAME）で
  // 対戦相手が実際の相手に合わせて追従しない不具合の原因になっていた。これを避けるため、本当に
  // ユーザーが「対戦相手を変更」から選んだ場合（setOpponentTeam）だけこのフラグを立てる。
  var OPPONENT_MANUAL_KEY = "eaglesScoutOpponentManual_v1";
  function loadOpponentIsManual() {
    try { return window.localStorage ? localStorage.getItem(OPPONENT_MANUAL_KEY) === "1" : false; } catch (e) { return false; }
  }
  function saveOpponentIsManual(isManual) {
    try {
      if (!window.localStorage) return;
      if (isManual) localStorage.setItem(OPPONENT_MANUAL_KEY, "1");
      else localStorage.removeItem(OPPONENT_MANUAL_KEY);
    } catch (e) { /* ignore */ }
  }

  // 対戦相手の初期値は、まず「実際の次の試合の相手」（TEAM_NEXT_GAMES）を優先して選ぶ。
  // 万一その球団の試合情報が無い場合のみ、ホーム球団の選手と実際につながりが最も多い
  // 他球団を選ぶ（架空の対戦カードを作らないよう、どちらも実データから機械的に決める）
  function computeDefaultOpponent(homeTeam) {
    var game = nextGameFor(homeTeam);
    if (game && game.opponent && game.opponent !== homeTeam && TEAM_NAMES.indexOf(game.opponent) !== -1) {
      return game.opponent;
    }
    var counts = {};
    RELATIONS.forEach(function (r) {
      var a = byId(r.fromPlayerId), b = byId(r.toPlayerId);
      if (!a || !b) return;
      if (a.currentTeamName === homeTeam && b.currentTeamName !== homeTeam) counts[b.currentTeamName] = (counts[b.currentTeamName] || 0) + 1;
      if (b.currentTeamName === homeTeam && a.currentTeamName !== homeTeam) counts[a.currentTeamName] = (counts[a.currentTeamName] || 0) + 1;
    });
    var best = null, bestCount = -1;
    TEAM_NAMES.forEach(function (t) {
      if (t === homeTeam) return;
      var c = counts[t] || 0;
      if (c > bestCount) { bestCount = c; best = t; }
    });
    return best || TEAM_NAMES.filter(function (t) { return t !== homeTeam; })[0];
  }

  function applyHomeTheme(teamName) {
    var t = getTeam(teamName);
    var root = document.documentElement;
    root.style.setProperty("--team-color", t.color);
    root.style.setProperty("--team-ink", t.ink);
    document.title = t.fullName + "観戦ノート";
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", t.fullName + "の選手名鑑と人脈ネットワーク。実在選手の実際の記録・エピソードのみを掲載。");
  }

  var RELATION_LABELS = {
    senior_teammate: "リトルシニア/ボーイズ同期",
    school: "学校の先輩後輩・同窓",
    alumni: "同じ学校のOB同士",
    offseason_training: "自主トレ仲間",
    rival: "好敵手・ライバル",
    former_teammate: "元チームメイト"
  };
  var RELATION_COLORS = {
    senior_teammate: "#2E7DA8",
    school: "#3F9463",
    alumni: "#5A7D6E",
    offseason_training: "#C07A2E",
    rival: "#B23A5C",
    former_teammate: "#6B5B95"
  };

  // 並び替えは今季（2026年）成績が基準。率成績（打率・OPS・防御率）は規定打席・
  // 規定投球回に到達している選手を優先的に上位表示します。
  var SORT_BASIS_LABEL = "今季（2026年）成績を基準に並び替え（率成績は規定到達者を優先）";
  var BATTER_SORTS = [
    { key: "avg", label: "打率順", dir: "desc" },
    { key: "hr", label: "本塁打順", dir: "desc" },
    { key: "ops", label: "OPS順", dir: "desc" },
    { key: "rbi", label: "打点順", dir: "desc" },
    { key: "stolenBases", label: "盗塁順", dir: "desc" },
    { key: "salary", label: "推定年俸順", dir: "desc" },
    { key: "number", label: "背番号順", dir: "asc" }
  ];
  var PITCHER_SORTS = [
    { key: "era", label: "防御率順", dir: "asc" },
    { key: "wins", label: "勝利数順", dir: "desc" },
    { key: "strikeouts", label: "奪三振順", dir: "desc" },
    { key: "saves", label: "セーブ順", dir: "desc" },
    { key: "salary", label: "推定年俸順", dir: "desc" },
    { key: "number", label: "背番号順", dir: "asc" }
  ];

  // 万円単位の数値を「1億2500万円」のような読みやすい表示に変換
  function formatSalary(manYen) {
    if (manYen == null) return "非公表";
    var oku = Math.floor(manYen / 10000);
    var rem = manYen % 10000;
    if (oku > 0 && rem > 0) return oku + "億" + rem + "万円";
    if (oku > 0) return oku + "億円";
    return manYen + "万円";
  }

  /* ===================== Domain logic ===================== */
  function isPitcher(p) { return p.position === "投手"; }

  // 「対楽天データ」は楽天と対戦した際の実際の記録なので、球団に関わらず常にそのまま表示できる。
  // 「楽天キラー」バッジ・絞り込みは、ホーム球団が楽天の時のみ意味を持つため限定表示。
  function isRakutenKiller(p) {
    if (!p.vsRakutenData) return false;
    if (p.vsRakutenData.isKiller) return true;
    var val = parseFloat(p.vsRakutenData.avgOrEra);
    if (isNaN(val)) return false;
    return isPitcher(p) ? val <= 2.0 : val >= 0.3;
  }

  function relationsFor(playerId) {
    return RELATIONS.filter(function (r) {
      return r.fromPlayerId === playerId || r.toPlayerId === playerId;
    });
  }
  function hasRelationType(playerId, type) {
    return relationsFor(playerId).some(function (r) { return r.type === type; });
  }

  // ホーム球団の「地元ゆかり」判定：出身地に球団の地域キーワードが含まれるか
  function isLocalConnection(p, homeTeam) {
    var t = getTeam(homeTeam);
    var hometown = (p.roots && p.roots.hometown) || "";
    if (!hometown || hometown === "情報未確認") return false;
    return t.regionKeywords.some(function (k) { return hometown.indexOf(k) !== -1; });
  }

  // 規定打席 = チーム試合数 × 3.1、規定投球回 = チーム試合数。消化試合数（DATA_AS_OF時点）を基準に計算。
  function requiredPlateAppearances(teamName) { return Math.round(getTeam(teamName).gamesPlayed * 3.1); }
  function requiredInnings(teamName) { return getTeam(teamName).gamesPlayed; }

  function isRateSortKey(key) { return key === "avg" || key === "ops" || key === "era"; }

  // "qualified" | "short" | "unknown"（打席/投球回データが無く判定不能）
  function qualifyStateFor(p, key) {
    if (!isRateSortKey(key)) return "qualified";
    var s = p.currentStats || {};
    if (key === "era") {
      if (s.inningsPitched == null) return "unknown";
      return s.inningsPitched >= requiredInnings(p.currentTeamName) ? "qualified" : "short";
    }
    if (s.plateAppearances == null) return "unknown";
    return s.plateAppearances >= requiredPlateAppearances(p.currentTeamName) ? "qualified" : "short";
  }
  function isQualifiedThisSeason(p) {
    var s = p.currentStats || {};
    if (isPitcher(p)) return s.inningsPitched != null && s.inningsPitched >= requiredInnings(p.currentTeamName);
    return s.plateAppearances != null && s.plateAppearances >= requiredPlateAppearances(p.currentTeamName);
  }

  /* ===================== 経歴タグ判定 =====================
     ドラフト1位・育成出身・外国人選手は、既存のdraftInfo／選手名表記から機械的に判定します
     （新規リサーチ不要。すべて既に確認済みのテキストに基づく判定です）。 */
  function isFirstRoundDraft(p) {
    return !!(p.draftInfo && /(?<!MLB)ドラフト1(位|巡目)/.test(p.draftInfo));
  }
  function isIkuseiOrigin(p) {
    return !!(p.draftInfo && p.draftInfo.indexOf("育成") !== -1);
  }
  // 選手名に漢字・ひらがなを含まない（カタカナ／ラテン文字のみ）場合、外国人選手として判定
  function isForeignPlayer(p) {
    if (!p.name) return false;
    for (var i = 0; i < p.name.length; i++) {
      var c = p.name.charCodeAt(i);
      if (c >= 0x4e00 && c <= 0x9fff) return false; // 漢字
      if (c >= 0x3041 && c <= 0x309f) return false; // ひらがな
    }
    return true;
  }
  function hasCareerTag(p, key) {
    return !!(p.careerTags && p.careerTags.indexOf(key) !== -1);
  }
  function isNationalTeamExperience(p) {
    return !!(p.nationalTeamHistory && p.nationalTeamHistory.length);
  }
  function isAllStarExperience(p) {
    return !!(p.allStarYears && p.allStarYears.length);
  }

  var FILTER_GROUP_ORDER = ["対戦", "注目ポイント", "経歴", "つながり"];
  function buildFilterTags(homeTeam, opponentTeam) {
    var home = getTeam(homeTeam);
    var tags = [
      { key: "matchup", label: "⚾" + homeTeam + " vs " + opponentTeam, group: "対戦" },
      { key: "home", label: "#" + homeTeam + "の選手", group: "対戦" },
      { key: "opponent", label: "#" + opponentTeam + "の選手", group: "対戦" },
      { key: "local", label: "#" + home.regionLabel + "ゆかり", group: "注目ポイント" }
    ];
    if (homeTeam === "楽天") tags.push({ key: "killer", label: "#対楽天3割超（楽天キラー）", group: "注目ポイント" });
    tags.push(
      { key: "qualified", label: "#規定到達（今季）", group: "注目ポイント" },
      { key: "draft1", label: "#ドラフト1位", group: "経歴" },
      { key: "ikusei", label: "#育成出身", group: "経歴" },
      { key: "foreign", label: "#外国人選手", group: "経歴" },
      { key: "captain", label: "#主将経験", group: "経歴" },
      { key: "koshien", label: "#甲子園出場経験", group: "経歴" },
      { key: "national_team", label: "#日本代表経験", group: "経歴" },
      { key: "all_star", label: "#オールスター選出経験", group: "経歴" },
      { key: "school", label: "#学校の先輩後輩", group: "つながり" },
      { key: "alumni", label: "#同じ学校のOB", group: "つながり" },
      { key: "senior", label: "#シニア/ボーイズ同期", group: "つながり" },
      { key: "offseason", label: "#自主トレ仲間", group: "つながり" },
      { key: "former_teammate", label: "#元チームメイト", group: "つながり" },
      { key: "rival", label: "#好敵手・ライバル", group: "つながり" }
    );
    return tags;
  }

  function matchesFilterTag(p, key, homeTeam, opponentTeam) {
    switch (key) {
      case "matchup": return p.currentTeamName === homeTeam || p.currentTeamName === opponentTeam;
      case "home": return p.currentTeamName === homeTeam;
      case "opponent": return p.currentTeamName === opponentTeam;
      case "killer": return isRakutenKiller(p);
      case "local": return isLocalConnection(p, homeTeam);
      case "qualified": return isQualifiedThisSeason(p);
      case "draft1": return isFirstRoundDraft(p);
      case "ikusei": return isIkuseiOrigin(p);
      case "foreign": return isForeignPlayer(p);
      case "captain": return hasCareerTag(p, "captain");
      case "koshien": return hasCareerTag(p, "koshien");
      case "national_team": return isNationalTeamExperience(p);
      case "all_star": return isAllStarExperience(p);
      case "offseason": return hasRelationType(p.id, "offseason_training");
      case "senior": return hasRelationType(p.id, "senior_teammate");
      case "school": return hasRelationType(p.id, "school");
      case "alumni": return hasRelationType(p.id, "alumni");
      case "former_teammate": return hasRelationType(p.id, "former_teammate");
      case "rival": return hasRelationType(p.id, "rival");
      default: return true;
    }
  }

  function matchesSearch(p, q) {
    if (!q.trim()) return true;
    var hay = [
      p.name, p.nameKana || "", p.currentTeamName, p.roots.highSchool,
      p.roots.university || "", p.roots.social || "", p.roots.seniorOrBoys,
      p.roots.juniorHigh, p.roots.hometown || ""
    ].join(" ").toLowerCase();
    return hay.indexOf(q.trim().toLowerCase()) !== -1;
  }

  function filterPlayers(list, query, tags, teamFilter, homeTeam, opponentTeam) {
    // 検索キーワードが入力されている間は、「#ホーム球団の選手」等の絞り込みタグ・球団指定を
    // 一時的に無視して全球団から探す（「名前で調べたのに出てこない」を防ぐため。対戦相手や
    // 他球団の選手を検索したいケースの方が多いと考えられるので、検索は常に全選手を対象にする）。
    var isSearching = !!query && !!query.trim();
    return list.filter(function (p) {
      if (!matchesSearch(p, query)) return false;
      if (isSearching) return true;
      if (teamFilter && teamFilter !== "all" && p.currentTeamName !== teamFilter) return false;
      return tags.every(function (t) { return matchesFilterTag(p, t, homeTeam, opponentTeam); });
    });
  }

  // 並び替えの基準は今季成績（currentStats）。値が無い選手は最下位扱いにする。
  function getSortValue(p, key) {
    var s = p.currentStats || {};
    switch (key) {
      case "avg": return s.avg != null ? s.avg : -1;
      case "hr": return s.hr != null ? s.hr : -1;
      case "ops": return s.ops != null ? s.ops : -1;
      case "rbi": return s.rbi != null ? s.rbi : -1;
      case "stolenBases": return s.stolenBases != null ? s.stolenBases : -1;
      case "era": return s.era != null ? s.era : 99;
      case "wins": return s.wins != null ? s.wins : -1;
      case "strikeouts": return s.strikeouts != null ? s.strikeouts : -1;
      case "saves": return s.saves != null ? s.saves : -1;
      case "salary": return p.salaryManYen != null ? p.salaryManYen : -1;
      case "number": return p.number;
      default: return 0;
    }
  }
  // 0=規定到達, 1=未到達, 2=判定不能
  function qualifyRank(p, key) {
    var st = qualifyStateFor(p, key);
    return st === "qualified" ? 0 : st === "short" ? 1 : 2;
  }
  function sortPlayers(list, key, dir) {
    var rate = isRateSortKey(key);
    var sorted = list.slice().sort(function (a, b) {
      if (rate) {
        var ra = qualifyRank(a, key), rb = qualifyRank(b, key);
        if (ra !== rb) return ra - rb;
      }
      var av = getSortValue(a, key), bv = getSortValue(b, key);
      if (av === bv) return a.number - b.number;
      return av < bv ? -1 : 1;
    });
    if (dir === "desc") {
      if (!rate) return sorted.reverse();
      var groups = [[], [], []];
      sorted.forEach(function (p) { groups[qualifyRank(p, key)].push(p); });
      return groups.map(function (g) { return g.reverse(); }).reduce(function (a, b) { return a.concat(b); }, []);
    }
    return sorted;
  }
  // NPBの実際のタイトル集計にならい、率成績（打率・防御率）は規定到達者の中からのみ選出
  function statLeaders(key, n, asc) {
    var list = PLAYERS.filter(function (p) {
      var s = p.currentStats;
      if (!s || s[key] == null) return false;
      if (isRateSortKey(key) && !isQualifiedThisSeason(p)) return false;
      return true;
    });
    list.sort(function (a, b) {
      var av = a.currentStats[key], bv = b.currentStats[key];
      return asc ? av - bv : bv - av;
    });
    return list.slice(0, n);
  }

  function getRelatedPlayers(playerId) {
    return relationsFor(playerId).map(function (r) {
      var otherId = r.fromPlayerId === playerId ? r.toPlayerId : r.fromPlayerId;
      var player = PLAYERS.find(function (p) { return p.id === otherId; });
      return player ? { player: player, relation: r } : null;
    }).filter(Boolean);
  }

  function byId(id) { return PLAYERS.find(function (p) { return p.id === id; }); }

  /* ===================== 本日のスタメン登録 ===================== */
  var LINEUP_STORAGE_KEY = "eaglesScoutLineup_v2";

  var POSITION_DEFS = [
    { key: "P", label: "投手" },
    { key: "C", label: "捕手" },
    { key: "1B", label: "一塁手" },
    { key: "2B", label: "二塁手" },
    { key: "3B", label: "三塁手" },
    { key: "SS", label: "遊撃手" },
    { key: "LF", label: "左翼手" },
    { key: "CF", label: "中堅手" },
    { key: "RF", label: "右翼手" }
  ];
  var POSITION_TEXT_MAP = [
    ["捕手", "C"], ["一塁", "1B"], ["二塁", "2B"], ["三塁", "3B"], ["遊撃", "SS"],
    ["左翼", "LF"], ["中堅", "CF"], ["右翼", "RF"]
  ];
  var POSITION_LAYOUT = {
    CF: { left: 50, top: 10 }, LF: { left: 19, top: 25 }, RF: { left: 81, top: 25 },
    SS: { left: 34, top: 48 }, "2B": { left: 66, top: 48 },
    P: { left: 50, top: 60 },
    "3B": { left: 21, top: 70 }, "1B": { left: 79, top: 70 },
    C: { left: 50, top: 88 }
  };
  function emptyPositions() {
    var o = {};
    POSITION_DEFS.forEach(function (d) { o[d.key] = null; });
    return o;
  }
  function emptyLineupSide() { return { pitcher: null, batters: new Array(9).fill(null), positions: emptyPositions() }; }
  function emptyLineup(homeTeam, opponentTeam) {
    return { home: emptyLineupSide(), opponent: emptyLineupSide(), homeTeamName: homeTeam, opponentTeamName: opponentTeam, updatedAt: null };
  }
  function normalizeLineupSide(raw) {
    var batters = new Array(9).fill(null);
    if (raw && Array.isArray(raw.batters)) {
      for (var i = 0; i < 9; i++) batters[i] = raw.batters[i] || null;
    }
    var positions = emptyPositions();
    if (raw && raw.positions) {
      POSITION_DEFS.forEach(function (d) { positions[d.key] = raw.positions[d.key] || null; });
    }
    return { pitcher: (raw && raw.pitcher) || null, batters: batters, positions: positions };
  }
  function loadLineup(homeTeam, opponentTeam) {
    try {
      var raw = window.localStorage ? localStorage.getItem(LINEUP_STORAGE_KEY) : null;
      if (!raw) return emptyLineup(homeTeam, opponentTeam);
      var parsed = JSON.parse(raw);
      // 球団の組み合わせが変わっていたら、別の選手が登録されたままにならないようリセットする
      if (parsed.homeTeamName !== homeTeam || parsed.opponentTeamName !== opponentTeam) {
        return emptyLineup(homeTeam, opponentTeam);
      }
      return {
        home: normalizeLineupSide(parsed.home),
        opponent: normalizeLineupSide(parsed.opponent),
        homeTeamName: homeTeam,
        opponentTeamName: opponentTeam,
        updatedAt: parsed.updatedAt || null
      };
    } catch (e) {
      return emptyLineup(homeTeam, opponentTeam);
    }
  }
  function saveLineup() {
    state.lineup.updatedAt = Date.now();
    try {
      if (window.localStorage) localStorage.setItem(LINEUP_STORAGE_KEY, JSON.stringify(state.lineup));
    } catch (e) { /* プライベートブラウズ等で保存できない場合は無視 */ }
  }
  function resetLineupForCurrentTeams() {
    state.lineup = emptyLineup(state.homeTeam, state.opponentTeam);
    saveLineup();
  }
  function lineupStarterIds(side) {
    var L = state.lineup[side];
    var ids = L.batters.filter(Boolean).slice();
    if (L.pitcher) ids.push(L.pitcher);
    return ids;
  }
  function lineupFilledCount(side) { return lineupStarterIds(side).length; }

  /* ===================== 本日のスタメンを /api/lineup から取得して自動反映 =====================
     NPB公式サイト（npb.jp）のスタメン表は基本的に「苗字のみ」で選手名が表示されるが、
     終了済みの試合では代打・代走・守備交代の行が「→選手名」のような記号付きで混ざっていたり、
     ページによっては姓名がスペース無しで表示されたりすることがある。そのため、
     1) 姓のみの完全一致 → 2) フルネーム（スペース無し）の完全一致 → 3) 記号混入にも耐える緩い判定
     の順で突き合わせる。いずれの段階でも同姓・同名候補が複数見つかった場合は一意に決められない
     ため、その選手名だけ「未反映」として呼び出し側に伝え、勝手に間違った選手を登録しないようにする。 */
  var SCRAPE_POSITION_TO_KEY = { "投": "P", "捕": "C", "一": "1B", "二": "2B", "三": "3B", "遊": "SS", "左": "LF", "中": "CF", "右": "RF" };
  // "指"（指名打者）は守備位置ダイヤモンド図上の枠が無いため対象外（打順には反映される）

  // reasonには不一致の原因を短いコードで入れる（"no-team-players"＝対象球団の選手が1人も
  // PLAYERSに無い＝読み込みタイミングの問題の可能性、"ambiguous-*"＝候補が2人以上で自動判定不可、
  // "no-match"＝候補が1人も見つからない）。デバッグ用に開発者コンソール等から調べたい場合は
  // findPlayerBySurnameDebug を直接呼び出せる（通常のUI表示には使わない）。
  function findPlayerBySurnameDebug(teamName, rawName) {
    if (!rawName) return { player: null, reason: "empty" };
    // 交代選手の行等に混ざりうる矢印・カッコ・数字を除いた文字列でも判定できるようにしておく
    var scraped = String(rawName).replace(/[\s　]/g, "").replace(/[→←()（）0-9]/g, "");
    if (!scraped) return { player: null, reason: "empty-after-clean" };
    var teamPlayers = PLAYERS.filter(function (p) { return p.currentTeamName === teamName; });
    if (!teamPlayers.length) return { player: null, reason: "no-team-players:" + teamName + ":total=" + PLAYERS.length };

    var bySurname = teamPlayers.filter(function (p) { return p.name && p.name.split(/[\s　]+/)[0] === scraped; });
    if (bySurname.length === 1) return { player: bySurname[0], reason: "ok" };
    if (bySurname.length > 1) return { player: null, reason: "ambiguous-surname:" + bySurname.length }; // 同姓が複数：自動判定はせず未反映にする

    var byFullName = teamPlayers.filter(function (p) { return p.name && p.name.replace(/[\s　]/g, "") === scraped; });
    if (byFullName.length === 1) return { player: byFullName[0], reason: "ok-fullname" };
    if (byFullName.length > 1) return { player: null, reason: "ambiguous-fullname:" + byFullName.length };

    var loose = teamPlayers.filter(function (p) {
      if (!p.name) return false;
      var sn = p.name.split(/[\s　]+/)[0];
      return sn.length >= 2 && (scraped.indexOf(sn) !== -1 || sn.indexOf(scraped) !== -1);
    });
    if (loose.length === 1) return { player: loose[0], reason: "ok-loose" };
    if (loose.length > 1) return { player: null, reason: "ambiguous-loose:" + loose.length };
    return { player: null, reason: "no-match:teamPlayers=" + teamPlayers.length };
  }
  function findPlayerBySurname(teamName, rawName) { return findPlayerBySurnameDebug(teamName, rawName).player; }

  // 取得したスタメンをstate.lineup[side]へ反映する。反映できなかった選手名の配列を返す。
  function applyScrapedLineup(side, data) {
    var teamName = side === "opponent" ? state.opponentTeam : state.homeTeam;
    var L = emptyLineupSide();
    var unmatched = [];

    (data.starters || []).forEach(function (s) {
      var player = findPlayerBySurname(teamName, s.name);
      if (!player) { unmatched.push(s.name); return; }
      var idx = s.order - 1;
      if (idx >= 0 && idx < 9) L.batters[idx] = player.id;
      var posKey = SCRAPE_POSITION_TO_KEY[s.position];
      if (posKey) L.positions[posKey] = player.id;
    });

    if (data.pitcher) {
      var pitcher = findPlayerBySurname(teamName, data.pitcher);
      if (pitcher) {
        L.pitcher = pitcher.id;
        if (!L.positions.P) L.positions.P = pitcher.id; // DH制で投手が打順に入らない場合も、マウンド上の表示には反映する
      } else {
        unmatched.push(data.pitcher);
      }
    }

    state.lineup[side] = L;
    saveLineup();
    return unmatched;
  }

  function fetchTodayLineup(side) {
    if (state.lineupFetching) return; // 二重押し防止
    var teamName = side === "opponent" ? state.opponentTeam : state.homeTeam;
    state.lineupFetching = side;
    state.lineupFetchNotice = null;
    renderOverlay();

    fetch("/api/lineup?team=" + encodeURIComponent(teamName))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        state.lineupFetching = null;
        if (data && data.success) {
          var unmatched = applyScrapedLineup(side, data);
          var unmatchedSuffix = unmatched.length
            ? "（" + unmatched.join("、") + " は選手名を自動判定できず未反映です。手動で登録してください）"
            : "";
          if (data.notAnnouncedYet) {
            // 本日の試合自体はあるが、スタメンがまだ発表されていないため、代わりに直前の
            // 終了済み試合のスタメンを取得して表示しているケース。「本日のスタメンが
            // 見られた」と誤解されるとチェック漏れにつながりかねないため、他の通知より
            // 強い警告表示（is-alert、赤系）ではっきり区別する。
            state.lineupFetchNotice = {
              type: "alert",
              message: "これは本日のスタメンではありません。本日のぶんはまだ発表されていないため、参考として前回（" + (data.gameDate || "直近") + "）の試合のスタメンを表示しています" + unmatchedSuffix
            };
          } else if (data.isPastGame) {
            state.lineupFetchNotice = {
              type: "warning",
              message: "本日は試合がないため、前回（" + (data.gameDate || "直近") + "）の終了した試合のスタメンを表示しています" + unmatchedSuffix
            };
          } else {
            state.lineupFetchNotice = {
              type: "success",
              message: "本日のスタメンを取得して反映しました" + unmatchedSuffix
            };
          }
        } else {
          state.lineupFetchNotice = { type: "error", message: (data && data.error) || "本日のスタメンは未発表か、取得できませんでした" };
        }
        renderOverlay();
      })
      .catch(function () {
        state.lineupFetching = null;
        state.lineupFetchNotice = { type: "error", message: "通信に失敗しました。電波状況をご確認のうえ、もう一度お試しください" };
        renderOverlay();
      });
  }

  function guessSpecificPositionKeys(p) {
    var text = (p.detailedPosition || "") + " " + (p.position || "");
    var keys = [];
    POSITION_TEXT_MAP.forEach(function (pair) {
      if (text.indexOf(pair[0]) !== -1) keys.push(pair[1]);
    });
    return keys;
  }
  function autoAssignPositions(side) {
    var L = state.lineup[side];
    if (!L.positions) L.positions = emptyPositions();
    if (!L.positions.P && L.pitcher) L.positions.P = L.pitcher;

    var assignedIds = Object.keys(L.positions).map(function (k) { return L.positions[k]; }).filter(Boolean);
    var candidates = L.batters.filter(Boolean)
      .filter(function (id) { return assignedIds.indexOf(id) === -1; })
      .map(byId).filter(Boolean);

    candidates.forEach(function (p) {
      var keys = guessSpecificPositionKeys(p);
      if (keys.length === 1 && !L.positions[keys[0]]) L.positions[keys[0]] = p.id;
    });
    candidates.forEach(function (p) {
      var already = Object.keys(L.positions).some(function (k) { return L.positions[k] === p.id; });
      if (already) return;
      var keys = guessSpecificPositionKeys(p);
      for (var i = 0; i < keys.length; i++) {
        if (!L.positions[keys[i]]) { L.positions[keys[i]] = p.id; break; }
      }
    });
    candidates.forEach(function (p) {
      var already = Object.keys(L.positions).some(function (k) { return L.positions[k] === p.id; });
      if (already) return;
      var text = (p.detailedPosition || "") + (p.position || "");
      var group = text.indexOf("外野") !== -1 ? ["LF", "CF", "RF"] : (text.indexOf("内野") !== -1 ? ["1B", "2B", "3B", "SS"] : []);
      for (var i = 0; i < group.length; i++) {
        if (!L.positions[group[i]]) { L.positions[group[i]] = p.id; break; }
      }
    });
  }
  function clearPositionsForPlayer(side, playerId) {
    var L = state.lineup[side];
    if (!L.positions) return;
    Object.keys(L.positions).forEach(function (k) { if (L.positions[k] === playerId) L.positions[k] = null; });
  }
  function unassignedBatters(side) {
    var L = state.lineup[side];
    var assignedIds = Object.keys(L.positions || {}).map(function (k) { return L.positions[k]; }).filter(Boolean);
    return L.batters.filter(Boolean).filter(function (id) { return assignedIds.indexOf(id) === -1; }).map(byId).filter(Boolean);
  }
  function lineupPositionCandidates(side, posKey) {
    var teamName = side === "home" ? state.homeTeam : state.opponentTeam;
    var L = state.lineup[side];
    if (!L.positions) L.positions = emptyPositions();
    var currentValue = L.positions[posKey];
    var usedIds = Object.keys(L.positions).map(function (k) { return L.positions[k]; }).filter(function (id) { return id && id !== currentValue; });
    var list = PLAYERS.filter(function (p) { return p.currentTeamName === teamName && usedIds.indexOf(p.id) === -1; });
    var q = (state.lineupPickerQuery || "").trim().toLowerCase();
    if (q) {
      list = list.filter(function (p) { return (p.name + " " + (p.nameKana || "")).toLowerCase().indexOf(q) !== -1; });
    }
    list = sortPlayers(list, "number", "asc");
    var starterIds = lineupStarterIds(side);
    var withPriority = list.map(function (p, i) { return { p: p, i: i, starter: starterIds.indexOf(p.id) !== -1 ? 0 : 1 }; });
    withPriority.sort(function (a, b) { return a.starter - b.starter || a.i - b.i; });
    return withPriority.map(function (x) { return x.p; });
  }

  function todaysRelationMatchups() {
    var homeIds = lineupStarterIds("home");
    var oppIds = lineupStarterIds("opponent");
    if (!homeIds.length || !oppIds.length) return [];
    return RELATIONS.filter(function (r) {
      return (homeIds.indexOf(r.fromPlayerId) !== -1 && oppIds.indexOf(r.toPlayerId) !== -1) ||
        (homeIds.indexOf(r.toPlayerId) !== -1 && oppIds.indexOf(r.fromPlayerId) !== -1);
    });
  }
  function topByStat(players, key) {
    var withStat = players.filter(function (p) { return p.currentStats && p.currentStats[key] != null; });
    if (!withStat.length) return null;
    withStat.sort(function (a, b) { return b.currentStats[key] - a.currentStats[key]; });
    return withStat[0];
  }
  function lineupStatHighlights() {
    var homePlayers = lineupStarterIds("home").map(byId).filter(Boolean);
    var oppPlayers = lineupStarterIds("opponent").map(byId).filter(Boolean);
    var out = [];

    if (state.homeTeam === "楽天") {
      oppPlayers.forEach(function (p) {
        if (isRakutenKiller(p) && p.vsRakutenData) {
          out.push({
            player: p,
            text: "楽天キラー注意：" + (isPitcher(p) ? "対楽天防御率 " : "対楽天打率 ") + p.vsRakutenData.avgOrEra +
              "。" + p.vsRakutenData.notes
          });
        }
      });
    }

    if (!out.length) {
      // 規定打席未到達の選手は打席数が少なく打率がぶれやすいため、「今季打率トップ」の
      // 注目対決には含めない（例：数打席で3割超のような極端な値が出てしまうのを防ぐ）
      var topHomeBatter = topByStat(homePlayers.filter(function (p) { return !isPitcher(p) && isQualifiedThisSeason(p); }), "avg");
      var topOppBatter = topByStat(oppPlayers.filter(function (p) { return !isPitcher(p) && isQualifiedThisSeason(p); }), "avg");
      if (topHomeBatter) {
        out.push({ player: topHomeBatter, text: "本日の" + state.homeTeam + "スタメンで今季打率トップ（" + (topHomeBatter.currentStats.avgDisplay || "-") + "）。" });
      }
      if (topOppBatter) {
        out.push({ player: topOppBatter, text: "本日の相手スタメンで今季打率トップ（" + (topOppBatter.currentStats.avgDisplay || "-") + "）。要注意の一打。" });
      }
    }
    return out.slice(0, 3);
  }
  function lineupPickerCandidates(side, kind, index) {
    var teamName = side === "home" ? state.homeTeam : state.opponentTeam;
    var L = state.lineup[side];
    var currentValue = kind === "pitcher" ? L.pitcher : L.batters[index];
    var usedIds = lineupStarterIds(side).filter(function (id) { return id !== currentValue; });
    var list = PLAYERS.filter(function (p) {
      if (p.currentTeamName !== teamName) return false;
      if (kind === "pitcher") { if (!isPitcher(p)) return false; } else if (isPitcher(p)) return false;
      return usedIds.indexOf(p.id) === -1;
    });
    var q = (state.lineupPickerQuery || "").trim().toLowerCase();
    if (q) {
      list = list.filter(function (p) {
        return (p.name + " " + (p.nameKana || "")).toLowerCase().indexOf(q) !== -1;
      });
    }
    return sortPlayers(list, "number", "asc");
  }

  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function kanaHtml(p, cls) {
    if (!p || !p.nameKana) return "";
    return '<span class="kana' + (cls ? " " + cls : "") + '">' + esc(p.nameKana) + "</span>";
  }

  function linkifyMentions(text, selfId) {
    if (!text) return "";
    var candidates = PLAYERS
      .filter(function (p) { return p.id !== selfId; })
      .map(function (p) { return { id: p.id, flat: p.name.replace(/\s/g, "") }; })
      .filter(function (c) { return c.flat.length >= 2; })
      .sort(function (a, b) { return b.flat.length - a.flat.length; });

    var matches = [];
    candidates.forEach(function (c) {
      var idx = 0;
      while (true) {
        var pos = text.indexOf(c.flat, idx);
        if (pos === -1) break;
        var end = pos + c.flat.length;
        var overlaps = matches.some(function (m) { return pos < m.end && end > m.start; });
        if (!overlaps) matches.push({ start: pos, end: end, id: c.id, text: c.flat });
        idx = pos + c.flat.length;
      }
    });
    if (!matches.length) return esc(text);
    matches.sort(function (a, b) { return a.start - b.start; });

    var out = "", cursor = 0;
    matches.forEach(function (m) {
      out += esc(text.slice(cursor, m.start));
      out += '<button class="mention-link" data-action="open-detail" data-id="' + m.id + '">' + esc(m.text) + "</button>";
      cursor = m.end;
    });
    out += esc(text.slice(cursor));
    return out;
  }

  function daysUntil(dateStr) {
    var target = new Date(dateStr + "T00:00:00+09:00");
    var now = new Date();
    return Math.ceil((target.getTime() - now.getTime()) / 86400000);
  }

  /* ===================== Avatar（守備位置を表す一文字バッジ。実際の顔写真は使用しません） =====================
     著作権上、実在選手の顔写真は使用できません。シルエットのポーズ表現は小さいサイズだと
     判別しづらいという指摘を受け、投手・捕手・内野手・外野手を漢字一文字（投/捕/内/外）で
     即座に判別できるバッジ表示に変更しています。 */
  var POSITION_LETTER = { "投手": "投", "捕手": "捕", "内野手": "内", "外野手": "外" };
  function avatarHtml(p, size) {
    var sz = size || 40;
    var tc = teamColor(p.currentTeamName);
    var radius = Math.round(sz * 0.28);
    var letterSize = Math.max(11, Math.round(sz * 0.46));
    var numSize = Math.max(8, Math.round(sz * 0.2));
    var letter = POSITION_LETTER[p.position] || "野";
    return (
      '<div class="p-avatar" style="width:' + sz + "px;height:" + sz + "px;border-radius:" + radius + "px;color:" + tc.fg + ";" +
      "background:linear-gradient(150deg, " + tc.bg + " 0%, color-mix(in srgb, " + tc.bg + " 55%, #10090a) 100%);\">" +
        '<span class="av-num" style="font-size:' + numSize + "px;color:" + tc.fg + ';">' + p.number + "</span>" +
        '<span class="av-letter" style="font-size:' + letterSize + 'px;">' + letter + "</span>" +
      "</div>"
    );
  }

  /* ===================== State ===================== */
  var initHomeTeam = loadHomeTeam();
  var storedOpponentTeam = loadOpponentTeam();
  // 対戦相手がユーザーの明示的な選択でない（＝自動計算に頼ってよい）場合は、
  // 起動直後の時点ではTEAM_NEXT_GAMES/RELATIONSがまだ空（非同期取得前）なので、
  // ここでのcomputeDefaultOpponent()は本来の「本日の実際の対戦相手」を選べないことがある。
  // そのためboot()で日程データが揃った時点にもう一度計算し直す（下のopponentTeamNeedsRecomputeを参照）。
  // 判定にはOPPONENT_MANUAL_KEY（本当にユーザーが「対戦相手を変更」から選んだ場合のみ立つフラグ）を
  // 使う。保存値の有無だけで判定すると、setHomeTeam()による自動計算結果の保存まで「手動」と
  // 誤判定してしまい、日程の自動更新に対戦相手が追従しなくなる不具合が起きるため。
  var opponentTeamNeedsRecompute = !loadOpponentIsManual();
  var initOpponentTeam = opponentTeamNeedsRecompute ? computeDefaultOpponent(initHomeTeam) : (storedOpponentTeam || computeDefaultOpponent(initHomeTeam));

  var state = {
    query: "",
    activeTags: ["matchup"],
    teamFilter: "all",
    viewMode: "all", // all | batter | pitcher
    batterSort: "avg",
    pitcherSort: "era",
    tab: "home", // home | roster
    rosterView: "players", // players | legends（名鑑タブ内の切替：現役選手一覧 / レジェンド一覧）
    overlay: null, // { type: 'detail'|'connections'|'lineup'|'filters'|'settings'|'legend-detail', playerId?, legendId? }
    detailTab: "basic", // basic | other (選手詳細シート内のタブ)
    homeTeam: initHomeTeam,
    opponentTeam: initOpponentTeam,
    lineup: null, // 下で loadLineup() により初期化
    lineupSide: "home", // home | opponent（スタメン登録シート内のタブ）
    lineupView: "order", // order | defense | compare（打順一覧 / 守備位置ダイヤモンド図 / 両チーム打線比較）
    lineupPicker: null, // { side, kind: 'batter'|'pitcher'|'position', index?, posKey? }
    lineupPickerQuery: "",
    lineupFetching: null, // "home" | "opponent" | null（/api/lineup 取得中の対象サイド。二重押し防止にも使う）
    lineupFetchNotice: null, // { type: 'success'|'warning'|'error', message } 取得結果の通知（サイド切替時にクリア）
    dataRefreshing: false, // ヘッダーの更新ボタンで全データを再取得中かどうか（二重押し防止・アイコン回転表示に使用）
    scheduleFetching: false, // NEXT GAMEカードの「日程を更新」ボタンで取得中かどうか（二重押し防止）
    newsScope: "team", // ホーム画面「最新ニュース」の表示範囲："team"=ホーム球団のみ／"all"=全球団
    legendCategoryFilter: "all", // all | legend | overseas | faded（レジェンド一覧の絞り込み）
    legendComparePlayerId: null, // レジェンド詳細で「比較する選手を変える」により手動選択された現役選手ID（未選択なら自動で近い成績の選手を選ぶ）
    legendComparePickerOpen: false,
    legendComparePickerQuery: ""
  };
  state.lineup = loadLineup(state.homeTeam, state.opponentTeam);
  applyHomeTheme(state.homeTeam);

  /* ===================== DOM refs (created once) ===================== */
  var app = document.getElementById("app");
  app.innerHTML =
    '<header class="app-header">' +
      '<div class="brand-row">' +
        '<div><p class="brand-eyebrow" id="brand-eyebrow">SCOUT NOTE</p><h1 class="brand-title" id="brand-title">観戦ノート</h1></div>' +
        '<div class="header-actions">' +
          '<button class="settings-btn" id="refresh-btn" data-action="refresh-data" aria-label="最新データに更新">' + icon("refresh", 16) + "</button>" +
          '<button class="settings-btn" id="settings-btn" data-action="open-settings" aria-label="設定・ホーム球団の変更">' + icon("settings", 17) + "</button>" +
          '<span class="count-pill" id="count-pill">0名</span>' +
        "</div>" +
      "</div>" +
      '<div class="matchup-banner" id="matchup-banner">' +
        '<span class="ball">⚾</span>' +
        '<span class="txt" id="matchup-banner-txt"></span>' +
      "</div>" +
      '<div id="roster-controls">' +
        '<div class="mode-switch roster-view-switch" id="roster-view-switch">' +
          '<button data-roster-view="players">' + icon("grid", 13) + "選手一覧</button>" +
          '<button data-roster-view="legends">' + icon("trophy", 13) + "レジェンド</button>" +
        "</div>" +
        '<div id="roster-players-controls">' +
          '<div class="search-wrap">' +
            icon("search", 16, "icon-search") +
            '<input id="search-input" type="search" inputmode="search" placeholder="選手名・学校名・シニア名で検索" autocomplete="off">' +
            '<button class="search-clear" id="search-clear" aria-label="検索をクリア" hidden>' + icon("x", 14) + "</button>" +
          "</div>" +
          '<div class="filter-trigger-row">' +
            '<button class="filter-trigger-btn" id="filter-trigger-btn" data-action="open-filters"></button>' +
            '<div class="active-filter-chips no-scrollbar" id="active-filter-chips" hidden></div>' +
          "</div>" +
          '<div class="control-row">' +
            '<div class="mode-switch" id="mode-switch">' +
              '<button data-mode="all">全員</button><button data-mode="batter">野手</button><button data-mode="pitcher">投手</button>' +
            "</div>" +
            '<div class="sort-row no-scrollbar" id="sort-row"></div>' +
          "</div>" +
        "</div>" +
      "</div>" +
    "</header>" +
    '<main id="main-content"></main>' +
    '<nav class="bottom-nav" id="bottom-nav">' +
      '<button data-tab="home">' + icon("home", 18) + "<span>ホーム</span></button>" +
      '<button data-tab="roster">' + icon("grid", 18) + "<span>名鑑</span></button>" +
    "</nav>" +
    '<div id="overlay-root"></div>' +
    '<div class="filter-toast" id="filter-toast" hidden></div>';

  var els = {
    countPill: document.getElementById("count-pill"),
    refreshBtn: document.getElementById("refresh-btn"),
    filterToast: document.getElementById("filter-toast"),
    matchupBanner: document.getElementById("matchup-banner"),
    matchupBannerTxt: document.getElementById("matchup-banner-txt"),
    brandEyebrow: document.getElementById("brand-eyebrow"),
    brandTitle: document.getElementById("brand-title"),
    rosterControls: document.getElementById("roster-controls"),
    rosterViewSwitch: document.getElementById("roster-view-switch"),
    rosterPlayersControls: document.getElementById("roster-players-controls"),
    searchInput: document.getElementById("search-input"),
    searchClear: document.getElementById("search-clear"),
    filterTriggerBtn: document.getElementById("filter-trigger-btn"),
    activeFilterChips: document.getElementById("active-filter-chips"),
    modeSwitch: document.getElementById("mode-switch"),
    sortRow: document.getElementById("sort-row"),
    main: document.getElementById("main-content"),
    bottomNav: document.getElementById("bottom-nav"),
    overlayRoot: document.getElementById("overlay-root")
  };

  /* ===================== Render: header pieces ===================== */
  function activeFilterCount() {
    return state.activeTags.length + (state.teamFilter !== "all" ? 1 : 0);
  }

  function renderBrand() {
    var t = getTeam(state.homeTeam);
    els.brandEyebrow.textContent = t.emoji + " SCOUT NOTE";
    els.brandTitle.textContent = t.fullName + "観戦ノート";
    els.matchupBannerTxt.innerHTML = "<b>" + esc(state.homeTeam) + " vs " + esc(state.opponentTeam) + "</b><br>この対戦カードの選手同士のつながりを表示中";
  }

  function renderFilterTrigger() {
    var n = activeFilterCount();
    els.filterTriggerBtn.innerHTML = icon("filter", 15) + "絞り込み" +
      (n > 0 ? '<span class="filter-count-badge">' + n + "</span>" : "");
    renderActiveFilterChips();
  }

  function renderActiveFilterChips() {
    var chips = [];
    if (state.teamFilter !== "all") {
      var tc = teamColor(state.teamFilter);
      chips.push(
        '<button class="active-chip" data-action="set-team" data-key="all" style="background:' + tc.bg + ";color:" + tc.fg + ';">' +
          esc(state.teamFilter) + icon("x", 11) +
        "</button>"
      );
    }
    var tags = buildFilterTags(state.homeTeam, state.opponentTeam);
    tags.forEach(function (t) {
      if (state.activeTags.indexOf(t.key) !== -1) {
        chips.push('<button class="active-chip" data-action="toggle-tag" data-key="' + t.key + '">' + esc(t.label) + icon("x", 11) + "</button>");
      }
    });
    els.activeFilterChips.innerHTML = chips.join("");
    els.activeFilterChips.hidden = chips.length === 0;
  }

  function filterGroupHtml(title, tags) {
    return (
      '<div class="filter-group">' +
        '<p class="filter-group-title">' + esc(title) + "</p>" +
        '<div class="filter-chip-wrap">' +
          tags.map(function (t) {
            var active = state.activeTags.indexOf(t.key) !== -1;
            return '<button class="tag-btn' + (active ? " active" : "") + '" data-action="toggle-tag" data-key="' + t.key + '">' + esc(t.label) + "</button>";
          }).join("") +
        "</div>" +
      "</div>"
    );
  }

  function opponentPickerHtml() {
    var chips = TEAM_NAMES.filter(function (t) { return t !== state.homeTeam; }).map(function (t) {
      var tc = teamColor(t);
      var active = state.opponentTeam === t;
      var style = active ? "background:" + tc.bg + ";color:" + tc.fg + ";border-color:transparent;" : "";
      return '<button class="tag-btn' + (active ? " active" : "") + '" data-action="set-opponent" data-key="' + esc(t) + '" style="' + style + '">' + esc(t) + "</button>";
    }).join("");
    return (
      '<div class="filter-group">' +
        '<p class="filter-group-title">対戦相手（つながり表示・スタメン登録に使用）</p>' +
        '<div class="filter-chip-wrap">' + chips + "</div>" +
      "</div>"
    );
  }

  function filterSheetHtml() {
    var teamChips = ['<button class="tag-btn' + (state.teamFilter === "all" ? " active" : "") + '" data-action="set-team" data-key="all">すべての球団</button>'];
    TEAM_NAMES.forEach(function (t) {
      var tc = teamColor(t);
      var active = state.teamFilter === t;
      var style = active ? "background:" + tc.bg + ";color:" + tc.fg + ";border-color:transparent;" : "";
      teamChips.push('<button class="tag-btn' + (active ? " active" : "") + '" data-action="set-team" data-key="' + esc(t) + '" style="' + style + '">' + esc(t) + "</button>");
    });

    var tags = buildFilterTags(state.homeTeam, state.opponentTeam);
    var grouped = {};
    tags.forEach(function (t) {
      var g = t.group || "その他";
      (grouped[g] = grouped[g] || []).push(t);
    });
    var groupsHtml = FILTER_GROUP_ORDER.filter(function (g) { return grouped[g]; }).map(function (g, i) {
      // 「対戦」グループの先頭に対戦相手ピッカーを差し込む
      return (i === 0 ? opponentPickerHtml() : "") + filterGroupHtml(g, grouped[g]);
    }).join("");

    var n = activeFilterCount();

    return (
      '<div class="sheet-header">' +
        '<div class="who"><span class="sheet-icon-badge">' + icon("filter", 20) + "</span><span>" +
          '<p class="sub">球団・つながりの種類などで絞り込み</p><p class="nm">絞り込み</p>' +
        "</span></div>" +
        '<button class="sheet-close" data-action="close-overlay" aria-label="閉じる">' + icon("x", 18) + "</button>" +
      "</div>" +
      '<div class="sheet-body">' +
        '<div class="filter-group"><p class="filter-group-title">球団</p><div class="filter-chip-wrap">' + teamChips.join("") + "</div></div>" +
        groupsHtml +
        (n > 0
          ? '<button class="lineup-clear-btn" data-action="reset-filters">絞り込みをすべて解除（' + n + "件）</button>"
          : '<p class="empty-state" style="padding:6px 0 0;">絞り込み条件はまだありません。</p>') +
      "</div>"
    );
  }

  function refreshFilterSheetIfOpen() {
    if (!state.overlay || state.overlay.type !== "filters") return;
    var sheetEl = els.overlayRoot.querySelector(".sheet");
    if (!sheetEl) return;
    var scrollTop = sheetEl.scrollTop;
    sheetEl.innerHTML = filterSheetHtml();
    sheetEl.scrollTop = scrollTop;
  }

  var filterToastTimer = null;
  var filterToastHideTimer = null;
  // count用の「N件表示中」表示だけでなく、データ更新結果などの一言通知にも使う汎用トースト
  function showToast(message, durationMs) {
    if (!els.filterToast) return;
    els.filterToast.textContent = message;
    els.filterToast.hidden = false;
    if (filterToastHideTimer) { clearTimeout(filterToastHideTimer); filterToastHideTimer = null; }
    void els.filterToast.offsetWidth;
    els.filterToast.classList.add("show");
    if (filterToastTimer) clearTimeout(filterToastTimer);
    filterToastTimer = setTimeout(function () {
      els.filterToast.classList.remove("show");
      filterToastHideTimer = setTimeout(function () { els.filterToast.hidden = true; }, 220);
    }, durationMs || 1400);
  }
  function showFilterToast(count) { showToast(count + "件表示中"); }

  function renderModeSwitch() {
    Array.prototype.forEach.call(els.modeSwitch.querySelectorAll("button"), function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-mode") === state.viewMode);
    });
  }

  function renderSortRow() {
    if (state.viewMode === "all") {
      els.sortRow.innerHTML = '<span class="sort-hint">背番号順に表示中。野手/投手を選ぶと成績順で並び替えできます。</span>';
      return;
    }
    var opts = state.viewMode === "batter" ? BATTER_SORTS : PITCHER_SORTS;
    var current = state.viewMode === "batter" ? state.batterSort : state.pitcherSort;
    els.sortRow.innerHTML = icon("sort", 14, "sicon") + opts.map(function (o) {
      return '<button class="sort-btn' + (o.key === current ? " active" : "") + '" data-action="set-sort" data-key="' + o.key + '">' + o.label + "</button>";
    }).join("") + '<span class="sort-hint sort-hint-basis">' + SORT_BASIS_LABEL + "</span>";
  }

  function syncHeaderVisibility() {
    els.matchupBanner.style.display = state.tab === "home" ? "none" : "flex";
    els.rosterControls.style.display = state.tab === "roster" ? "block" : "none";
  }

  /* ===================== Render: player card ===================== */
  function statStrip(p) {
    var s = p.currentStats || {};
    var sortKey = isPitcher(p) ? state.pitcherSort : state.batterSort;
    if (isPitcher(p)) {
      var third = ["奪三振", s.strikeouts != null ? String(s.strikeouts) : "-"];
      if (sortKey === "saves") third = ["セーブ", s.saves != null ? String(s.saves) : "-"];
      if (sortKey === "salary") third = ["推定年俸", formatSalary(p.salaryManYen)];
      return [
        ["防御率", s.eraDisplay || "-"],
        ["勝-敗", s.wins != null ? s.wins + "-" + (s.losses != null ? s.losses : 0) : "-"],
        third
      ];
    }
    var thirdB = ["OPS", s.ops != null ? s.ops.toFixed(3) : "-"];
    if (sortKey === "rbi") thirdB = ["打点", s.rbi != null ? String(s.rbi) : "-"];
    if (sortKey === "stolenBases") thirdB = ["盗塁", s.stolenBases != null ? String(s.stolenBases) : "-"];
    if (sortKey === "salary") thirdB = ["推定年俸", formatSalary(p.salaryManYen)];
    return [
      ["打率", s.avgDisplay || "-"],
      ["本塁打", s.hr != null ? String(s.hr) : "-"],
      thirdB
    ];
  }

  function playerCardHtml(p) {
    var killer = state.homeTeam === "楽天" && isRakutenKiller(p);
    var stats = statStrip(p);
    var tc = teamColor(p.currentTeamName);
    var sortKey = isPitcher(p) ? state.pitcherSort : state.batterSort;
    var showUnqualified = state.viewMode !== "all" && isRateSortKey(sortKey) && qualifyStateFor(p, sortKey) === "short";
    var age = currentAge(p.birthDate); // 一覧カードでも一目で年齢が分かるよう、詳細画面を開かなくても表示する
    return (
      '<button class="p-card" data-action="open-detail" data-id="' + p.id + '">' +
        '<div class="p-card-top">' +
          '<div class="p-card-id">' +
            avatarHtml(p, 40) +
            '<div class="p-meta"><p class="p-num">#' + p.number + " " + esc(p.detailedPosition) + "</p>" + kanaHtml(p) + '<p class="p-name">' + esc(p.name) + "</p></div>" +
          "</div>" +
          (killer ? '<span class="killer-flag" title="楽天キラー">' + icon("alertTriangle", 15) + "</span>" : "") +
        "</div>" +
        '<div class="badge-row">' +
          '<span class="badge" style="background:' + tc.bg + ";color:" + tc.fg + ';">' + esc(p.currentTeamName) + "</span>" +
          (age != null ? '<span class="badge age-badge">満' + age + "歳</span>" : "") +
          (isLocalConnection(p, state.homeTeam) ? '<span class="badge tohoku">' + icon("mapPin", 9) + esc(getTeam(state.homeTeam).regionLabel) + "ゆかり</span>" : "") +
          (showUnqualified ? '<span class="badge unqualified">規定未到達</span>' : "") +
        "</div>" +
        '<div class="stat-strip">' +
          stats.map(function (s) { return '<div><p class="lbl">' + s[0] + '</p><p class="val">' + s[1] + "</p></div>"; }).join("") +
        "</div>" +
      "</button>"
    );
  }

  /* ===================== Render: roster grid ===================== */
  function currentRosterList() {
    var list = filterPlayers(PLAYERS, state.query, state.activeTags, state.teamFilter, state.homeTeam, state.opponentTeam);
    if (state.viewMode === "batter") list = list.filter(function (p) { return !isPitcher(p); });
    if (state.viewMode === "pitcher") list = list.filter(function (p) { return isPitcher(p); });

    if (state.viewMode === "pitcher") return sortPlayers(list, state.pitcherSort, sortDirFor(state.pitcherSort));
    if (state.viewMode === "batter") return sortPlayers(list, state.batterSort, sortDirFor(state.batterSort));
    return sortPlayers(list, "number", "asc");
  }
  function sortDirFor(key) { return key === "era" || key === "number" ? "asc" : "desc"; }

  function renderRosterViewSwitch() {
    if (!els.rosterViewSwitch) return;
    var btns = els.rosterViewSwitch.querySelectorAll("button[data-roster-view]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("active", btns[i].getAttribute("data-roster-view") === state.rosterView);
    }
    if (els.rosterPlayersControls) els.rosterPlayersControls.style.display = state.rosterView === "players" ? "block" : "none";
  }

  function renderRoster() {
    renderRosterViewSwitch();
    if (state.rosterView === "legends") { renderLegendGrid(); return; }
    var list = currentRosterList();
    els.countPill.textContent = list.length + "名";
    els.main.innerHTML = '<div class="grid">' +
      (list.length ? list.map(playerCardHtml).join("") : '<p class="empty-state">該当する選手が見つかりませんでした。</p>') +
      "</div>" +
      '<p class="data-footnote">' + esc(DATA_AS_OF) + "。全12球団" + PLAYERS.length + "名を掲載（直近1年以内に一軍出場実績のある選手を中心に収録。育成選手や出場実績のない選手など、支配下選手全員を完全網羅するものではありません）。" +
      esc(statsFreshnessText()) + "</p>";
  }

  /* ===================== Render: レジェンド（歴代スター・海外組・現役成績と比較） ===================== */
  var LEGEND_CATEGORY_LABELS = { legend: "歴代レジェンド", overseas: "海外へ羽ばたいた選手", faded: "かつての大スター" };
  var LEGEND_CATEGORY_SHORT = { legend: "歴代", overseas: "海外組", faded: "元スター" };
  var LEGEND_CATEGORY_FILTERS = [
    { key: "all", label: "全員" },
    { key: "legend", label: "歴代レジェンド" },
    { key: "overseas", label: "海外組" },
    { key: "faded", label: "かつての大スター" }
  ];
  function legendCategoryClass(cat) { return cat === "overseas" ? "cat-overseas" : cat === "faded" ? "cat-faded" : "cat-legend"; }
  function legendById(id) { return LEGENDS ? LEGENDS.filter(function (l) { return l.id === id; })[0] : null; }

  function legendAvatarHtml(leg, size) {
    var sz = size || 40;
    var radius = Math.round(sz * 0.28);
    return (
      '<div class="legend-avatar ' + legendCategoryClass(leg.category) + '" style="width:' + sz + "px;height:" + sz + 'px;border-radius:' + radius + 'px;">' +
        icon("trophy", Math.round(sz * 0.44)) +
      "</div>"
    );
  }

  function legendCardHtml(leg) {
    var bs = leg.bestSeason || {};
    var statLine = leg.isPitcher
      ? [["防御率", bs.eraDisplay || "-"], ["勝-敗", bs.wins != null ? bs.wins + "-" + (bs.losses != null ? bs.losses : 0) : "-"], ["奪三振", bs.strikeouts != null ? String(bs.strikeouts) : "-"]]
      : [["打率", bs.avgDisplay || "-"], ["本塁打", bs.hr != null ? String(bs.hr) : "-"], ["打点", bs.rbi != null ? String(bs.rbi) : "-"]];
    return (
      '<button class="p-card" data-action="open-legend-detail" data-id="' + leg.id + '">' +
        '<div class="p-card-top">' +
          '<div class="p-card-id">' +
            legendAvatarHtml(leg, 40) +
            '<div class="p-meta"><p class="p-num">' + esc(leg.detailedPosition || "") + "</p><p class=\"p-name\">" + esc(leg.name) + "</p></div>" +
          "</div>" +
        "</div>" +
        '<div class="badge-row">' +
          '<span class="badge legend-badge ' + legendCategoryClass(leg.category) + '">' + esc(LEGEND_CATEGORY_SHORT[leg.category] || "レジェンド") + "</span>" +
          (leg.peakTeam ? '<span class="badge" style="background:var(--bg-sunken);color:var(--ink-dim);">' + esc(leg.peakTeam) + "</span>" : "") +
        "</div>" +
        '<div class="stat-strip">' +
          statLine.map(function (s) { return '<div><p class="lbl">' + s[0] + '</p><p class="val">' + s[1] + "</p></div>"; }).join("") +
        "</div>" +
      "</button>"
    );
  }

  function currentLegendList() {
    var list = LEGENDS || [];
    if (state.legendCategoryFilter !== "all") list = list.filter(function (l) { return l.category === state.legendCategoryFilter; });
    return list;
  }

  function legendFilterRowHtml() {
    return '<div class="legend-filter-row no-scrollbar">' +
      LEGEND_CATEGORY_FILTERS.map(function (f) {
        return '<button class="legend-filter-btn' + (state.legendCategoryFilter === f.key ? " active" : "") + '" data-action="set-legend-category" data-key="' + f.key + '">' + esc(f.label) + "</button>";
      }).join("") +
    "</div>";
  }

  function renderLegendGrid() {
    if (!LEGENDS) {
      els.countPill.textContent = "-名";
      els.main.innerHTML = legendsLoadFailed
        ? '<div class="empty-state-block">' +
            '<p class="empty-state">レジェンドデータの取得に失敗しました。電波状況をご確認のうえ、もう一度お試しください。</p>' +
            '<button class="cta-btn cta-outline" data-action="retry-legends" style="margin:14px auto 0;max-width:220px;">' + icon("network", 15) + "再読み込み</button>" +
          "</div>"
        : '<p class="empty-state">読み込み中…</p>';
      return;
    }
    var list = currentLegendList();
    els.countPill.textContent = list.length + "名";
    els.main.innerHTML =
      '<div style="padding:0 16px;">' + legendFilterRowHtml() + "</div>" +
      '<div class="grid">' +
        (list.length ? list.map(legendCardHtml).join("") : '<p class="empty-state">該当するレジェンドが見つかりませんでした。</p>') +
      "</div>" +
      '<p class="data-footnote">歴代の球界スター・海外へ羽ばたいた選手・かつて活躍した選手を' + LEGENDS.length + '名掲載。各選手の「自己ベストシーズン」成績はWikipedia・NPB公式記録等をもとに調査していますが、数値には誤りが含まれる可能性があります。正確な記録は球団・NPB公式の記録をご確認ください。</p>';
  }

  /* ---- 現役選手⇔レジェンドの類似成績マッチング ----
     打率・本塁打・打点（打者）／防御率・勝利数・奪三振（投手）のズレを大まかに正規化して
     合計したスコアが最も小さい相手を「似た成績」とみなす。レジェンドの成績は本人のNPB
     自己ベストシーズン（実質フルシーズン）、現役選手の成績はアプリ内の今季（シーズン
     途中）成績のため、単純な優劣比較ではなく「タイプの近さ」の目安として案内する。 */
  function battersSimilarityScore(bs, cs) {
    if (bs.avg == null || cs.avg == null) return null;
    var d = Math.abs(bs.avg - cs.avg) / 0.05;
    if (bs.hr != null && cs.hr != null) d += Math.abs(bs.hr - cs.hr) / 15;
    if (bs.rbi != null && cs.rbi != null) d += Math.abs(bs.rbi - cs.rbi) / 30;
    return d;
  }
  function pitchersSimilarityScore(bs, cs) {
    if (bs.era == null || cs.era == null) return null;
    var d = Math.abs(bs.era - cs.era) / 1.5;
    if (bs.wins != null && cs.wins != null) d += Math.abs(bs.wins - cs.wins) / 8;
    if (bs.strikeouts != null && cs.strikeouts != null) d += Math.abs(bs.strikeouts - cs.strikeouts) / 60;
    return d;
  }
  function findSimilarCurrentPlayer(leg, excludeId) {
    var pool = PLAYERS.filter(function (p) { return isPitcher(p) === !!leg.isPitcher && p.id !== excludeId; });
    var bs = leg.bestSeason || {};
    var best = null, bestScore = Infinity;
    pool.forEach(function (p) {
      var cs = p.currentStats || {};
      var score = leg.isPitcher ? pitchersSimilarityScore(bs, cs) : battersSimilarityScore(bs, cs);
      if (score != null && score < bestScore) { bestScore = score; best = p; }
    });
    return best;
  }
  function findSimilarLegend(player) {
    if (!LEGENDS || !LEGENDS.length) return null;
    var cs = player.currentStats || {};
    var pitcherFlag = isPitcher(player);
    var best = null, bestScore = Infinity;
    LEGENDS.forEach(function (leg) {
      if (!!leg.isPitcher !== pitcherFlag) return;
      var score = pitcherFlag ? pitchersSimilarityScore(leg.bestSeason || {}, cs) : battersSimilarityScore(leg.bestSeason || {}, cs);
      if (score != null && score < bestScore) { bestScore = score; best = leg; }
    });
    return best;
  }

  // 現役選手の詳細画面に表示する「似た成績のレジェンド」ヒント（レジェンドデータ未取得時は非表示）
  function similarLegendHintHtml(p) {
    if (!LEGENDS || !LEGENDS.length) return "";
    var match = findSimilarLegend(p);
    if (!match) return "";
    var bs = match.bestSeason || {};
    var statText = match.isPitcher
      ? (bs.eraDisplay || "-") + "／" + (bs.wins != null ? bs.wins + "勝" + (bs.losses != null ? bs.losses : 0) + "敗" : "-")
      : (bs.avgDisplay || "-") + "／" + (bs.hr != null ? bs.hr + "本" : "-") + "／" + (bs.rbi != null ? bs.rbi + "打点" : "-");
    return (
      '<section><p class="section-label">' + icon("trophy", 13) + "似た成績のレジェンド</p>" +
        '<button class="legend-hint-card" data-action="open-legend-detail" data-id="' + match.id + '">' +
          legendAvatarHtml(match, 36) +
          '<span class="legend-hint-body">' +
            '<span class="legend-hint-nm">' + esc(match.name) +
              '<span class="badge legend-badge ' + legendCategoryClass(match.category) + '" style="margin-left:6px;font-size:9.5px;padding:2px 7px;">' + esc(LEGEND_CATEGORY_SHORT[match.category] || "") + "</span>" +
            "</span>" +
            '<span class="legend-hint-stats">' + esc(bs.year || "") + "年 自己ベストシーズン： " + statText + "</span>" +
          "</span>" +
          icon("arrowRight", 15) +
        "</button>" +
      "</section>"
    );
  }

  // 打者/投手それぞれ、2つの成績オブジェクトから「どちらが優れているか」込みの比較表示値を作る
  function compareValuesFor(aStats, bStats, isPitcherFlag) {
    if (isPitcherFlag) {
      var aEra = aStats.era, bEra = bStats.era, aWins = aStats.wins, bWins = bStats.wins;
      return {
        aVals: [
          { text: aStats.eraDisplay || "-", better: aEra != null && (bEra == null || aEra < bEra) },
          { text: aWins != null ? aWins + "勝" : "-", better: aWins != null && (bWins == null || aWins > bWins) }
        ],
        bVals: [
          { text: bStats.eraDisplay || "-", better: bEra != null && (aEra == null || bEra < aEra) },
          { text: bWins != null ? bWins + "勝" : "-", better: bWins != null && (aWins == null || bWins > aWins) }
        ]
      };
    }
    var aAvg = aStats.avg, bAvg = bStats.avg, aHr = aStats.hr, bHr = bStats.hr;
    return {
      aVals: [
        { text: aStats.avgDisplay || (aAvg != null ? aAvg.toFixed(3) : "-"), better: aAvg != null && (bAvg == null || aAvg > bAvg) },
        { text: aHr != null ? aHr + "本" : "-", better: aHr != null && (bHr == null || aHr > bHr) }
      ],
      bVals: [
        { text: bStats.avgDisplay || (bAvg != null ? bAvg.toFixed(3) : "-"), better: bAvg != null && (aAvg == null || bAvg > aAvg) },
        { text: bHr != null ? bHr + "本" : "-", better: bHr != null && (aHr == null || bHr > aHr) }
      ]
    };
  }
  function legendCompareCardHtml(leg, statsArr) {
    return (
      '<div class="compare-side" style="cursor:default;">' +
        legendAvatarHtml(leg, 28) +
        '<span class="compare-nm-wrap">' +
          '<span class="compare-nm">' + esc(leg.name) + "</span>" +
          '<span class="compare-stats">' + compareStatRow(statsArr) + "</span>" +
        "</span>" +
      "</div>"
    );
  }
  function legendComparePlayerCardHtml(p, statsArr) {
    if (!p) return '<div class="compare-side compare-empty"><span class="compare-nm-wrap"><span class="compare-nm">対象なし</span></span></div>';
    var tc = teamColor(p.currentTeamName);
    return (
      '<button class="compare-side" data-action="open-detail" data-id="' + p.id + '">' +
        avatarHtml(p, 28) +
        '<span class="compare-nm-wrap">' +
          '<span class="compare-nm">' + esc(p.name) + '<span style="font-weight:600;color:' + tc.fg + ";background:" + tc.bg + ';border-radius:6px;padding:1px 5px;margin-left:5px;font-size:9px;">' + esc(p.currentTeamName) + "</span></span>" +
          '<span class="compare-stats">' + compareStatRow(statsArr) + "</span>" +
        "</span>" +
      "</button>"
    );
  }

  function legendComparePickerHtml(leg) {
    var q = (state.legendComparePickerQuery || "").trim().toLowerCase();
    var pool = PLAYERS.filter(function (p) { return isPitcher(p) === !!leg.isPitcher; });
    if (q) pool = pool.filter(function (p) { return (p.name || "").toLowerCase().indexOf(q) !== -1 || (p.nameKana || "").indexOf(q) !== -1; });
    pool = pool.slice().sort(function (a, b) {
      var ah = a.currentTeamName === state.homeTeam ? 0 : 1, bh = b.currentTeamName === state.homeTeam ? 0 : 1;
      return ah - bh || a.number - b.number;
    }).slice(0, 60);
    return (
      '<div class="search-wrap lineup-picker-search">' +
        icon("search", 16, "icon-search") +
        '<input type="search" inputmode="search" id="legend-compare-picker-input" placeholder="選手名で検索" autocomplete="off" value="' + esc(state.legendComparePickerQuery || "") + '">' +
      "</div>" +
      '<div class="lineup-picker-list">' +
        (pool.length ? pool.map(function (p) {
          var tc = teamColor(p.currentTeamName);
          return (
            '<button class="lineup-picker-row" data-action="pick-legend-compare-player" data-id="' + p.id + '">' +
              avatarHtml(p, 36) +
              '<span class="lineup-picker-nm">' + esc(p.name) +
                '<span class="lineup-picker-pos" style="background:' + tc.bg + ";color:" + tc.fg + ';">' + esc(p.currentTeamName) + "</span>" +
              "</span>" +
            "</button>"
          );
        }).join("") : '<p class="empty-state" style="padding:18px 0;">該当する選手が見つかりませんでした。</p>') +
      "</div>" +
      '<button class="lineup-clear-btn" data-action="close-legend-compare-picker">キャンセル</button>'
    );
  }

  function refreshLegendComparePickerList() {
    var leg = state.overlay && state.overlay.type === "legend-detail" ? legendById(state.overlay.legendId) : null;
    if (!leg) return;
    var wrap = els.overlayRoot.querySelector(".legend-compare-picker-body");
    if (!wrap) return;
    wrap.innerHTML = legendComparePickerHtml(leg);
  }

  function legendCompareSectionHtml(leg) {
    if (state.legendComparePickerOpen) {
      return (
        '<section><p class="section-label">' + icon("network", 13) + "比較する現役選手を選ぶ</p>" +
          '<div class="legend-compare-picker-body">' + legendComparePickerHtml(leg) + "</div>" +
        "</section>"
      );
    }
    var chosen = state.legendComparePlayerId ? byId(state.legendComparePlayerId) : null;
    var target = chosen || findSimilarCurrentPlayer(leg);
    var isAuto = !chosen;
    var body;
    if (!LEGENDS) {
      body = '<p class="empty-state" style="padding:10px 0;">読み込み中…</p>';
    } else if (!PLAYERS.length) {
      body = '<p class="empty-state" style="padding:10px 0;">現役選手データを読み込み中です…</p>';
    } else if (!target) {
      body = '<p class="empty-state" style="padding:10px 0;">比較できる現役選手が見つかりませんでした。</p>';
    } else {
      var cmp = compareValuesFor(leg.bestSeason || {}, target.currentStats || {}, !!leg.isPitcher);
      body =
        '<p class="network-intro">' + esc((leg.bestSeason && leg.bestSeason.year) || "") + "年の自己ベストシーズンと、" + esc(target.name) + "選手の今季ここまでの成績を比べています。" + (isAuto ? "（成績が近い現役選手を自動で選んでいます）" : "") + "</p>" +
        '<div class="compare-row">' +
          legendCompareCardHtml(leg, cmp.aVals) +
          '<span class="compare-num">vs</span>' +
          legendComparePlayerCardHtml(target, cmp.bVals) +
        "</div>" +
        '<button class="lineup-fetch-btn" data-action="open-legend-compare-picker" style="margin-top:10px;">' + icon("users", 13) + "比較する選手を変える</button>";
    }
    return '<section><p class="section-label">' + icon("network", 13) + "現役選手と比較</p>" + body + "</section>";
  }

  function legendDetailHtml(leg) {
    var bs = leg.bestSeason || {};
    var catCls = legendCategoryClass(leg.category);
    var catLabel = LEGEND_CATEGORY_LABELS[leg.category] || "レジェンド";

    var statRows = leg.isPitcher
      ? [["防御率", bs.eraDisplay || "-"], ["勝-敗", bs.wins != null ? bs.wins + "-" + (bs.losses != null ? bs.losses : 0) : "-"], ["セーブ", bs.saves != null ? String(bs.saves) : "-"], ["奪三振", bs.strikeouts != null ? String(bs.strikeouts) : "-"], ["投球回", bs.inningsPitched != null ? String(bs.inningsPitched) : "-"], ["登板数", bs.games != null ? String(bs.games) : "-"]]
      : [["打率", bs.avgDisplay || "-"], ["本塁打", bs.hr != null ? String(bs.hr) : "-"], ["打点", bs.rbi != null ? String(bs.rbi) : "-"], ["盗塁", bs.stolenBases != null ? String(bs.stolenBases) : "-"], ["試合数", bs.games != null ? String(bs.games) : "-"]];
    var statTable =
      '<table class="stat-table"><thead><tr><th>項目</th><th class="cur">' + esc(bs.year || "-") + "年（自己ベストシーズン）</th></tr></thead><tbody>" +
      statRows.map(function (r) { return "<tr><td class=\"lbl\">" + r[0] + '</td><td class="cur">' + r[1] + "</td></tr>"; }).join("") +
      "</tbody></table>";

    var battingExtra = "";
    if (leg.bestSeasonBatting) {
      var bb = leg.bestSeasonBatting;
      battingExtra =
        '<section><p class="section-label">' + esc(bb.year || "") + "年 打者成績（投打二刀流）</p>" +
        '<table class="stat-table"><tbody>' +
          "<tr><td class=\"lbl\">打率</td><td class=\"cur\">" + (bb.avgDisplay || "-") + "</td></tr>" +
          "<tr><td class=\"lbl\">本塁打</td><td class=\"cur\">" + (bb.hr != null ? bb.hr : "-") + "</td></tr>" +
          "<tr><td class=\"lbl\">打点</td><td class=\"cur\">" + (bb.rbi != null ? bb.rbi : "-") + "</td></tr>" +
        "</tbody></table></section>";
    }

    var titlesHtml = (leg.titles && leg.titles.length)
      ? '<div class="pos-chain">' + leg.titles.map(function (t) { return '<span class="pos-chip">' + esc(t) + "</span>"; }).join("") + "</div>"
      : "";
    var highlightBlock =
      '<section><p class="section-label">' + icon("sparkles", 13) + "実績・エピソード</p><div class=\"panel\">" +
        '<p style="font-size:12.5px;line-height:1.7;margin:0 0 10px;">' + esc(leg.careerHighlight || "") + "</p>" +
        titlesHtml +
        (leg.note ? '<p style="font-size:11px;color:var(--ink-faint);margin:10px 0 0;">' + esc(leg.note) + "</p>" : "") +
      "</div></section>";

    var legendInfoCells = [
      infoCell("生年月日", legendBirthDateInfoValue(leg))
    ].filter(Boolean).join("");
    var legendInfoGrid = legendInfoCells
      ? '<section><p class="section-label">基本情報</p><div class="panel info-grid">' + legendInfoCells + "</div></section>"
      : "";

    var legendTimeline = "";
    if (leg.growthTimeline && leg.growthTimeline.length) {
      legendTimeline =
        '<section><p class="section-label">成長軌跡（タイムライン）</p><ol class="timeline">' +
          leg.growthTimeline.map(function (t) {
            return "<li><p class=\"period\">" + esc(t.period) + '</p><p class="title">' + esc(t.title) + '</p><p class="desc">' + linkifyMentions(t.description, leg.id) + "</p></li>";
          }).join("") +
        "</ol></section>";
    }

    var teamHistoryHtml = "";
    if (leg.teamHistory && leg.teamHistory.length) {
      teamHistoryHtml =
        '<section><p class="section-label">' + icon("mapPin", 13) + "在籍球団・海外球団の歩み</p>" +
          leg.teamHistory.map(function (th) {
            return (
              '<div class="panel" style="margin-bottom:8px;">' +
                '<p style="font-weight:700;font-size:12.5px;margin:0 0 4px;">' + esc(th.team) +
                  (th.years ? '<span style="font-weight:400;color:var(--ink-dim);font-size:11.5px;"> ・ ' + esc(th.years) + "</span>" : "") +
                "</p>" +
                '<p style="font-size:12px;line-height:1.7;margin:0;color:var(--ink-dim);">' + linkifyMentions(th.highlight, leg.id) + "</p>" +
              "</div>"
            );
          }).join("") +
        "</section>";
    }

    var legendEpisodes =
      '<section><p class="section-label">' + icon("sparkles", 13) + "伝説を物語るエピソード</p><div class=\"ep-list\">" +
        (leg.episodes && leg.episodes.length
          ? leg.episodes.map(function (e) { return '<div class="ep-item">' + linkifyMentions(e, leg.id) + "</div>"; }).join("")
          : '<div class="ep-item ep-item-empty">このレジェンドのエピソードは今後のアップデートで追加予定です。</div>') +
      "</div></section>";

    var dataNote =
      '<section><div class="info-note-panel">' + icon("info", 14) +
        '<p>成績はWikipedia・NPB公式記録等をもとに調査したものです。数値には誤りが含まれる可能性があるため、正確な記録は球団・NPB公式の記録をご確認ください。</p>' +
      "</div></section>" +
      (leg.dataNote
        ? '<section><div class="info-note-panel">' + icon("info", 14) + "<p>" + esc(leg.dataNote) + "</p></div></section>"
        : "");

    return (
      '<div class="sheet-header">' +
        '<div class="who">' + legendAvatarHtml(leg, 46) + "<span><p class=\"sub\">" + esc(leg.peakTeam || "") + (leg.detailedPosition ? " ・ " + esc(leg.detailedPosition) : "") + "</p><p class=\"nm\">" + esc(leg.name) + "</p></span></div>" +
        '<button class="sheet-close" data-action="close-overlay" aria-label="閉じる">' + icon("x", 18) + "</button>" +
      "</div>" +
      '<div class="sheet-body">' +
        '<div class="badge-row"><span class="badge legend-badge ' + catCls + '">' + esc(catLabel) + "</span>" +
          (leg.activeYears ? '<span class="badge" style="background:var(--bg-sunken);color:var(--ink-dim);">' + esc(leg.activeYears) + "</span>" : "") +
        "</div>" +
        legendInfoGrid +
        '<section><p class="section-label">自己ベストシーズン成績</p>' + statTable + "</section>" +
        battingExtra +
        legendTimeline +
        teamHistoryHtml +
        highlightBlock +
        legendEpisodes +
        legendCompareSectionHtml(leg) +
        dataNote +
      "</div>"
    );
  }

  /* ===================== Render: home tab ===================== */
  function homeLeaderRow(title, iconName, key, n, asc, displayFn) {
    var leaders = statLeaders(key, n, asc);
    if (!leaders.length) return "";
    return (
      '<div class="leader-block">' +
        '<p class="leader-title">' + icon(iconName, 13) + esc(title) + "</p>" +
        '<div class="leader-row no-scrollbar">' +
          leaders.map(function (p, i) {
            var tc = teamColor(p.currentTeamName);
            return (
              '<button class="leader-chip" data-action="open-detail" data-id="' + p.id + '">' +
                '<span class="leader-rank">' + (i + 1) + "</span>" +
                avatarHtml(p, 34) +
                '<span class="leader-nm">' + esc(p.name) + "</span>" +
                '<span class="leader-team" style="background:' + tc.bg + ";color:" + tc.fg + ';">' + esc(p.currentTeamName) + "</span>" +
                '<span class="leader-val">' + displayFn(p.currentStats[key]) + "</span>" +
              "</button>"
            );
          }).join("") +
        "</div>" +
      "</div>"
    );
  }

  function renderLineupHomeSection() {
    var filledE = lineupFilledCount("home");
    var filledO = lineupFilledCount("opponent");

    if (!filledE && !filledO) {
      return (
        '<section class="home-section">' +
          '<button class="lineup-cta-card" data-action="open-lineup">' +
            icon("clipboard", 20) +
            '<span class="cta-text">' +
              '<span class="cta-title">本日のスタメンを登録</span>' +
              '<span class="cta-sub">両チームの打順を登録すると、今日の注目対決を自動でチェックできます</span>' +
            "</span>" +
            icon("arrowRight", 16, "lineup-cta-arrow") +
          "</button>" +
        "</section>"
      );
    }

    var matchups = todaysRelationMatchups();
    var body;
    if (matchups.length) {
      body = matchups.map(matchupCardHtml).join("");
    } else {
      var highlights = lineupStatHighlights();
      body = highlights.length
        ? highlights.map(highlightCardHtml).join("")
        : '<p class="empty-state" style="padding:14px 0;">登録されたスタメンの中に、確認できているつながりや際立った注目ポイントはまだ見つかりませんでした。</p>';
    }

    return (
      '<section class="home-section">' +
        '<div class="lineup-status-row">' +
          '<p class="section-label" style="margin:0;">' + icon("sparkles", 13) + "今日の注目対決</p>" +
          '<span class="lineup-edit-links">' +
            '<button class="lineup-edit-link" data-action="open-lineup-defense">' + icon("mapPin", 12) + "この選手誰？</button>" +
            '<button class="lineup-edit-link" data-action="open-lineup">' + icon("clipboard", 12) + "スタメン編集</button>" +
          "</span>" +
        "</div>" +
        '<div class="lineup-status-chips">' +
          '<span class="lineup-status-chip">' + esc(state.homeTeam) + " " + filledE + "/10人登録</span>" +
          '<span class="lineup-status-chip">' + esc(state.opponentTeam) + " " + filledO + "/10人登録</span>" +
        "</div>" +
        body +
      "</section>"
    );
  }

  // 実データに基づく「今日の一押しトリビア」：小話が確認できているホーム球団の選手から、
  // つながり件数の多い順に選出（球団固有のキャッチコピーは用意せず、実際の小話をそのまま見せる）
  function computeHomeTrivia() {
    var list = PLAYERS.filter(function (p) { return p.currentTeamName === state.homeTeam && p.episodes && p.episodes.length; });
    list.sort(function (a, b) { return relationsFor(b.id).length - relationsFor(a.id).length || a.number - b.number; });
    return list.slice(0, 4);
  }

  // ニュース1件分のカード。見出し・本文中の選手名は自動でリンク化されます
  function newsCardHtml(n) {
    var tc = teamColor(n.teamName);
    return (
      '<div class="news-card">' +
        '<div class="news-card-head">' +
          '<span class="news-team-pill" style="background:' + tc.bg + ";color:" + tc.fg + ';">' + esc(n.teamName) + "</span>" +
          '<span class="news-date">' + esc(n.date.replace(/-/g, "/")) + "</span>" +
        "</div>" +
        '<p class="news-headline">' + linkifyMentions(n.headline, null) + "</p>" +
        '<p class="news-summary">' + linkifyMentions(n.summary, null) + "</p>" +
        '<a class="news-source-link" href="' + esc(n.source) + '" target="_blank" rel="noopener noreferrer">' + icon("arrowRight", 10) + "出典を見る</a>" +
      "</div>"
    );
  }

  // ホーム球団のニュース／全球団のニュースを切り替えて表示する（実データのみ）。
  // state.newsScope が "team" ならホーム球団の分だけ、"all" なら全球団を新着順で表示する。
  // ホーム球団を変更すると（setHomeTeamで再描画がかかるため）自動的にその新しい球団の
  // ニュースに切り替わる（＝スコープの状態自体は保持したまま、中身が追従する）。
  function newsSectionHtml() {
    function byDateDesc(a, b) { return a.date > b.date ? -1 : a.date < b.date ? 1 : 0; }
    var scope = state.newsScope === "all" ? "all" : "team";
    var list;
    if (scope === "team") {
      list = NEWS.filter(function (n) { return n.teamName === state.homeTeam; }).sort(byDateDesc).slice(0, 6);
    } else {
      list = NEWS.slice().sort(byDateDesc).slice(0, 8);
    }
    var switcher =
      '<div class="mode-switch news-scope-switch">' +
        '<button data-action="set-news-scope" data-key="team" class="' + (scope === "team" ? "active" : "") + '">' + esc(state.homeTeam) + "</button>" +
        '<button data-action="set-news-scope" data-key="all" class="' + (scope === "all" ? "active" : "") + '">全体</button>' +
      "</div>";
    var body = list.length
      ? '<div class="news-list">' + list.map(newsCardHtml).join("") + "</div>"
      : '<p class="empty-state">' + esc(scope === "team" ? state.homeTeam + "の最新ニュースは現在ありません。" : "最新ニュースは現在ありません。") + "</p>";
    if (!list.length && scope === "team" && !NEWS.length) return ""; // ニュースデータ自体が全く無い場合はセクションごと非表示
    return (
      '<section class="home-section">' +
        '<p class="section-label">' + icon("clipboard", 13) + "最新ニュース（年俸・移籍・故障など）</p>" +
        switcher +
        body +
      "</section>"
    );
  }

  // 「本日の先発」対戦カード（api/lineup.js取得分＝NPB公式サイトで確定した本日のスタメンから
  // 抜き出した先発投手）。ホーム球団・今日の実際の対戦相手、両方の「今日・発表済み」の
  // 先発が揃っている場合のみ表示する（試合前日の予告段階では出ない。その代わり確度が高い）。
  function renderStarterCard() {
    if (!TODAY_STARTER_HOME || !TODAY_STARTER_AWAY) return "";
    var game = nextGameFor(state.homeTeam);
    if (!game || !game.opponent) return "";
    var homeTc = teamColor(state.homeTeam);
    var awayTc = teamColor(game.opponent);

    function sideHtml(teamName, tc, info) {
      var statsLine = "";
      var cs = info.player && info.player.currentStats;
      if (cs && cs.wins != null && cs.losses != null) {
        statsLine = '<p class="starter-record">' + cs.wins + "勝" + cs.losses + "敗" +
          (cs.eraDisplay ? '<span class="starter-era">防御率' + esc(cs.eraDisplay) + "</span>" : "") +
        "</p>";
      }
      return (
        '<div class="starter-team" style="background:' + tc.bg + ";color:" + tc.fg + ';">' +
          '<span class="starter-team-name">' + esc(teamName) + "</span>" +
          '<p class="starter-pitcher">' + esc(info.pitcherName) + "</p>" +
          statsLine +
        "</div>"
      );
    }

    var meta = game.venue
      ? '<p class="starter-meta">' + icon("mapPin", 10) + esc(game.dateDisplay + "・" + game.venue) + "</p>"
      : "";

    return (
      '<section class="home-section">' +
        '<p class="section-label">' + icon("clipboard", 13) + "本日の先発（NPB公式サイトの確定スタメンより）</p>" +
        '<div class="starter-card">' +
          sideHtml(state.homeTeam, homeTc, TODAY_STARTER_HOME) +
          '<span class="starter-vs">VS</span>' +
          sideHtml(game.opponent, awayTc, TODAY_STARTER_AWAY) +
        "</div>" +
        meta +
      "</section>"
    );
  }

  // リーグ順位表・チーム成績（api/standings.js取得分）。セ・パ両リーグを表示し、
  // ホーム球団の行を強調する。横幅が狭い端末でも列が潰れないよう、テーブルは横スクロール可にしてある。
  function renderStandingsSection() {
    if (!STANDINGS_DATA || !STANDINGS_DATA.leagues) return "";
    var leagues = [
      { key: "central", label: "セントラル・リーグ", teams: STANDINGS_DATA.leagues.central },
      { key: "pacific", label: "パシフィック・リーグ", teams: STANDINGS_DATA.leagues.pacific },
    ];

    function fmtPct(v) { return v == null ? "―" : v.toFixed(3).replace(/^0/, ""); }
    function fmtGb(v) { return v == null ? "―" : (v === 0 ? "首位" : v.toFixed(1)); }

    var blocks = leagues.map(function (lg) {
      if (!lg.teams || !lg.teams.length) return "";
      var rows = lg.teams.map(function (t) {
        var isHome = t.team === state.homeTeam;
        var tc = teamColor(t.team);
        return (
          '<div class="standings-row' + (isHome ? " standings-row-home" : "") + '">' +
            '<span class="st-rank">' + t.rank + "</span>" +
            '<span class="st-team"><span class="st-team-dot" style="background:' + tc.bg + ';"></span>' + esc(t.team) + "</span>" +
            '<span class="st-num">' + (t.wins != null ? t.wins : "―") + "</span>" +
            '<span class="st-num">' + (t.losses != null ? t.losses : "―") + "</span>" +
            '<span class="st-num">' + (t.draws != null ? t.draws : "―") + "</span>" +
            '<span class="st-num">' + fmtPct(t.winPct) + "</span>" +
            '<span class="st-num">' + fmtGb(t.gamesBehind) + "</span>" +
            '<span class="st-num">' + (t.teamAvg != null ? fmtPct(t.teamAvg) : "―") + "</span>" +
            '<span class="st-num">' + (t.teamEra != null ? t.teamEra.toFixed(2) : "―") + "</span>" +
          "</div>"
        );
      }).join("");
      return (
        '<div class="standings-block">' +
          '<p class="standings-league-label">' + esc(lg.label) + "</p>" +
          '<div class="standings-table">' +
            '<div class="standings-row standings-head">' +
              '<span class="st-rank">順位</span><span class="st-team">チーム</span>' +
              '<span class="st-num">勝</span><span class="st-num">敗</span><span class="st-num">分</span>' +
              '<span class="st-num">勝率</span><span class="st-num">差</span>' +
              '<span class="st-num">打率</span><span class="st-num">防御率</span>' +
            "</div>" +
            rows +
          "</div>" +
        "</div>"
      );
    }).join("");

    if (!blocks) return "";
    return (
      '<section class="home-section">' +
        '<p class="section-label">' + icon("trophy", 13) + "リーグ順位表・チーム成績</p>" +
        blocks +
      "</section>"
    );
  }

  function renderHome() {
    var game = nextGameFor(state.homeTeam);
    var homeIds = PLAYERS.filter(function (p) { return p.currentTeamName === state.homeTeam; }).map(function (p) { return p.id; });
    var homeRelationsCount = RELATIONS.filter(function (r) {
      return homeIds.indexOf(r.fromPlayerId) !== -1 || homeIds.indexOf(r.toPlayerId) !== -1;
    }).length;

    var heroTop, heroMeta, heroLead;
    if (game) {
      var days = daysUntil(game.date);
      var countdownText = days > 0 ? "あと" + days + "日" : (days === 0 ? "本日開催！" : "開催済み");
      var homeAwayLabel = game.home ? "本拠地開催" : "ビジター";
      heroTop = '<p class="hero-eyebrow">NEXT GAME</p><p class="hero-matchup">' + esc(state.homeTeam) + ' <span class="vs">vs</span> ' + esc(game.opponent) + "</p>";
      // 天気は「この試合の球場・日付」向けに取得できたデータの場合のみ表示する（球団切り替え直後や
      // 日程更新直後は取得中でまだ無いこともあるが、その場合は単に非表示になるだけでよい）
      var weatherKeyForGame = game.venue && game.date ? (game.venue + "|" + game.date) : null;
      var weatherPill = "";
      if (weatherKeyForGame && WEATHER_KEY === weatherKeyForGame && WEATHER_DATA) {
        if (WEATHER_DATA.isIndoor) {
          weatherPill = '<span class="hero-weather">🏟️ 屋内球場</span>';
        } else if (WEATHER_DATA.success && WEATHER_DATA.daily) {
          weatherPill = '<span class="hero-weather">' + WEATHER_DATA.daily.icon + " " +
            Math.round(WEATHER_DATA.daily.tempMax) + "/" + Math.round(WEATHER_DATA.daily.tempMin) + "℃ 降水" + WEATHER_DATA.daily.precipProbMax + "%</span>";
        }
      }
      heroMeta = '<div class="hero-meta"><span class="hero-date">' + esc(game.dateDisplay) + "</span><span class=\"hero-countdown\">" + esc(countdownText) + "</span>" +
        (game.venue ? '<span class="hero-venue">' + icon("mapPin", 10) + esc(homeAwayLabel) + "・" + esc(game.venue) + "</span>" : "") +
        weatherPill +
        '<button class="hero-date" data-action="fetch-schedule" style="cursor:pointer;border:none;"' + (state.scheduleFetching ? " disabled" : "") + ">" +
          icon("refresh", 10, state.scheduleFetching ? "spin-icon" : "") + (state.scheduleFetching ? "取得中…" : "日程を更新") +
        "</button>" +
        "</div>";
      heroLead = "実際の試合日程です。選手同士のつながりや小話は下のボタンからチェックできます。";
    } else {
      heroTop = '<p class="hero-eyebrow">FEATURED MATCHUP</p><p class="hero-matchup">' + esc(state.homeTeam) + ' <span class="vs">vs</span> ' + esc(state.opponentTeam) + "</p>";
      heroMeta = '<div class="hero-meta"><button class="hero-date" data-action="open-settings" style="cursor:pointer;border:none;">' + icon("network", 11) + " 対戦相手を変更</button></div>";
      heroLead = "応援球団を選ぶと、その球団の選手と対戦相手選手のつながりや小話をチェックできます。";
    }

    // 「見どころ」はホーム球団の公式サイトからの自動取得のため、今のホーム球団向けに取得できた
    // 内容がある場合のみ表示する（非対応球団や取得失敗の場合は自然に非表示になる）
    var highlightsBlock = (HIGHLIGHTS_TEAM === state.homeTeam && HIGHLIGHTS_TEXT)
      ? '<div class="hero-highlights">' +
          '<p class="hero-highlights-label">' + icon("sparkles", 11) + "見どころ</p>" +
          '<p class="hero-highlights-text">' + esc(HIGHLIGHTS_TEXT) + "</p>" +
          '<p class="hero-highlights-source">' + esc(state.homeTeam) + "公式サイトより自動取得</p>" +
        "</div>"
      : "";

    var hero =
      '<div class="hero-card">' +
        heroTop + heroMeta +
        '<p class="hero-lead">' + heroLead + "</p>" +
        highlightsBlock +
        '<div class="hero-cta-row">' +
          '<button class="cta-btn cta-primary" data-action="goto-roster" data-tags="home">' +
            icon("grid", 17) +
            '<span class="cta-text"><span class="cta-title">' + esc(state.homeTeam) + 'の選手を見る</span><span class="cta-sub">名鑑で全選手をチェック</span></span>' +
          "</button>" +
          '<button class="cta-btn cta-outline" data-action="open-connections">' +
            icon("network", 17) +
            '<span class="cta-text"><span class="cta-title">つながり一覧を見る</span><span class="cta-sub">他球団との実在のつながり' + homeRelationsCount + '件</span></span>' +
          "</button>" +
        "</div>" +
      "</div>";

    var starterCard = renderStarterCard();
    var standingsSection = renderStandingsSection();
    var lineupSection = renderLineupHomeSection();

    var triviaPlayers = computeHomeTrivia();
    var trivia = !triviaPlayers.length ? "" :
      '<section class="home-section">' +
        '<p class="section-label">' + icon("sparkles", 13) + "今日の一押しトリビア</p>" +
        '<div class="trivia-list">' +
          triviaPlayers.map(function (p) {
            var ep = (p.episodes && p.episodes[0]) || "";
            var tc = teamColor(p.currentTeamName);
            return (
              '<button class="trivia-card" data-action="open-detail" data-id="' + p.id + '">' +
                avatarHtml(p, 38) +
                '<span class="trivia-body">' +
                  kanaHtml(p, "kana-inline") +
                  '<span class="trivia-names"><b>' + esc(p.name) + '</b> <span class="trivia-team-pill" style="background:' + tc.bg + ";color:" + tc.fg + ';">' + esc(p.currentTeamName) + "</span></span>" +
                  '<span class="trivia-ep">' + esc(ep.length > 54 ? ep.slice(0, 54) + "…" : ep) + "</span>" +
                "</span>" +
                icon("arrowRight", 15, "trivia-arrow") +
              "</button>"
            );
          }).join("") +
        "</div>" +
      "</section>";

    var leaders =
      '<section class="home-section">' +
        '<p class="section-label">' + icon("trophy", 13) + "今季（2026年）成績リーダーズ（NPB全体・規定到達者）</p>" +
        homeLeaderRow("打率", "trophy", "avg", 3, false, function (v) { return v.toFixed(3).replace(/^0/, ""); }) +
        homeLeaderRow("防御率", "trophy", "era", 3, true, function (v) { return v.toFixed(2); }) +
        homeLeaderRow("本塁打", "trophy", "hr", 3, false, function (v) { return v + "本"; }) +
      "</section>";

    var news = newsSectionHtml();

    var quickLinkItems = [
      '<button class="quick-link-card" data-action="goto-roster" data-tags="local">' + icon("mapPin", 16) + "<span>" + esc(getTeam(state.homeTeam).regionLabel) + "ゆかりの選手</span></button>"
    ];
    if (state.homeTeam === "楽天") {
      quickLinkItems.push('<button class="quick-link-card" data-action="goto-roster" data-tags="killer">' + icon("alertTriangle", 16) + "<span>楽天キラーを警戒</span></button>");
    }
    quickLinkItems.push('<button class="quick-link-card" data-action="goto-roster" data-tags="school">' + icon("users", 16) + "<span>学校の先輩後輩</span></button>");
    var quickLinks =
      '<section class="home-section">' +
        '<div class="quick-link-row">' + quickLinkItems.join("") + "</div>" +
      "</section>";

    var footer =
      '<section class="home-section home-footnote">' +
        '<p><strong>データについて：</strong>' + esc(DATA_AS_OF) + "。NPB公式記録・球団公式サイト・報道をもとに、実在の選手の実際の記録・エピソードのみを掲載しています（架空の設定は含みません）。未確認の項目は「情報未確認」と表示しています。" +
        "アイコンはすべて選手を模したイラスト表現で、実際の顔写真ではありません。全12球団" + PLAYERS.length + "名を掲載しています（直近1年以内に一軍出場実績のある選手を中心に収録。育成選手や出場実績のない選手など、支配下選手全員を完全網羅するものではありません）。" +
        "「対戦相手（つながり表示用）」は、ホーム球団の実際の次の試合の相手を自動で表示しています。設定から別の球団に変更して、つながりを探すこともできます。" +
        "試合日程・今季成績・ニュースは週1回、自動で調べ直して更新しています。通信量を抑えるため端末内に最大6時間キャッシュしているので、それより早く最新化したいときは右上の" + icon("refresh", 11) + "更新ボタンをタップしてください。" + "</p>" +
        '<p>右上の' + icon("settings", 11) + '設定ボタンから、いつでも応援球団を切り替えられます。</p>' +
      "</section>";

    els.main.innerHTML = '<div class="home-wrap">' + hero + starterCard + lineupSection + standingsSection + trivia + leaders + news + quickLinks + footer + "</div>";
    els.countPill.textContent = PLAYERS.length + "名";
  }

  /* ===================== Render: bottom nav ===================== */
  function renderBottomNav() {
    Array.prototype.forEach.call(els.bottomNav.querySelectorAll("button"), function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === state.tab);
    });
  }

  /* ===================== Render: overlay (detail sheet) ===================== */
  function statsRows(p) {
    var pitcher = isPitcher(p);
    var cur = p.currentStats || {}, last = p.lastSeasonStats || {};
    if (pitcher) {
      return [
        ["防御率", cur.eraDisplay, last.eraDisplay],
        ["登板", cur.games, last.games],
        ["勝利", cur.wins, last.wins],
        ["敗戦", cur.losses, last.losses],
        ["セーブ", cur.saves, last.saves],
        ["奪三振", cur.strikeouts, last.strikeouts]
      ];
    }
    return [
      ["打率", cur.avgDisplay, last.avgDisplay],
      ["試合数", cur.games, last.games],
      ["本塁打", cur.hr, last.hr],
      ["打点", cur.rbi, last.rbi],
      ["OPS", cur.ops != null ? cur.ops.toFixed(3) : null, last.ops != null ? last.ops.toFixed(3) : null],
      ["盗塁", cur.stolenBases, last.stolenBases]
    ];
  }

  function salaryPanelHtml(p) {
    if (p.salaryManYen == null && !p.salaryNote) return "";
    return (
      '<section><p class="section-label">' + icon("trophy", 13) + "推定年俸</p><div class=\"panel salary-panel\">" +
        '<span class="salary-amount">' + esc(formatSalary(p.salaryManYen)) + "</span>" +
        (p.salaryNote ? '<span class="salary-note">' + esc(p.salaryNote) + "</span>" : "") +
      "</div></section>"
    );
  }

  function awardsPanelHtml(p) {
    if (!p.awards || !p.awards.length) return "";
    var chips = p.awards.map(function (a) {
      return '<span class="award-chip"><span class="award-year">' + esc(a.year) + "</span>" + esc(a.title) + "</span>";
    }).join("");
    return (
      '<section><p class="section-label">' + icon("trophy", 13) + "受賞歴</p><div class=\"panel award-panel\">" +
        '<div class="award-chip-row">' + chips + "</div>" +
      "</div></section>"
    );
  }

  function connectionsHtml(p) {
    var related = getRelatedPlayers(p.id);
    if (!related.length) {
      return (
        '<section><p class="section-label">' + icon("network", 13) + "他球団とのつながり</p>" +
        '<p class="empty-state" style="padding:18px 0;">現時点で確認できているつながりはありません。</p></section>'
      );
    }
    var relList = related.map(function (r) {
      var tc = teamColor(r.player.currentTeamName);
      // 注意：このカード自体がクリック可能な要素（つながり先選手の詳細を開く）なので、
      // 説明文中の選手名を linkifyMentions で <button> リンクにすると、クリック可能要素の
      // 入れ子（invalid nesting）になりブラウザがカードのHTML構造を壊してしまう
      // （カード内で選手名が出た瞬間に外側の要素が閉じられ、以降のテキストがカード外に
      // はみ出して表示される不具合が実際に発生した）。そのため<button>ではなく<div>＋
      // data-action属性（クリックはイベント委譲で処理されるためタグ種類は問わない）を使う。
      // また selfId には p.id（このカードを表示している選手自身）を渡し、説明文中で
      // 自分自身の名前が出てきても「自分自身の詳細ページへのリンク」という無意味なリンクには
      // しないようにしている。
      return (
        '<div class="rel-card" role="button" tabindex="0" data-action="open-detail" data-id="' + r.player.id + '">' +
          avatarHtml(r.player, 36) +
          '<span class="rel-card-body">' +
            kanaHtml(r.player, "kana-inline") +
            '<span style="font-size:13px;font-weight:800;">' + esc(r.player.name) + '</span> ' +
            '<span class="rel-team-pill" style="background:' + tc.bg + ";color:" + tc.fg + ';">' + esc(r.player.currentTeamName) + " #" + r.player.number + "</span><br>" +
            '<span class="rel-type-pill" style="background:' + RELATION_COLORS[r.relation.type] + '">' + RELATION_LABELS[r.relation.type] + "</span>" +
            '<p class="rel-desc">' + linkifyMentions(r.relation.description, p.id) + "</p>" +
          "</span>" +
        "</div>"
      );
    }).join("");
    return (
      '<section><p class="section-label">' + icon("network", 13) + "他球団とのつながり</p>" +
      '<p class="network-intro">学校の先輩後輩・自主トレ仲間・対戦成績など、実際に確認できたつながりです。</p>' +
      relList + "</section>"
    );
  }

  function relationPeopleRowHtml(r) {
    var from = byId(r.fromPlayerId);
    var to = byId(r.toPlayerId);
    if (!from || !to) return "";
    var tcFrom = teamColor(from.currentTeamName);
    var tcTo = teamColor(to.currentTeamName);
    return (
      '<div class="relpair-people">' +
        '<button class="relpair-person" data-action="open-detail" data-id="' + from.id + '">' +
          avatarHtml(from, 42) +
          kanaHtml(from) +
          '<span class="relpair-nm">' + esc(from.name) + "</span>" +
          '<span class="relpair-team" style="background:' + tcFrom.bg + ";color:" + tcFrom.fg + ';">' + esc(from.currentTeamName) + "</span>" +
        "</button>" +
        '<span class="relpair-link">' + icon("network", 15) + "</span>" +
        '<button class="relpair-person" data-action="open-detail" data-id="' + to.id + '">' +
          avatarHtml(to, 42) +
          kanaHtml(to) +
          '<span class="relpair-nm">' + esc(to.name) + "</span>" +
          '<span class="relpair-team" style="background:' + tcTo.bg + ";color:" + tcTo.fg + ';">' + esc(to.currentTeamName) + "</span>" +
        "</button>" +
      "</div>"
    );
  }

  function relationPairCardHtml(r) {
    var body = relationPeopleRowHtml(r);
    if (!body) return "";
    return (
      '<div class="relpair-card">' +
        body +
        '<span class="rel-type-pill" style="background:' + RELATION_COLORS[r.type] + '">' + RELATION_LABELS[r.type] + "</span>" +
        '<p class="rel-desc">' + linkifyMentions(r.description, null) + "</p>" +
      "</div>"
    );
  }

  function matchupCardHtml(r) {
    var from = byId(r.fromPlayerId), to = byId(r.toPlayerId);
    var body = relationPeopleRowHtml(r);
    if (!from || !to || !body) return "";
    return (
      '<div class="relpair-card matchup-card">' +
        '<p class="matchup-title">' + icon("sparkles", 12) + "今日の注目対決：" + esc(from.name) + " ✕ " + esc(to.name) + "（" + RELATION_LABELS[r.type] + "）</p>" +
        body +
        '<p class="rel-desc">' + linkifyMentions(r.description, null) + "</p>" +
      "</div>"
    );
  }

  function highlightCardHtml(h) {
    var p = h.player;
    var tc = teamColor(p.currentTeamName);
    return (
      '<button class="relpair-card highlight-card" data-action="open-detail" data-id="' + p.id + '">' +
        '<div class="highlight-row">' +
          avatarHtml(p, 40) +
          '<span class="highlight-body">' +
            '<span class="highlight-nm">' + esc(p.name) + ' <span class="rel-team-pill" style="background:' + tc.bg + ";color:" + tc.fg + ';">' + esc(p.currentTeamName) + "</span></span>" +
            '<span class="highlight-text">' + esc(h.text) + "</span>" +
          "</span>" +
        "</div>" +
      "</button>"
    );
  }

  function connectionsOverlayHtml() {
    var homeIds = PLAYERS.filter(function (p) { return p.currentTeamName === state.homeTeam; }).map(function (p) { return p.id; });
    var homeRelations = RELATIONS.filter(function (r) {
      return homeIds.indexOf(r.fromPlayerId) !== -1 || homeIds.indexOf(r.toPlayerId) !== -1;
    });
    var vsOpp = homeRelations.filter(function (r) {
      var otherId = homeIds.indexOf(r.fromPlayerId) !== -1 ? r.toPlayerId : r.fromPlayerId;
      var other = byId(otherId);
      return other && other.currentTeamName === state.opponentTeam;
    });
    var others = homeRelations.filter(function (r) { return vsOpp.indexOf(r) === -1; });

    var vsHtml = vsOpp.length
      ? '<section><p class="section-label">' + icon("mapPin", 13) + esc(state.opponentTeam) + "とのつながり（" + vsOpp.length + "件）</p>" +
        vsOpp.map(relationPairCardHtml).join("") + "</section>"
      : "";
    var othersHtml = others.length
      ? '<section><p class="section-label">' + icon("network", 13) + "その他球団とのつながり（" + others.length + "件）</p>" +
        others.map(relationPairCardHtml).join("") + "</section>"
      : "";
    var emptyHtml = (!vsHtml && !othersHtml)
      ? '<p class="empty-state" style="padding:24px 0;">現時点で確認できているつながりはありません。</p>' : "";

    return (
      '<div class="sheet-header">' +
        '<div class="who"><span class="sheet-icon-badge">' + icon("network", 20) + "</span><span>" +
          '<p class="sub">' + esc(state.homeTeam) + "選手 × 他球団選手</p><p class=\"nm\">つながり一覧</p>" +
        "</span></div>" +
        '<button class="sheet-close" data-action="close-overlay" aria-label="閉じる">' + icon("x", 18) + "</button>" +
      "</div>" +
      '<div class="sheet-body">' +
        '<p class="network-intro">学校の先輩後輩・自主トレ仲間・対戦成績など、' + esc(state.homeTeam) + '選手と他球団選手の間で実際に確認できているつながりです。カードをタップすると、その選手の詳細ページを開きます。</p>' +
        vsHtml + othersHtml + emptyHtml +
      "</div>"
    );
  }

  function lineupSlotRowHtml(side, kind, index, playerId, label) {
    var p = playerId ? byId(playerId) : null;
    var dataIndex = index == null ? "" : index;
    if (!p) {
      return (
        '<button class="lineup-slot lineup-slot-empty" data-action="pick-lineup-slot" data-side="' + side + '" data-kind="' + kind + '" data-index="' + dataIndex + '">' +
          '<span class="lineup-slot-num">' + label + "</span>" +
          '<span class="lineup-slot-placeholder">' + icon("grid", 14) + "選手を選択</span>" +
        "</button>"
      );
    }
    return (
      '<div class="lineup-slot lineup-slot-filled">' +
        '<span class="lineup-slot-num">' + label + "</span>" +
        '<button class="lineup-slot-player" data-action="pick-lineup-slot" data-side="' + side + '" data-kind="' + kind + '" data-index="' + dataIndex + '">' +
          avatarHtml(p, 32) +
          '<span class="lineup-slot-nm">' + esc(p.name) + '<span class="lineup-slot-pos">' + esc(p.detailedPosition) + "</span></span>" +
        "</button>" +
        '<button class="lineup-slot-remove" data-action="clear-lineup-slot" data-side="' + side + '" data-kind="' + kind + '" data-index="' + dataIndex + '" aria-label="この枠をクリア">' + icon("x", 14) + "</button>" +
      "</div>"
    );
  }

  function diamondFieldHtml(side) {
    autoAssignPositions(side);
    var L = state.lineup[side];
    var markers = POSITION_DEFS.map(function (d) {
      var pos = POSITION_LAYOUT[d.key];
      var style = "left:" + pos.left + "%;top:" + pos.top + "%;";
      var playerId = L.positions[d.key];
      var p = playerId ? byId(playerId) : null;
      if (!p) {
        return (
          '<button class="diamond-spot diamond-spot-empty" style="' + style + '" data-action="pick-lineup-position" data-side="' + side + '" data-key="' + d.key + '">' +
            '<span class="diamond-spot-label">' + esc(d.label.slice(0, 2)) + "</span>" +
          "</button>"
        );
      }
      return (
        '<button class="diamond-spot diamond-spot-filled" style="' + style + '" data-action="pick-lineup-position" data-side="' + side + '" data-key="' + d.key + '">' +
          avatarHtml(p, 38) +
          '<span class="diamond-spot-nm">' + esc((p.name || "").split(" ")[0]) + "</span>" +
        "</button>"
      );
    }).join("");
    var unassigned = unassignedBatters(side);
    var dhNote = unassigned.length
      ? '<p class="diamond-dh-note">' + (unassigned.length === 1 ? "DH：" : "守備位置未設定：") +
        unassigned.map(function (p) { return esc(p.name); }).join("、") + "（タップで守備位置に配置できます）</p>"
      : "";
    return '<div class="diamond-field">' + markers + "</div>" + dhNote;
  }

  function lineupSheetBodyHtml(side, teamLabel) {
    if (state.lineupView === "defense") {
      return (
        '<p class="network-intro">気になる選手の守備位置をタップすると誰が守っているかすぐ分かります。空欄はプロフィールの守備位置から自動で仮配置され、タップして修正できます。</p>' +
        diamondFieldHtml(side)
      );
    }
    var L = state.lineup[side];
    var rows = [lineupSlotRowHtml(side, "pitcher", null, L.pitcher, "先発")];
    for (var i = 0; i < 9; i++) rows.push(lineupSlotRowHtml(side, "batter", i, L.batters[i], (i + 1) + "番"));
    return (
      '<p class="network-intro">' + esc(teamLabel) + "の打順（1〜9番）と先発投手をタップして登録すると、登録した選手同士の実在のつながりを自動でチェックします。</p>" +
      '<div class="lineup-slot-list">' + rows.join("") + "</div>" +
      '<button class="lineup-clear-btn" data-action="clear-lineup-side" data-side="' + side + '">' + esc(teamLabel) + "のスタメンをクリア</button>"
    );
  }

  // 打線比較1マス分の表示（stats: [{text, better}] の配列。better=trueのものだけ強調表示）
  function compareStatRow(stats) {
    return stats.map(function (s) {
      return '<span' + (s.better ? ' class="cbetter"' : "") + '>' + esc(s.text) + "</span>";
    }).join("");
  }
  function compareCardHtml(p, stats) {
    if (!p) {
      return '<div class="compare-side compare-empty"><span class="compare-nm-wrap"><span class="compare-nm">未登録</span></span></div>';
    }
    return (
      '<button class="compare-side" data-action="open-detail" data-id="' + p.id + '">' +
        avatarHtml(p, 28) +
        '<span class="compare-nm-wrap">' +
          '<span class="compare-nm">' + esc(p.name) + "</span>" +
          '<span class="compare-stats">' + compareStatRow(stats) + "</span>" +
        "</span>" +
      "</button>"
    );
  }
  function battingCompareRowHtml(index, label) {
    var hp = state.lineup.home.batters[index] ? byId(state.lineup.home.batters[index]) : null;
    var op = state.lineup.opponent.batters[index] ? byId(state.lineup.opponent.batters[index]) : null;
    var hs = (hp && hp.currentStats) || {}, os = (op && op.currentStats) || {};
    var hAvg = hp && hs.avg != null ? hs.avg : null, oAvg = op && os.avg != null ? os.avg : null;
    var hHr = hp && hs.hr != null ? hs.hr : null, oHr = op && os.hr != null ? os.hr : null;
    var hOps = hp && hs.ops != null ? hs.ops : null, oOps = op && os.ops != null ? os.ops : null;
    var hVals = [
      { text: (hp ? (hs.avgDisplay || "-") : "-"), better: hAvg != null && (oAvg == null || hAvg > oAvg) },
      { text: (hp ? (hHr != null ? hHr + "本" : "-") : "-"), better: hHr != null && (oHr == null || hHr > oHr) },
      { text: (hp ? (hOps != null ? hOps.toFixed(3) : "-") : "-"), better: hOps != null && (oOps == null || hOps > oOps) }
    ];
    var oVals = [
      { text: (op ? (os.avgDisplay || "-") : "-"), better: oAvg != null && (hAvg == null || oAvg > hAvg) },
      { text: (op ? (oHr != null ? oHr + "本" : "-") : "-"), better: oHr != null && (hHr == null || oHr > hHr) },
      { text: (op ? (oOps != null ? oOps.toFixed(3) : "-") : "-"), better: oOps != null && (hOps == null || oOps > hOps) }
    ];
    return (
      '<div class="compare-row">' +
        compareCardHtml(hp, hVals) +
        '<span class="compare-num">' + label + "</span>" +
        compareCardHtml(op, oVals) +
      "</div>"
    );
  }
  function pitcherCompareRowHtml() {
    var hp = state.lineup.home.pitcher ? byId(state.lineup.home.pitcher) : null;
    var op = state.lineup.opponent.pitcher ? byId(state.lineup.opponent.pitcher) : null;
    var hs = (hp && hp.currentStats) || {}, os = (op && op.currentStats) || {};
    var hEra = hp && hs.era != null ? hs.era : null, oEra = op && os.era != null ? os.era : null;
    var hWins = hp && hs.wins != null ? hs.wins : null, oWins = op && os.wins != null ? os.wins : null;
    var hVals = [
      { text: (hp ? (hs.eraDisplay || "-") : "-"), better: hEra != null && (oEra == null || hEra < oEra) },
      { text: (hp ? (hWins != null ? hWins + "勝" + (hs.losses != null ? hs.losses : "-") + "敗" : "-") : "-"), better: hWins != null && (oWins == null || hWins > oWins) }
    ];
    var oVals = [
      { text: (op ? (os.eraDisplay || "-") : "-"), better: oEra != null && (hEra == null || oEra < hEra) },
      { text: (op ? (oWins != null ? oWins + "勝" + (os.losses != null ? os.losses : "-") + "敗" : "-") : "-"), better: oWins != null && (hWins == null || oWins > hWins) }
    ];
    return (
      '<div class="compare-row">' +
        compareCardHtml(hp, hVals) +
        '<span class="compare-num">先発</span>' +
        compareCardHtml(op, oVals) +
      "</div>"
    );
  }
  // 登録済み打者（実際に打順へ入力された選手のみ）の平均OPS・本塁打合計を球団ごとに集計
  function lineupCompareSummaryHtml() {
    function sumStats(side) {
      var players = state.lineup[side].batters.filter(Boolean).map(byId).filter(Boolean);
      var opsVals = players.map(function (p) { return p.currentStats && p.currentStats.ops; }).filter(function (v) { return v != null; });
      var hrSum = players.reduce(function (sum, p) { return sum + ((p.currentStats && p.currentStats.hr != null) ? p.currentStats.hr : 0); }, 0);
      var avgOps = opsVals.length ? (opsVals.reduce(function (a, b) { return a + b; }, 0) / opsVals.length) : null;
      return { count: players.length, avgOps: avgOps, hrSum: hrSum };
    }
    var h = sumStats("home"), o = sumStats("opponent");
    if (!h.count && !o.count) return "";
    function sideHtml(teamName, s) {
      var tc = teamColor(teamName);
      return (
        '<span class="compare-summary-side">' +
          '<span class="compare-summary-team" style="background:' + tc.bg + ";color:" + tc.fg + ';">' + esc(teamName) + "</span>" +
          '<span class="compare-summary-val">' + (s.avgOps != null ? s.avgOps.toFixed(3) : "-") + "</span>" +
          '<span class="compare-summary-lbl">登録打者' + s.count + "人・平均OPS<br>本塁打計" + s.hrSum + "本</span>" +
        "</span>"
      );
    }
    return (
      '<div class="compare-summary">' +
        sideHtml(state.homeTeam, h) +
        '<span class="compare-summary-vs">VS</span>' +
        sideHtml(state.opponentTeam, o) +
      "</div>"
    );
  }
  function lineupComparisonHtml() {
    var rows = [pitcherCompareRowHtml()];
    for (var i = 0; i < 9; i++) rows.push(battingCompareRowHtml(i, (i + 1) + "番"));
    return (
      '<p class="network-intro">登録した両チームのスタメンを、打率・本塁打・OPS（投手は防御率・勝敗）で見比べられます。数値が良い方をハイライト表示しています（実際に登録済みの選手・成績データのみで比較しています）。</p>' +
      lineupCompareSummaryHtml() +
      '<div class="compare-list">' + rows.join("") + "</div>"
    );
  }

  // 打順/守備位置ダイヤモンド図/打線比較の切り替えボタン部分だけを個別に再生成できるよう分離
  // （タブのactive状態だけ差し替えられるようにするため）
  function lineupViewTabsHtml() {
    var isCompare = state.lineupView === "compare";
    return (
      '<button class="lineup-view-btn' + (state.lineupView === "order" ? " active" : "") + '" data-action="set-lineup-view" data-key="order">' + icon("clipboard", 13) + "打順</button>" +
      '<button class="lineup-view-btn' + (state.lineupView === "defense" ? " active" : "") + '" data-action="set-lineup-view" data-key="defense">' + icon("mapPin", 13) + "この選手誰？</button>" +
      '<button class="lineup-view-btn' + (isCompare ? " active" : "") + '" data-action="set-lineup-view" data-key="compare">' + icon("trophy", 13) + "打線比較</button>"
    );
  }

  function lineupFetchBtnHtml(side) {
    var fetching = state.lineupFetching === side;
    return (
      '<button class="lineup-fetch-btn" data-action="fetch-today-lineup" data-side="' + side + '"' + (fetching ? " disabled" : "") + '>' +
        icon("download", 13, fetching ? "spin-icon" : "") +
        (fetching ? "取得中…" : "今日のスタメンを取得") +
      "</button>"
    );
  }

  function lineupFetchNoticeHtml() {
    var n = state.lineupFetchNotice;
    if (!n) return "";
    var cls = n.type === "error" ? "is-error" : (n.type === "alert" ? "is-alert" : (n.type === "warning" ? "is-warning" : "is-success"));
    var iconName = n.type === "success" ? "check" : "alertTriangle";
    return (
      '<p class="lineup-fetch-notice ' + cls + '">' +
        icon(iconName, 13) + esc(n.message) +
      "</p>"
    );
  }

  // sheet-header（閉じるボタン等）を含まない、打順登録シートの中身だけを返す。
  // 「打順⇄守備位置⇄打線比較」の切替時や対戦チーム切替時は、このinnerHTMLだけを
  // 差し替えることで、シート全体（オーバーレイのスクリム・クリックリスナー等）を
  // 毎回作り直さずに済ませる（不要なDOM再構築・リフローを避けるための最適化）。
  function lineupBodyContentHtml(side, teamLabel, isCompare) {
    return (
      (isCompare ? "" :
        '<div class="detail-tabs">' +
          '<button class="detail-tab-btn' + (side === "home" ? " active" : "") + '" data-action="set-lineup-side" data-side="home">' + esc(state.homeTeam) + "（" + lineupFilledCount("home") + "/10）</button>" +
          '<button class="detail-tab-btn' + (side === "opponent" ? " active" : "") + '" data-action="set-lineup-side" data-side="opponent">' + esc(state.opponentTeam) + "（" + lineupFilledCount("opponent") + "/10）</button>" +
        "</div>" +
        '<div class="lineup-fetch-row">' + lineupFetchBtnHtml(side) + "</div>" +
        lineupFetchNoticeHtml()
      ) +
      '<div class="lineup-view-tabs">' + lineupViewTabsHtml() + "</div>" +
      (isCompare ? lineupComparisonHtml() : lineupSheetBodyHtml(side, teamLabel))
    );
  }

  function lineupListHtml() {
    var side = state.lineupSide === "opponent" ? "opponent" : "home";
    var teamLabel = side === "home" ? state.homeTeam : state.opponentTeam;
    var isCompare = state.lineupView === "compare";

    return (
      '<div class="sheet-header">' +
        '<div class="who"><span class="sheet-icon-badge">' + icon("clipboard", 20) + "</span><span>" +
          '<p class="sub">両チームの打順・守備位置を登録</p><p class="nm">本日のスタメン登録</p>' +
        "</span></div>" +
        '<button class="sheet-close" data-action="close-overlay" aria-label="閉じる">' + icon("x", 18) + "</button>" +
      "</div>" +
      '<div class="sheet-body" id="lineup-sheet-body">' + lineupBodyContentHtml(side, teamLabel, isCompare) + "</div>"
    );
  }

  // 打順シートを開いた状態のまま、表示内容（打順/守備位置/打線比較・対戦チーム切替）だけを
  // 更新する軽量パス。シートが開いていない場合は通常通りrenderOverlay()にフォールバックする。
  function patchLineupBody() {
    var bodyEl = document.getElementById("lineup-sheet-body");
    if (!bodyEl || !state.overlay || state.overlay.type !== "lineup" || state.lineupPicker) { renderOverlay(); return; }
    var side = state.lineupSide === "opponent" ? "opponent" : "home";
    var teamLabel = side === "home" ? state.homeTeam : state.opponentTeam;
    bodyEl.innerHTML = lineupBodyContentHtml(side, teamLabel, state.lineupView === "compare");
  }

  function lineupPickerListHtml(candidates) {
    return candidates.length
      ? candidates.map(function (p) {
          return (
            '<button class="lineup-picker-row" data-action="select-lineup-player" data-id="' + p.id + '">' +
              avatarHtml(p, 36) +
              '<span class="lineup-picker-nm">#' + p.number + " " + esc(p.name) + '<span class="lineup-picker-pos">' + esc(p.detailedPosition) + "</span></span>" +
            "</button>"
          );
        }).join("")
      : '<p class="empty-state" style="padding:18px 0;">該当する選手が見つかりませんでした。</p>';
  }

  function lineupPickerHtml() {
    var picker = state.lineupPicker;
    var teamLabel = picker.side === "home" ? state.homeTeam : state.opponentTeam;
    var isPosition = picker.kind === "position";
    var kindLabel = isPosition
      ? (POSITION_DEFS.filter(function (d) { return d.key === picker.posKey; })[0] || {}).label + "を選択"
      : (picker.kind === "pitcher" ? "先発投手を選択" : (picker.index + 1) + "番打者を選択");
    var candidates = isPosition
      ? lineupPositionCandidates(picker.side, picker.posKey)
      : lineupPickerCandidates(picker.side, picker.kind, picker.index);
    var hasCurrent = isPosition && state.lineup[picker.side].positions[picker.posKey];
    var clearBtn = hasCurrent
      ? '<button class="lineup-position-clear-btn" data-action="clear-lineup-position" data-side="' + picker.side + '" data-key="' + picker.posKey + '">この守備位置の登録をクリア</button>'
      : "";

    return (
      '<div class="sheet-header">' +
        '<button class="sheet-back" data-action="close-lineup-picker" aria-label="戻る">' + icon("chevronLeft", 20) + "</button>" +
        '<div class="who"><span><p class="sub">' + esc(teamLabel) + "</p><p class=\"nm\">" + esc(kindLabel) + "</p></span></div>" +
        '<button class="sheet-close" data-action="close-overlay" aria-label="閉じる">' + icon("x", 18) + "</button>" +
      "</div>" +
      '<div class="sheet-body">' +
        '<div class="search-wrap lineup-picker-search">' +
          icon("search", 16, "icon-search") +
          '<input type="search" inputmode="search" id="lineup-picker-input" placeholder="選手名で検索" autocomplete="off" value="' + esc(state.lineupPickerQuery || "") + '">' +
        "</div>" +
        clearBtn +
        '<div class="lineup-picker-list">' + lineupPickerListHtml(candidates) + "</div>" +
      "</div>"
    );
  }

  function lineupOverlayHtml() {
    return state.lineupPicker ? lineupPickerHtml() : lineupListHtml();
  }

  function refreshLineupPickerList() {
    var picker = state.lineupPicker;
    if (!picker) return;
    var listEl = els.overlayRoot.querySelector(".lineup-picker-list");
    if (!listEl) return;
    var candidates = picker.kind === "position"
      ? lineupPositionCandidates(picker.side, picker.posKey)
      : lineupPickerCandidates(picker.side, picker.kind, picker.index);
    listEl.innerHTML = lineupPickerListHtml(candidates);
  }

  /* ===================== Render: 設定シート（ホーム球団・対戦相手） ===================== */
  function teamPickRowHtml(t, isSelected, action) {
    var checkIcon = isSelected ? '<span class="team-pick-check">' + icon("check", 18) + "</span>" : "";
    return (
      '<button class="team-pick-row' + (isSelected ? " active" : "") + '" style="--team-pick-color:' + t.color + ';" data-action="' + action + '" data-key="' + esc(t.name) + '">' +
        '<span class="team-pick-swatch" style="background:' + t.color + ";color:" + t.ink + ';">' + t.emoji + "</span>" +
        '<span class="team-pick-name">' + esc(t.name) + "</span>" +
        checkIcon +
      "</button>"
    );
  }
  function teamPickListHtml(action, selectedName, excludeName) {
    var leagues = [["パ・リーグ", "パ"], ["セ・リーグ", "セ"]];
    return leagues.map(function (lg) {
      var teams = TEAMS.filter(function (t) { return t.league === lg[1] && t.name !== excludeName; });
      return (
        '<p class="league-heading">' + lg[0] + "</p>" +
        '<div class="team-pick-list">' + teams.map(function (t) { return teamPickRowHtml(t, t.name === selectedName, action); }).join("") + "</div>"
      );
    }).join("");
  }

  function settingsHtml() {
    return (
      '<div class="sheet-header">' +
        '<div class="who"><span class="sheet-icon-badge">' + icon("settings", 20) + "</span><span>" +
          '<p class="sub">応援する球団を選んでください</p><p class="nm">設定</p>' +
        "</span></div>" +
        '<button class="sheet-close" data-action="close-overlay" aria-label="閉じる">' + icon("x", 18) + "</button>" +
      "</div>" +
      '<div class="sheet-body">' +
        '<p class="settings-intro">ホーム球団を選ぶと、アプリ全体の配色がその球団カラーに変わります。名鑑の「#ホーム球団の選手」絞り込みや、他球団選手とのつながり表示にも使われます。</p>' +
        '<div class="settings-section-label"><span class="lbl">ホーム球団</span><span class="cur">現在: ' + esc(state.homeTeam) + "</span></div>" +
        teamPickListHtml("set-home-team", state.homeTeam, null) +
        '<div class="settings-section-label"><span class="lbl">対戦相手（つながり表示用）</span><span class="cur">現在: ' + esc(state.opponentTeam) + "</span></div>" +
        teamPickListHtml("set-opponent", state.opponentTeam, state.homeTeam) +
        '<p class="settings-note">対戦相手は、ホーム球団の実際の次の試合の相手（NEXT GAME）を自動で選んでいます。ここから別の球団に変更すると、その組み合わせでつながりやスタメン登録を確認できます（ホーム球団を切り替えると、また実際の次の試合の相手に戻ります）。</p>' +
      "</div>"
    );
  }

  function refreshSettingsIfOpen() {
    if (!state.overlay || state.overlay.type !== "settings") return;
    var sheetEl = els.overlayRoot.querySelector(".sheet");
    if (!sheetEl) return;
    var scrollTop = sheetEl.scrollTop;
    sheetEl.innerHTML = settingsHtml();
    sheetEl.scrollTop = scrollTop;
  }

  function detailHtml(p) {
    var rows = statsRows(p);
    var tc = teamColor(p.currentTeamName);
    var statTable =
      '<table class="stat-table"><thead><tr><th>項目</th><th class="cur">' + esc((p.currentStats && p.currentStats.season) || "今季") + "（今季）</th><th>" + esc((p.lastSeasonStats && p.lastSeasonStats.season) || "前年") + "（前年）</th></tr></thead><tbody>" +
      rows.map(function (r) {
        return "<tr><td class=\"lbl\">" + r[0] + '</td><td class="cur">' + (r[1] != null ? r[1] : "-") + '</td><td class="last">' + (r[2] != null ? r[2] : "-") + "</td></tr>";
      }).join("") + "</tbody></table>";

    var badges = '<span class="badge" style="background:' + tc.bg + ";color:" + tc.fg + ';font-size:11px;padding:4px 9px;">' + esc(p.currentTeamName) + "</span>";
    if (isLocalConnection(p, state.homeTeam)) badges += '<span class="badge tohoku" style="font-size:11px;padding:4px 9px;">' + icon("mapPin", 11) + esc(getTeam(state.homeTeam).regionLabel) + "ゆかり</span>";
    if (state.homeTeam === "楽天" && p.vsRakutenData && p.vsRakutenData.isKiller) badges += '<span class="badge killer" style="font-size:11px;padding:4px 9px;">' + icon("alertTriangle", 11) + "楽天キラー</span>";

    var vsBlock = "";
    if (p.vsRakutenData) {
      vsBlock =
        '<section><p class="section-label">対楽天データ</p><div class="panel">' +
          '<div class="vsdata-head"><span style="font-size:11px;color:var(--ink-faint);">対楽天 ' + (isPitcher(p) ? "防御率" : "打率") + '</span><span class="vsdata-num">' + esc(p.vsRakutenData.avgOrEra) + "</span></div>" +
          '<p class="vsdata-notes">得意・苦手：' + linkifyMentions(p.vsRakutenData.favorablePitcherOrBatter, p.id) + "</p>" +
          '<p class="vsdata-notes">' + linkifyMentions(p.vsRakutenData.notes, p.id) + "</p>" +
        "</div></section>";
    }

    var infoCells = [
      infoCell("生年月日", birthDateInfoValue(p)),
      infoCell("出身地", p.roots.hometown),
      infoCell("ドラフト", p.draftInfo),
      infoCell("投打", p.throwsBats),
      infoCell("出身中学", p.roots.juniorHigh),
      infoCell("シニア/ボーイズ", p.roots.seniorOrBoys),
      infoCell("出身小学校", p.roots.elementarySchool),
      infoCell("少年野球チーム", p.roots.elementaryTeam),
      infoCell("出身高校", p.roots.highSchool),
      infoCell("大学", p.roots.university),
      infoCell("社会人", p.roots.social),
      infoCell("体格", p.height && p.weight ? p.height + "cm / " + p.weight + "kg" : "")
    ].filter(Boolean).join("");
    var infoGrid = '<section><p class="section-label">基本情報 & ルーツ</p><div class="panel info-grid">' + infoCells + "</div></section>";

    var timeline = "";
    if (p.growthTimeline && p.growthTimeline.length) {
      timeline =
        '<section><p class="section-label">成長軌跡（タイムライン）</p><ol class="timeline">' +
          p.growthTimeline.map(function (t) {
            return "<li><p class=\"period\">" + esc(t.period) + '</p><p class="title">' + esc(t.title) + '</p><p class="desc">' + linkifyMentions(t.description, p.id) + "</p></li>";
          }).join("") +
        "</ol></section>";
    }

    var posChain = "";
    if (p.positionHistory && p.positionHistory.length) {
      posChain =
        '<section><p class="section-label">ポジション遷移歴</p><div class="pos-chain">' +
          p.positionHistory.map(function (ph, i) {
            return '<span class="pos-chip">' + esc(ph.position) + '<span class="per">（' + esc(ph.period) + "）</span></span>" +
              (i < p.positionHistory.length - 1 ? '<span class="pos-arrow">→</span>' : "");
          }).join("") +
        '</div><ul class="pos-reasons">' +
          p.positionHistory.filter(function (ph) { return ph.reason; }).map(function (ph) { return "<li>・" + esc(ph.reason) + "</li>"; }).join("") +
        "</ul></section>";
    }

    var episodes =
      '<section><p class="section-label">' + icon("sparkles", 13) + "小話・エピソード</p><div class=\"ep-list\">" +
        (p.episodes && p.episodes.length
          ? p.episodes.map(function (e) { return '<div class="ep-item">' + linkifyMentions(e, p.id) + "</div>"; }).join("")
          : '<div class="ep-item ep-item-empty">この選手の小話は今後のアップデートで追加予定です。</div>') +
      "</div></section>";

    var song = "";
    if (p.walkupSong || p.cheerSongNote || p.cheerSongLyrics) {
      song =
        '<section><p class="section-label">' + icon("music", 13) + "登場曲・応援歌</p><div class=\"panel\">" +
          (p.walkupSong ? '<p class="song-title">' + esc(p.walkupSong.title) + '</p><p class="song-artist">' + esc(p.walkupSong.artist) + "</p>" : "") +
          (p.walkupSong && p.walkupSong.asOfNote ? '<p class="song-note">' + esc(p.walkupSong.asOfNote) + "</p>" : "") +
          (p.cheerSongNote ? '<p class="song-note">' + esc(p.cheerSongNote) + "</p>" : "") +
          // cheerSongLyrics は本データには含まれていません（著作権上の理由）。ユーザー自身がこのファイルを
          // 直接編集して選手データにこのフィールドを追記した場合のみ、そのまま整形して表示します。
          (p.cheerSongLyrics ? '<p class="song-lyrics-label">歌詞（ユーザー入力）</p><p class="song-lyrics">' + esc(p.cheerSongLyrics) + "</p>" : "") +
        "</div></section>";
    }

    // 代表歴・オールスター選出歴は以前からデータ自体は保持していたが、詳細画面のどこにも
    // 表示されていなかった（フィルタタグの判定にしか使われていなかった）。実績が豊富な
    // 選手ほど「情報が薄い」印象につながっていたため、受賞歴と同じ見せ方で追加する。
    var nationalTeamBlock = "";
    if (p.nationalTeamHistory && p.nationalTeamHistory.length) {
      nationalTeamBlock =
        '<section><p class="section-label">' + icon("trophy", 13) + "代表歴</p><div class=\"panel award-panel\">" +
          '<div class="award-chip-row">' +
            p.nationalTeamHistory.map(function (n) {
              return '<span class="award-chip"><span class="award-year">' + esc(n.year) + "</span>" + esc(n.competition) + "</span>";
            }).join("") +
          "</div>" +
        "</div></section>";
    }
    var allStarBlock = "";
    if (p.allStarYears && p.allStarYears.length) {
      allStarBlock =
        '<section><p class="section-label">' + icon("trophy", 13) + "オールスター選出（" + p.allStarYears.length + "回）</p><div class=\"panel award-panel\">" +
          '<div class="award-chip-row">' +
            p.allStarYears.map(function (y) { return '<span class="award-chip" style="padding:5px 11px;">' + esc(y) + "年</span>"; }).join("") +
          "</div>" +
        "</div></section>";
    }

    var dataNoteBlock = p.dataNote
      ? '<section><div class="info-note-panel">' + icon("info", 14) + '<p>' + esc(p.dataNote) + "</p></div></section>"
      : "";

    var careerNote = p.careerSummary ? '<p style="font-size:11px;color:var(--ink-faint);margin:-8px 0 10px;">' + linkifyMentions(p.careerSummary, p.id) + "</p>" : "";

    var tab = state.detailTab === "other" ? "other" : "basic";
    var tabSwitcher =
      '<div class="detail-tabs">' +
        '<button class="detail-tab-btn' + (tab === "basic" ? " active" : "") + '" data-action="set-detail-tab" data-key="basic">基本情報</button>' +
        '<button class="detail-tab-btn' + (tab === "other" ? " active" : "") + '" data-action="set-detail-tab" data-key="other">その他（小話・つながり）</button>' +
      "</div>";

    var basicPane =
      "<section><p class=\"section-label\">今季 ＆ 前年成績比較</p>" + careerNote + statTable + "</section>" +
      similarLegendHintHtml(p) +
      salaryPanelHtml(p) + awardsPanelHtml(p) + nationalTeamBlock + allStarBlock + vsBlock + infoGrid + timeline + posChain + dataNoteBlock;

    var otherPane = episodes + song + connectionsHtml(p);

    return (
      '<div class="sheet-header">' +
        '<div class="who">' + avatarHtml(p, 46) + "<span><p class=\"sub\">" + esc(p.currentTeamName) + " #" + p.number + " ・ " + esc(p.detailedPosition) + "</p>" + kanaHtml(p, "kana-detail") + '<p class="nm">' + esc(p.name) + "</p></span></div>" +
        '<button class="sheet-close" data-action="close-overlay" aria-label="閉じる">' + icon("x", 18) + "</button>" +
      "</div>" +
      '<div class="sheet-body">' +
        '<div class="badge-row">' + badges + "</div>" +
        tabSwitcher +
        (tab === "basic" ? basicPane : otherPane) +
      "</div>"
    );
  }
  function infoCell(label, value) {
    if (!value) return "";
    return '<div><p class="lbl">' + label + '</p><p class="val">' + esc(value) + "</p></div>";
  }

  // 生年月日から「現在の満年齢」をその場（レンダリング時）で計算する。ページを開くたびに
  // 実際の今日の日付を使って計算し直すので、誕生日を過ぎれば自動的に歳が1つ増える
  // （データを更新したり、更新ボタンを押したりする必要は無い＝常に正しい年齢になる）。
  function formatBirthDateDisplay(iso) {
    if (!iso) return "";
    var parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    return parts[0] + "年" + parseInt(parts[1], 10) + "月" + parseInt(parts[2], 10) + "日";
  }
  function currentAge(birthDateIso) {
    if (!birthDateIso) return null;
    var b = new Date(birthDateIso + "T00:00:00");
    if (isNaN(b.getTime())) return null;
    var now = new Date();
    var age = now.getFullYear() - b.getFullYear();
    var hadBirthdayThisYear = (now.getMonth() > b.getMonth()) || (now.getMonth() === b.getMonth() && now.getDate() >= b.getDate());
    if (!hadBirthdayThisYear) age -= 1;
    return age >= 0 ? age : null;
  }
  function birthDateInfoValue(p) {
    if (!p.birthDate) return "";
    var age = currentAge(p.birthDate);
    return formatBirthDateDisplay(p.birthDate) + (age != null ? "（満" + age + "歳）" : "");
  }
  // 生年月日から特定の日付時点での満年齢を計算する（没年齢＝享年の算出用）。
  function ageAtDate(birthIso, atIso) {
    var b = new Date(birthIso + "T00:00:00");
    var a = new Date(atIso + "T00:00:00");
    if (isNaN(b.getTime()) || isNaN(a.getTime())) return null;
    var age = a.getFullYear() - b.getFullYear();
    var hadBirthday = (a.getMonth() > b.getMonth()) || (a.getMonth() === b.getMonth() && a.getDate() >= b.getDate());
    if (!hadBirthday) age -= 1;
    return age >= 0 ? age : null;
  }
  // レジェンドの生年月日表示：故人の場合は「現在の年齢」ではなく没年月日＋享年を表示する
  // （存命前提の満年齢計算をそのまま使うと、故人を「今も生きていて〇歳」であるかのように
  // 誤って表示してしまうため、意図的に分岐している）。
  function legendBirthDateInfoValue(leg) {
    if (!leg.birthDate) return "";
    if (leg.deathDate) {
      var ageAtDeath = ageAtDate(leg.birthDate, leg.deathDate);
      return formatBirthDateDisplay(leg.birthDate) + "生 - " + formatBirthDateDisplay(leg.deathDate) + "没" + (ageAtDeath != null ? "（享年" + ageAtDeath + "歳）" : "");
    }
    var age = currentAge(leg.birthDate);
    return formatBirthDateDisplay(leg.birthDate) + (age != null ? "（満" + age + "歳）" : "");
  }

  function renderOverlay() {
    if (!state.overlay) { els.overlayRoot.innerHTML = ""; return; }
    if (state.overlay.type === "detail") {
      var p = byId(state.overlay.playerId);
      if (!p) { state.overlay = null; els.overlayRoot.innerHTML = ""; return; }
      els.overlayRoot.innerHTML =
        '<div class="overlay-scrim"><div class="sheet">' + detailHtml(p) + "</div></div>";
      var scrimEl = els.overlayRoot.querySelector(".overlay-scrim");
      scrimEl.addEventListener("click", function (e) {
        if (e.target === scrimEl) { state.overlay = null; render(); }
      });
      var sheetEl = els.overlayRoot.querySelector(".sheet");
      if (sheetEl) sheetEl.scrollTop = 0;
    } else if (state.overlay.type === "connections") {
      els.overlayRoot.innerHTML =
        '<div class="overlay-scrim"><div class="sheet">' + connectionsOverlayHtml() + "</div></div>";
      var scrimEl2 = els.overlayRoot.querySelector(".overlay-scrim");
      scrimEl2.addEventListener("click", function (e) {
        if (e.target === scrimEl2) { state.overlay = null; render(); }
      });
      var sheetEl2 = els.overlayRoot.querySelector(".sheet");
      if (sheetEl2) sheetEl2.scrollTop = 0;
    } else if (state.overlay.type === "lineup") {
      els.overlayRoot.innerHTML =
        '<div class="overlay-scrim"><div class="sheet">' + lineupOverlayHtml() + "</div></div>";
      var scrimEl3 = els.overlayRoot.querySelector(".overlay-scrim");
      scrimEl3.addEventListener("click", function (e) {
        if (e.target === scrimEl3) { state.overlay = null; state.lineupPicker = null; render(); }
      });
      var sheetEl3 = els.overlayRoot.querySelector(".sheet");
      if (sheetEl3) sheetEl3.scrollTop = 0;
      var pickerInput = els.overlayRoot.querySelector("#lineup-picker-input");
      if (pickerInput) {
        pickerInput.addEventListener("input", function (e) {
          state.lineupPickerQuery = e.target.value;
          refreshLineupPickerList();
        });
      }
    } else if (state.overlay.type === "filters") {
      els.overlayRoot.innerHTML =
        '<div class="overlay-scrim"><div class="sheet">' + filterSheetHtml() + "</div></div>";
      var scrimEl4 = els.overlayRoot.querySelector(".overlay-scrim");
      scrimEl4.addEventListener("click", function (e) {
        if (e.target === scrimEl4) { state.overlay = null; render(); }
      });
      var sheetEl4 = els.overlayRoot.querySelector(".sheet");
      if (sheetEl4) sheetEl4.scrollTop = 0;
    } else if (state.overlay.type === "settings") {
      els.overlayRoot.innerHTML =
        '<div class="overlay-scrim"><div class="sheet">' + settingsHtml() + "</div></div>";
      var scrimEl5 = els.overlayRoot.querySelector(".overlay-scrim");
      scrimEl5.addEventListener("click", function (e) {
        if (e.target === scrimEl5) { state.overlay = null; render(); }
      });
      var sheetEl5 = els.overlayRoot.querySelector(".sheet");
      if (sheetEl5) sheetEl5.scrollTop = 0;
    } else if (state.overlay.type === "legend-detail") {
      var leg = legendById(state.overlay.legendId);
      if (!leg) { state.overlay = null; els.overlayRoot.innerHTML = ""; return; }
      els.overlayRoot.innerHTML =
        '<div class="overlay-scrim"><div class="sheet">' + legendDetailHtml(leg) + "</div></div>";
      var scrimEl6 = els.overlayRoot.querySelector(".overlay-scrim");
      scrimEl6.addEventListener("click", function (e) {
        if (e.target === scrimEl6) { state.overlay = null; state.legendComparePickerOpen = false; render(); }
      });
      var sheetEl6 = els.overlayRoot.querySelector(".sheet");
      if (sheetEl6) sheetEl6.scrollTop = 0;
      var comparePickerInput = els.overlayRoot.querySelector("#legend-compare-picker-input");
      if (comparePickerInput) {
        comparePickerInput.addEventListener("input", function (e) {
          state.legendComparePickerQuery = e.target.value;
          refreshLegendComparePickerList();
        });
      }
    }
  }

  /* ===================== Master render ===================== */
  function render() {
    renderBrand();
    syncHeaderVisibility();
    renderFilterTrigger();
    renderModeSwitch();
    renderSortRow();
    renderBottomNav();
    if (state.tab === "home") renderHome();
    else renderRoster();
    renderOverlay();
  }

  /* ===================== ホーム球団・対戦相手の切り替え ===================== */
  function setHomeTeam(name) {
    if (name === state.homeTeam) return;
    state.homeTeam = name;
    saveHomeTeam(name);
    applyHomeTheme(name);
    // ホーム球団を切り替えたら、対戦相手はその球団の「実際の次の試合の相手」に合わせ直す
    // （前のホーム球団向けに選んでいた対戦相手をそのまま引き継ぐと、実際の日程とずれるため）。
    // これは自動計算であり、ユーザーが明示的に選んだわけではないので「手動」フラグは立てない
    // （＝以後も日程の自動更新に合わせて対戦相手が追従し続けるようにする）。
    state.opponentTeam = computeDefaultOpponent(name);
    saveOpponentTeam(state.opponentTeam);
    saveOpponentIsManual(false);
    // ホーム球団に依存する絞り込みタグ・球団フィルタが無効化されていないか確認
    if (state.teamFilter !== "all" && TEAM_NAMES.indexOf(state.teamFilter) === -1) state.teamFilter = "all";
    resetLineupForCurrentTeams();
    // 「見どころ」もホーム球団に紐づくデータなので、切り替えたら新しいホーム球団向けに
    // 取得し直す。前の球団の内容が一瞬でも出ないよう、いったん表示をクリアしておく
    // （非対応の球団に切り替えた場合はapi/highlights.js側でsuccess:falseが返り、
    // そのまま非表示になる）。
    if (HIGHLIGHTS_TEAM !== name) {
      HIGHLIGHTS_TEXT = null;
      HIGHLIGHTS_GAME_DATE = null;
      HIGHLIGHTS_TEAM = null;
    }
    maybeRefreshHighlights(name);
    // 「本日の先発」対戦カード・次の試合会場の天気も同じくホーム球団に紐づくデータなので、
    // 切り替えたら前の球団のぶんが一瞬でも出ないようクリアしてから取得し直す。
    TODAY_STARTER_HOME = null;
    TODAY_STARTER_AWAY = null;
    TODAY_STARTER_KEY = null;
    maybeRefreshTodayStarter();
    WEATHER_DATA = null;
    WEATHER_KEY = null;
    maybeRefreshWeather(name);
  }
  function setOpponentTeam(name) {
    if (name === state.opponentTeam || name === state.homeTeam) return;
    state.opponentTeam = name;
    saveOpponentTeam(name);
    // これは設定画面からのユーザーの明示的な選択なので「手動」フラグを立てる。
    // 以後は日程の自動更新（NEXT GAME）が対戦相手を勝手に上書きしないようにする。
    saveOpponentIsManual(true);
    resetLineupForCurrentTeams();
  }

  /* ===================== Events ===================== */
  // 検索入力は1文字ごとにリスト全体を再描画すると低スペック端末で引っかかりが出るため、
  // 120ms デバウンスして「入力が一段落したタイミング」でのみ再描画する。
  // 入力欄自体とクリアボタンの表示はデバウンスせず即時反映し、体感の遅さを感じさせない。
  var searchDebounceTimer = null;
  els.searchInput.addEventListener("input", function (e) {
    var value = e.target.value;
    els.searchClear.hidden = !value;
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(function () {
      state.query = value;
      if (state.tab === "roster") renderRoster();
    }, 120);
  });
  els.searchClear.addEventListener("click", function () {
    if (searchDebounceTimer) { clearTimeout(searchDebounceTimer); searchDebounceTimer = null; }
    state.query = "";
    els.searchInput.value = "";
    els.searchClear.hidden = true;
    els.searchInput.focus();
    if (state.tab === "roster") renderRoster();
  });

  els.modeSwitch.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-mode]");
    if (!btn) return;
    state.viewMode = btn.getAttribute("data-mode");
    renderModeSwitch();
    renderSortRow();
    renderRoster();
  });

  if (els.rosterViewSwitch) {
    els.rosterViewSwitch.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-roster-view]");
      if (!btn) return;
      state.rosterView = btn.getAttribute("data-roster-view");
      if (state.rosterView === "legends" && !LEGENDS) {
        ensureLegendsLoaded()
          .then(function () { if (state.tab === "roster" && state.rosterView === "legends") renderRoster(); })
          .catch(function () { if (state.tab === "roster" && state.rosterView === "legends") renderRoster(); });
      }
      renderRoster();
      window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    });
  }

  els.bottomNav.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    state.tab = btn.getAttribute("data-tab");
    render();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  });

  document.getElementById("app").addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.getAttribute("data-action");
    var id = el.getAttribute("data-id");
    var key = el.getAttribute("data-key");
    var tags = el.getAttribute("data-tags");
    var lineupSideAttr = el.getAttribute("data-side");
    var lineupKindAttr = el.getAttribute("data-kind");
    var lineupIndexAttr = el.getAttribute("data-index");
    var lineupIndex = lineupIndexAttr !== null && lineupIndexAttr !== "" ? parseInt(lineupIndexAttr, 10) : null;

    if (action === "toggle-tag") {
      var idx = state.activeTags.indexOf(key);
      if (idx === -1) state.activeTags.push(key); else state.activeTags.splice(idx, 1);
      renderFilterTrigger();
      refreshFilterSheetIfOpen();
      if (state.tab === "roster") { renderRoster(); showFilterToast(currentRosterList().length); }
    } else if (action === "set-team") {
      state.teamFilter = key;
      renderFilterTrigger();
      refreshFilterSheetIfOpen();
      if (state.tab === "roster") { renderRoster(); showFilterToast(currentRosterList().length); }
    } else if (action === "set-opponent") {
      setOpponentTeam(key);
      renderBrand();
      renderFilterTrigger();
      refreshFilterSheetIfOpen();
      refreshSettingsIfOpen();
      if (state.tab === "home") renderHome(); else { renderRoster(); showFilterToast(currentRosterList().length); }
    } else if (action === "set-home-team") {
      setHomeTeam(key);
      render();
    } else if (action === "open-filters") {
      state.overlay = { type: "filters" };
      renderOverlay();
    } else if (action === "open-settings") {
      state.overlay = { type: "settings" };
      renderOverlay();
    } else if (action === "refresh-data") {
      refreshAllData();
    } else if (action === "fetch-schedule") {
      fetchLatestSchedule();
    } else if (action === "set-news-scope") {
      state.newsScope = key === "all" ? "all" : "team";
      if (state.tab === "home") renderHome();
    } else if (action === "reset-filters") {
      state.activeTags = [];
      state.teamFilter = "all";
      renderFilterTrigger();
      refreshFilterSheetIfOpen();
      if (state.tab === "roster") { renderRoster(); showFilterToast(currentRosterList().length); }
    } else if (action === "set-sort") {
      if (state.viewMode === "batter") state.batterSort = key; else if (state.viewMode === "pitcher") state.pitcherSort = key;
      renderSortRow();
      renderRoster();
    } else if (action === "open-detail") {
      state.overlay = { type: "detail", playerId: id };
      state.detailTab = "basic";
      renderOverlay();
    } else if (action === "open-detail-tab") {
      state.overlay = { type: "detail", playerId: id };
      state.detailTab = key === "other" ? "other" : "basic";
      renderOverlay();
    } else if (action === "set-detail-tab") {
      state.detailTab = key === "other" ? "other" : "basic";
      renderOverlay();
    } else if (action === "open-connections") {
      state.overlay = { type: "connections" };
      renderOverlay();
    } else if (action === "open-lineup") {
      state.overlay = { type: "lineup" };
      state.lineupPicker = null;
      renderOverlay();
    } else if (action === "open-lineup-defense") {
      state.overlay = { type: "lineup" };
      state.lineupView = "defense";
      state.lineupPicker = null;
      renderOverlay();
    } else if (action === "set-lineup-side") {
      state.lineupSide = lineupSideAttr === "opponent" ? "opponent" : "home";
      state.lineupPicker = null;
      state.lineupFetchNotice = null;
      patchLineupBody();
    } else if (action === "fetch-today-lineup") {
      fetchTodayLineup(lineupSideAttr === "opponent" ? "opponent" : "home");
    } else if (action === "set-lineup-view") {
      state.lineupView = (key === "defense" || key === "compare") ? key : "order";
      state.lineupPicker = null;
      patchLineupBody();
    } else if (action === "pick-lineup-slot") {
      state.lineupPicker = { side: lineupSideAttr, kind: lineupKindAttr, index: lineupIndex };
      state.lineupPickerQuery = "";
      renderOverlay();
    } else if (action === "pick-lineup-position") {
      state.lineupPicker = { side: lineupSideAttr, kind: "position", posKey: key };
      state.lineupPickerQuery = "";
      renderOverlay();
    } else if (action === "clear-lineup-slot") {
      var removedId;
      if (lineupKindAttr === "pitcher") { removedId = state.lineup[lineupSideAttr].pitcher; state.lineup[lineupSideAttr].pitcher = null; }
      else { removedId = state.lineup[lineupSideAttr].batters[lineupIndex]; state.lineup[lineupSideAttr].batters[lineupIndex] = null; }
      if (removedId) clearPositionsForPlayer(lineupSideAttr, removedId);
      saveLineup();
      renderOverlay();
    } else if (action === "clear-lineup-position") {
      state.lineup[lineupSideAttr].positions[key] = null;
      state.lineupPicker = null;
      saveLineup();
      renderOverlay();
    } else if (action === "clear-lineup-side") {
      state.lineup[lineupSideAttr] = emptyLineupSide();
      saveLineup();
      renderOverlay();
    } else if (action === "select-lineup-player") {
      var picker = state.lineupPicker;
      if (picker) {
        if (picker.kind === "pitcher") {
          var L = state.lineup[picker.side];
          var wasSynced = L.positions.P === L.pitcher; // マウンド上の投手表示が先発投手と一致していた場合は追従させる
          L.pitcher = id;
          if (wasSynced) L.positions.P = id;
        } else if (picker.kind === "position") {
          state.lineup[picker.side].positions[picker.posKey] = id;
        } else {
          state.lineup[picker.side].batters[picker.index] = id;
        }
        saveLineup();
        state.lineupPicker = null;
      }
      renderOverlay();
    } else if (action === "close-lineup-picker") {
      state.lineupPicker = null;
      renderOverlay();
    } else if (action === "close-overlay") {
      state.overlay = null;
      state.lineupPicker = null;
      state.legendComparePickerOpen = false;
      render();
    } else if (action === "goto-roster") {
      state.tab = "roster";
      state.rosterView = "players";
      state.activeTags = tags ? [tags] : [];
      state.teamFilter = "all";
      state.viewMode = "all";
      if (searchDebounceTimer) { clearTimeout(searchDebounceTimer); searchDebounceTimer = null; }
      state.query = "";
      els.searchInput.value = "";
      els.searchClear.hidden = true;
      render();
      window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    } else if (action === "open-legend-detail") {
      state.overlay = { type: "legend-detail", legendId: id };
      state.legendComparePlayerId = null;
      state.legendComparePickerOpen = false;
      state.legendComparePickerQuery = "";
      renderOverlay();
    } else if (action === "set-legend-category") {
      state.legendCategoryFilter = key;
      if (state.tab === "roster" && state.rosterView === "legends") renderLegendGrid();
    } else if (action === "retry-legends") {
      legendsLoadFailed = false;
      ensureLegendsLoaded().then(function () { if (state.tab === "roster" && state.rosterView === "legends") renderLegendGrid(); }).catch(function () { if (state.tab === "roster" && state.rosterView === "legends") renderLegendGrid(); });
      renderLegendGrid();
    } else if (action === "open-legend-compare-picker") {
      state.legendComparePickerOpen = true;
      state.legendComparePickerQuery = "";
      renderOverlay();
    } else if (action === "close-legend-compare-picker") {
      state.legendComparePickerOpen = false;
      renderOverlay();
    } else if (action === "pick-legend-compare-player") {
      state.legendComparePlayerId = id;
      state.legendComparePickerOpen = false;
      renderOverlay();
    }
  });

  /* ===================== Init =====================
     ホーム球団ぶんのデータ＋共通データ（つながり・日程・ニュース）の取得を待ってから初回描画。
     残り11球団は裏で取得し、揃い次第マージして再描画する（loadRemainingTeamsInBackground）。 */
  function boot() {
    var homeTeamName = loadHomeTeam();
    var homeTeamId = TEAM_ID_MAP[homeTeamName] || TEAM_ID_MAP[DEFAULT_HOME_TEAM];
    // 「見どころ」は前回取得できたぶんがあれば、通信を待たずまず即表示する
    // （新鮮さの判定・裏側での再取得は maybeRefreshHighlights に任せる。ただし今のホーム球団と
    // 違う球団向けのキャッシュだった場合は、一瞬でも違う球団の内容を出さないよう使わない）
    var cachedHighlights = cacheRead("highlights");
    if (cachedHighlights && cachedHighlights.d && cachedHighlights.d.highlights && cachedHighlights.d.team === homeTeamName) {
      HIGHLIGHTS_TEXT = cachedHighlights.d.highlights;
      HIGHLIGHTS_GAME_DATE = cachedHighlights.d.gameDate || null;
      HIGHLIGHTS_TEAM = homeTeamName;
    }
    // 順位表・予告先発も同じく、前回取得できたぶんがあれば通信を待たずまず即表示する
    var cachedStandings = cacheRead("standings");
    if (cachedStandings && cachedStandings.d && cachedStandings.d.success) {
      STANDINGS_DATA = cachedStandings.d;
    }
    Promise.all([loadTeamPlayers(homeTeamId), loadRelations(), loadSchedule(), loadNews()])
      .then(function (results) {
        mergeTeamPlayers(results[0]);
        RELATIONS = results[1] || [];
        TEAM_NEXT_GAMES = results[2] || [];
        NEWS = results[3] || [];
        // 天気・「本日の先発」は「次の試合の球場・日付・対戦相手」が分かって初めてキャッシュキーを
        // 判定できるため、TEAM_NEXT_GAMES が埋まったこのタイミングで確認する
        var earlyGame = nextGameFor(homeTeamName);
        if (earlyGame && earlyGame.venue && earlyGame.date) {
          var earlyKey = earlyGame.venue + "|" + earlyGame.date;
          var cachedWeather = cacheRead("weather");
          if (cachedWeather && cachedWeather.d && cachedWeather.d.key === earlyKey) {
            WEATHER_DATA = cachedWeather.d.data;
            WEATHER_KEY = earlyKey;
          }
        }
        if (earlyGame && earlyGame.opponent) {
          var earlyStarterKey = homeTeamName + "|" + earlyGame.opponent + "|" + earlyGame.date;
          var cachedStarter = cacheRead("todayStarter");
          if (cachedStarter && cachedStarter.d && cachedStarter.d.key === earlyStarterKey) {
            TODAY_STARTER_HOME = cachedStarter.d.home;
            TODAY_STARTER_AWAY = cachedStarter.d.away;
            TODAY_STARTER_KEY = earlyStarterKey;
          }
        }
        if (opponentTeamNeedsRecompute) {
          // 日程データが揃ったので、対戦相手の自動選択をやり直す
          // （起動直後は本日の実際の対戦カードを正しく選べていない可能性があるため）
          var recomputedOpponent = computeDefaultOpponent(state.homeTeam);
          if (recomputedOpponent !== state.opponentTeam) {
            state.opponentTeam = recomputedOpponent;
            saveOpponentTeam(recomputedOpponent);
            state.lineup = loadLineup(state.homeTeam, state.opponentTeam);
          }
        }
      })
      .catch(function (err) {
        // 初回データが1件も取れない場合（オフラインかつキャッシュ無し等）でも、
        // 画面自体は空データのまま起動できるようにし、真っ白のままにはしない。
        console.error("初期データの読み込みに失敗しました", err);
      })
      .then(function () {
        render();
        document.body.setAttribute("data-boot-done", "");
        loadRemainingTeamsInBackground(homeTeamId);
        // レジェンドデータも初回描画をブロックせず裏で取得しておく（選手詳細の「似た成績の
        // レジェンド」ヒントを、レジェンドタブを開く前から使えるようにするため）
        ensureLegendsLoaded().then(function () { render(); }).catch(function () { /* 失敗時はレジェンドタブ内の再読み込みボタンに任せる */ });
        // 試合日程（NEXT GAME）の自動更新チェック。data/schedule.json（静的ファイル）は
        // 選手データ等と一緒に一括取得済みだが、これはGitHubへの反映タイミング次第で
        // 古くなっている場合があるため、起動直後にNPB公式サイトの実際の日程で
        // 上書きできないか試みる（前回の自動更新から6時間未満ならスキップされる）。
        // PLAYERSの読み込みを待つ必要は無いためここで呼ぶ（体感速度を優先）。
        maybeRefreshSchedule();
        // 「見どころ」の自動更新チェック（対応球団かどうかはapi/highlights.js側で判定される）
        maybeRefreshHighlights(homeTeamName);
        // 順位表・本日の先発・次の試合会場の天気も同様に、起動のたびに（間隔が空いていれば）自動更新
        maybeRefreshStandings();
        maybeRefreshTodayStarter();
        maybeRefreshWeather(homeTeamName);
      });
  }
  boot();
})();
