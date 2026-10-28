import { useEffect } from 'react';
import { useSettings } from '../services/settings';
import { useMediaQuery, useReducedMotion } from '../hooks/useMediaQuery';
import { applyNativeTheme } from './native';

/** Applies theme and reduced-motion preferences to <html> and the browser chrome colour. */
export function ThemeController() {
  const { theme } = useSettings();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const reduced = useReducedMotion();
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0b0a2a' : '#eef0ff');
    applyNativeTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
  }, [reduced]);

  return null;
}
