# 登録リマインダー（Googleログイン専用）

## 利用者の操作

1. 既存のGoogleログインでクラウド保存を使用する。
2. 右上の3点メニュー →「通知の設定」から曜日・時刻を選び、通知を有効にする。
3. Chromeの通知許可を一度だけ承認する。

ログインしない場合は通知設定メニューを表示しない。個人用の匿名通知トークンやIPごとの登録管理は使用しない。通知先はGoogleアカウントとブラウザのPush購読先の組み合わせで管理する。通知を停止するとその端末の購読レコードを削除する。ログアウト時にも削除を試みる（オフラインでは停止が失敗し得る）。

## 開発者側の初期設定

**VAPID鍵はWeb Pushそのものに必須です。Googleログインで省略できません。** ただし、鍵の生成・保存は開発者の一度限りの初期設定であり、利用者には表示しません。

- 通知用DBの旧マイグレーション `20261115031838_registration_reminders` は既に本番に反映済み。既存購読数0件を確認後、`google_authenticated_reminders` を一度適用して `user_id` を追加し、匿名専用の `token_hash` とレート制限テーブルを廃止する。
- Edge Functions `reminder-preferences` と `send-registration-reminders` を新コードで更新する。どちらも `verify_jwt=false` だが、前者はSupabase AuthのGoogleユーザーJWTをサーバー側で検証し、後者はSupabaseのsecret keyで配信者を認証する。
- <https://supabase.com/dashboard/project/fbwvfczzzrkvrgltwpmt/functions/secrets> に以下のVAPID設定を登録する：
  - `WEB_PUSH_PUBLIC_KEY`: Web Pushの公開鍵
  - `WEB_PUSH_PRIVATE_KEY`: Web Pushの秘密鍵
  - `WEB_PUSH_SUBJECT`: 通知送信者の `mailto:...` 形式の連絡先
- 鍵はPCで `npx --yes web-push@4.0.0 generate-vapid-keys` を一度だけ実行して生成可能。**秘密鍵をGitHub・チャット・Vercelのクライアント公開環境変数に貼らない**。鍵の再生成には全端末の再購読が必要。
- `REMINDER_ALLOWED_ORIGINS` は必要な場合のみPreview originをカンマ区切りで設定。Production originは既定で許可。

## 定期配信

Supabaseの `pg_cron` と `pg_net` から、UTCの `0 9,10,12 * * *`（日本時間18/19/21時）で配信関数を実行する。スケジュールはDB側でも曜日・時刻・当日の登録日・送信済み日を検証する。

まずSupabase Vaultに `tabedoki_project_url` と `tabedoki_function_secret` を登録する。後者はSupabaseのsecret keyであり、Webブラウザに渡さない。SQLでCronのHTTPヘッダーへ渡すときは `apikey` を使用する。

```sql
select cron.schedule(
  'tabedoki-registration-reminders',
  '0 9,10,12 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='tabedoki_project_url')
       || '/functions/v1/send-registration-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='tabedoki_function_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
```

停止する際は `select cron.unschedule('tabedoki-registration-reminders');` を実行する。VAPID未設定、実機未確認の状態ではCronを有効化しない。

## 動作確認・安全性

- PostgreSQL: `reminder_subscriptions` はRLSを有効化し、anon/authenticatedに直接のSELECT/INSERT/UPDATE/DELETE権限を付与しない。資格情報・通知先は信頼済みEdge Functionだけが管理する。
- Edge Function: `auth.getUser(token)` で本人確認し、`user.app_metadata` にGoogle連携を持つユーザーに限定する。クライアントからの `user_id` は受け取らない。送信先はFCMのHTTPS endpointだけを許可する。
- ログアウト時に購読停止を試みる。通信不能の場合はログアウトを優先するので、配信停止が間に合わない可能性がある。その際は再ログインして通知を無効化する。
- テスト通知は1端末・1分に1回に制限する。Pushレスポンスの404/410は失効した購読として削除する。
- 実機Android Chromeで、許可/拒否、登録・無効化、ログアウト、通知タップからの直接登録、閉じたブラウザへの通知、登録済み日の省略を確認する。
- 重大障害の場合はCronを停止し、送信関数を停止する。既存の `user_data` や食品情報は変更しない。
