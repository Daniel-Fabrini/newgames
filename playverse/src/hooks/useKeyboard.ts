import { useEffect, useRef } from 'react';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Global keyboard handler for games. Ignores key presses while typing in form fields or while
 * a modal dialog is open. Return `true` from the handler to mark the key as handled
 * (prevents default scrolling for arrows/space).
 */
export function useKeyboard(handler: (event: KeyboardEvent) => boolean | void, enabled = true): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector('dialog[open]')) return;
      if (ref.current(e) === true) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
