import type { Food, FoodTemplate } from './food.ts';
import type { ShoppingItem } from './shopping.ts';
import type { FoodIconSelections } from './food-icons.ts';

export type AppData = { items: Food[]; templates: FoodTemplate[]; shopping: ShoppingItem[]; icons?: FoodIconSelections };
