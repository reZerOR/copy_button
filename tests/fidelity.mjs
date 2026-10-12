import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
const { chromium } = await import(process.env.BC_PLAYWRIGHT || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.BC_BROWSER || undefined, headless: true });
const server = http.createServer((request, response) => { response.end('<!doctype html><title>Capture fidelity</title>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const captureCode = await readFile(new URL('../extension/capture.js', import.meta.url), 'utf8');
const previewCode = await readFile(new URL('../extension/preview.js', import.meta.url), 'utf8');
const { standaloneHtml } = await import('../extension/lib/export.js');
const cases = [
  { name: 'Hover variables preserve gradient and shadow', css: '.test{--fill:linear-gradient(red,blue);--shadow:none;background:var(--fill);box-shadow:var(--shadow)}.test:hover{--fill:linear-gradient(green,yellow);--shadow:0 4px 12px black}', markup: '<button class="test">Test</button>' },
  { name: 'Functional state selectors preserve hover', css: '.test{background:red}:is(.test:hover,.test:focus-visible){background:green;box-shadow:0 4px 12px black}', markup: '<button class="test">Test</button>' },
  { name: 'Functional selectors preserve type intersections', css: '.test{background:red}button:is(button:hover,a:focus-visible){background:green;box-shadow:0 4px 12px black}', markup: '<button class="test">Test</button>' },
  { name: 'State-only where alternatives preserve hover', css: '.test{background:red}.test:where(:hover,:focus-visible){background:green;box-shadow:0 4px 12px black}', markup: '<button class="test">Test</button>' },
  { name: 'Nested variable fallback preserves gradient', css: '.test{background:red}.test:hover{background:var(--missing,linear-gradient(green,yellow));box-shadow:var(--missing-shadow,0 4px 12px black)}', markup: '<button class="test">Test</button>' },
  { name: 'Pseudo-elements inherit hover variables', css: '.test{--fill:linear-gradient(red,blue)}.test::before{content:"";display:block;width:20px;height:20px;background:var(--fill)}.test:hover{--fill:linear-gradient(green,yellow)}', markup: '<button class="test">Test</button>', pseudo: '::before' },
  { name: 'Children inherit hover variables', css: '.test{--fill:linear-gradient(red,blue)}.test span{display:block;background:var(--fill)}.test:hover{--fill:linear-gradient(green,yellow)}', markup: '<button class="test"><span>Test</span></button>', inspect: '.test span' },
  { name: 'Containing open shadow stylesheet preserves hover', css: '', markup: '<div id="host"></div>', shadow: '.test{background:red}.test:hover{background:linear-gradient(green,yellow);box-shadow:0 4px 12px black}' }
];
let failures = 0;
try {
  for (const item of cases) {
    const page = await browser.newPage();
    const copy = await browser.newPage();
    try {
      await page.goto(origin); await copy.goto(origin);
      await page.setContent(`<style>${item.css}</style>${item.markup}`);
      if (item.shadow) await page.evaluate(css => { const root = document.querySelector('#host').attachShadow({mode:'open'}); root.innerHTML = `<style>${css}</style><button class="test">Test</button>`; }, item.shadow);
      // Expose the real capture function only in this harness. No production test API.
      await page.evaluate(() => { globalThis.BC_API = { runtime: { sendMessage: async () => ({ sheets: [] }) } }; });
      await page.evaluate(captureCode.replace('globalThis.__buttonCopyPicker = { restart };', 'globalThis.__buttonCopyPicker = { restart, capture };').replace(/  restart\(\);\s*\}\)\(\);\s*$/, '})();'));
      const capture = await page.locator('.test').evaluate(el => globalThis.__buttonCopyPicker.capture(el));
      await copy.setContent(standaloneHtml([capture]));
      const inspect = item.inspect || '.test';
      const styles = (el, pseudo) => Object.fromEntries(['backgroundImage','backgroundColor','boxShadow'].map(prop => [prop, getComputedStyle(el, pseudo)[prop]]));
      assert.deepEqual(await copy.locator(inspect).evaluate(styles, item.pseudo), await page.locator(inspect).evaluate(styles, item.pseudo), 'Default appearance');
      await page.locator('.test').hover(); await copy.locator('.test').hover();
      const expected = await page.locator(inspect).evaluate(styles, item.pseudo);
      assert.deepEqual(await copy.locator(inspect).evaluate(styles, item.pseudo), expected, 'Hover appearance');
      await copy.setContent('<div id="mount"></div>');
      await copy.addScriptTag({ content: previewCode });
      await copy.evaluate(capture => window.postMessage({ buttonCopy: true, action: 'render', capture }, '*'), capture);
      await copy.locator('.test').waitFor();
      await copy.evaluate(() => window.postMessage({ buttonCopy: true, action: 'state', state: 'hover' }, '*'));
      await copy.locator('.test[data-bc-state="hover"]').waitFor();
      assert.deepEqual(await copy.locator(inspect).evaluate(styles, item.pseudo), expected, 'Forced hover preview');
      console.log(`PASS: ${item.name}`);
    } catch (error) { failures++; console.error(`FAIL: ${item.name}\n${error.message}`); }
    finally { await page.close(); await copy.close(); }
  }
} finally { await browser.close(); server.close(); }
if (failures) process.exitCode = 1;
