import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fixture, storageKey } from './fixture.mjs';

// Production builds only. No instrumentation or analytics are shipped to users.
// Usage: node scripts/performance/measure.mjs --before /tmp/baseline/dist --after dist --output test-results/performance.json
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, all) => i % 2 === 0 ? [...pairs, [value.replace(/^--/, ''), all[i + 1]]] : pairs, []));
if (!args.before && !args.after) throw new Error('Specify --before and/or --after build directories');
const repeats = Number(args.repeats ?? 5);
const cpuRate = Number(args.cpu ?? 4);
const servers = [];
const variants = [];
for (const name of ['before', 'after']) {
  if (!args[name]) continue;
  const root = resolve(args[name]);
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(path)] ?? 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const assets = {};
  for (const file of (await readdir(resolve(root, 'assets'))).sort()) {
    assets[file] = createHash('sha256').update(await readFile(resolve(root, 'assets', file))).digest('hex');
  }
  variants.push({ name, root, assets, url: `http://127.0.0.1:${server.address().port}` });
}
const launch = () => chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
let browser;
const result = { metadata: { date: new Date().toISOString(), sourceTree: execFileSync('git', ['rev-parse', 'HEAD:src'], { encoding: 'utf8' }).trim(), checkoutHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), browser: null, viewport: { width: 390, height: 844 }, cpuRate, repeats, fonts: 'blocked; system fallback for deterministic timing', device: 'headless mobile Chromium emulation; NOT Android hardware', variants }, samples: [] };
const paint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const metrics = async cdp => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));
try {
  for (const count of [20, 100, 300]) for (let repeat = 0; repeat < repeats; repeat++) {
    // Alternate order to avoid giving one variant all of the warmer samples.
    for (const variant of repeat % 2 ? [...variants].reverse() : variants) {
      browser = await launch();
      result.metadata.browser = browser.version();
      const context = await browser.newContext({ viewport: result.metadata.viewport, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await page.clock.setFixedTime(new Date('2026-11-15T12:00:00+09:00'));
      await page.addInitScript(({ data, key }) => {
        localStorage.setItem(key, JSON.stringify(data));
        window.__perf = { events: [], loaf: [], frames: [], initialPaint: null };
        const perf = window.__perf;
        const observers = [];
        for (const type of ['event', 'long-animation-frame']) {
          if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
          const collect = entries => perf[type === 'event' ? 'events' : 'loaf'].push(...entries.map(entry => entry.toJSON()));
          const observer = new PerformanceObserver(list => collect(list.getEntries()));
          observer.observe({ type, buffered: true, ...(type === 'event' ? { durationThreshold: 16 } : {}) });
          observers.push({ observer, collect });
        }
        perf.flush = () => observers.forEach(({ observer, collect }) => collect(observer.takeRecords()));
        new MutationObserver((_, observer) => {
          if (!document.querySelector('#inventory-heading')) return;
          requestAnimationFrame(() => requestAnimationFrame(() => { perf.initialPaint = performance.now(); }));
          observer.disconnect();
        }).observe(document, { childList: true, subtree: true });
      }, { data: fixture(count), key: storageKey });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
      await page.goto(variant.url);
      await page.waitForFunction(() => window.__perf.initialPaint !== null);
      await paint(page);
      const sample = { variant: variant.name, count, repeat, initial: await page.evaluate(() => ({ readyPaintMs: window.__perf.initialPaint, fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null, domElements: document.querySelectorAll('*').length, supportedEntryTypes: PerformanceObserver.supportedEntryTypes })), initialMetrics: await metrics(cdp), operations: {} };
      const measure = async (name, action) => {
        await paint(page);
        const before = await metrics(cdp);
        const start = await page.evaluate(() => { window.__perf.flush(); return performance.now(); });
        await action();
        await paint(page);
        const after = await metrics(cdp);
        sample.operations[name] = await page.evaluate(({ start, before, after }) => {
          window.__perf.flush();
          const events = window.__perf.events.filter(e => e.startTime >= start && e.interactionId > 0);
          const worst = events.sort((a, b) => b.duration - a.duration)[0];
          const loaf = window.__perf.loaf.filter(e => e.startTime >= start);
          return {
            // Lab Event Timing samples, not field INP. Values below 16ms aren't reported.
            eventMaxMs: worst?.duration ?? null,
            inputDelayMs: worst ? worst.processingStart - worst.startTime : null,
            processingMs: worst ? worst.processingEnd - worst.processingStart : null,
            presentationMs: worst ? Math.max(0, worst.startTime + worst.duration - worst.processingEnd) : null,
            scriptMs: 1000 * (after.ScriptDuration - before.ScriptDuration),
            layoutMs: 1000 * (after.LayoutDuration - before.LayoutDuration),
            styleMs: 1000 * (after.RecalcStyleDuration - before.RecalcStyleDuration),
            layoutCount: after.LayoutCount - before.LayoutCount,
            loafCount: loaf.length, loafMaxMs: Math.max(0, ...loaf.map(e => e.duration)),
            forcedStyleLayoutMs: loaf.reduce((sum, e) => sum + (e.scripts ?? []).reduce((s, script) => s + (script.forcedStyleAndLayoutDuration ?? 0), 0), 0),
          };
        }, { start, before, after });
      };
      const nav = page.locator('.mobile-navigation');
      await measure('calendarFirst', () => nav.getByRole('button', { name: 'カレンダー' }).click());
      await measure('shopping', () => nav.getByRole('button', { name: '買い物' }).click());
      await measure('inventoryReturn', () => nav.getByRole('button', { name: '一覧' }).click());
      const card = page.locator('.food-row').filter({ has: page.getByRole('heading', { name: '食品000', exact: true }) });
      await measure('expand', () => card.locator('summary').click());
      await measure('quantity', async () => {
        await card.getByRole('button', { name: '食品000の数量を1増やす' }).click();
        await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).items[0].quantity === 4, storageKey);
        await card.getByRole('button', { name: '食品000の数量を1増やす' }).waitFor({ state: 'visible' });
      });
      await measure('stockForm', () => card.getByRole('button', { name: '在庫を追加', exact: true }).click());
      await measure('calendarReturn', () => nav.getByRole('button', { name: 'カレンダー' }).click());
      const scroll = async name => {
        await page.evaluate(() => scrollTo(0, 0)); await paint(page);
        await measure(name, async () => {
          await page.evaluate(() => {
            window.__perf.scrolling = true; window.__perf.frames = [];
            let last;
            function frame(now) { if (last !== undefined) window.__perf.frames.push(now - last); last = now; if (window.__perf.scrolling) requestAnimationFrame(frame); }
            requestAnimationFrame(frame);
          });
          // Trusted touch scroll input, not dispatchEvent('scroll').
          await cdp.send('Input.synthesizeScrollGesture', { x: 180, y: 500, yDistance: -1200, speed: 900, gestureSourceType: 'touch' });
          await cdp.send('Input.synthesizeScrollGesture', { x: 180, y: 350, yDistance: 1200, speed: 900, gestureSourceType: 'touch' });
          await page.evaluate(() => { window.__perf.scrolling = false; });
        });
        sample.operations[name].frames = await page.evaluate(() => {
          const values = window.__perf.frames.slice(2).sort((a, b) => a - b);
          return { count: values.length, p95Ms: values[Math.floor(values.length * .95)] ?? null, over32ms: values.filter(v => v > 32).length };
        });
      };
      await scroll('calendarScroll');
      await nav.getByRole('button', { name: '一覧' }).click();
      await scroll('inventoryScroll');
      if (errors.length) throw new Error(errors.join('\n'));
      result.samples.push(sample);
      console.log(JSON.stringify({ variant: variant.name, count, repeat, readyMs: sample.initial.readyPaintMs, quantityMs: sample.operations.quantity.eventMaxMs, tabMs: sample.operations.calendarReturn.eventMaxMs }));
      await browser?.close();
      browser = undefined;
    }
  }
} finally {
  await browser?.close();
  await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
}
const output = resolve(args.output ?? 'test-results/performance.json');
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(`Saved ${output}`);
