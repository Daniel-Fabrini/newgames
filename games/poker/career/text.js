// Localised data text: every data text field is {pt,en,es}.
export const LANGS = ['pt', 'en', 'es'];
export function tx(o, lang = 'en') {
  if (o == null) return '';
  if (typeof o === 'string') return o;
  return o[lang] ?? o.en ?? o.pt ?? '';
}
export const L = (pt, en, es) => ({ pt, en, es: es ?? en });
