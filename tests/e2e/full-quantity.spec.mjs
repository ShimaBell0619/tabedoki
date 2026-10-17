import { test, expect, cloudData } from './helpers/cloud.mjs';
import { V4_STORAGE_KEY } from '../../src/data/storage.ts';
import { defaultTemplates } from '../../src/domain/templates.ts';

test('満量は残数とは独立して編集でき、消費と再読み込み後も維持される', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.addInitScript(({ key, templates }) => {
    localStorage.setItem(key, JSON.stringify({
      version: 4, templates, shopping: [], items: [{
        id: 'egg', name: 'たまご', category: 'eggs-dairy', kind: 'best-before',
        deadline: '2027-01-10', quantity: 3, unit: 'piece', place: 'chilled',
        status: 'active', lowStock: false
      }]
    }));
  }, { key: V4_STORAGE_KEY, templates: defaultTemplates() });
  await page.goto('/');

  const row = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: 'たまご' }) });
  await expect(row.locator('summary .stock-preview')).toHaveAttribute('aria-label', /3\/3個/);
  await row.locator('summary').click();
  await row.getByRole('button', { name: 'たまごを編集' }).click();

  const dialog = page.getByRole('dialog', { name: '食品を編集' });
  await expect(dialog.getByLabel('数量', { exact: true })).toHaveValue('3');
  await expect(dialog.getByLabel('バーの満量')).toHaveValue('3');
  await dialog.getByLabel('バーの満量').fill('10');
  await dialog.getByRole('button', { name: '変更を保存' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(row.locator('summary .stock-preview')).toHaveAttribute('aria-label', /3\/10個/);
  expect((await cloudData(page)).items.find(item => item.id === 'egg')).toMatchObject({
    quantity: 3, initialQuantity: 10, status: 'active'
  });
  await page.reload();
  await expect(row.locator('summary .stock-preview')).toHaveAttribute('aria-label', /3\/10個/);
  await row.locator('summary').click();
  await row.getByRole('button', { name: 'たまごを1個食べた' }).click();
  await expect(row.locator('summary .stock-preview')).toHaveAttribute('aria-label', /2\/10個/);
  expect((await cloudData(page)).items.find(item => item.id === 'egg')).toMatchObject({
    quantity: 2, initialQuantity: 10, status: 'active'
  });

  await row.getByRole('button', { name: 'たまごを編集' }).click();
  const editAgain = page.getByRole('dialog', { name: '食品を編集' });
  await editAgain.getByLabel('バーの満量').fill('5');
  await editAgain.getByRole('button', { name: '変更を保存' }).click();
  expect((await cloudData(page)).items.find(item => item.id === 'egg')).toMatchObject({
    quantity: 2, initialQuantity: 5
  });
});

test('新規登録では数量を満量の初期値にし、現在量以上の範囲で調整できる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await page.getByRole('button', { name: '食品を登録', exact: true }).last().click();
  const dialog = page.getByRole('dialog', { name: '食品を登録' });
  await dialog.getByRole('textbox', { name: /食品名/ }).fill('たまご');
  await dialog.getByLabel('数量の単位').selectOption('piece');
  await dialog.getByLabel(/期限の日付/).fill('2027-01-15');
  await dialog.getByLabel('数量', { exact: true }).fill('8');
  await expect(dialog.getByLabel('バーの満量')).toHaveValue('8');
  await dialog.getByLabel('バーの満量').fill('12');
  await dialog.getByLabel('数量', { exact: true }).fill('5');
  await expect(dialog.getByLabel('バーの満量')).toHaveValue('12');
  await dialog.getByLabel('バーの満量').fill('2');
  expect(await dialog.getByLabel('バーの満量').evaluate(node => node.validity.rangeUnderflow)).toBe(true);
  await dialog.getByLabel('バーの満量').fill('10');
  await dialog.getByRole('button', { name: '登録する' }).click();
  const saved = await cloudData(page);
  expect(saved.items).toHaveLength(1);
  expect(saved.items[0]).toMatchObject({ quantity: 5, initialQuantity: 10 });
  const row = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: 'たまご' }) });
  await expect(row.locator('summary .stock-preview')).toHaveAttribute('aria-label', /5\/10個/);
});
