import { cloudData } from './helpers/cloud.mjs';
import { openCandidates, openFoodActions } from './helpers/inventory.mjs';
import { test, expect } from './helpers/cloud.mjs';
import { defaultTemplates } from '../../src/domain/templates.ts';
import { V3_STORAGE_KEY } from '../../src/data/storage.ts';

async function seed(page) {
  await page.clock.install({ time: new Date('2026-10-11T12:00:00') });
  await page.addInitScript(({ key, templates }) => {
    localStorage.setItem(key, JSON.stringify({ version: 3, templates, items: [
      { id: '1', name: 'ヨーグルト', category: 'eggs-dairy', deadline: '2026-10-10', kind: 'best-before', quantity: 2, unit: 'piece', place: 'chilled', status: 'active' },
      { id: '2', name: '牛乳', category: 'eggs-dairy', deadline: '2026-10-11', kind: 'use-by', quantity: 1, unit: 'bottle', place: 'chilled', status: 'active' },
      { id: '3', name: '納豆', category: 'soy', deadline: '2026-10-13', kind: 'best-before', quantity: 3, unit: 'pack', place: 'chilled', status: 'active' },
      { id: '4', name: '食パン', category: 'staples', deadline: '2026-10-17', kind: 'best-before', quantity: 1, unit: 'bag', place: 'pantry', status: 'active' },
    ] }));
  }, { key: V3_STORAGE_KEY, templates: defaultTemplates() });
  await page.goto('/');
}

for (const width of [320, 390, 1440]) {
  test(`${width}pxで新しい一覧と絞り込み・操作メニューを確認する`, async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await seed(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('食品一覧 4件');
    await expect(page.getByRole('link', { name: 'たべどき ホーム' }).locator('img')).toHaveAttribute('src', '/icons/cooking-pot.svg');
    await expect(page.getByText(/MY KITCHEN|YOUR PANTRY|あと少し|見逃さない/)).toHaveCount(0);
    await expect(page.getByLabel('保存場所で絞り込み')).not.toBeVisible();
    await page.screenshot({ path: info.outputPath(`ui-inventory-${width}.png`), fullPage: true });
    const filter = page.getByRole('button', { name: /^絞り込み/ });
    await filter.focus(); await page.keyboard.press('Enter');
    await expect(filter).toHaveAttribute('aria-expanded', 'true');
    await page.getByLabel('カテゴリで絞り込み').selectOption('soy');
    await page.getByLabel('保存場所で絞り込み').selectOption('chilled');
    await filter.click();
    await expect(page.getByLabel('適用中の絞り込み')).toContainText('大豆製品');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('食品一覧 1件');
    await page.getByRole('button', { name: '条件をクリア' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('食品一覧 4件');
    const summary = page.getByRole('button', { name: '期限切れ 1件', exact: true });
    await summary.click();
    await expect(summary).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('食品一覧 1件');
    await summary.click();
    await expect(summary).toHaveAttribute('aria-pressed', 'false');
    await openFoodActions(page);
    const menu = page.getByRole('button', { name: '牛乳のその他の操作' });
    await menu.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: '牛乳を削除' })).toBeVisible();
    await expect(page.getByRole('button', { name: '牛乳を廃棄' })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`ui-menu-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '牛乳を削除' })).not.toBeVisible();
    await expect(menu).toBeFocused();
    await menu.click();
    await page.getByRole('button', { name: '牛乳を廃棄' }).click();
    await expect(page.getByRole('heading', { name: '牛乳', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '完了', exact: true }).click();
    await expect(page.locator('.deadline-chip').getByText('廃棄済み', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '管理中', exact: true }).click();
    await page.getByRole('button', { name: '食品を登録', exact: true }).last().click();
    const dialog = page.getByRole('dialog');
    await openCandidates(dialog);
    await dialog.getByRole('button', { name: '定番の納豆', exact: true }).click();
    await expect(dialog.getByRole('button', { name: '定番・以前の登録から入力' })).toHaveAttribute('aria-expanded', 'false');
    await expect(dialog.getByLabel(/期限の日付/)).toHaveValue('');
    await page.screenshot({ path: info.outputPath(`ui-register-${width}.png`) });
    await dialog.getByLabel('食品カテゴリ').scrollIntoViewIfNeeded();
    const categoryBox = await dialog.getByLabel('食品カテゴリ').boundingBox();
    const actionsBox = await dialog.locator('.dialog-actions').boundingBox();
    expect(categoryBox.y + categoryBox.height).toBeLessThanOrEqual(actionsBox.y);
    await page.screenshot({ path: info.outputPath(`ui-register-bottom-${width}.png`) });
    expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}
