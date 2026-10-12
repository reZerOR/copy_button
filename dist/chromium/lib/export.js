import { escapeHtml, safeCss, safeJson } from './security.js';

export function slug(name) {
  return String(name).normalize('NFKD').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60).toLowerCase() || 'button';
}

export function animationScript(captures) {
  const items = captures.map(c => ({ scope: c.scope, animations: c.animations || [] }));
  return `// Only captured Web Animations data is replayed. Website handlers are excluded.\nconst captures = ${safeJson(items)};\nfor (const capture of captures) {\n  const root = document.querySelector('[data-bc-root="' + capture.scope + '"]');\n  if (!root) continue;\n  for (const item of capture.animations) {\n    const node = root.querySelector('[data-bc-node="' + item.node + '"]');\n    if (!node || !Array.isArray(item.keyframes)) continue;\n    try { node.animate(item.keyframes, { ...item.timing, iterations: item.timing.iterations === 'Infinity' ? Infinity : item.timing.iterations }); } catch (error) { console.warn('Animation could not replay', error); }\n  }\n}\n`;
}

export function standaloneHtml(captures, cleanHtml = c => c.html) {
  const css = captures.map(c => c.css).join('\n');
  const markup = captures.map(c => {
    const backdrop = typeof c.background === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d., %]+\)|transparent)$/i.test(c.background) ? c.background : '#111713';
    return `<section class="export-item"><h2>${escapeHtml(c.name)}</h2><div class="source-stage" style="background:${escapeHtml(backdrop)};display:inline-block;padding:16px;border-radius:8px">${cleanHtml(c)}</div>${c.warnings?.length ? `<details><summary>Capture notes</summary><ul>${c.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></details>` : ''}</section>`;
  }).join('\n');
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Exported buttons</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: https: http:; font-src data: https: http:; connect-src 'none'; base-uri 'none'; form-action 'none'"><style>body{margin:0;background:#111713;color:#e7f0ea;font:14px/1.6 system-ui;padding:40px}main{display:flex;gap:36px;flex-wrap:wrap}.export-item{min-width:200px;padding:24px;border:1px solid #39473e;border-radius:12px}h2{font:500 15px/1.4 system-ui;margin:0 0 28px}details{font:12px/1.6 system-ui;color:#b6c7bc;max-width:50ch;margin-top:28px}summary{cursor:pointer}\n${safeCss(css)}\n</style></head><body><main>${markup}</main><script>${animationScript(captures)}</script></body></html>`;
}

export function exportFiles(captures, cleanHtml = c => c.html) {
  const files = [{ name: 'index.html', data: standaloneHtml(captures, cleanHtml) }];
  captures.forEach((c, i) => {
    const prefix = `buttons/${String(i + 1).padStart(2, '0')}-${slug(c.name)}`;
    files.push({ name: `${prefix}/button.html`, data: cleanHtml(c) });
    files.push({ name: `${prefix}/button.css`, data: c.css });
    files.push({ name: `${prefix}/button.js`, data: animationScript([c]) });
    files.push({ name: `${prefix}/capture-notes.json`, data: JSON.stringify({ name: c.name, sourceUrl: c.sourceUrl, capturedAt: c.capturedAt, dimensions: c.dimensions, states: c.states, warnings: c.warnings, missingResources: c.missingResources }, null, 2) });
  });
  files.push({ name: 'README.txt', data: 'Open index.html to preview all exported buttons. Each buttons/ folder contains reusable markup, stylesheet, and animation replay JavaScript. Add the HTML to your document, link the CSS, and load the JavaScript after the markup. Capture notes describe fidelity limits and external dependencies. No original website scripts or click actions are included.\n' });
  return files;
}

// ZIP "store" format: standards-compliant archive with UTF-8 names and CRC-32.
const table = Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes) {
  let c = 0xffffffff; for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function zipBytes(files) {
  const encoder = new TextEncoder(), parts = [], directory = [];
  let offset = 0, dirSize = 0;
  for (const file of files) {
    const name = encoder.encode(file.name), data = file.data instanceof Uint8Array ? file.data : encoder.encode(file.data), crc = crc32(data);
    const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(12, 33, true); lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, name.length, true); local.set(name, 30);
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint16(14, 33, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); central.set(name, 46);
    parts.push(local, data); directory.push(central); offset += local.length + data.length; dirSize += central.length;
  }
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, dirSize, true); ev.setUint32(16, offset, true);
  const result = new Uint8Array(offset + dirSize + 22);
  let position = 0; for (const part of [...parts, ...directory, end]) { result.set(part, position); position += part.length; }
  return result;
}

export function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
