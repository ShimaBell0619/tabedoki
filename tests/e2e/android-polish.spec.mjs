import { test, expect, cloudData, userId } from './helpers/cloud.mjs';
import { defaultTemplates } from '../../src/domain/templates.ts';
import { shoppingFrom } from '../../src/domain/shopping.ts';

test.use({ isMobile: true, hasTouch: true });

const name = 'だし入り減塩タイプの合わせみそ';
const food = (id, label, extra = {}) => ({
  id, name: label, category: 'condiments', kind: 'best-before', deadline: '2026-10-31',
  quantity: 3, initialQuantity: 3, consumption: 'use', unit: 'pack', place: 'pantry',
  trackingMode: 'count', status: 'active', lowStock: false, ...extra,
});

async function setup(page) {
  page.cloud.row = { user_id: userId, revision: 1, write_id: 'existing', previous: null, data: {
    version: 5, templates: defaultTemplates(), shopping: [
      { ...shoppingFrom('牛乳', 'bought'), bought: true }, shoppingFrom('牛乳', 'pending'),
    ], items: [
      food('egg', 'たまご', { category: 'eggs-dairy', deadline: '2026-10-18', quantity: 6, initialQuantity: 10, unit: 'piece', consumption: 'eat', place: 'chilled' }),
      food('milk', '牛乳', { category: 'eggs-dairy', quantity: 2, unit: 'bottle', consumption: 'drink', place: 'chilled', trackingMode: 'volume', volumePercent: 50 }),
      food('first', name), food('next', name, { deadline: '2027-01-31', quantity: 2 }),
    ],
  } };
  await page.goto('/');
  await cloudData(page);
}

for (const width of [320, 390, 430]) {
  test(`${width}pxで在庫操作が重ならず、最後の操作もガラスナビの上に収まる`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.install({ time: new Date('2026-10-17T12:00:00') });
    await setup(page);
    const single = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: 'たまご', exact: true }) });
    await expect(single.locator('.stock-preview')).toBeVisible();
    const contrast = await single.evaluate(card => {
      const luminance = color => {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => {
          const value = channel / 255;
          return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
        });
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const foreground = luminance(getComputedStyle(card.querySelector('.quantity')).color);
      const background = luminance(getComputedStyle(card).backgroundColor);
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: info.outputPath(`android-list-${width}.png`) });

    await single.locator('summary').click();
    await expect(single.locator('.stock-preview')).toBeVisible();
    await expect(single.locator('.stock-progress')).toBeVisible();
    await page.screenshot({ path: info.outputPath(`android-single-${width}.png`) });

    const multi = page.locator('.food-row').filter({ has: page.getByRole('heading', { name, exact: true }) });
    await multi.locator('summary').click();
    await expect(multi.locator('.stock-lot')).toHaveCount(2);
    for (const lot of await multi.locator('.stock-lot').all()) {
      const boxes = await lot.evaluate(node => {
        const bounds = element => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        };
        return { lot: bounds(node), info: bounds(node.querySelector('.stock-lot-info')),
          balance: bounds(node.querySelector('.stock-lot-balance')),
          controls: bounds(node.querySelector('.stock-lot-controls')),
          buttons: [...node.querySelectorAll('.stock-lot-controls button, .food-actions button')].map(bounds) };
      });
      expect(boxes.balance.y).toBeGreaterThanOrEqual(boxes.info.y + boxes.info.height - 1);
      expect(boxes.controls.y).toBeGreaterThanOrEqual(boxes.balance.y + boxes.balance.height - 1);
      for (const button of boxes.buttons) {
        expect(button.x).toBeGreaterThanOrEqual(boxes.lot.x);
        expect(button.x + button.width).toBeLessThanOrEqual(boxes.lot.x + boxes.lot.width + 1);
        expect(button.height).toBeGreaterThanOrEqual(44);
      }
    }
    await multi.locator('.stock-lot').first().getByRole('button', { name: `${name}を1パック使い終わった` }).click();
    expect((await cloudData(page)).items.find(item => item.id === 'first').quantity).toBe(2);
    await expect(page.locator('.notice-toast')).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const actions = await multi.locator('.stock-group-actions').boundingBox();
    const add = await page.locator('.mobile-add-button').boundingBox();
    expect(actions.y + actions.height).toBeLessThanOrEqual(add.y - 8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(`android-last-actions-${width}.png`) });
  });

  test(`${width}pxで必須ラベルを1行に保ち、低い表示領域でもフォームを保存できる`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    await page.getByRole('button', { name: '食品を登録', exact: true }).click();
    const dialog = page.getByRole('dialog');
    for (const label of await dialog.locator('.field-label').all()) {
      const box = await label.boundingBox();
      const required = await label.locator('.required').boundingBox();
      expect(box.height).toBeLessThanOrEqual(24);
      expect(required.y).toBeGreaterThanOrEqual(box.y - 1);
      expect(required.y + required.height).toBeLessThanOrEqual(box.y + box.height + 1);
    }
    await dialog.getByRole('button', { name: '定番のたまご', exact: true }).click();
    await dialog.getByLabel(/期限の日付/).fill('20261030');
    await page.screenshot({ path: info.outputPath(`android-form-${width}.png`) });
    await page.setViewportSize({ width, height: 520 });
    const category = dialog.getByLabel('食品カテゴリ');
    await category.scrollIntoViewIfNeeded();
    await category.focus();
    const inputBox = await category.boundingBox();
    const save = dialog.getByRole('button', { name: '登録する', exact: true });
    const saveBox = await save.boundingBox();
    expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(saveBox.y + 1);
    await expect(save).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`android-form-short-${width}.png`) });
    await save.click();
    await expect(dialog).toHaveCount(0);
    const saved = await cloudData(page);
    expect(saved.items).toHaveLength(5);
    expect(saved.items.some(item => item.name === 'たまご' && item.deadline === '2026-10-30')).toBe(true);
  });
}

test('数量変更でちらつきと不要な通知がなく、その他の通知とエラーは維持する', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date('2026-10-17T12:00:00') });
  await setup(page);
  const single = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: 'たまご', exact: true }) });
  await single.locator('summary').click();
  const before = await page.getByRole('heading', { level: 1 }).boundingBox();
  let finishSave;
  page.cloud.wait = new Promise(resolve => { finishSave = resolve; });
  const increase = single.getByRole('button', { name: 'たまごの数量を1増やす' });
  const opacity = await increase.evaluate(button => getComputedStyle(button).opacity);
  await increase.click();
  await expect(increase).toBeDisabled();
  expect(await increase.evaluate(button => getComputedStyle(button).opacity)).toBe(opacity);
  await expect(page.getByLabel('保存状態')).toHaveCount(0);
  await page.clock.runFor(450);
  await expect(page.getByLabel('保存状態')).toBeVisible();
  const pending = await page.getByRole('heading', { level: 1 }).boundingBox();
  expect(pending.y).toBe(before.y);
  finishSave();
  page.cloud.wait = null;
  await cloudData(page);
  const toast = page.locator('.notice-toast');
  await expect(toast).toHaveCount(0);
  await expect(single.locator('.quantity')).toHaveText('7個');
  const after = await page.getByRole('heading', { level: 1 }).boundingBox();
  expect(after.y).toBe(before.y);
  await single.getByRole('checkbox', { name: 'たまごの残りわずか' }).check();
  await cloudData(page);
  await expect(toast).toContainText('残りわずかを設定しました');
  const toastBox = await toast.boundingBox();
  const addBox = await page.locator('.mobile-add-button').boundingBox();
  const navBox = await page.locator('.mobile-navigation').boundingBox();
  expect(toastBox.x + toastBox.width).toBeLessThanOrEqual(addBox.x - 8);
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(navBox.y - 8);
  await page.screenshot({ path: info.outputPath('android-success-notice-390.png') });
  await page.clock.runFor(4000);
  await toast.getByRole('button', { name: '通知を閉じる' }).focus();
  await page.clock.runFor(12000);
  await expect(toast).toBeVisible();
  await page.getByRole('link', { name: 'たべどき ホーム' }).focus();
  await page.clock.runFor(10100);
  await expect(toast).toHaveCount(0);

  await page.getByRole('button', { name: '設定', exact: true }).click();
  const refresh = page.getByRole('button', { name: '再取得', exact: true });
  await refresh.click();
  await cloudData(page);
  await page.clock.runFor(8000);
  await refresh.click();
  await cloudData(page);
  await page.clock.runFor(3000);
  await expect(toast).toBeVisible();
  await page.clock.runFor(8000);
  await expect(toast).toHaveCount(0);

  await page.getByRole('button', { name: '買い物', exact: true }).click();
  const bought = page.getByLabel('購入済み', { exact: true }).getByRole('checkbox');
  await bought.click();
  const error = page.locator('.notice-error');
  await expect(error).toContainText('同名');
  await expect(bought).toBeChecked();
  await page.clock.runFor(20000);
  await expect(error).toBeVisible();
  await expect(error.getByRole('button', { name: '通知を閉じる' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('android-persistent-error-390.png') });
});
