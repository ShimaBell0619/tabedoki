import test from 'node:test';
import assert from 'node:assert/strict';
import { selectInventory } from '../src/features/inventory/selectInventory.ts';

const food = (id, extra = {}) => ({
  id, name: 'しょうゆ', category: 'condiments', kind: 'best-before', unit: 'bottle',
  deadline: '2026-10-31', quantity: 1, place: 'chilled', status: 'active', lowStock: false, ...extra,
});
const query = { view: 'active', search: '', categoryFilter: 'all', placeFilter: 'all', deadlineFilter: 'all', sort: 'category' };

test('検索・保存場所を在庫単位で適用し、表示中の数量と最短期限だけを集約する', () => {
  const items = [food('later', { deadline: '2027-03-31', place: 'pantry', quantity: 3 }), food('first', { quantity: 2 }), food('other', { name: 'みそ' })];
  const before = structuredClone(items);
  const result = selectInventory(items, '2026-10-15', { ...query, search: ' しょうゆ ', placeFilter: 'chilled' });
  assert.equal(result.foodGroups.length, 1);
  assert.equal(result.foodGroups[0].quantity, 2);
  assert.equal(result.foodGroups[0].primary.id, 'first');
  assert.equal(result.active.length, 1);
  assert.equal(result.sections.find(section => section.name === '調味料').items.length, 1);
  assert.deepEqual(items, before);
});

test('管理中・完了・全件の切替と期限条件で、元の在庫IDと状態を保持する', () => {
  const items = [food('old', { deadline: '2026-10-14', status: 'used', quantity: 5 }), food('today', { deadline: '2026-10-15' })];
  const all = selectInventory(items, '2026-10-15', { ...query, view: 'all', sort: 'deadline' });
  assert.equal(all.sections[0].name, null);
  assert.equal(all.foodGroups[0].primary.id, 'today');
  assert.equal(all.foodGroups[0].activeQuantity, 1);
  assert.equal(all.foodGroups[0].finishedQuantity, 5);
  const finished = selectInventory(items, '2026-10-15', { ...query, view: 'finished', deadlineFilter: 'expired' });
  assert.deepEqual(finished.foodGroups[0].items.map(item => item.id), ['old']);
  const active = selectInventory(items, '2026-10-15', { ...query, deadlineFilter: 'expired' });
  assert.equal(active.foodGroups.length, 0);
  assert.equal(active.active.length, 1);
});
