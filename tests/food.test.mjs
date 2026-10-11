import assert from 'node:assert/strict';
import test from 'node:test';
import { daysLeft, deadlineState, validDate, localDate, validateBackup, makeBackup, readFoods, STORAGE_KEY, MAX_ITEMS } from '../src/food.ts';
const item = { id: '1', name: '牛乳', kind: 'use-by', deadline: '2026-10-12', quantity: 1, place: 'chilled', status: 'active' };

test('期限切れ・当日・3日以内・4日以上の境界', () => {
  assert.equal(deadlineState('2026-10-10', '2026-10-11'), 'expired');
  assert.equal(deadlineState('2026-10-11', '2026-10-11'), 'today');
  assert.equal(deadlineState('2026-10-12', '2026-10-11'), 'soon');
  assert.equal(deadlineState('2026-10-14', '2026-10-11'), 'soon');
  assert.equal(deadlineState('2026-10-15', '2026-10-11'), 'later');
});
test('DSTをまたぐ日付も24時間でなく暦日差で計算', () => {
  assert.equal(daysLeft('2026-03-09', '2026-03-07'), 2);
  assert.equal(daysLeft('2026-11-02', '2026-10-31'), 2);
  assert.equal(daysLeft('2027-01-01', '2026-12-31'), 1);
});
test('ローカル日付を使いUTCへ変換しない', () => {
  assert.equal(localDate(new Date(2026, 9, 11, 0, 1)), '2026-10-11');
});
test('閏年と不正日付を検査', () => {
  assert.equal(validDate('2024-02-29'), true);
  for (const bad of ['2026-02-29', '2026-13-01', '2026-00-01', '2026-04-31', '0000-01-01', '2026-1-1', '2026-10-11T00:00:00Z']) assert.equal(validDate(bad), false, bad);
});
test('JSONバックアップ往復と検証', () => {
  assert.deepEqual(validateBackup(JSON.parse(makeBackup([item]))), [item]);
  for (const bad of [null, {}, { version: 2, items: [item] }, { version: 1, items: [item, item] }, { version: 1, items: [{ ...item, quantity: 0 }] }, { version: 1, items: [{ ...item, name: '<'.repeat(81) }] }, { version: 1, items: [{ ...item, deadline: '2026-02-30' }] }, { version: 1, items: [ { ...item, place: 'unknown' } ] }, { version: 1, items: Array(MAX_ITEMS + 1).fill(item) }]) assert.throws(() => validateBackup(bad));
});
test('破損したLocalStorageは黙って空として上書きしない', () => {
  const store = { getItem: key => key === STORAGE_KEY ? '{broken' : null };
  const result = readFoods(store);
  assert.equal(result.items.length, 0);
  assert.match(result.error, /読み込めません/);
});