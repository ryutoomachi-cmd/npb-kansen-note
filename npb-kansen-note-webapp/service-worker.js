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

const CACHE_VERSION = "v41"; // 「過去のデータを見る」機能を日本ハム・巨人・阪神にも拡大（実際のNPB公式記録から複数年の成績を新規収録。楽天以外は今回追加分のみ対応）
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
