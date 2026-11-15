// Reminders are device-scoped and do not depend on the inventory data layer.
const projectUrl = (import.meta as ImportMeta & { env: Record<string,string> }).env.VITE_SUPABASE_URL;

export type ReminderSettings = {
  enabled: boolean;
  weekdays: number[];
  hour: 18 | 19 | 21;
  skipRegistered: boolean;
};

type DeviceIdentity = { deviceId: string; deviceToken: string };
const settingsKey = 'tabedoki-reminder-settings-v1';
const identityKey = 'tabedoki-reminder-device-v1';
const defaultSettings: ReminderSettings = { enabled: false, weekdays: [1, 4, 7], hour: 19, skipRegistered: true };

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}
export function readReminderSettings(): ReminderSettings {
  try {
    const raw = storage()?.getItem(settingsKey);
    if (!raw) return { ...defaultSettings };
    const value = JSON.parse(raw) as Partial<ReminderSettings>;
    if (typeof value.enabled === 'boolean' && Array.isArray(value.weekdays)
        && value.weekdays.every(day => Number.isInteger(day) && day >= 1 && day <= 7)
        && value.weekdays.length > 0 && value.weekdays.length <= 7 && new Set(value.weekdays).size === value.weekdays.length
        && [18,19,21].includes(Number(value.hour)) && typeof value.skipRegistered === 'boolean') {
      return value as ReminderSettings;
    }
  } catch { /* Do not trust malformed storage. */ }
  return { ...defaultSettings };
}
function readIdentity(): DeviceIdentity | null {
  try {
    const value = JSON.parse(storage()?.getItem(identityKey) || 'null') as DeviceIdentity | null;
    if (value && typeof value.deviceId === 'string' && typeof value.deviceToken === 'string') return value;
  } catch { /* Ignore malformed identity. */ }
  return null;
}
function deviceIdentity(): DeviceIdentity {
  const existing = readIdentity();
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const created = { deviceId: crypto.randomUUID(), deviceToken: token };
  if (!storage()) throw new Error('ブラウザの保存機能が利用できません。');
  storage()!.setItem(identityKey, JSON.stringify(created));
  return created;
}
function supported() {
  return !!(projectUrl && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
}
function base64Key(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
async function requestBackend(path: 'config' | 'write', payload?: Record<string,unknown>) {
  if (!projectUrl) throw new Error('通知機能の接続設定がありません。');
  const url = projectUrl.replace(/\/$/, '') + '/functions/v1/reminder-preferences';
  let response: Response;
  try {
    response = await fetch(url, { method: path === 'config' ? 'GET' : 'POST',
      headers: path === 'config' ? {} : { 'Content-Type': 'application/json' },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error('通知サービスに接続できません。通信状態をご確認ください。'); }
  let data: { error?: string; publicKey?: string };
  try { data = await response.json() as typeof data; } catch { data = {}; }
  if (!response.ok) throw new Error(data.error || '通知サービスでエラーが発生しました。');
  return data;
}
async function write(action: string, extra: Record<string,unknown> = {}) {
  const identity = deviceIdentity();
  return requestBackend('write', { action, ...identity, ...extra });
}
export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  if (!settings.enabled) {
    if (readIdentity()) await write('disable');
    storage()?.setItem(settingsKey, JSON.stringify(settings));
    // No need to unsubscribe: old tokens may still exist but server-side dispatch is disabled.
    return;
  }
  if (!supported()) throw new Error('このブラウザはプッシュ通知に対応していません。');
  // Permission request must be initiated directly from the save button gesture.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Chromeのサイト設定で通知を許可してください。');
  const { publicKey } = await requestBackend('config');
  if (!publicKey) throw new Error('通知サービスが準備されていません。');
  const registration = await navigator.serviceWorker.register('/reminder-sw.js');
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64Key(publicKey),
    });
  }
  const serialized = subscription.toJSON();
  if (!serialized.keys?.p256dh || !serialized.keys?.auth) throw new Error('通知の購読情報が取得できません。');
  await write('save', { subscription: serialized, weekdays: settings.weekdays,
    hour: settings.hour, skipRegistered: settings.skipRegistered });
  storage()?.setItem(settingsKey, JSON.stringify(settings));
}
export async function testReminder(): Promise<void> {
  if (!readReminderSettings().enabled) throw new Error('通知を有効にしてください。');
  await write('test');
}
export async function markFoodRegistered(): Promise<void> {
  if (!readReminderSettings().enabled || !readIdentity()) return;
  try { await write('registered'); }
  catch { /* Food registration already succeeded; never roll it back for a reminder failure. */ }
}
