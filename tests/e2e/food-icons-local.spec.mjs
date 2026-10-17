import { test, expect } from '@playwright/test';
import { STORAGE_KEY, V4_STORAGE_KEY } from '../../src/data/storage.ts';
import { defaultTemplates } from '../../src/domain/templates.ts';

test('未ログインでもアイコン設定が端末保存され、再読み込み後も残る', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.addInitScript(({ key, data }) => {
    if (sessionStorage.getItem('icon-seeded')) return;
    localStorage.setItem(key, JSON.stringify(data));
    sessionStorage.setItem('icon-seeded', 'yes');
  }, {
    key: V4_STORAGE_KEY,
    data: { version: 4, shopping: [], templates: defaultTemplates(),
      items: [{ id: 'test', name: 'たまご', category: 'eggs-dairy', kind: 'best-before',
        deadline: '2026-12-31', quantity: 3, unit: 'piece', place: 'chilled', status: 'active', lowStock: false }] },
  });
  await page.goto('/');
  const button = page.getByRole('button', { name: 'たまごのアイコンを変更' });
  await button.click();
  const picker = page.getByRole('dialog', { name: 'たまごのアイコン' });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: '魚', exact: true }).click();
  await expect(picker).not.toBeVisible();
  await expect(page.locator('.food-row .food-icon .icon')).toHaveCSS('mask-image', /fish\.svg/);
  await expect.poll(async () => page.evaluate(key => JSON.parse(localStorage.getItem(key))?.icons?.['たまご'], STORAGE_KEY)).toBe('fish');
  await page.reload();
  await expect(page.locator('.food-row .food-icon .icon')).toHaveCSS('mask-image', /fish\.svg/);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key))?.icons?.['たまご'], STORAGE_KEY)).toBe('fish');
});
