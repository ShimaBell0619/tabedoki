import { adminClient, jstDate, pushStatus, sendReminder, vapidPublicKey } from '../_shared/reminder-push.ts';

const origins = new Set([
  'https://tabedoki.shimabell.dev',
  ...(Deno.env.get('REMINDER_ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean),
]);
const base64url = /^[A-Za-z0-9_-]+$/;
function headers(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Cache-Control': 'no-store', Vary: 'Origin',
  };
}
function json(origin: string, status: number, value: unknown) {
  return Response.json(value, { status, headers: headers(origin) });
}
function validEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === 'fcm.googleapis.com'
      && !u.port && !u.username && !u.password && !u.hash;
  } catch { return false; }
}
function validKeys(keys: unknown): keys is { p256dh: string; auth: string } {
  if (!keys || typeof keys !== 'object') return false;
  const k = keys as Record<string, unknown>;
  return typeof k.p256dh === 'string' && k.p256dh.length >= 80 && k.p256dh.length <= 160
    && base64url.test(k.p256dh) && typeof k.auth === 'string'
    && k.auth.length >= 16 && k.auth.length <= 64 && base64url.test(k.auth);
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  if (!origins.has(origin)) return new Response('Forbidden origin', { status: 403 });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
  if (!['GET', 'POST'].includes(request.method)) return json(origin, 405, { error: 'Method not allowed' });
  const bearer = request.headers.get('authorization')?.match(/^Bearer (.{20,4096})$/i)?.[1];
  if (!bearer) return json(origin, 401, { error: 'Googleログインが必要です。' });
  try {
    const admin = adminClient();
    const { data: { user }, error: authError } = await admin.auth.getUser(bearer);
    if (authError || !user) return json(origin, 401, { error: 'ログイン情報を確認できません。' });
    if (user.app_metadata?.provider !== 'google'
      && !(Array.isArray(user.app_metadata?.providers) && user.app_metadata.providers.includes('google'))) {
      return json(origin, 403, { error: 'Googleログインが必要です。' });
    }
    if (request.method === 'GET') {
      try { return json(origin, 200, { publicKey: vapidPublicKey() }); }
      catch { return json(origin, 503, { error: '通知サービスを準備中です。' }); }
    }
    const raw = await request.text();
    if (raw.length > 8192) return json(origin, 413, { error: 'Too large' });
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
    } catch { return json(origin, 400, { error: 'Invalid JSON' }); }

    if (body.action === 'save') {
      const subscription = body.subscription;
      if (!subscription || typeof subscription !== 'object') return json(origin, 400, { error: 'Invalid subscription' });
      const push = subscription as Record<string, unknown>;
      const days = body.weekdays;
      if (!validEndpoint(push.endpoint) || !validKeys(push.keys) || !Array.isArray(days)
        || days.length < 1 || days.length > 7 || new Set(days).size !== days.length
        || !days.every(d => Number.isInteger(d) && d >= 1 && d <= 7)
        || ![18,19,21].includes(Number(body.hour)) || typeof body.skipRegistered !== 'boolean') {
        return json(origin, 400, { error: 'Invalid notification settings' });
      }
      const { data: existing, error: readError } = await admin.from('reminder_subscriptions')
        .select('id,user_id').eq('endpoint', push.endpoint).maybeSingle();
      if (readError) throw readError;
      if (existing && existing.user_id !== user.id) {
        return json(origin, 409, { error: '別アカウントの通知設定が残っています。以前のアカウントで通知を解除してください。' });
      }
      const values = {
        id: existing?.id ?? crypto.randomUUID(), user_id: user.id,
        endpoint: push.endpoint, p256dh: push.keys.p256dh, auth: push.keys.auth,
        weekdays: days, reminder_hour: Number(body.hour),
        skip_registered: body.skipRegistered, enabled: true, last_seen_at: new Date().toISOString(),
      };
      const { error } = existing
        ? await admin.from('reminder_subscriptions').update(values).eq('id', existing.id).eq('user_id', user.id)
        : await admin.from('reminder_subscriptions').insert(values);
      if (error) {
        if (error.code === '23505') return json(origin, 409, { error: '通知設定の競合が発生しました。' });
        throw error;
      }
      return json(origin, 200, { ok: true });
    }
    if (body.action === 'registered') {
      const { error } = await admin.from('reminder_subscriptions').update({ last_registered_on: jstDate() })
        .eq('user_id', user.id).eq('enabled', true);
      if (error) throw error;
      return json(origin, 200, { ok: true });
    }
    if (body.action !== 'test' && body.action !== 'disable') return json(origin, 400, { error: 'Invalid action' });
    if (!validEndpoint(body.endpoint)) return json(origin, 400, { error: 'Invalid endpoint' });
    if (body.action === 'disable') {
      const { error } = await admin.from('reminder_subscriptions').delete()
        .eq('user_id', user.id).eq('endpoint', body.endpoint);
      if (error) throw error;
      return json(origin, 200, { ok: true });
    }
    const limit = new Date(Date.now() - 60_000).toISOString();
    const { data: row, error } = await admin.from('reminder_subscriptions')
      .update({ last_test_at: new Date().toISOString() }).eq('user_id', user.id)
      .eq('endpoint', body.endpoint).eq('enabled', true)
      .or('last_test_at.is.null,last_test_at.lt.' + limit)
      .select('id,endpoint,p256dh,auth').maybeSingle();
    if (error) throw error;
    if (!row) return json(origin, 429, { error: 'テスト通知は1分後にもう一度お試しください。' });
    try { await sendReminder(row, true); }
    catch (cause) {
      if ([404, 410].includes(pushStatus(cause) || 0)) {
        await admin.from('reminder_subscriptions').delete().eq('id', row.id);
      }
      throw cause;
    }
    return json(origin, 200, { ok: true });
  } catch (error) {
    console.error('Reminder API failed', error instanceof Error ? error.name : 'unknown');
    return json(origin, 503, { error: '通知サービスへの接続に失敗しました。' });
  }
});
