export type DeadlineKind = 'best-before' | 'use-by';
export type StoragePlace = 'chilled' | 'frozen' | 'pantry';
export type FoodStatus = 'active' | 'used' | 'discarded';

export const categories = {
  'eggs-dairy': '卵・乳製品', produce: '野菜・果物', 'meat-fish': '肉・魚',
  soy: '大豆製品', staples: '主食・麺・パン', 'retort-canned': 'レトルト・缶詰',
  condiments: '調味料', other: 'その他',
} as const;
export const places = { chilled: '冷蔵', frozen: '冷凍', pantry: '常温' } as const;
export const kinds = { 'best-before': '賞味期限', 'use-by': '消費期限' } as const;
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
  lowStock: boolean;
};

export type LegacyFood = Omit<Food, 'category' | 'unit' | 'lowStock'>;
export type FoodForm = Pick<Food, 'name' | 'category' | 'kind' | 'deadline' | 'quantity' | 'unit' | 'place'>;
export type FoodTemplate = Pick<Food, 'id' | 'name' | 'category' | 'kind' | 'quantity' | 'place' | 'unit'>;
const starterTemplates: readonly Pick<FoodTemplate, 'name' | 'category' | 'place' | 'unit'>[] = [
  { name: 'たまご', category: 'eggs-dairy', place: 'chilled', unit: 'pack' },
  { name: '納豆', category: 'soy', place: 'chilled', unit: 'pack' },
  { name: '牛乳', category: 'eggs-dairy', place: 'chilled', unit: 'bottle' },
  { name: 'ヨーグルト', category: 'eggs-dairy', place: 'chilled', unit: 'piece' },
  { name: 'チーズ', category: 'eggs-dairy', place: 'chilled', unit: 'pack' },
  { name: '食パン', category: 'staples', place: 'pantry', unit: 'bag' },
  { name: '豆腐', category: 'soy', place: 'chilled', unit: 'pack' },
  { name: 'ハム', category: 'meat-fish', place: 'chilled', unit: 'pack' },
  { name: 'パスタ', category: 'staples', place: 'pantry', unit: 'bag' },
  { name: 'レトルトカレー', category: 'retort-canned', place: 'pantry', unit: 'piece' },
];

export function defaultTemplates(): FoodTemplate[] {
  return starterTemplates.map((template, i) => ({ id: `default-${i}`, name: template.name, category: template.category, kind: 'best-before', quantity: 1, unit: template.unit, place: template.place }));
}
export const MAX_TEMPLATES = 50;
export function normalizedName(name: string): string { return name.trim().normalize('NFKC').toLocaleLowerCase('ja'); }

export function validateTemplates(value: unknown): FoodTemplate[] {
  if (!Array.isArray(value) || value.length > MAX_TEMPLATES) throw new Error('定番食品は最大50件です。');
  const ids = new Set<string>();
  const names = new Set<string>();
  return value.map(item => {
    if (!isFood({ ...item, deadline: '2000-01-01', status: 'active', lowStock: false })) throw new Error('定番食品の入力項目を確認してください。');
    if (ids.has(item.id)) throw new Error('重複する定番食品IDがあります。');
    const name = item.name.trim();
    const key = normalizedName(name);
    if (names.has(key)) throw new Error('同じ名前の定番食品が既にあります。');
    ids.add(item.id); names.add(key);
    return { id: item.id, name, category: item.category, kind: item.kind, quantity: item.quantity, unit: item.unit, place: item.place };
  });
}

export function initialFoodForm(): FoodForm {
  return { name: '', category: 'other', kind: 'best-before', deadline: '', quantity: 1, unit: 'item', place: 'chilled' };
}

export function applyFoodCandidate(form: FoodForm, candidate: FoodTemplate | Food): FoodForm {
  return {
    name: candidate.name, category: candidate.category, place: candidate.place, unit: candidate.unit,
    kind: candidate.kind, quantity: 'deadline' in candidate ? 1 : candidate.quantity, deadline: form.deadline,
  };
}

/** items stays in registration order; display sorting must use a separate array. */
export function previousFoods(items: readonly Food[]): Food[] {
  const seen = new Set<string>();
  const result: Food[] = [];
  for (let i = items.length - 1; i >= 0 && result.length < 3; i--) {
    const key = normalizedName(items[i].name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(items[i]);
  }
  return result;
}

export const MAX_ITEMS = 3000;

export type FoodGroup = {
  key: string;
  name: string;
  category: FoodCategory;
  kind: DeadlineKind;
  unit: QuantityUnit;
  items: Food[];
  primary: Food;
  quantity: number;
  activeQuantity: number;
  finishedQuantity: number;
  lowStock: boolean;
};

/** Storage place and deadline identify lots, not the product displayed on the list. */
export function foodGroupKey(food: Pick<Food, 'name' | 'category' | 'kind' | 'unit'>): string {
  return JSON.stringify([normalizedName(food.name), food.category, food.unit, food.kind]);
}

/** Group only for display. The persisted records, their IDs and their status stay independent. */
export function groupFoods(items: readonly Food[]): FoodGroup[] {
  const grouped = new Map<string, Food[]>();
  for (const item of items) {
    const key = foodGroupKey(item);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  return Array.from(grouped, ([key, entries]) => {
    const ordered = [...entries].sort((a, b) => a.deadline.localeCompare(b.deadline) || a.place.localeCompare(b.place));
    const primary = ordered.find(item => item.status === 'active') ?? ordered[0];
    return {
      key, name: primary.name, category: primary.category, kind: primary.kind, unit: primary.unit,
      items: ordered, primary,
      quantity: ordered.reduce((sum, item) => sum + item.quantity, 0),
      activeQuantity: ordered.filter(item => item.status === 'active').reduce((sum, item) => sum + item.quantity, 0),
      finishedQuantity: ordered.filter(item => item.status !== 'active').reduce((sum, item) => sum + item.quantity, 0),
      lowStock: ordered.some(item => item.status === 'active' && item.lowStock),
    };
  }).sort((a, b) => a.primary.deadline.localeCompare(b.primary.deadline) || a.name.localeCompare(b.name, 'ja'));
}

/** Add a new lot or increase only the matching active lot, leaving completed lots untouched. */
export function addStockToFoods(
  items: readonly Food[], base: Food, lot: Pick<Food, 'deadline' | 'quantity' | 'place'>, id: string,
): Food[] {
  const candidate: Food = {
    id, name: base.name.trim(), category: base.category, kind: base.kind, unit: base.unit,
    ...lot, status: 'active', lowStock: false,
  };
  if (!isFood(candidate)) throw new Error('期限・数量・保存場所を確認してください。');
  const existing = items.find(item =>
    item.status === 'active' && foodGroupKey(item) === foodGroupKey(base) &&
    item.deadline === lot.deadline && item.place === lot.place);
  if (existing) {
    if (existing.quantity + lot.quantity > 999) throw new Error('同じ期限・保存場所の在庫は999まで登録できます。');
    return items.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + lot.quantity } : item);
  }
  if (items.length >= MAX_ITEMS) throw new Error('食品は最大3,000件まで登録できます。');
  return [...items, candidate];
}


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

/** Keep draft input untouched; only derive a validated ISO calendar date. */
export function parseDeadline(raw: string): string | null {
  const value = raw.trim();
  const iso = /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}` : value;
  return validDate(iso) ? iso : null;
}

export const deadlineFilters = {
  all: 'すべて', expired: '期限切れ', fortnight: '0〜14日', month: '15〜30日',
  long: '31日以降', today: '今日まで', soon: '1〜3日', later: '4日以上',
} as const;
export type DeadlineFilter = keyof typeof deadlineFilters;
export function matchesDeadline(deadline: string, today: string, filter: DeadlineFilter): boolean {
  const days = daysLeft(deadline, today);
  switch (filter) {
    case 'all': return true;
    case 'expired': return days < 0;
    case 'fortnight': return days >= 0 && days <= 14;
    case 'month': return days >= 15 && days <= 30;
    case 'long': return days >= 31;
    case 'today': return days <= 0;
    case 'soon': return days >= 1 && days <= 3;
    case 'later': return days >= 4;
  }
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

export function isLegacyFood(value: unknown): value is LegacyFood {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 100 &&
    typeof v.name === 'string' && v.name.trim().length > 0 && v.name.length <= 80 &&
    (v.kind === 'best-before' || v.kind === 'use-by') && validDate(v.deadline) &&
    typeof v.quantity === 'number' && Number.isInteger(v.quantity) && v.quantity >= 1 && v.quantity <= 999 &&
    (v.place === 'chilled' || v.place === 'frozen' || v.place === 'pantry') &&
    (v.status === 'active' || v.status === 'used' || v.status === 'discarded');
}

export function isV3Food(value: unknown): value is Omit<Food, 'lowStock'> {
  if (!isLegacyFood(value)) return false;
  const v = value as unknown as Record<string, unknown>;
  return typeof v.category === 'string' && Object.hasOwn(categories, v.category) &&
    typeof v.unit === 'string' && Object.hasOwn(units, v.unit);
}

export function isFood(value: unknown): value is Food {
  return isV3Food(value) && typeof (value as Record<string, unknown>).lowStock === 'boolean';
}
