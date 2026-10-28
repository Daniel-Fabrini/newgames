import { createPersistedStore, createStore, useStore, type PersistedStore } from './store';
import { EMBED, EMBED_HAPTICS, EMBED_LANG, EMBED_SOUND } from '../app/embed';
import { v, type Validator } from './storage/schema';
import { LOCALES, detectLocale, type Locale } from '../i18n/locales';

export type ThemePreference = 'system' | 'light' | 'dark';
export type MotionPreference = 'system' | 'reduce' | 'full';

export interface Settings {
  locale: Locale;
  theme: ThemePreference;
  motion: MotionPreference;
  sound: boolean;
  haptics: boolean;
}

export const defaultSettings = (): Settings => ({
  locale: EMBED && EMBED_LANG ? EMBED_LANG : detectLocale(),
  theme: 'dark',
  motion: 'system',
  sound: EMBED ? EMBED_SOUND : true,
  haptics: EMBED ? EMBED_HAPTICS : true,
});

// Each field falls back individually so one bad value never resets every preference.
const settingsValidator: Validator<Settings> = (input, path) => {
  const d = defaultSettings();
  return v.object({
    locale: v.withDefault(v.literal(...LOCALES), d.locale),
    theme: v.withDefault(v.literal('system', 'light', 'dark'), d.theme),
    motion: v.withDefault(v.literal('system', 'reduce', 'full'), d.motion),
    sound: v.withDefault(v.boolean(), d.sound),
    haptics: v.withDefault(v.boolean(), d.haptics),
  })(input, path);
};

/**
 * In embed mode the settings come from the host (DA Games) through the URL and are kept in memory only,
 * so nothing here fights the host's own language/sound settings.
 */
export const settingsStore: PersistedStore<Settings> = EMBED
  ? { ...createStore<Settings>(defaultSettings()), reload: () => undefined }
  : createPersistedStore<Settings>('settings', { validate: settingsValidator, version: 1 }, defaultSettings);

export function useSettings(): Settings {
  return useStore(settingsStore);
}

export function updateSettings(patch: Partial<Settings>): void {
  settingsStore.set((prev) => ({ ...prev, ...patch }));
}
