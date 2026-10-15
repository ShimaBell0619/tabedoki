import { test, expect, cloudData } from './helpers/cloud.mjs';
import { STORAGE_KEY } from '../../src/storage.ts';
import { defaultTemplates } from '../../src/food.ts';

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
    await expect(row.locator('summary time')).toHaveAttribute('datetime', '2026-10-31');
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
    await earliest.getByRole('button', { name: 'しょうゆを使い切り' }).click();
    await expect(row.locator('.stock-lot')).toHaveCount(2);
    await expect(row.locator('summary time')).toHaveAttribute('datetime', '2027-03-31');
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

test('カテゴリ・単位・期限種別が異なる食品を合算せず、完了から期限単位で戻す', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'すべて', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('食品一覧 3件');
  const row = page.locator('.food-row').filter({ has: page.locator('summary[aria-label*="賞味期限"]') }).filter({ has: page.getByRole('heading', { name: 'しょうゆ', exact: true }) });
  await row.locator('summary').click();
  await expect(row.locator('.stock-lot')).toHaveCount(3);
  await expect(row.locator('.quantity')).toHaveText('管理中 3本・完了 5本');
  await page.getByRole('button', { name: '完了', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('食品一覧 1件');
  const completed = page.locator('.food-row').first();
  const restore = completed.getByRole('button', { name: '戻す' });
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
    expect(nextBox.y - (firstBox.y + firstBox.height)).toBeGreaterThanOrEqual(8);
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
    await expect(card.locator('.food-meta')).toHaveText('賞味期限');
    const finish = card.getByRole('button', { name: 'みそを使い切り' });
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
    expect([bg,rootBg]).toContain('rgb(247, 247, 242)');
    const single = page.locator('.food-row').filter({has:page.getByRole('heading', {name:'みそ', exact:true})});
    await expect(single.locator('.quantity')).toHaveText('1本');
    await expect(single.locator('.deadline-prefix')).toHaveCount(0);
    const arrow = await single.locator('summary').evaluate(el => getComputedStyle(el,'::after').content);
    expect(arrow).toBe('""');
    await single.locator('summary').click();
    await expect(single.locator('.stock-heading')).toHaveCount(0);
    await expect(single.locator('.food-meta')).toHaveText('賞味期限');
    await expect(single.locator('.stock-lot')).toHaveCount(1);
    const lot = single.locator('.stock-lot');
    const info = await lot.locator('.stock-lot-info').boundingBox();
    const actions = await lot.locator('.stock-lot-controls').boundingBox();
    if (width <= 390) expect(actions.y).toBeGreaterThanOrEqual(info.y + info.height - 1);
    const edit = await lot.getByRole('button',{name:'みそを編集'}).boundingBox();
    const use = await lot.getByRole('button',{name:'みそを使い切り'}).boundingBox();
    const more = await lot.getByRole('button',{name:'みそのその他の操作'}).boundingBox();
    expect(Math.abs(edit.y - use.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(more.y - use.y)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const multi = page.locator('.food-row').filter({has:page.locator('summary[aria-label*="賞味期限"]')})
      .filter({has:page.getByRole('heading',{name:'しょうゆ',exact:true})});
    await expect(multi.locator('.deadline-prefix')).toHaveText('最短期限');
    await multi.locator('summary').click();
    await expect(multi.locator('.stock-heading')).toHaveText('期限別の在庫');
    await page.screenshot({path:info.outputPath('natural-inventory-'+width+'.png'),fullPage:true});
  });
}
