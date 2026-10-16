import { daysLeft } from '../../domain/deadline.ts';
import type { Food } from '../../domain/food.ts';

export type TimelineDay = {
  deadline: string;
  days: number;
  items: Food[];
};

/** Keep lots independent while grouping only entries that share the same date. */
export function selectTimeline(items: readonly Food[], today: string, range: 14 | 30 | 90) {
  const byDate = new Map<string, Food[]>();
  for (const item of items) {
    const entries = byDate.get(item.deadline) ?? [];
    entries.push(item);
    byDate.set(item.deadline, entries);
  }
  const days: TimelineDay[] = Array.from(byDate, ([deadline, entries]) => ({
    deadline, days: daysLeft(deadline, today),
    items: entries.sort((a, b) => a.name.localeCompare(b.name, 'ja') || a.id.localeCompare(b.id)),
  })).sort((a, b) => a.days - b.days);
  return {
    // Past dates are explicitly separated so very old items do not stretch the axis.
    expired: days.filter(day => day.days < 0).reverse(),
    visible: days.filter(day => day.days >= 0 && day.days <= range),
    later: days.filter(day => day.days > range).reduce((count, day) => count + day.items.length, 0),
  };
}
