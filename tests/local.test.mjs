import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalStore } from '../src/data/local.ts';
import { STORAGE_KEY, V3_STORAGE_KEY } from '../src/data/storage.ts';

const food = { id: 'milk', name: '牛乳', category: 'eggs-dairy', kind: 'use-by', deadline: '2026-12-31', quantity: 1, unit: 'bottle', place: 'chilled', status: 'active', lowStock: false };
const empty = { items: [], shopping: [], templates: [] };
function mock(seed = {}, rejectWrite = false) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { if (rejectWrite) throw new Error('quota'); values.set(key, value); },
  };
}
test('未ログインの保存・再読込をv4正本で維持する', async () => {
  const storage = mock();
  const store = new LocalStore(storage);
  const initial = await store.load();
  assert.deepEqual(initial.data.items, []);
  const saved = await store.save({ ...empty, items: [food] });
  assert.deepEqual(saved.data.items, [food]);
  assert.deepEqual((await new LocalStore(storage).load()).data.items, [food]);
  assert.equal(JSON.parse(storage.values.get(STORAGE_KEY)).version, 4);
});
test('既存v3を元データを消さずにv4へ移行する', async () => {
  const { lowStock, ...old } = food;
  const raw = JSON.stringify({ version: 3, items: [old], templates: [] });
  const storage = mock({ [V3_STORAGE_KEY]: raw });
  const store = new LocalStore(storage);
  assert.equal((await store.load()).data.items[0].lowStock, false);
  assert.equal(storage.values.get(V3_STORAGE_KEY), raw);
});
test('別タブの変更を上書きせず、再取得まで保存を止める', async () => {
  const storage = mock();
  const a = new LocalStore(storage), b = new LocalStore(storage);
  await a.load(); await b.load();
  await a.save({ ...empty, items: [food] });
  await assert.rejects(() => b.save(empty), /別のタブ/);
  assert.deepEqual((await b.load()).data.items, [food]);
});
test('破損データを上書きしない', async () => {
  const storage = mock({ [STORAGE_KEY]: '{bad' });
  await assert.rejects(() => new LocalStore(storage).load(), /読み込めません/);
  assert.equal(storage.values.get(STORAGE_KEY), '{bad');
});
test('容量不足で旧データを保護する', async () => {
  const storage = mock();
  const store = new LocalStore(storage);
  await store.load();
  storage.setItem = () => { throw Error('quota'); };
  await assert.rejects(() => store.save({ ...empty, items: [food] }), /保存できません/);
  assert.equal(storage.values.has(STORAGE_KEY), false);
});
