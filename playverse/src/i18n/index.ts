import { createContext, useContext } from 'react';
import { pt, type Messages } from './pt';
import { en } from './en';
import { es } from './es';
import type { Formatters } from './format';
import type { Locale } from './locales';

export type { Messages } from './pt';
export { LOCALES, LOCALE_INFO, detectLocale, isLocale, type Locale } from './locales';

export const dictionaries: Record<Locale, Messages> = { pt, en, es };

export interface I18nValue {
  locale: Locale;
  /** Typed message dictionary for the active locale. */
  m: Messages;
  fmt: Formatters;
  setLocale(locale: Locale): void;
}

export const I18nContext = createContext<I18nValue | null>(null);

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
