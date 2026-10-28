import { useSyncExternalStore } from 'react';
import { useSettings } from '../services/settings';

const supported = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      if (!supported()) return () => undefined;
      const mql = window.matchMedia(query);
      mql.addEventListener('change', listener);
      return () => mql.removeEventListener('change', listener);
    },
    () => (supported() ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** True when animations should be minimised (in-app setting or OS preference). */
export function useReducedMotion(): boolean {
  const { motion } = useSettings();
  const system = useMediaQuery('(prefers-reduced-motion: reduce)');
  return motion === 'reduce' || (motion === 'system' && system);
}
