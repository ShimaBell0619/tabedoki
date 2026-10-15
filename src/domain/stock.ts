import { MAX_ITEMS, isFood, normalizedName, type Food, type FoodCategory, type DeadlineKind, type QuantityUnit } from './food.ts';

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
