// Question bank registry. Each set file exports an array of questions:
//
//   {
//     d: 1 | 2 | 3 | 4,            // difficulty: 1 easy (questions 1–5), 2 medium (6–10),
//                                  // 3 hard (11–15), 4 very hard (the million question)
//     q: { pt, en, es },           // the question
//     a: [ {pt,en,es}, {pt,en,es}, {pt,en,es}, {pt,en,es} ],  // exactly 4 options
//     ok: 0..3,                    // index of the correct option in `a`
//   }
//
// The engine shuffles options at runtime. Validate with:
//   node games/million/tools/validate.mjs            (all sets)
//   node games/million/tools/validate.mjs geo science (some sets)

export const SETS = ['geo', 'science', 'history', 'sports', 'entertainment', 'general', 'nature', 'food', 'arts', 'tech', 'brazil', 'language'];

const modules = {};

// Loads every set that exists; missing files are skipped.
export async function loadQuestions() {
  const all = [];
  await Promise.all(
    SETS.map(async (set) => {
      try {
        modules[set] = modules[set] || (await import(`./q-${set}.js`)).default;
        modules[set].forEach((q, i) => all.push({ ...q, set, id: `${set}-${i}` }));
      } catch {
        /* set not written yet */
      }
    }),
  );
  return all;
}
