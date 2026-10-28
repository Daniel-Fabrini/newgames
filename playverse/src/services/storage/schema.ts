/**
 * Minimal runtime validators used to check data read from storage.
 * Each validator returns the (possibly normalised) value or a descriptive error,
 * so corrupted or outdated saves can be discarded safely instead of crashing a game.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export type Validator<T> = (input: unknown, path?: string) => Result<T>;
export type Infer<V> = V extends Validator<infer T> ? T : never;

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (path: string, msg: string): Result<never> => ({ ok: false, error: `${path || '$'}: ${msg}` });

interface NumberOptions {
  int?: boolean;
  min?: number;
  max?: number;
}

function number(opts: NumberOptions = {}): Validator<number> {
  return (input, path = '') => {
    if (typeof input !== 'number' || !Number.isFinite(input)) return fail(path, 'expected finite number');
    if (opts.int && !Number.isInteger(input)) return fail(path, 'expected integer');
    if (opts.min !== undefined && input < opts.min) return fail(path, `expected >= ${opts.min}`);
    if (opts.max !== undefined && input > opts.max) return fail(path, `expected <= ${opts.max}`);
    return ok(input);
  };
}

function string(opts: { maxLength?: number } = {}): Validator<string> {
  return (input, path = '') => {
    if (typeof input !== 'string') return fail(path, 'expected string');
    if (opts.maxLength !== undefined && input.length > opts.maxLength) return fail(path, 'string too long');
    return ok(input);
  };
}

function boolean(): Validator<boolean> {
  return (input, path = '') => (typeof input === 'boolean' ? ok(input) : fail(path, 'expected boolean'));
}

function literal<const T extends readonly (string | number | boolean | null)[]>(...values: T): Validator<T[number]> {
  return (input, path = '') =>
    values.includes(input as T[number]) ? ok(input as T[number]) : fail(path, `expected one of ${values.join(', ')}`);
}

function array<T>(item: Validator<T>, opts: { minLength?: number; maxLength?: number; length?: number } = {}): Validator<T[]> {
  return (input, path = '') => {
    if (!Array.isArray(input)) return fail(path, 'expected array');
    if (opts.length !== undefined && input.length !== opts.length) return fail(path, `expected length ${opts.length}`);
    if (opts.minLength !== undefined && input.length < opts.minLength) return fail(path, 'array too short');
    if (opts.maxLength !== undefined && input.length > opts.maxLength) return fail(path, 'array too long');
    const out: T[] = [];
    for (let i = 0; i < input.length; i++) {
      const r = item(input[i], `${path}[${i}]`);
      if (!r.ok) return r;
      out.push(r.value);
    }
    return ok(out);
  };
}

type Shape = Record<string, Validator<unknown>>;
type ObjectOf<S extends Shape> = { [K in keyof S]: Infer<S[K]> };

/** Validates known keys; unknown keys are dropped. */
function object<S extends Shape>(shape: S): Validator<ObjectOf<S>> {
  return (input, path = '') => {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return fail(path, 'expected object');
    const src = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      const validator = shape[key] as Validator<unknown>;
      const r = validator(src[key], path ? `${path}.${key}` : key);
      if (!r.ok) return r;
      if (r.value !== undefined) out[key] = r.value;
    }
    return ok(out as ObjectOf<S>);
  };
}

/** Record with arbitrary string keys. Invalid entries make the whole record invalid unless `dropInvalid`. */
function record<T>(value: Validator<T>, opts: { dropInvalid?: boolean; keys?: readonly string[] } = {}): Validator<Record<string, T>> {
  return (input, path = '') => {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return fail(path, 'expected object');
    const out: Record<string, T> = {};
    for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
      if (opts.keys && !opts.keys.includes(key)) {
        if (opts.dropInvalid) continue;
        return fail(`${path}.${key}`, 'unexpected key');
      }
      const r = value(raw, `${path}.${key}`);
      if (r.ok) out[key] = r.value;
      else if (!opts.dropInvalid) return r;
    }
    return ok(out);
  };
}

function optional<T>(inner: Validator<T>): Validator<T | undefined> {
  return (input, path) => (input === undefined ? ok(undefined) : inner(input, path));
}

function nullable<T>(inner: Validator<T>): Validator<T | null> {
  return (input, path) => (input === null ? ok(null) : inner(input, path));
}

/** Uses `fallback` when the value is missing or invalid (useful for forward-compatible settings). */
function withDefault<T>(inner: Validator<T>, fallback: T): Validator<T> {
  return (input, path) => {
    const r = inner(input, path);
    return r.ok ? r : ok(fallback);
  };
}

function union<T extends readonly Validator<unknown>[]>(...options: T): Validator<Infer<T[number]>> {
  return (input, path = '') => {
    const errors: string[] = [];
    for (const option of options) {
      const r = option(input, path);
      if (r.ok) return r as Result<Infer<T[number]>>;
      errors.push(r.error);
    }
    return fail(path, `no union member matched (${errors.join(' | ')})`);
  };
}

/** Adds a semantic check on top of a structural validator. */
function refine<T>(inner: Validator<T>, check: (value: T) => boolean | string): Validator<T> {
  return (input, path = '') => {
    const r = inner(input, path);
    if (!r.ok) return r;
    const verdict = check(r.value);
    if (verdict === true) return r;
    return fail(path, typeof verdict === 'string' ? verdict : 'failed refinement');
  };
}

function unknownValue(): Validator<unknown> {
  return (input) => ok(input);
}

export const v = {
  number,
  int: (opts: Omit<NumberOptions, 'int'> = {}) => number({ ...opts, int: true }),
  string,
  boolean,
  literal,
  array,
  object,
  record,
  optional,
  nullable,
  withDefault,
  union,
  refine,
  unknown: unknownValue,
};
