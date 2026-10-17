import assert from 'node:assert/strict';
import test from 'node:test';
import { daysLeft, deadlineState, validDate, localDate } from '../src/domain/deadline.ts';
import { categories, MAX_ITEMS, initialFoodForm, isFood, consumptionAction, tracksVolume, defaultVolumeTracking, adjustVolume } from '../src/domain/food.ts';
import { MAX_TEMPLATES, validateTemplates, defaultTemplates, applyFoodCandidate, previousFoods } from '../src/domain/templates.ts';
import { groupFoods, foodGroupKey, addStockToFoods } from '../src/domain/stock.ts';
import { validateBackup, makeBackup, readData, writeData, STORAGE_KEY, V3_STORAGE_KEY, V2_STORAGE_KEY, LEGACY_STORAGE_KEY, BACKUP_MAX_BYTES } from '../src/data/storage.ts';
const foodTemplates = defaultTemplates();
const item = { id: '1', name: '牛乳', category: 'eggs-dairy', kind: 'use-by', deadline: '2026-10-12', quantity: 1, unit: 'bottle', place: 'chilled', status: 'active', lowStock: false, initialQuantity: 1, consumption: 'drink' };
const { category, unit, lowStock, initialQuantity, consumption, ...legacyItem } = item;
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
test('v4バックアップ往復と不正データの拒否', () => {
  assert.deepEqual(validateBackup(JSON.parse(makeBackup({ items: [item], templates: foodTemplates, shopping: [] }))), { items: [item], templates: foodTemplates, shopping: [] });
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
  assert.deepEqual(result.items, [{ ...legacyItem, id: 'legacy-id', name: '  納豆  ', quantity: 9, status: 'used', category: 'other', unit: 'item', lowStock: false, initialQuantity: 9, consumption: 'eat' }]);
  assert.equal(Object.hasOwn(result.items[0], 'extra'), false);
});
test('新規は期限空欄・数量1、候補は旧期限や数量をコピーしない', () => {
  const blank = initialFoodForm();
  assert.equal(blank.deadline, '');
  const previous = { ...item, quantity: 999, initialQuantity: 999, status: 'discarded', deadline: '2020-01-01' };
  const copied = applyFoodCandidate(blank, previous);
  assert.equal(copied.deadline, '');
  assert.equal(copied.quantity, 1);
  assert.equal(copied.kind, item.kind);
  assert.equal(Object.hasOwn(copied, 'id'), false);
  assert.equal(Object.hasOwn(copied, 'status'), false);
  const selected = applyFoodCandidate({ ...blank, deadline: '2026-11-01', kind: 'use-by' }, foodTemplates[1]);
  assert.deepEqual(selected, { name: '納豆', category: 'soy', place: 'chilled', unit: 'pack', kind: 'best-before', quantity: 3, consumption: 'eat', deadline: '2026-11-01' });
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
test('v1からv4への自動移行は原文と全旧項目・順序を保持する', () => {
  const raw = JSON.stringify({ version: 1, items: [{ ...legacyItem, id: 'last', status: 'used' }, legacyItem] });
  const store = storage({ [LEGACY_STORAGE_KEY]: raw });
  const result = readData(store);
  assert.equal(result.error, '');
  assert.equal(store.map.get(LEGACY_STORAGE_KEY), raw);
  assert.deepEqual(result.items, [{ ...legacyItem, id: 'last', status: 'used', category: 'other', unit: 'item', lowStock: false, initialQuantity: 1, consumption: 'drink' }, { ...legacyItem, category: 'other', unit: 'item', lowStock: false, initialQuantity: 1, consumption: 'drink' }]);
  assert.deepEqual(result.templates, foodTemplates);
  assert.equal(store.writes, 2);
  assert.equal(JSON.parse(store.map.get(STORAGE_KEY)).version, 5);
  assert.deepEqual(readData(store), result);
  assert.equal(store.writes, 2);
});
test('v2は空でもv1より優先して移行し、原文を残す', () => {
  for (const items of [[], [item]]) {
    const raw = JSON.stringify({ version: 2, items });
    const store = storage({ [V2_STORAGE_KEY]: raw, [LEGACY_STORAGE_KEY]: JSON.stringify({ version: 1, items: [legacyItem] }) });
    assert.deepEqual(readData(store), { items, templates: foodTemplates, shopping: [], error: '', canExport: true, raw: null });
    assert.equal(store.map.get(V2_STORAGE_KEY), raw);
    assert.equal(store.writes, 2);
    readData(store);
    assert.equal(store.writes, 2);
  }
});
test('v3の空定番・空食品を優先し、v4へ移行し初期候補を復活させない', () => {
  const store = storage({ [V3_STORAGE_KEY]: '{"version":3,"items":[],"templates":[]}', [V2_STORAGE_KEY]: JSON.stringify({ version: 2, items: [item] }) });
  assert.deepEqual(readData(store), { items: [], templates: [], shopping: [], error: '', canExport: true, raw: null });
  assert.equal(store.writes, 2);
  const empty = storage();
  assert.deepEqual(readData(empty), { items: [], templates: foodTemplates, shopping: [], error: '', canExport: true, raw: null });
  assert.equal(empty.writes, 0);
});
test('破損・未知version・不足項目のv3やv2から旧データへ戻さない', () => {
  for (const [key, raws] of [
    [STORAGE_KEY, ['{broken', '{"version":4,"items":[]}', '{"version":3,"items":[],"templates":[]}' ]],
    [V3_STORAGE_KEY, ['{broken', '{"version":4,"items":[]}', '{"version":2,"items":[]}', '{"version":3,"items":[],"templates":null}', JSON.stringify({ version: 3, items: [legacyItem], templates: [], shopping: [] })]],
    [V2_STORAGE_KEY, ['{broken', '{"version":3,"items":[],"templates":[]}', JSON.stringify({ version: 2, items: [legacyItem] })]],
  ]) for (const raw of raws) {
    const store = storage({ [V2_STORAGE_KEY]: JSON.stringify({ version: 2, items: [item] }), [LEGACY_STORAGE_KEY]: JSON.stringify({ version: 1, items: [legacyItem] }), [key]: raw });
    const result = readData(store);
    assert.equal(result.items.length, 0);
    assert.match(result.error, /読み込めません/);
    assert.equal(result.canExport, false);
    assert.equal(store.map.get(key), raw);
    assert.equal(store.writes, 0);
  }
});
test('v1破損・読み込み例外でも空データを書き込まない', () => {
  const store = storage({ [LEGACY_STORAGE_KEY]: '{broken' });
  assert.match(readData(store).error, /読み込めません/);
  assert.equal(store.writes, 0);
  assert.equal(store.map.has(STORAGE_KEY), false);
  assert.match(readData({ getItem() { throw new Error('denied'); }, setItem() { assert.fail(); } }).error, /読み込めません/);
});
test('v2移行保存失敗でも元データを読み取り・退避できる', () => {
  const raw = JSON.stringify({ version: 2, items: [item] });
  const store = storage({ [V2_STORAGE_KEY]: raw }, true);
  const result = readData(store);
  assert.match(result.error, /現在は変更できません/);
  assert.equal(result.canExport, true);
  assert.deepEqual(result.items, [item]);
  assert.equal(store.map.get(V2_STORAGE_KEY), raw);
  assert.equal(store.map.has(STORAGE_KEY), false);
  assert.deepEqual(validateBackup(JSON.parse(makeBackup(result))), { items: result.items, templates: foodTemplates, shopping: [] });
});
test('移行保存後の読み直しが不一致なら変更を止める', () => {
  const raw = JSON.stringify({ version: 1, items: [legacyItem] });
  const result = readData({ getItem(key) { return key === LEGACY_STORAGE_KEY ? raw : null; }, setItem() {} });
  assert.match(result.error, /現在は変更できません/);
  assert.equal(result.items.length, 1);
});
test('食品と定番を単一保存し、例外・不正データでは両方を保持する', () => {
  const data = { items: [item], templates: foodTemplates, shopping: [] };
  const raw = JSON.stringify({ version: 4, ...data });
  const store = storage({ [STORAGE_KEY]: raw }, true);
  assert.throws(() => writeData(store, { items: [], templates: [], shopping: [] }));
  assert.equal(store.map.get(STORAGE_KEY), raw);
  assert.throws(() => writeData(store, { ...data, templates: [{ ...foodTemplates[0], quantity: 0 }] }));
  assert.equal(store.writes, 1);
  const success = storage();
  assert.deepEqual(writeData(success, { items: [{ ...item, extra: 'drop' }], templates: foodTemplates, shopping: [] }), data);
  assert.equal(success.writes, 1);
  assert.equal(Object.hasOwn(JSON.parse(success.map.get(STORAGE_KEY)), 'exportedAt'), false);
});
test('定番の入力検証・上限・IDと正規化した名前の重複を拒否する', () => {
  const base = foodTemplates[0];
  for (const value of [null, {}, [null], [1], ["bad"], [{ ...base, name: '   ' }], [{ ...base, name: 'x'.repeat(81) }], ...[
    { id: '' }, { kind: 'unknown' }, { quantity: 0 }, { quantity: 1.5 }, { quantity: 1000 }, { unit: 'kg' }, { category: 'constructor' }, { place: 'unknown' },
  ].map(change => [{ ...base, ...change }]), [base, { ...base, name: '別名' }], [{ ...base, name: 'milk' }, { ...base, id: 'other', name: ' ＭＩＬＫ ' }], Array(MAX_TEMPLATES + 1).fill(base)]) assert.throws(() => validateTemplates(value));
  assert.deepEqual(validateTemplates([]), []);
});
test('定番は既知項目のみ保存し、食品の期限や状態を持たない', () => {
  const base = { ...foodTemplates[0], name: '  たまご  ', deadline: '2020-01-01', status: 'used', extra: 'drop' };
  assert.deepEqual(validateTemplates([base]), [foodTemplates[0]]);
});
test('カスタム定番の明示した数量と区分を補完し、今回の期限は保持する', () => {
  const template = { ...foodTemplates[0], quantity: 3, kind: 'use-by' };
  const before = structuredClone(template);
  const copied = applyFoodCandidate({ ...initialFoodForm(), deadline: '2026-12-20' }, template);
  assert.equal(copied.quantity, 3);
  assert.equal(copied.kind, 'use-by');
  assert.equal(copied.deadline, '2026-12-20');
  assert.equal(Object.hasOwn(copied, 'id'), false);
  assert.deepEqual(template, before);
});
test('v1/v2バックアップは定番未指定、v3は空も含めて定番を完全復元する', () => {
  assert.equal(validateBackup({ version: 1, items: [legacyItem] }).templates, undefined);
  assert.equal(validateBackup({ version: 2, items: [item], templates: foodTemplates, shopping: [] }).templates, undefined);
  const data = { items: [item], templates: [], shopping: [] };
  assert.deepEqual(validateBackup(JSON.parse(makeBackup(data))), data);
  assert.throws(() => validateBackup({ version: 3, items: [item] }));
  assert.throws(() => validateBackup({ version: 4, items: [] }));
});
test('最大の食品と定番の出力を5MiB以内で往復する', () => {
  const items = Array.from({ length: MAX_ITEMS }, (_, i) => ({ ...item, id: '\u0001'.repeat(95) + String(i).padStart(5, '0'), name: 'x' + '\u0001'.repeat(79), quantity: 999, initialQuantity: 999, status: 'discarded' }));
  const templates = Array.from({ length: MAX_TEMPLATES }, (_, i) => ({ ...foodTemplates[0], id: '\u0001'.repeat(95) + String(i).padStart(5, '0'), name: String(i).padStart(2, '0') + '\u0001'.repeat(78), quantity: 999 }));
  const data = { items, templates, shopping: [] };
  const backup = makeBackup(data);
  assert.ok(Buffer.byteLength(backup) > 1024 * 1024);
  assert.ok(Buffer.byteLength(backup) < BACKUP_MAX_BYTES);
  assert.deepEqual(validateBackup(JSON.parse(backup)), data);
});

test('主食の既存カテゴリキーとレトルトカテゴリを使え、初期定番の入力値も整合する', () => {
  assert.equal(categories.staples, '主食・麺・パン');
  assert.equal(categories['retort-canned'], 'レトルト・缶詰');
  assert.equal(isFood({ ...item, category: 'retort-canned', place: 'pantry' }), true);
  const pasta = foodTemplates.find(value => value.name === 'パスタ');
  const retort = foodTemplates.find(value => value.name === 'レトルトカレー');
  assert.deepEqual(pasta && [pasta.category, pasta.place, pasta.unit], ['staples', 'pantry', 'bag']);
  assert.deepEqual(retort && [retort.category, retort.place, retort.unit], ['retort-canned', 'pantry', 'piece']);
  assert.deepEqual(validateTemplates(foodTemplates), foodTemplates);
  const data = { items: [{ ...item, category: 'staples' }, { ...item, id: '2', category: 'retort-canned' }], templates: foodTemplates, shopping: [] };
  assert.deepEqual(validateBackup(JSON.parse(makeBackup(data))), data);
});


test('同名食品は期限別在庫を1グループに集め、期限順・合計・優先期限を求める', () => {
  const older = { ...item, id: 'older', name: ' 牛乳 ', quantity: 2, deadline: '2026-10-11', place: 'pantry' };
  const finished = { ...item, id: 'used', deadline: '2026-10-09', status: 'used', quantity: 5 };
  const differentUnit = { ...item, id: 'unit', unit: 'pack' };
  const differentCategory = { ...item, id: 'category', category: 'soy' };
  const differentKind = { ...item, id: 'kind', kind: 'best-before' };
  const entries = [item, differentUnit, differentCategory, finished, older, differentKind];
  const before = structuredClone(entries);
  const groups = groupFoods(entries);
  assert.equal(groups.length, 4);
  const milk = groups.find(group => group.key === foodGroupKey(item));
  assert.deepEqual(milk.items.map(value => value.id), ['used', 'older', '1']);
  assert.equal(milk.quantity, 8);
  assert.equal(milk.activeQuantity, 3);
  assert.equal(milk.finishedQuantity, 5);
  assert.equal(milk.primary.id, 'older');
  assert.deepEqual(entries, before);
});

test('在庫追加は同一期限・場所の管理中レコードのみを加算し、完了レコードを保持する', () => {
  const used = { ...item, id: 'old', status: 'used' };
  const existing = { ...item, id: 'active', quantity: 4, initialQuantity: 4, lowStock: true };
  const base = [used, existing];
  const merged = addStockToFoods(base, existing, { deadline: existing.deadline, quantity: 2, place: 'chilled' }, 'new');
  assert.equal(merged.length, 2);
  assert.equal(merged[0].quantity, 1);
  assert.equal(merged[1].quantity, 6);
  assert.equal(merged[1].lowStock, true);
  assert.equal(base[1].quantity, 4);
  const separate = addStockToFoods(merged, existing, { deadline: '2027-01-01', quantity: 3, place: 'pantry' }, 'new');
  assert.equal(separate.length, 3);
  assert.deepEqual(separate[2], { ...item, id: 'new', quantity: 3, initialQuantity: 3, deadline: '2027-01-01', place: 'pantry', status: 'active', lowStock: false });
  assert.throws(() => addStockToFoods(base, existing, { deadline: existing.deadline, quantity: 996, place: 'chilled' }, 'new'), /999/);
  assert.throws(() => addStockToFoods(base, existing, { deadline: '2026-02-30', quantity: 1, place: 'pantry' }, 'new'), /期限/);
  assert.throws(() => addStockToFoods(base, existing, { deadline: '2026-11-01', quantity: 0, place: 'pantry' }, 'new'), /数量/);
  assert.throws(() => addStockToFoods(Array(MAX_ITEMS).fill(existing), existing, { deadline: '2027-01-01', quantity: 1, place: 'pantry' }, 'new'), /3,000/);
});


test('消費動詞と分割バー基準数量のバリデーション', () => {
  assert.equal(consumptionAction('eat', '個', false), '1個食べた');
  assert.equal(consumptionAction('eat', '個', true), '食べ終わった');
  assert.equal(consumptionAction('use', '本', false), '1本使い終わった');
  assert.equal(consumptionAction('drink', '本', true), '飲み終わった');
  assert.equal(isFood({ ...item, quantity: 3, initialQuantity: 10 }), true);
  assert.equal(isFood({ ...item, quantity: 3, initialQuantity: 2 }), false);
  assert.equal(isFood({ ...item, consumption: 'unknown' }), false);
});


test('容器数と容器内残量を別々に保持し、旧v5食品も受け付ける', () => {
  assert.equal(defaultVolumeTracking('牛乳', 'bottle'), true);
  assert.equal(defaultVolumeTracking('たまご', 'piece'), false);
  assert.equal(defaultVolumeTracking('みそ', 'bottle'), false);
  assert.equal(tracksVolume({ name: '牛乳', unit: 'bottle' }), true);
  assert.equal(tracksVolume({ name: '牛乳', unit: 'bottle', trackingMode: 'count' }), false);
  assert.equal(tracksVolume({ name: 'みそ', unit: 'bottle', trackingMode: 'volume' }), true);
  assert.equal(isFood(item), true);
  assert.equal(isFood({ ...item, trackingMode: 'volume', volumePercent: 25 }), true);
  assert.equal(isFood({ ...item, trackingMode: 'volume', volumePercent: 30 }), true);
  assert.equal(isFood({ ...item, trackingMode: 'volume', volumePercent: 0 }), false);
  assert.equal(isFood({ ...item, trackingMode: 'volume', volumePercent: 101 }), false);
  assert.equal(isFood({ ...item, trackingMode: 'count', volumePercent: 50 }), false);
  assert.equal(isFood({ ...item, trackingMode: 'invalid' }), false);
});

test('10%刻みの残量操作は開封中の1容器だけを変更し、使い切り時だけ本数を減らす', () => {
  const original = { ...item, quantity: 2, initialQuantity: 2, trackingMode: 'volume', volumePercent: 100 };
  const reduced = Array.from({ length: 9 }).reduce(food => adjustVolume(food, -10), original);
  assert.deepEqual([reduced.quantity, reduced.volumePercent, reduced.status], [2, 10, 'active']);
  const next = adjustVolume(reduced, -10);
  assert.deepEqual([next.quantity, next.volumePercent, next.status], [1, 100, 'active']);
  assert.equal(isFood(next), true);
  assert.equal(adjustVolume(next, -10).volumePercent, 90);
  const finished = Array.from({ length: 10 }).reduce(food => adjustVolume(food, -10), next);
  assert.deepEqual([finished.quantity, finished.volumePercent, finished.status], [1, 100, 'used']);
  assert.equal(isFood(finished), true);
  assert.deepEqual(original, { ...item, quantity: 2, initialQuantity: 2, trackingMode: 'volume', volumePercent: 100 });
  assert.equal(adjustVolume({ ...original, volumePercent: 60 }, 10).volumePercent, 70);
  assert.equal(adjustVolume(original, 10).volumePercent, 100);
});

test('旧v5の25%/75%を保持し、残り10%未満も最後の操作で使い切れる', () => {
  const legacy = { ...item, trackingMode: 'volume', volumePercent: 25 };
  assert.equal(isFood(legacy), true);
  assert.equal(adjustVolume(legacy, -10).volumePercent, 15);
  assert.equal(adjustVolume({ ...legacy, volumePercent: 15 }, -10).volumePercent, 5);
  assert.equal(adjustVolume({ ...legacy, volumePercent: 5 }, -10).status, 'used');
  assert.equal(isFood({ ...legacy, volumePercent: 15 }), true);
  assert.equal(isFood({ ...legacy, volumePercent: 5 }), true);
  assert.throws(() => adjustVolume({ ...item, trackingMode: 'count' }, -10));
});
