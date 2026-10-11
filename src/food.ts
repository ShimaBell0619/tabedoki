export type DeadlineKind = 'best-before' | 'use-by';
export type StoragePlace = 'chilled' | 'frozen' | 'pantry';
export type FoodStatus = 'active' | 'used' | 'discarded';

export const categories = {
  'eggs-dairy': '卵・乳製品', produce: '野菜・果物', 'meat-fish': '肉・魚',
  soy: '大豆製品', staples: '主食・パン', condiments: '調味料', other: 'その他',
} as const;
export const units = { item: '点', piece: '個', pack: 'パック', bag: '袋', bottle: '本' } as const;
export type FoodCategory = keyof typeof categories;
export type QuantityUnit = keyof typeof units;

export type Food = {
  id: string;
  name: string;
  category: FoodCategory;
  kind: DeadlineKind;
  deadline: string;
  quantity: number;
  unit: QuantityUnit;
  place: StoragePlace;
  status: FoodStatus;
};

type LegacyFood = Omit<Food, 'category' | 'unit'>;
export type FoodForm = Pick<Food, 'name' | 'category' | 'kind' | 'deadline' | 'quantity' | 'unit' | 'place'>;
export type FoodTemplate = Pick<Food, 'name' | 'category' | 'place' | 'unit'>;
export const foodTemplates: readonly FoodTemplate[] = [
  { name: 'たまご', category: 'eggs-dairy', place: 'chilled', unit: 'pack' },
  { name: '納豆', category: 'soy', place: 'chilled', unit: 'pack' },
  { name: '牛乳', category: 'eggs-dairy', place: 'chilled', unit: 'bottle' },
  { name: 'ヨーグルト', category: 'eggs-dairy', place: 'chilled', unit: 'piece' },
  { name: 'チーズ', category: 'eggs-dairy', place: 'chilled', unit: 'pack' },
  { name: '食パン', category: 'staples', place: 'pantry', unit: 'bag' },
  { name: '豆腐', category: 'soy', place: 'chilled', unit: 'pack' },
  { name: 'ハム', category: 'meat-fish', place: 'chilled', unit: 'pack' },
];

export function initialFoodForm(): FoodForm {
  return { name: '', category: 'other', kind: 'best-before', deadline: '', quantity: 1, unit: 'item', place: 'chilled' };
}

export function applyFoodCandidate(form: FoodForm, candidate: FoodTemplate | Food): FoodForm {
  return {
    name: candidate.name, category: candidate.category, place: candidate.place, unit: candidate.unit,
    kind: 'kind' in candidate ? candidate.kind : 'best-before', quantity: 1, deadline: form.deadline,
  };
}

/** items stays in registration order; display sorting must use a separate array. */
export function previousFoods(items: readonly Food[]): Food[] {
  const seen = new Set<string>();
  const result: Food[] = [];
  for (let i = items.length - 1; i >= 0 && result.length < 3; i--) {
    const key = items[i].name.trim().normalize('NFKC').toLocaleLowerCase('ja');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(items[i]);
  }
  return result;
}

export const LEGACY_STORAGE_KEY = 'tabedoki:foods:v1';
export const STORAGE_KEY = 'tabedoki:foods:v2';
export const MAX_ITEMS = 3000;
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;

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

function isLegacyFood(value: unknown): value is LegacyFood {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 100 &&
    typeof v.name === 'string' && v.name.trim().length > 0 && v.name.length <= 80 &&
    (v.kind === 'best-before' || v.kind === 'use-by') && validDate(v.deadline) &&
    typeof v.quantity === 'number' && Number.isInteger(v.quantity) && v.quantity >= 1 && v.quantity <= 999 &&
    (v.place === 'chilled' || v.place === 'frozen' || v.place === 'pantry') &&
    (v.status === 'active' || v.status === 'used' || v.status === 'discarded');
}

export function isFood(value: unknown): value is Food {
  if (!isLegacyFood(value)) return false;
  const v = value as unknown as Record<string, unknown>;
  return typeof v.category === 'string' && Object.hasOwn(categories, v.category) &&
    typeof v.unit === 'string' && Object.hasOwn(units, v.unit);
}

export function validateBackup(value: unknown): Food[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('バックアップ形式が正しくありません。');
  const backup = value as Record<string, unknown>;
  if ((backup.version !== 1 && backup.version !== 2) || !Array.isArray(backup.items)) throw new Error('対応していないバックアップ形式です。');
  if (backup.items.length > MAX_ITEMS) throw new Error('食品が多すぎます（最大3,000件）。');
  if (!backup.items.every(backup.version === 1 ? isLegacyFood : isFood)) throw new Error('食品データに不正な項目があります。');
  const ids = new Set(backup.items.map((item: LegacyFood) => item.id));
  if (ids.size !== backup.items.length) throw new Error('重複する食品IDがあります。');
  // Project known fields only; untrusted extra fields never enter persisted data.
  return (backup.items as Food[]).map(item => ({
    id: item.id, name: item.name, kind: item.kind, deadline: item.deadline,
    quantity: item.quantity, place: item.place, status: item.status,
    category: backup.version === 1 ? 'other' : item.category,
    unit: backup.version === 1 ? 'item' : item.unit,
  }));
}

export function makeBackup(items: Food[]): string {
  const valid = validateBackup({ version: 2, items });
  return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), items: valid }, null, 2);
}

type FoodStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type ReadFoodsResult = { items: Food[]; error: string; canExport: boolean };
export const READ_ERROR = '保存済みデータを読み込めません。バックアップから復元するか、確認のうえ空の状態から始めてください。';
export const SAVE_ERROR = '保存できませんでした。ブラウザの空き容量や設定を確認してください。変更は保存されていません。';

export function writeFoods(storage: Pick<Storage, 'setItem'>, items: Food[]): Food[] {
  const valid = validateBackup({ version: 2, items });
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, items: valid }));
  return valid;
}

function readStored(value: string, version: 1 | 2): Food[] {
  const data: unknown = JSON.parse(value);
  if (typeof data !== 'object' || data === null || (data as Record<string, unknown>).version !== version) {
    throw new Error('対応していない保存形式です。');
  }
  return validateBackup(data);
}

export function readFoods(storage: FoodStorage): ReadFoodsResult {
  try {
    const value = storage.getItem(STORAGE_KEY);
    if (value !== null) return { items: readStored(value, 2), error: '', canExport: true };
    const legacy = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === null) return { items: [], error: '', canExport: true };
    const items = readStored(legacy, 1);
    try {
      writeFoods(storage, items);
      const saved = storage.getItem(STORAGE_KEY);
      if (saved === null || JSON.stringify(readStored(saved, 2)) !== JSON.stringify(items)) throw new Error('移行結果が一致しません。');
    } catch {
      return { items, error: '新しい形式で保存できませんでした。元のデータは保持されています。JSONを保存し、空き容量や設定を確認して再読み込みしてください。現在は変更できません。', canExport: true };
    }
    return { items, error: '', canExport: true };
  } catch {
    return { items: [], error: READ_ERROR, canExport: false };
  }
}
