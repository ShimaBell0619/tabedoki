import { test, expect } from './helpers/cloud.mjs';

for (const width of [320, 390, 430, 1440]) {
  test(`設定行のアイコンとラベルを左寄せし、末尾の操作を右端に保つ ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: '設定', exact: true }).click();
    const rows = page.locator('.settings-page .settings-row');
    await expect(rows).toHaveCount(5);

    for (const row of await rows.all()) {
      const layout = await row.evaluate(element => {
        const icon = element.querySelector(':scope > .icon');
        const label = element.querySelector(':scope > span:not(.icon)');
        const end = element.lastElementChild;
        if (!icon || !label || !end) throw new Error('設定行の要素が不足しています');
        const box = node => {
          const { x, width } = node.getBoundingClientRect();
          return { x, width, right: x + width };
        };
        return {
          row: box(element), icon: box(icon), label: box(label), end: box(end),
          iconGrow: getComputedStyle(icon).flexGrow,
          labelGrow: getComputedStyle(label).flexGrow,
        };
      });
      expect(layout.iconGrow).toBe('0');
      expect(layout.labelGrow).toBe('1');
      expect(layout.icon.width).toBeLessThanOrEqual(24);
      expect(layout.label.x - layout.icon.right).toBeGreaterThanOrEqual(10);
      expect(layout.label.x - layout.icon.right).toBeLessThanOrEqual(16);
      expect(layout.end.right).toBeLessThanOrEqual(layout.row.right);
      expect(layout.row.right - layout.end.right).toBeLessThanOrEqual(20);
    }
    await page.screenshot({ path: info.outputPath(`settings-alignment-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
