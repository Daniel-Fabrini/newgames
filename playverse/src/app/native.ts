import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

/** True when running inside the Android app (Capacitor), false in the browser/PWA. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Keeps the Android status/navigation bar icons readable for the active theme. */
export function applyNativeTheme(theme: 'dark' | 'light'): void {
  if (!isNativeApp()) return;
  SystemBars.setStyle({ style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
}
