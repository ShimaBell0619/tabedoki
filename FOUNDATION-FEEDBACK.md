# Web App Foundation — たべどき採用実証フィードバック

基準SHA: `861a240fc6d344cfab654aaf93a922f1069f97aa`。Foundation本体の変更はしていない。主目的であるアプリ機能はReact／TypeScript／Vite、LocalStorageで実装した。

## 実際に起きた事項

| 観点 | 実際に観測したこと | 評価 |
| --- | --- | --- |
| 新規Public repo | 現在のGitHub接続にPublic repo作成機能がない。ユーザーがGitHubで一度手動作成 | 手動介入1回。FoundationのPrivate専用Kitを迂回・改造しなかった |
| 新規アプリ生成 | Chat実行コンテナはNode22でGitHubへのgit cloneとnpm registryへの到達が不可。指定SHAの生成スクリプトを直接実行できなかった | **生成器の実証は未完了**。代替として固定SHAの配布物・実lockfileを読んで再構成 |
| GitHub反映 | READMEで空repo初期化後、branch作成とGit Data APIで20ファイルを1コミット | 大量ファイルの個別API更新は不要。初回PRは#2 |
| CI/E2E | PR run `38105885380` でNode24.20.0のnpm標準ゲート、6件の単体テスト、5件のChromium E2Eが成功 | 初回機能PRでアプリ固有のブラウザテストが稼働 |
| ブラウザ画像 | 320・390・1440pxの3画像をGitHub Actions Artifactから取得し、目視確認 | 大きなはみ出し・重なりは観測されなかった |
| CI時間 | 同runではChromiumダウンロード等の初回準備がテスト本体（5件6.8秒）より長い | 継続実行時にキャッシュの費用対効果を判断。現段階で複雑な仕組みは不要 |
| Vercel Simple | mainへのsquashマージ後、標準Git連携でProduction Deployment `dpl_9W1kFco3Qq2tY4QJeNrGv5FUz2g2` がREADYになった | GitHub CIとVercel READY・source SHA・aliasを個別に照合できた |
| 公開設定 | 新規Vercel project既定のSSO保護がProductionにも適用される構成だったため、Previewのみに限定 | 公開用の設定判断が必要。Foundationに権限変更を自動化する必要はない |
| 公開ブラウザ | Chat内の一般ネットワーク／ブラウザ操作経路から公開URLを直接レンダリングできなかった | 未実施。CI内アプリE2Eと混同しない |

## 将来の改善候補（未確認の問題・提案を区別）
- Public repo作成の安全な専用操作が、適切な認証・承認付きで利用可能になると手動介入を減らせる。ただし現状は新しい管理Kitを作る必要はない。
- Foundationの生成器はネットワークとNode24を持つ通常の開発環境で別途クリーン採用実証するとよい。この回で生成器の不具合と断定しない。
- 公開後の実ブラウザ検証が必要なら、既存の安全なE2E実行環境にProduction用の任意スモークを追加することを検討。ただし通常のPR CIの外部サービス依存増大を避ける。
- 初回Chromiumインストールの時間短縮は、複数採用アプリの実測が揃ってから検討する。

## 今回不要だったもの
Controlled Kit、DB、認証、Repository抽象化、常駐ブラウザ実行環境、臨時lockfile用Workflow、追加の本番シークレット。
