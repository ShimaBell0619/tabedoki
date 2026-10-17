import { test, expect, cloudData } from './helpers/cloud.mjs';
import { V4_STORAGE_KEY as STORAGE_KEY } from '../../src/data/storage.ts';
import { defaultTemplates } from '../../src/domain/templates.ts';

const item = (id, name, deadline, extra = {}) => ({
  id, name, deadline, category: 'eggs-dairy', kind: 'best-before',
  quantity: 1, unit: 'piece', place: 'chilled', status: 'active',
  lowStock: false, ...extra,
});
async function setup(page) {
  const items = [
    item('overdue', '納豆', '2026-10-16'),
    item('today', 'ヨーグルト', '2026-10-17'),
    item('milk', '牛乳', '2026-10-19'),
    item('egg', 'たまご', '2026-10-24', { quantity: 6 }),
    item('tofu', '豆腐', '2026-10-24', { category: 'soy' }),
    item('next', 'たまご', '2026-11-17', { quantity: 10 }),
    item('far', 'パスタ', '2027-01-15', { category: 'staples', place: 'pantry' }),
  ];
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: STORAGE_KEY, data: { version: 4, items, templates: defaultTemplates(), shopping: [] },
  });
  await page.goto('/');
}

for (const width of [320, 390, 1440]) {
  test(`横型カレンダー・4タブ・食品操作 ${width}px`, async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 850 });
    await page.clock.install({ time: new Date('2026-10-17T12:00:00') });
    await setup(page);
    await expect(page.locator('.food-row')).toHaveCount(6);
    await page.getByRole('button', { name: 'カレンダー', exact: true }).click();
    await expect(page.getByRole('heading', { name: '期限カレンダー' })).toBeVisible();
    await expect(page.locator('.calendar-day')).toHaveCount(31);
    await expect(page.locator('.calendar-overdue-item')).toHaveCount(1);
    await expect(page.locator('.calendar-footer')).toContainText('30日より先の在庫が2件');
    await expect(page.getByRole('button', { name: '10月17日（土）、1件、今日' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.calendar-food')).toHaveCount(1);
    await expect(page.locator('.calendar-food-label')).toHaveCSS('color', 'rgb(150, 90, 18)');

    await page.getByRole('button', { name: '10月24日（土）、2件' }).click();
    await expect(page.locator('.calendar-food')).toHaveCount(2);
    await expect(page.locator('.calendar-food').first()).toContainText('たまご');
    await page.locator('.calendar-food').first().click();
    const dialog = page.getByRole('dialog', { name: '10/24の在庫' });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    if (width <= 760) {
      expect(Math.abs(bounds.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(bounds.x + bounds.width - width)).toBeLessThanOrEqual(2);
      expect(Math.abs(bounds.y + bounds.height - 850)).toBeLessThanOrEqual(2);
    } else {
      expect(Math.abs(bounds.x + bounds.width / 2 - width / 2)).toBeLessThanOrEqual(2);
      expect(Math.abs(bounds.y + bounds.height / 2 - 850 / 2)).toBeLessThanOrEqual(2);
    }
    await expect(dialog.locator('.timeline-dialog-item')).toHaveCount(2);
    await dialog.getByRole('button', { name: 'たまごを1個食べた' }).click();
    await expect(dialog).not.toBeVisible();
    expect((await cloudData(page)).items.find(entry => entry.id === 'egg').status).toBe('active');
    expect((await cloudData(page)).items.find(entry => entry.id === 'egg').quantity).toBe(5);
    await expect(page.locator('.calendar-food')).toHaveCount(2);

    await page.getByRole('button', { name: '90日', exact: true }).click();
    await page.getByRole('button', { name: '1月15日（金）、1件' }).click();
    await expect(page.locator('.calendar-food')).toContainText('パスタ');
    await expect(page.locator('.calendar-food-label')).toHaveCSS('color', width <= 760 ? 'rgb(91, 108, 127)' : 'rgb(115, 127, 143)');

    await page.getByRole('button', { name: '設定', exact: true }).click();
    await expect(page.getByRole('heading', { name: '設定' })).toBeVisible();
    await expect(page.locator('.settings-page').getByRole('button', { name: /定番食品/ })).toBeVisible();
    await page.getByRole('button', { name: '買い物', exact: true }).click();
    await expect(page.getByRole('heading', { name: /買い物リスト/ })).toBeVisible();
    await page.getByRole('button', { name: '一覧', exact: true }).click();
    await expect(page.locator('.food-row')).toHaveCount(6);
    await page.getByRole('button', { name: 'カレンダー', exact: true }).click();
    await page.screenshot({ path: info.outputPath(`calendar-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}
