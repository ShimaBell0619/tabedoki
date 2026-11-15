# 登録リマインダーの配備・運用

## 公開順序（mainへのマージは本番公開を伴う）

1. 変更前のSupabaseデータを管理者が退避し、通知スキーマのマイグレーションを適用する。既存のuser_dataには変更なし。
2. VAPID鍵ペアを **一度だけ** 作成し、安全な場所に保管する。鍵の再生成は既存Push購読を無効にする。
3. Supabase Edge Functionシークレットに以下を登録する（秘密鍵はGitHubやVercelに置かない）。

   - WEB_PUSH_PUBLIC_KEY: 公開VAPID鍵
   - WEB_PUSH_PRIVATE_KEY: 秘密VAPID鍵
   - WEB_PUSH_SUBJECT: mailto:形式の管理連絡先
   - REMINDER_ALLOWED_ORIGINS: Previewから試す場合のみ、許可するURL（カンマ区切り）。Productionは https://tabedoki.shimabell.dev を既定で許可する。

4. `supabase functions deploy reminder-preferences --no-verify-jwt`
5. `supabase functions deploy send-registration-reminders --no-verify-jwt`
6. Android Chromeで「通知の設定」→保存→テスト通知→通知タップ→食品登録フォームを検証する。
7. 適切なタイミングで本番mainの公開とCronジョブを有効化する。

VAPID鍵は端末上で次のコマンドから**一度だけ**生成する。表示した秘密鍵はGitHub・チャット・公開ブラウザ側環境変数に貼らず、Supabase Dashboard の **Edge Functions → Secrets** へ設定する。

```sh
npx --yes web-push@4.0.0 generate-vapid-keys
```

- `Public Key` → `WEB_PUSH_PUBLIC_KEY`
- `Private Key` → `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT` は連絡可能な `mailto:...` 形式で登録する
- Secretsは [対象プロジェクトの設定画面](https://supabase.com/dashboard/project/fbwvfczzzrkvrgltwpmt/functions/secrets) から登録できる。反映後にテスト通知を確認する
- 公開後にVAPID鍵を再生成すると、既存購読の再登録が必要になる。秘密鍵を適切に保管する

既存のtabedoki本番プロジェクトには通知マイグレーション `20261115031838_registration_reminders` が適用済みで、Edge Functionsもv1を配備済み（2026-11-15時点）。**同じDBマイグレーションを再適用しない**。

## Cronの設定

Supabase Dashboardでpg_cronとpg_netを有効にする。Vaultに以下2つのシークレットを保存してから、管理者がSQL Editorでジョブを作成する。

- `tabedoki_project_url`: `https://<project-ref>.supabase.co`
- `tabedoki_function_secret`: Supabaseの **secret** key。publishable keyは不可。

```sql
-- それぞれの値を管理者がVaultへ登録する（例の値を実行しない）
-- select vault.create_secret('https://project-ref.supabase.co', 'tabedoki_project_url');
-- select vault.create_secret('sb_secret_...', 'tabedoki_function_secret');

select cron.schedule(
  'tabedoki-registration-reminders',
  '0 9,10,12 * * *', -- UTC。日本時間18:00、19:00、21:00
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'tabedoki_project_url')
        || '/functions/v1/send-registration-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'tabedoki_function_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $$
);
```

DB側はJSTの曜日・時刻・当日登録済み・最後の送信試行日を検査するため、Cronが誤った時刻に呼ばれても送信しない。ジョブは再作成せず、同じ名前で設定を更新する。停止は `select cron.unschedule('tabedoki-registration-reminders');`。

## セキュリティ・障害時

- 登録情報テーブルには匿名・ログイン済みユーザーのSQL権限とRLSポリシーを付与しない。Edge Functionのみが秘密キーで読み書きする。
- `reminder-preferences` は匿名端末向けの公開API。書き込みには端末ごとのランダムトークン（サーバーはSHA-256だけ保持）を使い、接続元Originを制限する。Originは完全な認証境界ではないため、新規登録には接続元IP相当のハッシュ単位で1時間10件の登録制限も設ける。cf-connecting-ipがSupabaseの公開入口で上書きされていることは本番で確認する。本番アクセスログで異常な新規購読数も監視する。
- Push endpointはAndroid ChromeのFCMホストだけを許可し、任意URLへの送信を許さない。
- 配信APIはSupabase secret keyを要求する。購読情報や秘密鍵をログに出さない。
- 登録や在庫追加の保存に成功した後だけ、登録済みマーカーを通知APIへ送る。マーカー送信失敗は食品の保存を取り消さないため、その日の通知が省略されない可能性は残る。
- 送信は成功を保証するものではない。DBは同日重複送信を抑えるため送信**試行前**に送信日を記録する。失敗しても同日は再送せず、次の設定曜日に送信する。FCMの404/410は購読を停止する。
- 端末のブラウザデータ削除後にサーバーに古い購読が残ることがある。Pushサービスで404/410が返った購読は停止し、不要購読の定期削除は運用時に検討する。
- クラウド食品データと通知購読情報は別の保存先・ライフサイクルにする。VAPID鍵ローテーション時は全端末に再購読が必要。

## 検証・ロールバック

- CI：既存単体、E2E、DBテストを含む全ジョブを確認する。
- 実端末：通知許可を初めて要求するケース、拒否、通知タップ（タブ閉／開）、テスト通知制限、通知停止、再登録、ローカル保存・クラウド保存。
- 障害時はまずCronを停止し、次に配信関数を無効化する。通知テーブルを削除してはいけない。
- アプリのロールバックで通知購読テーブルは残す。旧UIでは通知停止操作がないため、配信ジョブも必ず停止する。
