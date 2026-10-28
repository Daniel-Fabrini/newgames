# Polyglot — course content guide

The Polyglot game (`games/polyglot/`) teaches **English, Spanish, French, German, Italian and
Portuguese (Brazilian)** to speakers of **Portuguese, English or Spanish** (the app's UI language).
Every unit is written **once, as a parallel corpus in all six languages**; the engine turns it into
lessons for every course direction (e.g. pt→fr, en→de, es→it…).

```
games/polyglot/
  content/index.js            registry: sections + every unit (id, file, title, ready flag)
  content/units/uNN-topic.js  one file per unit (this guide)
  tools/validate.mjs          validator — run it before you are done
  corpus.js                   tokenizer / answer checking used by the engine and the validator
```

## Workflow for a content author

1. Pick your unit(s) in `content/index.js` (`UNITS`). The `id`, `file`, `title`, `desc` and `plan`
   (topic + grammar focus) are already there — follow the `plan`.
2. Create `content/units/<file>` (e.g. `content/units/u14-directions.js`). Use
   `content/units/u01-greetings.js` as the model.
3. Run `node games/polyglot/tools/validate.mjs u14` until it prints **0 errors**; read every WARN.
4. Flip `ready: false` → `ready: true` on **your unit's line only** in `content/index.js`.
5. Run `node games/polyglot/tools/validate.mjs` (all ready units) once more.

Do **not** edit any other file (engine, other units, strings). Do not run git commands.

## Unit file schema

```js
export default {
  id: 'u14',              // must match the registry
  words: [ /* 12–16 entries */ ],
  sentences: [ /* 14–20 entries */ ],
  tips: [ /* 1–3 guidebook notes per target language */ ],
  stories: [ /* 1 story (A1–B1), 2 role-play stories (section 4) */ ],
};
```

### Six-language fields

Every word, sentence, story line, reply option, story title and tip example is an object with the
six keys **`en`, `es`, `pt`, `fr`, `it`, `de`** (all required, never empty).

- **Alternatives** (words and sentences only): separate accepted answers with `|`.
  The **first** form is the one shown, spoken and used to build word tiles; the others are only
  accepted when the learner types or assembles an answer.
  `pt: 'Eu sou o Pedro.|Sou o Pedro.|Eu sou Pedro.'`
- List the natural alternatives a learner might produce: dropped subject pronouns (es/pt/it),
  formal/informal *you*, masculine/feminine (`obrigado|obrigada`, `amigo|amiga`), common synonyms
  and regional words (`el carro|el coche|el auto`).
- **English contractions are automatic**: write `I am`, the checker also accepts `I'm` (and
  vice-versa for `don't`, `it's`, `you're`, `can't`, `I'd`…). Do not list both.
- Case, accents, punctuation and one-letter typos are forgiven automatically — do not add
  alternatives that only differ in those.
- **Portuguese is Brazilian** (você, ônibus, celular, trem, café da manhã).
  **Spanish**: neutral/Latin-American first, Spain variants as alternatives
  (`la computadora|el ordenador`, `el celular|el móvil`). **English**: American spelling first.

### Typography rules (the validator enforces them)

- Straight apostrophe `'` only — never `’`. No double quotes, no parentheses, no digits
  (write numbers as words), no abbreviations with a period (`Mr.`, `Dr.`).
- Sentences end with `.`, `!` or `?`. Words have no final punctuation.
- Spanish questions/exclamations open with `¿` / `¡`.
- French: a normal space before `? ! : ;` (`Ça va ?`) — the app turns it into a thin space.
- German: nouns capitalized (`der Bahnhof`, `Guten Morgen`).
- Keep sentences short: **3–12 words** (max 14). Each sentence becomes tile exercises in every
  language, so it must be a complete, natural sentence in all six.

### `words` (12–16 per unit)

```js
{ e: '🍎', en: 'the apple', es: 'la manzana', pt: 'a maçã', fr: 'la pomme', it: 'la mela', de: 'der Apfel' },
{ e: '🍽️', en: 'to eat', es: 'comer', pt: 'comer', fr: 'manger', it: 'mangiare', de: 'essen' },
{ en: 'very', es: 'muy', pt: 'muito', fr: 'très', it: 'molto', de: 'sehr' },
```

- `e` = one emoji (optional, but give an emoji to **at least 8** words: they power the
  "which one is…?" picture exercise). Emojis must be unique within the unit and should picture
  the word unambiguously.
- **Nouns carry the definite article** in every language (`the apple` / `la manzana` / `a maçã` /
  `la pomme` / `la mela` / `der Apfel`) — it teaches gender. **Verbs** are infinitives (`to eat`).
  Other words are bare (`red`, `very`, `hello`).
- Main forms should be unique within the unit in each language (matching pairs need it).
- Prefer words that also appear in this unit's sentences — tapping a word in a sentence shows
  its translation from this list.

### `sentences` (14–20 per unit)

```js
{
  key: true,   // optional: shown as a key phrase (with audio) in the unit Guidebook — mark 3–8
  en: 'I eat an apple.|I am eating an apple.',
  es: 'Como una manzana.|Yo como una manzana.',
  pt: 'Eu como uma maçã.|Como uma maçã.',
  fr: 'Je mange une pomme.',
  it: 'Mangio una mela.|Io mangio una mela.',
  de: 'Ich esse einen Apfel.',
},
```

The engine generates from each sentence: translate with word tiles (both directions), tap what
you hear, type what you hear, fill in the blank, type the translation and say it aloud.
Use mostly the unit's vocabulary plus earlier units; introduce the unit's grammar point in at
least half of the sentences.

### `tips` (Guidebook; 1–3 per target language)

```js
{
  for: ['es', 'pt', 'fr', 'it'],        // optional: target languages this note applies to (default: all)
  title: { pt: 'Masculino e feminino', en: 'Masculine and feminine', es: 'Masculino y femenino' },
  body: {
    pt: 'Em {lang}, todo substantivo tem gênero: o artigo muda com ele.',
    en: 'In {lang}, every noun has a gender, and the article changes with it.',
    es: 'En {lang}, todo sustantivo tiene género y el artículo cambia con él.',
  },
  examples: [ { en: 'the boy', es: 'el niño', pt: 'o menino', fr: 'le garçon', it: 'il ragazzo', de: 'der Junge' } ],
},
```

- `title`/`body` are written in the **learner's** language (pt, en, es). `{lang}` becomes the
  target language name ("francês", "French", "francés"); `**bold**` is supported. Max 3 short
  sentences.
- `examples` (optional) are six-language objects: the app shows the target-language version
  (with audio) and the learner's translation under it. Example text may use `—` and `(casual)`.
- Write a generic note (no `for`) when it applies to all six languages, and language-specific
  notes with `for` (German cases, French elision, Spanish ser/estar, Italian articles…).
  Make sure **every target language gets at least one tip**.

### `stories` (A1–B1: 1 story of 8–14 lines; section 4 role-plays: 2 stories of 12–20 lines)

```js
{
  title: { en: 'At the café', es: 'En el café', pt: 'No café', fr: 'Au café', it: 'Al bar', de: 'Im Café' },
  cast: { A: { name: 'Ana', emoji: '👩🏽' }, B: { name: 'Leo', emoji: '🧑🏻' } },
  lines: [
    { who: 'A', en: '…', es: '…', pt: '…', fr: '…', it: '…', de: '…' },          // a spoken line
    { who: 'B', answer: 0, reply: [ {six langs}, {six langs}, {six langs} ] },     // "What does Leo say?"
    { ask: { pt: '…', en: '…', es: '…' },                                          // comprehension question
      options: [ { pt, en, es }, { pt, en, es }, { pt, en, es } ], answer: 1 },
  ],
}
```

- **Spoken lines**: one speaker each, 1–3 short sentences, no `|` alternatives.
- **`reply`** items (1–3 per story): the learner picks what the speaker says next; the correct
  option (`answer` = index) becomes the line. Wrong options must be grammatical but clearly wrong
  in context. These also feed "choose the reply" exercises in lessons.
- **`ask`** items (1–4 per story): question + 2–4 options in the learner's language (pt/en/es),
  asked right after the lines that contain the answer. Never start a story with a question.
- Names should work in every language: Ana, Leo, Pedro, Maria, Sofia, Lucas, Nina, Marco, Clara,
  Hugo, Emma, Paulo, Julia, Tom, Elena, Max.
- Keep gender consistent per speaker (`obrigada` if Ana speaks, `enchanté` if Leo speaks).

## Size targets per section

| Section | Level | words | sentences | stories |
|---|---|---|---|---|
| 1 | A1 | 14–16 | 14–18, 3–8 words each | 1 × 8–12 lines |
| 2 | A2 | 14–16 | 16–20, up to 10 words | 1 × 10–14 lines |
| 3 | B1 | 12–16 | 16–20, up to 12 words | 1 × 12–16 lines |
| 4 | B2 conversation | 10–14 expressions | 18–22, up to 14 words | 2 × 12–20 lines (role-plays) |

## How the engine uses a unit

Each unit becomes a path of 8 nodes: three vocabulary lessons (words in thirds, new words first,
then sentences), a reward chest, two sentence lessons, the story, and a unit review that mixes in
earlier units. Each section ends with a "legendary" checkpoint. Practice mode reuses all words
(spaced repetition) and sentences of completed units.
