import { test, expect } from '@playwright/test';
import { STORAGE_KEY, V3_STORAGE_KEY } from '../../src/data/storage.ts';

const food = { id: 'old', name: '端末の牛乳', category: 'eggs-dairy', kind: 'use-by', deadline: '2026-12-31', quantity: 1, unit: 'bottle', place: 'chilled', status: 'active', lowStock: false };

test('ログインなしで登録し、再読み込み後もローカル保存される', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /食品一覧/ })).toBeVisible();
  await page.getByRole('button', { name: 'アカウント' }).click();
  await expect(page.getByText('この端末に保存中', { exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Googleでログインしてクラウド保存' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '食品を登録', exact: true }).last().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/食品名/).fill('ローカルの納豆');
  await dialog.getByLabel(/期限の日付/).fill('2026-12-31');
  await dialog.getByRole('button', { name: '登録する', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ローカルの納豆', exact: true })).toBeVisible();
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)).items).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ローカルの納豆', exact: true })).toBeVisible();
});
test('未ログインでもv3をv4へ移行し、旧原文を保持する', async ({ page }) => {
  const { lowStock, ...old } = food;
  const raw = JSON.stringify({ version: 3, items: [old], templates: [] });
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key: V3_STORAGE_KEY, raw });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: food.name, exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), V3_STORAGE_KEY)).toBe(raw);
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)).items[0].lowStock).toBe(false);
});
test('ローカル正本が破損したら操作を止めて原文を残す', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{broken'), STORAGE_KEY);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '保存データを読み込めません' })).toBeVisible();
  await expect(page.getByRole('button', { name: '食品を登録', exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe('{broken');
});
