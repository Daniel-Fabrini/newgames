export const LOCALES = ['pt', 'en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pt';

export const LOCALE_INFO: Record<Locale, { label: string; intl: string; flag: string }> = {
  pt: { label: 'Português (Brasil)', intl: 'pt-BR', flag: 'BR' },
  en: { label: 'English', intl: 'en-GB', flag: 'EN' },
  es: { label: 'Español', intl: 'es-ES', flag: 'ES' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Picks the first supported language from the device preferences, falling back to Portuguese. */
export function detectLocale(languages: readonly string[] | undefined = typeof navigator !== 'undefined' ? navigator.languages : undefined): Locale {
  for (const tag of languages ?? []) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
