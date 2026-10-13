import { expect } from '@playwright/test';

export async function openBackup(page) {
  const details = page.locator('.backup-panel');
  if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
}

export async function restoreBackup(page, files, { accept = true, notice = /^\d+件を復元しました。$/ } = {}) {
  await openBackup(page);
  // 同じ件数の古い通知を完了証拠として再利用しない。
  const closeNotice = page.getByRole('button', { name: '通知を閉じる', exact: true });
  if (await closeNotice.count()) await closeNotice.click();
  const handled = page.waitForEvent('dialog').then(dialog => accept ? dialog.accept() : dialog.dismiss());
  await Promise.all([
    handled,
    page.getByLabel('バックアップファイルを選択').setInputFiles(files),
  ]);
  if (accept) await expect(page.getByRole('status')).toContainText(notice);
}
