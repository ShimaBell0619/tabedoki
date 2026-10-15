import { validDate } from './deadline.ts';

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
export function normalizedName(name: string): string { return name.trim().normalize('NFKC').toLocaleLowerCase('ja'); }

export function initialFoodForm(): FoodForm {
  return { name: '', category: 'other', kind: 'best-before', deadline: '', quantity: 1, unit: 'item', place: 'chilled' };
}

export const MAX_ITEMS = 3000;

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
