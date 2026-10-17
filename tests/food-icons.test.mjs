import assert from 'node:assert/strict';
import test from 'node:test';
import { validateData, validateBackup, decodeStored, writeData, makeBackup, applyBackup } from '../src/data/storage.ts';
import { validateFoodIconSelections, selectedFoodIcon } from '../src/domain/food-icons.ts';
import { LocalStore } from '../src/data/local.ts';

const base = { items: [], templates: [], shopping: [] };
function store() { const map = new Map(); return { map, setItem: (key, value) => map.set(key, value), getItem: key => map.get(key) ?? null }; }

test('食品名に対応するLucideアイコンをv4保存・バックアップ・復元で維持する', () => {
  const icons = { '牛乳': 'coffee', 'しょうゆ': 'soup' };
  const data = { ...base, icons };
  const saved = writeData(store(), data);
  assert.deepEqual(saved.icons, icons);
  assert.deepEqual(decodeStored(JSON.stringify({ version: 4, ...data })).icons, icons);
  assert.deepEqual(validateBackup(JSON.parse(makeBackup(data))).icons, icons);
  assert.deepEqual(applyBackup(base, validateBackup(JSON.parse(makeBackup(data)))).icons, icons);
  assert.equal(selectedFoodIcon(saved.icons, ' しょうゆ '), 'soup');
  assert.equal(selectedFoodIcon(saved.icons, '牛乳'), 'coffee');
});

test('未設定の旧v4形式を保持し、古いバックアップ復元時にはアイコン設定を維持する', () => {
  assert.deepEqual(validateData(base), base);
  assert.deepEqual(decodeStored(JSON.stringify({ version: 4, ...base })), base);
  const current = { ...base, icons: { '牛乳': 'egg' } };
  assert.deepEqual(applyBackup(current, validateBackup({ version: 3, items: [], templates: [] })).icons, current.icons);
  assert.deepEqual(applyBackup(current, validateBackup({ version: 4, ...base, icons: {} })).icons, {});
});

test('壊れたアイコン設定は黙って破棄せず不正データとして拒否する', () => {
  for (const icons of [null, [], { '牛乳': 'external-image' }, { ' 牛乳 ': 'egg' }, { '牛乳': 2 }]) {
    assert.throws(() => validateData({ ...base, icons }), /アイコン設定/);
  }
  assert.equal(selectedFoodIcon({ 'constructor': 'pizza' }, 'constructor'), 'pizza');
  assert.equal(selectedFoodIcon({}, 'constructor'), undefined);
  assert.deepEqual(validateFoodIconSelections({ '牛乳': 'pizza' }), { '牛乳': 'pizza' });
});

test('LocalStoreは次回起動時にもアイコンの明示選択を復元する', async () => {
  const storage = store();
  const first = new LocalStore(storage);
  await first.load();
  await first.save({ ...base, icons: { 'たまご': 'fish' } });
  const restarted = new LocalStore(storage);
  assert.deepEqual((await restarted.load()).data.icons, { 'たまご': 'fish' });
});
