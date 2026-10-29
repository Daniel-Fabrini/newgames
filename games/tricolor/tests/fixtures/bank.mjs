// TEST-ONLY fixture: synthetic arithmetic questions. NEVER shipped as real content.
import { CAT_IDS } from '../../questions/schema.js';

export function makeFixture(perCat = 12) {
  const out = [];
  CAT_IDS.forEach((cat, ci) => {
    for (let k = 0; k < perCat; k++) {
      const a = 7 + ci * 3 + k;
      const b = 2 + ((k * 5 + ci) % 11);
      const right = a + b;
      const wrongs = [right + 1, right - 2, right + 10];
      const c = (ci + k) % 4;
      const answers = wrongs.slice();
      answers.splice(c, 0, right);
      out.push({
        id: `${cat}-${String(k + 1).padStart(3, '0')}`,
        q: `[TESTE ${cat}] Quanto é ${a} + ${b}?`,
        a: answers.map(String),
        c,
        cat,
        d: 1 + (k % 4),
        exp: `Questão de teste: a soma de ${a} e ${b} é igual a ${right}, conforme a aritmética básica.`,
        src: [{ n: 'Fonte de teste', u: 'https://example.org/teste' }],
        when: String(1900 + k),
        ok: true,
      });
    }
  });
  return out;
}
export default makeFixture();
