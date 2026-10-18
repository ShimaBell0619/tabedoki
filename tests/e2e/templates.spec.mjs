import { cloudData, setCloudData } from './helpers/cloud.mjs';
import { openCandidates, openFoodActions } from './helpers/inventory.mjs';
import { test, expect } from './helpers/cloud.mjs';
import { defaultTemplates } from '../../src/domain/templates.ts';
import { V4_STORAGE_KEY as STORAGE_KEY } from '../../src/data/storage.ts';

const stock = { id: 'stock-1', name: '在庫の牛乳', kind: 'use-by', deadline: '2026-12-01', quantity: 7, unit: 'bottle', category: 'eggs-dairy', place: 'chilled', status: 'active', lowStock: false };
const normalizedStock = { ...stock, initialQuantity: 7, consumption: 'drink' };
const initial = () => ({ version: 4, items: [stock], templates: defaultTemplates(), shopping: [] });
let errors;
test.beforeEach(({ page }) => {
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  });
test.afterEach(() => expect(errors).toEqual([]));
async function seed(page, values) {
  await page.addInitScript(values => {
    if (sessionStorage.getItem('fixtures-seeded')) return;
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    sessionStorage.setItem('fixtures-seeded', 'yes');
  }, values);
}
async function saved(page) { return JSON.stringify(await cloudData(page)); }
async function manage(page) {
  await page.getByRole('button', { name: '定番食品を管理', exact: true }).click();
  return page.getByRole('dialog');
}
async function newFood(page) {
  await page.getByRole('button', { name: '食品を登録', exact: true }).last().click();
  return page.getByRole('dialog');
}

test('定番の追加・編集・削除を保存し、在庫を変えず新規登録に設定を使う', async ({ page }) => {
  await seed(page, { [STORAGE_KEY]: JSON.stringify(initial()) });
  await page.goto('/');
  let dialog = await manage(page);
  await dialog.getByRole('button', { name: '定番の牛乳を編集', exact: true }).click();
  await dialog.getByRole('textbox', { name: /定番食品名/ }).fill('低脂肪牛乳');
  await dialog.getByLabel('期限の種類').selectOption('use-by');
  await dialog.getByLabel('初期数量').fill('2');
  await dialog.getByRole('button', { name: '定番を保存', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '定番の低脂肪牛乳を編集' })).toBeVisible();
  expect(JSON.parse(await saved(page)).items).toEqual([normalizedStock]);
  expect(page.cloud.writes).toBe(1);
  await dialog.getByRole('button', { name: '定番食品を追加', exact: true }).click();
  await dialog.getByRole('textbox', { name: /定番食品名/ }).fill('オートミール');
  await dialog.getByLabel('食品カテゴリ').selectOption('staples');
  await dialog.getByLabel('保存場所').selectOption('pantry');
  await dialog.getByLabel('初期数量').fill('3');
  await dialog.getByLabel('数量の単位').selectOption('bag');
  await dialog.getByRole('button', { name: '定番を保存', exact: true }).click();
  const after = JSON.parse(await saved(page));
  expect(after.templates).toHaveLength(11);
  await page.reload();
  expect(JSON.parse(await saved(page))).toEqual(after);
  dialog = await newFood(page);
    await openCandidates(dialog);
  await dialog.getByRole('button', { name: '定番の低脂肪牛乳', exact: true }).click();
  await expect(dialog.getByLabel('数量', { exact: true })).toHaveValue('2');
  await expect(dialog.getByLabel('期限の種類')).toHaveValue('use-by');
  await expect(dialog.getByLabel(/期限の日付/)).toHaveValue('');
  await dialog.getByLabel(/期限の日付/).fill('2026-12-20');
  await dialog.getByRole('button', { name: '登録する', exact: true }).click();
  const foods = JSON.parse(await saved(page)).items;
  expect(foods[0]).toEqual(normalizedStock);
  expect(foods[1]).toMatchObject({ name: '低脂肪牛乳', quantity: 2, kind: 'use-by', unit: 'bottle', deadline: '2026-12-20' });
  expect(foods[1].id).not.toBe(after.templates.find(x => x.name === '低脂肪牛乳').id);
  dialog = await manage(page);
  page.once('dialog', dialog => dialog.dismiss());
  await dialog.getByRole('button', { name: '定番の低脂肪牛乳を削除', exact: true }).click();
  expect(JSON.parse(await saved(page)).templates).toHaveLength(11);
  page.once('dialog', dialog => dialog.accept());
  await dialog.getByRole('button', { name: '定番の低脂肪牛乳を削除', exact: true }).click();
  expect(JSON.parse(await saved(page)).items).toEqual(foods);
  await dialog.getByRole('button', { name: '完了', exact: true }).click();
  dialog = await newFood(page);
    await openCandidates(dialog);
  await expect(dialog.getByRole('button', { name: '定番の低脂肪牛乳', exact: true })).toHaveCount(0);
    await openCandidates(dialog);
  await expect(dialog.getByRole('button', { name: '以前の低脂肪牛乳', exact: true })).toBeVisible();
});

test('定番をすべて削除しても再読み込みで初期10件を復活させない', async ({ page }) => {
  await seed(page, { [STORAGE_KEY]: JSON.stringify({ ...initial(), templates: [defaultTemplates()[0]] }) });
  await page.goto('/');
  const dialog = await manage(page);
  page.once('dialog', dialog => dialog.accept());
  await dialog.getByRole('button', { name: '定番のたまごを削除', exact: true }).click();
  await expect(dialog.getByText(/まだありません/)).toBeVisible();
  expect(JSON.parse(await saved(page))).toMatchObject({ items: [stock], templates: [] });
  await page.reload();
  const food = await newFood(page);
    await openCandidates(food);
  await expect(food.getByRole('button', { name: /^定番の/ })).toHaveCount(0);
  await food.getByRole('textbox', { name: /食品名/ }).fill('自由入力');
  await food.getByLabel(/期限の日付/).fill('2026-12-25');
  await food.getByRole('button', { name: '登録する', exact: true }).click();
  expect(JSON.parse(await saved(page)).templates).toEqual([]);
});



test('定番の重複名を拒否し、50件上限を表示する', async ({ page }) => {
  const raw = JSON.stringify(initial());
  await seed(page, { [STORAGE_KEY]: raw });
  await page.goto('/');
  const beforeInvalid = JSON.parse(await saved(page));
  const dialog = await manage(page);
  await dialog.getByRole('button', { name: '定番食品を追加' }).click();
  await dialog.getByRole('textbox').fill('  牛乳  ');
  await dialog.getByRole('button', { name: '定番を保存' }).click();
  await expect(dialog.getByRole('alert')).toContainText('同じ名前');
  expect(JSON.parse(await saved(page))).toEqual(beforeInvalid);
  await dialog.getByRole('button', { name: '閉じる' }).click();
  const templates = Array.from({ length: 50 }, (_, i) => ({ ...defaultTemplates()[0], id: 'template-' + i, name: '定番' + i }));
  await setCloudData(page, { version: 4, items: [stock], templates, shopping: [] });
  await manage(page);
  await expect(page.getByRole('button', { name: '定番食品を追加' })).toBeDisabled();
  await expect(page.getByText('50 / 50件')).toBeVisible();
});

for (const width of [320, 390, 430, 1440]) {
  test(`${width}pxで管理・編集が収まり、登録途中の入力とキーボード操作を保持する`, async ({ page }, info) => {
    const longName = '長い定番食品名'.repeat(10);
    await seed(page, { [STORAGE_KEY]: JSON.stringify({ ...initial(), templates: [...defaultTemplates(), { ...defaultTemplates()[0], id: 'long', name: longName }] }) });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    let dialog = await newFood(page);
    await dialog.getByRole('textbox', { name: /食品名/ }).fill('登録途中の食品');
    await dialog.getByLabel(/期限の日付/).fill('2026-12-24');
    await dialog.getByLabel('数量', { exact: true }).fill('4');
    await openCandidates(dialog);
    const entry = dialog.getByRole('button', { name: '定番を編集', exact: true });
    await entry.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: '定番食品を管理' })).toBeVisible();
    expect(await dialog.evaluate(el => el.scrollTop)).toBe(0);
    expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('templates-' + width + '.png') });
    await dialog.getByRole('button', { name: `定番の${longName}を編集`, exact: true }).click();
    await expect(dialog.getByRole('textbox')).toHaveValue(longName);
    expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await dialog.getByRole('button', { name: '定番を保存' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('template-editor-' + width + '.png') });
    await page.keyboard.press('Escape');
    dialog = page.getByRole('dialog', { name: '食品を登録' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /食品名/ })).toHaveValue('登録途中の食品');
    await expect(dialog.getByLabel(/期限の日付/)).toHaveValue('2026-12-24');
    await expect(dialog.getByLabel('数量', { exact: true })).toHaveValue('4');
    await expect(dialog.locator(':focus')).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
}
