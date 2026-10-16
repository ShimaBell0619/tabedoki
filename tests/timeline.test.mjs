import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTimeline } from '../src/features/inventory/selectTimeline.ts';

const food = (id, deadline, extra = {}) => ({
  id, name: 'たまご', deadline, quantity: 1, category: 'eggs-dairy',
  kind: 'best-before', place: 'chilled', unit: 'piece', status: 'active',
  lowStock: false, ...extra,
});

test('日付ごとにまとめても個々の期限別在庫は維持する', () => {
  const items = [
    food('early', '2026-10-19'),
    food('other', '2026-10-19', { name: '牛乳' }),
    food('later', '2026-11-17'),
    food('past', '2026-10-16'),
  ];
  const before = structuredClone(items);
  const result = selectTimeline(items, '2026-10-17', 30);
  assert.deepEqual(result.expired.map(day => day.days), [-1]);
  assert.deepEqual(result.visible.map(day => day.days), [2]);
  assert.equal(result.visible[0].items.length, 2);
  assert.deepEqual(result.visible[0].items.map(item => item.id), ['other', 'early']);
  assert.equal(result.later, 1);
  assert.deepEqual(items, before);
});

test('表示期間は期限の位置を変えず、含める日付だけを増やす', () => {
  const items = [food('today', '2026-10-17'), food('at14', '2026-10-31'),
    food('at30', '2026-11-16'), food('at90', '2027-01-15'),
    food('beyond', '2027-01-16')];
  assert.deepEqual(selectTimeline(items, '2026-10-17', 14).visible.map(day => day.days), [0, 14]);
  assert.deepEqual(selectTimeline(items, '2026-10-17', 30).visible.map(day => day.days), [0, 14, 30]);
  assert.deepEqual(selectTimeline(items, '2026-10-17', 90).visible.map(day => day.days), [0, 14, 30, 90]);
  assert.equal(selectTimeline(items, '2026-10-17', 90).later, 1);
});

test('夏時間の切替や月・年境界でも暦日の差分で扱う', () => {
  const items = [food('first', '2026-03-08'), food('second', '2026-03-09')];
  assert.deepEqual(selectTimeline(items, '2026-03-07', 14).visible.map(day => day.days), [1, 2]);
  assert.deepEqual(selectTimeline([food('jan', '2027-01-01')], '2026-12-31', 14).visible.map(day => day.days), [1]);
});

test('期限切れは近い日から順に表示し、同日複数在庫を保持する', () => {
  const items = [food('one', '2026-09-30'), food('two', '2026-10-16'),
    food('three', '2026-10-16', { name: 'みそ' })];
  const result = selectTimeline(items, '2026-10-17', 14);
  assert.deepEqual(result.expired.map(day => day.days), [-1, -17]);
  assert.equal(result.expired[0].items.length, 2);
});
