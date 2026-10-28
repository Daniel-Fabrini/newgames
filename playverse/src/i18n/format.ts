import { LOCALE_INFO, type Locale } from './locales';
import { formatDuration } from '../utils/format';

export interface Formatters {
  number(value: number, options?: Intl.NumberFormatOptions): string;
  percent(ratio: number, fractionDigits?: number): string;
  date(timestamp: number): string;
  dateTime(timestamp: number): string;
  relative(timestamp: number, now?: number): string;
  /** Compact clock format (m:ss / h:mm:ss). */
  clock(ms: number): string;
  /** Human readable duration, e.g. "2 h 05 min" / "3 min 12 s". */
  duration(ms: number): string;
  list(items: string[]): string;
}

const cache = new Map<Locale, Formatters>();

export function getFormatters(locale: Locale): Formatters {
  const cached = cache.get(locale);
  if (cached) return cached;
  const tag = LOCALE_INFO[locale].intl;
  const numberFormats = new Map<string, Intl.NumberFormat>();
  const nf = (options?: Intl.NumberFormatOptions) => {
    const key = JSON.stringify(options ?? {});
    let f = numberFormats.get(key);
    if (!f) {
      f = new Intl.NumberFormat(tag, options);
      numberFormats.set(key, f);
    }
    return f;
  };
  const dateFmt = new Intl.DateTimeFormat(tag, { dateStyle: 'medium' });
  const dateTimeFmt = new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' });
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
  const listFmt = new Intl.ListFormat(tag, { style: 'long', type: 'conjunction' });

  const formatters: Formatters = {
    number: (value, options) => nf(options).format(value),
    percent: (ratio, fractionDigits = 0) =>
      nf({ style: 'percent', maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits }).format(ratio),
    date: (ts) => dateFmt.format(ts),
    dateTime: (ts) => dateTimeFmt.format(ts),
    relative: (ts, now = Date.now()) => {
      const diffSec = Math.round((ts - now) / 1000);
      const abs = Math.abs(diffSec);
      if (abs < 60) return rtf.format(diffSec, 'second');
      if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
      if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
      if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
      return dateFmt.format(ts);
    },
    clock: formatDuration,
    duration: (ms) => {
      const totalSec = Math.max(0, Math.round(ms / 1000));
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (h > 0) return `${nf().format(h)} h ${String(m).padStart(2, '0')} min`;
      if (m > 0) return `${nf().format(m)} min ${String(s).padStart(2, '0')} s`;
      return `${nf().format(s)} s`;
    },
    list: (items) => listFmt.format(items),
  };
  cache.set(locale, formatters);
  return formatters;
}
