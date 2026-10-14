import { openCandidates, openFoodActions } from './helpers/inventory.mjs';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { defaultTemplates } from '../../src/food.ts';
import { STORAGE_KEY, V2_STORAGE_KEY } from '../../src/storage.ts';
import { restoreBackup, openBackup } from './helpers/backup.mjs';

const stock = { id: 'stock-1', name: '在庫の牛乳', kind: 'use-by', deadline: '2026-12-01', quantity: 7, unit: 'bottle', category: 'eggs-dairy', place: 'chilled', status: 'active', lowStock: false };
const initial = () => ({ version: 4, items: [stock], templates: defaultTemplates(), shopping: [] });
let errors;
test.beforeEach(({ page }) => {
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));
async function seed(page, values, fail = false) {
  await page.addInitScript(({ values, fail, key }) => {
    const setItem = Storage.prototype.setItem;
    if (!sessionStorage.getItem('templates-seeded')) {
      for (const [key, value] of Object.entries(values)) setItem.call(localStorage, key, value);
      setItem.call(sessionStorage, 'templates-seeded', 'yes');
    }
    window.__failWrites = fail;
    window.__dataWrites = 0;
    Storage.prototype.setItem = function(name, value) {
      if (name === key) {
        window.__dataWrites++;
        if (window.__failWrites) throw new DOMException('test quota', 'QuotaExceededError');
      }
      return setItem.call(this, name, value);
    };
  }, { values, fail, key: STORAGE_KEY });
}
async function saved(page) { return page.evaluate(key => localStorage.getItem(key), STORAGE_KEY); }
async function manage(page) {
  await page.getByRole('button', { name: '定番食品を管理', exact: true }).click();
  return page.getByRole('dialog');
}
async function newFood(page) {
  await page.getByRole('button', { name: '食品を登録', exact: true }).last().click();
  return page.getByRole('dialog');
}
async function upload(page, value, accept = true, notice) {
  await restoreBackup(page, { name: 'templates.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) }, { accept, notice });
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
  expect(JSON.parse(await saved(page)).items).toEqual([stock]);
  expect(await page.evaluate(() => window.__dataWrites)).toBe(1);
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
  expect(foods[0]).toEqual(stock);
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

test('追加・編集・削除と一括復元の保存失敗は定番・在庫・入力を保持する', async ({ page }) => {
  const raw = JSON.stringify(initial());
  await seed(page, { [STORAGE_KEY]: raw }, true);
  await page.goto('/');
  let dialog = await manage(page);
  await dialog.getByRole('button', { name: '定番食品を追加', exact: true }).click();
  await dialog.getByRole('textbox', { name: /定番食品名/ }).fill('失敗した定番');
  await dialog.getByRole('button', { name: '定番を保存', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('保存できません');
  await expect(dialog.getByRole('textbox')).toHaveValue('失敗した定番');
  expect(await saved(page)).toBe(raw);
  await dialog.getByRole('button', { name: '一覧に戻る' }).click();
  await dialog.getByRole('button', { name: '定番の牛乳を編集' }).click();
  await dialog.getByRole('textbox').fill('変更した牛乳');
  await dialog.getByRole('button', { name: '定番を保存' }).click();
  await expect(dialog.getByRole('textbox')).toHaveValue('変更した牛乳');
  expect(await saved(page)).toBe(raw);
  await dialog.getByRole('button', { name: '一覧に戻る' }).click();
  page.once('dialog', dialog => dialog.accept());
  await dialog.getByRole('button', { name: '定番の牛乳を削除' }).click();
  await expect(dialog.getByRole('button', { name: '定番の牛乳を編集' })).toBeVisible();
  expect(await saved(page)).toBe(raw);
  await dialog.getByRole('button', { name: '完了', exact: true }).click();
  await upload(page, { version: 3, items: [], templates: [] }, true, /保存できません/);
  expect(await saved(page)).toBe(raw);
  await page.evaluate(() => { window.__failWrites = false; });
  dialog = await manage(page);
  await dialog.getByRole('button', { name: '定番食品を追加' }).click();
  await dialog.getByRole('textbox').fill('再試行した定番');
  await dialog.getByRole('button', { name: '定番を保存' }).click();
  expect(JSON.parse(await saved(page)).templates).toHaveLength(11);
  expect(JSON.parse(await saved(page)).items).toEqual([stock]);
});

for (const items of [[], [stock]]) {
  test(`v2の${items.length}食品を保持してv4へ移行し、v2原文を残す`, async ({ page }) => {
    const raw = JSON.stringify({ version: 2, items });
    await seed(page, { [V2_STORAGE_KEY]: raw, 'tabedoki:foods:v1': JSON.stringify({ version: 1, items: [] }) });
    await page.goto('/');
    expect(JSON.parse(await saved(page))).toEqual({ version: 4, items, templates: defaultTemplates(), shopping: [] });
    expect(await page.evaluate(key => localStorage.getItem(key), V2_STORAGE_KEY)).toBe(raw);
    await page.reload();
    expect(await page.evaluate(() => window.__dataWrites)).toBe(0);
  });
}

test('v1/v2バックアップ復元は現在のカスタム定番を保持する', async ({ page }) => {
  const templates = [{ ...defaultTemplates()[0], id: 'custom', name: '自分のたまご', quantity: 2 }];
  await seed(page, { [STORAGE_KEY]: JSON.stringify({ ...initial(), templates }) });
  await page.goto('/');
  const { category, unit, ...legacy } = stock;
  for (const value of [{ version: 1, items: [legacy] }, { version: 2, items: [] }]) {
    await upload(page, value);
    expect(JSON.parse(await saved(page)).templates).toEqual(templates);
  }
});

test('v4の実バックアップは食品と定番を一緒に復元し、取消しでは変えない', async ({ page }) => {
  // 待機の代用ではなく、読取りが次の操作より遅れる条件を再現する。
  await page.addInitScript(() => {
    const read = File.prototype.text;
    File.prototype.text = async function() {
      await new Promise(resolve => setTimeout(resolve, 100));
      return read.call(this);
    };
  });
  const data = { ...initial(), templates: [{ ...defaultTemplates()[0], id: 'custom', name: '自分のたまご', quantity: 4 }] };
  await seed(page, { [STORAGE_KEY]: JSON.stringify(data) });
  await page.goto('/');
  const waiting = page.waitForEvent('download');
  await openBackup(page);
  await page.getByRole('button', { name: 'バックアップを保存', exact: true }).click();
  const path = await (await waiting).path();
  const exported = JSON.parse(readFileSync(path, 'utf8'));
  expect(exported).toMatchObject(data);
  await upload(page, { version: 3, items: [], templates: [] }, false);
  expect(JSON.parse(await saved(page))).toEqual(data);
  await upload(page, { version: 3, items: [], templates: [] });
  await restoreBackup(page, path);
  await expect.poll(async () => JSON.parse(await saved(page))).toEqual(data);
});

test('不正な定番の復元と重複名を拒否し、50件上限を表示する', async ({ page }) => {
  const raw = JSON.stringify(initial());
  await seed(page, { [STORAGE_KEY]: raw });
  await page.goto('/');
  for (const templates of [null, [{ ...defaultTemplates()[0], quantity: 0 }], [defaultTemplates()[0], defaultTemplates()[0]], Array(51).fill(defaultTemplates()[0])]) {
    await page.getByLabel('バックアップファイルを選択').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 3, items: [], templates })) });
    await expect(page.getByText(/復元できません/)).toBeVisible();
    expect(await saved(page)).toBe(raw);
  }
  const dialog = await manage(page);
  await dialog.getByRole('button', { name: '定番食品を追加' }).click();
  await dialog.getByRole('textbox').fill('  牛乳  ');
  await dialog.getByRole('button', { name: '定番を保存' }).click();
  await expect(dialog.getByRole('alert')).toContainText('同じ名前');
  expect(await saved(page)).toBe(raw);
  await dialog.getByRole('button', { name: '閉じる' }).click();
  const templates = Array.from({ length: 50 }, (_, i) => ({ ...defaultTemplates()[0], id: 'template-' + i, name: '定番' + i }));
  await upload(page, { version: 3, items: [stock], templates });
  await manage(page);
  await expect(page.getByRole('button', { name: '定番食品を追加' })).toBeDisabled();
  await expect(page.getByText('50 / 50件')).toBeVisible();
});

for (const width of [320, 390, 1440]) {
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
