export function localDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return y >= 1000 && y <= 9999 && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

/** Keep draft input untouched; only derive a validated ISO calendar date. */
export function parseDeadline(raw: string): string | null {
  const value = raw.trim();
  const iso = /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}` : value;
  return validDate(iso) ? iso : null;
}

export const deadlineFilters = {
  all: 'すべて', expired: '期限切れ', fortnight: '0〜14日', month: '15〜30日',
  long: '31日以降', today: '今日まで', soon: '1〜3日', later: '4日以上',
} as const;
export type DeadlineFilter = keyof typeof deadlineFilters;
export function matchesDeadline(deadline: string, today: string, filter: DeadlineFilter): boolean {
  const days = daysLeft(deadline, today);
  switch (filter) {
    case 'all': return true;
    case 'expired': return days < 0;
    case 'fortnight': return days >= 0 && days <= 14;
    case 'month': return days >= 15 && days <= 30;
    case 'long': return days >= 31;
    case 'today': return days <= 0;
    case 'soon': return days >= 1 && days <= 3;
    case 'later': return days >= 4;
  }
}

/** Calendar-day delta, deliberately independent of timezone offsets and DST. */
export function daysLeft(deadline: string, today: string = localDate()): number {
  if (!validDate(deadline) || !validDate(today)) throw new Error('日付の形式が正しくありません。');
  return dayNumber(deadline) - dayNumber(today);
}

export type DeadlineState = 'expired' | 'today' | 'soon' | 'later';
export function deadlineState(deadline: string, today: string = localDate()): DeadlineState {
  const days = daysLeft(deadline, today);
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  return days <= 3 ? 'soon' : 'later';
}

export function deadlineLabel(deadline: string, today: string = localDate()): string {
  const days = daysLeft(deadline, today);
  return days < 0 ? `${Math.abs(days)}日超過` : days === 0 ? '今日まで' : days === 1 ? '明日まで' : `あと${days}日`;
}
