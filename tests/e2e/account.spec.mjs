import { test, expect, cloudData } from './helpers/cloud.mjs';

for (const width of [320, 390, 1440]) {
  test(`${width}pxでアカウント操作を畳み、キーボード・再取得・ログアウトを使える`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const before = await cloudData(page);
    await expect(page.getByRole('menu').getByText('test@example.com', { exact: true })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: '再取得', exact: true })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'ログアウト', exact: true })).not.toBeVisible();
    await expect(page.locator('.settings-page').getByText('クラウド保存', { exact: true })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'バックアップ', exact: true })).toHaveCount(0);
    await expect(page.locator('input[type=file]')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`account-closed-${width}.png`), fullPage: true });
    const trigger = page.getByRole('button', { name: 'アカウント', exact: true });
    await trigger.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('menu').getByText('test@example.com', { exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'ログアウト', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`account-open-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu').getByText('test@example.com', { exact: true })).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click(); await page.locator('main').click({ position: { x: 1, y: 1 } });
    await expect(page.getByRole('menu').getByText('test@example.com', { exact: true })).not.toBeVisible();
    page.cloud.row.data = { ...before, items: [{ id: 'remote', name: '別画面の牛乳', category: 'eggs-dairy', kind: 'use-by', deadline: '2026-12-31', quantity: 1, initialQuantity: 1, consumption: 'drink', unit: 'bottle', place: 'chilled', status: 'active', lowStock: false }] };
    page.cloud.row.revision++;
    await trigger.click(); await page.getByRole('menuitem', { name: '再取得', exact: true }).click();
    await expect(page.getByRole('heading', { name: '別画面の牛乳', exact: true })).toBeVisible();
    await expect(page.getByRole('menu').getByText('test@example.com', { exact: true })).not.toBeVisible();
    expect(page.cloud.writes).toBe(0);
    await trigger.click(); await page.getByRole('menuitem', { name: 'ログアウト', exact: true }).click();
    await expect(page.getByRole('heading', { name: /食品一覧/ })).toBeVisible();
    await trigger.click();
    await expect(page.getByRole('menuitem', { name: 'Googleでログインしてクラウド保存' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '別画面の牛乳', exact: true })).toHaveCount(0);
  });
}

test('初回開始画面でもバックアップUIを表示せず、アカウント操作を畳む', async ({ page }) => {
  page.cloud.row = null;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'クラウドを使い始める', exact: true })).toBeVisible();
  await expect(page.getByRole('menu').getByText('test@example.com', { exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: /バックアップ|退避/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'アカウント', exact: true }).click();
  await page.getByRole('menuitem', { name: 'ログアウト', exact: true }).click();
  await expect(page.getByRole('heading', { name: /食品一覧/ })).toBeVisible();
});
