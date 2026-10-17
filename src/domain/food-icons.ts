import { MAX_ITEMS, normalizedName } from './food.ts';

/** Curated monochrome Lucide options for user-selected food icons. */
export const foodIconChoices = [
  { name: 'egg', label: 'たまご' }, { name: 'milk', label: '乳製品' },
  { name: 'bean', label: '豆類' }, { name: 'carrot', label: '野菜' },
  { name: 'apple', label: '果物' }, { name: 'beef', label: '肉' },
  { name: 'fish', label: '魚' }, { name: 'drumstick', label: '鶏肉' },
  { name: 'wheat', label: '麺・穀物' }, { name: 'sandwich', label: 'パン' },
  { name: 'soup', label: 'スープ' }, { name: 'droplets', label: '液体・調味料' },
  { name: 'package', label: '食品・その他' }, { name: 'coffee', label: 'コーヒー' },
  { name: 'glass-water', label: '飲み物' }, { name: 'cookie', label: 'お菓子' },
  { name: 'cake-slice', label: 'ケーキ' }, { name: 'candy', label: 'キャンディ' },
  { name: 'snowflake', label: '冷凍' }, { name: 'ice-cream-cone', label: 'アイス' },
  { name: 'pizza', label: 'ピザ' }, { name: 'utensils', label: '料理' },
  { name: 'cooking-pot', label: '鍋料理' },
] as const;
export type FoodIconName = (typeof foodIconChoices)[number]['name'];
export type FoodIconSelections = Record<string, FoodIconName>;
export function isFoodIconName(value: unknown): value is FoodIconName {
  return typeof value === 'string' && foodIconChoices.some(choice => choice.name === value);
}
/** undefined is an old saved snapshot; {} explicitly resets all assignments. */
export function validateFoodIconSelections(value: unknown): FoodIconSelections | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('アイコン設定の形式が正しくありません。');
  const entries = Object.entries(value);
  if (entries.length > MAX_ITEMS || entries.some(([key, icon]) =>
    !key || key.length > 80 || key !== normalizedName(key) || !isFoodIconName(icon))) {
    throw new Error('アイコン設定に不正な項目があります。');
  }
  return Object.fromEntries(entries) as FoodIconSelections;
}
export function selectedFoodIcon(selections: FoodIconSelections | undefined, name: string): FoodIconName | undefined {
  const key = normalizedName(name);
  return selections && Object.hasOwn(selections, key) ? selections[key] : undefined;
}
