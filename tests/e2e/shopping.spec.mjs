import { cloudData, setCloudData } from './helpers/cloud.mjs';
import { test, expect } from './helpers/cloud.mjs';
import { defaultTemplates } from '../../src/domain/food.ts';
import { STORAGE_KEY } from '../../src/data/storage.ts';
import { shoppingFrom } from '../../src/domain/shopping.ts';

const food = { id: 'stock', name: '牛乳', category: 'eggs-dairy', kind: 'use-by', deadline: '2026-12-20', quantity: 9, unit: 'bottle', place: 'chilled', status: 'active', lowStock: false };
const initial = (items = [food], shopping = []) => ({ version: 4, items, templates: defaultTemplates(), shopping });
test.beforeEach(({ page }) => {
  page.__shoppingErrors = [];
  page.on('pageerror', error => page.__shoppingErrors.push(error.message));
  });
test.afterEach(({ page }) => expect(page.__shoppingErrors).toEqual([]));
async function seed(page, value) {
  await page.addInitScript(({ key, raw }) => {
    if (sessionStorage.getItem('fixtures-seeded')) return;
    localStorage.setItem(key, raw);
    sessionStorage.setItem('fixtures-seeded', 'yes');
  }, { key: STORAGE_KEY, raw: JSON.stringify(value) });
}
async function saved(page) { return await cloudData(page); }
async function shopping(page) { await page.getByRole('button', { name: '買い物', exact: true }).last().click(); }
async function inventory(page) { await page.getByRole('button', { name: '在庫', exact: true }).last().click(); }
async function add(page, name) {
  await page.getByLabel('買うものの名前').fill(name);
  await page.getByRole('button', { name: '追加する', exact: true }).first().click();
}

for (const width of [320, 390, 1440]) {
  test(`${width}pxで在庫→買い物→購入→今回の期限で登録を一度だけ保存する`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page, initial()); await page.goto('/');
    await page.getByRole('searchbox').fill('牛乳');
    const summary = page.getByLabel('牛乳の詳細');
    await summary.focus(); await page.keyboard.press('Enter');
    await page.getByLabel('牛乳の残りわずか').click();
    await expect(page.getByLabel('牛乳の残りわずか')).toBeChecked();
    await page.getByRole('button', { name: '牛乳を買い物に追加', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('食品一覧 1件');
    await expect(page.getByRole('status').filter({ hasText: '買い物に追加済み' })).toBeVisible();
    await expect(page.getByRole('button', { name: '牛乳を買い物に追加', exact: true })).toHaveCount(0);
    await shopping(page);
    await expect(page.getByLabel('補充候補')).toHaveCount(0);
    await page.getByLabel('牛乳の購入状態').click();
    await expect(page.getByLabel('牛乳の購入状態')).toBeChecked();
    expect((await saved(page)).items).toHaveLength(1);
    await page.screenshot({ path: info.outputPath(`shopping-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: '牛乳を在庫に登録' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel(/期限の日付/)).toHaveValue('');
    await expect(dialog.getByLabel(/期限の日付/)).toBeFocused();
    await expect(dialog.getByLabel('数量', { exact: true })).toHaveValue('1');
    await expect(dialog.getByLabel('食品カテゴリ')).toHaveValue('eggs-dairy');
    await expect(dialog.getByLabel('期限の種類')).toHaveValue('use-by');
    await dialog.getByRole('button', { name: 'キャンセル' }).click();
    expect((await saved(page)).shopping).toHaveLength(1);
    await page.getByRole('button', { name: '牛乳を在庫に登録' }).click();
    await dialog.getByLabel(/期限の日付/).fill('20271231');
    await dialog.getByLabel('数量', { exact: true }).fill('3');
    await page.screenshot({ path: info.outputPath(`purchase-editor-${width}.png`) });
    page.cloud.writes = 0;
    await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await expect(dialog).not.toBeVisible();
    expect(page.cloud.writes).toBe(1);
    const after = await saved(page);
    expect(after.items).toHaveLength(2); expect(after.shopping).toEqual([]);
    expect(after.items[1]).toMatchObject({ name: '牛乳', quantity: 3, unit: 'bottle', category: 'eggs-dairy', place: 'chilled', kind: 'use-by', deadline: '2027-12-31', lowStock: false, status: 'active' });
    expect(after.items[1].id).not.toBe(food.id);
    await inventory(page); await expect(page.getByRole('searchbox')).toHaveValue('牛乳');
    await page.getByLabel('牛乳の詳細').click();
    await expect(page.locator('.stock-lot').getByLabel('消費期限 2027-12-31', { exact: true })).toHaveText('2027/12/31');
    await page.screenshot({ path: info.outputPath(`purchase-inventory-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('同名通常在庫は補充を抑え、全件lowで候補。新在庫登録後は再提案しない', async ({ page }) => {
  await seed(page, initial([{ ...food, lowStock: true }, { ...food, id: 'spare' }])); await page.goto('/');
  await shopping(page); await expect(page.getByLabel('補充候補')).toHaveCount(0);
  await inventory(page);
  const summaries = page.getByLabel('牛乳の詳細');
  await summaries.last().click();
  await page.getByLabel('牛乳の残りわずか').last().click();
    await expect(page.getByLabel('牛乳の残りわずか').last()).toBeChecked();
  await shopping(page); await expect(page.getByLabel('補充候補')).toBeVisible();
  await page.getByLabel('補充候補').getByRole('button', { name: '牛乳を買い物に追加' }).click();
  await page.getByLabel('牛乳の購入状態').click();
    await expect(page.getByLabel('牛乳の購入状態')).toBeChecked();
  await expect(page.getByLabel('補充候補')).toHaveCount(0);
  await page.getByRole('button', { name: '牛乳を在庫に登録' }).click();
  await page.getByRole('dialog').getByLabel(/期限の日付/).fill('20271231');
  await page.getByRole('button', { name: '登録する', exact: true }).click();
  await expect(page.getByLabel('補充候補')).toHaveCount(0);
});

test('NFKC重複・購入済みへの再追加・解除競合・定番からの写しを検証する', async ({ page }) => {
  await seed(page, initial([], [{ ...shoppingFrom('milk', 'first'), quantity: 7 }])); await page.goto('/'); await shopping(page);
  await add(page, ' ＭＩＬＫ ');
  expect((await saved(page)).shopping).toHaveLength(1); expect((await saved(page)).shopping[0].quantity).toBe(7);
  await page.getByLabel('milkの購入状態', { exact: true }).click();
    await expect(page.getByLabel('milkの購入状態', { exact: true })).toBeChecked();
  await add(page, 'milk');
  await page.getByLabel('購入済み', { exact: true }).getByRole('checkbox').click();
  await expect(page.locator('.notice[role=status]')).toContainText('同名');
  expect((await saved(page)).shopping.map(item => item.bought)).toEqual([true, false]);
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('未購入', { exact: true }).getByRole('button', { name: '買い物のmilkを削除' }).click();
  await expect(page.getByRole('checkbox', { name: 'milkの購入状態', exact: true })).toHaveCount(1);
  await page.getByRole('checkbox', { name: 'milkの購入状態', exact: true }).click();
  await page.locator('.shopping-templates > summary').click();
  await page.getByRole('button', { name: '定番の牛乳を買い物に追加' }).click();
  expect((await saved(page)).shopping.find(item => item.name === '牛乳')).toMatchObject({ category: 'eggs-dairy', unit: 'bottle', place: 'chilled' });
});

test('最大データを読み込み300件在庫の検索・追加・最後の行を確認する', async ({ page }, info) => {
  test.setTimeout(60000);
  const items = Array.from({ length: 3000 }, (_, i) => ({ ...food, id: String(i), name: 'あ'.repeat(80), status: 'used' }));
  const shoppingItems = Array.from({ length: 300 }, (_, i) => shoppingFrom('買い物' + i, String(i)));
  const value = { ...initial(items, shoppingItems), templates: Array.from({ length: 50 }, (_, i) => ({ ...defaultTemplates()[0], id: 'template-' + i, name: '最大定番' + i })) };
  await seed(page, value); await page.goto('/'); expect(await saved(page)).toEqual(value);
  const representative = initial(Array.from({ length: 300 }, (_, i) => ({ ...food, id: String(i), name: '代表食品' + i })));
  await setCloudData(page, representative);
  await page.getByRole('searchbox').fill('代表食品299');
  await expect(page.locator('.food-row')).toHaveCount(1);
  await page.getByLabel('代表食品299の詳細').click();
  await page.getByRole('button', { name: '代表食品299を買い物に追加', exact: true }).click();
  expect((await saved(page)).shopping).toHaveLength(1);
  await page.getByRole('searchbox').clear();
  await page.locator('.food-row').last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('representative-300-last-row.png') });
});
