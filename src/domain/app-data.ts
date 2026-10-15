import type { Food, FoodTemplate } from './food.ts';
import type { ShoppingItem } from './shopping.ts';

export type AppData = { items: Food[]; templates: FoodTemplate[]; shopping: ShoppingItem[] };
