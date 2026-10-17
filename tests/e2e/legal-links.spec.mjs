import { test as localTest, expect } from '@playwright/test';
import { test as cloudTest, cloudData } from './helpers/cloud.mjs';

for (const width of [320, 390, 1440]) {
  localTest(`${width}pxのローカル利用時にメニューから規約・プライバシーを参照できる`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /食品一覧/ })).toBeVisible();
    const account = page.getByRole('button', { name: 'アカウント' });
    await account.click();
    const terms = page.getByRole('menuitem', { name: '利用条件' });
    const privacy = page.getByRole('menuitem', { name: 'プライバシーポリシー' });
    await expect(terms).toHaveAttribute('href', '/terms.html');
    await expect(privacy).toHaveAttribute('href', '/privacy.html');
    await page.screenshot({ path: info.outputPath(`legal-links-local-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await privacy.focus();
    await expect(privacy).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/privacy\.html$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('プライバシーポリシー');
    await page.goBack();
    await expect(page.getByRole('heading', { name: /食品一覧/ })).toBeVisible();
    await account.click();
    await page.getByRole('menuitem', { name: '利用条件' }).click();
    await expect(page).toHaveURL(/\/terms\.html$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('利用条件');
  });

  cloudTest(`${width}pxのログイン後にメニューから規約・プライバシーを参照できる`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await cloudData(page);
    const account = page.getByRole('button', { name: 'アカウント' });
    await account.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu').getByText('test@example.com', { exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: '利用条件' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'プライバシーポリシー' })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`legal-links-cloud-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('menuitem', { name: '利用条件' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('利用条件');
    await page.goBack();
    await cloudData(page);
    await account.click();
    await page.getByRole('menuitem', { name: 'プライバシーポリシー' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('プライバシーポリシー');
    expect(page.cloud.writes).toBe(0);
  });
}

cloudTest('初回クラウド移行画面でも両ページを参照できる', async ({ page }) => {
  page.cloud.row = null;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'クラウドを使い始める' })).toBeVisible();
  await page.getByRole('button', { name: 'アカウント' }).click();
  await expect(page.getByRole('menuitem', { name: '利用条件' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'プライバシーポリシー' })).toBeVisible();
  expect(page.cloud.writes).toBe(0);
});
