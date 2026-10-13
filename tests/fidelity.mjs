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
  { name: 'Inherited typography survives button font resets', css: 'body{font-family:Georgia;font-size:17px;font-weight:600;line-height:1.4;color:purple}@layer base{button{font:inherit;color:inherit}}', markup: '<button class="test">Share</button>', properties: ['fontFamily','fontSize','fontWeight','lineHeight','color'] },
  { name: 'Inline fills survive layered button resets', css: '@layer base{button{background-color:transparent}}@layer utilities{.test{display:inline-flex}}', markup: '<button class="test" style="background-color:rebeccapurple;display:flex">Upgrade</button>', properties: ['backgroundColor','display'] },
  { name: 'Inline variables still drive hover on effect layers', css: '@layer base{button{background:transparent}}.test{--fill:red}.test:hover{--fill:green}', markup: '<button class="test" style="background:var(--fill)">Upgrade<span style="background:var(--fill)">Effect</span></button>', inspect: '.test span' },
  { name: 'Inline SVG paint references remain scoped', css: '', markup: '<button class="test"><svg width="20" height="20"><defs><linearGradient id="paint"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect width="20" height="20" style="fill:url(\'#paint\')"/></svg></button>', localPaint: true },
  { name: 'Inline CSS animation names remain scoped', css: '@keyframes inline-pulse{from{opacity:.5}to{opacity:1}}', markup: '<button class="test" style="animation:inline-pulse 2s infinite">Test</button>', inlineAnimation: true },
  { name: 'Important inline page positioning is normalized for reuse', css: '', markup: '<button class="test" style="position:fixed!important;left:100px!important;top:100px!important;background:red">Test</button>', normalizedPosition: true },
  { name: 'Wide external container keeps toolbar icons hidden', css: '.toolbar{container-type:inline-size;width:900px}.icon{display:block}@container(width >= 768px){.icon{display:none}}', markup: '<div class="toolbar"><button class="test">Publish<span class="icon">Icon</span></button></div>', inspect: '.icon', properties: ['display'] },
  { name: 'Narrow external container keeps toolbar icons visible', css: '.toolbar{container-type:inline-size;width:500px}.icon{display:block}@container(width >= 768px){.icon{display:none}}', markup: '<div class="toolbar"><button class="test">Publish<span class="icon">Icon</span></button></div>', inspect: '.icon', properties: ['display'] },
  { name: 'Named external containers preserve independent query contexts', css: '.outer{container:outer / inline-size;width:1000px}.inner{container:inner / inline-size;width:500px}.icon{display:block;background:red}@container outer (width >= 768px){.icon{background:green}}@container inner (width >= 768px){.icon{display:none}}', markup: '<div class="outer"><div class="inner"><button class="test">Publish<span class="icon">Icon</span></button></div></div>', inspect: '.icon', properties: ['display','backgroundColor'] },
  { name: 'Overlapping decorative sibling retains selected tab pill', css: '.tabs{position:relative;display:inline-block}.test{position:relative;z-index:1;width:90px;height:28px;background:transparent;border:0}.pill{position:absolute;inset:0;pointer-events:none;background:blue;border-radius:999px;box-shadow:inset 0 0 0 1px cyan}', markup: '<div class="tabs"><span class="pill" aria-hidden="true"></span><button class="test" role="tab" aria-selected="true">Preview</button></div>', inspect: '.pill' },
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
    page.setDefaultTimeout(3000); copy.setDefaultTimeout(3000);
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
      if (item.localPaint) assert.equal(await copy.locator('rect').evaluate(el => { const id = el.style.fill.match(/#([^"')]+)/)?.[1]; return !!id && !!document.getElementById(id); }), true, 'Inline paint points to the copied gradient');
      if (item.inlineAnimation) assert.equal(await copy.locator('.test').evaluate(el => el.getAnimations().some(a => a.animationName?.startsWith('bc-'))), true, 'Inline animation uses the scoped keyframes');
      if (item.normalizedPosition) assert.equal(await copy.locator('.test').evaluate(el => getComputedStyle(el).position), 'relative', 'Inline positioning cannot pin the exported button to the page');
      if (item.inspect === '.pill') {
        const offset = el => { const r = el.getBoundingClientRect(), b = document.querySelector('.test').getBoundingClientRect(); return [r.left-b.left,r.top-b.top,r.width,r.height]; };
        assert.deepEqual(await copy.locator('.pill').evaluate(offset), await page.locator('.pill').evaluate(offset), 'Decoration stays aligned with the selected button');
      }
      if (item.backdrop) assert.equal(await copy.locator('.source-stage').evaluate(el => getComputedStyle(el).backgroundColor), item.backdrop, 'Source backdrop in exported preview');
      const inspect = item.inspect || '.test';
      const styles = (el, options) => Object.fromEntries(options.properties.map(prop => [prop, getComputedStyle(el, options.pseudo)[prop]]));
      const options = { pseudo: item.pseudo, properties: item.properties || ['backgroundImage','backgroundColor','boxShadow'] };
      assert.deepEqual(await copy.locator(inspect).evaluate(styles, options), await page.locator(inspect).evaluate(styles, options), 'Default appearance');
      await page.locator('.test').hover(); await copy.locator('.test').hover();
      const expected = await page.locator(inspect).evaluate(styles, options);
      assert.deepEqual(await copy.locator(inspect).evaluate(styles, options), expected, 'Hover appearance');
      await copy.setContent('<div id="mount"></div>');
      await copy.addScriptTag({ content: previewCode });
      await copy.evaluate(capture => window.postMessage({ buttonCopy: true, action: 'render', capture }, '*'), capture);
      await copy.locator('.test').waitFor();
      if (item.backdrop) assert.equal(await copy.evaluate(() => getComputedStyle(document.body).backgroundColor), item.backdrop, 'Source backdrop in preview');
      await copy.evaluate(() => window.postMessage({ buttonCopy: true, action: 'state', state: 'hover' }, '*'));
      await copy.locator('.test[data-bc-state="hover"]').waitFor();
      assert.deepEqual(await copy.locator(inspect).evaluate(styles, options), expected, 'Forced hover preview');
      console.log(`PASS: ${item.name}`);
    } catch (error) { failures++; console.error(`FAIL: ${item.name}\n${error.message}`); }
    finally { await page.close(); await copy.close(); }
  }
} finally { await browser.close(); server.close(); }
if (failures) process.exitCode = 1;
