if (typeof importScripts === 'function') importScripts('lib/api.js');
const api = globalThis.BC_API || globalThis.browser || globalThis.chrome;
let writeQueue = Promise.resolve();
const MAX_ASSET = 5 * 1024 * 1024;
const MAX_CAPTURE = 20 * 1024 * 1024;

function serial(task) {
  const next = writeQueue.then(task, task);
  writeQueue = next.catch(() => {});
  return next;
}

async function readLimited(url, textOnly = false) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported resource URL');
  const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(8000), redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_ASSET) throw new Error('Resource exceeds 5 MB');
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_ASSET) { await reader.cancel(); throw new Error('Resource exceeds 5 MB'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if (textOnly) return new TextDecoder().decode(bytes);
  const mime = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
  if (!/^(image\/|font\/|application\/(font|x-font|vnd\.ms-fontobject|octet-stream))/.test(mime)) throw new Error('Resource is not an image or font');
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${mime};base64,${btoa(binary)}`;
}

async function embedAssets(capture) {
  const missing = [];
  let size = capture.html.length + capture.css.length;
  const results = await Promise.all((capture.resources || []).slice(0, 64).map(async url => {
    try { return [url, await readLimited(url)]; }
    catch (error) { missing.push({ url, reason: error.message }); return [url, null]; }
  }));
  for (const [url, data] of results) {
    if (!data) continue;
    const css = capture.css.split(url).join(data);
    const html = capture.html.split(url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')).join(data);
    if (css.length + html.length > MAX_CAPTURE) { missing.push({ url, reason: 'Capture asset budget of 20 MB reached' }); continue; }
    // Resource URLs in markup are HTML escaped; CSS strings are not.
    capture.css = css;
    capture.html = html;
    size = css.length + html.length;
  }
  capture.missingResources = missing;
  capture.warnings = (capture.warnings || []).filter(w => !w.startsWith('External assets:'));
  if (missing.length) capture.warnings.push(`External assets: ${missing.length} image or font resource(s) could not be embedded. Export still depends on those URLs. Use Allow resources and retry, or recapture after allowing access.`);
  return capture;
}

async function startCapture(tabId) {
  const tab = await api.tabs.get(tabId);
  if (!/^https?:\/\//.test(tab.url || '')) throw new Error('Open a regular http or https website to choose a button. Browser settings, store pages, and local files are unavailable.');
  await api.scripting.executeScript({ target: { tabId }, files: ['lib/api.js', 'capture.js'] });
  return { ok: true };
}

async function handle(message, sender) {
  const fromExtension = sender.id === api.runtime.id && Boolean(sender.url?.startsWith(api.runtime.getURL('')));
  const fromPage = Boolean(sender.tab) && !fromExtension;
  if (!fromPage && !fromExtension) throw new Error('Unknown sender');
  if (message.type === 'FETCH_STYLES' && fromPage) {
    const urls = [...new Set(message.urls || [])].slice(0, 24);
    return { sheets: await Promise.all(urls.map(async url => {
      try { return { url, text: await readLimited(url, true) }; }
      catch (error) { return { url, error: error.message }; }
    })) };
  }
  if (message.type === 'SAVE_CAPTURE' && fromPage) {
    const c = message.capture;
    if (!c || typeof c.html !== 'string' || typeof c.css !== 'string' || c.html.length + c.css.length > MAX_CAPTURE) throw new Error('Capture is missing or too large');
    c.id = crypto.randomUUID();
    c.createdAt = new Date().toISOString();
    c.sourceUrl = sender.tab.url;
    c.sourceTitle = sender.tab.title || '';
    await embedAssets(c);
    await serial(async () => {
      const store = await api.storage.local.get('captures');
      await api.storage.local.set({ captures: [c, ...(store.captures || [])] });
    });
    return { ok: true, id: c.id, warningCount: c.warnings.length };
  }
  if (message.type === 'OPEN_LIBRARY') {
    const url = api.runtime.getURL('library.html');
    const tabs = await api.tabs.query({});
    const existing = tabs.find(t => t.url === url);
    if (existing) { await api.tabs.update(existing.id, { active: true }); await api.windows.update(existing.windowId, { focused: true }); }
    else await api.tabs.create({ url });
    return { ok: true };
  }
  if (!fromExtension) throw new Error('Action is only available from the extension');
  if (message.type === 'START_CAPTURE') return startCapture(message.tabId);
  if (message.type === 'UPDATE_CAPTURE') return serial(async () => {
    const store = await api.storage.local.get('captures');
    const captures = store.captures || [];
    const c = captures.find(x => x.id === message.id);
    if (!c) throw new Error('This button is no longer in your library');
    c.name = String(message.name || '').trim().slice(0, 100) || 'Untitled button';
    await api.storage.local.set({ captures });
    return { ok: true };
  });
  if (message.type === 'DELETE_CAPTURES') return serial(async () => {
    const store = await api.storage.local.get('captures');
    const ids = new Set(message.ids || []);
    await api.storage.local.set({ captures: (store.captures || []).filter(x => !ids.has(x.id)) });
    return { ok: true };
  });
  if (message.type === 'RETRY_ASSETS') return serial(async () => {
    const store = await api.storage.local.get('captures');
    const c = (store.captures || []).find(x => x.id === message.id);
    if (!c) throw new Error('Button not found');
    c.resources = (c.missingResources || []).map(x => x.url);
    await embedAssets(c);
    await api.storage.local.set({ captures: store.captures });
    return { ok: true };
  });
  if (message.type === 'IMPORT_CAPTURES') return serial(async () => {
    const incoming = message.captures;
    if (!Array.isArray(incoming) || incoming.length > 500) throw new Error('A backup can contain up to 500 buttons');
    const clean = incoming.map(c => {
      if (c.version !== 1 || typeof c.html !== 'string' || typeof c.css !== 'string' || !/^bc-[a-z0-9-]+$/i.test(c.scope) || c.html.length + c.css.length > MAX_CAPTURE) throw new Error('Invalid button backup');
      const scope = `bc-${crypto.randomUUID()}`;
      const animations = (Array.isArray(c.animations) ? c.animations : []).filter(a => /^\d+$/.test(String(a.node)) && Array.isArray(a.keyframes) && a.keyframes.length <= 500 && a.timing && typeof a.timing === 'object').slice(0, 160);
      return { ...c, scope, html: c.html.split(c.scope).join(scope), css: c.css.split(c.scope).join(scope), id: crypto.randomUUID(), name: String(c.name || 'Imported button').slice(0, 100), warnings: [...(Array.isArray(c.warnings) ? c.warnings.map(String) : []), 'Imported capture: review its code before using it in a project.'], animations, imported: true };
    });
    const store = await api.storage.local.get('captures');
    await api.storage.local.set({ captures: [...clean, ...(store.captures || [])] });
    return { ok: true, count: clean.length };
  });
  throw new Error('Unknown action');
}

api.runtime.onMessage.addListener((message, sender, respond) => {
  handle(message, sender).then(respond).catch(error => respond({ ok: false, error: error.message }));
  return true;
});
