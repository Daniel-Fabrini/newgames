import { useEffect, useMemo, type ReactNode } from 'react';
import { I18nContext, dictionaries, type I18nValue } from './index';
import { getFormatters } from './format';
import { LOCALE_INFO } from './locales';
import { updateSettings, useSettings } from '../services/settings';

/**
 * Provides the active dictionary. Changing the language only swaps the dictionary object;
 * no component is remounted, so game state is never lost.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { locale } = useSettings();
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      m: dictionaries[locale],
      fmt: getFormatters(locale),
      setLocale: (next) => updateSettings({ locale: next }),
    }),
    [locale],
  );
  useEffect(() => {
    document.documentElement.lang = LOCALE_INFO[locale].intl;
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
