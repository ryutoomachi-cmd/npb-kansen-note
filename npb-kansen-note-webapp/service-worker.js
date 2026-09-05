// NPB観戦ノート Service Worker
// 目的：球場など電波が不安定/オフラインな環境でも、アプリの起動画面と一度取得した
// データ（選手データ・つながり・日程・ニュース）をキャッシュから即座に返せるようにする。
//
// キャッシュ戦略:
//  - アプリシェル（HTML/CSS/JS/アイコン/manifest）: cache-first
//    → デプロイのたびに CACHE_VERSION を上げることで、古いシェルを確実に入れ替える。
//  - データJSON（/data/**）: stale-while-revalidate
//    → キャッシュがあれば即座に返しつつ、裏で最新版を取得してキャッシュを更新する。
//      電波が悪くネットワーク取得が失敗しても、キャッシュ応答は既に返し終えているため
//      画面表示には影響しない。

const CACHE_VERSION = "v51"; // 機能追加：明日の観戦に向けて2つ追加。
// (1)「本日の観戦モード」：ホーム画面に新設したボタンから開く専用画面。今まで別々の場所に
// 散らばっていた「本日の先発」「両チームのスタメン」「今日の注目対決・豆知識」「リーグ順位」を
// 1画面にまとめ、球場で片手で見ながらスクロールなしでチェックできるようにした（新しいデータ取得は
// 追加しておらず、既存の情報を1箇所にまとめて表示するだけの機能）。
// (2) 応援スタイルガイド：楽天の主力・準主力選手18名について、応援歌の有無や由来、コール・
// 手拍子の掛け声パターンなどをNPB公式サイト・球団公式サイト・ファン系サイトで調査し、選手詳細の
// 「登場曲・応援歌」欄（cheerSongNoteフィールド、以前から用意されていたが未使用だった欄）に追加。
// 著作権の観点から、歌詞そのものは掲載せず、応援文化についての事実の説明のみを記載している。
// 「本日の観戦モード」の各選手行にも、応援歌・登場曲の情報がある選手には目印のタグを表示する。
//
// (前バージョンv50の内容:リーグ順位が「めちゃくちゃ昔の情報」に見えていた不具合を修正。
// 原因は交流戦だけの内訳表を誤ってシーズン成績として読み込んでいたこと)
const SHELL_CACHE = "nsn-shell-" + CACHE_VERSION;
const DATA_CACHE = "nsn-data-" + CACHE_VERSION;

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/styles.min.css",
  "/js/app.min.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isDataRequest(url) {
  return url.pathname.startsWith("/data/");
}

function isShellRequest(url) {
  return SHELL_ASSETS.includes(url.pathname) || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外部フォント等はブラウザの通常挙動に任せる

  if (isDataRequest(url)) {
    // stale-while-revalidate: キャッシュがあれば即返し、裏で更新
    event.respondWith(
      caches.open(DATA_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req)
            .then((res) => {
              if (res && res.ok) cache.put(req, res.clone());
              return res;
            })
            .catch(() => null);
          return cached || network || fetch(req);
        })
      )
    );
    return;
  }

  if (isShellRequest(url) || url.pathname === "/") {
    // cache-first: アプリシェルは基本的に変わらない前提（変更時はCACHE_VERSIONを上げる）
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.ok) {
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, res.clone()));
        }
        return res;
      }).catch(() => cached))
    );
    return;
  }

  // それ以外（フォント等）はキャッシュせず通常通りネットワークに任せる
});
