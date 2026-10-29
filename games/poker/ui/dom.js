// Tiny DOM builder: h('div', {class, onclick, hidden}, child, 'text', '<svg…>')
// A string child that starts with "<svg" or "<span" is parsed as markup (icons); other strings are text.
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'hidden') el.hidden = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) add(el, k);
    else if (typeof k === 'string') {
      if (k.charCodeAt(0) === 60 && /^<(svg|span|b|i|em)/.test(k)) {
        const tpl = document.createElement('template');
        tpl.innerHTML = k;
        el.append(tpl.content);
      } else el.append(document.createTextNode(k));
    } else el.append(k);
  }
}
export const clear = (el) => {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
};
export const $ = (sel, root = document) => root.querySelector(sel);
