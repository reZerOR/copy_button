import assert from 'node:assert/strict';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
const { chromium } = await import(process.env.BC_PLAYWRIGHT || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'test-results');
await mkdir(output, { recursive: true });
await mkdir(path.join(root, '.impeccable', 'review'), { recursive: true });
const extension = path.join(output, 'extension');
await cp(path.join(root, 'extension'), extension, { recursive: true });
const manifestPath = path.join(extension, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
// Test-only host access substitutes for the toolbar's real activeTab user grant.
manifest.host_permissions = ['http://127.0.0.1/*'];
await writeFile(manifestPath, JSON.stringify(manifest));
const fixture = await readFile(path.join(root, 'tests', 'fixtures.html'));
let exportedHtml = '';
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' }); response.end(request.url === '/export' ? exportedHtml : fixture);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const context = await chromium.launchPersistentContext(path.join(output, `profile-${Date.now()}`), {
  headless: true,
  executablePath: process.env.BC_BROWSER || undefined,
  channel: process.env.BC_BROWSER ? undefined : 'chromium',
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  viewport: { width: 1440, height: 960 },
  acceptDownloads: true
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  await worker.evaluate(() => chrome.storage.local.clear());
  const library = await context.newPage();
  const errors = [];
  library.on('pageerror', e => errors.push(e.message));
  library.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await library.goto(`chrome-extension://${id}/library.html`);
  await library.locator('#empty-choose').waitFor();
  assert.equal(await library.locator('#total').textContent(), '0');
  const page = await context.newPage(); await page.goto(origin);
  const cdp = await context.newCDPSession(page);
  async function clickPicker(buttonId) {
    const doc = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    function find(node) {
      if (node.nodeName === 'BUTTON' && node.attributes?.some((x, i, a) => x === 'id' && a[i + 1] === buttonId)) return node;
      for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) { const match = find(child); if (match) return match; }
    }
    const node = find(doc.root); assert.ok(node, `Picker button ${buttonId} is present`);
    const { model } = await cdp.send('DOM.getBoxModel', { nodeId: node.nodeId });
    await page.mouse.click((model.content[0] + model.content[4]) / 2, (model.content[1] + model.content[5]) / 2);
  }
  async function pick(selector) {
    const before = await worker.evaluate(async () => (await chrome.storage.local.get('captures')).captures?.length || 0);
    const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(t => t.url?.startsWith(url)).id, origin);
    const result = await library.evaluate(tabId => chrome.runtime.sendMessage({ type: 'START_CAPTURE', tabId }), tabId);
    assert.equal(result.ok, true, result.error);
    await page.locator(selector).click({ force: true });
    await clickPicker('save');
    await library.waitForFunction(n => Number(document.querySelector('#total').textContent) === n, before + 1);
    await clickPicker('close');
  }
  await pick('#forest');
  const stored = await worker.evaluate(async () => (await chrome.storage.local.get('captures')).captures);
  assert.equal(stored.length, 1); assert.ok(stored[0].states.includes('hover')); assert.ok(stored[0].states.includes('active'));
  assert.equal(await page.locator('#actions').textContent(), '0', 'Picker must not run original website click handlers');
  await library.locator('.card-info').first().click();
  const frame = library.frameLocator('#detail-preview iframe');
  await frame.locator('button').waitFor({ timeout: 10000 });
  const properties = ['backgroundColor', 'color', 'borderRadius', 'paddingTop', 'paddingLeft', 'fontSize', 'fontWeight', 'width', 'height'];
  const sourceStyle = await page.locator('#forest').evaluate((el, props) => Object.fromEntries(props.map(p => [p, getComputedStyle(el)[p]])), properties);
  const copyStyle = await frame.locator('button').evaluate((el, props) => Object.fromEntries(props.map(p => [p, getComputedStyle(el)[p]])), properties);
  assert.deepEqual(copyStyle, sourceStyle, 'Default button styles must match the source');
  await library.locator('#states button').filter({ hasText: /^Hover$/ }).click();
  await page.locator('#forest').hover();
  await page.waitForTimeout(250);
  const sourceHover = await page.locator('#forest').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, transform: getComputedStyle(el).transform }));
  const copyHover = await frame.locator('button').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, transform: getComputedStyle(el).transform }));
  assert.deepEqual(copyHover, sourceHover, 'Hover style and transform must match');
  const sourceDocument = await cdp.send('DOM.getDocument');
  const forestNode = await cdp.send('DOM.querySelector', { nodeId: sourceDocument.root.nodeId, selector: '#forest' });
  await cdp.send('CSS.enable');
  await cdp.send('CSS.forcePseudoState', { nodeId: forestNode.nodeId, forcedPseudoClasses: ['hover', 'active'] });
  await library.bringToFront();
  await library.locator('#states button').filter({ hasText: /^Pressed$/ }).click();
  await library.waitForTimeout(250);
  assert.deepEqual(await frame.locator('button').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, transform: getComputedStyle(el).transform })), await page.locator('#forest').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, transform: getComputedStyle(el).transform })));
  await cdp.send('CSS.forcePseudoState', { nodeId: forestNode.nodeId, forcedPseudoClasses: [] });
  await page.locator('#forest').evaluate(el => el.disabled = true);
  await library.locator('#states button').filter({ hasText: /^Disabled$/ }).click();
  await frame.locator('button[data-bc-state="disabled"]').waitFor();
  assert.equal(await frame.locator('button').evaluate(el => getComputedStyle(el).opacity), '0.4');
  await page.locator('#forest').evaluate(el => el.disabled = false);
  await library.locator('#button-name').fill('Forest capture'); await library.locator('#rename').click();
  await library.waitForFunction(() => document.querySelector('.card-title').textContent === 'Forest capture');
  await library.locator('#close-detail').click();
  assert.equal(await library.evaluate(() => document.activeElement?.className), 'card-info', 'Closing details restores keyboard focus to the specimen');
  await pick('#outline'); await pick('#motion'); await pick('#js-motion'); await pick('#responsive');
  const all = await worker.evaluate(async () => (await chrome.storage.local.get('captures')).captures);
  assert.equal(all.length, 5);
  assert.ok(all.find(c => c.name === 'Explore collection').css.includes('::before'));
  assert.ok(all.find(c => c.name === 'Start exploring').css.includes('@keyframes'));
  assert.equal(all.find(c => c.name === 'JavaScript motion').animations.length, 1);
  assert.ok(all.find(c => c.name === 'Responsive button').css.includes('@media'));
  await library.locator('.card-info').filter({ hasText: 'Responsive button' }).click();
  await library.locator('#preview-width').selectOption('600');
  await page.setViewportSize({ width: 600, height: 960 });
  await page.waitForTimeout(100);
  const responsiveSource = await page.locator('#responsive').evaluate((el, props) => Object.fromEntries(props.map(p => [p, getComputedStyle(el)[p]])), properties);
  const responsiveCopy = await library.frameLocator('#detail-preview iframe').locator('button').evaluate((el, props) => Object.fromEntries(props.map(p => [p, getComputedStyle(el)[p]])), properties);
  assert.deepEqual(responsiveCopy, responsiveSource, 'Responsive media-query dimensions must match at 600px');
  await page.setViewportSize({ width: 1440, height: 960 }); await library.locator('#close-detail').click();
  await library.locator('#select-all').check();
  assert.equal(await library.locator('#selection-label').textContent(), '5 selected');
  const downloadPromise = library.waitForEvent('download'); await library.locator('#export-selected').click();
  const archive = await downloadPromise; await archive.saveAs(path.join(output, 'export.zip'));
  const zip = await readFile(path.join(output, 'export.zip'));
  const nameLength = zip.readUInt16LE(26), size = zip.readUInt32LE(18);
  exportedHtml = zip.subarray(30 + nameLength, 30 + nameLength + size).toString('utf8');
  const exported = await context.newPage(); await exported.goto(origin + '/export');
  assert.equal(await exported.locator('main button').count(), 5);
  const exportForest = exported.locator('button').filter({ hasText: 'Save to collection' });
  assert.deepEqual(await exportForest.evaluate((el, props) => Object.fromEntries(props.map(p => [p, getComputedStyle(el)[p]])), properties), sourceStyle, 'Exported HTML must preserve the original default styles');
  await exported.close();
  const backupPromise = library.waitForEvent('download'); await library.locator('#backup').click();
  await (await backupPromise).saveAs(path.join(output, 'backup.json'));
  const backup = JSON.parse(await readFile(path.join(output, 'backup.json'), 'utf8')); assert.equal(backup.captures.length, 5);
  await library.locator('#search').fill('Forest'); assert.equal(await library.locator('.button-card').count(), 1);
  await library.locator('#search').fill('nothing matches'); assert.equal(await library.locator('.button-card').count(), 0);
  await library.locator('#empty-choose').click(); assert.equal(await library.locator('.button-card').count(), 5);
  await library.locator('#select-all').uncheck();
  // Untrusted backup markup must never execute in preview or the exported HTML.
  const malicious = { app: 'button-copy', version: 1, captures: [{ ...all[0], name: 'Unsafe import', html: all[0].html + '<img src="x" onerror="parent.postMessage({pwned:true},\"*\")"><script>parent.postMessage({pwned:true},"*")</script>' }] };
  await library.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(malicious)) });
  await library.waitForFunction(() => Number(document.querySelector('#total').textContent) === 6);
  const imported = await worker.evaluate(async () => (await chrome.storage.local.get('captures')).captures[0]);
  assert.ok(!imported.html.includes('onerror')); assert.ok(!imported.html.includes('<script')); assert.notEqual(imported.scope, all[0].scope);
  await library.locator('.card-select input').first().check(); await library.locator('#delete-selected').click(); await library.locator('#confirm-delete').click();
  await library.waitForFunction(() => Number(document.querySelector('#total').textContent) === 5);
  await library.reload(); assert.equal(await library.locator('#total').textContent(), '5');
  await library.bringToFront();
  await library.locator('#grid iframe').evaluateAll(frames => frames.forEach(frame => frame.loading = 'eager'));
  for (let index = 0; index < await library.locator('#grid iframe').count(); index++) await library.locator('#grid iframe').nth(index).contentFrame().locator('[data-bc-root]').waitFor();
  await library.screenshot({ path: path.join(root, '.impeccable', 'review', 'desktop.png'), fullPage: true });
  await library.setViewportSize({ width: 900, height: 850 });
  await library.locator('.button-card').last().scrollIntoViewIfNeeded();
  await library.locator('#grid iframe').last().contentFrame().locator('button').waitFor({ state: 'visible' });
  await library.waitForTimeout(150);
  await library.evaluate(() => window.scrollTo(0, 0));
  await library.waitForTimeout(150);
  // Chromium full-page capture can omit an offscreen cross-process iframe's paint.
  // Include the document in the actual viewport for this whole-page evidence.
  const compactHeight = await library.evaluate(() => document.documentElement.scrollHeight);
  await library.setViewportSize({ width: 900, height: compactHeight });
  await library.waitForTimeout(150);
  await library.screenshot({ path: path.join(root, '.impeccable', 'review', 'compact-desktop.png'), fullPage: true });
  await library.setViewportSize({ width: 1440, height: 960 }); await library.locator('.card-info').filter({ hasText: 'Forest capture' }).click();
  await library.frameLocator('#detail-preview iframe').locator('button').waitFor();
  await library.screenshot({ path: path.join(root, '.impeccable', 'review', 'detail.png'), fullPage: true });
  const popup = await context.newPage(); await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.setViewportSize({ width: 352, height: 440 }); await popup.screenshot({ path: path.join(root, '.impeccable', 'review', 'popup.png') });
  assert.deepEqual(errors, [], 'Library and sandbox previews must have no script or CSP errors');
  const icon = await readFile(path.join(root, 'extension', 'icons', '48.png'));
  const assetServer = http.createServer((request, response) => {
    if (request.url === '/asset.png') { response.writeHead(200, { 'Content-Type': 'image/png' }); response.end(icon); }
    else { response.writeHead(200, { 'Content-Type': 'text/css' }); response.end('.remote{background:#223344 url("/asset.png") no-repeat right center;color:white;border:0;padding:12px 30px;border-radius:8px}.remote:hover{background-color:#445566}.remote img{width:20px;height:20px}'); }
  });
  await new Promise(resolve => assetServer.listen(0, '127.0.0.1', resolve));
  try {
    const assetOrigin = `http://127.0.0.1:${assetServer.address().port}`;
    await page.evaluate(url => {
      const sheet = document.createElement('link'); sheet.rel = 'stylesheet'; sheet.href = url + '/style.css'; document.head.append(sheet);
      const button = document.createElement('button'); button.className = 'remote'; button.id = 'remote';
      const image = document.createElement('img'); image.src = url + '/asset.png'; button.append(image, document.createTextNode('External asset')); document.body.append(button);
    }, assetOrigin);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#remote')).backgroundColor === 'rgb(34, 51, 68)');
    await pick('#remote');
    const embedded = await worker.evaluate(async () => (await chrome.storage.local.get('captures')).captures[0]);
    assert.ok(embedded.html.includes('data:image/png;base64,')); assert.ok(embedded.css.includes('data:image/png;base64,'));
    assert.equal(embedded.missingResources.length, 0); assert.equal(embedded.blockedStylesheets.length, 0);
    assert.ok(embedded.states.includes('hover'), 'Cross-origin stylesheet recovery must include interaction states');
    console.log('PASS: cross-origin stylesheet recovery and embedded image/background assets.');
  } finally { assetServer.close(); }
  console.log('PASS: actual Chromium extension capture, click suppression, exact fixture default/hover styles, pseudo-elements, keyframes, Web Animations, responsive rules, persistence, rename, search, bulk ZIP, backup, sanitized import, deletion, and isolated preview.');
} finally { await context.close(); server.close(); }
