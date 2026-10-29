// Poker World Tour UI strings (pt-BR / en / es). Parts live in ui/str_*.js and are merged here.
import table from './ui/str_table.js';
import app from './ui/str_app.js';

const parts = [table, app];
const out = { pt: {}, en: {}, es: {} };
for (const p of parts) for (const l of ['pt', 'en', 'es']) Object.assign(out[l], p[l]);
export default out;
