import { test, expect, cloudData } from './helpers/cloud.mjs';
import { V4_STORAGE_KEY as STORAGE_KEY } from '../../src/data/storage.ts';
import { defaultTemplates } from '../../src/domain/templates.ts';

const stock = (id, name, deadline, quantity, place = 'pantry', extra = {}) => ({
  id, name, deadline, quantity, place, category: 'condiments', kind: 'best-before',
  unit: 'bottle', status: 'active', lowStock: false, ...extra,
});

async function setup(page) {
  const items = [
    stock('old', 'しょうゆ', '2026-10-31', 1, 'chilled'),
    stock('new', ' しょうゆ ', '2027-03-31', 2),
    stock('used', 'しょうゆ', '2026-10-01', 5, 'chilled', { status: 'used' }),
    stock('different', 'しょうゆ', '2027-01-01', 1, 'pantry', { kind: 'use-by' }),
    stock('other', 'みそ', '2027-05-01', 1),
  ];
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: STORAGE_KEY, data: { version: 4, items, templates: defaultTemplates(), shopping: [] },
  });
  await page.goto('/');
}

for (const width of [320, 390, 1440]) {
  test('食品を期限別在庫に集約し、追加・消費・再読み込みを検証する ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date('2026-10-15T12:00:00') });
    await setup(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('食品一覧 3件');
    const row = page.locator('.food-row').filter({ has: page.locator('summary[aria-label*="賞味期限"]') }).filter({ has: page.getByRole('heading', { name: 'しょうゆ', exact: true }) });
    await expect(row.locator('.quantity')).toHaveText('3本');
    await expect(row.locator('summary')).toHaveAttribute('aria-label', /賞味期限 2026-10-31/);
    await row.locator('summary').click();
    await expect(row.locator('.stock-lot')).toHaveCount(2);
    await expect(row.locator('.stock-lot time')).toHaveText(['2026/10/31', '2027/03/31']);
    await expect(row.locator('.stock-lot-info')).toContainText(['冷蔵', '常温']);

    await row.getByRole('button', { name: '在庫を追加' }).click();
    const form = row.getByRole('form', { name: 'しょうゆの在庫を追加' });
    await form.getByLabel('期限の日付').fill('20270331');
    await form.getByLabel('数量', { exact: true }).fill('2');
    await form.getByLabel('保存場所').selectOption('pantry');
    await form.getByRole('button', { name: '追加する' }).click();
    await expect(form).toHaveCount(0);
    await expect(row.locator('.quantity')).toHaveText('5本');
    const merged = await cloudData(page);
    expect(merged.items).toHaveLength(5);
    expect(merged.items.find(item => item.id === 'new').quantity).toBe(4);
    expect(merged.items.find(item => item.id === 'used').status).toBe('used');

    await row.getByRole('button', { name: '在庫を追加' }).click();
    const nextForm = row.getByRole('form', { name: 'しょうゆの在庫を追加' });
    await nextForm.getByLabel('期限の日付').fill('20271231');
    await nextForm.getByLabel('数量', { exact: true }).fill('1');
    await nextForm.getByLabel('保存場所').selectOption('chilled');
    await nextForm.getByRole('button', { name: '追加する' }).click();
    await expect(row.locator('.stock-lot')).toHaveCount(3);
    await expect(row.locator('.quantity')).toHaveText('6本');

    const earliest = row.locator('.stock-lot').first();
    await earliest.getByRole('button', { name: 'しょうゆのその他の操作' }).click();
    await page.getByRole('menuitem', { name: 'しょうゆを1本使い切る' }).click();
    await expect(row.locator('.stock-lot')).toHaveCount(2);
    await expect(row.locator('summary')).toHaveAttribute('aria-label', /賞味期限 2027-03-31/);
    const after = await cloudData(page);
    expect(after.items.find(item => item.id === 'old').status).toBe('used');
    expect(after.items.find(item => item.id === 'new').status).toBe('active');
    expect(after.items.find(item => item.id === 'used').status).toBe('used');

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('食品一覧 3件');
    await expect(page.locator('.food-row').filter({ has: page.locator('summary[aria-label*="賞味期限"]') }).filter({ has: page.getByRole('heading', { name: 'しょうゆ', exact: true }) }).locator('.quantity')).toHaveText('5本');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

for (const width of [320, 390, 1440]) {
  test('B1は食品名・残量・残り日数だけを表示し、下端に在庫ラインを置く ' + width + 'px', async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date('2026-10-15T12:00:00') });
    await setup(page);
    const card = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: 'みそ', exact: true }) });
    await expect(card.locator('.deadline-chip')).toContainText(/^あと\d+日$/);
    const boxes = await card.locator('summary').evaluate(summary => {
      const bounds = selector => {
        const { x, y, width, height } = summary.querySelector(selector).getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        summary: summary.getBoundingClientRect(),
        title: bounds('.food-primary'), status: bounds('.deadline-chip'),
        quantity: bounds('.quantity'), progress: bounds('.stock-preview'),
      };
    });
    expect(boxes.status.x).toBeGreaterThanOrEqual(boxes.title.x + boxes.title.width - 1);
    expect(boxes.quantity.y).toBeGreaterThanOrEqual(boxes.title.y);
    expect(boxes.progress.y + boxes.progress.height).toBeCloseTo(boxes.summary.y + boxes.summary.height, 0);
    expect(boxes.progress.height).toBe(width <= 760 ? 2 : 3);
    expect(boxes.summary.height).toBeLessThanOrEqual(104);
    await expect(card.locator('summary time')).toHaveCount(0);
    await expect(card.locator('summary .deadline-prefix')).toHaveCount(0);
    await expect(card.locator('.deadline-chip')).toHaveCSS('color', width <= 760 ? 'rgb(104, 119, 138)' : 'rgb(115, 127, 143)');
    await expect(card.locator('.deadline-chip')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('card-summary-' + width + '.png'), fullPage: true });
  });
}

test('カテゴリ・単位・期限種別が異なる食品を合算せず、完了から期限単位で戻す', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'すべて', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('食品一覧 3件');
  const row = page.locator('.food-row').filter({ has: page.locator('summary[aria-label*="賞味期限"]') }).filter({ has: page.getByRole('heading', { name: 'しょうゆ', exact: true }) });
  await row.locator('summary').click();
  await expect(row.locator('.stock-lot')).toHaveCount(3);
  await expect(row.locator('.quantity')).toHaveText('管理中 3本・完了 1件');
  await page.getByRole('button', { name: '完了', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('食品一覧 1件');
  const completed = page.locator('.food-row').first();
  const restore = completed.getByRole('button', { name: 'しょうゆを管理中に戻す' });
  if (!await restore.isVisible()) await completed.locator('summary').click();
  await restore.click();
  await page.getByRole('button', { name: '管理中', exact: true }).click();
  const restored = page.locator('.food-row').filter({ has: page.locator('summary[aria-label*="賞味期限"]') }).filter({ has: page.getByRole('heading', { name: 'しょうゆ', exact: true }) });
  await expect(restored.locator('.quantity')).toHaveText('8本');
  await page.getByRole('button', { name: /^絞り込み/ }).click();
  await page.getByLabel('保存場所で絞り込み').selectOption('chilled');
  await expect(restored.locator('.quantity')).toHaveText('6本');
});

for (const width of [320, 390, 1440]) {
  test('独立カードと展開時の階層・操作の視認性 ' + width + 'px', async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    const rows = page.locator('.food-row');
    await expect(rows).toHaveCount(3);
    const firstBox = await rows.first().boundingBox();
    const nextBox = await rows.nth(1).boundingBox();
    expect(nextBox.y - (firstBox.y + firstBox.height)).toBeGreaterThanOrEqual(6);
    const card = rows.filter({ has: page.getByRole('heading', { name: 'みそ', exact: true }) });
    const closedShadow = await card.evaluate(node => getComputedStyle(node).boxShadow);
    expect(closedShadow).not.toBe('none');
    await card.locator('summary').click();
    await expect(card.locator('.stock-lot')).toHaveCount(1);
    const openShadow = await card.evaluate(node => getComputedStyle(node).boxShadow);
    expect(openShadow).not.toBe(closedShadow);
    const backgrounds = await card.evaluate(node => {
      const parent = node.querySelector('.food-expanded');
      const lot = node.querySelector('.stock-lot');
      return [getComputedStyle(parent).backgroundColor, getComputedStyle(lot).backgroundColor];
    });
    expect(backgrounds[0]).not.toBe(backgrounds[1]);
    await expect(card.locator('.food-meta')).toHaveCount(0);
    const finish = card.getByRole('button', { name: 'みそを使い終わった' });
    await expect(finish).toBeVisible();
    const finishBg = await finish.evaluate(node => getComputedStyle(node).backgroundColor);
    const editBg = await card.getByRole('button', { name: 'みそを編集' }).evaluate(node => getComputedStyle(node).backgroundColor);
    expect(finishBg).not.toBe(editBg);
    await expect(card.getByRole('button', { name: '在庫を追加' })).toBeVisible();
    await page.screenshot({ path: info.outputPath('inventory-cards-' + width + '.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
}

for (const width of [320, 390, 1440]) {
  test('ナチュラル配色・情報量・操作行の整列 ' + width + 'px', async ({ page }, info) => {
    await page.setViewportSize({width, height:900});
    await page.clock.install({time:new Date('2026-10-15T12:00:00')});
    await setup(page);
    const bg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    const rootBg = await page.locator('html').evaluate(el => getComputedStyle(el).backgroundColor);
    expect([bg,rootBg]).toContain('rgb(255, 255, 255)');
    const single = page.locator('.food-row').filter({has:page.getByRole('heading', {name:'みそ', exact:true})});
    await expect(single.locator('.quantity')).toHaveText('1本');
    await expect(single.locator('.deadline-prefix')).toHaveCount(0);
    const arrow = await single.locator('summary').evaluate(el => getComputedStyle(el,'::after').content);
    expect(arrow).toBe('""');
    await single.locator('summary').click();
    await expect(single.locator('.stock-heading')).toHaveCount(0);
    await expect(single.locator('.food-meta')).toHaveCount(0);
    await expect(single.locator('.stock-lot')).toHaveCount(1);
    const lot = single.locator('.stock-lot');
    const infoBox = await lot.locator('.stock-lot-info').boundingBox();
    const actions = await lot.locator('.stock-lot-controls').boundingBox();
    if (width <= 390) expect(actions.y).toBeGreaterThanOrEqual(infoBox.y + infoBox.height - 1);
    const edit = await lot.getByRole('button',{name:'みそを編集'}).boundingBox();
    const use = await lot.getByRole('button',{name:'みそを使い終わった'}).boundingBox();
    const more = await lot.getByRole('button',{name:'みそのその他の操作'}).boundingBox();
    expect(use.y).toBeGreaterThanOrEqual(edit.y + edit.height);
    expect(Math.abs(more.y - edit.y)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const multi = page.locator('.food-row').filter({has:page.locator('summary[aria-label*="賞味期限"]')})
      .filter({has:page.getByRole('heading',{name:'しょうゆ',exact:true})});
    await expect(multi.locator('summary .deadline-prefix')).toHaveCount(0);
    await multi.locator('summary').click();
    await expect(multi.locator('.stock-heading')).toHaveText('期限別の在庫');
    await page.screenshot({path:info.outputPath('natural-inventory-'+width+'.png'),fullPage:true});
  });
}

test('数量の増減と最終1個の使い切りを在庫単位で保存する', async ({ page }) => {
  await setup(page);
  const row = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: 'しょうゆ', exact: true }) }).first();
  await row.locator('summary').click();
  const lots = row.locator('.stock-lot');
  const second = lots.filter({ has: page.getByText('2027/03/31', { exact: true }) });
  await second.getByRole('button', { name: 'しょうゆのその他の操作' }).click();
  await page.getByRole('menuitem', { name: 'しょうゆを1本使い切る' }).click();
  expect((await cloudData(page)).items.find(item => item.id === 'new').quantity).toBe(1);
  await second.getByRole('button', { name: 'しょうゆを10%使った' }).click();
  expect((await cloudData(page)).items.find(item => item.id === 'new')).toMatchObject({ quantity: 1, volumePercent: 90 });
  await second.getByRole('button', { name: 'しょうゆの残量を10%増やす' }).click();
  expect((await cloudData(page)).items.find(item => item.id === 'new')).toMatchObject({ quantity: 1, volumePercent: 100 });
  const first = lots.filter({ has: page.getByText('2026/10/31', { exact: true }) });
  await first.getByRole('button', { name: 'しょうゆのその他の操作' }).click();
  await page.getByRole('menuitem', { name: 'しょうゆを1本使い切る' }).click();
  expect((await cloudData(page)).items.find(item => item.id === 'old')).toMatchObject({ quantity: 1, status: 'used' });
  await page.getByRole('button', { name: '完了', exact: true }).click();
  await expect(page.locator('.stock-lot').first()).toHaveCount(1);
});
