(() => {
  if (globalThis.__buttonCopyPicker) { globalThis.__buttonCopyPicker.restart(); return; }
  const api = globalThis.BC_API;
  const STATES = ['hover', 'active', 'focus', 'focus-visible', 'focus-within', 'disabled', 'enabled', 'checked'];
  const STATE_RE = /:(hover|active|focus-visible|focus-within|focus|disabled|enabled|checked)\b/g;
  const IGNORE_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'IFRAME', 'OBJECT', 'EMBED', 'META', 'BASE', 'AUDIO', 'VIDEO']);
  const warningsAlways = 'Website JavaScript handlers are not copied. CSS states and available Web Animations are captured; application actions and unobserved JavaScript effects may differ.';

  function splitSelectors(value) {
    const result = []; let depth = 0, quote = '', start = 0;
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if (quote) { if (c === quote && value[i - 1] !== '\\') quote = ''; continue; }
      if (c === '"' || c === "'") quote = c;
      else if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (c === ',' && depth === 0) { result.push(value.slice(start, i).trim()); start = i + 1; }
    }
    result.push(value.slice(start).trim()); return result;
  }

  // Expand positive selector alternatives before extracting state conditions.
  // Keep functions inside :not() and :has() intact: expanding those as OR
  // alternatives would change their meaning.
  function selectorAlternatives(selector, budget = { remaining: 64 }) {
    let quote = '', bracket = 0;
    const functions = [];
    for (let i = 0; i < selector.length; i++) {
      const c = selector[i];
      if (quote) { if (c === quote && selector[i - 1] !== '\\') quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '[') bracket++;
      if (c === ']') bracket--;
      if (bracket) continue;
      const match = selector.slice(i).match(/^:(is|where)\(/);
      if (match && !functions.length) {
        const start = i + match[0].length;
        let depth = 1, innerQuote = '', end = start;
        for (; end < selector.length; end++) {
          const ch = selector[end];
          if (innerQuote) { if (ch === innerQuote && selector[end - 1] !== '\\') innerQuote = ''; continue; }
          if (ch === '"' || ch === "'") innerQuote = ch;
          else if (ch === '(') depth++;
          else if (ch === ')' && --depth === 0) break;
        }
        if (depth) return [selector];
        const parts = splitSelectors(selector.slice(start, end));
        const needsSubject = part => /^:(hover|active|focus|focus-visible|focus-within|disabled|enabled|checked)\b/.test(part);
        if (parts.length === 1 && !needsSubject(parts[0])) { i = end; continue; }
        budget.remaining -= parts.length;
        if (budget.remaining < 0) return [selector];
        // Retain the functional wrapper so button:is(button:hover) does not
        // become the unrelated type selector buttonbutton:hover.
        const alternatives = parts.flatMap(part => selectorAlternatives(selector.slice(0, i) + `:${match[1]}(${needsSubject(part) ? '*' : ''}${part})` + selector.slice(end + 1), budget));
        // Avoid multiplying an arbitrarily large selector list during capture.
        return alternatives.length <= 64 ? alternatives : [selector];
      }
      if (c === '(') functions.push(i);
      if (c === ')') functions.pop();
    }
    return [selector];
  }

  function absoluteCss(text, base, resources) {
    return text.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi, (all, a, b, c) => {
      const value = (a ?? b ?? c).trim();
      if (!value || value.startsWith('#') || value.startsWith('data:')) return all;
      try {
        const url = new URL(value, base);
        if (!['http:', 'https:'].includes(url.protocol)) return 'url("")';
        resources.add(url.href); return `url("${url.href.replaceAll('"', '%22')}")`;
      } catch { return 'url("")'; }
    });
  }

  function selectorInfo(selector) {
    const pseudo = selector.match(/::(before|after)\b/)?.[0] || '';
    const conditions = [];
    let plain = selector.replace(/::(before|after)\b/g, '');
    plain = plain.replace(/:not\(\s*:((?:hover|active|focus-visible|focus-within|focus|disabled|enabled|checked))\s*\)/g, (_, state) => {
      conditions.push(`:not(:${state})`); return '';
    });
    plain = plain.replace(STATE_RE, (_, state) => { conditions.push(`:${state}`); return ''; });
    plain = plain.trim().replace(/(^|[>+~\s])(?=[>+~]|$)/g, '$1*');
    return { plain: plain || '*', pseudo, conditions: [...new Set(conditions)].join('') };
  }

  function selectorParts(selector) {
    const parts = []; let buffer = '', depth = 0, quote = '', relation = ' ';
    function flush() { if (buffer.trim()) { parts.push({ ...selectorInfo(buffer.trim()), relation }); buffer = ''; relation = ' '; } }
    for (let i = 0; i < selector.length; i++) {
      const c = selector[i];
      if (quote) { buffer += c; if (c === quote && selector[i - 1] !== '\\') quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; buffer += c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (!depth && /[\s>+~]/.test(c)) { flush(); if (c.trim()) relation = c; }
      else buffer += c;
    }
    flush(); return parts;
  }

  async function capture(target) {
    const scope = `bc-${crypto.randomUUID()}`;
    const rootSelector = `[data-bc-root="${scope}"]`;
    const warnings = new Set([warningsAlways]);
    const resources = new Set(), nodes = [], families = new Set();
    const clone = document.createElement('div');
    clone.setAttribute('data-bc-root', scope);
    const css = [`${rootSelector}{display:inline-block;isolation:isolate;position:relative;text-align:left;line-height:normal;color-scheme:normal;}`];
    const pseudoCss = [], usedAnimations = new Set();
    let count = 0;

    function copy(source) {
      if (source.nodeType === Node.TEXT_NODE) return document.createTextNode(source.textContent);
      if (source.nodeType !== Node.ELEMENT_NODE || IGNORE_TAGS.has(source.tagName)) return null;
      if (['animate', 'set', 'animatemotion', 'animatetransform'].includes(source.localName.toLowerCase())) { warnings.add('SVG declarative animations were omitted. CSS and Web Animations are captured separately.'); return null; }
      if (++count > 160) throw new Error('This selection has more than 160 elements. Choose the button itself or a smaller element.');
      const key = String(nodes.length), computed = getComputedStyle(source);
      const custom = source.localName.includes('-');
      const dest = custom ? document.createElement('div') : source.cloneNode(false);
      dest.removeAttribute('style');
      for (const attr of [...dest.attributes]) {
        if (/^on/i.test(attr.name) || ['srcdoc', 'form', 'formaction', 'autofocus', 'nonce', 'integrity', 'is', 'target', 'ping', 'srcset'].includes(attr.name) || /^data-bc-/.test(attr.name)) dest.removeAttribute(attr.name);
        if (['href', 'xlink:href', 'src', 'poster'].includes(attr.name)) {
          if (attr.value.startsWith('#')) continue;
          if (dest.tagName === 'A') { dest.removeAttribute(attr.name); dest.setAttribute('tabindex', '0'); continue; }
          try {
            const url = new URL(attr.value, source.baseURI);
            if (['https:', 'http:'].includes(url.protocol)) { dest.setAttribute(attr.name, url.href); resources.add(url.href); }
            else if (!url.href.startsWith('data:image/')) dest.removeAttribute(attr.name);
          } catch { dest.removeAttribute(attr.name); }
        }
      }
      if (dest.tagName === 'BUTTON') dest.setAttribute('type', 'button');
      if (dest.tagName === 'INPUT') {
        if (!['button', 'submit', 'reset', 'checkbox', 'radio'].includes(source.type)) warnings.add('This selection contains a form field. Its current value is omitted.');
        dest.removeAttribute('value');
        if (['button', 'submit', 'reset'].includes(source.type)) { dest.type = 'button'; dest.value = source.value; }
        if (source.checked) dest.setAttribute('checked', '');
      }
      dest.setAttribute('data-bc-node', key);
      nodes.push({ source, key, dest });
      families.add(computed.fontFamily);
      computed.animationName.split(',').forEach(x => { if (x.trim() !== 'none') usedAnimations.add(x.trim()); });
      const properties = [];
      const inheritanceParent = source.assignedSlot || source.parentElement || source.getRootNode().host;
      const inherited = source !== target && inheritanceParent ? getComputedStyle(inheritanceParent) : null;
      for (const prop of computed) {
        // Keep inherited variables on the root. Descendants must inherit them
        // rather than hold a default snapshot that masks the parent's hover.
        if (prop.startsWith('--') && inherited?.getPropertyValue(prop) === computed.getPropertyValue(prop)) continue;
        // Preserve intrinsic sizing instead of freezing a button's measured pixel size.
        // Explicit author sizes are restored by matching rules below.
        const intrinsic = source === target && ['inline-block', 'inline-flex', 'inline-grid'].includes(computed.display) && ['width', 'height'].includes(prop);
        const value = intrinsic ? 'auto' : absoluteCss(computed.getPropertyValue(prop), source.baseURI, resources);
        properties.push(`${prop}:${value};`);
      }
      css.push(`:where(${rootSelector} [data-bc-node="${key}"]){${properties.join('')}}`);
      for (const pseudo of ['::before', '::after']) {
        const style = getComputedStyle(source, pseudo);
        if (!['none', 'normal'].includes(style.content)) {
          // Custom properties inherit from the captured element. Freezing them
          // here would prevent its hover variables from reaching the pseudo.
          const p = [...style].filter(x => !x.startsWith('--')).map(x => `${x}:${absoluteCss(style.getPropertyValue(x), source.baseURI, resources)};`).join('');
          pseudoCss.push(`:where(${rootSelector} [data-bc-node="${key}"])${pseudo}{${p}}`);
        }
      }
      if (source.tagName === 'CANVAS') {
        warnings.add('Canvas pixels and drawing code cannot be exported as an editable button.');
      }
      const children = source.shadowRoot ? [...source.shadowRoot.childNodes] : [...source.childNodes];
      if (source.shadowRoot) warnings.add('Open shadow content was flattened. Shadow-specific selectors and custom-element behavior may differ.');
      if (custom && !source.shadowRoot) warnings.add('A custom element may contain an inaccessible closed shadow root. Its private content and behavior cannot be inspected.');
      for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'SLOT') {
          for (const assigned of child.assignedNodes({ flatten: true })) { const item = copy(assigned); if (item) dest.append(item); }
        } else { const item = copy(child); if (item) dest.append(item); }
      }
      return dest;
    }
    clone.append(copy(target));
    css.push(...pseudoCss);
    // Scope SVG IDs and local references so multiple exported buttons can coexist.
    const ids = new Map();
    for (const node of clone.querySelectorAll('[id]')) { const original = node.id; const renamed = `${scope}-${ids.size}`; ids.set(original, renamed); node.id = renamed; }
    for (const node of clone.querySelectorAll('*')) for (const attr of [...node.attributes]) {
      let value = attr.value;
      for (const [id, replacement] of ids) {
        if (value === `#${id}`) value = `#${replacement}`;
        value = value.split(`url(#${id})`).join(`url(#${replacement})`);
      }
      if (value !== attr.value) node.setAttribute(attr.name, value);
    }

    const sheets = [], blocked = [], missingStylesheets = [], keyframes = [], fontFaces = [];
    const seenSheets = new Set();
    function scanSheet(sheet, base = document.baseURI, envelopes = []) {
      if (seenSheets.has(sheet)) return;
      seenSheets.add(sheet);
      try { visit(sheet.cssRules, sheet.href || base, envelopes); }
      catch { if (sheet.href) blocked.push({ url: sheet.href, envelopes }); else warnings.add('One inline stylesheet could not be read. Some states may be missing.'); }
    }
    function visit(rules, base, envelopes) {
      for (const rule of rules) {
        if (rule.type === CSSRule.IMPORT_RULE) {
          const media = rule.media.mediaText;
          if (rule.styleSheet) scanSheet(rule.styleSheet, rule.href || base, media ? [...envelopes, `@media ${media}`] : envelopes);
          continue;
        }
        if (rule.type === CSSRule.KEYFRAMES_RULE) { keyframes.push({ name: rule.name, text: absoluteCss(rule.cssText, base, resources), envelopes }); continue; }
        if (rule.type === CSSRule.FONT_FACE_RULE) { fontFaces.push({ family: rule.style.fontFamily, text: rule.cssText, base, envelopes }); continue; }
        if (rule.selectorText && rule.style) { sheets.push({ rule, base, envelopes }); if (rule.cssRules?.length) warnings.add('Nested CSS rules may require recapture after converting them to flat selectors.'); continue; }
        if (rule.cssRules) {
          const header = rule.cssText.slice(0, rule.cssText.indexOf('{')).trim();
          if (/^@(media|supports|container|layer|starting-style)\b/.test(header)) {
            if (header.startsWith('@container')) warnings.add('Container queries depend on the destination layout. Compare responsive previews after export.');
            visit(rule.cssRules, base, [...envelopes, header]);
          } else warnings.add('A stylesheet grouping rule could not be reconstructed.');
        }
      }
    }
    for (const sheet of [...document.styleSheets, ...(document.adoptedStyleSheets || [])]) scanSheet(sheet);
    const shadowRoots = new Set();
    for (const { source } of nodes) {
      if (source.shadowRoot) shadowRoots.add(source.shadowRoot);
      let tree = source.getRootNode();
      while (tree instanceof ShadowRoot) { shadowRoots.add(tree); tree = tree.host.getRootNode(); }
    }
    for (const tree of shadowRoots) for (const sheet of [...tree.querySelectorAll('style,link[rel="stylesheet"]')].map(el => el.sheet).filter(Boolean).concat(tree.adoptedStyleSheets || [])) scanSheet(sheet);
    if (blocked.length) {
      const response = await api.runtime.sendMessage({ type: 'FETCH_STYLES', urls: blocked.map(x => x.url) });
      for (const item of blocked) {
        const fetched = response.sheets?.find(x => x.url === item.url);
        if (fetched?.text) {
          try { const sheet = new CSSStyleSheet(); sheet.replaceSync(fetched.text); visit(sheet.cssRules, item.url, item.envelopes); }
          catch { missingStylesheets.push(item.url); warnings.add(`Stylesheet could not be parsed: ${item.url}`); }
          if (/@import\b/.test(fetched.text)) warnings.add(`Imported rules inside an external stylesheet were not read: ${item.url}`);
        } else { missingStylesheets.push(item.url); warnings.add(`Stylesheet unavailable. Its interaction and responsive rules may be missing: ${item.url}`); }
      }
    }
    const states = new Set(['default']);
    const nodeKeys = new Map(nodes.map(n => [n.source, n.key]));
    const dynamic = [];
    const specificity = selector => {
      const stripped = selector.replace(/:where\([^)]*\)/g, '');
      return (stripped.match(/#[\w-]+/g)?.length || 0) * 100 + (stripped.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g)?.length || 0) * 10 + (stripped.match(/(^|[\s>+~])([a-z][\w-]*)|::[\w-]+/gi)?.length || 0);
    };
    for (const { rule, base, envelopes } of sheets) {
      for (const originalSelector of splitSelectors(rule.selectorText)) for (const selector of selectorAlternatives(originalSelector)) {
        const info = selectorInfo(selector);
        if (/::(?!before|after)/.test(info.plain)) continue;
        for (const { source, key } of nodes) {
          let matches = false;
          try { matches = source.matches(info.plain); } catch { if (/:(is|has|host|slotted)\(/.test(selector)) warnings.add('Complex or shadow selectors could not all be resolved. Some states may differ.'); }
          if (!matches) continue;
          for (const state of STATES) if (info.conditions.includes(`:${state}`)) states.add(state);
          const parts = selectorParts(selector);
          let trigger = source, conditions = parts.at(-1)?.conditions || '', root = rootSelector;
          for (let part = parts.length - 2; part >= 0; part--) {
            const relation = parts[part + 1].relation;
            let candidate = relation === '+' || relation === '~' ? trigger?.previousElementSibling : trigger?.parentElement;
            if (relation === ' ' || relation === '~') {
              while (candidate && !candidate.matches(parts[part].plain)) candidate = relation === '~' ? candidate.previousElementSibling : candidate.parentElement;
            }
            trigger = candidate;
            if (!parts[part].conditions) continue;
            const triggerKey = nodeKeys.get(trigger);
            if (triggerKey !== undefined) root += `:has([data-bc-node="${triggerKey}"]${parts[part].conditions})`;
            else { conditions += parts[part].conditions; warnings.add('A state depends on an element outside the button. Its trigger was mapped to the captured element.'); }
          }
          // cssText preserves shorthands containing var(). Their expanded
          // longhands can be empty in CSSOM until the browser resolves them.
          const declaration = absoluteCss(rule.style.cssText, base, resources);
          for (const prop of rule.style) {
            const value = rule.style.getPropertyValue(prop);
            if (/^animation/.test(prop)) for (const frame of keyframes) if (value.includes(frame.name)) usedAnimations.add(frame.name);
          }
          // Extra attribute repetitions retain relative specificity after removing source ancestry.
          const weight = Math.min(30, Math.max(1, Math.ceil(specificity(originalSelector) / 10)));
          const mapped = `${root} ${`[data-bc-node="${key}"]`.repeat(weight)}${conditions}${info.pseudo}`;
          let text = `${mapped}{${declaration}}`;
          for (const env of [...envelopes].reverse()) text = `${env}{${text}}`;
          dynamic.push(text);
        }
      }
    }
    css.push(...dynamic);
    if (['absolute', 'fixed'].includes(getComputedStyle(target).position)) {
      css.push(`${rootSelector}>[data-bc-node="0"]{position:relative!important;inset:auto!important;}`);
      warnings.add('The button used absolute or fixed page positioning. Its placement was made relative for reuse; internal positioning is preserved.');
    }
    for (const face of fontFaces) if ([...families].some(f => f.toLowerCase().includes(face.family.replaceAll('"', '').replaceAll("'", '').toLowerCase()))) css.unshift(absoluteCss(face.text, face.base, resources));
    for (const frame of keyframes) if (usedAnimations.has(frame.name)) css.push(frame.text);
    let finalCss = css.join('\n');
    for (const [id, replacement] of ids) finalCss = finalCss.split(`url(#${id})`).join(`url(#${replacement})`).split(`url("#${id}")`).join(`url("#${replacement}")`);
    for (const frame of keyframes) if (usedAnimations.has(frame.name)) {
      const escaped = frame.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      finalCss = finalCss.replace(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, 'g'), `${scope}-${frame.name}`);
    }
    const animations = [];
    for (const { source, key } of nodes) for (const animation of source.getAnimations()) {
      if (animation instanceof CSSAnimation || animation instanceof CSSTransition) continue;
      try {
        const timing = animation.effect.getTiming();
        animations.push({ node: key, keyframes: animation.effect.getKeyframes().map(({ computedOffset, ...rest }) => rest), timing: { ...timing, iterations: timing.iterations === Infinity ? 'Infinity' : timing.iterations } });
        warnings.add('A running JavaScript animation was captured for replay. Its original event trigger and future changes are not available.');
      } catch { warnings.add('A running animation could not be serialized.'); }
    }
    if (resources.size > 64) warnings.add('This selection uses more than 64 resources. Some assets remain external.');
    warnings.add(`Default appearance was measured at a ${innerWidth} × ${innerHeight} viewport. Inherited layout, browser font rendering, and complex selector specificity can differ after export. Compare the preview with the source.`);
    const rect = target.getBoundingClientRect();
    return {
      version: 1, scope, name: (target.getAttribute('aria-label') || target.innerText || target.value || 'Untitled button').trim().slice(0, 100),
      html: clone.outerHTML, css: finalCss, animations, states: [...states], warnings: [...warnings],
      resources: [...resources], blockedStylesheets: missingStylesheets,
      dimensions: { width: Math.round(rect.width), height: Math.round(rect.height), viewportWidth: innerWidth, viewportHeight: innerHeight },
      background: getComputedStyle(document.body).backgroundColor,
      capturedAt: new Date().toISOString()
    };
  }

  let host, shadow, highlight, panel, status, save, selected, hovered, busy = false;
  let lastPointer = { x: 0, y: 0 };
  function candidate(node) {
    if (!(node instanceof Element) || node === host || host?.contains(node)) return null;
    return node.closest('button, a, input[type="button"], input[type="submit"], input[type="reset"], [role="button"], summary, [tabindex]') || node.closest('[class*="button"], [class*="btn"]') || (getComputedStyle(node).cursor === 'pointer' ? node : null);
  }
  function draw(node) {
    if (!node?.isConnected) { highlight.hidden = true; return; }
    const r = node.getBoundingClientRect();
    highlight.hidden = false;
    Object.assign(highlight.style, { left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` });
  }
  function move(event) {
    if (event.composedPath().includes(host) || busy) return;
    lastPointer = { x: event.clientX, y: event.clientY };
    if (selected) return;
    hovered = candidate(event.composedPath()[0]);
    draw(hovered);
  }
  function choose(event) {
    if (event.composedPath().includes(host) || busy) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const node = event.altKey ? event.composedPath()[0] : candidate(event.composedPath()[0]);
    if (!(node instanceof Element)) { status.textContent = 'Point at a button. Hold Alt to choose a custom element.'; return; }
    selected = node; draw(node); save.disabled = false;
    status.textContent = `Selected ${node.tagName.toLowerCase()}. Review the outline, then save.`;
  }
  function blockPress(event) { if (!event.composedPath().includes(host)) { event.preventDefault(); event.stopImmediatePropagation(); } }
  function key(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (!busy) cleanup(); }
  }
  function reposition() { draw(selected || hovered); }
  function cleanup() {
    document.removeEventListener('pointermove', move, true);
    for (const type of ['click', 'dblclick', 'contextmenu']) document.removeEventListener(type, choose, true);
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) document.removeEventListener(type, blockPress, true);
    document.removeEventListener('keydown', key, true);
    window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition);
    host?.remove(); selected = null; hovered = null;
  }
  function restart() {
    if (busy) return;
    cleanup();
    host = document.createElement('div'); host.setAttribute('data-button-copy-overlay', '');
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;';
    shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>
      :host{color-scheme:dark}*{box-sizing:border-box}.outline{position:fixed;outline:2px solid #62d6a5;border-radius:5px;pointer-events:none}.panel{pointer-events:auto;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);width:min(650px,calc(100vw - 32px));background:#111915;color:#eff7f2;border:1px solid #3d5547;border-radius:14px;padding:18px 20px;font:14px/1.5 system-ui;box-shadow:0 12px 40px #0006}.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}strong{font-size:16px;margin-right:auto}p{margin:8px 0 14px;color:#b8cbbf}button{font:inherit;color:inherit;background:#233329;border:1px solid #4d6557;border-radius:7px;padding:8px 13px;cursor:pointer}button:hover{background:#334b3c}button:focus-visible{outline:2px solid #8de4bc;outline-offset:3px}button.primary{background:#004225}button:disabled{opacity:.5;cursor:default}.hint{font-size:12px;color:#b8cbbf;margin-bottom:0}[hidden]{display:none!important}
      </style><div class="outline" hidden></div><section class="panel" aria-label="Button Copy picker"><div class="row"><strong>Choose a button</strong><button id="close" aria-label="Close picker">Close</button></div><p id="status" role="status">Point at a button and click to select it. The website action is blocked while choosing.</p><div class="row"><button id="save" class="primary" disabled>Save button</button><button id="again">Choose another</button><button id="parent">Select parent</button><button id="library">Open library</button></div><p class="hint">Alt + click selects a custom element. Escape closes the picker. Embedded frames must be opened in their own tab.</p></section>`;
    highlight = shadow.querySelector('.outline'); panel = shadow.querySelector('.panel'); status = shadow.querySelector('#status'); save = shadow.querySelector('#save');
    shadow.querySelector('#close').onclick = () => { if (!busy) cleanup(); };
    shadow.querySelector('#again').onclick = () => { if (busy) return; selected = null; save.disabled = true; highlight.hidden = true; status.textContent = 'Point at the next button and click to select it.'; };
    shadow.querySelector('#parent').onclick = () => {
      if (busy || !selected?.parentElement || ['BODY', 'HTML'].includes(selected.parentElement.tagName)) return;
      selected = selected.parentElement; draw(selected); status.textContent = 'Parent selected. Check that the outline contains only the content you want.';
    };
    shadow.querySelector('#library').onclick = () => api.runtime.sendMessage({ type: 'OPEN_LIBRARY' });
    save.onclick = async () => {
      if (!selected?.isConnected || busy) return;
      busy = true; save.disabled = true; save.textContent = 'Capturing…';
      status.textContent = 'Reading styles, states, animations, and assets…';
      try {
        const data = await capture(selected);
        const result = await api.runtime.sendMessage({ type: 'SAVE_CAPTURE', capture: data });
        if (!result?.ok) throw new Error(result?.error || 'Saving failed');
        selected = null; highlight.hidden = true;
        status.textContent = `Saved to your local library. ${result.warningCount} capture notes are available in the detail view.`;
      } catch (error) { status.textContent = `Could not save: ${error.message}`; save.disabled = false; }
      finally { busy = false; save.textContent = 'Save button'; }
    };
    document.documentElement.append(host);
    document.addEventListener('pointermove', move, true);
    for (const type of ['click', 'dblclick', 'contextmenu']) document.addEventListener(type, choose, true);
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) document.addEventListener(type, blockPress, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('scroll', reposition, true); window.addEventListener('resize', reposition);
  }
  globalThis.__buttonCopyPicker = { restart };
  restart();
})();
