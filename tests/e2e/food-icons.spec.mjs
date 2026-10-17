import { test, expect, cloudData } from './helpers/cloud.mjs';
import { STORAGE_KEY } from '../../src/data/storage.ts';
import { defaultTemplates } from '../../src/domain/templates.ts';

function food(id, name, deadline, extra = {}) {
  return { id, name, deadline, category: 'condiments', kind: 'best-before',
    quantity: 1, unit: 'bottle', place: 'chilled', status: 'active', lowStock: false, ...extra };
}
async function setup(page) {
  await page.clock.install({ time: new Date('2026-10-17T12:00:00') });
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: STORAGE_KEY, data: { version: 4,
      items: [food('a', 'しょうゆ', '2026-10-19'), food('b', ' しょうゆ ', '2026-10-24', { kind: 'use-by' }),
        food('c', 'みそ', '2026-10-19')],
      shopping: [], templates: defaultTemplates() },
  });
  await page.goto('/');
}

for (const width of [320, 390, 1440]) {
  test(`食品アイコン選択、全期限共有、クラウド永続化、復元 ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 });
    await setup(page);
    const cards = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: 'しょうゆ', exact: true }) });
    await expect(cards).toHaveCount(2);
    const iconButton = cards.first().getByRole('button', { name: /しょうゆのアイコンを変更/ });
    await iconButton.click();
    await expect(cards.first().locator('details')).not.toHaveAttribute('open');
    const dialog = page.getByRole('dialog', { name: 'しょうゆのアイコン' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: '自動' })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('button', { name: 'ピザ' }).click();
    await expect(dialog).not.toBeVisible();
    const after = await cloudData(page);
    expect(after.icons).toEqual({ 'しょうゆ': 'pizza' });
    expect(page.cloud.writes).toBe(1);
    await expect(cards.first().locator('.food-icon .icon')).toHaveCSS('mask-image', /pizza\.svg/);
    await expect(cards.nth(1).locator('.food-icon .icon')).toHaveCSS('mask-image', /pizza\.svg/);

    await page.getByRole('button', { name: 'カレンダー', exact: true }).click();
    await page.getByRole('button', { name: '10月19日（月）、2件' }).click();
    const iconOnCalendar = page.getByRole('button', { name: 'しょうゆのアイコンを変更' });
    await expect(iconOnCalendar.locator('.icon')).toHaveCSS('mask-image', /pizza\.svg/);
    await iconOnCalendar.click();
    await expect(page.getByRole('dialog', { name: 'しょうゆのアイコン' })
      .getByRole('button', { name: 'ピザ' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'しょうゆのアイコン' })).not.toBeVisible();
    await page.screenshot({ path: info.outputPath('food-icons-' + width + '.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

    await page.reload();
    await page.getByRole('button', { name: '一覧', exact: true }).click();
    const restored = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: 'しょうゆ', exact: true }) });
    await expect(restored.first().locator('.food-icon .icon')).toHaveCSS('mask-image', /pizza\.svg/);
    await restored.first().getByRole('button', { name: /しょうゆのアイコンを変更/ }).click();
    await page.getByRole('dialog', { name: 'しょうゆのアイコン' }).getByRole('button', { name: '自動' }).click();
    await expect(restored.first().locator('.food-icon .icon')).toHaveCSS('mask-image', /droplets\.svg/);
    expect((await cloudData(page)).icons).toEqual({});
  });
}
