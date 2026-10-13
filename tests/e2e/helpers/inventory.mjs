export async function openCandidates(dialog) {
  const toggle = dialog.getByRole('button', { name: '定番・以前の登録から入力', exact: true });
  if (await toggle.count() === 0) return;
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
}

export async function openFoodActions(page) {
  for (const details of await page.locator('.food-details').all()) {
    if (await details.getAttribute('open') === null) await details.locator('summary').click();
  }
}
