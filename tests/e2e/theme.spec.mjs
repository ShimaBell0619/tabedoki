import { test, expect } from './helpers/cloud.mjs';

test('端末のダーク設定に追従しブラウザー色とガラス色が切り替わる', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0E1115');
  await expect(page.locator('.page')).toHaveCSS('background-color', 'rgb(14, 17, 21)');
  await expect(page.locator('.mobile-navigation-glass')).toHaveCSS('backdrop-filter', /blur\(3px\)/);
  await expect(page.locator('.mobile-navigation-glass')).toHaveCSS('background-color', 'rgba(27, 37, 50, 0.52)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#354F70');
});

test('3点メニューで手動切り替えと設定の永続化ができる', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'アカウント', exact: true });
  await trigger.click();
  await expect(page.getByRole('menuitemradio', { name: '端末に合わせる' })).toHaveAttribute('data-state', 'checked');
  await page.getByRole('menuitemradio', { name: 'ダーク' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0E1115');
  expect(await page.evaluate(() => localStorage.getItem('tabedoki-theme'))).toBe('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await trigger.click();
  await page.getByRole('menuitemradio', { name: '端末に合わせる' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('tabedoki-theme'))).toBeNull();
});

test('ダークモードでも食品登録フォームと他画面にライト背景が残らない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByRole('button', { name: '食品を登録', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('background-color', 'rgb(34, 39, 45)');
  await expect(dialog.locator('input').first()).toHaveCSS('background-color', 'rgb(34, 39, 45)');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'カレンダー', exact: true }).click();
  await expect(page.locator('.page')).toHaveCSS('background-color', 'rgb(14, 17, 21)');
  await page.getByRole('button', { name: '買い物', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
