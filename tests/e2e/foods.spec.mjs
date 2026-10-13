import { openCandidates, openFoodActions } from './helpers/inventory.mjs';
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { restoreBackup } from './helpers/backup.mjs';

let errors = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
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
  test(`${width}pxでCRUD、検索、永続化と画面表示`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date('2026-10-11T12:00:00') });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /食品一覧/ })).toBeVisible();
    await register(page, '牛乳', '2026-10-11', '消費期限', '冷蔵');
    await register(page, '食パン', '2026-10-13', '賞味期限', '常温');
    await expect(page.getByText('今日まで', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('あと2日')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: '牛乳' })).toBeVisible();
    await page.getByRole('searchbox', { name: '食品名で検索' }).fill('食パン');
    await expect(page.getByRole('heading', { name: '牛乳' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '食パン' })).toBeVisible();
    await page.getByRole('searchbox', { name: '食品名で検索' }).clear();
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
    await page.getByRole('button', { name: '低脂肪牛乳を使い切り' }).click();
    await expect(page.getByRole('heading', { name: '低脂肪牛乳' })).toHaveCount(0);
    await page.getByRole('button', { name: '完了' }).click();
    await expect(page.getByRole('heading', { name: '低脂肪牛乳' })).toBeVisible();
    await openFoodActions(page);
    await page.getByRole('button', { name: '戻す' }).click();
    await page.getByRole('button', { name: '管理中' }).click();
    page.once('dialog', dialog => dialog.accept());
    await openFoodActions(page);
    await page.getByRole('button', { name: '低脂肪牛乳のその他の操作' }).click();
    await page.getByRole('button', { name: '低脂肪牛乳を削除' }).click();
    await expect(page.getByRole('heading', { name: '低脂肪牛乳' })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(`tabedoki-${width}.png`), fullPage: true });
    writeFileSync(info.outputPath('evidence.json'), JSON.stringify({ width, sha: process.env.GITHUB_SHA || 'local', runId: process.env.GITHUB_RUN_ID || null }, null, 2));
  });
}

test('期限境界・バックアップ復元・不正JSON拒否・上書き確認', async ({ page }) => {
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
  const downloadWait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'バックアップを保存' }).click();
  const download = await downloadWait;
  const path = await download.path();
  await restoreBackup(page, path, { accept: false });
  await expect(page.getByRole('heading', { name: '昨日のヨーグルト' })).toBeVisible();
  const bad = Buffer.from('{"version":1,"items":[{"id":"bad"}]}');
  await page.getByLabel('バックアップファイルを選択').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: bad });
  await expect(page.getByText(/復元できません/)).toBeVisible();
  await restoreBackup(page, path);
  await expect(page.getByText('2件を復元しました。')).toBeVisible();
});

test('キーボード・Escapeとフォーカス表示', async ({ page }) => {
  await page.goto('/');
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
