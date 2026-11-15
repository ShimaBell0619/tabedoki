import { sendNotification } from 'npm:web-push@4.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

export type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function adminClient() {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  const key = secretKeys ? (JSON.parse(secretKeys) as Record<string,string>).default : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  if (!key || !url) throw new Error('Supabase secret key or URL is missing');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function secretKey() {
  const json = Deno.env.get('SUPABASE_SECRET_KEYS');
  return json ? (JSON.parse(json) as Record<string,string>).default : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

export function vapidPublicKey() {
  const value = Deno.env.get('WEB_PUSH_PUBLIC_KEY');
  if (!value) throw new Error('WEB_PUSH_PUBLIC_KEY is not configured');
  return value;
}

export function jstDate() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export async function sendReminder(row: SubscriptionRow, test = false) {
  const privateKey = Deno.env.get('WEB_PUSH_PRIVATE_KEY');
  const subject = Deno.env.get('WEB_PUSH_SUBJECT');
  if (!privateKey || !subject) throw new Error('VAPID secrets are not configured');
  return await sendNotification(
    { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
    JSON.stringify({
      title: test ? 'たべどき — テスト通知' : '今日買った食品、登録しましたか？',
      body: test ? 'タップすると食品登録画面を開きます。' : '忘れないうちに追加しておきましょう。',
      kind: 'register',
    }),
    { vapidDetails: { subject, publicKey: vapidPublicKey(), privateKey }, TTL: 3600, urgency: 'normal', timeout: 10000 },
  );
}

export function pushStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = (error as { statusCode: unknown }).statusCode;
    if (typeof code === 'number') return code;
  }
  return undefined;
}
