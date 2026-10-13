import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { defaultTemplates } from '../../src/food.ts';
import { STORAGE_KEY, RECOVERY_KEY, BACKUP_MAX_BYTES } from '../../src/storage.ts';
import { shoppingFrom } from '../../src/shopping.ts';
import { openBackup, restoreBackup } from './helpers/backup.mjs';

const food = { id: 'stock', name: '牛乳', category: 'eggs-dairy', kind: 'use-by', deadline: '2026-12-20', quantity: 9, unit: 'bottle', place: 'chilled', status: 'active', lowStock: false };
const initial = (items = [food], shopping = []) => ({ version: 4, items, templates: defaultTemplates(), shopping });
test.beforeEach(({ page }) => {
  page.__shoppingErrors = [];
  page.on('pageerror', error => page.__shoppingErrors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') page.__shoppingErrors.push(msg.text()); });
});
test.afterEach(({ page }) => expect(page.__shoppingErrors).toEqual([]));
async function seed(page, value, failKey = null) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  await page.addInitScript(({ key, raw, failKey }) => {
    const write = Storage.prototype.setItem;
    if (!sessionStorage.getItem('shopping-seeded')) {
      write.call(localStorage, key, raw); write.call(sessionStorage, 'shopping-seeded', 'yes');
    }
    window.__shoppingFail = failKey;
    window.__canonicalWrites = 0;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'tabedoki:data:v3') window.__canonicalWrites++;
      if (key === window.__shoppingFail) throw new DOMException('quota', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  }, { key: STORAGE_KEY, raw, failKey });
}
async function saved(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY); }
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
    await page.getByLabel('牛乳の残りわずか').check();
    await page.getByRole('button', { name: '牛乳を買い物に追加', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('食品一覧 1件');
    await expect(page.getByRole('button', { name: '牛乳を買い物に追加', exact: true })).toHaveText('追加済み');
    await shopping(page);
    await expect(page.getByLabel('補充候補')).toHaveCount(0);
    await page.getByLabel('牛乳を購入済みにする').check();
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
    await page.evaluate(() => { window.__canonicalWrites = 0; });
    await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await expect(dialog).not.toBeVisible();
    expect(await page.evaluate(() => window.__canonicalWrites)).toBe(1);
    const after = await saved(page);
    expect(after.items).toHaveLength(2); expect(after.shopping).toEqual([]);
    expect(after.items[1]).toMatchObject({ name: '牛乳', quantity: 3, unit: 'bottle', category: 'eggs-dairy', place: 'chilled', kind: 'use-by', deadline: '2027-12-31', lowStock: false, status: 'active' });
    expect(after.items[1].id).not.toBe(food.id);
    await inventory(page); await expect(page.getByRole('searchbox')).toHaveValue('牛乳');
    await expect(page.getByLabel('消費期限 2027-12-31')).toHaveText('2027/12/31');
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
  await page.getByLabel('牛乳の残りわずか').last().check();
  await shopping(page); await expect(page.getByLabel('補充候補')).toBeVisible();
  await page.getByLabel('補充候補').getByRole('button', { name: '牛乳を買い物に追加' }).click();
  await page.getByLabel('牛乳を購入済みにする').check();
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
  await page.getByLabel('milkを購入済みにする', { exact: true }).check();
  await add(page, 'milk');
  await page.getByLabel('購入済み', { exact: true }).getByRole('checkbox').click();
  await expect(page.getByRole('status')).toContainText('同名');
  expect((await saved(page)).shopping.map(item => item.bought)).toEqual([true, false]);
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('未購入', { exact: true }).getByRole('button', { name: '買い物のmilkを削除' }).click();
  await page.getByRole('checkbox', { name: 'milkを購入済みにする', exact: true }).uncheck();
  await page.locator('.shopping-templates > summary').click();
  await page.getByRole('button', { name: '定番の牛乳を買い物に追加' }).click();
  expect((await saved(page)).shopping.find(item => item.name === '牛乳')).toMatchObject({ category: 'eggs-dairy', unit: 'bottle', place: 'chilled' });
});

test('購入登録の保存失敗・再試行とlowの編集/完了/復帰を保護する', async ({ page }) => {
  const value = initial([{ ...food, lowStock: true }], [{ ...shoppingFrom(food, 'bought'), bought: true }]);
  await seed(page, value, STORAGE_KEY); await page.goto('/'); await shopping(page);
  await page.getByRole('button', { name: '牛乳を在庫に登録' }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel(/期限の日付/).fill('20271231');
  await dialog.getByRole('button', { name: '登録する', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('保存できません');
  await expect(dialog.getByLabel(/期限の日付/)).toHaveValue('20271231');
  expect(await saved(page)).toEqual(value);
  await page.evaluate(() => { window.__shoppingFail = null; });
  await dialog.getByRole('button', { name: '登録する', exact: true }).click();
  expect((await saved(page)).shopping).toEqual([]);
  await inventory(page); await page.getByLabel('牛乳の詳細').first().click();
  await page.getByRole('button', { name: '牛乳を編集', exact: true }).first().click();
  await dialog.getByLabel('数量', { exact: true }).fill('8');
  await dialog.getByRole('button', { name: '変更を保存' }).click();
  expect((await saved(page)).items[0].lowStock).toBe(true);
  await page.getByRole('button', { name: '牛乳を使い切り', exact: true }).first().click();
  await page.getByRole('button', { name: '完了', exact: true }).click();
  await page.getByLabel('牛乳の詳細').click(); await page.getByRole('button', { name: '戻す', exact: true }).click();
  expect((await saved(page)).items[0].lowStock).toBe(true);
});

test('買い物300件上限と保存失敗は名前/購入チェックを保持する', async ({ page }) => {
  const items = Array.from({ length: 300 }, (_, i) => shoppingFrom('食品' + i, String(i)));
  const value = initial([], items);
  await seed(page, value, STORAGE_KEY); await page.goto('/'); await shopping(page);
  await add(page, '入力を保持'); await expect(page.getByRole('status')).toContainText('最大300件');
  await expect(page.getByLabel('買うものの名前')).toHaveValue('入力を保持');
  await page.getByRole('checkbox').first().click();
  await expect(page.getByRole('checkbox').first()).not.toBeChecked();
  expect(await saved(page)).toEqual(value);
});

test('破損原文を実ファイルに退避し、退避失敗で置換せず、旧JSON復元と直前復元ができる', async ({ page }) => {
  const raw = '{broken original';
  await seed(page, raw, RECOVERY_KEY); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'データの復旧', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '食品を登録しましょう', exact: true })).toHaveCount(0);
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: '読み込めないデータを退避' }).click();
  expect(readFileSync(await (await waiting).path(), 'utf8')).toBe(raw);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '空の状態から始める' }).click();
  await expect(page.getByRole('status')).toContainText('退避');
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(raw);
  await page.evaluate(() => { window.__shoppingFail = null; });
  await restoreBackup(page, { name: 'v2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 2, items: [food] })) });
  expect((await saved(page)).items[0].lowStock).toBe(false);
  await openBackup(page); await page.getByRole('button', { name: '直前の置換前データを復元' }).click();
  await expect(page.getByRole('status')).toContainText('復元できません');
  const previousDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '直前の置換前データを退避' }).click();
  expect(readFileSync(await (await previousDownload).path(), 'utf8')).toBe(raw);
  // A later validated replacement makes that valid generation available for explicit recovery.
  await restoreBackup(page, { name: 'v4.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(initial([], []))) });
  await openBackup(page); page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '直前の置換前データを復元' }).click();
  await expect(page.getByRole('status')).toContainText('直前の置換前データを復元しました');
  expect((await saved(page)).items).toHaveLength(1);
});

test('v3移行で原文と空定番を保持し、旧v3バックアップでは買い物を保持する', async ({ page }) => {
  const raw = JSON.stringify({ version: 3, items: [food], templates: [] });
  await seed(page, raw); await page.goto('/');
  expect(await page.evaluate(key => localStorage.getItem(key), RECOVERY_KEY)).toBe(raw);
  expect(await saved(page)).toMatchObject({ version: 4, templates: [], shopping: [], items: [{ ...food, lowStock: false }] });
  await shopping(page); await add(page, 'パン');
  await restoreBackup(page, { name: 'v3.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 3, items: [], templates: [] })) });
  expect((await saved(page)).shopping).toHaveLength(1);
  expect((await saved(page)).items).toEqual([]);
});

test('最大v4を実JSONで往復し300件在庫の検索・追加・最後の行を確認する', async ({ page }, info) => {
  test.setTimeout(60000);
  const items = Array.from({ length: 3000 }, (_, i) => ({ ...food, id: String(i), name: 'あ'.repeat(80), status: 'used' }));
  const shoppingItems = Array.from({ length: 300 }, (_, i) => shoppingFrom('買い物' + i, String(i)));
  const value = initial(items, shoppingItems);
  await seed(page, value); await page.goto('/'); await openBackup(page);
  const waiting = page.waitForEvent('download'); await page.getByRole('button', { name: 'バックアップを保存', exact: true }).click();
  const path = await (await waiting).path();
  expect(readFileSync(path).byteLength).toBeLessThan(BACKUP_MAX_BYTES);
  await restoreBackup(page, path); expect(await saved(page)).toEqual(value);
  const representative = initial(Array.from({ length: 300 }, (_, i) => ({ ...food, id: String(i), name: '代表食品' + i })));
  await restoreBackup(page, { name: 'representative.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(representative)) });
  await page.getByRole('searchbox').fill('代表食品299');
  await expect(page.locator('.food-row')).toHaveCount(1);
  await page.getByLabel('代表食品299の詳細').click();
  await page.getByRole('button', { name: '代表食品299を買い物に追加', exact: true }).click();
  expect((await saved(page)).shopping).toHaveLength(1);
  await page.getByRole('searchbox').clear();
  await page.locator('.food-row').last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('representative-300-last-row.png') });
});
