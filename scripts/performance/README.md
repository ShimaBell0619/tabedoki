# モバイル描画性能の比較

Android Chromeを優先した、**モバイルChromiumエミュレーション**の再現用計測です。実機のGPU・発熱・メモリ・ブラウザUIや、利用者全体のINPを再現するものではありません。

## 実行

Node.jsはリポジトリの指定バージョン、依存とChromiumはlockfileのものを使用します。

```sh
npm ci
npx playwright install --with-deps chromium
# 別のcheckoutで比較元をnpm ci / npm run buildし、そのdistを残す
npm run build
node scripts/performance/measure.mjs --before /absolute/baseline/dist --after dist --repeats 5 --cpu 4 --output test-results/performance.json
```

必要なら `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/chromium` でインストール済みのブラウザを指定できます。比較中にブラウザ・実行オプションを変更せず、ビルド・E2Eなど他の負荷を並行実行しないでください。2つの静的サーバーは計測スクリプト自身が起動・終了します。プロダクション用ビルドを使用し、計測コードをアプリに追加しません。

## 条件と指標

- 390×844 CSS px、DPR 2.75、タッチ対応、ja-JP / Asia/Tokyo、CPU 4倍制限。通信のスロットリングなし。
- 20 / 100 / 300件の独立した食品グループ。半分を当日期限としてカレンダーにも十分な行数を用意し、残りを期限切れ〜91日先に分散。
- ログインなしのv5端末データ。数量変更は実際の保存値を照合。クラウドの往復遅延は測定対象外。
- 新しいブラウザ・コンテキストを各標本で作り、前後を交互に測定。Google Fontsは空CSSへ置換して通信のばらつきを除外し、システムフォントで測定。フォント込みの表示確認は別途E2Eで実施。
- `readyPaintMs` はnavigation開始から食品一覧の見出し生成後の2回目のrequestAnimationFrameまでの近似値。LCPや描画完了の厳密な測定ではありません。FCPも併記します。
- 操作にはPlaywrightのtrusted click、スクロールにはChrome DevTools Protocolのtrusted touch gestureを使います。単なるscrollイベントのdispatchではありません。
- `eventMaxMs` は各操作中のEvent Timingの最大duration。INPそのものではなく、入力遅延・処理・表示待ちを切り分けるためのラボ値です。16ms未満または未報告は `null`。nullを0msや「INP良好」と解釈しないでください。
- `scriptMs` / `layoutMs` / `styleMs` は操作前後のDevTools Performance累計値の差。初期累計は `initialMetrics` に秒単位で記録します。
- `loafCount` / `loafMaxMs` は50msを超えるLong Animation Frames。`forcedStyleLayoutMs` はスクリプト内の強制スタイル・レイアウトの合計で、未対応の詳細フィールドは0として集計します。
- スクロールの `frames.p95Ms` / `over32ms` はrAF間隔の参考値です。ディスプレイの実フレーム落ち率やGPU合成時間ではありません。
- ブラウザバージョン、ビルドしたassetsのSHA-256、ソースtree、反復ごとの生データをJSONへ出力します。1回の最速値ではなく、各件数・各操作の中央値とばらつきを比較してください。
