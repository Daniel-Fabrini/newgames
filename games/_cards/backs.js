// Card backs — original vector designs, selectable by id. All drawn in a 250×350 viewBox.
//   BACKS → [{ id, name:{pt,en,es}, tier }]    backSvg(id) → '<svg…>' string   ensureDefs() (called by cardEl)
export const BACKS = [
  { id: 'classic', name: { pt: 'Clássico meia-noite', en: 'Midnight classic', es: 'Clásico medianoche' }, tier: 0 },
  { id: 'emerald', name: { pt: 'Esmeralda', en: 'Emerald', es: 'Esmeralda' }, tier: 0 },
  { id: 'crimson', name: { pt: 'Carmesim', en: 'Crimson', es: 'Carmesí' }, tier: 1 },
  { id: 'royal', name: { pt: 'Azul real', en: 'Royal blue', es: 'Azul real' }, tier: 1 },
  { id: 'mono', name: { pt: 'Minimalista', en: 'Minimal mono', es: 'Minimalista' }, tier: 2 },
  { id: 'deco', name: { pt: 'Art déco', en: 'Art deco', es: 'Art déco' }, tier: 2 },
];
export const DEFAULT_BACK = 'classic';

const GOLD = '#dcb054';
const GOLD_HI = '#f6dc8c';

let defsReady = false;
export function ensureDefs() {
  if (defsReady || typeof document === 'undefined') return;
  if (document.getElementById('dc-defs')) {
    defsReady = true;
    return;
  }
  const holder = document.createElement('div');
  holder.id = 'dc-defs';
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  holder.innerHTML = DEFS;
  (document.body || document.documentElement).prepend(holder);
  defsReady = true;
}

const circles = (pts, radii, stroke, w, op) =>
  pts.map(([x, y]) => radii.map((r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-opacity="${op}"/>`).join('')).join('');

const DEFS = `<svg width="0" height="0" xmlns="http://www.w3.org/2000/svg"><defs>
<linearGradient id="dcb-g-classic" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14265c"/><stop offset=".55" stop-color="#0a1535"/><stop offset="1" stop-color="#070d22"/></linearGradient>
<linearGradient id="dcb-g-emerald" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f6048"/><stop offset=".6" stop-color="#08402f"/><stop offset="1" stop-color="#052a20"/></linearGradient>
<linearGradient id="dcb-g-crimson" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a01a2c"/><stop offset=".6" stop-color="#6f0f1e"/><stop offset="1" stop-color="#470912"/></linearGradient>
<linearGradient id="dcb-g-royal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a55c4"/><stop offset=".6" stop-color="#17358a"/><stop offset="1" stop-color="#0e2063"/></linearGradient>
<linearGradient id="dcb-g-mono" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2d3036"/><stop offset="1" stop-color="#15161a"/></linearGradient>
<linearGradient id="dcb-g-deco" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#17171b"/><stop offset="1" stop-color="#050506"/></linearGradient>
<linearGradient id="dcb-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe6a0"/><stop offset=".5" stop-color="#e2b04c"/><stop offset="1" stop-color="#b9831a"/></linearGradient>
<pattern id="dcb-p-classic" width="20" height="20" patternUnits="userSpaceOnUse">${circles([[0, 0], [20, 0], [0, 20], [20, 20], [10, 10]], [10], GOLD, 0.7, 0.55)}</pattern>
<pattern id="dcb-p-emerald" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M13 0 L26 13 L13 26 L0 13Z" fill="none" stroke="#38c096" stroke-opacity=".45" stroke-width=".9"/><path d="M13 6 L20 13 L13 20 L6 13Z" fill="#38c096" fill-opacity=".16"/><circle cx="13" cy="13" r="1.4" fill="${GOLD_HI}" fill-opacity=".8"/></pattern>
<pattern id="dcb-p-crimson" width="32" height="32" patternUnits="userSpaceOnUse"><g fill="none" stroke="#f1e2c2" stroke-opacity=".5" stroke-width=".9"><ellipse cx="16" cy="9" rx="3.4" ry="7.5"/><ellipse cx="16" cy="23" rx="3.4" ry="7.5"/><ellipse cx="9" cy="16" rx="7.5" ry="3.4"/><ellipse cx="23" cy="16" rx="7.5" ry="3.4"/></g><circle cx="16" cy="16" r="1.8" fill="#f1e2c2" fill-opacity=".7"/><circle cx="0" cy="0" r="1.2" fill="#f1e2c2" fill-opacity=".45"/><circle cx="32" cy="0" r="1.2" fill="#f1e2c2" fill-opacity=".45"/><circle cx="0" cy="32" r="1.2" fill="#f1e2c2" fill-opacity=".45"/><circle cx="32" cy="32" r="1.2" fill="#f1e2c2" fill-opacity=".45"/></pattern>
<pattern id="dcb-p-royal" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M12 2 L14.4 9.6 L22 12 L14.4 14.4 L12 22 L9.6 14.4 L2 12 L9.6 9.6Z" fill="#cfe0ff" fill-opacity=".2" stroke="#cfe0ff" stroke-opacity=".5" stroke-width=".7"/><circle cx="0" cy="0" r="1.3" fill="#cfe0ff" fill-opacity=".55"/><circle cx="24" cy="0" r="1.3" fill="#cfe0ff" fill-opacity=".55"/><circle cx="0" cy="24" r="1.3" fill="#cfe0ff" fill-opacity=".55"/><circle cx="24" cy="24" r="1.3" fill="#cfe0ff" fill-opacity=".55"/></pattern>
<pattern id="dcb-p-mono" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8 L8 0" stroke="#fff" stroke-opacity=".07" stroke-width="1"/></pattern>
<pattern id="dcb-p-deco" width="40" height="40" patternUnits="userSpaceOnUse">${circles([[0, 0], [40, 0], [20, 20], [0, 40], [40, 40]], [19, 14, 9, 4], GOLD, 0.9, 0.7)}</pattern>
</defs></svg>`;

const frame = (stroke, inset = 9, w = 2.2) =>
  `<rect x="${inset}" y="${inset}" width="${250 - inset * 2}" height="${350 - inset * 2}" rx="12" fill="none" stroke="${stroke}" stroke-width="${w}"/>` +
  `<rect x="${inset + 8}" y="${inset + 8}" width="${250 - (inset + 8) * 2}" height="${350 - (inset + 8) * 2}" rx="6" fill="none" stroke="${stroke}" stroke-width=".8" stroke-opacity=".8"/>`;

const field = (id, x = 26) => `<rect x="${x}" y="${x}" width="${250 - 2 * x}" height="${350 - 2 * x}" rx="4" fill="url(#dcb-p-${id})"/>`;

const rosette = (n, rx, ry, off, stroke, w = 1.4) =>
  Array.from({ length: n }, (_, i) => `<ellipse cx="125" cy="${175 - off}" rx="${rx}" ry="${ry}" fill="none" stroke="${stroke}" stroke-width="${w}" transform="rotate(${(360 / n) * i} 125 175)"/>`).join('');

const star = (n, r1, r2, cx = 125, cy = 175, rot = -90) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = ((rot + (180 / n) * i) * Math.PI) / 180;
    const r = i % 2 ? r2 : r1;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');

const BODIES = {
  classic: () =>
    `<rect width="250" height="350" fill="url(#dcb-g-classic)"/>${frame('url(#dcb-gold)')}${field('classic')}` +
    [[40, 40], [210, 40], [40, 310], [210, 310]].map(([x, y]) => `<path d="M${x} ${y - 9} L${x + 9} ${y} L${x} ${y + 9} L${x - 9} ${y}Z" fill="url(#dcb-gold)"/>`).join('') +
    `<circle cx="125" cy="175" r="60" fill="#0a1535" stroke="url(#dcb-gold)" stroke-width="2.4"/><circle cx="125" cy="175" r="53" fill="none" stroke="${GOLD}" stroke-width=".8"/>` +
    rosette(10, 10, 26, 28, GOLD, 1.3) + rosette(10, 5, 14, 22, GOLD_HI, 0.8) +
    `<circle cx="125" cy="175" r="11" fill="url(#dcb-gold)"/><circle cx="125" cy="175" r="4.5" fill="#0a1535"/>`,
  emerald: () =>
    `<rect width="250" height="350" fill="url(#dcb-g-emerald)"/>${frame('#f0dfa4', 9, 2)}${field('emerald')}` +
    `<circle cx="125" cy="175" r="62" fill="#06352a" stroke="#f0dfa4" stroke-width="2"/>` +
    `<polygon points="${star(8, 54, 38)}" fill="#0c5a43" stroke="#f0dfa4" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<polygon points="${star(8, 34, 20, 125, 175, -67.5)}" fill="none" stroke="#38c096" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<circle cx="125" cy="175" r="9" fill="#f0dfa4"/><circle cx="125" cy="175" r="4" fill="#06352a"/>`,
  crimson: () =>
    `<rect width="250" height="350" fill="url(#dcb-g-crimson)"/>${frame('#f1e2c2', 9, 2)}${field('crimson')}` +
    `<path d="M125 85 Q150 150 205 175 Q150 200 125 265 Q100 200 45 175 Q100 150 125 85Z" fill="#5a0b18" stroke="#f1e2c2" stroke-width="2"/>` +
    `<path d="M125 112 Q141 156 180 175 Q141 194 125 238 Q109 194 70 175 Q109 156 125 112Z" fill="none" stroke="#f1e2c2" stroke-width="1.1" stroke-opacity=".8"/>` +
    `<circle cx="125" cy="175" r="17" fill="#f1e2c2"/><circle cx="125" cy="175" r="8" fill="#6f0f1e"/>`,
  royal: () =>
    `<rect width="250" height="350" fill="url(#dcb-g-royal)"/>${frame('#e5edff', 9, 2)}${field('royal')}` +
    `<circle cx="125" cy="175" r="64" fill="#10296f" stroke="#e5edff" stroke-width="2"/><circle cx="125" cy="175" r="56" fill="none" stroke="#e5edff" stroke-width=".8"/>` +
    `<polygon points="${star(12, 50, 36)}" fill="#1f45a8" stroke="#e5edff" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<circle cx="125" cy="175" r="22" fill="#10296f" stroke="#e5edff" stroke-width="1.4"/><polygon points="${star(5, 17, 7)}" fill="#e5edff"/>`,
  mono: () =>
    `<rect width="250" height="350" fill="url(#dcb-g-mono)"/><rect width="250" height="350" fill="url(#dcb-p-mono)"/>` +
    [0, 1, 2, 3].map((i) => `<rect x="${16 + i * 12}" y="${16 + i * 12}" width="${218 - i * 24}" height="${318 - i * 24}" rx="${10 - i * 2}" fill="none" stroke="#f1f1f4" stroke-width="${i === 0 ? 1.8 : 0.9}" stroke-opacity="${1 - i * 0.2}"/>`).join('') +
    `<circle cx="125" cy="175" r="30" fill="none" stroke="#f1f1f4" stroke-width="1.8"/><circle cx="125" cy="175" r="5" fill="#f1f1f4"/>` +
    `<path d="M125 120 V145 M125 205 V230 M70 175 H95 M155 175 H180" stroke="#f1f1f4" stroke-width="1.2" stroke-linecap="round"/>`,
  deco: () =>
    `<rect width="250" height="350" fill="url(#dcb-g-deco)"/>${frame('url(#dcb-gold)', 9, 2.4)}${field('deco')}` +
    `<circle cx="125" cy="175" r="60" fill="#070708" stroke="url(#dcb-gold)" stroke-width="2.4"/>` +
    Array.from({ length: 16 }, (_, i) => `<path d="M125 ${175 - 22} L125 ${175 - 52}" stroke="url(#dcb-gold)" stroke-width="${i % 2 ? 1.2 : 3}" stroke-linecap="round" transform="rotate(${22.5 * i} 125 175)"/>`).join('') +
    `<circle cx="125" cy="175" r="19" fill="#070708" stroke="url(#dcb-gold)" stroke-width="1.6"/><polygon points="${star(4, 14, 5)}" fill="url(#dcb-gold)"/>`,
  uno: () =>
    `<rect width="250" height="350" fill="#16171c"/><rect x="10" y="10" width="230" height="330" rx="14" fill="none" stroke="#f3f3f6" stroke-width="3"/>` +
    `<g transform="rotate(-24 125 175)"><ellipse cx="125" cy="175" rx="96" ry="58" fill="#0d0e12" stroke="#f3f3f6" stroke-width="3"/>` +
    `<path d="M125 117 A96 58 0 0 1 221 175 L125 175Z" fill="#e0394a"/><path d="M221 175 A96 58 0 0 1 125 233 L125 175Z" fill="#f5b82e"/><path d="M125 233 A96 58 0 0 1 29 175 L125 175Z" fill="#2ea866"/><path d="M29 175 A96 58 0 0 1 125 117 L125 175Z" fill="#2f6fe0"/></g>` +
    `<circle cx="125" cy="175" r="16" fill="#16171c" stroke="#f3f3f6" stroke-width="2.5"/>`,
};

/** SVG markup string of a card back (viewBox 0 0 250 350, rounded clip handled by CSS). */
export function backSvg(id = DEFAULT_BACK) {
  const body = (BODIES[id] || BODIES[DEFAULT_BACK])();
  return `<svg class="dc-svg" viewBox="0 0 250 350" preserveAspectRatio="none" aria-hidden="true" focusable="false">${body}</svg>`;
}
