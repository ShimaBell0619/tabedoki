import { cloudData } from './helpers/cloud.mjs';
import { openCandidates, openFoodActions } from './helpers/inventory.mjs';
import { test, expect } from './helpers/cloud.mjs';
import { defaultTemplates } from '../../src/domain/templates.ts';
import { V4_STORAGE_KEY, V3_STORAGE_KEY } from '../../src/data/storage.ts';

const key = V4_STORAGE_KEY;
const v3Key = V3_STORAGE_KEY;
const item = { id: 'old-id', name: '以前の納豆', kind: 'use-by', deadline: '2020-01-01', quantity: 7, place: 'frozen', status: 'used', category: 'soy', unit: 'piece', lowStock: false };
let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  });
test.afterEach(() => expect(errors).toEqual([]));

async function seed(page, values = {}) {
  await page.addInitScript(values => {
    if (sessionStorage.getItem('fixtures-seeded')) return;
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    sessionStorage.setItem('fixtures-seeded', 'yes');
  }, values);
}
async function openNew(page) {
  await page.getByRole('button', { name: '食品を登録', exact: true }).last().click();
  return page.getByRole('dialog', { name: '食品を登録' });
}
async function readSaved(page) { return JSON.stringify(await cloudData(page)); }

test('定番と以前の食品から、今回の期限・新ID・数量1で登録する', async ({ page }, info) => {
  await seed(page, { [v3Key]: JSON.stringify({ version: 3, templates: defaultTemplates(), items: [item] }) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  let dialog = await openNew(page);
  await expect(dialog.getByLabel(/期限の日付/)).toHaveValue('');
    await openCandidates(dialog);
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
    await openCandidates(dialog);
  await dialog.getByRole('button', { name: '定番の納豆', exact: true }).click();
  await expect(dialog.getByLabel(/期限の日付/)).toHaveValue('2026-12-01');
  await expect(dialog.getByLabel('数量の単位')).toHaveValue('pack');
  await dialog.getByRole('button', { name: '登録する', exact: true }).click();
  const saved = JSON.parse(await readSaved(page)).items;
  expect(saved[1]).toMatchObject({ name: '納豆', category: 'soy', quantity: 3, unit: 'pack', status: 'active', deadline: '2026-12-01' });
  expect(saved[1].id).not.toBe(item.id);
  dialog = await openNew(page);
    await openCandidates(dialog);
  await dialog.getByRole('button', { name: '定番の納豆', exact: true }).click();
  await dialog.getByLabel(/期限の日付/).fill('2026-12-02');
  await dialog.getByRole('button', { name: '登録する', exact: true }).click();
  expect(JSON.parse(await readSaved(page)).items.map(x => x.deadline)).toEqual(['2020-01-01', '2026-12-01', '2026-12-02']);
  await openFilters(page);
  await page.getByLabel('カテゴリで絞り込み').selectOption('soy');
  await expect(page.getByText('3パック', { exact: true })).toHaveCount(2);
    await openFoodActions(page);
  await page.getByRole('button', { name: '納豆を編集', exact: true }).last().click();
  await expect(page.getByRole('dialog').getByLabel(/期限の日付/)).toHaveValue('2026-12-02');
    await openCandidates(dialog);
  await expect(page.getByRole('dialog').getByRole('button', { name: '定番の納豆' })).toHaveCount(0);
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await openNew(page);
  await page.screenshot({ path: info.outputPath('registration-390.png') });
});

test('カテゴリ・場所をANDで絞り込む', async ({ page }) => {
  const original = JSON.stringify({ version: 4, shopping: [], templates: defaultTemplates(), items: [
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
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible();

});


for (const width of [320, 390, 1440]) {
  test(width + 'pxの登録候補・フォームが収まり、キーボードで選択できる', async ({ page }, info) => {
    await seed(page, { [v3Key]: JSON.stringify({ version: 3, templates: defaultTemplates(), items: [{ ...item, name: '以前の食品'.repeat(13) }] }) });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const dialog = await openNew(page);
    await openCandidates(dialog);
    const candidate = dialog.getByRole('button', { name: '定番のたまご', exact: true });
    await candidate.focus();
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('textbox', { name: /食品名/ })).toHaveValue('たまご');
    await expect(dialog.getByLabel(/期限の日付/)).toBeFocused();
    await expect(dialog.getByLabel(/期限の日付/)).toHaveCSS('outline-style', 'solid');
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
