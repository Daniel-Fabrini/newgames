import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAll, validateQuestion, validateBank, NAMES } from '../questions/index.js';
import { report } from './stats.mjs';

const good = () => ({ id: 'lib-001', q: 'Em que ano ocorreu o teste?', a: ['1990', '1991', '1992', '1993'], c: 2, cat: 'lib', d: 2, exp: 'Fato de teste.', src: [{ n: 'Fonte', u: 'https://example.org/x' }], ok: true });

test('real bank: every record is well-formed (no rejected records)', () => {
  const res = validateAll();
  report(res, (l) => process.stdout.write(l + '\n'));
  assert.equal(res.errors.length, 0, res.errors.map((e) => `${e.file}#${e.index} ${e.id}: ${e.msgs.join('; ')}`).join('\n'));
  assert.ok(NAMES.length === 18);
});

test('validator accepts a good record and flags each malformation', () => {
  assert.deepEqual(validateQuestion(good()), []);
  const bad = (patch) => validateQuestion({ ...good(), ...patch }).length > 0;
  assert.ok(bad({ id: 'xx' }));
  assert.ok(bad({ q: 'sem interrogação' }));
  assert.ok(bad({ q: 'x'.repeat(230) + '?' }));
  assert.ok(bad({ a: ['1', '2', '3'] }));
  assert.ok(bad({ a: ['1', '1', '3', '4'] }));
  assert.ok(bad({ a: ['1', '2', '3', 'x'.repeat(61)] }));
  assert.ok(bad({ c: 4 }));
  assert.ok(bad({ c: '1' }));
  assert.ok(bad({ cat: 'nope' }));
  assert.ok(bad({ d: 5 }));
  assert.ok(bad({ exp: '' }));
  assert.ok(bad({ src: [] }));
  assert.ok(bad({ src: [{ n: 'a', u: 'ftp://x' }] }));
  assert.ok(bad({ src: [{ n: '', u: 'https://a.org' }] }));
  assert.ok(bad({ ok: false }));
  assert.ok(bad({ ok: undefined }));
});

test('cross-record duplicates are rejected', () => {
  const a = good();
  const b = { ...good(), id: 'lib-002' };
  const r = validateBank([{ file: 't', list: [a, a, b] }]);
  assert.equal(r.valid.length, 1);
  assert.equal(r.errors.length, 2);
  const c = { ...good(), id: 'lib-003', q: 'EM QUE ANO OCORREU O TESTE?', a: ['1993', '1990', '1991', '1992'] };
  assert.equal(validateBank([{ file: 't', list: [a, c] }]).errors.length, 1);
});

test('near duplicates are reported as warnings', () => {
  const a = good();
  const b = { ...good(), id: 'lib-009', q: 'Qual foi o ano em que ocorreu o teste?', a: ['1', '2', '3', '4'] };
  const r = validateBank([{ file: 't', list: [a, b] }]);
  assert.equal(r.valid.length, 2);
  assert.ok(r.nearDup.length === 1);
});
