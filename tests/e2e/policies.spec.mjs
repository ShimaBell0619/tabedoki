import { test, expect } from '@playwright/test';

for (const [path, title] of [['/privacy.html', 'プライバシーポリシー'], ['/terms.html', '利用条件']]) {
  test(`${title}を未ログインで参照できる`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    const response = await page.goto(path);
    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByRole('button', { name: 'Googleでログイン' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'shimaoka0619@gmail.com' })).toHaveAttribute('href', 'mailto:shimaoka0619@gmail.com');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
}
