function sanitizeMarkup(html) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.querySelectorAll('script,style,link,meta,base,iframe,object,embed,form,template,animate,set,animateMotion,animateTransform').forEach(el => el.remove());
  for (const el of doc.body.querySelectorAll('*')) for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on') || ['srcdoc', 'formaction', 'action', 'form', 'autofocus', 'is', 'ping', 'target', 'srcset'].includes(name)) el.removeAttribute(attr.name);
    if (['href', 'xlink:href', 'src', 'poster'].includes(name)) {
      const value = attr.value.trim();
      if (!(value.startsWith('#') || /^data:image\//i.test(value) && name !== 'href' || /^https?:\/\//i.test(value)) || el.localName === 'a' && name === 'href') el.removeAttribute(attr.name);
    }
    if (el.localName === 'button') el.setAttribute('type', 'button');
  }
  return doc.body.innerHTML;
}
let capture, style, running = [];
function replay() {
  running.forEach(a => a.cancel()); running = [];
  const mount = document.querySelector('#mount');
  for (const node of mount.querySelectorAll('*')) {
    node.getAnimations().forEach(a => { a.cancel(); a.play(); });
  }
  for (const item of (capture?.animations || []).slice(0, 160)) {
    if (!/^\d+$/.test(String(item.node)) || !Array.isArray(item.keyframes)) continue;
    const node = mount.querySelector(`[data-bc-node="${item.node}"]`);
    try { if (node) running.push(node.animate(item.keyframes, { ...item.timing, iterations: item.timing.iterations === 'Infinity' ? Infinity : item.timing.iterations })); } catch { /* capture notes describe unavailable animation behavior */ }
  }
}
window.addEventListener('message', event => {
  if (event.source !== parent || !event.data?.buttonCopy) return;
  const message = event.data;
  if (message.action === 'render') {
    capture = message.capture;
    if (!capture || typeof capture.html !== 'string' || typeof capture.css !== 'string') return;
    document.querySelector('#mount').innerHTML = sanitizeMarkup(capture.html);
    style?.remove(); style = document.createElement('style');
    style.textContent = capture.css.replace(/:(hover|active|focus-visible|focus-within|focus|disabled|checked)\b/g, (_, state) => `:is(:${state},[data-bc-state~="${state}"])`);
    document.head.append(style); replay();
  }
  if (message.action === 'state') {
    const state = ['hover', 'active', 'focus', 'focus-visible', 'focus-within', 'disabled', 'checked'].includes(message.state) ? message.state : '';
    document.querySelectorAll('[data-bc-node]').forEach(node => node.setAttribute('data-bc-state', state));
  }
  if (message.action === 'background') {
    if (/^(#[0-9a-f]{3,8}|rgba?\([\d., %]+\)|transparent)$/i.test(message.color)) document.body.style.background = message.color;
  }
  if (message.action === 'replay') replay();
});
document.addEventListener('click', event => { event.preventDefault(); });
parent.postMessage({ buttonCopy: true, action: 'ready' }, '*');
