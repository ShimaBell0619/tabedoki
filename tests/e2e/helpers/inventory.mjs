export async function openCandidates(dialog) {
  const toggle = dialog.getByRole('button', { name: '定番・以前の登録から入力', exact: true });
  if (await toggle.count() === 0) return;
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
}

export async function openFoodActions(page) {
  for (const summary of await page.locator('.food-details:not([open]) > summary').all()) await summary.click();
}
