import { test, expect } from './helpers/cloud.mjs';
import { test as localTest } from '@playwright/test';

localTest('ローカル保存では通知設定を表示しない', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'アカウント', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: '通知の設定' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: /Googleでログイン/ })).toBeVisible();
});

test('Googleログイン中だけ通知設定が開き曜日と時刻を操作できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'アカウント', exact: true }).click();
  await page.getByRole('menuitem', { name: '通知の設定' }).click();
  const dialog = page.getByRole('dialog', { name: '登録リマインダー' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: '通知を有効にする' })).not.toBeChecked();
  await dialog.getByRole('checkbox', { name: '通知を有効にする' }).check();
  await dialog.getByRole('button', { name: '月曜日' }).click();
  await expect(dialog.getByRole('button', { name: '月曜日' })).toHaveAttribute('aria-pressed', 'false');
  await dialog.getByRole('radio', { name: '21:00' }).check();
  await expect(dialog.getByText(/木・日曜日 21:00/)).toBeVisible();
  await expect(dialog.getByText(/Googleログイン中のアカウント/)).toBeVisible();
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await expect(dialog).toHaveCount(0);
});

test('通知のURLで既存の食品登録フォームを直接開く', async ({ page }) => {
  await page.goto('/?reminder=register');
  await expect(page.getByRole('dialog', { name: '食品を登録' })).toBeVisible();
  await expect(page).not.toHaveURL(/reminder=register/);
  await page.getByRole('dialog', { name: '食品を登録' }).getByRole('button', { name: '閉じる' }).click();
  await expect(page.getByRole('heading', { name: /食品一覧/ })).toBeVisible();
});

test('開いているタブへの通知メッセージから食品登録画面を開く', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    navigator.serviceWorker.dispatchEvent(new MessageEvent('message', {
      data: { type: 'TABEDOKI_REGISTER_FROM_NOTIFICATION' },
    }));
  });
  await expect(page.getByRole('dialog', { name: '食品を登録' })).toBeVisible();
});
