import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { restoreBackup } from './helpers/backup.mjs';
import { defaultTemplates, BACKUP_MAX_BYTES } from '../../src/food.ts';

const key = 'tabedoki:data:v3';
const legacyKey = 'tabedoki:foods:v1';
const item = { id: 'old-id', name: '以前の納豆', kind: 'use-by', deadline: '2020-01-01', quantity: 7, place: 'frozen', status: 'used', category: 'soy', unit: 'piece' };
const { category, unit, ...legacy } = item;
let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

async function seed(page, data = {}, fail = false) {
  await page.addInitScript(({ data, fail }) => {
    const original = Storage.prototype.setItem;
    if (!sessionStorage.getItem('v2-test-seeded')) {
      for (const [key, value] of Object.entries(data)) original.call(localStorage, key, value);
      original.call(sessionStorage, 'v2-test-seeded', 'yes');
      original.call(sessionStorage, 'v2-test-fail', String(fail));
    }
    window.__failFoodWrites = sessionStorage.getItem('v2-test-fail') === 'true';
    Storage.prototype.setItem = function(key, value) {
      if (window.__failFoodWrites && key === 'tabedoki:data:v3') throw new DOMException('test quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  }, { data, fail });
}
async function openNew(page) {
  await page.getByRole('button', { name: '食品を登録', exact: true }).last().click();
  return page.getByRole('dialog', { name: '食品を登録' });
}
async function upload(page, value) {
  await page.getByLabel('バックアップファイルを選択').setInputFiles({
    name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)),
  });
}
async function readSaved(page) { return page.evaluate(key => localStorage.getItem(key), key); }

test('定番と以前の食品から、今回の期限・新ID・数量1で登録する', async ({ page }, info) => {
  await seed(page, { [key]: JSON.stringify({ version: 3, templates: defaultTemplates(), items: [item] }) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  let dialog = await openNew(page);
  await expect(dialog.getByLabel(/期限の日付/)).toHaveValue('');
  await dialog.getByRole('button', { name: '以前の以前の納豆', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: /食品名/ })).toHaveValue(item.name);
  await expect(dialog.getByLabel('食品カテゴリ')).toHaveValue('soy');
  await expect(dialog.getByLabel('保存場所')).toHaveValue('frozen');
  await expect(dialog.getByLabel('数量', { exact: true })).toHaveValue('1');
  await expect(dialog.getByLabel('数量の単位')).toHaveValue('piece');
  await expect(dialog.getByLabel('期限の種類')).toHaveValue('use-by');
  await dialog.getByRole('button', { name: '登録する', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect.poll(async () => JSON.parse(await readSaved(page)).items.length).toBe(1);
  await dialog.getByLabel(/期限の日付/).fill('2026-12-01');
  await dialog.getByRole('button', { name: '定番の納豆', exact: true }).click();
  await expect(dialog.getByLabel(/期限の日付/)).toHaveValue('2026-12-01');
  await expect(dialog.getByLabel('数量の単位')).toHaveValue('pack');
  await dialog.getByRole('button', { name: '登録する', exact: true }).click();
  const saved = JSON.parse(await readSaved(page)).items;
  expect(saved[1]).toMatchObject({ name: '納豆', category: 'soy', quantity: 1, unit: 'pack', status: 'active', deadline: '2026-12-01' });
  expect(saved[1].id).not.toBe(item.id);
  dialog = await openNew(page);
  await dialog.getByRole('button', { name: '定番の納豆', exact: true }).click();
  await dialog.getByLabel(/期限の日付/).fill('2026-12-02');
  await dialog.getByRole('button', { name: '登録する', exact: true }).click();
  expect(JSON.parse(await readSaved(page)).items.map(x => x.deadline)).toEqual(['2020-01-01', '2026-12-01', '2026-12-02']);
  await openFilters(page);
  await page.getByLabel('カテゴリで絞り込み').selectOption('soy');
  await expect(page.getByText('1パック', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: '納豆を編集', exact: true }).last().click();
  await expect(page.getByRole('dialog').getByLabel(/期限の日付/)).toHaveValue('2026-12-02');
  await expect(page.getByRole('dialog').getByRole('button', { name: '定番の納豆' })).toHaveCount(0);
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await openNew(page);
  await page.screenshot({ path: info.outputPath('registration-390.png') });
});

test('v1自動移行・再読み込み・v1復元で旧項目と退避原文を保持する', async ({ page }) => {
  const raw = JSON.stringify({ version: 1, items: [{ ...legacy, status: 'active' }, { ...legacy, id: 'second', status: 'discarded' }] });
  await seed(page, { [legacyKey]: raw });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: item.name, exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), legacyKey)).toBe(raw);
  const saved = JSON.parse(await readSaved(page));
  expect(saved.items.map(x => x.id)).toEqual(['old-id', 'second']);
  expect(saved.items[0]).toMatchObject({ category: 'other', unit: 'item', quantity: 7, deadline: item.deadline });
  await page.reload();
  expect(JSON.parse(await readSaved(page))).toEqual(saved);
  page.once('dialog', dialog => dialog.accept());
  await upload(page, { version: 1, items: [legacy] });
  expect(JSON.parse(await readSaved(page)).items[0]).toMatchObject({ category: 'other', unit: 'item', status: 'used' });
  expect(await page.evaluate(key => localStorage.getItem(key), legacyKey)).toBe(raw);
});

test('移行保存失敗は読み取りとJSON退避を許可し、再試行で移行する', async ({ page }) => {
  const raw = JSON.stringify({ version: 1, items: [{ ...legacy, status: 'active' }] });
  await seed(page, { [legacyKey]: raw }, true);
  await page.goto('/');
  await expect(page.getByText(/現在は変更できません/)).toBeVisible();
  await expect(page.getByRole('button', { name: '食品を登録', exact: true }).last()).toBeDisabled();
  await expect(page.getByRole('button', { name: item.name + 'を編集' })).toBeDisabled();
  const downloadWait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'バックアップを保存', exact: true }).click();
  const backup = JSON.parse(readFileSync(await (await downloadWait).path(), 'utf8'));
  expect(backup.version).toBe(3);
  expect(backup.items).toHaveLength(1);
  expect(await readSaved(page)).toBeNull();
  expect(await page.evaluate(key => localStorage.getItem(key), legacyKey)).toBe(raw);
  await page.evaluate(() => sessionStorage.setItem('v2-test-fail', 'false'));
  await page.reload();
  await expect(page.getByRole('button', { name: '食品を登録', exact: true }).last()).toBeEnabled();
  expect(JSON.parse(await readSaved(page)).version).toBe(3);
});

for (const [label, raw] of [['破損', '{broken'], ['未知version', '{"version":4,"items":[]}'], ['不足項目', JSON.stringify({ version: 3, templates: defaultTemplates(), items: [legacy] })]]) {
  test('v3' + label + 'はv1へ戻さず、確認した復元で回復する', async ({ page }) => {
    await seed(page, { [key]: raw, [legacyKey]: JSON.stringify({ version: 1, items: [{ ...legacy, status: 'active' }] }) });
    await page.goto('/');
    await expect(page.getByText(/読み込めません/)).toBeVisible();
    await expect(page.getByRole('heading', { name: item.name })).toHaveCount(0);
    expect(await readSaved(page)).toBe(raw);
    page.once('dialog', dialog => dialog.accept());
    await upload(page, { version: 2, items: [{ ...item, status: 'active' }] });
    await expect(page.getByRole('heading', { name: item.name })).toBeVisible();
    expect(JSON.parse(await readSaved(page)).items[0]).toEqual({ ...item, status: 'active' });
  });
}

test('空のv3がある場合はv1を復活させず、表示だけで書き込まない', async ({ page }) => {
  const raw = '{"version":3,"items":[],"templates":[]}';
  await seed(page, { [key]: raw, [legacyKey]: JSON.stringify({ version: 1, items: [legacy] }) });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: item.name })).toHaveCount(0);
  expect(await readSaved(page)).toBe(raw);
});

test('保存失敗では新規・編集の入力と、完了・削除・復元の元データを保持する', async ({ page }) => {
  const original = JSON.stringify({ version: 3, templates: defaultTemplates(), items: [{ ...item, status: 'active' }] });
  await seed(page, { [key]: original }, true);
  await page.goto('/');
  let dialog = await openNew(page);
  await dialog.getByRole('button', { name: '定番の牛乳' }).click();
  await dialog.getByLabel(/期限の日付/).fill('2026-12-01');
  await dialog.getByRole('button', { name: '登録する', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('保存できません');
  await expect(dialog.getByRole('textbox', { name: /食品名/ })).toHaveValue('牛乳');
  expect(await readSaved(page)).toBe(original);
  await dialog.getByRole('button', { name: 'キャンセル' }).click();
  await page.getByRole('button', { name: item.name + 'を編集' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: /食品名/ }).fill('変更した納豆');
  await dialog.getByRole('button', { name: '変更を保存' }).click();
  await expect(dialog.getByRole('alert')).toContainText('保存できません');
  await expect(dialog.getByRole('textbox', { name: /食品名/ })).toHaveValue('変更した納豆');
  await dialog.getByRole('button', { name: 'キャンセル' }).click();
  await page.getByRole('button', { name: item.name + 'を使い切り' }).click();
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: item.name + 'のその他の操作' }).click();
  await page.getByRole('button', { name: item.name + 'を削除' }).click();
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await upload(page, { version: 2, items: [] });
  expect(await readSaved(page)).toBe(original);
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible();
  await page.evaluate(() => { window.__failFoodWrites = false; });
  await page.getByRole('button', { name: item.name + 'を編集' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: /食品名/ }).fill('変更した納豆');
  await page.getByRole('button', { name: '変更を保存' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(JSON.parse(await readSaved(page)).items[0].name).toBe('変更した納豆');
});

test('カテゴリ・場所・検索のAND絞り込み、復元の不正データと上限を検証する', async ({ page }) => {
  const original = JSON.stringify({ version: 3, templates: defaultTemplates(), items: [
    { ...item, status: 'active' },
    { ...item, id: 'milk', name: '牛乳', category: 'eggs-dairy', place: 'chilled', unit: 'bottle', status: 'active' },
  ] });
  await seed(page, { [key]: original });
  await page.goto('/');
  await openFilters(page);
  await page.getByLabel('カテゴリで絞り込み').selectOption('soy');
  await expect(page.getByRole('heading', { name: '牛乳', exact: true })).toHaveCount(0);
  await openFilters(page);
  await page.getByLabel('保存場所で絞り込み').selectOption('chilled');
  await expect(page.getByRole('heading', { name: item.name })).toHaveCount(0);
  await openFilters(page);
  await page.getByLabel('保存場所で絞り込み').selectOption('frozen');
  await page.getByRole('searchbox').fill('納豆');
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible();
  for (const value of [
    { version: 2, items: [{ ...item, category: 'unknown' }] },
    { version: 2, items: [{ ...item, unit: 'kg' }] },
    { version: 2, items: [item, item] },
    { version: 2, items: Array(3001).fill(item) },
  ]) {
    await upload(page, value);
    await expect(page.getByText(/復元できません/)).toBeVisible();
    expect(await readSaved(page)).toBe(original);
  }
  await page.getByLabel('バックアップファイルを選択').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.alloc(BACKUP_MAX_BYTES + 1, ' ') });
  await expect(page.getByText(/5MB以下/)).toBeVisible();
  expect(await readSaved(page)).toBe(original);
});

test('最大3,000件のアプリ出力を実ファイルとして復元できる', async ({ page }) => {
  test.setTimeout(60000);
  const items = Array.from({ length: 3000 }, (_, i) => ({ ...item, id: String(i), name: 'あ'.repeat(80), status: 'used' }));
  await seed(page, { [key]: JSON.stringify({ version: 3, templates: defaultTemplates(), items }) });
  await page.goto('/');
  const downloadWait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'バックアップを保存', exact: true }).click();
  const path = await (await downloadWait).path();
  const text = readFileSync(path, 'utf8');
  expect(Buffer.byteLength(text)).toBeGreaterThan(1024 * 1024);
  expect(Buffer.byteLength(text)).toBeLessThan(BACKUP_MAX_BYTES);
  await restoreBackup(page, path);
  await expect(page.getByText('3000件を復元しました。')).toBeVisible();
  expect(JSON.parse(await readSaved(page)).items).toEqual(items);
});

test('LocalStorage取得そのものが拒否されても画面を表示して保存を止める', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }));
  await page.goto('/');
  await expect(page.getByText(/読み込めません/)).toBeVisible();
  await expect(page.getByRole('button', { name: '食品を登録', exact: true }).last()).toBeDisabled();
});

for (const width of [320, 390, 1440]) {
  test(width + 'pxの登録候補・フォームが収まり、キーボードで選択できる', async ({ page }, info) => {
    await seed(page, { [key]: JSON.stringify({ version: 3, templates: defaultTemplates(), items: [{ ...item, name: '以前の食品'.repeat(13) }] }) });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const dialog = await openNew(page);
    const candidate = dialog.getByRole('button', { name: '定番のたまご', exact: true });
    await candidate.focus();
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('textbox', { name: /食品名/ })).toHaveValue('たまご');
    await expect(candidate).toHaveCSS('outline-style', 'solid');
    expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await dialog.evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: info.outputPath('registration-top-' + width + '.png') });
    await dialog.getByRole('button', { name: '登録する', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('registration-bottom-' + width + '.png') });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
}


async function openFilters(page) {
  const button = page.getByRole('button', { name: /^絞り込み/ });
  if (await button.getAttribute('aria-expanded') === 'false') await button.click();
}
