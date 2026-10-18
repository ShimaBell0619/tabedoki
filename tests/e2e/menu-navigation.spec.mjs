import { test, expect } from './helpers/cloud.mjs';

for (const width of [320, 390, 430, 1440]) {
  test(`設定画面を廃止し、3タブと右上のメニューへ統合する ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const nav = page.locator(width <= 760 ? '.mobile-navigation' : '.desktop-navigation');
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('button')).toHaveCount(3);
    await expect(nav.getByRole('button', { name: '一覧' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('button', { name: 'カレンダー' })).toBeVisible();
    await expect(nav.getByRole('button', { name: '買い物' })).toBeVisible();
    await expect(page.getByRole('button', { name: '設定', exact: true })).toHaveCount(0);
    await expect(page.locator('.settings-page')).toHaveCount(0);

    const trigger = page.getByRole('button', { name: 'アカウント', exact: true });
    await trigger.click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: '定番食品の管理' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: '再取得', exact: true })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: '利用条件' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'プライバシーポリシー' })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`settings-menu-${width}.png`) });
    await menu.getByRole('menuitem', { name: '定番食品の管理' }).click();
    const dialog = page.getByRole('dialog', { name: '定番食品を管理' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '閉じる' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
