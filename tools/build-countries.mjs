// Generates js/data/countries.js and copies the flag SVGs to assets/flags/.
//
// Sources:
//   - world-countries (ODbL): codes, region, independence, coordinates, area
//   - Intl.DisplayNames (ICU/CLDR): country names in pt-BR / en / es
//   - wikidata-capitals.csv (CC0, Wikidata SPARQL export): capital names per language
//   - flag-icons (MIT): flag SVGs
//
// Usage: cd tools && npm install && npm run countries

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const WORLD = require('world-countries');
const FLAGS_DIR = path.join(path.dirname(require.resolve('flag-icons/package.json')), 'flags', '4x3');

// Uninhabited / not useful for a quiz.
const SKIP = new Set(['BV', 'HM', 'UM', 'AQ', 'TF', 'GS', 'IO', 'SJ']);

// Well-known flags/countries (level 1). Everything else independent is level 2,
// dependent territories are level 3.
const LEVEL1 = new Set(`US CA MX BR AR CL CO PE UY PY VE BO EC CU JM
GB FR DE IT ES PT NL BE CH AT SE NO DK FI IE IS GR PL RU UA TR CZ HR HU RO
CN JP KR KP IN AU NZ ZA EG NG MA KE IL SA AE TH VN ID PH PK IR IQ SG MY`.split(/\s+/));

const NAME_OVERRIDES = {
  CD: { pt: 'República Democrática do Congo', en: 'DR Congo', es: 'República Democrática del Congo' },
  CG: { pt: 'República do Congo', en: 'Republic of the Congo', es: 'República del Congo' },
  CI: { en: 'Ivory Coast', es: 'Costa de Marfil' },
  MM: { pt: 'Mianmar', en: 'Myanmar', es: 'Myanmar' },
  PS: { pt: 'Palestina', en: 'Palestine', es: 'Palestina' },
  HK: { pt: 'Hong Kong', en: 'Hong Kong', es: 'Hong Kong' },
  MO: { pt: 'Macau', en: 'Macau', es: 'Macao' },
  MF: { en: 'Saint Martin', es: 'San Martín' },
  PM: { pt: 'Saint-Pierre e Miquelon', en: 'Saint Pierre and Miquelon' },
  VC: { en: 'Saint Vincent and the Grenadines' },
  KN: { en: 'Saint Kitts and Nevis' },
  LC: { en: 'Saint Lucia' },
  BL: { en: 'Saint Barthélemy' },
  SH: { en: 'Saint Helena' },
  US: { en: 'United States' },
  AX: { pt: 'Ilhas Åland', es: 'Islas Åland' },
};

// Flags that are not ISO countries but appear in flag quizzes (level 3).
const EXTRA = [
  { code: 'GB-ENG', flag: 'gb-eng', cont: 'eu', lat: 52.5, lng: -1.5, area: 130279,
    name: { pt: 'Inglaterra', en: 'England', es: 'Inglaterra' },
    capital: { pt: 'Londres', en: 'London', es: 'Londres' } },
  { code: 'GB-SCT', flag: 'gb-sct', cont: 'eu', lat: 56.8, lng: -4.2, area: 77933,
    name: { pt: 'Escócia', en: 'Scotland', es: 'Escocia' },
    capital: { pt: 'Edimburgo', en: 'Edinburgh', es: 'Edimburgo' } },
  { code: 'GB-WLS', flag: 'gb-wls', cont: 'eu', lat: 52.3, lng: -3.7, area: 20779,
    name: { pt: 'País de Gales', en: 'Wales', es: 'Gales' },
    capital: { pt: 'Cardiff', en: 'Cardiff', es: 'Cardiff' } },
  { code: 'GB-NIR', flag: 'gb-nir', cont: 'eu', lat: 54.6, lng: -6.7, area: 14130,
    name: { pt: 'Irlanda do Norte', en: 'Northern Ireland', es: 'Irlanda del Norte' },
    capital: { pt: 'Belfast', en: 'Belfast', es: 'Belfast' } },
];

function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

const capitalsByIso = new Map();
for (const [iso2, en, ptBr, pt, es] of parseCsv(fs.readFileSync(path.join(here, 'wikidata-capitals.csv'), 'utf8'))) {
  if (!capitalsByIso.has(iso2)) capitalsByIso.set(iso2, []);
  capitalsByIso.get(iso2).push({ en, pt: ptBr || pt || en, es: es || en });
}

const display = {
  pt: new Intl.DisplayNames(['pt-BR'], { type: 'region' }),
  en: new Intl.DisplayNames(['en'], { type: 'region' }),
  es: new Intl.DisplayNames(['es'], { type: 'region' }),
};
const AND = { pt: ' e ', en: ' and ', es: ' y ' };

function continentOf(c) {
  switch (c.region) {
    case 'Africa': return 'af';
    case 'Asia': return 'as';
    case 'Europe': return 'eu';
    case 'Oceania': return 'oc';
    case 'Americas': return c.subregion === 'South America' ? 'sa' : 'na';
    default: return null;
  }
}

function capitalOf(c) {
  const enCap = (c.capital && c.capital[0]) || '';
  const rows = capitalsByIso.get(c.cca2) || [];
  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  const row = rows.find((r) => strip(r.en) === strip(enCap)) || rows.find((r) => strip(r.en).includes(strip(enCap)) && enCap) || null;
  if (row) return { pt: row.pt, en: row.en, es: row.es };
  if (enCap) return { pt: enCap, en: enCap, es: enCap };
  return null;
}

const out = [];
for (const c of WORLD) {
  const code = c.cca2;
  if (SKIP.has(code)) continue;
  const cont = continentOf(c);
  if (!cont) continue;
  const flagFile = path.join(FLAGS_DIR, code.toLowerCase() + '.svg');
  if (!fs.existsSync(flagFile)) continue;
  const name = {};
  for (const l of ['pt', 'en', 'es']) {
    name[l] = (NAME_OVERRIDES[code] && NAME_OVERRIDES[code][l]) || display[l].of(code).replace(/ & /g, AND[l]);
  }
  const independent = c.independent === true || code === 'XK' || code === 'PS';
  out.push({
    code,
    num: c.ccn3 || null,
    flag: code.toLowerCase(),
    cont,
    level: !independent ? 3 : LEVEL1.has(code) ? 1 : 2,
    independent,
    lat: Math.round(c.latlng[0] * 100) / 100,
    lng: Math.round(c.latlng[1] * 100) / 100,
    area: c.area,
    name,
    capital: capitalOf(c),
  });
}
for (const e of EXTRA) out.push({ num: null, level: 3, independent: false, ...e });

out.sort((a, b) => a.name.en.localeCompare(b.name.en));

// Copy flags.
const flagsOut = path.join(root, 'assets', 'flags');
fs.mkdirSync(flagsOut, { recursive: true });
for (const f of fs.readdirSync(flagsOut)) fs.unlinkSync(path.join(flagsOut, f));
for (const c of out) fs.copyFileSync(path.join(FLAGS_DIR, c.flag + '.svg'), path.join(flagsOut, c.flag + '.svg'));

const header = `// GENERATED by tools/build-countries.mjs — do not edit by hand.
// Country data: world-countries (ODbL), names: Unicode CLDR, capitals: Wikidata (CC0).
//
// Fields:
//   code       ISO 3166-1 alpha-2 (or GB-ENG / GB-SCT / GB-WLS / GB-NIR)
//   num        ISO 3166-1 numeric as a 3-digit string (matches world-atlas feature ids), or null
//   flag       file name in assets/flags/<flag>.svg
//   cont       continent: af | as | eu | na | sa | oc
//   level      1 = well known, 2 = harder independent country, 3 = dependent territory / constituent country
//   independent  boolean
//   lat, lng   approximate center
//   area       km²
//   name       { pt, en, es }
//   capital    { pt, en, es } or null
`;
const body = `export const COUNTRIES = [\n${out.map((c) => '  ' + JSON.stringify(c)).join(',\n')}\n];\n`;
const helpers = `
export const CONTINENTS = ['af', 'as', 'eu', 'na', 'sa', 'oc'];

export function flagUrl(country) {
  return new URL('../../assets/flags/' + country.flag + '.svg', import.meta.url).href;
}

export function byCode(code) {
  return COUNTRIES.find((c) => c.code === code) || null;
}
`;
fs.writeFileSync(path.join(root, 'js', 'data', 'countries.js'), header + body + helpers);
console.log(`countries: ${out.length} (level1 ${out.filter((c) => c.level === 1).length}, level2 ${out.filter((c) => c.level === 2).length}, level3 ${out.filter((c) => c.level === 3).length}); no capital: ${out.filter((c) => !c.capital).map((c) => c.code).join(' ')}`);
