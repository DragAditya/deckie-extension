/* End-to-end test: loads the unpacked extension into Chromium and drives it like a user.
   Run:  NODE_PATH=$(npm root -g) node tests/e2e.js   (needs playwright + a Chromium build) */
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const EXT = path.resolve(__dirname, '..');
let passed = 0;
const ok = (name) => { passed++; console.log('  ok  ' + name); };

(async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    if (req.url.startsWith('/fs')) return res.end('<div id="box" style="width:100vw;height:100vh;background:#456">fullscreen target</div>');
    res.end(`<!doctype html><title>${req.url}</title><body style="margin:0;height:3000px"><h1>page ${req.url}</h1><script>window.__loads=(+sessionStorage.l||0)+1;sessionStorage.l=window.__loads</script>`);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'deckie-e2e-'));
  const ctx = await chromium.launchPersistentContext(userData, {
    headless: false,
    viewport: { width: 1200, height: 800 },
    args: ['--headless=new', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-sandbox'],
  });
  try {
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker');
    const extId = new URL(sw.url()).host;
    const getStore = () => sw.evaluate(() => chrome.storage.local.get('deckie').then((r) => r.deckie));
    const setStore = (patch) => sw.evaluate(async (pt) => {
      const r = (await chrome.storage.local.get('deckie')).deckie;
      const mg = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) mg(a[k], b[k]); else a[k] = b[k]; } };
      mg(r.profiles[r.activeId].settings, pt); await chrome.storage.local.set({ deckie: r });
    }, patch);

    const page = await ctx.newPage();
    await page.goto(base + '/');
    const pill = page.locator('deckie-toolbar .pill');
    await pill.waitFor({ state: 'attached', timeout: 10000 });
    assert.equal(await page.locator('deckie-toolbar').count(), 1);
    ok('toolbar mounts once');

    let b = await pill.boundingBox();
    assert.ok(b.width < 60 && b.height < 20, 'collapsed is small: ' + JSON.stringify(b));
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForFunction(() => document.querySelector('deckie-toolbar').shadowRoot.querySelector('.pill').dataset.state === 'expanded');
    await page.waitForTimeout(400);
    b = await pill.boundingBox();
    assert.ok(b.width > 200 && b.height > 30, 'expanded: ' + JSON.stringify(b));
    ok('hover expands, collapsed pill is tiny');

    // search + navigation
    const input = page.locator('deckie-toolbar input');
    await input.click();
    await input.fill(base.replace('http://', '') + '/b');
    assert.ok(await page.locator('deckie-toolbar .item').count() >= 1, 'suggestion shown');
    await input.press('Enter');
    await page.waitForURL(base + '/b');
    ok('search bar navigates to typed address');

    const expandAndClick = async (label) => {
      const p = page.locator('deckie-toolbar .pill');
      const bb = await p.boundingBox();
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await page.waitForFunction(() => document.querySelector('deckie-toolbar').shadowRoot.querySelector('.pill').dataset.state === 'expanded');
      await page.waitForTimeout(350);
      await page.locator(`deckie-toolbar button[aria-label="${label}"]`).click();
    };
    await page.locator('deckie-toolbar .pill').waitFor({ state: 'attached' });
    await expandAndClick('Back');
    await page.waitForURL(base + '/');
    ok('Back goes to the previous page');
    await expandAndClick('Forward');
    await page.waitForURL(base + '/b');
    ok('Forward works');

    const before = await page.evaluate(() => window.__loads);
    await expandAndClick('Reload');
    await page.waitForFunction((n) => window.__loads > n, before);
    ok('Reload reloads the active tab');

    const pagesBefore = ctx.pages().length;
    await expandAndClick('New tab');
    await page.waitForTimeout(500);
    assert.equal(ctx.pages().length, pagesBefore + 1);
    ok('New tab opens a tab');
    for (const p of ctx.pages()) if (p !== page) await p.close();
    await page.bringToFront();

    // fullscreen button
    await expandAndClick('Toggle fullscreen');
    await page.waitForFunction(() => window.innerHeight === screen.height || !!document.fullscreenElement || window.outerHeight >= screen.height - 2, null, { timeout: 5000 }).catch(() => {});
    const wstate = await sw.evaluate(() => chrome.windows.getCurrent().then((w) => w.state));
    assert.equal(wstate, 'fullscreen');
    await expandAndClick('Toggle fullscreen');
    await page.waitForTimeout(600);
    assert.notEqual(await sw.evaluate(() => chrome.windows.getCurrent().then((w) => w.state)), 'fullscreen');
    ok('Fullscreen button toggles the browser window in and out');

    // tab switcher
    const other = await ctx.newPage(); await other.goto(base + '/zz'); await page.bringToFront();
    await expandAndClick('Open tabs');
    await page.waitForFunction(() => document.querySelector('deckie-toolbar').shadowRoot.querySelectorAll('.panel .item').length >= 2);
    await page.locator('deckie-toolbar .panel .item', { hasText: '/zz' }).click();
    await page.waitForTimeout(500);
    assert.ok((await sw.evaluate(() => chrome.tabs.query({ active: true, currentWindow: true }).then((t) => t[0].url))).endsWith('/zz'));
    const fav = await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); const r = await fetch(chrome.runtime.getURL('/_favicon/') + '?pageUrl=' + encodeURIComponent(t.url) + '&size=32'); return r.ok ? (await r.arrayBuffer()).byteLength : 0; });
    assert.ok(fav > 0, 'favicon service reachable from the worker');
    ok('Open tabs lists tabs and switches to the chosen one');
    await page.bringToFront(); await other.close(); await page.mouse.move(5, 500);

    // keyboard shortcut
    await page.mouse.move(5, 400);
    await page.waitForTimeout(1000);
    await page.keyboard.press('Alt+Shift+D');
    await page.waitForFunction(() => document.querySelector('deckie-toolbar').shadowRoot.querySelector('.pill').dataset.state === 'expanded');
    await page.keyboard.press('Alt+Shift+D');
    await page.waitForFunction(() => document.querySelector('deckie-toolbar').shadowRoot.querySelector('.pill').dataset.state === 'collapsed');
    ok('configurable shortcut toggles the toolbar');

    // drag + persistence
    const p0 = (await getStore()).profiles.default.settings.position;
    b = await pill.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(300, 500, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const p1 = (await getStore()).profiles.default.settings.position;
    assert.notDeepEqual(p1, p0);
    assert.ok(p1.xPct < 40 && p1.yPct > 40, JSON.stringify(p1));
    ok('dragging moves the toolbar and saves the position');
    await page.reload();
    await pill.waitFor({ state: 'attached' });
    await page.waitForTimeout(400);
    b = await pill.boundingBox();
    assert.ok(Math.abs(b.x + b.width / 2 - 1200 * p1.xPct / 100) < 40 && b.y > 300, JSON.stringify(b));
    ok('position persists across reloads');

    // hidden mode
    await setStore({ behavior: { mode: 'hidden' }, position: { xPct: 50, yPct: 0 } });
    await page.waitForFunction(() => document.querySelector('deckie-toolbar').shadowRoot.querySelector('.pill').dataset.hidden === 'true');
    ok('hidden mode hides the pill (settings sync live)');
    await page.mouse.move(600, 600); await page.mouse.move(600, 30, { steps: 5 });
    await page.waitForFunction(() => document.querySelector('deckie-toolbar').shadowRoot.querySelector('.pill').dataset.state === 'expanded');
    ok('hidden mode reveals when the cursor reaches the activation area');
    await page.mouse.move(600, 700, { steps: 5 });
    await page.waitForFunction(() => document.querySelector('deckie-toolbar').shadowRoot.querySelector('.pill').dataset.hidden === 'true', null, { timeout: 8000 });
    ok('hidden mode hides again after leaving');

    // edge dock
    await setStore({ behavior: { mode: 'edge' }, position: { edge: 'left', xPct: 0, yPct: 50 } });
    await page.waitForTimeout(500);
    b = await pill.boundingBox();
    assert.ok(b.x === 0 && b.width <= 6 && b.height > 20, JSON.stringify(b));
    await page.mouse.move(10, 400 + 0, { steps: 3 }); await page.mouse.move(2, 400, { steps: 3 });
    await page.waitForFunction(() => document.querySelector('deckie-toolbar').shadowRoot.querySelector('.pill').dataset.state === 'expanded');
    ok('edge dock sits on the edge and reveals on hover');

    // blocked site
    await setStore({ behavior: { mode: 'pill', blockedSites: ['127.0.0.1'] } });
    await page.waitForFunction(() => !document.querySelector('deckie-toolbar'));
    await setStore({ behavior: { blockedSites: [] } });
    await page.waitForSelector('deckie-toolbar', { state: 'attached' });
    ok('blocked sites remove the toolbar; unblocking restores it');

    // fullscreen: toolbar follows into the fullscreen element
    const fsPage = await ctx.newPage();
    await fsPage.goto(base + '/fs');
    await fsPage.waitForSelector('deckie-toolbar', { state: 'attached' });
    await fsPage.evaluate(() => document.getElementById('box').requestFullscreen());
    await fsPage.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5000 }).catch(() => {});
    if (await fsPage.evaluate(() => !!document.fullscreenElement)) {
      await fsPage.waitForFunction(() => document.fullscreenElement.contains(document.querySelector('deckie-toolbar')));
      ok('toolbar moves into the fullscreen element');
    } else console.log('  skip fullscreen (headless build refused the request)');
    await fsPage.close();

    // options page: edit, preview, apply, persist
    const opt = await ctx.newPage();
    await opt.goto(`chrome-extension://${extId}/options/options.html`);
    await opt.waitForSelector('#stage deckie-toolbar', { state: 'attached' });
    await opt.locator('#applyCheck').count();
    assert.equal(await opt.locator('#apply').isDisabled(), true);
    await opt.locator('input[aria-label="Blur"]').fill('7');
    assert.equal(await opt.locator('#apply').isDisabled(), false);
    assert.equal((await getStore()).profiles.default.settings.appearance.blur, 24, 'not saved before Apply');
    const prevBlur = await opt.evaluate(() => getComputedStyle(document.querySelector('#stage deckie-toolbar').shadowRoot.querySelector('.root')).getPropertyValue('--blur'));
    assert.equal(prevBlur, '7px');
    ok('settings preview live before applying');
    await opt.click('#apply');
    await opt.waitForFunction(() => document.querySelector('#apply').disabled);
    assert.equal((await getStore()).profiles.default.settings.appearance.blur, 7);
    assert.equal((await getStore()).profiles.default.settings.preset, 'custom');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('deckie-toolbar').shadowRoot.querySelector('.root')).getPropertyValue('--blur') === '7px');
    ok('Apply saves and updates open pages');
    await opt.reload();
    await opt.waitForSelector('input[aria-label="Blur"]');
    assert.equal(await opt.locator('input[aria-label="Blur"]').inputValue(), '7');
    ok('settings persist after reopening');

    // add custom button + profile switching
    await opt.click('.tab[data-t="controls"]');
    await opt.click('text=Add website button');
    await opt.click('#apply');
    await opt.waitForFunction(() => document.querySelector('#apply').disabled);
    assert.ok((await getStore()).profiles.default.settings.controls.some((c) => c.type === 'custom' && c.url === 'https://example.com/'));
    ok('custom website button saved');
    await opt.click('.tab[data-t="profiles"]');
    await opt.click('text=New profile');
    await opt.waitForTimeout(300);
    const st = await getStore();
    assert.equal(st.order.length, 2);
    assert.equal(st.profiles[st.activeId].settings.appearance.blur, 24);
    ok('new profile starts from defaults and becomes active');

    console.log(`\n${passed} e2e checks passed`);
  } finally {
    await ctx.close();
    server.close();
  }
})().catch((e) => { console.error('\nE2E FAILED:', e.message || e); process.exit(1); });
