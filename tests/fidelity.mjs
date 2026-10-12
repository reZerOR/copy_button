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
  { name: 'Invalid inherited variables retain gradient fallbacks', css: 'html{--rim:var(--absent)}.test{--tone:rgba(255,255,255,.1);background:linear-gradient(var(--rim,var(--tone)),transparent 75%)}', markup: '<button class="test">Test</button>' },
  { name: 'Intentionally empty inherited variables remain empty', css: 'html{--rim:;}.test{background:linear-gradient(var(--rim,red),transparent 75%)}', markup: '<button class="test">Test</button>' },
  { name: 'Invalid inherited variables retain masked rim light', css: 'html{--rim:var(--absent)}.test{--tone:rgba(255,255,255,.1);position:relative;border-radius:20px;background:#292929}.rim{position:absolute;inset:0;border-radius:inherit}.rim::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:.5px;mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask-composite:exclude;background:linear-gradient(var(--rim,var(--tone)),transparent 75%)}', markup: '<button class="test">Test<span class="rim"></span></button>', inspect: '.rim', pseudo: '::before' },
  { name: 'Class light wash wins over a later element reset', css: '.test{position:relative}.wash{background:rgba(255,255,255,.05)}div{background:transparent}', markup: '<button class="test">Test<div class="wash">Light wash</div></button>', inspect: '.wash' },
  { name: 'Preview uses the source backdrop for translucent fills', css: 'body{background:#fff}.backdrop{background:#0f0f0f}.test{background:rgba(255,255,255,.1)}', markup: '<div class="backdrop"><button class="test">Test</button></div>', backdrop: 'rgb(15, 15, 15)' },
  { name: 'Source backdrop composites transparent ancestor colors', css: 'body{background:#000}.backdrop{background:rgba(255,255,255,.1)}.test{background:rgba(255,255,255,.1)}', markup: '<div class="backdrop"><button class="test">Test</button></div>', backdrop: 'rgb(26, 26, 26)' },
  { name: 'Pseudo-elements inherit hover variables', css: '.test{--fill:linear-gradient(red,blue)}.test::before{content:"";display:block;width:20px;height:20px;background:var(--fill)}.test:hover{--fill:linear-gradient(green,yellow)}', markup: '<button class="test">Test</button>', pseudo: '::before' },
  { name: 'Children inherit hover variables', css: '.test{--fill:linear-gradient(red,blue)}.test span{display:block;background:var(--fill)}.test:hover{--fill:linear-gradient(green,yellow)}', markup: '<button class="test"><span>Test</span></button>', inspect: '.test span' },
  { name: 'Containing open shadow stylesheet preserves hover', css: '', markup: '<div id="host"></div>', shadow: '.test{background:red}.test:hover{background:linear-gradient(green,yellow);box-shadow:0 4px 12px black}' },
  { name: 'Layered hover rules override computed defaults', css: '@layer utilities{.test{background:red}.test:hover{background:green;box-shadow:0 4px 12px black}}', markup: '<button class="test">Test</button>' },
  { name: 'Nested hover rules are captured', css: '.test{background:red;&:hover{background:green;box-shadow:0 4px 12px black}}', markup: '<button class="test">Test</button>' },
  { name: 'Layer ordering survives source traversal order', css: '@layer strong,weak;@layer weak{.test:hover{background:blue}}@layer strong{.test{background:red}.test:hover{background:green}}', markup: '<button class="test">Test</button>' },
  { name: 'Nested hover inside a media query is captured', css: '@layer utilities{.test{background:red;@media(hover:hover){&:hover{background:green}}}}', markup: '<button class="test">Test</button>' },
  { name: 'Nested declarations retain their source order', css: '.test{background:red;&{background:green}background:blue;}', markup: '<button class="test">Test</button>' },
  { name: 'Anonymous layers retain priority within their block', css: '@layer{.test:hover{background:green}.test{background:red}}', markup: '<button class="test">Test</button>' }
];
let failures = 0;
try {
  const selectedCases = process.argv[2] ? cases.filter(item => item.name.includes(process.argv[2])) : cases;
  assert.ok(selectedCases.length, 'The selected fidelity case exists');
  for (const item of selectedCases) {
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
      if (item.backdrop) assert.equal(capture.background, item.backdrop, 'Captured source backdrop');
      await copy.setContent(standaloneHtml([capture]));
      if (item.backdrop) assert.equal(await copy.locator('.source-stage').evaluate(el => getComputedStyle(el).backgroundColor), item.backdrop, 'Source backdrop in exported preview');
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
      if (item.backdrop) assert.equal(await copy.evaluate(() => getComputedStyle(document.body).backgroundColor), item.backdrop, 'Source backdrop in preview');
      await copy.evaluate(() => window.postMessage({ buttonCopy: true, action: 'state', state: 'hover' }, '*'));
      await copy.locator('.test[data-bc-state="hover"]').waitFor();
      assert.deepEqual(await copy.locator(inspect).evaluate(styles, item.pseudo), expected, 'Forced hover preview');
      console.log(`PASS: ${item.name}`);
    } catch (error) { failures++; console.error(`FAIL: ${item.name}\n${error.message}`); }
    finally { await page.close(); await copy.close(); }
  }
} finally { await browser.close(); server.close(); }
if (failures) process.exitCode = 1;
