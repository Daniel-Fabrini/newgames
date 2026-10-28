import { describe, expect, it } from 'vitest';
import { dictionaries } from '../i18n';
import { detectLocale } from '../i18n/locales';
import { getFormatters } from '../i18n/format';

type Tree = Record<string, unknown>;

function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'function') return [`${path}()`];
  if (Array.isArray(value)) return [`${path}[${value.length}]`, ...value.flatMap((v, i) => shape(v, `${path}[${i}]`))];
  if (value && typeof value === 'object') return Object.entries(value as Tree).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
  return [path];
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return [String((value as (...a: unknown[]) => unknown)(1, 2, '·'))];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value as Tree).flatMap(strings);
  return [];
}

describe('translations', () => {
  it('have exactly the same structure in pt, en and es', () => {
    const pt = shape(dictionaries.pt).sort();
    expect(shape(dictionaries.en).sort()).toEqual(pt);
    expect(shape(dictionaries.es).sort()).toEqual(pt);
  });

  it('contain no empty strings', () => {
    for (const locale of ['pt', 'en', 'es'] as const) {
      for (const s of strings(dictionaries[locale])) expect(s.trim().length).toBeGreaterThan(0);
    }
  });

  it('are actually translated (English and Spanish differ from Portuguese for most texts)', () => {
    const pt = strings(dictionaries.pt);
    const en = strings(dictionaries.en);
    const es = strings(dictionaries.es);
    const same = (a: string[], b: string[]) => a.filter((s, i) => s === b[i]).length / a.length;
    expect(same(pt, en)).toBeLessThan(0.2);
    expect(same(pt, es)).toBeLessThan(0.35);
  });
});

describe('locale detection', () => {
  it('maps device languages and falls back to Portuguese', () => {
    expect(detectLocale(['es-MX', 'en'])).toBe('es');
    expect(detectLocale(['en-US'])).toBe('en');
    expect(detectLocale(['pt-BR'])).toBe('pt');
    expect(detectLocale(['fr-FR', 'de'])).toBe('pt');
    expect(detectLocale([])).toBe('pt');
  });
});

describe('formatters', () => {
  it('format numbers per locale', () => {
    expect(getFormatters('pt').number(3503)).toMatch(/3\s?503|3\.503/);
    expect(getFormatters('en').number(3503)).toBe('3,503');
    expect(getFormatters('es').number(13503)).toMatch(/13\.503|13\s503/);
  });

  it('formats durations as clocks', () => {
    const f = getFormatters('pt');
    expect(f.clock(65_000)).toBe('1:05');
    expect(f.clock(3_725_000)).toBe('1:02:05');
  });
});
