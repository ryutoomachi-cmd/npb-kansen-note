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

const CACHE_VERSION = "v50"; // 不具合修正：リーグ順位が「めちゃくちゃ昔の情報」「14勝4敗のような記録」に
// なっていた問題を修正。原因はキャッシュの古さではなく、api/standings.jsがNPB公式サイトの
// 順位表ページを解析する際、ページ内に2つある「試合・勝利・敗北・引分・勝率」見出しの表
//（1つ目=シーズン全体の本当の順位表、2つ目=交流戦だけの内訳表）の両方を見出しラベルの
// 一致だけで「成績表」と誤認識し、後から出てくる交流戦だけの少ない試合数(例:18試合14勝4敗)の
// 表で上書きしてしまっていたこと。ページ内で最初に球団データが取れた表だけを採用し、
// それ以降の表は見ないよう修正(詳しい経緯はapi/standings.jsのコメント参照)。
//
// (前バージョンv49の内容:外野手の詳細な守備位置(左翼手/中堅手/右翼手)を追加。全12球団の
// 外野手129名のうち97名についてNPB公式サイト等で調査し、72名は具体的な守備位置まで判明)
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
