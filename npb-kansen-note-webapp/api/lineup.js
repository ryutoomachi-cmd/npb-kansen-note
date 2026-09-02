// Vercel Serverless Function: /api/lineup
//
// 現状はプレースホルダーです。今回の最適化作業（データ分離・PWA化・レンダリング最適化）の
// スコープには「当日の実際のスタメン発表を自動取得するスクレイピング」は含まれていません。
// 将来的にその機能を実装する場合の置き場所として、ファイル構成だけ用意しています。
//
// 実装する際に検討が必要な点（未着手）：
//  - どこから取得するか（NPB公式サイト／各球団公式サイト等、利用規約上問題のない取得方法）
//  - どのくらいの頻度で取得するか（試合開始前後のみ等、対象サイトに負荷をかけない設計）
//  - 取得結果のキャッシュ（Vercel KV等）と、既存の /data/schedule.json との関係整理
//
// 現時点では、既存の週次更新の日程データ（/data/schedule.json）をそのまま返すだけの
// スタブとして動作します。フロントエンド（js/app.js）側からはまだ呼び出していません。

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(501).json({
    error: "not_implemented",
    message:
      "当日の実際のスタメン自動取得（スクレイピング）は未実装です。現時点では /data/schedule.json（週次更新の試合日程データ）をご利用ください。",
  });
}
