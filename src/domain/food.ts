import { validDate } from './deadline.ts';

export type DeadlineKind = 'best-before' | 'use-by';
export type StoragePlace = 'chilled' | 'frozen' | 'pantry';
export type FoodStatus = 'active' | 'used' | 'discarded';
export type Consumption = 'eat' | 'use' | 'drink';
export type TrackingMode = 'count' | 'volume';
export type VolumePercent = 25 | 50 | 75 | 100;
export function defaultVolumeTracking(name: string, unit: QuantityUnit): boolean {
  return unit === 'bottle' && /牛乳|ミルク|ジュース|飲料|ドリンク|お茶|しょうゆ|醤油|みりん|酢|食用油|オリーブオイル|ソース|ドレッシング|めんつゆ|白だし/.test(name);
}
export function tracksVolume(food: Pick<Food, 'name' | 'unit' | 'trackingMode'>): boolean {
  return food.trackingMode === 'volume' || (food.trackingMode !== 'count' && defaultVolumeTracking(food.name, food.unit));
}
export function volumeLabel(percent: VolumePercent): string {
  return ({100: '満量', 75: '多め', 50: '半分', 25: '少し'} as const)[percent];
}
export const consumptionLabels: Record<Consumption, string> = { eat: '食べる', use: '使う', drink: '飲む' };
export function inferConsumption(name: string, category: FoodCategory): Consumption {
  if (category === 'condiments') return 'use';
  return /牛乳|ミルク|ジュース|飲料|ドリンク|お茶/.test(name) ? 'drink' : 'eat';
}
export function consumptionAction(consumption: Consumption, unit: string, last: boolean): string {
  if (last) return { eat: '食べ終わった', use: '使い終わった', drink: '飲み終わった' }[consumption];
  return `1${unit}${{ eat: '食べた', use: '使い終わった', drink: '飲み終わった' }[consumption]}`;
}

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
  /** Maximum stock level observed for the segmented bar. */
  initialQuantity: number;
  consumption: Consumption;
  /** Optional v5 fields: omitted on older items. Volume is one partially used container;
   * the remaining (quantity - 1) containers are treated as full. */
  trackingMode?: TrackingMode;
  volumePercent?: VolumePercent;
  unit: QuantityUnit;
  place: StoragePlace;
  status: FoodStatus;
  lowStock: boolean;
};

export type LegacyFood = Omit<Food, 'category' | 'unit' | 'lowStock' | 'initialQuantity' | 'consumption'>;
export type FoodForm = Pick<Food, 'name' | 'category' | 'kind' | 'deadline' | 'quantity' | 'unit' | 'place' | 'consumption'> & { trackingMode?: TrackingMode };
export type FoodTemplate = Pick<Food, 'id' | 'name' | 'category' | 'kind' | 'quantity' | 'place' | 'unit' | 'consumption'>;
export function normalizedName(name: string): string { return name.trim().normalize('NFKC').toLocaleLowerCase('ja'); }

export function initialFoodForm(): FoodForm {
  return { name: '', category: 'other', kind: 'best-before', deadline: '', quantity: 1, unit: 'item', place: 'chilled', consumption: 'eat' };
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

export function isV3Food(value: unknown): value is Omit<Food, 'lowStock' | 'initialQuantity' | 'consumption'> {
  if (!isLegacyFood(value)) return false;
  const v = value as unknown as Record<string, unknown>;
  return typeof v.category === 'string' && Object.hasOwn(categories, v.category) &&
    typeof v.unit === 'string' && Object.hasOwn(units, v.unit);
}

export function isV4Food(value: unknown): value is Omit<Food, 'initialQuantity' | 'consumption'> {
  return isV3Food(value) && typeof (value as Record<string, unknown>).lowStock === 'boolean';
}
export function isFood(value: unknown): value is Food {
  if (!isV4Food(value)) return false;
  const v = value as unknown as Record<string, unknown>;
  return typeof v.initialQuantity === 'number' && Number.isInteger(v.initialQuantity) &&
    v.initialQuantity >= (v.quantity as number) && v.initialQuantity <= 999 &&
    (v.consumption === 'eat' || v.consumption === 'use' || v.consumption === 'drink') &&
    (v.trackingMode === undefined || v.trackingMode === 'count' || v.trackingMode === 'volume') &&
    (v.volumePercent === undefined || ((v.volumePercent === 25 || v.volumePercent === 50 ||
      v.volumePercent === 75 || v.volumePercent === 100) && v.trackingMode !== 'count'));
}
