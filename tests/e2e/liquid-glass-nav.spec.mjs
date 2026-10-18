import { test, expect, cloudData } from './helpers/cloud.mjs';

// Emulate Android Chrome's mobile viewport and touch input.
test.use({ isMobile: true, hasTouch: true });

for (const width of [320, 390, 1440]) {
  test(`Liquid Glassナビゲーションが${width}pxでも操作可能`, async ({ page }, info) => {
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
    await expect(lens).toHaveAttribute('data-glass-strategy', 'svg');
    await expect(lens).toHaveAttribute('aria-hidden', 'true');
    const filter = await lens.locator(':scope > div').first()
      .evaluate(node => getComputedStyle(node).backdropFilter);
    expect(filter).toContain('url(');
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
    await expect(addLens).toHaveAttribute('data-glass-strategy', 'svg');
    await expect(addLens).toHaveAttribute('aria-hidden', 'true');
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

test('スクロール中もガラスの透明度を保ち、停止後は屈折だけ復元する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await cloudData(page);

  const navLens = page.locator('.mobile-navigation-glass');
  const addLens = page.locator('.mobile-add-glass');
  const navFilter = navLens.locator(':scope > div').first();
  const addFilter = addLens.locator(':scope > div').first();
  await expect(navLens).toHaveAttribute('data-glass-strategy', 'svg');
  await expect(navFilter).toHaveCSS('backdrop-filter', /url/);
  await expect(addFilter).toHaveCSS('backdrop-filter', /url/);
  const initialSurface = await page.evaluate(() => {
    const nav = getComputedStyle(document.querySelector('.mobile-navigation'));
    const add = getComputedStyle(document.querySelector('.mobile-add-glass > div:first-child'));
    const lens = getComputedStyle(document.querySelector('.mobile-navigation-glass > div:first-child'));
    return {
      navigationBackground: nav.backgroundImage,
      navigationOpacity: nav.opacity,
      navigationBorder: nav.borderColor,
      lensBackground: lens.background,
      addBackground: add.background,
    };
  });

  // Touch motion disables the heavy filter before the following scroll.
  await page.evaluate(() => window.dispatchEvent(new Event('touchmove')));
  await expect(page.locator('html')).toHaveAttribute('data-glass-scrolling', 'true');
  await expect(navFilter).toHaveCSS('backdrop-filter', /blur/);
  await expect(addFilter).toHaveCSS('backdrop-filter', /blur/);
  expect(await navFilter.evaluate(node => getComputedStyle(node).backdropFilter)).toContain('3px');
  expect(await addFilter.evaluate(node => getComputedStyle(node).backdropFilter)).toContain('2px');
  const scrollingSurface = await page.evaluate(() => {
    const nav = getComputedStyle(document.querySelector('.mobile-navigation'));
    const add = getComputedStyle(document.querySelector('.mobile-add-glass > div:first-child'));
    const lens = getComputedStyle(document.querySelector('.mobile-navigation-glass > div:first-child'));
    return {
      navigationBackground: nav.backgroundImage,
      navigationOpacity: nav.opacity,
      navigationBorder: nav.borderColor,
      lensBackground: lens.background,
      addBackground: add.background,
    };
  });
  expect(scrollingSurface).toEqual(initialSurface);

  // Scrolling the page extends lightweight mode without remounting the lenses.
  await page.evaluate(() => {
    const main = document.querySelector('main');
    main.style.minHeight = '2300px';
    window.scrollTo(0, 420);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.locator('html')).toHaveAttribute('data-glass-scrolling', 'true');
  await expect(navFilter).toHaveCSS('backdrop-filter', /blur/);

  await expect(page.locator('html')).not.toHaveAttribute('data-glass-scrolling', 'true');
  await expect(navLens).toHaveAttribute('data-glass-strategy', 'svg');
  await expect(navFilter).toHaveCSS('backdrop-filter', /url/);
  await expect(addFilter).toHaveCSS('backdrop-filter', /url/);
  await expect(page.locator('.mobile-navigation').getByRole('button', { name: '買い物' })).toBeEnabled();
});
