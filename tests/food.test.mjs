import assert from 'node:assert/strict';
import test from 'node:test';
import {
  daysLeft, deadlineState, validDate, localDate, validateBackup, makeBackup, readFoods,
  writeFoods, STORAGE_KEY, LEGACY_STORAGE_KEY, MAX_ITEMS, BACKUP_MAX_BYTES,
  initialFoodForm, applyFoodCandidate, foodTemplates, previousFoods, isFood,
} from '../src/food.ts';
const item = { id: '1', name: '牛乳', category: 'eggs-dairy', kind: 'use-by', deadline: '2026-10-12', quantity: 1, unit: 'bottle', place: 'chilled', status: 'active' };
const { category, unit, ...legacyItem } = item;
function storage(seed = {}, failWrite = false) {
  const map = new Map(Object.entries(seed));
  let writes = 0;
  return {
    map, get writes() { return writes; },
    getItem(key) { return map.get(key) ?? null; },
    setItem(key, value) { writes++; if (failWrite) throw new Error('quota'); map.set(key, value); },
  };
}

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
test('v2バックアップ往復と不正データの拒否', () => {
  assert.deepEqual(validateBackup(JSON.parse(makeBackup([item]))), [item]);
  for (const bad of [null, {}, { version: 3, items: [item] }, { version: 2, items: [item, item] }, ...[
    { quantity: 0 }, { quantity: 1.5 }, { name: '<'.repeat(81) }, { deadline: '2026-02-30' },
    { place: 'unknown' }, { category: 'unknown' }, { category: 'toString' }, { unit: 'kg' }, { unit: 'constructor' },
  ].map(change => ({ version: 2, items: [{ ...item, ...change }] })), { version: 2, items: Array(MAX_ITEMS + 1).fill(item) }]) assert.throws(() => validateBackup(bad));
  const { category, ...missingCategory } = item;
  assert.equal(isFood(missingCategory), false);
});
test('v1復元は旧項目を保持し新項目だけ既定値にする', () => {
  const legacy = { ...legacyItem, id: 'legacy-id', name: '  納豆  ', quantity: 9, status: 'used', extra: 'ignore', category: 'soy', unit: 'pack' };
  const result = validateBackup({ version: 1, items: [legacy] });
  assert.deepEqual(result, [{ ...legacyItem, id: 'legacy-id', name: '  納豆  ', quantity: 9, status: 'used', category: 'other', unit: 'item' }]);
  assert.equal(Object.hasOwn(result[0], 'extra'), false);
});
test('新規は期限空欄・数量1、候補は旧期限や数量をコピーしない', () => {
  const blank = initialFoodForm();
  assert.equal(blank.deadline, '');
  const previous = { ...item, quantity: 999, status: 'discarded', deadline: '2020-01-01' };
  const copied = applyFoodCandidate(blank, previous);
  assert.equal(copied.deadline, '');
  assert.equal(copied.quantity, 1);
  assert.equal(copied.kind, item.kind);
  assert.equal(Object.hasOwn(copied, 'id'), false);
  assert.equal(Object.hasOwn(copied, 'status'), false);
  const selected = applyFoodCandidate({ ...blank, deadline: '2026-11-01', kind: 'use-by' }, foodTemplates[1]);
  assert.deepEqual(selected, { name: '納豆', category: 'soy', place: 'chilled', unit: 'pack', kind: 'best-before', quantity: 1, deadline: '2026-11-01' });
});
test('以前の候補は登録順・最大3件・正規化した名前で重複を除く', () => {
  const items = [
    { ...item, id: 'a', name: '古い食品' },
    { ...item, id: 'b', name: 'milk', unit: 'pack' },
    { ...item, id: 'c', name: '納豆', status: 'used' },
    { ...item, id: 'd', name: ' ＭＩＬＫ ', place: 'frozen', status: 'discarded' },
    { ...item, id: 'e', name: 'パン' },
  ];
  const before = structuredClone(items);
  assert.deepEqual(previousFoods(items).map(x => x.id), ['e', 'd', 'c']);
  assert.deepEqual(items, before);
  assert.deepEqual(previousFoods(items.filter(x => x.id !== 'e')).map(x => x.id), ['d', 'c', 'a']);
});
test('v1の自動移行は原文とID・状態・順序を保持する', () => {
  const raw = JSON.stringify({ version: 1, items: [{ ...legacyItem, id: 'last', status: 'used' }, legacyItem] });
  const store = storage({ [LEGACY_STORAGE_KEY]: raw });
  const result = readFoods(store);
  assert.equal(result.error, '');
  assert.equal(store.map.get(LEGACY_STORAGE_KEY), raw);
  assert.deepEqual(result.items.map(x => x.id), ['last', '1']);
  assert.deepEqual(result.items.map(x => x.category), ['other', 'other']);
  assert.deepEqual(result.items.map(x => x.unit), ['item', 'item']);
  assert.equal(store.writes, 1);
  assert.equal(JSON.parse(store.map.get(STORAGE_KEY)).version, 2);
  assert.deepEqual(readFoods(store), result);
  assert.equal(store.writes, 1);
});
test('v2は空でも優先し、通常読み込みは書き込まない', () => {
  const store = storage({ [STORAGE_KEY]: '{"version":2,"items":[]}', [LEGACY_STORAGE_KEY]: JSON.stringify({ version: 1, items: [legacyItem] }) });
  assert.deepEqual(readFoods(store), { items: [], error: '', canExport: true });
  assert.equal(store.writes, 0);
  const empty = storage();
  assert.deepEqual(readFoods(empty), { items: [], error: '', canExport: true });
  assert.equal(empty.writes, 0);
});
test('v2破損・未知version・誤ったキーのversionでもv1へ戻さない', () => {
  for (const raw of ['{broken', '{"version":3,"items":[]}', '{"version":1,"items":[]}', JSON.stringify({ version: 2, items: [legacyItem] })]) {
    const store = storage({ [STORAGE_KEY]: raw, [LEGACY_STORAGE_KEY]: JSON.stringify({ version: 1, items: [legacyItem] }) });
    const result = readFoods(store);
    assert.equal(result.items.length, 0);
    assert.match(result.error, /読み込めません/);
    assert.equal(result.canExport, false);
    assert.equal(store.map.get(STORAGE_KEY), raw);
    assert.equal(store.writes, 0);
  }
});
test('v1破損・読み込み例外でも空データを書き込まない', () => {
  const store = storage({ [LEGACY_STORAGE_KEY]: '{broken' });
  assert.match(readFoods(store).error, /読み込めません/);
  assert.equal(store.writes, 0);
  assert.equal(store.map.has(STORAGE_KEY), false);
  assert.match(readFoods({ getItem() { throw new Error('denied'); }, setItem() { assert.fail(); } }).error, /読み込めません/);
});
test('移行保存失敗時は元データを保持し読み取り・退避を許可する', () => {
  const raw = JSON.stringify({ version: 1, items: [legacyItem] });
  const store = storage({ [LEGACY_STORAGE_KEY]: raw }, true);
  const result = readFoods(store);
  assert.match(result.error, /現在は変更できません/);
  assert.equal(result.canExport, true);
  assert.equal(result.items.length, 1);
  assert.equal(store.map.get(LEGACY_STORAGE_KEY), raw);
  assert.equal(store.map.has(STORAGE_KEY), false);
  assert.deepEqual(validateBackup(JSON.parse(makeBackup(result.items))), result.items);
});
test('移行保存後の読み直しが不一致なら変更を止める', () => {
  const raw = JSON.stringify({ version: 1, items: [legacyItem] });
  const result = readFoods({ getItem(key) { return key === LEGACY_STORAGE_KEY ? raw : null; }, setItem() {} });
  assert.match(result.error, /現在は変更できません/);
  assert.equal(result.items.length, 1);
});
test('通常保存は検証後に書き込み、失敗でも元の保存内容を維持する', () => {
  const raw = JSON.stringify({ version: 2, items: [item] });
  const store = storage({ [STORAGE_KEY]: raw }, true);
  assert.throws(() => writeFoods(store, [{ ...item, name: '変更後' }]));
  assert.equal(store.map.get(STORAGE_KEY), raw);
  assert.throws(() => writeFoods(store, [{ ...item, deadline: '2026-02-30' }]));
  assert.equal(store.writes, 1);
  const success = storage();
  assert.deepEqual(writeFoods(success, [{ ...item, extra: 'drop' }]), [item]);
  assert.equal(Object.hasOwn(JSON.parse(success.map.get(STORAGE_KEY)), 'exportedAt'), false);
});
test('最大件数・最大文字数の出力が取込上限内で往復する', () => {
  const items = Array.from({ length: MAX_ITEMS }, (_, i) => ({
    ...item, id: '\u0001'.repeat(95) + String(i).padStart(5, '0'), name: 'x' + '\u0001'.repeat(79),
    quantity: 999, status: 'discarded',
  }));
  const backup = makeBackup(items);
  assert.ok(Buffer.byteLength(backup) > 1024 * 1024);
  assert.ok(Buffer.byteLength(backup) < BACKUP_MAX_BYTES);
  assert.deepEqual(validateBackup(JSON.parse(backup)), items);
});
