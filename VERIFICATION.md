# 検証記録 — たべどき

## UI・UX整理（2026-10-11）

- Issue [#8](https://github.com/ShimaBell0619/tabedoki/issues/8)。キャッチコピー・英語の装飾見出し・重複説明・葉の文字マークを除去し、一覧中心の表示へ変更。
- 公開版の一覧と新規登録を今回のブラウザで捕捉し、一覧を押し下げる装飾文言、同じ強さの食品操作、登録フォームの説明密度を確認した。
- 鍋を含むLucideアイコンを固定コミットからそのまま同梱。ランタイム依存・永続化形式・デプロイ方式は変更しない。
- ローカルNode.js 24.19.0でnpm ci/check/typecheck/単体21件/buildが成功。要求Node.js版でのCI・Chromium E2E・320/390/1440pxの画像・公開SHAと配備READYは、PRに最終結果を記録する。ローカルの静的検査を実画面検証の代用にはしない。
- E2Eでは既存操作に加えて、絞り込みの開閉・条件の保持と解除、期限サマリーの押下状態、操作メニューのEnter/Escape・フォーカス復帰・廃棄、候補選択表示、横はみ出しを確認する。
- 自己レビューとReact品質確認を実施。UIと操作導線の変更で、認証・保存処理・互換性・特権CI・配備方式への変更がないため独立レビューを省略する。確認できた範囲でのみ結果を報告する。

## 定番食品のカスタマイズ・v3（2026-10-11）

- Issue [#6](https://github.com/ShimaBell0619/tabedoki/issues/6)、PR [#7](https://github.com/ShimaBell0619/tabedoki/pull/7)。
- 機能HEAD `be095eb454ae300421b9b6806fb28870ec914f06`の[PR CI](https://github.com/ShimaBell0619/tabedoki/actions/runs/38115215266)で、Node.js 24.20.0、npm ci/check/typecheck/単体21件/build/Chromium E2E 30件がすべて成功。checkoutはmerge ref `5e5033e29b7d73eb5ae276298e4feb51889cd25f`。
- 定番CRUDと既存在庫不変、テンプレート数量・区分の補完、新在庫の独立ID、全定番削除後の保持、v1/v2/v3互換、食品と定番の単一書き込み、実ファイルの復元・取消し、追加／編集／削除／復元の保存例外、数量・名前・上限検証、登録途中入力、320/390/1440pxとキーボードを確認。
- Artifact `browser-5e5033e29b7d73eb5ae276298e4feb51889cd25f-38115215266-1`（ID `11692598663`）の管理一覧・編集画面6枚を目視。横はみ出し・文字の重なりなし。画面切り替えのスクロール位置は先頭に戻すよう追加修正し、最後のHEADでも正式CIと画像確認を行う。最終CIと公開証拠はPR #7に記録する。
- 初回E2Eで管理を閉じた後の編集状態が残る問題を検出。dialogのcloseで状態をリセットし、上記30件が成功した。
- 自己レビュー・React品質確認を実施。独立`@codex review`は各回の明示承認が未取得のため未依頼。ローカルNode.js 24.19.0とChromium取得失敗を正式CIの代わりにしない。
- v1/v2の原文を退避として残すが、最新v3のバックアップではない。旧形式のアプリへの単純ロールバックを行わず、v3互換の修正版で復旧する。

## 食品登録とデータモデルv2（2026-10-11）

- 機能Issue: [#4](https://github.com/ShimaBell0619/tabedoki/issues/4)、機能PR: [#5](https://github.com/ShimaBell0619/tabedoki/pull/5)
- 機能コードのPR HEAD: `fc8abbced1b1c7c5c8532243f9fad6a924dc45e7`
- PR CI: [38113452663](https://github.com/ShimaBell0619/tabedoki/actions/runs/38113452663)、チェックアウトSHA: `d8875d1d1e8c4089d5a1078c7402b61d25690f75`（merge ref）
- 正式環境Node.js 24.20.0で、`npm ci`、`check`、`typecheck`、単体16件、`build`、Chromium E2E 19件がすべて成功。
- E2Eは既存CRUDに加え、定番・以前の食品の補完、期限非継承・数量1・新ID、v1移行と退避原文、v1/v2復元、v2空・破損・未知version、LocalStorage取得／保存拒否、各変更失敗時の元データと入力保持、AND絞り込み、最大3,000件の実ファイル往復と5MiB上限、320／390／1440pxとキーボード操作を検証。
- 成功画像10枚をArtifact `browser-d8875d1d1e8c4089d5a1078c7402b61d25690f75-38113452663-1`（ID `11692427011`）から取得。各幅の一覧と登録フォームを目視し、横はみ出し・明らかな日本語の重なりがないことを確認した。登録フォームは縦スクロールで下部まで操作できる。
- ローカルのNode.jsは24.19.0で要求バージョンより古い。ローカルのChromium取得は失敗したため、正式なブラウザ検証の証拠には使用しない。ローカルの静的チェック・型・単体・ビルドは成功。
- データ整合性・互換性のリスクに対し自己レビューと失敗系テストを実施。独立した`@codex review`は、Foundationの各回個別承認が必要なため未依頼。
- 公開版のDeployment ID、main SHA、実ブラウザ操作の結果は、公開後にPR #5へ追記する。CI成功とDeployment READYと公開ブラウザ検証は別の証拠として扱う。
- 復旧はv2互換の修正版で行う。保持したv1は移行時点の退避であり、v2での変更を含まないため、旧v1専用アプリへの単純なロールバックを行わない。

以下はPhase 1の履歴証拠。

## 対象と採用元
- Foundationの参照main SHA（2026-10-11確認）: `861a240fc6d344cfab654aaf93a922f1069f97aa`
- 共通CI caller参照SHA: `861a240fc6d344cfab654aaf93a922f1069f97aa`
- 初回機能PR: [#2](https://github.com/ShimaBell0619/tabedoki/pull/2)
- PR HEAD: `0fed03f04da0cd8399889b995480bb9c31f2a4e7`
- PR #2のmainへのsquash merge SHA: `9b83e022a79a9f0a0cb79c4f242d89b09da1a99a`

## 実行した品質ゲート
| 実行経路 | run | 証拠 |
| --- | --- | --- |
| PR（pull_request） | [38105885380](https://github.com/ShimaBell0619/tabedoki/actions/runs/38105885380) | `npm ci`、`check`、`typecheck`、`test`（6件）、`build`、Chromium E2E（5件）すべて成功 |
| main（push） | [38106063193](https://github.com/ShimaBell0619/tabedoki/actions/runs/38106063193) | source SHA `9b83e022a79a9f0a0cb79c4f242d89b09da1a99a`、成功 |

PR runのチェックアウトSHAは `582e3e77429d5f38d441e48671317c897959cefa`（pull_requestのmerge ref）であり、PR HEADとは異なる。正式なNode.js 24.20.0で品質ゲートを実行した。Chromium E2Eは320／390／1440pxでCRUD・検索・LocalStorage永続化・期限境界・JSON保存／復元・不正JSON拒否・上書き確認・キーボード・ブラウザエラーを確認。成功スクリーンショット3枚はPR runのArtifact `browser-582e3e77429d5f38d441e48671317c897959cefa-38105885380-1`（Artifact ID `11690260864`）に保存した。画像を取得し、横はみ出し・日本語の明らかな重なりがないことを目視確認済み。

## 初回Vercel Production
- Project ID: `prj_VciRF3zSKtxzPB0KZqLFQba9ZHog`
- Deployment ID: `dpl_9W1kFco3Qq2tY4QJeNrGv5FUz2g2`
- 配備元: `ShimaBell0619/tabedoki` / `main` / `9b83e022a79a9f0a0cb79c4f242d89b09da1a99a`
- target: `production`、state: `READY`
- URL: https://tabedoki-shimabell.vercel.app/
- Production aliasが上記Deployment IDを指すことをVercel APIで照合。
- HTMLとビルド済みJavaScriptはVercel経由のHTTP取得で200。Vercelの認証保護はPreview対象に限定。
- **公開URLに対する実Chromium操作は未実施**（現在のChat内実行環境には外部ホストへのブラウザ接続経路がない）。CIでのローカルbuildに対するE2Eを公開ブラウザ検証の代用として報告しない。

## 採用・制約の記録
- Foundation公式生成コマンド自体は**未実行**。Chat内実行環境からGitHubを直接cloneできず、Nodeは22.16.0だった。固定SHAの配布物をGitHub接続で読み取り、starterのlockfileを置換して作成した。生成器そのものの再現性は未実証。
- 新規Publicリポジトリは利用者が作成。最初のbootstrap READMEコミット以後、作業ブランチに20ファイルをGit Data APIで1コミットした。
- 実装、CI、Deployment READY、HTTPと実ブラウザは区別する。文書記録の追加により将来のmain SHA／Vercel Deployment IDが変わる場合、上記は**初回機能リリースの履歴証拠**とする。
