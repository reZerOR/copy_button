import { sanitizeMarkup } from './lib/security.js';
import { animationScript, standaloneHtml, exportFiles, zipBytes, download, slug } from './lib/export.js';
const api = globalThis.BC_API;
const $ = selector => document.querySelector(selector);
let captures = [], selected = new Set(), filter = 'all', currentId = null, returnFocusId = null, codeType = 'html', pendingDelete = [], toastTimer;
const frames = new Map();
const hasMotion = c => (c.animations || []).length > 0 || /@(?:-webkit-)?keyframes\b/.test(c.css);
async function send(message) {
  const response = await api.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'The action could not be completed');
  return response;
}
function notify(message) {
  $('#toast').textContent = message; $('#toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 6000);
}
function attempt(action) { return async (...args) => { try { await action(...args); } catch (error) { notify(error.message); } }; }
function domain(c) { try { return new URL(c.sourceUrl).hostname; } catch { return 'Imported button'; } }
function current() { return captures.find(c => c.id === currentId); }
function visible() {
  const query = $('#search').value.trim().toLowerCase();
  const list = captures.filter(c => (!query || `${c.name} ${c.sourceUrl}`.toLowerCase().includes(query)) && (filter === 'all' || filter === 'motion' && hasMotion(c) || filter === 'notes' && c.warnings?.length));
  return list.sort((a, b) => $('#sort').value === 'name' ? a.name.localeCompare(b.name) : $('#sort').value === 'oldest' ? String(a.createdAt).localeCompare(String(b.createdAt)) : String(b.createdAt).localeCompare(String(a.createdAt)));
}
function post(frame, action, extra = {}) { frame?.contentWindow?.postMessage({ buttonCopy: true, action, ...extra }, '*'); }
function preview(c, title) {
  const frame = document.createElement('iframe');
  frame.title = title; frame.setAttribute('sandbox', 'allow-scripts');
  const width = Math.max(320, Math.min(3840, Number(c.dimensions?.viewportWidth) || 1440));
  frame.style.width = `${width}px`;
  // Previews have an opaque origin and no extension privileges.
  frame.src = api.runtime.getURL('preview.html');
  frame.loading = 'lazy';
  frames.set(frame, c);
  return frame;
}
window.addEventListener('message', event => {
  if (!event.data?.buttonCopy || event.data.action !== 'ready') return;
  for (const [frame, c] of frames) if (event.source === frame.contentWindow) post(frame, 'render', { capture: c });
});
function updateSelection() {
  $('#selection-label').textContent = `${selected.size} selected`;
  $('#export-selected').disabled = selected.size === 0; $('#delete-selected').disabled = selected.size === 0;
  const list = visible();
  $('#select-all').checked = list.length > 0 && list.every(c => selected.has(c.id));
  $('#select-all').indeterminate = list.some(c => selected.has(c.id)) && !$('#select-all').checked;
  for (const card of $('#grid').children) card.classList.toggle('card-selected', selected.has(card.dataset.id));
}
function render() {
  const grid = $('#grid');
  for (const [frame] of frames) if (!$('#detail-preview').contains(frame)) frames.delete(frame);
  grid.replaceChildren();
  const list = visible();
  $('#total').textContent = captures.length; $('#motion-count').textContent = captures.filter(hasMotion).length; $('#notes-count').textContent = captures.filter(c => c.warnings?.length).length;
  $('#visible-count').textContent = `${list.length} ${list.length === 1 ? 'button' : 'buttons'}`;
  $('#empty').hidden = list.length > 0;
  if (captures.length && !list.length) {
    $('#empty h2').textContent = 'No buttons match this view.'; $('#empty p').textContent = 'Try another name, website, or filter.'; $('#empty-choose').textContent = 'Clear search and filters';
  } else {
    $('#empty h2').textContent = 'A place for the buttons you find.'; $('#empty p').textContent = 'Open a website, choose a button, and save it here. You can test its states and export the code.'; $('#empty-choose').textContent = 'Choose your first button';
  }
  for (const c of list) {
    const card = document.createElement('article'); card.className = 'button-card'; card.dataset.id = c.id;
    const stage = document.createElement('div'); stage.className = 'card-preview';
    stage.append(preview(c, `${c.name} interactive preview`));
    const label = document.createElement('label'); label.className = 'card-select';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(c.id); checkbox.setAttribute('aria-label', `Select ${c.name}`);
    checkbox.onchange = () => { checkbox.checked ? selected.add(c.id) : selected.delete(c.id); updateSelection(); };
    label.append(checkbox); stage.append(label); card.append(stage);
    const info = document.createElement('button'); info.className = 'card-info'; info.setAttribute('aria-label', `View details for ${c.name}`);
    const title = document.createElement('span'); title.className = 'card-title'; title.textContent = c.name;
    const site = document.createElement('span'); site.className = 'card-domain'; site.textContent = domain(c);
    const bottom = document.createElement('span'); bottom.className = 'card-bottom';
    const pill = document.createElement('span'); pill.className = 'state-pill'; pill.textContent = hasMotion(c) ? 'Motion captured' : `${c.states?.length || 1} CSS state${c.states?.length === 1 ? '' : 's'}`;
    const note = document.createElement('span'); note.textContent = `${c.warnings?.length || 0} notes`;
    bottom.append(pill, note); info.append(title, site, bottom); info.onclick = () => openDetail(c.id); card.append(info); grid.append(card);
  }
  updateSelection();
}
function showCode() {
  const c = current(); if (!c) return;
  $('#code').textContent = codeType === 'html' ? sanitizeMarkup(c.html) : codeType === 'css' ? c.css : animationScript([c]);
}
function openDetail(id) {
  const c = captures.find(x => x.id === id); if (!c) return;
  currentId = id; returnFocusId = id; $('#detail').hidden = false; $('#button-name').value = c.name;
  $('#source').textContent = c.sourceUrl || 'Imported button';
  if (/^https?:\/\//.test(c.sourceUrl || '')) $('#source').href = c.sourceUrl;
  else $('#source').removeAttribute('href');
  for (const [frame] of frames) if ($('#detail-preview').contains(frame)) frames.delete(frame);
  $('#detail-preview').replaceChildren(preview(c, `${c.name} detailed interactive preview`));
  $('#preview-background').value = 'source';
  $('#preview-width').value = 'source';
  $('#states').replaceChildren();
  for (const state of ['default', 'hover', 'active', 'focus', 'focus-visible', 'disabled', 'checked']) {
    const button = document.createElement('button'); button.textContent = state === 'active' ? 'Pressed' : state === 'focus-visible' ? 'Keyboard focus' : state[0].toUpperCase() + state.slice(1);
    button.classList.toggle('selected', state === 'default'); button.setAttribute('aria-pressed', String(state === 'default'));
    button.onclick = () => {
      for (const item of $('#states').children) { item.classList.remove('selected'); item.setAttribute('aria-pressed', 'false'); }
      button.classList.add('selected'); button.setAttribute('aria-pressed', 'true'); post($('#detail-preview iframe'), 'state', { state });
    };
    $('#states').append(button);
  }
  $('#notes').replaceChildren();
  for (const warning of c.warnings || []) { const item = document.createElement('li'); item.textContent = warning; $('#notes').append(item); }
  $('#resources').hidden = !(c.missingResources?.length || c.blockedStylesheets?.length);
  showCode();
  $('#close-detail').focus();
}
function exportZip(list) {
  if (!list.length) return;
  download(list.length === 1 ? `${slug(list[0].name)}.zip` : 'button-copy-export.zip', zipBytes(exportFiles(list, c => sanitizeMarkup(c.html))), 'application/zip');
  notify(`Exported ${list.length} button${list.length === 1 ? '' : 's'} with code and capture notes.`);
}
async function load() {
  const store = await api.storage.local.get('captures'); captures = store.captures || [];
  selected = new Set([...selected].filter(id => captures.some(c => c.id === id)));
  render(); if (currentId && current()) openDetail(currentId); else $('#detail').hidden = true;
}
$('#search').addEventListener('input', render); $('#sort').onchange = render;
for (const button of document.querySelectorAll('[data-filter]')) button.onclick = () => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  render();
};
$('#select-all').onchange = event => { for (const c of visible()) event.target.checked ? selected.add(c.id) : selected.delete(c.id); render(); };
$('#export-selected').onclick = () => exportZip(captures.filter(c => selected.has(c.id)));
$('#export-one').onclick = () => exportZip([current()]);
$('#export-html').onclick = () => { const c = current(); download(`${slug(c.name)}.html`, standaloneHtml([c], x => sanitizeMarkup(x.html)), 'text/html'); };
$('#close-detail').onclick = () => {
  $('#detail').hidden = true; currentId = null;
  const card = [...$('#grid').children].find(el => el.dataset.id === returnFocusId);
  (card?.querySelector('.card-info') || $('#search')).focus();
};
document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (!$('#detail').hidden) $('#close-detail').click(); $('#target-list').hidden = true; } });
$('#rename').onclick = attempt(async () => { await send({ type: 'UPDATE_CAPTURE', id: currentId, name: $('#button-name').value }); notify('Button name saved.'); });
$('#button-name').addEventListener('keydown', event => { if (event.key === 'Enter') $('#rename').click(); });
for (const button of document.querySelectorAll('[data-code]')) button.onclick = () => {
  codeType = button.dataset.code;
  document.querySelectorAll('[data-code]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); }); showCode();
};
$('#copy-code').onclick = attempt(async () => { await navigator.clipboard.writeText($('#code').textContent); notify(`${codeType.toUpperCase()} copied.`); });
$('#replay').onclick = () => post($('#detail-preview iframe'), 'replay');
$('#preview-background').onchange = event => post($('#detail-preview iframe'), 'background', { color: event.target.value === 'source' ? current().background : event.target.value });
$('#preview-width').onchange = event => {
  const width = event.target.value === 'source' ? Number(current().dimensions?.viewportWidth) || 1440 : Number(event.target.value);
  $('#detail-preview iframe').style.width = `${Math.max(320, Math.min(3840, width))}px`;
};
$('#backup').onclick = () => { download('button-copy-backup.json', JSON.stringify({ app: 'button-copy', version: 1, captures }, null, 2), 'application/json'); notify('Local library backup saved.'); };
$('#import').onclick = () => $('#import-file').click();
$('#import-file').onchange = attempt(async event => {
  const file = event.target.files[0]; if (!file) return;
  if (file.size > 50 * 1024 * 1024) throw new Error('Choose a backup smaller than 50 MB');
  const data = JSON.parse(await file.text());
  if (data.app !== 'button-copy' || data.version !== 1) throw new Error('This is not a Button Copy backup');
  // Sanitize before storing, previewing, or exporting imported content.
  if (!Array.isArray(data.captures)) throw new Error('This backup does not contain a button list');
  for (const c of data.captures) c.html = sanitizeMarkup(c.html);
  const result = await send({ type: 'IMPORT_CAPTURES', captures: data.captures });
  notify(`Imported ${result.count} buttons.`); event.target.value = '';
});
$('#delete-selected').onclick = () => {
  pendingDelete = [...selected]; $('#delete-description').textContent = `Remove ${pendingDelete.length} button${pendingDelete.length === 1 ? '' : 's'} from this device? Back up your library first if you need to keep them.`; $('#delete-dialog').showModal();
};
$('#cancel-delete').onclick = () => $('#delete-dialog').close();
$('#confirm-delete').onclick = attempt(async () => { await send({ type: 'DELETE_CAPTURES', ids: pendingDelete }); $('#delete-dialog').close(); notify('Selected buttons deleted.'); });
$('#resources').onclick = attempt(async () => {
  const c = current();
  const urls = [...(c.missingResources || []).map(x => x.url), ...(c.blockedStylesheets || [])];
  const origins = [...new Set(urls.filter(url => /^https?:\/\//.test(url)).map(url => `${new URL(url).origin}/*`))];
  if (!origins.length) return;
  // The browser asks for these exact domains only after this explicit user action.
  const granted = await api.permissions.request({ origins });
  if (!granted) { notify('Access was declined. Your saved button is unchanged.'); return; }
  await send({ type: 'RETRY_ASSETS', id: c.id });
  notify(c.blockedStylesheets?.length ? 'Asset retry complete. Recapture the original button to recover previously unreadable stylesheet rules.' : 'Asset retry complete. Review the capture notes.');
});
$('#choose').onclick = attempt(async () => {
  if (!$('#target-list').hidden) { $('#target-list').hidden = true; return; }
  const tabs = (await api.tabs.query({})).filter(tab => /^https?:\/\//.test(tab.url || ''));
  $('#tabs').replaceChildren();
  for (const tab of tabs) {
    const button = document.createElement('button'); button.textContent = tab.title || tab.url; button.title = tab.url;
    button.onclick = attempt(async () => {
      // activeTab belongs to the toolbar action, not to arbitrary library tabs.
      // Request the chosen website origin so injection from the library is explicit.
      const origin = `${new URL(tab.url).origin}/*`;
      const granted = await api.permissions.request({ origins: [origin] });
      if (!granted) { notify('Open the extension toolbar on that website to choose a button without persistent access.'); return; }
      await send({ type: 'START_CAPTURE', tabId: tab.id });
      await api.tabs.update(tab.id, { active: true }); await api.windows.update(tab.windowId, { focused: true }); $('#target-list').hidden = true;
    });
    $('#tabs').append(button);
  }
  if (!tabs.length) { const p = document.createElement('p'); p.textContent = 'Open a website in another tab, then return here. Or use the toolbar icon on the website.'; $('#tabs').append(p); }
  $('#target-list').hidden = false;
});
$('#empty-choose').onclick = () => {
  if (captures.length && !visible().length) { $('#search').value = ''; document.querySelector('[data-filter="all"]').click(); }
  else $('#choose').click();
};
$('#open-fixtures').onclick = () => api.tabs.create({ url: api.runtime.getURL('help.html') });
api.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.captures) load().catch(error => notify(error.message)); });
await load();
