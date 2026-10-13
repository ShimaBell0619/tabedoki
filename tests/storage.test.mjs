import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultTemplates, MAX_ITEMS, MAX_TEMPLATES } from '../src/food.ts';
import { MAX_SHOPPING, shoppingFrom, registerPurchase } from '../src/shopping.ts';
import {
  STORAGE_KEY, RECOVERY_KEY, V2_STORAGE_KEY, LEGACY_STORAGE_KEY, BACKUP_MAX_BYTES,
  readData, writeData, replaceData, previousData, validateBackup, makeBackup, applyBackup,
} from '../src/storage.ts';

const food = { id: 'food', name: ' 牛乳 ', category: 'eggs-dairy', kind: 'use-by', deadline: '2026-12-31', quantity: 3, unit: 'bottle', place: 'chilled', status: 'active', lowStock: true };
const data = { items: [food], templates: [], shopping: [shoppingFrom('パン', 'shop')] };
function storage(seed = {}, failKey = null, failRead = null) {
  const map = new Map(Object.entries(seed));
  const writes = [];
  return { map, writes,
    getItem(key) { if (failRead === key && writes.some(x => x[0] === STORAGE_KEY)) throw Error('read denied'); return map.get(key) ?? null; },
    setItem(key, value) { writes.push([key, value]); if (key === failKey) throw Error('quota'); map.set(key, value); },
  };
}

test('v3の原文・順序・全項目・空定番を退避して一度だけv4へ移行する', () => {
  const { lowStock, ...old } = food;
  const raw = JSON.stringify({ version: 3, items: [old, { ...old, id: 'second', status: 'discarded' }], templates: [] });
  const store = storage({ [STORAGE_KEY]: raw });
  const result = readData(store);
  assert.equal(result.error, '');
  assert.deepEqual(result.items, [{ ...old, lowStock: false }, { ...old, id: 'second', status: 'discarded', lowStock: false }]);
  assert.deepEqual(result.templates, []); assert.deepEqual(result.shopping, []);
  assert.equal(store.map.get(RECOVERY_KEY), raw);
  assert.deepEqual(store.writes.map(x => x[0]), [RECOVERY_KEY, STORAGE_KEY]);
  assert.deepEqual(readData(store), result);
  assert.equal(store.writes.length, 2);
});

test('退避失敗・正本失敗・確認失敗を区別し既存原文と読取データを保持する', () => {
  const raw = JSON.stringify({ version: 3, items: [food], templates: [] });
  for (const failedKey of [RECOVERY_KEY, STORAGE_KEY]) {
    const store = storage({ [STORAGE_KEY]: raw }, failedKey);
    const result = readData(store);
    assert.match(result.error, /移行を保存できません/);
    assert.equal(result.raw, raw); assert.equal(result.canExport, true);
    assert.equal(result.items[0].lowStock, false);
    assert.equal(store.map.get(STORAGE_KEY), raw);
    if (failedKey === RECOVERY_KEY) assert.equal(store.writes.length, 1);
  }
  const store = storage({ [STORAGE_KEY]: raw }, null, STORAGE_KEY);
  assert.match(readData(store).error, /保存結果を確認できません/);
  assert.equal(JSON.parse(store.map.get(STORAGE_KEY)).version, 4);
  assert.equal(store.map.get(RECOVERY_KEY), raw);
});

test('最新の破損/未知形式は旧キーへ戻らず原文を取得する。取得拒否を区別する', () => {
  for (const raw of ['{broken', '{"version":99}', '{"version":4,"items":[],"templates":[]}']) {
    const store = storage({ [STORAGE_KEY]: raw, [V2_STORAGE_KEY]: '{"version":2,"items":[]}', [LEGACY_STORAGE_KEY]: '{"version":1,"items":[]}' });
    const result = readData(store);
    assert.equal(result.raw, raw); assert.equal(result.canExport, false); assert.equal(store.writes.length, 0);
  }
  const result = readData({ getItem() { throw Error('denied'); }, setItem() { assert.fail(); } });
  assert.equal(result.raw, null); assert.match(result.error, /原文も取得できません/);
});

test('v1/v2/v3/v4復元の置換/保持範囲と旧lowの初期化を検証する', () => {
  const { category, unit, lowStock, ...legacy } = food;
  for (const version of [1, 2, 3, 4]) {
    const incoming = validateBackup({ version, items: [version === 1 ? legacy : food], templates: [], shopping: [] });
    const next = applyBackup(data, incoming);
    assert.deepEqual(next.shopping, version === 4 ? [] : data.shopping);
    assert.deepEqual(next.templates, []);
    assert.equal(next.items[0].lowStock, version === 4);
    assert.equal(next.items[0].name, food.name);
    if (version === 1) { assert.equal(next.items[0].category, 'other'); assert.equal(next.items[0].unit, 'item'); }
  }
  const current = { ...data, templates: defaultTemplates() };
  assert.deepEqual(applyBackup(current, validateBackup({ version: 2, items: [] })).templates, current.templates);
});

test('置換前の退避・初期化・直前復元は一世代だけ保持し通常編集では更新しない', () => {
  const raw = JSON.stringify({ version: 4, ...data });
  const store = storage({ [STORAGE_KEY]: raw });
  replaceData(store, { items: [], templates: [], shopping: [] });
  assert.equal(store.map.get(RECOVERY_KEY), raw);
  const before = previousData(store);
  writeData(store, { ...data, items: [] });
  assert.equal(store.map.get(RECOVERY_KEY), raw);
  replaceData(store, before);
  assert.deepEqual(JSON.parse(store.map.get(STORAGE_KEY)).items, data.items);
  for (const failedKey of [RECOVERY_KEY, STORAGE_KEY]) {
    const fail = storage({ [STORAGE_KEY]: raw }, failedKey);
    assert.throws(() => replaceData(fail, { items: [], templates: [], shopping: [] }));
    assert.equal(fail.map.get(STORAGE_KEY), raw);
  }
  assert.throws(() => previousData(storage({ [RECOVERY_KEY]: '{broken' })));
});

test('購入登録+買い物削除は検証して正本へ1回保存し、失敗/再試行/二重登録を保護する', () => {
  const shopping = [{ ...data.shopping[0], bought: true }];
  const current = { ...data, shopping };
  const fresh = { ...food, id: 'fresh', lowStock: false };
  const raw = JSON.stringify({ version: 4, ...current });
  const failed = storage({ [STORAGE_KEY]: raw }, STORAGE_KEY);
  const next = registerPurchase(current, shopping[0].id, fresh);
  assert.throws(() => writeData(failed, next));
  assert.equal(failed.map.get(STORAGE_KEY), raw); assert.equal(current.shopping.length, 1); assert.equal(current.items.length, 1);
  const success = storage({ [STORAGE_KEY]: raw });
  const saved = writeData(success, next);
  assert.equal(success.writes.length, 1); assert.equal(saved.items.length, 2); assert.deepEqual(saved.shopping, []);
  assert.throws(() => registerPurchase(saved, shopping[0].id, { ...fresh, id: 'double' }));
});

test('最大v4出力（エスケープ文字含む）を5MiB内で完全往復する', () => {
  const items = Array.from({ length: MAX_ITEMS }, (_, i) => ({ ...food, id: '\u0001'.repeat(95) + String(i).padStart(5, '0'), name: 'x' + '\u0001'.repeat(79) }));
  const templates = Array.from({ length: MAX_TEMPLATES }, (_, i) => ({ ...defaultTemplates()[0], id: 't' + i, name: String(i).padStart(2, '0') + '\u0001'.repeat(78) }));
  const shopping = Array.from({ length: MAX_SHOPPING }, (_, i) => ({ ...shoppingFrom('買い物' + i, 's' + i), bought: i % 2 === 0 }));
  const maximum = { items, templates, shopping };
  const backup = makeBackup(maximum);
  assert.ok(Buffer.byteLength(backup) < BACKUP_MAX_BYTES);
  assert.deepEqual(validateBackup(JSON.parse(backup)), maximum);
});
