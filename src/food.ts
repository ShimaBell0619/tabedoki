export type DeadlineKind = 'best-before' | 'use-by';
export type StoragePlace = 'chilled' | 'frozen' | 'pantry';
export type FoodStatus = 'active' | 'used' | 'discarded';

export type Food = {
  id: string;
  name: string;
  kind: DeadlineKind;
  deadline: string;
  quantity: number;
  place: StoragePlace;
  status: FoodStatus;
};

export const STORAGE_KEY = 'tabedoki:foods:v1';
export const MAX_ITEMS = 3000;
export const BACKUP_MAX_BYTES = 1024 * 1024;

export function localDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return y >= 1000 && y <= 9999 && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

/** Calendar-day delta, deliberately independent of timezone offsets and DST. */
export function daysLeft(deadline: string, today: string = localDate()): number {
  if (!validDate(deadline) || !validDate(today)) throw new Error('日付の形式が正しくありません。');
  return dayNumber(deadline) - dayNumber(today);
}

export type DeadlineState = 'expired' | 'today' | 'soon' | 'later';
export function deadlineState(deadline: string, today: string = localDate()): DeadlineState {
  const days = daysLeft(deadline, today);
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  return days <= 3 ? 'soon' : 'later';
}

export function deadlineLabel(deadline: string, today: string = localDate()): string {
  const days = daysLeft(deadline, today);
  return days < 0 ? `${Math.abs(days)}日超過` : days === 0 ? '今日まで' : days === 1 ? '明日まで' : `あと${days}日`;
}

export function isFood(value: unknown): value is Food {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 100 &&
    typeof v.name === 'string' && v.name.trim().length > 0 && v.name.length <= 80 &&
    (v.kind === 'best-before' || v.kind === 'use-by') && validDate(v.deadline) &&
    typeof v.quantity === 'number' && Number.isInteger(v.quantity) && v.quantity >= 1 && v.quantity <= 999 &&
    (v.place === 'chilled' || v.place === 'frozen' || v.place === 'pantry') &&
    (v.status === 'active' || v.status === 'used' || v.status === 'discarded');
}

export function validateBackup(value: unknown): Food[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('バックアップ形式が正しくありません。');
  const backup = value as Record<string, unknown>;
  if (backup.version !== 1 || !Array.isArray(backup.items)) throw new Error('対応していないバックアップ形式です。');
  if (backup.items.length > MAX_ITEMS) throw new Error('食品が多すぎます（最大3,000件）。');
  if (!backup.items.every(isFood)) throw new Error('食品データに不正な項目があります。');
  const ids = new Set(backup.items.map((item: Food) => item.id));
  if (ids.size !== backup.items.length) throw new Error('重複する食品IDがあります。');
  return backup.items;
}

export function makeBackup(items: Food[]): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items }, null, 2);
}

export function readFoods(storage: Pick<Storage, 'getItem'>): { items: Food[]; error: string } {
  try {
    const value = storage.getItem(STORAGE_KEY);
    return value === null ? { items: [], error: '' } : { items: validateBackup(JSON.parse(value)), error: '' };
  } catch {
    return { items: [], error: '保存済みデータを読み込めません。バックアップから復元するか、確認のうえ初期化してください。' };
  }
}