import { test, expect, cloudData, setCloudData } from './helpers/cloud.mjs';

// Emulate Android Chrome's mobile viewport and touch input.
test.use({ isMobile: true, hasTouch: true });

for (const width of [320, 390, 1440]) {
  test(`ガラスナビゲーションが${width}pxでも操作可能`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await cloudData(page);

    const mobile = page.locator('.mobile-navigation');
    const desktop = page.locator('.desktop-navigation');

    if (width > 760) {
      await expect(mobile).toBeHidden();
      await expect(desktop).toBeVisible();
      await expect(desktop.getByRole('button', { name: 'カレンダー' })).toBeVisible();
      await expect(page.locator('.mobile-navigation-glass')).toBeHidden();
      await expect(page.locator('.mobile-add-glass')).toBeHidden();
      await page.screenshot({ path: info.outputPath('glass-desktop-1440.png') });
      return;
    }

    await expect(desktop).toBeHidden();
    await expect(mobile).toBeVisible();
    await expect(mobile).toHaveCSS('position', 'fixed');
    await expect(mobile).toHaveCSS('border-radius', '23px');
    const lens = page.locator('.mobile-navigation-glass');
    await expect(lens).toBeVisible();
    await expect(lens).toHaveAttribute('aria-hidden', 'true');
    await expect(lens).toHaveCSS('backdrop-filter', /blur\(3px\)/);
    await expect(lens).toHaveCSS('background-color', 'rgba(236, 245, 255, 0.24)');
    const glass = await mobile.evaluate(node => {
      const surface = getComputedStyle(node);
      const highlight = getComputedStyle(node, '::after');
      const selected = getComputedStyle(node, '::before');
      return {
        surface: surface.backgroundImage,
        shadow: surface.boxShadow,
        highlight: highlight.backgroundImage,
        highlightPointer: highlight.pointerEvents,
        selected: selected.backgroundImage,
      };
    });
    expect(glass.surface).toContain('linear-gradient');
    expect(glass.shadow).toContain('inset');
    expect(glass.highlight).toContain('linear-gradient');
    expect(glass.highlightPointer).toBe('none');
    expect(glass.selected).toContain('linear-gradient');
    await expect(mobile.getByRole('button')).toHaveCount(3);
    await expect(mobile.getByRole('button', { name: '一覧' })).toHaveAttribute('aria-current', 'page');
    await expect(mobile).toHaveCSS('--active-tab-index', '0');

    const addButton = page.locator('.mobile-add-button');
    await expect(addButton).toBeVisible();
    await expect(addButton).toHaveCSS('backdrop-filter', 'none');
    const addLens = page.locator('.mobile-add-glass');
    await expect(addLens).toBeVisible();
    await expect(addLens).toHaveAttribute('aria-hidden', 'true');
    await expect(addLens).toHaveCSS('backdrop-filter', /blur\(2px\)/);
    await expect(addLens).toHaveCSS('background-color', 'rgba(130, 169, 212, 0.18)');
    const addSurface = await addButton.evaluate(node => {
      const style = getComputedStyle(node);
      return { background: style.backgroundImage, shadow: style.boxShadow };
    });
    expect(addSurface.background).toContain('radial-gradient');
    expect(addSurface.shadow).toContain('inset');
    const navBox = await mobile.boundingBox();
    const lensBox = await lens.boundingBox();
    const addLensBox = await addLens.boundingBox();
    expect(lensBox.x).toBe(navBox.x);
    expect(lensBox.y).toBe(navBox.y);
    expect(lensBox.width).toBe(navBox.width);
    expect(lensBox.height).toBe(navBox.height);
    const addBox = await addButton.boundingBox();
    expect(navBox).toBeTruthy();
    expect(addBox).toBeTruthy();
    expect(addLensBox.x).toBe(addBox.x);
    expect(addLensBox.y).toBe(addBox.y);
    expect(addLensBox.width).toBe(addBox.width);
    expect(addLensBox.height).toBe(addBox.height);
    expect(navBox.x).toBeGreaterThanOrEqual(0);
    expect(navBox.x + navBox.width).toBeLessThanOrEqual(width);
    expect(navBox.y - (addBox.y + addBox.height)).toBeGreaterThanOrEqual(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

    await page.screenshot({ path: info.outputPath(`glass-mobile-${width}.png`) });
    const calendar = mobile.getByRole('button', { name: 'カレンダー' });
    await calendar.focus();
    await expect(calendar).toHaveCSS('outline-width', '3px');
    await page.keyboard.press('Enter');
    await expect(calendar).toHaveAttribute('aria-current', 'page');
    await expect(mobile).toHaveCSS('--active-tab-index', '1');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('カレンダー');
    await expect(addButton).toBeVisible();

    await mobile.getByRole('button', { name: '買い物' }).click();
    await expect(mobile).toHaveCSS('--active-tab-index', '2');
    await expect(addButton).toHaveCount(0);
    await expect(addLens).toHaveCount(0);
    await mobile.getByRole('button', { name: '一覧' }).click();
    await expect(mobile).toHaveCSS('--active-tab-index', '0');
    await addButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(page.cloud.writes).toBe(0);
  });
}

test('スクロール中と停止後のガラス描画が完全に同一', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await cloudData(page);
  const navLens = page.locator('.mobile-navigation-glass');
  const addLens = page.locator('.mobile-add-glass');
  const capture = () => page.evaluate(() => {
    const nav = getComputedStyle(document.querySelector('.mobile-navigation-glass'));
    const add = getComputedStyle(document.querySelector('.mobile-add-glass'));
    const overlay = getComputedStyle(document.querySelector('.mobile-navigation'));
    return {
      navFilter: nav.backdropFilter, addFilter: add.backdropFilter,
      navTint: nav.backgroundColor, addTint: add.backgroundColor,
      navBackground: overlay.backgroundImage, navBorder: overlay.borderColor,
      navShadow: nav.boxShadow, addShadow: add.boxShadow,
    };
  });
  const idle = await capture();
  expect(idle.navFilter).toContain('blur(3px)');
  expect(idle.addFilter).toContain('blur(2px)');
  expect(idle.navFilter).not.toContain('url(');
  expect(idle.addFilter).not.toContain('url(');
  const moving = await page.evaluate(() => {
    window.dispatchEvent(new Event('touchmove'));
    document.querySelector('main').style.minHeight = '2300px';
    window.scrollTo(0, 420);
    window.dispatchEvent(new Event('scroll'));
    return { y: window.scrollY, hasScrollFlag: document.documentElement.hasAttribute('data-glass-scrolling') };
  });
  expect(moving.y).toBeGreaterThan(0);
  expect(moving.hasScrollFlag).toBe(false);
  expect(await capture()).toEqual(idle);
  await page.waitForTimeout(350);
  expect(await capture()).toEqual(idle);
  await expect(navLens).toHaveCSS('backdrop-filter', /blur\(3px\)/);
  await expect(addLens).toHaveCSS('backdrop-filter', /blur\(2px\)/);
  await expect(page.locator('[data-liquid-glass], [data-glass-strategy]')).toHaveCount(0);
  await expect(page.locator('.mobile-navigation').getByRole('button', { name: '買い物' })).toBeEnabled();
});

for (const width of [320, 390]) {
  test(`${width}pxで実際の食品カード越しの静止・スクロール中ガラスを比較する`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const current = await cloudData(page);
    const foods = ['牛乳', '納豆', 'たまご', 'ヨーグルト', '豆腐', '食パン', 'パスタ', 'チーズ'];
    await setCloudData(page, {
      ...current,
      items: foods.map((name, i) => ({
        id: `glass-food-${i}`, name,
        category: 'eggs-dairy', deadline: '2026-11-12',
        kind: 'best-before', quantity: i + 1, initialQuantity: i + 1,
        consumption: 'eat', lowStock: false,
        unit: 'piece', place: 'chilled', status: 'active',
      })),
    });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('食品一覧 8件');

    const nav = page.locator('.mobile-navigation');
    const navLens = page.locator('.mobile-navigation-glass');
    await expect(navLens).toHaveCSS('backdrop-filter', /blur\(3px\)/);
    const before = await nav.evaluate(node => ({
      background: getComputedStyle(node).backgroundImage,
      border: getComputedStyle(node).borderColor,
    }));
    await page.screenshot({ path: info.outputPath(`glass-idle-${width}.png`) });

    // Touch activity does not change the surface, even after the prior idle timeout.
    await page.evaluate(() => window.dispatchEvent(new Event('touchmove')));
    await expect(navLens).toHaveCSS('backdrop-filter', /blur\(3px\)/);
    const during = await nav.evaluate(node => ({
      background: getComputedStyle(node).backgroundImage,
      border: getComputedStyle(node).borderColor,
    }));
    expect(during).toEqual(before);
    await page.screenshot({ path: info.outputPath(`glass-scrolling-${width}.png`) });
    await page.waitForTimeout(350);
    await expect(navLens).toHaveCSS('backdrop-filter', /blur\(3px\)/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
