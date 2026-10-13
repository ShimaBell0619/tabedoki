import { initialFoodForm, isFood, normalizedName, type Food, type FoodForm, type FoodTemplate } from './food.ts';
import type { AppData } from './storage.ts';

export type ShoppingItem = FoodTemplate & { bought: boolean };
export const MAX_SHOPPING = 300;

export function validateShopping(value: unknown): ShoppingItem[] {
  if (!Array.isArray(value) || value.length > MAX_SHOPPING) throw new Error('買い物は購入済みを含め最大300件です。');
  const ids = new Set<string>();
  const pendingNames = new Set<string>();
  return value.map(item => {
    if (!isFood({ ...item, deadline: '2000-01-01', status: 'active', lowStock: false }) || typeof item.bought !== 'boolean') {
      throw new Error('買い物データに不正な項目があります。');
    }
    if (ids.has(item.id)) throw new Error('重複する買い物IDがあります。');
    const name = item.name.trim();
    const key = normalizedName(name);
    if (!item.bought && pendingNames.has(key)) throw new Error('同名の未購入項目があります。');
    ids.add(item.id);
    if (!item.bought) pendingNames.add(key);
    return { id: item.id, name, category: item.category, kind: item.kind, quantity: item.quantity, unit: item.unit, place: item.place, bought: item.bought };
  });
}

/** Copies initial values only. Inventory quantity is deliberately reset to one. */
export function shoppingFrom(source: string | Food | FoodTemplate, id: string): ShoppingItem {
  const candidate = typeof source === 'string' ? { ...initialFoodForm(), name: source } : source;
  return validateShopping([{
    id, name: candidate.name, category: candidate.category, kind: candidate.kind,
    quantity: 'deadline' in candidate ? 1 : candidate.quantity, unit: candidate.unit, place: candidate.place, bought: false,
  }])[0];
}

export function addShopping(items: readonly ShoppingItem[], candidate: ShoppingItem): ShoppingItem[] {
  if (items.some(item => !item.bought && normalizedName(item.name) === normalizedName(candidate.name))) return [...items];
  return validateShopping([...items, candidate]);
}

export function setBought(items: readonly ShoppingItem[], id: string, bought: boolean): ShoppingItem[] {
  if (!items.some(item => item.id === id)) throw new Error('買い物項目が見つかりません。');
  return validateShopping(items.map(item => item.id === id ? { ...item, bought } : item));
}

export function replenishmentCandidates(foods: readonly Food[], shopping: readonly ShoppingItem[]): Food[] {
  const groups = new Map<string, Food[]>();
  for (const food of foods) {
    if (food.status !== 'active') continue;
    const name = normalizedName(food.name);
    const group = groups.get(name);
    if (group) group.push(food);
    else groups.set(name, [food]);
  }
  const listed = new Set(shopping.map(item => normalizedName(item.name)));
  return [...groups.entries()].filter(([name, group]) => !listed.has(name) && group.every(food => food.lowStock)).map(([, group]) => group[0]);
}

export function foodFormFromShopping(item: ShoppingItem): FoodForm {
  return { name: item.name, category: item.category, kind: item.kind, quantity: item.quantity, unit: item.unit, place: item.place, deadline: '' };
}

/** The caller validates and persists this complete replacement in a single write. */
export function registerPurchase(data: AppData, shoppingId: string, food: Food): AppData {
  const item = data.shopping.find(item => item.id === shoppingId);
  if (!item?.bought) throw new Error('購入済みの買い物項目が見つかりません。');
  if (!isFood(food) || food.status !== 'active' || food.lowStock || data.items.some(item => item.id === food.id)) {
    throw new Error('在庫に登録する食品を確認してください。');
  }
  return { ...data, items: [...data.items, food], shopping: data.shopping.filter(item => item.id !== shoppingId) };
}
