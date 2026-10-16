import { test, expect, cloudData, userId } from './helpers/cloud.mjs';
import { defaultTemplates } from '../../src/domain/templates.ts';

for (const width of [320, 390, 1440]) {
  test(`${width}pxで共通部品の矢印操作・フォーカス・dialog内のTab移動を確認する`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    page.cloud.row = {
      user_id: userId, revision: 1, write_id: 'keyboard-test', previous: null,
      data: { version: 4, templates: defaultTemplates(), shopping: [], items: [{
        id: 'keyboard', name: 'キーボード確認用の牛乳', category: 'eggs-dairy', kind: 'use-by',
        deadline: '2027-12-31', quantity: 1, unit: 'bottle', place: 'chilled', status: 'active', lowStock: false,
      }] },
    };
    await page.goto('/');
    await cloudData(page);
    const account = page.getByRole('button', { name: 'アカウント', exact: true });
    await account.focus();
    await page.keyboard.press('ArrowDown');
    const refresh = page.getByRole('menuitem', { name: '再取得', exact: true });
    await expect(refresh).toBeFocused();
    await expect(refresh).toHaveCSS('outline-width', '3px');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'ログアウト' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(refresh).toBeFocused();
    await page.screenshot({ path: info.outputPath(`keyboard-menu-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(account).toBeFocused();
    await expect(page.getByRole('menu')).toHaveCount(0);

    const details = page.locator('.food-details > summary');
    await details.focus();
    await page.keyboard.press('Enter');
    const actions = page.getByRole('button', { name: 'キーボード確認用の牛乳のその他の操作' });
    await actions.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'キーボード確認用の牛乳を廃棄' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('menuitem', { name: 'キーボード確認用の牛乳を削除' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(actions).toBeFocused();

    const create = page.getByRole('button', { name: '食品を登録', exact: true }).last();
    await create.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('食品名')).toBeFocused();
    await expect(dialog.getByLabel('食品名')).toHaveCSS('outline-width', '3px');
    await dialog.getByLabel('食品カテゴリ').focus();
    await expect(dialog.getByLabel('食品カテゴリ')).toHaveCSS('outline-color', 'rgb(183, 117, 59)');
    const name = dialog.getByLabel('食品名');
    await name.focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByLabel('期限の日付')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(name).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: '閉じる', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(name).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(create).toBeFocused();
    expect(page.cloud.writes).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
