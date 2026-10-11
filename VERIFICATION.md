# 検証記録 — たべどき Phase 1

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
