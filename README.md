# たべどき — Tabedoki

家庭の食品を登録し、賞味期限と消費期限を管理するモバイルファーストのWebアプリです。

## 主な機能
定番食品のカスタマイズ（追加・編集・削除）・以前の登録からの入力補完、カテゴリ・数量単位、食品の登録・編集・削除、使い切り／廃棄、期限切れ・当日・3日以内の分類、カテゴリ・場所・期限状態の絞り込み、名前検索。期限計算は端末のローカル暦日を使用します。

**ログインせずに端末内で利用できます。** データはこのブラウザに保存され、ブラウザのデータ削除や端末変更では引き継がれません。右上のアカウントメニューからGoogleでログインするとクラウド保存へ切り替わり、同じアカウントでスマートフォンとPCから利用できます。クラウドの変更は「再取得」で反映します。保存失敗・競合時は入力を保持し、確認するまで変更を止めます。

初めてクラウドを使う際は、端末データの件数・移行先を確認し、明示操作でクラウドへ移行できます。v1〜v4を読み取り、元データを保持します。既存クラウドデータがあれば端末データを自動で取り込みません。ログアウトすると端末内のデータに戻り、クラウドでの変更は端末にコピーされません。v1食品だけはカテゴリ「その他」・単位「点」を追加します。新規登録では今回の期限日を入力してください。公開更新後は旧版のタブを閉じてください。

一覧はカテゴリ別表示が初期設定です。「一覧の表示方法」から期限順・保存場所別に切り替えられ、カテゴリ・保存場所別では各グループの件数を表示し、グループ内は期限順に並びます。検索の横にある「絞り込み」からカテゴリ・保存場所・期限を選び、適用中の条件は「条件をクリア」で解除できます。レトルト・缶詰カテゴリと「主食・麺・パン」カテゴリを利用でき、新規ユーザーの初期定番にパスタとレトルトカレーを含めます。保存済みのカスタム定番は変更しません。廃棄・削除は各食品の「その他の操作」から行います。

定番は登録画面の「定番を編集」、またはヘッダーの「定番食品」から設定できます。定番を変更しても登録済み食品は変わりません。

## 開発と検証
Node.js 24.20.0以降（`.node-version`参照）で実行します。

```sh
npm ci
npm run check
npm run typecheck
npm test
npm run build
npm run design:lint
npm run test:e2e
npm run dev
```

製品の約束: [PRODUCT.md](PRODUCT.md) ／ 視覚設計: [DESIGN.md](DESIGN.md) ／ 変更・検証履歴: [GitHub PR](https://github.com/ShimaBell0619/tabedoki/pulls)・[Actions](https://github.com/ShimaBell0619/tabedoki/actions)

採用元SHAと有効な開発規則は [AGENTS.md](AGENTS.md)、共通CIのpinは [.github/workflows/ci.yml](.github/workflows/ci.yml) で確認します。

checkはReact Hooks規則とeffect依存を含み、design:lintはlockfileで固定したGoogle CLIを使います。通常CIは全E2Eを1回実行します。

期限は8桁の数字（YYYYMMDD）、YYYY-MM-DDの貼り付け、カレンダーで入力できます。定番・以前の登録は必要なときに開いて選択し、今回の期限を入力してください。一覧の食品を開くと詳細と操作を表示します。

買い物は名前を入力するか在庫・定番から追加します。在庫で「残りわずか」を設定すると、同名の管理中在庫がすべて残りわずかで、買い物に未掲載の場合に補充候補を表示します。購入済みのチェックだけでは在庫は増えません。「在庫に登録」で今回の期限を入力し、保存が成功すると買い物から消えます。

## ソース構成

- `src/app`：セッションとアカウント初期化、画面編成、保存ゲートと業務操作。
- `src/features/inventory`、`shopping`、`templates`、`auth`：各機能の画面・操作。
- `src/domain`：食品・買い物の型、期限計算、在庫集約、定番と入力候補のルール。
- `src/data`：端末保存、Supabase接続、クラウド保存、保存形式の検証と旧データ移行。
- `src/components`：Brand・Iconと、`ui/`の共有プリミティブ。
- `src/styles`：Tailwind v4の入口、DESIGN.mdのトークン、必要なネイティブ要素のCSS。

依存は `app → features / data / domain`、`features → domain / components`、`data → domain` とします。逆方向のimportはESLintで検査します。保存済みの状態はappの保存ゲートが所有し、フォーム・絞り込み・画面選択はローカル状態で管理します。標準dialogとdetailsの振る舞いを維持し、形式的な共通化やbarrelは追加しません。

UIはTailwind CSS v4のViteプラグインとshadcn/uiのButton・Input・NativeSelect・DropdownMenuを使います。採用元・ローカル調整・ライセンスは [共通UI部品](src/components/ui/README.md) を参照してください。`components.json`と`@/` aliasを設定しています。CLIで部品を再取得する場合は、既存の配色・寸法・アクセシビリティの差分を確認してください。

## 接続設定・本番切替

`.env.example` の2変数を `.env.local` に設定します。Vercelでは同名変数を対象環境に設定してください。ブラウザへ渡すのはURLとPublishable Keyのみです。Google Client SecretはSupabaseのGoogle Providerに保存し、Vercel・GitHub・ソースに置きません。

- DB変更：`supabase/migrations`。本人のみのRLS、列単位GRANT、DB側revision加算。実DB権限テスト：`supabase/tests/user_data.sql`（全変更をrollback）。型は実DBから生成した `src/data/database.types.ts`。
- Supabase Auth：Googleのみ有効。Google Web OAuthのリダイレクトは `https://<project-ref>.supabase.co/auth/v1/callback`。SupabaseのSite URLは本番公開元、Redirect URLsは本番・対象Preview・localhostの正確なURLを登録します。公開元全体へのワイルドカードは使いません。
- E2E：ビルド時に架空の専用URLを設定してAPIをモックします。実Google同意画面や実DBへの接続は自動テストと分けます。
- Freeには自動バックアップ・SLAがなく、非利用で停止することがあります。停止時は管理者がSupabaseを復旧します。必要なデータ退避は管理者がDBから行います。

公開更新時は旧タブを閉じます。OAuth公開範囲、Supabase Provider・URL許可、Productionの2変数、PR HEADのCIとPreview実ログインを確認します。mainマージはVercelのProduction公開を伴うため承認後に実施します。公開後はログイン不要の端末保存→ログイン→移行→再読込→別端末取得→ログアウト後の端末保存を確認します。

ロールバックが必要な場合は管理者がクラウド最新データをDBから退避します。旧アプリはクラウドを読めず、残った古いLocalStorageへ戻るため、旧版への単純切替でデータ整合性を保証できません。クラウド対応版の修正を優先し、DBや旧データを削除しません。
