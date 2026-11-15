import { adminClient, jstDate, pushStatus, sendReminder, vapidPublicKey } from '../_shared/reminder-push.ts';

const productionOrigin = 'https://tabedoki.shimabell.dev';
const allowedOrigins = new Set([productionOrigin, ...((Deno.env.get('REMINDER_ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean))]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const base64url = /^[A-Za-z0-9_-]+$/;
const publicKey = /^[A-Za-z0-9_-]{70,100}$/;

function headers(origin: string) {
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'apikey, content-type', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
}
function response(origin: string, status: number, body: unknown) {
  return Response.json(body, { status, headers: headers(origin) });
}
async function hashToken(token: string) {
  const value = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(value)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function validEndpoint(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'fcm.googleapis.com'
      && url.port === '' && url.username === '' && url.password === '' && !url.hash;
  } catch { return false; }
}
function validKeys(keys: unknown): keys is {p256dh: string; auth: string} {
  if (!keys || typeof keys !== 'object') return false;
  const {p256dh, auth} = keys as Record<string,unknown>;
  return typeof p256dh === 'string' && p256dh.length >= 80 && p256dh.length <= 160 && base64url.test(p256dh)
    && typeof auth === 'string' && auth.length >= 16 && auth.length <= 64 && base64url.test(auth);
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  if (!allowedOrigins.has(origin)) return new Response('Forbidden origin', { status: 403 });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method === 'GET') {
    try { return response(origin, 200, { publicKey: vapidPublicKey() }); }
    catch { return response(origin, 503, { error: '通知設定の準備が完了していません。' }); }
  }
  if (request.method !== 'POST') return response(origin, 405, { error: 'Unsupported method' });
  if (Number(request.headers.get('content-length') || 0) > 8192) return response(origin, 413, { error: 'Too large' });
  let body: Record<string,unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return response(origin, 413, { error: 'Too large' });
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
  } catch { return response(origin, 400, { error: 'Invalid JSON' }); }
  const { action, deviceId, deviceToken } = body;
  if (!uuid.test(String(deviceId)) || typeof deviceToken !== 'string'
    || deviceToken.length < 40 || deviceToken.length > 100 || !base64url.test(deviceToken)) {
    return response(origin, 400, { error: 'Invalid device credentials' });
  }
  try {
    const admin = adminClient();
    const tokenHash = await hashToken(deviceToken);
    const { data: existing, error: readError } = await admin.from('reminder_subscriptions')
      .select('id,token_hash,endpoint,p256dh,auth').eq('id', deviceId as string).maybeSingle();
    if (readError) throw readError;
    if (existing && existing.token_hash !== tokenHash) return response(origin, 403, { error: 'Invalid device credentials' });
    if (action === 'save') {
      const { subscription, weekdays, hour, skipRegistered } = body;
      if (!subscription || typeof subscription !== 'object') return response(origin, 400, { error: 'Invalid subscription' });
      const push = subscription as Record<string,unknown>;
      if (!validEndpoint(push.endpoint) || !validKeys(push.keys) || !Array.isArray(weekdays)
        || weekdays.length < 1 || weekdays.length > 7 || new Set(weekdays).size !== weekdays.length
        || !weekdays.every(d => Number.isInteger(d) && Number(d) >= 1 && Number(d) <= 7)
        || ![18,19,21].includes(Number(hour)) || typeof skipRegistered !== 'boolean') {
        return response(origin, 400, { error: 'Invalid notification settings' });
      }
      const entry = { id: deviceId, token_hash: tokenHash, endpoint: push.endpoint as string,
        p256dh: (push.keys as {p256dh:string;auth:string}).p256dh, auth: (push.keys as {p256dh:string;auth:string}).auth, weekdays, reminder_hour: hour,
        skip_registered: skipRegistered, enabled: true, last_seen_at: new Date().toISOString() };
      const result = existing
        ? await admin.from('reminder_subscriptions').update(entry).eq('id', deviceId as string).eq('token_hash', tokenHash)
        : await admin.from('reminder_subscriptions').insert(entry);
      if (result.error) {
        if (result.error.code === '23505') return response(origin, 409, { error: 'この通知先は別の端末設定に登録されています。' });
        throw result.error;
      }
      return response(origin, 200, { ok: true });
    }
    if (!existing) return response(origin, 404, { error: '通知設定が見つかりません。' });
    if (action === 'disable') {
      const { error } = await admin.from('reminder_subscriptions').update({ enabled: false }).eq('id', deviceId as string).eq('token_hash',tokenHash);
      if (error) throw error;
      return response(origin, 200, { ok: true });
    }
    if (action === 'registered') {
      const { error } = await admin.from('reminder_subscriptions')
        .update({ last_registered_on: jstDate() }).eq('id', deviceId as string).eq('token_hash',tokenHash).eq('enabled',true);
      if (error) throw error;
      return response(origin, 200, { ok: true });
    }
    if (action === 'test') {
      const limit = new Date(Date.now() - 60000).toISOString();
      const { data, error } = await admin.from('reminder_subscriptions')
        .update({ last_test_at: new Date().toISOString() }).eq('id', deviceId as string).eq('token_hash',tokenHash)
        .eq('enabled',true).or('last_test_at.is.null,last_test_at.lt.' + limit)
        .select('id,endpoint,p256dh,auth').maybeSingle();
      if (error) throw error;
      if (!data) return response(origin, 429, { error: 'テスト通知は1分後にもう一度お試しください。' });
      try {
        await sendReminder(data, true);
      } catch (err) {
        if ([404,410].includes(pushStatus(err) || 0)) await admin.from('reminder_subscriptions').update({ enabled: false }).eq('id', deviceId as string);
        throw err;
      }
      return response(origin, 200, { ok: true });
    }
    return response(origin, 400, { error: 'Unknown action' });
  } catch (error) {
    // Do not log subscription endpoints, encryption keys or device credentials.
    console.error('Reminder preference request failed', error instanceof Error ? error.name : 'unknown');
    return response(origin, 503, { error: '通知の保存・送信に失敗しました。時間をおいて再試行してください。' });
  }
});
