import { test, expect, cloudData } from './helpers/cloud.mjs';

// Emulate Android Chrome's mobile viewport and touch input.
test.use({ isMobile: true, hasTouch: true });

for (const width of [320, 390, 1440]) {
  test(`Liquid Glassナビゲーションが${width}pxでも操作可能`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await cloudData(page);

    const mobile = page.locator('.mobile-navigation');
    const desktop = page.locator('.desktop-navigation');

    if (width > 760) {
      await expect(mobile).toBeHidden();
      await expect(desktop).toBeVisible();
      await expect(desktop.getByRole('button', { name: 'カレンダー' })).toBeVisible();
      await page.screenshot({ path: info.outputPath('glass-desktop-1440.png') });
      return;
    }

    await expect(desktop).toBeHidden();
    await expect(mobile).toBeVisible();
    await expect(mobile).toHaveCSS('position', 'fixed');
    await expect(mobile).toHaveCSS('border-radius', '23px');
    await expect(mobile).toHaveCSS('backdrop-filter', /blur/);
    await expect(mobile.getByRole('button')).toHaveCount(4);
    await expect(mobile.getByRole('button', { name: '一覧' })).toHaveAttribute('aria-current', 'page');
    await expect(mobile).toHaveCSS('--active-tab-index', '0');

    const addButton = page.locator('.mobile-add-button');
    await expect(addButton).toBeVisible();
    const navBox = await mobile.boundingBox();
    const addBox = await addButton.boundingBox();
    expect(navBox).toBeTruthy();
    expect(addBox).toBeTruthy();
    expect(navBox.x).toBeGreaterThanOrEqual(0);
    expect(navBox.x + navBox.width).toBeLessThanOrEqual(width);
    expect(navBox.y - (addBox.y + addBox.height)).toBeGreaterThanOrEqual(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

    await page.screenshot({ path: info.outputPath(`glass-mobile-${width}.png`) });
    const calendar = mobile.getByRole('button', { name: 'カレンダー' });
    await calendar.focus();
    await expect(calendar).toHaveCSS('outline-width', '3px');
    await page.keyboard.press('Enter');
    await expect(calendar).toHaveAttribute('aria-current', 'page');
    await expect(mobile).toHaveCSS('--active-tab-index', '1');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('カレンダー');
    await expect(addButton).toBeVisible();

    await mobile.getByRole('button', { name: '買い物' }).click();
    await expect(mobile).toHaveCSS('--active-tab-index', '2');
    await expect(addButton).toHaveCount(0);
    await mobile.getByRole('button', { name: '設定' }).click();
    await expect(mobile).toHaveCSS('--active-tab-index', '3');
    await expect(addButton).toHaveCount(0);

    await mobile.getByRole('button', { name: '一覧' }).click();
    await expect(mobile).toHaveCSS('--active-tab-index', '0');
    await addButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(page.cloud.writes).toBe(0);
  });
}
