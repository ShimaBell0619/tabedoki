import { test, expect } from '@playwright/test';
import { defaultTemplates } from '../../src/food.ts';
import { V3_STORAGE_KEY } from '../../src/storage.ts';

for (const width of [320, 390, 1440]) {
  test(`${width}pxで長い食品名・翌年・期限条件・場所別と展開を確認する`, async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.clock.install({ time: new Date('2026-12-20T12:00:00') });
    await page.setViewportSize({ width, height: 900 });
    const longName = '長い食品名'.repeat(16);
    const dates = ['2026-12-19', '2026-12-20', '2027-01-03', '2027-01-04', '2027-01-19', '2027-01-20'];
    const items = dates.map((deadline, i) => ({ id: String(i), name: i === 5 ? longName : `食品${i}`, category: 'condiments', kind: 'best-before', deadline, quantity: 1, unit: 'bottle', place: i % 2 ? 'pantry' : 'chilled', status: 'active' }));
    await page.addInitScript(({ key, templates, items }) => localStorage.setItem(key, JSON.stringify({ version: 3, templates, items })), { key: V3_STORAGE_KEY, templates: defaultTemplates(), items });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: longName, exact: true })).toBeVisible();
    await expect(page.getByLabel('賞味期限 2027-01-20', { exact: true })).toContainText('2027/1/20');
    expect((await page.locator('.food-details > summary').first().boundingBox()).height).toBeLessThanOrEqual(80);
    const summary = page.getByLabel(longName + 'の詳細');
    await summary.focus();
    await expect(summary).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: longName + 'を編集', exact: true })).toBeVisible();
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    await page.getByRole('button', { name: '0〜14日 2件', exact: true }).click();
    await expect(page.locator('.food-row')).toHaveCount(2);
    await page.getByRole('button', { name: '15〜30日 2件', exact: true }).click();
    await expect(page.locator('.food-row')).toHaveCount(2);
    await page.getByRole('button', { name: '条件をクリア' }).click();
    await page.getByLabel('食品の表示順').selectOption('place');
    await expect(page.getByRole('heading', { name: '冷蔵', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '常温', exact: true })).toBeVisible();
    await page.getByRole('searchbox').fill('食品');
    await expect(page.getByRole('button', { name: 'すべて 6件', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`compact-inventory-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    if (width === 1440) {
      await page.evaluate(() => { document.body.style.zoom = '2'; });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath('inventory-200-percent.png'), fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}
