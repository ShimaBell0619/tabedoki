# 採用先の開発規則

[Foundationの共通規則](https://github.com/ShimaBell0619/web-app-foundation/blob/861a240fc6d344cfab654aaf93a922f1069f97aa/AGENTS.md)を取得して適用してください。Chat-first、Workは明示指示のみ、日本語標準、承認・信頼境界を維持します。

- [PRODUCT.md](PRODUCT.md) は製品の目的・重要な保証・制約のみを扱います。細部の実装はコード、振る舞いはテスト、視覚設計は[DESIGN.md](DESIGN.md)を正本とします。
- 機能追加だけを理由にPRODUCTへ仕様を羅列しません。製品の保証が変わる場合だけ更新し、変更理由・受け入れ条件・テスト・CI証拠はIssue／PRに残します。実装とPRODUCTの矛盾は黙って整合させず判断します。
- 利用方法は[README.md](README.md)。検証証跡はGitHub Actions／PRで確認します。旧VERIFICATION.mdはGit履歴から閲覧できます。
- npm ci、check、typecheck、test、build、Chromium E2Eを実行します。
- main保護は不要です。Simpleのみで、Controlled Kitを導入しません。