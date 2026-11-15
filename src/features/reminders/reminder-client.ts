// Registration reminders are available only while signed in with Google.
// The server validates the Supabase access token and never trusts a client-supplied user ID.
const env = (import.meta as ImportMeta & { env: Record<string,string> }).env;
const projectUrl = env.VITE_SUPABASE_URL;
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
export type ReminderSettings = {
  enabled: boolean; weekdays: number[]; hour: 18 | 19 | 21; skipRegistered: boolean;
};
const defaults: ReminderSettings = { enabled: false, weekdays: [1, 4, 7], hour: 19, skipRegistered: true };
const settingsKey = (user: string) => 'tabedoki-reminder-v2:' + user;
const endpointKey = (user: string) => 'tabedoki-reminder-endpoint-v2:' + user;
function storage(): Storage | null { try { return localStorage; } catch { return null; } }
export function readReminderSettings(userId: string): ReminderSettings {
  try {
    const raw = storage()?.getItem(settingsKey(userId));
    if (!raw) return { ...defaults };
    const value = JSON.parse(raw) as ReminderSettings;
    if (typeof value.enabled === 'boolean' && Array.isArray(value.weekdays)
      && value.weekdays.length >= 1 && value.weekdays.length <= 7
      && new Set(value.weekdays).size === value.weekdays.length
      && value.weekdays.every(d => Number.isInteger(d) && d >= 1 && d <= 7)
      && [18,19,21].includes(value.hour) && typeof value.skipRegistered === 'boolean') return value;
  } catch { /* Ignore malformed local settings. */ }
  return { ...defaults };
}
function supported() {
  return !!(projectUrl && isSecureContext && 'serviceWorker' in navigator
    && 'PushManager' in window && 'Notification' in window);
}
function base64Key(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const key = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) key[i] = bytes.charCodeAt(i);
  return key;
}
async function api(accessToken: string, method: 'GET' | 'POST', body?: Record<string, unknown>) {
  if (!projectUrl) throw new Error('通知サービスが設定されていません。');
  let response: Response;
  try {
    response = await fetch(projectUrl.replace(/\/$/, '') + '/functions/v1/reminder-preferences', {
      method,
      headers: { apikey: publishableKey, Authorization: 'Bearer ' + accessToken, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error('通知サービスに接続できません。'); }
  let data: { error?: string; publicKey?: string };
  try { data = await response.json() as typeof data; } catch { data = {}; }
  if (!response.ok) throw new Error(data.error || '通知サービスでエラーが発生しました。');
  return data;
}
async function endpoint(userId: string): Promise<string | null> {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/reminder-sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) return subscription.endpoint;
    }
  } catch { /* Fall back to the last registered endpoint. */ }
  return storage()?.getItem(endpointKey(userId)) ?? null;
}
export async function saveReminderSettings(userId: string, token: string, settings: ReminderSettings) {
  if (!settings.enabled) {
    const current = await endpoint(userId);
    if (current) await api(token, 'POST', { action: 'disable', endpoint: current });
    storage()?.setItem(settingsKey(userId), JSON.stringify(settings));
    storage()?.removeItem(endpointKey(userId));
    return;
  }
  if (!supported()) throw new Error('このブラウザはプッシュ通知に対応していません。');
  if (Notification.permission !== 'granted') {
    throw new Error('Chromeのサイト設定で通知を許可してください。');
  }
  const { publicKey } = await api(token, 'GET');
  if (!publicKey) throw new Error('通知サービスを準備中です。');
  const registration = await navigator.serviceWorker.register('/reminder-sw.js');
  const push = await registration.pushManager.getSubscription()
    || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64Key(publicKey) });
  const subscription = push.toJSON();
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
    throw new Error('通知の購読情報が取得できません。');
  }
  await api(token, 'POST', {
    action: 'save', subscription,
    weekdays: settings.weekdays, hour: settings.hour, skipRegistered: settings.skipRegistered,
  });
  storage()?.setItem(endpointKey(userId), subscription.endpoint);
  storage()?.setItem(settingsKey(userId), JSON.stringify(settings));
}
export async function testReminder(userId: string, token: string) {
  if (!readReminderSettings(userId).enabled) throw new Error('通知を有効にしてください。');
  const current = await endpoint(userId);
  if (!current) throw new Error('通知の購読情報がありません。');
  await api(token, 'POST', { action: 'test', endpoint: current });
}
export async function markFoodRegistered(_userId: string, token: string) {
  // Food registered on any signed-in device should suppress reminders on all devices.
  try { await api(token, 'POST', { action: 'registered' }); }
  catch { /* Never roll back a successful food registration due to a reminder error. */ }
}
export async function disableReminderOnLogout(userId: string, token: string) {
  const current = await endpoint(userId);
  if (current) await api(token, 'POST', { action: 'disable', endpoint: current });
  storage()?.setItem(settingsKey(userId), JSON.stringify({ ...readReminderSettings(userId), enabled: false }));
  storage()?.removeItem(endpointKey(userId));
}
