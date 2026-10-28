// Language handling. The app supports three UI languages: pt (Brazilian
// Portuguese), en and es. Strings live in plain objects shaped like
// { pt: { key: 'texto' }, en: { key: 'text' }, es: { key: 'texto' } }.

import { createStore } from './store.js';

export const LANGS = [
  { code: 'pt', label: 'Português', short: 'PT', flag: 'br', locale: 'pt-BR' },
  { code: 'en', label: 'English', short: 'EN', flag: 'us', locale: 'en-US' },
  { code: 'es', label: 'Español', short: 'ES', flag: 'es', locale: 'es-ES' },
];

const prefs = createStore('app');
const listeners = new Set();

function detect() {
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'pt';
  const code = nav.slice(0, 2).toLowerCase();
  return LANGS.some((l) => l.code === code) ? code : 'pt';
}

let current = prefs.get('lang', null) || detect();

export function getLang() {
  return current;
}

export function getLocale(code = current) {
  return (LANGS.find((l) => l.code === code) || LANGS[0]).locale;
}

export function setLang(code) {
  if (!LANGS.some((l) => l.code === code) || code === current) return;
  current = code;
  prefs.set('lang', code);
  document.documentElement.lang = getLocale(code);
  for (const fn of listeners) fn(code);
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Builds a translator for a strings object. `{name}` placeholders are
// replaced from `params`. Missing keys fall back to English, then to the key.
// A value may also be a function (params, lang) => string, for plurals etc.
export function makeT(strings, lang = () => current) {
  return function t(key, params) {
    const code = typeof lang === 'function' ? lang() : lang;
    let s = strings[code] && strings[code][key];
    if (s === undefined) s = strings.en && strings.en[key];
    if (s === undefined) return key;
    if (typeof s === 'function') return s(params || {}, code);
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
  };
}

// Picks the current language from an inline { pt, en, es } object.
export function pick(obj, code = current) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[code] !== undefined ? obj[code] : obj.en;
}

document.documentElement.lang = getLocale(current);
