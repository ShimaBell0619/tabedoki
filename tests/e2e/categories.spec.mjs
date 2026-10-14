import { cloudData } from './helpers/cloud.mjs';
import { test, expect } from './helpers/cloud.mjs';
import { defaultTemplates } from '../../src/food.ts';
import { STORAGE_KEY } from '../../src/storage.ts';

test('カテゴリ別を初期表示し、期限順・場所別への切替と絞り込みを保つ', async ({ page }) => {
  const item = (id, name, category, place, deadline) => ({
    id, name, category, place, deadline,
    kind: 'best-before', quantity: 1, unit: 'piece', status: 'active', lowStock: false,
  });
  const data = {
    version: 4, templates: defaultTemplates(), shopping: [],
    items: [
      item('1', 'しょうゆ', 'condiments', 'pantry', '2027-10-01'),
      item('2', 'パスタソース', 'retort-canned', 'pantry', '2027-09-20'),
      item('3', 'パスタ', 'staples', 'pantry', '2027-03-10'),
      item('4', '牛乳', 'eggs-dairy', 'chilled', '2027-01-01'),
      item('5', 'レトルトカレー', 'retort-canned', 'pantry', '2027-02-01'),
    ],
  };
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: STORAGE_KEY, data });
  await page.goto('/');
  const mode = page.getByLabel('一覧の表示方法');
  await expect(mode).toHaveValue('category');
  const retort = page.getByRole('heading', { name: 'レトルト・缶詰', exact: true });
  await expect(retort).toBeVisible();
  await expect(retort.locator('.group-count')).toHaveText('2件');
  await expect(retort.locator('..').locator('.food-primary h3')).toHaveText(['レトルトカレー', 'パスタソース']);
  await expect(page.getByRole('heading', { name: '主食・麺・パン', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '調味料', exact: true })).toBeVisible();

  await mode.selectOption('deadline');
  await expect(retort).toHaveCount(0);
  await expect(page.locator('.food-primary h3')).toHaveText(['牛乳', 'レトルトカレー', 'パスタ', 'パスタソース', 'しょうゆ']);
  await mode.selectOption('place');
  await expect(page.getByRole('heading', { name: '冷蔵', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '常温', exact: true })).toBeVisible();
  await mode.selectOption('category');

  await page.getByRole('button', { name: /^絞り込み/ }).click();
  await page.getByLabel('カテゴリで絞り込み').selectOption('retort-canned');
  await expect(page.locator('.food-row')).toHaveCount(2);
  await expect(retort).toBeVisible();
  await expect(page.getByRole('heading', { name: '調味料', exact: true })).toHaveCount(0);
  await page.getByRole('searchbox').fill('カレー');
  await expect(retort.locator('.group-count')).toHaveText('1件');
  await page.getByRole('button', { name: '条件をクリア' }).click();
  await expect(retort.locator('.group-count')).toHaveText('2件');

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${width}pxで横スクロールしない`).toBeLessThanOrEqual(1);
  }
  await mode.focus();
  await expect(mode).toBeFocused();
});

test('パスタ・レトルトカレーを初期定番から登録し、新カテゴリで保存する', async ({ page }) => {
  await page.goto('/');
  for (const [name, category] of [['パスタ', 'staples'], ['レトルトカレー', 'retort-canned']]) {
    await page.getByRole('button', { name: '食品を登録', exact: true }).last().click();
    const dialog = page.getByRole('dialog', { name: '食品を登録' });
    await dialog.getByRole('button', { name: '定番・以前の登録から入力' }).click();
    await dialog.getByRole('button', { name: `定番の${name}`, exact: true }).click();
    await expect(dialog.getByLabel('食品カテゴリ')).toHaveValue(category);
    await expect(dialog.getByLabel('保存場所')).toHaveValue('pantry');
    await dialog.getByLabel(/期限の日付/).fill('2027-12-01');
    await dialog.getByRole('button', { name: '登録する', exact: true }).click();
    await expect(dialog).not.toBeVisible();
  }
  const stored = await cloudData(page);
  expect(stored.version).toBe(4);
  expect(stored.items.map(({ name, category }) => ({ name, category }))).toEqual([
    { name: 'パスタ', category: 'staples' },
    { name: 'レトルトカレー', category: 'retort-canned' },
  ]);
});
