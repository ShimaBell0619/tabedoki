import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultTemplates } from '../src/food.ts';
import { MAX_SHOPPING, validateShopping, shoppingFrom, addShopping, setBought, replenishmentCandidates, foodFormFromShopping, registerPurchase } from '../src/shopping.ts';
const food = { ...defaultTemplates()[2], deadline: '2020-01-01', status: 'active', lowStock: true, quantity: 9 };

test('在庫は数量1、定番は設定数量を写し、購入の期限は常に空欄', () => {
  const item = shoppingFrom(food, 'shop');
  assert.equal(item.quantity, 1); assert.equal(Object.hasOwn(item, 'deadline'), false);
  assert.equal(shoppingFrom({ ...defaultTemplates()[2], quantity: 5 }, 'template').quantity, 5);
  assert.deepEqual(foodFormFromShopping(item), { name: food.name, category: food.category, kind: food.kind, quantity: 1, unit: food.unit, place: food.place, deadline: '' });
  assert.equal(Object.hasOwn(item, 'sourceFoodId'), false);
});
test('正規化名の未購入重複は数量を保持。購入済みへは明示再追加でき解除競合は拒否', () => {
  const first = { ...shoppingFrom('milk', 'a'), quantity: 7 };
  const duplicate = shoppingFrom(' ＭＩＬＫ ', 'b');
  assert.deepEqual(addShopping([first], duplicate), [first]);
  const bought = setBought([first], 'a', true);
  const both = addShopping(bought, duplicate);
  assert.equal(both.length, 2);
  assert.throws(() => setBought(both, 'a', false), /同名/);
  assert.deepEqual(both[0], bought[0]);
  assert.equal(setBought([bought[0]], 'a', false)[0].bought, false);
});
test('同名管理中が全件lowのときだけ候補。通常予備・完了のみ・購入済み待ちを除外', () => {
  const low = { ...food, name: 'milk' };
  const spare = { ...food, id: 'spare', name: ' ＭＩＬＫ ', lowStock: false };
  assert.deepEqual(replenishmentCandidates([low], []), [low]);
  assert.deepEqual(replenishmentCandidates([low, spare], []), []);
  assert.deepEqual(replenishmentCandidates([low, { ...spare, status: 'used' }], []), [low]);
  assert.deepEqual(replenishmentCandidates([{ ...low, status: 'used' }], []), []);
  assert.deepEqual(replenishmentCandidates([low], [{ ...shoppingFrom('MILK', 's'), bought: true }]), []);
});
test('上限・不正boolean・重複ID/未購入名・列挙値を拒否し既知項目だけ投影する', () => {
  const item = shoppingFrom('牛乳', 's');
  for (const value of [null, [null], [item, item], [{ ...item, bought: 1 }], [{ ...item, place: 'unknown' }], Array(MAX_SHOPPING + 1).fill(item)]) assert.throws(() => validateShopping(value));
  assert.deepEqual(validateShopping([{ ...item, deadline: '2020-01-01', sourceFoodId: 'drop' }]), [item]);
  assert.throws(() => registerPurchase({ items: [], templates: [], shopping: [item] }, item.id, { ...food, id: 'new', lowStock: false }));
});
