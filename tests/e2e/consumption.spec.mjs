import { test, expect, cloudData } from './helpers/cloud.mjs';
import { V4_STORAGE_KEY } from '../../src/data/storage.ts';
import { defaultTemplates } from '../../src/domain/templates.ts';

test('期限別の卵を一個ずつ減らし、最後の一個だけ食べ終わったになる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  const items = [
    { id: 'early', name: 'たまご', category: 'eggs-dairy', kind: 'best-before', deadline: '2027-03-10',
      quantity: 2, unit: 'piece', place: 'chilled', status: 'active', lowStock: false },
    { id: 'late', name: 'たまご', category: 'eggs-dairy', kind: 'best-before', deadline: '2027-03-20',
      quantity: 1, unit: 'piece', place: 'chilled', status: 'active', lowStock: false },
  ];
  await page.addInitScript(({ key, items, templates }) => {
    localStorage.setItem(key, JSON.stringify({ version: 4, items, templates, shopping: [] }));
  }, { key: V4_STORAGE_KEY, items, templates: defaultTemplates() });
  await page.goto('/');
  const row = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: 'たまご', exact: true }) });
  await row.locator('summary').click();
  const first = row.locator('.stock-lot').filter({ has: page.getByText('2027/03/10', { exact: true }) });
  const second = row.locator('.stock-lot').filter({ has: page.getByText('2027/03/20', { exact: true }) });
  await expect(first.getByRole('img', { name: '残り2 / 基準2' })).toBeVisible();
  await first.getByRole('button', { name: 'たまごを1個食べた' }).click();
  await expect(first.getByRole('img', { name: '残り1 / 基準2' })).toBeVisible();
  expect((await cloudData(page)).items.find(x => x.id === 'early')).toMatchObject({
    quantity: 1, initialQuantity: 2, status: 'active', consumption: 'eat',
  });
  await first.getByRole('button', { name: 'たまごを1個食べた' }).click();
  await expect(row.locator('.quantity')).toHaveText('1個');
  await expect(second.getByRole('button', { name: 'たまごを食べ終わった' })).toBeVisible();
  await second.getByRole('button', { name: 'たまごを食べ終わった' }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: '完了', exact: true }).click();
  const done = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: 'たまご', exact: true }) });
  await expect(done.locator('.quantity')).toHaveText('完了 2件');
  const cloud = await cloudData(page);
  expect(cloud.items.map(x => x.status)).toEqual(['used', 'used']);
  expect(cloud.items.map(x => x.initialQuantity)).toEqual([2, 1]);
});

test('調味料と飲料では最後の一単位を明確に区別する', async ({ page }) => {
  const items = [
    { id: 'sauce', name: 'しょうゆ', category: 'condiments', kind: 'best-before', deadline: '2027-04-01',
      quantity: 1, unit: 'bottle', place: 'chilled', status: 'active', lowStock: false },
    { id: 'milk', name: '牛乳', category: 'eggs-dairy', kind: 'use-by', deadline: '2027-04-01',
      quantity: 1, unit: 'bottle', place: 'chilled', status: 'active', lowStock: false },
  ];
  await page.addInitScript(({ key, items, templates }) => {
    localStorage.setItem(key, JSON.stringify({ version: 4, items, templates, shopping: [] }));
  }, { key: V4_STORAGE_KEY, items, templates: defaultTemplates() });
  await page.goto('/');
  const sauce = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: 'しょうゆ' }) });
  const milk = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: '牛乳' }) });
  await sauce.locator('summary').click();
  await milk.locator('summary').click();
  await expect(sauce.getByRole('button', { name: 'しょうゆを使い終わった' })).toBeVisible();
  await expect(milk.getByRole('button', { name: '牛乳を飲み終わった' })).toBeVisible();
});
