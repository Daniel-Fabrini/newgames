import { createStore, useStore } from '../services/store';

/**
 * Lightweight toasts plus a screen-reader live region. `announce()` is for status changes that
 * should be read aloud without a visual toast (e.g. "row cleared", "your turn").
 */
export type ToastTone = 'info' | 'success' | 'error' | 'warning';
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const toasts = createStore<ToastItem[]>([]);
const announcement = createStore<{ id: number; text: string }>({ id: 0, text: '' });
let nextId = 1;

export function toast(message: string, { tone = 'info', duration = 2800 }: { tone?: ToastTone; duration?: number } = {}): void {
  const id = nextId++;
  toasts.set((list) => [...list.filter((t) => t.message !== message), { id, message, tone }].slice(-3));
  window.setTimeout(() => toasts.set((list) => list.filter((t) => t.id !== id)), duration);
}

export function announce(text: string): void {
  announcement.set({ id: nextId++, text });
}

export function ToastHost() {
  const items = useStore(toasts);
  const live = useStore(announcement);
  return (
    <>
      <div className="toast-host" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            {t.message}
          </div>
        ))}
      </div>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        <span key={live.id}>{live.text}</span>
      </div>
    </>
  );
}
