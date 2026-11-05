# NPB観戦ノート — 作業メモ（Claude向け）

公開サイト: https://npb-kansen-note.vercel.app/
持ち主は「おおまち」さん。ITの専門用語は避け、やさしい日本語で説明すること。スマホから頼まれることも多い。

## 公開のしくみ
- アプリ本体は `npb-kansen-note-webapp/`（Vercel はこのフォルダを公開している）。
- `main` ブランチに push すると、Vercel が1分ほどで公開サイトを自動更新する。
- 本人が「公開して」と言ったら main に直接 push してよい。見た目の変更は、公開前にスクリーンショットなどで見本を見せて確認をとる。

## 画面を変えるときの決まり（必ず守る）
1. 編集するのは `js/app.js` と `css/styles.css`。
2. 編集後、圧縮版を作り直す（`index.html` が読み込んでいるのは圧縮版）:
   ```
   cd npb-kansen-note-webapp
   npx -y esbuild@0.24.0 js/app.js --minify --outfile=js/app.min.js
   npx -y esbuild@0.24.0 css/styles.css --minify --outfile=css/styles.min.css
   ```
3. 古い画面がスマホに残らないよう、版番号を1つ上げる（例 v53 → v54）:
   - `service-worker.js` の `CACHE_VERSION`
   - `index.html` の `styles.min.css?v=..` と `app.min.js?v=..`
4. `node --check js/app.js` で文法エラーがないか確認する。

## データ
- `data/news.json`：12球団のニュース（各球団3件）。毎朝6時に Claude の定期実行が自動更新して push している。手で直すときも、実在する記事だけを、出典URL付きで載せる。
- `data/schedule.json`：各球団の次の試合。
- 今季成績・順位は `api/stats.js`・`api/standings.js` が NPB公式サイトからその場で取得している（手作業は不要）。
- 選手データは `data/teams/*.json`。実在の選手の実際の記録・エピソードだけを載せる（架空の内容は禁止）。

## 主な機能
- 設定で応援球団を選ぶと、色やホーム画面が球団向けになる。
- 「12球団まんべんなく」モード：推し球団なしで全体の情報を均等に表示（localStorage の `npbAllTeamsMode_v1`）。
- ヘッダーのロゴは `js/app.js` 内の `BRAND_EMBLEM_SVG`（球団カラーで自動的に塗り分けられる）。
