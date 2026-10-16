import { test, expect, cloudData } from './helpers/cloud.mjs';
import { STORAGE_KEY } from '../../src/data/storage.ts';
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
  test('期限の実寸タイムラインと期限別操作 ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.clock.install({ time: new Date('2026-10-17T12:00:00') });
    await setup(page);
    await expect(page.locator('.food-row')).toHaveCount(6);
    await page.getByRole('button', { name: 'タイムライン', exact: true }).click();
    await expect(page.locator('.timeline-hit')).toHaveCount(3);
    await expect(page.locator('.timeline-overdue-row')).toHaveCount(1);
    await expect(page.locator('.timeline-later')).toContainText('30日より先の在庫が2件');

    const milk = page.locator('.timeline-hit').filter({ hasText: '牛乳' });
    const eggs = page.locator('.timeline-hit').filter({ hasText: 'たまご' });
    await expect(eggs).toContainText('2件');
    const delta = await milk.evaluate((element, target) => {
      const next = document.querySelectorAll('.timeline-hit')[2];
      return next.getBoundingClientRect().top - element.getBoundingClientRect().top;
    });
    expect(delta).toBe(5 * 48);

    await eggs.click();
    const dialog = page.getByRole('dialog', { name: '10/24の在庫' });
    await expect(dialog).toBeVisible();
    // Native dialog positioning must not fall back to the top-left (Tailwind reset).
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
    await dialog.getByRole('button', { name: 'たまごを使い切り' }).click();
    await expect(dialog).not.toBeVisible();
    const stored = await cloudData(page);
    expect(stored.items.find(entry => entry.id === 'egg').status).toBe('used');
    await expect(page.locator('.timeline-hit').filter({ hasText: '豆腐' })).toHaveCount(1);

    await page.getByRole('button', { name: '90日', exact: true }).click();
    await expect(page.locator('.timeline-hit').filter({ hasText: 'パスタ' })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: '一覧', exact: true }).click();
    await expect(page.locator('.food-row')).toHaveCount(6);
  });
}
