# 採用先の開発規則

本書がこのアプリで適用する規則です。共通規則は[Foundationの採用元](https://github.com/ShimaBell0619/web-app-foundation/blob/effffd846aee1e9357fbc5ec1ffa25cf65d0efcd/AGENTS.md)から生成しました。通常作業で外部AGENTSの取得は必須ではありません。更新時は採用元の差分をレビューし、アプリ固有規則を保持します。

## 文書とコンテキスト

- Issue・合意済み依頼と受け入れ条件（Acceptance Criteria）が今回の変更範囲を決める。
- アプリの `PRODUCT.md` は**製品の意図・利用者への重要な保証・境界**だけを扱い、個別の機能追加ごとに必須追記しない。実装上の事実はコード・型・スキーマ、ユーザーから観測できる振る舞いはテスト、視覚システムは `DESIGN.md`（Google DESIGN.md alpha形式）が正本。共通UI原則と実ブラウザ検証は [docs/ui.md](https://github.com/ShimaBell0619/web-app-foundation/blob/effffd846aee1e9357fbc5ec1ffa25cf65d0efcd/docs/ui.md) を参照する。
- `AGENTS.md` は開発ルール、`README.md` は利用者向け案内、[docs/README.md](https://github.com/ShimaBell0619/web-app-foundation/blob/effffd846aee1e9357fbc5ec1ffa25cf65d0efcd/docs/README.md) は専門文書と実行経路の索引。専門仕様は必要な `docs/*` に置く。
- Issue・PR・Git履歴は**変更単位の目的・受け入れ条件・判断・証拠**の正本。現行の製品保証はPRODUCT、実装事実はコード、振る舞いはテストの各正本から確認する。CI run・配備ID・実画面結果の恒久Markdownへの重複転記は必須にしない。
- すべての文書を毎回読まない。[docs/README.md](https://github.com/ShimaBell0619/web-app-foundation/blob/effffd846aee1e9357fbc5ec1ffa25cf65d0efcd/docs/README.md)で関連する文書を選び、変更対象に関係する仕様だけを追加で読む。仕様に矛盾があれば実装前に設計判断を確認する。
- 同じ規範を複数文書に重複させず、正本と参照先を明確にする。
- 文書・Issue・PRの説明は日本語を標準とする。ファイル名、コマンド、技術用語、機械処理用のキー・仕様上の見出しは必要に応じて英語を維持する。過去の変更履歴は翻訳のためだけに書き換えない。

### コンテキストの選択

| 変更対象 | 追加で読む文書 |
| --- | --- |
| 製品の機能・振る舞い | 関連コード・型・テストと今回のIssue／PR。重要な保証・製品境界に関わる場合だけ `PRODUCT.md` |
| UI・UX | `DESIGN.md` と [docs/ui.md](https://github.com/ShimaBell0619/web-app-foundation/blob/effffd846aee1e9357fbc5ec1ffa25cf65d0efcd/docs/ui.md)（初期設計から適用） |
| 認証・データ・外部連携 | 実在するアーキテクチャ／セキュリティ／連携仕様 |
| CI・配備・公開 | 対象の [kits/vercel/README.md](https://github.com/ShimaBell0619/web-app-foundation/blob/effffd846aee1e9357fbc5ec1ffa25cf65d0efcd/kits/vercel/README.md)、[kits/github/release/README.md](https://github.com/ShimaBell0619/web-app-foundation/blob/effffd846aee1e9357fbc5ec1ffa25cf65d0efcd/kits/github/release/README.md) など |
| Foundationの採用・更新 | [docs/adoption.md](https://github.com/ShimaBell0619/web-app-foundation/blob/effffd846aee1e9357fbc5ec1ffa25cf65d0efcd/docs/adoption.md)、採用元のバージョン・コミット |
| 局所的なリファクタリング | 追加仕様は影響がある場合のみ |

採用先アプリは実在する専門文書への参照を、この表に追加・更新する。形式を合わせるためだけに空の文書は作らない。

## ChatとWorkの使い分け

- **Chat-first**：依頼の調査・設計・コード変更・テスト・実画面検証・CI・配備・完了確認まで、可能な範囲をChatから自律的に実行する。依頼の規模を理由にWorkへ移管しない。
- **Workは明示指示のみ**：ユーザーが明示的にWorkを指定した場合だけ使用する。ツール不足や失敗を理由に自動起動・自動移行したり、暗黙の了承と解釈したりしない。
- 利用可能な手段を確認し、**直接コネクター → Chat内の実行環境 → 一時実行環境 → 既存の信頼済みCI/操作Workflow**などから適切な経路を選ぶ。実現不能と判断する前に安全で実行可能な代替経路を検討する（[docs/operations.md](https://github.com/ShimaBell0619/web-app-foundation/blob/effffd846aee1e9357fbc5ec1ffa25cf65d0efcd/docs/operations.md)）。
- 迂回経路は**権限・認証・承認の迂回ではない**。本人確認、課金同意、RBAC、秘密情報の信頼境界、製品/組織の操作制限を尊重する。
- 実装担当の違いによって承認条件・品質基準を緩めない。Issue、ブランチ、PR、コミットSHA、CI、配備IDを実行の引き継ぎと証拠に用いる。
- コード編集、CI成功、デプロイREADY、API HTTP 200、実データ検証、ブラウザ実表示は**それぞれ別の証拠**として扱う。未実施の確認を成功と報告しない。

## 変更とGit操作

- 機能追加・重要な修正・大きなリファクタリングは、原則Issueを起点とし、目的と受け入れ条件を明記する。軽微な文書修正まで形式的なIssue作成を強制しない。
- 実装前に既存の仕様・実装・テストを確認し、受け入れ条件を満たす最小の変更を選ぶ。
- 初回のGitHub書き込み前にベースブランチのSHAを取得し、そのSHAから短命の作業ブランチを作成する。通常の実装を直接 `main` に書き込まない。
- 変更時はブランチHEADとの競合を検出し、意図しない上書きやforce pushをしない。複数ファイルの一貫した変更はまとめてコミットしてよい。
- 関係のない整理や将来用の機能を同じPRに混ぜない。PRタイトルは `feat:`、`fix:`、`docs:` などConventional Commit形式とする。
- IssueとPRは1対1である必要はない。未完了の分割PRは `Refs #N`、最後の完了PRのみ `Closes #N` を使用する。
- `PRODUCT.md` に定めた重要な保証・製品境界、または `DESIGN.md` の視覚システムを変更する必要がある場合は、合意済みの変更か確認する。内部処理の変更や機能追加だけを理由に文書を更新しない。

## 承認が必要な変更

承認済みの範囲を保つ局所的な構造整理、命名、入力検証、回帰テスト追加は自律的に行ってよい。一方、次の変更は実行前に明示的な判断を得る。

- 製品の動作、公開API、互換性、アーキテクチャ、公開URL、デプロイ方式の実質的な変更
- 認証・認可・権限、秘密情報、外部送信、信頼境界の変更
- データの永続化先・保持期間、破壊的移行、復旧困難な変更
- 新しい有料サービス、継続課金、権限のある外部連携

承認済みの判断を繰り返し質問しない。判断が必要な新しい論点だけを示す。

## 実装・自己レビュー・完了条件

実質的な変更では、実装 → テスト・自己レビュー → 不具合修正 → 再確認 → 最終検証を実施する。初回の実装結果をそのまま完成扱いしない。

- 受け入れ条件、変更してはいけない既存動作、失敗時の挙動、セキュリティ、互換性、保守性を最終差分で点検する。
- UI変更は実際にレンダリングし、表示・操作・レスポンシブ・キーボード操作を確認する（[docs/ui.md](https://github.com/ShimaBell0619/web-app-foundation/blob/effffd846aee1e9357fbc5ec1ffa25cf65d0efcd/docs/ui.md)）。ソースの読解だけで確認済みとしない。
- 最後の実質的な修正後に必要なテストとCIを再実行する。既存の証拠を利用する場合は対象SHAが一致していることを確認する。
- 最終PR HEAD、マージ後main、公開source SHAの検証結果を区別する。必要なmain CIが失敗・未完了なら、PR CIやDeployment READYだけで検証完了としない。中断時は現在HEAD、確認済み項目、未解決、次の一手をPRに残し、再開時に実状態を取り直す。
- 高重大度の未解決事項を黙って残さない。変更内容、検証証拠、未実施項目、残存リスクを簡潔に報告する。
- 自己レビューで修正点がなければ、形式的な変更を追加しない。

## 独立レビュー

自己レビュー、CI、独立レビューは別の証拠とする。この節が独立レビュー規則の正本である。

- 低リスクの変更は理由を記録して独立レビューを省略できる。
- 認証・認可、データ整合性、並行処理、互換性、特権付きCI、配備・公開・ロールバックなどの高リスク変更では、可能な限りマージ前に独立レビューを得る。
- Codex GitHub Code Reviewの自動レビュー設定（Automatic Review / Review my pull requests）は**OFF**とする。
- `@codex review` は、自己レビューとCI後のマージ候補HEADを対象にする。**実行のたびに**理由・リスク分類・期待する確認内容を説明し、明示的な承認を得てから依頼する。過去の承認は再レビューに流用しない。
- 指摘事項は証拠に基づいて採否を判断し、修正後に最終検証する。修正後の再レビューは重大な変更があった場合に限って検討する。
- PRには独立レビューの要否、対象SHA、主要指摘と対応、承認・再レビュー判断を記録する。

### コードレビューの重点

- **仕様整合性**：Issue・受け入れ条件・現行仕様と差分の食い違い。
- **信頼境界と公開の安全性**：未信頼PRコードへの書き込み権限付与、シークレット露出、品質ゲートの迂回、検証SHAと公開SHAの不一致。
- **状態・互換性**：競合、再試行、冪等性、データ破損、破壊的副作用、復旧・ロールバックの不備。

見た目の好みやLintで検出できる事項だけを独立レビューの主題にしない。

## 設計と過剰な複雑化の抑制

- 現在の要件を満たす最も単純な構成を選ぶ。実際の責務・ライフサイクル・信頼境界・反復・計測された課題がない限り、レイヤー、抽象化、依存、サービス、恒久的な手順書を追加しない。
- UIの一時状態は原則ローカルに持つ。業務ロジックとUIフレームワークの分離は、テストや再利用上の明確な利点がある場合に行う。
- アクセシビリティは省かない。新しいReact UIはTailwind CSS + shadcn/ui相当の成熟したアクセシブルな基本部品を既定とする（[docs/ui.md](https://github.com/ShimaBell0619/web-app-foundation/blob/effffd846aee1e9357fbc5ec1ffa25cf65d0efcd/docs/ui.md)）。製品固有の体験は `DESIGN.md` に従う。
- UIは実装前に [docs/ui.md](https://github.com/ShimaBell0619/web-app-foundation/blob/effffd846aee1e9357fbc5ec1ffa25cf65d0efcd/docs/ui.md) の採用基準で文言・装飾・アイコンの役割を判断する。視覚デザインシステムの変更のみ `DESIGN.md` に反映し、個別画面の振る舞いはコード・テストで維持する。完成後の削除だけに頼らない。
- 既存消費先の安定動作を、Foundationの新しい推奨スタイルに合わせるだけで書き換えない。
- 安全性、データ整合性、障害復旧、並行処理で本当に必要な複雑さは削らない。

## 依存関係とCI・配備

- 新しい依存を追加する前に、標準機能・既存依存で済まないか、保守状況、ライセンス、脆弱性、互換性を確認する。認証情報や秘密鍵をコミットしない。
- npmの既定品質ゲートは `npm ci`、`check`、`typecheck`、`test`、`build`。不要なゲートは理由付きで明示的に除外し、no-opスクリプトでごまかさない。ビルドは必須。
- 再利用可能なCIは [共通Web CI](https://github.com/ShimaBell0619/web-app-foundation/blob/effffd846aee1e9357fbc5ec1ffa25cf65d0efcd/.github/workflows/web-ci.yml) を参照する。外部GitHub ActionsとFoundation共通Workflowはレビュー済みの**40桁のコミットSHA**に固定する。
- 新規アプリのブランチ保護は一律必須ではない。Vercel標準Git連携のSimple方式ではユーザー方針で選択する。特権付きControlled・Release・管理用Kitの保護条件は維持する。Simple方式のProduction公開がGitHub CI成功を待つとは扱わない。
- CIと配備成功を混同しない。特権付き操作で未信頼コードや秘密を含むキャッシュを実行・復元しない。公開元SHAと品質確認済みSHAの関係を検証する。
- Vercel Preview、固定Staging、Release、Azure OIDCの具体的手順は各 `docs/*` を参照する。既存の安全な公開方式を指示整理のために変更しない。

## アプリ固有規則

この節はたべどきが所有する。ユーザーの明示指示を優先し、共通規則からの変更はここに明記する。Foundation更新で上書きしない。

- 製品の目的・重要な保証・制約はPRODUCT.md、視覚システムはDESIGN.md、利用方法はREADME.mdで管理する。具体的な操作・保存形式はコードとテスト、変更理由と検証証拠はPR／Actionsに残す。旧VERIFICATION.mdはGit履歴で確認できる。
- npm ci、check、typecheck、test、build、design:lint、Chromium E2Eを実行する。復元の非同期待機はダイアログ処理完了と新しい通知で確認し、保存値を検証する。
- Simpleのみを使う。main保護は不要で、Controlled Kitは導入しない。CI成功と公開READYを区別する。
- 保存形式・キー・公開originは、規則やテストの改善のために変更しない。
