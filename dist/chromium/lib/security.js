export function sanitizeMarkup(html) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  for (const el of doc.querySelectorAll('script,style,link,meta,base,iframe,object,embed,form,template,animate,set,animateMotion,animateTransform')) el.remove();
  for (const el of doc.body.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || ['srcdoc', 'formaction', 'action', 'form', 'autofocus', 'is', 'ping', 'target', 'srcset'].includes(name)) el.removeAttribute(attr.name);
      if (['href', 'xlink:href', 'src', 'poster'].includes(name)) {
        const value = attr.value.trim();
        const okay = value.startsWith('#') || (/^data:image\//i.test(value) && name !== 'href') || /^https?:\/\//i.test(value);
        if (!okay || (el.localName === 'a' && name === 'href')) el.removeAttribute(attr.name);
      }
    }
    if (el.localName === 'button') el.setAttribute('type', 'button');
  }
  return doc.body.innerHTML;
}

export function safeCss(css) {
  // A CSS escape prevents a style closing tag without changing string values.
  return String(css).replaceAll('<', '\\3c ');
}

export function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
}

export function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
