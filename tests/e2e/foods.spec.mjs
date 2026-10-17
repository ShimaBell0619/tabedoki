import { cloudData } from './helpers/cloud.mjs';
import { openCandidates, openFoodActions } from './helpers/inventory.mjs';
import { test, expect } from './helpers/cloud.mjs';
import { writeFileSync } from 'node:fs';

let errors = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  });
test.afterEach(() => expect(errors, 'ブラウザエラーがない').toEqual([]));

async function register(page, name, date, kind = '賞味期限', place = '冷蔵') {
  await page.getByRole('button', { name: '食品を登録', exact: true }).last().click();
  const dialog = page.getByRole('dialog', { name: '食品を登録' });
  await dialog.getByRole('textbox', { name: /食品名/ }).fill(name);
  await dialog.getByLabel('期限の種類').selectOption({ label: kind });
  await dialog.getByLabel('期限の日付').fill(date);
  await dialog.getByLabel('保存場所').selectOption({ label: place });
  await dialog.getByRole('button', { name: '登録する' }).click();
  await expect(dialog).not.toBeVisible();
}

for (const width of [320, 390, 1440]) {
  test(`${width}pxでCRUD、絞り込み、永続化と画面表示`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date('2026-10-11T12:00:00') });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /食品一覧/ })).toBeVisible();
    await register(page, '牛乳', '2026-10-11', '消費期限', '冷蔵');
    await register(page, '食パン', '2026-10-13', '賞味期限', '常温');
    await expect(page.locator('.deadline-chip').getByText('今日まで', { exact: true })).toBeVisible();
    await expect(page.getByText('あと2日')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: '牛乳' })).toBeVisible();
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await openFilters(page);
    await page.getByLabel('保存場所で絞り込み').selectOption('chilled');
    await expect(page.getByRole('heading', { name: '食パン' })).toHaveCount(0);
    await openFilters(page);
    await page.getByLabel('保存場所で絞り込み').selectOption('all');
    await openFoodActions(page);
    await page.getByRole('button', { name: '牛乳を編集' }).click();
    await page.getByRole('dialog').getByRole('textbox', { name: /食品名/ }).fill('低脂肪牛乳');
    await page.getByRole('button', { name: '変更を保存' }).click();
    await expect(page.getByRole('heading', { name: '低脂肪牛乳' })).toBeVisible();
    await openFoodActions(page);
    await page.getByRole('button', { name: '低脂肪牛乳を飲み終わった' }).click();
    await expect(page.getByRole('heading', { name: '低脂肪牛乳' })).toHaveCount(0);
    await page.getByRole('button', { name: '完了' }).click();
    await expect(page.getByRole('heading', { name: '低脂肪牛乳' })).toBeVisible();
    await openFoodActions(page);
    await page.getByRole('button', { name: '戻す' }).click();
    await page.getByRole('button', { name: '管理中', exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await openFoodActions(page);
    await page.getByRole('button', { name: '低脂肪牛乳のその他の操作' }).click();
    await page.getByRole('menuitem', { name: '低脂肪牛乳を削除' }).click();
    await expect(page.getByRole('heading', { name: '低脂肪牛乳' })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(`tabedoki-${width}.png`), fullPage: true });
    writeFileSync(info.outputPath('evidence.json'), JSON.stringify({ width, sha: process.env.GITHUB_SHA || 'local', runId: process.env.GITHUB_RUN_ID || null }, null, 2));
  });
}

test('期限境界と絞り込みを確認する', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T12:00:00') });
  await page.goto('/');
  await register(page, '昨日のヨーグルト', '2026-10-10');
  await register(page, '4日後の卵', '2026-10-15');
  await openFilters(page);
  await page.getByLabel('期限状態で絞り込み').selectOption('expired');
  await expect(page.getByRole('heading', { name: '昨日のヨーグルト' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '4日後の卵' })).toHaveCount(0);
  await openFilters(page);
  await page.getByLabel('期限状態で絞り込み').selectOption('later');
  await expect(page.getByRole('heading', { name: '4日後の卵' })).toBeVisible();
  await openFilters(page);
  await page.getByLabel('期限状態で絞り込み').selectOption('all');

});

test('キーボード・Escapeとフォーカス表示', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /食品一覧/ })).toBeVisible();
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toHaveCSS('outline-style', 'solid');
  await page.getByRole('button', { name: '食品を登録', exact: true }).last().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
async function openFilters(page) {
  const button = page.getByRole('button', { name: /^絞り込み/ });
  if (await button.getAttribute('aria-expanded') === 'false') await button.click();
}
