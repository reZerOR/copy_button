import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, zipBytes, animationScript, exportFiles, standaloneHtml } from '../extension/lib/export.js';
import { safeCss, safeJson } from '../extension/lib/security.js';
const sample = { scope: 'bc-test', name: '<script>alert(1)</script>', html: '<div data-bc-root="bc-test"><button>Save</button></div>', css: '[data-bc-root="bc-test"] button{color:red}', warnings: ['<img src=x onerror=alert(1)>'], animations: [{ node: '0', keyframes: [{ opacity: 0 }, { opacity: 1 }], timing: { duration: 200, iterations: 'Infinity' } }] };
test('ZIP preserves binary assets, UTF-8 filenames, and verified CRCs', () => {
  const payload = new Uint8Array([0, 255, 128, 12]);
  const bytes = zipBytes([{ name: '图标.png', data: payload }, { name: 'index.html', data: 'Hello' }]);
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  const nameLength = view.getUint16(26, true);
  const data = bytes.slice(30 + nameLength, 30 + nameLength + view.getUint32(18, true));
  assert.deepEqual(data, payload);
  assert.equal(view.getUint32(14, true), crc32(data));
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 12, true), 2);
});
test('standalone export encodes untrusted names, notes, CSS and animation data', () => {
  const c = { ...sample, css: 'button::before{content:"</style><script>alert(9)</script>"}', animations: [{ ...sample.animations[0], keyframes: [{ content: '</script><script>alert(9)</script>' }] }] };
  const html = standaloneHtml([c]);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.equal((html.match(/<script>/g) || []).length, 1);
  assert.equal((html.match(/<\/style>/g) || []).length, 1);
  assert.ok(!animationScript([c]).includes('</script>'));
  assert.equal(safeCss('<'), '\\3c ');
  assert.equal(safeJson('<'), '"\\u003c"');
});
test('multi-button export keeps each component separate and all capture notes', () => {
  const files = exportFiles([sample, { ...sample, scope: 'bc-two', name: 'Second' }]);
  assert.equal(files.length, 10);
  assert.ok(files.some(f => f.name.endsWith('/capture-notes.json')));
  assert.ok(files[0].data.includes('bc-two'));
  assert.ok(animationScript([sample]).includes("=== 'Infinity' ? Infinity"));
});
