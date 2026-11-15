// Unique groups; half expire today to exercise a crowded calendar as well as the list.
export const today = '2026-11-15';
export const storageKey = 'tabedoki:data:v5';
export function fixture(count) {
  return { version: 5, templates: [], shopping: [], items: Array.from({ length: count }, (_, i) => ({
    id: `perf-${i}`, name: `食品${String(i).padStart(3, '0')}`, category: 'eggs-dairy',
    kind: 'best-before', deadline: i % 2 === 0 ? today : new Date(Date.parse(today + 'T00:00:00Z') + ((i % 95) - 4) * 86400000).toISOString().slice(0, 10),
    quantity: 3, initialQuantity: 3, unit: 'piece', consumption: 'eat', trackingMode: 'count',
    place: 'chilled', status: 'active', lowStock: false,
  })) };
}
