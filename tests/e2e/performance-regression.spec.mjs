import { test, expect } from '@playwright/test';
import { fixture, storageKey } from '../../scripts/performance/fixture.mjs';

test.use({ isMobile: true, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });

async function seed(page, count) {
  await page.clock.setFixedTime(new Date('2026-11-15T12:00:00+09:00'));
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: storageKey, data: fixture(count) });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: `食品一覧 ${count}件`, exact: true })).toBeVisible();
}

for (const width of [320, 390, 412]) for (const theme of ['light', 'dark']) {
  test(`${width}px ${theme}: 遅延生成・画面復帰・数量と入力状態を保持`, async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await seed(page, 20);
    const nav = page.locator('.mobile-navigation');
    const card = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: '食品000', exact: true }) });
    // Closed details keep searchable lot text but create no action controls; keyboard activation still uses the native disclosure.
    await expect(page.locator('.stock-lot-controls')).toHaveCount(0);
    await expect(card.locator('time')).toHaveText('2026/11/15');
    await card.locator('summary').focus();
    await expect(card.locator('summary')).toHaveCSS('outline-width', '3px');
    await page.keyboard.press('Enter');
    await expect(card.locator('.food-expanded')).toBeVisible();
    await card.getByRole('button', { name: '食品000の数量を1増やす' }).click();
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).items[0].quantity, storageKey)).toBe(4);
    await card.getByRole('button', { name: '在庫を追加', exact: true }).click();
    const form = card.getByRole('form', { name: '食品000の在庫を追加' });
    await form.getByLabel('数量', { exact: true }).fill('8');
    await card.locator('summary').click();
    await card.locator('summary').click();
    await expect(form.getByLabel('数量', { exact: true })).toHaveValue('8');
    await page.screenshot({ path: info.outputPath(`inventory-${width}-${theme}.png`) });

    await nav.getByRole('button', { name: 'カレンダー' }).click();
    await expect(page.getByRole('heading', { name: '期限カレンダー', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '食品000、4個、冷蔵、詳細を開く' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /食品一覧/ })).toHaveCount(0);
    await page.getByRole('button', { name: '90日', exact: true }).click();
    await page.locator('.calendar-rail').evaluate(el => { el.scrollLeft = 500; });
    const railPosition = await page.locator('.calendar-rail').evaluate(el => el.scrollLeft);
    await page.screenshot({ path: info.outputPath(`calendar-${width}-${theme}.png`) });
    await nav.getByRole('button', { name: '買い物' }).click();
    await page.getByRole('textbox', { name: '買うものの名前' }).fill('買い物の下書き');
    await page.screenshot({ path: info.outputPath(`shopping-${width}-${theme}.png`) });
    await nav.getByRole('button', { name: '一覧' }).click();
    await expect(card.locator('details')).toHaveAttribute('open', '');
    await expect(form.getByLabel('数量', { exact: true })).toHaveValue('8');
    await nav.getByRole('button', { name: 'カレンダー' }).click();
    await expect(page.getByRole('button', { name: '90日', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.locator('.calendar-rail').evaluate(el => el.scrollLeft)).toBe(railPosition);
    // Modal focus returns to the invoking food when dismissed with Escape.
    const detail = page.getByRole('button', { name: '食品000、4個、冷蔵、詳細を開く' });
    await detail.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(detail).toBeFocused();
    await nav.getByRole('button', { name: '買い物' }).click();
    await expect(page.getByRole('textbox', { name: '買うものの名前' })).toHaveValue('買い物の下書き');
    for (const screen of ['一覧', 'カレンダー', '買い物']) {
      await nav.getByRole('button', { name: screen, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });
}

test('300件の末尾でもキーボードで展開し、絞り込みを画面間で保持する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, 300);
  const rows = page.locator('.food-row');
  await expect(rows).toHaveCount(300);
  await rows.nth(298).locator('summary').focus();
  await page.keyboard.press('Tab'); // food icon
  await page.keyboard.press('Tab'); // next disclosure, beyond the initial viewport
  await expect(rows.last().locator('summary')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(rows.last().locator('.food-expanded')).toBeVisible();
  await page.getByRole('button', { name: '絞り込み', exact: true }).click();
  await page.getByLabel('カテゴリで絞り込み').selectOption('soy');
  await expect(page.getByRole('heading', { name: '該当する食品がありません' })).toBeVisible();
  const nav = page.locator('.mobile-navigation');
  await nav.getByRole('button', { name: '買い物' }).click();
  await nav.getByRole('button', { name: '一覧' }).click();
  await expect(page.getByLabel('カテゴリで絞り込み')).toHaveValue('soy');
  await page.getByRole('button', { name: '条件をクリア' }).click();
  await expect(rows).toHaveCount(300);
});
