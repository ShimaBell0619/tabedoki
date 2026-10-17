import { inferConsumption, isFood, normalizedName, type Food, type FoodForm, type FoodTemplate } from './food.ts';

const starterTemplates: readonly Pick<FoodTemplate, 'name' | 'category' | 'place' | 'unit'>[] = [
  { name: 'たまご', category: 'eggs-dairy', place: 'chilled', unit: 'piece' },
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
  return starterTemplates.map((template, i) => ({ id: `default-${i}`, name: template.name, category: template.category, kind: 'best-before', quantity: i === 0 ? 10 : i === 1 ? 3 : 1, unit: template.unit, place: template.place, consumption: inferConsumption(template.name, template.category) }));
}
export const MAX_TEMPLATES = 50;

export function validateTemplates(value: unknown): FoodTemplate[] {
  if (!Array.isArray(value) || value.length > MAX_TEMPLATES) throw new Error('定番食品は最大50件です。');
  const ids = new Set<string>();
  const names = new Set<string>();
  return value.map(item => {
    if (!isFood({ ...item, initialQuantity: item.quantity, deadline: '2000-01-01', status: 'active', lowStock: false })) throw new Error('定番食品の入力項目を確認してください。');
    if (ids.has(item.id)) throw new Error('重複する定番食品IDがあります。');
    const name = item.name.trim();
    const key = normalizedName(name);
    if (names.has(key)) throw new Error('同じ名前の定番食品が既にあります。');
    ids.add(item.id); names.add(key);
    return { id: item.id, name, category: item.category, kind: item.kind, quantity: item.quantity, unit: item.unit, place: item.place, consumption: item.consumption };
  });
}


export function applyFoodCandidate(form: FoodForm, candidate: FoodTemplate | Food): FoodForm {
  return {
    name: candidate.name, category: candidate.category, place: candidate.place, unit: candidate.unit,
    kind: candidate.kind, quantity: 'deadline' in candidate ? 1 : candidate.quantity, consumption: candidate.consumption,
    ...('deadline' in candidate && candidate.trackingMode ? { trackingMode: candidate.trackingMode } : {}),
    deadline: form.deadline,
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
