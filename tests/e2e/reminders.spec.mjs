import { test, expect, userId } from './helpers/cloud.mjs';
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

async function mockSubscription(page, enabled) {
  await page.addInitScript(({ id, enabled }) => {
    localStorage.setItem('tabedoki-reminder-v2:' + id, JSON.stringify({
      enabled, weekdays: [1, 4, 7], hour: 19, skipRegistered: true,
    }));
    localStorage.setItem('tabedoki-reminder-endpoint-v2:' + id, 'https://fcm.googleapis.com/wp/test');
    window.pushUnsubscribed = false;
    Object.defineProperty(navigator.serviceWorker, 'getRegistration', { value: async () => ({
      pushManager: { getSubscription: async () => ({
        endpoint: 'https://fcm.googleapis.com/wp/test',
        unsubscribe: async () => { window.pushUnsubscribed = true; return true; },
      }) },
    }) });
  }, { id: userId, enabled });
}

for (const offline of [false, true]) {
  test(offline ? '通知APIが通信不能でも購読を解除してログアウトする' : '端末の設定が無効でも実際の購読を解除してログアウトする', async ({ page }) => {
    await mockSubscription(page, offline);
    const actions = [];
    await page.route('https://cloud.tabedoki.test/functions/v1/reminder-preferences', async route => {
      actions.push(route.request().postDataJSON());
      if (offline) await route.abort();
      else await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'アカウント', exact: true }).click();
    await page.getByRole('menuitem', { name: 'ログアウト', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.pushUnsubscribed)).toBe(true);
    await page.getByRole('button', { name: 'アカウント', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /Googleでログイン/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: '通知の設定' })).toHaveCount(0);
    expect(actions).toEqual([{ action: 'disable', endpoint: 'https://fcm.googleapis.com/wp/test' }]);
    const stored = await page.evaluate(id => ({
      settings: JSON.parse(localStorage.getItem('tabedoki-reminder-v2:' + id)),
      endpoint: localStorage.getItem('tabedoki-reminder-endpoint-v2:' + id),
    }), userId);
    expect(stored.settings.enabled).toBe(false);
    expect(stored.endpoint).toBeNull();
    expect(page.cloud.writes).toBe(0);
  });
}

test('通知停止を保存するとサーバーとブラウザの購読を解除する', async ({ page }) => {
  await mockSubscription(page, true);
  const actions = [];
  await page.route('https://cloud.tabedoki.test/functions/v1/reminder-preferences', async route => {
    actions.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'アカウント', exact: true }).click();
  await page.getByRole('menuitem', { name: '通知の設定' }).click();
  const dialog = page.getByRole('dialog', { name: '登録リマインダー' });
  await dialog.getByRole('checkbox', { name: '通知を有効にする' }).uncheck();
  await dialog.getByRole('button', { name: '設定を保存' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.pushUnsubscribed)).toBe(true);
  expect(actions).toEqual([{ action: 'disable', endpoint: 'https://fcm.googleapis.com/wp/test' }]);
  expect(page.cloud.writes).toBe(0);
});
