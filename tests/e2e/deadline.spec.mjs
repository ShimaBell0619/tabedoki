import { cloudData } from './helpers/cloud.mjs';
import { test, expect } from './helpers/cloud.mjs';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
    page.__deadlineErrors = errors;
});
test.afterEach(async ({ page }) => expect(page.__deadlineErrors).toEqual([]));

test('数字/ISO/カレンダー・途中入力・不正日付・候補選択を確認する', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '食品を登録', exact: true }).last().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/食品名/).fill('数字入力');
  const deadline = dialog.getByLabel(/期限の日付/);
  await deadline.fill('2027022');
  await dialog.getByRole('button', { name: 'カレンダー', exact: true }).click();
  await dialog.getByRole('button', { name: 'カレンダー', exact: true }).click();
  await expect(deadline).toHaveValue('2027022');
  await deadline.fill('20270229');
  await dialog.getByRole('button', { name: '登録する', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('実在する日付');
  await expect(deadline).toHaveValue('20270229');
  await deadline.fill('2028-02-29');
  await expect(dialog.getByText('2028年2月29日')).toBeVisible();
  await dialog.getByRole('button', { name: '定番・以前の登録から入力' }).click();
  await dialog.getByRole('button', { name: '定番の納豆', exact: true }).click();
  await expect(deadline).toBeFocused();
  await expect(deadline).toHaveValue('2028-02-29');
  await dialog.getByRole('button', { name: 'カレンダー', exact: true }).click();
  await dialog.getByLabel('カレンダーで期限を選択').fill('2028-03-01');
  await expect(deadline).toHaveValue('20280301');
  await dialog.getByRole('button', { name: '登録する', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name: '納豆', exact: true })).toBeVisible();
});

test('開いたまま午前0時を跨ぐと期限表示が更新される', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T23:59:59') });
  await page.goto('/');
  await page.getByRole('button', { name: '食品を登録', exact: true }).last().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/食品名/).fill('日跨ぎ');
  await dialog.getByLabel(/期限の日付/).fill('20261011');
  await dialog.getByRole('button', { name: '登録する', exact: true }).click();
  await expect(page.locator('.deadline-chip').getByText('今日まで', { exact: true })).toBeVisible();
  await page.clock.runFor(1001);
  await expect(page.getByText('1日超過', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '期限切れ 1件', exact: true })).toBeVisible();
});
