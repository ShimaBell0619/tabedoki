import { categories, places, type Food, type FoodCategory, type StoragePlace } from '../../domain/food.ts';
import { matchesDeadline, type DeadlineFilter } from '../../domain/deadline.ts';
import { groupFoods, type FoodGroup } from '../../domain/stock.ts';

export type InventoryView = 'active' | 'finished' | 'all';
export type InventorySort = 'category' | 'deadline' | 'place';
export type InventoryQuery = {
  view: InventoryView;
  search: string;
  categoryFilter: 'all' | FoodCategory;
  placeFilter: 'all' | StoragePlace;
  deadlineFilter: DeadlineFilter;
  sort: InventorySort;
};

/** Filter lots before grouping so displayed quantities and deadline counts refer to visible stock. */
export function selectInventory(items: readonly Food[], today: string, query: InventoryQuery) {
  const { view, search, categoryFilter, placeFilter, deadlineFilter, sort } = query;
  const matching = items.filter(item =>
    item.name.toLocaleLowerCase('ja').includes(search.trim().toLocaleLowerCase('ja')) &&
    (categoryFilter === 'all' || item.category === categoryFilter) &&
    (placeFilter === 'all' || item.place === placeFilter));
  const active = matching.filter(item => item.status === 'active');
  const displayed = matching.filter(item =>
    (view === 'all' || (view === 'active' ? item.status === 'active' : item.status !== 'active')) &&
    matchesDeadline(item.deadline, today, deadlineFilter)
  ).sort((a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name, 'ja'));
  const foodGroups = groupFoods(displayed);
  const sections: { name: string | null; items: FoodGroup[] }[] = sort === 'deadline'
    ? [{ name: null, items: foodGroups }]
    : sort === 'category'
      ? (Object.keys(categories) as FoodCategory[]).map(category => ({
        name: categories[category], items: foodGroups.filter(group => group.category === category),
      }))
      : (Object.keys(places) as StoragePlace[]).map(place => ({
        name: places[place], items: foodGroups.filter(group => group.primary.place === place),
      }));
  return { active, foodGroups, sections };
}
