// Small UI building blocks shared by every poker screen.
import { h } from './dom.js';
import { ICON } from './icons.js';

export const fmtN = (n) => {
  n = Math.round(Number(n) || 0);
  const neg = n < 0;
  const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (neg ? '-' : '') + s;
};
export const fmtK = (n) => {
  n = Math.round(Number(n) || 0);
  if (Math.abs(n) < 10000) return fmtN(n);
  if (Math.abs(n) < 1e6) return (n / 1000).toFixed(Math.abs(n) < 100000 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return (n / 1e6).toFixed(2).replace(/0$/, '').replace(/\.0$/, '') + 'M';
};
export const ordinal = (n, lang) => {
  if (lang === 'en') {
    const v = n % 100;
    return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th');
  }
  return n + 'º';
};

export function section(title, right) {
  return h('div', { class: 'pk-sec' }, h('h3', {}, title), right || null);
}
export function panel(cls, ...kids) {
  return h('div', { class: 'pk-panel ' + (cls || '') }, ...kids);
}
export function bar(value, max, cls = '') {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return h('div', { class: 'pk-bar2 ' + cls, role: 'progressbar', 'aria-valuenow': String(Math.round(value)), 'aria-valuemax': String(max) }, h('i', { style: { width: pct + '%' } }));
}
export function pill(text, cls = '') {
  return h('span', { class: 'pk-pill ' + cls }, text);
}
export function btn(label, onclick, cls = '', icon) {
  return h('button', { type: 'button', class: 'pk-btn ' + cls, onclick }, icon ? h('span', { class: 'pk-btn-i' }, icon) : null, h('span', {}, label));
}
export function topbar(title, { onBack, right, sub } = {}) {
  return h(
    'div',
    { class: 'pk-top' },
    onBack ? h('button', { type: 'button', class: 'pk-top-b', 'aria-label': '‹', onclick: onBack }, ICON.back) : h('span', { class: 'pk-top-b ph' }),
    h('div', { class: 'pk-top-t' }, h('b', {}, title), sub ? h('small', {}, sub) : null),
    right || h('span', { class: 'pk-top-b ph' }),
  );
}
export function seg(options, value, onChange, cls = '') {
  const wrap = h('div', { class: 'pk-segc ' + cls, role: 'radiogroup' });
  for (const o of options) {
    const b = h('button', { type: 'button', role: 'radio', class: 'pk-segc-b' + (o.id === value ? ' on' : ''), 'aria-checked': String(o.id === value) }, h('b', {}, o.label), o.sub ? h('small', {}, o.sub) : null);
    b.onclick = () => {
      wrap.querySelectorAll('.pk-segc-b').forEach((x) => {
        x.classList.remove('on');
        x.setAttribute('aria-checked', 'false');
      });
      b.classList.add('on');
      b.setAttribute('aria-checked', 'true');
      onChange(o.id);
    };
    wrap.append(b);
  }
  return wrap;
}
export function tabs(items, active, onSelect) {
  const nav = h('nav', { class: 'pk-tabs', role: 'tablist' });
  for (const it of items) {
    const b = h('button', { type: 'button', role: 'tab', class: 'pk-tab' + (it.id === active ? ' on' : ''), 'aria-selected': String(it.id === active), onclick: () => onSelect(it.id) }, it.icon, h('span', {}, it.label));
    if (it.badge) b.append(h('i', { class: 'pk-badge' }));
    nav.append(b);
  }
  return nav;
}
/** Full-screen overlay (celebrations, tutorials). Returns {el, close}. */
export function overlay(root, cls = '') {
  const el = h('div', { class: 'pk-ov ' + cls, role: 'dialog', 'aria-modal': 'true' });
  root.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const close = () => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 260);
  };
  return { el, close };
}
