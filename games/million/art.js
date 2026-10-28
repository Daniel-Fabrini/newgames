// Road to a Million — original art: the show host (SVG), host outfits, studio
// themes, league division badges and small icons.

// ---------- host outfits ----------
export const OUTFITS = [
  { id: 'tux', price: 0, name: { pt: 'Smoking clássico', en: 'Classic tuxedo', es: 'Esmoquin clásico' }, j1: '#2a2a33', j2: '#08080b', lapel: '#3b3b47', bow: '#111114', sq: '#f3c24a' },
  { id: 'gold', price: 300, name: { pt: 'Paletó dourado', en: 'Gold jacket', es: 'Saco dorado' }, j1: '#ffe27a', j2: '#a8700a', lapel: '#1a1206', bow: '#111114', sq: '#ffffff' },
  { id: 'ruby', price: 450, name: { pt: 'Veludo vermelho', en: 'Red velvet', es: 'Terciopelo rojo' }, j1: '#e0263f', j2: '#4d0410', lapel: '#7a0b1c', bow: '#111114', sq: '#f3c24a' },
  { id: 'white', price: 600, name: { pt: 'Terno branco', en: 'White suit', es: 'Traje blanco' }, j1: '#ffffff', j2: '#b9b2a2', lapel: '#ece6d8', bow: '#c9971c', sq: '#c9971c' },
  { id: 'royal', price: 800, name: { pt: 'Azul real', en: 'Royal blue', es: 'Azul real' }, j1: '#3a6cf0', j2: '#0a1a5c', lapel: '#0b1440', bow: '#f3c24a', sq: '#f3c24a' },
  { id: 'disco', price: 1100, name: { pt: 'Paetês da noite', en: 'Night sequins', es: 'Lentejuelas' }, j1: '#a35cff', j2: '#2b0a63', lapel: '#14052f', bow: '#e8e8f0', sq: '#e8e8f0', sparkle: true },
  { id: 'carnival', price: 1500, name: { pt: 'Verde-amarelo', en: 'Green & yellow', es: 'Verde y amarillo' }, j1: '#18b765', j2: '#05482a', lapel: '#ffd23f', bow: '#1f4fd1', sq: '#ffd23f' },
];

export const outfitById = (id) => OUTFITS.find((o) => o.id === id) || OUTFITS[0];

// ---------- studio themes ----------
export const STUDIOS = [
  { id: 'gold', price: 0, name: { pt: 'Palco de ouro', en: 'Gold stage', es: 'Escenario dorado' }, bg1: '#2a1d06', bg2: '#070605', spot: 'rgba(255, 216, 120, 0.42)', spot2: 'rgba(255, 244, 214, 0.28)', led: '#f3c24a' },
  { id: 'ruby', price: 350, name: { pt: 'Noite rubi', en: 'Ruby night', es: 'Noche rubí' }, bg1: '#3a0710', bg2: '#0a0204', spot: 'rgba(255, 90, 110, 0.42)', spot2: 'rgba(255, 210, 160, 0.26)', led: '#ff5a6e' },
  { id: 'sapphire', price: 500, name: { pt: 'Safira', en: 'Sapphire', es: 'Zafiro' }, bg1: '#0a1d4a', bg2: '#03060f', spot: 'rgba(110, 170, 255, 0.42)', spot2: 'rgba(220, 235, 255, 0.26)', led: '#6fb0ff' },
  { id: 'emerald', price: 700, name: { pt: 'Esmeralda', en: 'Emerald', es: 'Esmeralda' }, bg1: '#063a24', bg2: '#020a06', spot: 'rgba(80, 240, 160, 0.36)', spot2: 'rgba(230, 255, 200, 0.24)', led: '#43e39a' },
  { id: 'neon', price: 1000, name: { pt: 'Neon', en: 'Neon', es: 'Neón' }, bg1: '#2c0748', bg2: '#06020c', spot: 'rgba(230, 90, 255, 0.42)', spot2: 'rgba(90, 230, 255, 0.32)', led: '#ff5ce1' },
  { id: 'sunset', price: 1400, name: { pt: 'Pôr do sol', en: 'Sunset', es: 'Atardecer' }, bg1: '#4a1a05', bg2: '#0c0402', spot: 'rgba(255, 150, 60, 0.42)', spot2: 'rgba(255, 220, 120, 0.3)', led: '#ff9a3c' },
];

export const studioById = (id) => STUDIOS.find((s) => s.id === id) || STUDIOS[0];

export function studioVars(st) {
  return { '--st-bg1': st.bg1, '--st-bg2': st.bg2, '--st-spot': st.spot, '--st-spot2': st.spot2, '--st-led': st.led };
}

// ---------- the host ----------
// Léo Dourado, the show's own (fictional) host: silver hair, big smile, mic in hand.
// Mood classes on the svg (.mood-happy/.mood-tense/.mood-sad) switch the face;
// .talking animates the mouth.
export function hostSVG(outfitId = 'tux', mood = 'happy') {
  const o = outfitById(outfitId);
  const j = `hmj-${o.id}`;
  const sparkle = o.sparkle
    ? Array.from({ length: 22 }, (_, i) => {
        const x = 30 + ((i * 37) % 100);
        const y = 122 + ((i * 53) % 64);
        return `<circle class="hm-spark" cx="${x}" cy="${y}" r="${1 + (i % 3) * 0.5}" fill="#fff" opacity="${0.35 + (i % 4) * 0.15}" style="animation-delay:${(i % 7) * 0.3}s"/>`;
      }).join('')
    : '';
  return `<svg class="g-million-host-svg mood-${mood}" viewBox="0 0 160 190" aria-hidden="true">
  <defs>
    <linearGradient id="hm-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d0ae"/><stop offset="1" stop-color="#dba07a"/></linearGradient>
    <linearGradient id="hm-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9e6e1"/><stop offset="0.55" stop-color="#a9a49c"/><stop offset="1" stop-color="#6c665f"/></linearGradient>
    <linearGradient id="${j}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${o.j1}"/><stop offset="1" stop-color="${o.j2}"/></linearGradient>
    <radialGradient id="hm-mic" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff6cf"/><stop offset="0.45" stop-color="#e4a21c"/><stop offset="1" stop-color="#5c3d02"/></radialGradient>
  </defs>
  <g class="hm-body">
    <path d="M14 190 C16 150 30 124 60 111 L100 111 C130 124 144 150 146 190 Z" fill="url(#${j})"/>
    <path d="M100 111 C130 124 144 150 146 190 L132 190 C130 160 120 136 100 111Z" fill="#000" opacity="0.18"/>
    ${sparkle}
    <path d="M63 111 L80 152 L97 111 Z" fill="#fbfaf7"/>
    <path d="M80 152 L72 124 L80 129 L88 124 Z" fill="#e3e0d8"/>
    <path d="M60 111 L80 162 L67 133 L72 124 Z" fill="${o.lapel}"/>
    <path d="M100 111 L80 162 L93 133 L88 124 Z" fill="${o.lapel}"/>
    <path d="M60 111 L66 117" stroke="#fff" stroke-opacity="0.25" stroke-width="1.5"/>
    <path d="M67 113 L80 118.5 L93 113 L93 124 L80 119.5 L67 124 Z" fill="${o.bow}"/>
    <rect x="76.5" y="115.5" width="7" height="7" rx="2" fill="${o.bow}" stroke="#fff" stroke-opacity="0.18"/>
    <path d="M106 139 L120 136 L118 143 L107 144 Z" fill="${o.sq}"/>
    <circle cx="80" cy="170" r="2.4" fill="#000" opacity="0.45"/><circle cx="80" cy="182" r="2.4" fill="#000" opacity="0.45"/>
  </g>
  <g class="hm-head">
    <path d="M69 90 L91 90 L92 113 Q80 118 68 113 Z" fill="#d39572"/>
    <ellipse cx="55" cy="70" rx="5" ry="7.5" fill="#e3ad88"/><ellipse cx="105" cy="70" rx="5" ry="7.5" fill="#e3ad88"/>
    <ellipse cx="80" cy="66" rx="25.5" ry="29.5" fill="url(#hm-skin)"/>
    <path d="M54 64 C50 38 66 28 83 29 C101 30 112 41 106 64 C104 54 99 47 92 45 C85 49 70 49 62 46 C58 50 55.5 56 54 64 Z" fill="url(#hm-hair)"/>
    <path d="M62 37 C72 31 90 31 99 37 C90 34 74 34 62 37Z" fill="#fff" opacity="0.5"/>
    <g class="hm-brows" fill="none" stroke="#5d564e" stroke-width="3" stroke-linecap="round">
      <path class="hm-brow-l" d="M64 56 Q70 52 76 55"/><path class="hm-brow-r" d="M84 55 Q90 52 96 56"/>
    </g>
    <g class="hm-eyes">
      <ellipse cx="70" cy="63.5" rx="3.1" ry="3.7" fill="#2a1a12"/><ellipse cx="90" cy="63.5" rx="3.1" ry="3.7" fill="#2a1a12"/>
      <circle cx="71.1" cy="62.3" r="1" fill="#fff"/><circle cx="91.1" cy="62.3" r="1" fill="#fff"/>
    </g>
    <path d="M80 65 Q76.5 75 79.5 77.5 Q82.5 78.6 84.5 76.6" fill="none" stroke="#b9754f" stroke-width="2" stroke-linecap="round"/>
    <circle cx="64.5" cy="77" r="5" fill="#f07a6a" opacity="0.32"/><circle cx="95.5" cy="77" r="5" fill="#f07a6a" opacity="0.32"/>
    <g class="hm-mouth hm-smile">
      <path d="M66 81 Q80 97 94 81 Q80 86 66 81 Z" fill="#6e1717"/>
      <path d="M68.5 82.2 Q80 87 91.5 82.2 L90.4 84.6 Q80 89.4 69.6 84.6 Z" fill="#fff"/>
    </g>
    <g class="hm-mouth hm-open">
      <ellipse cx="80" cy="86" rx="9" ry="7.5" fill="#5a1212"/>
      <path d="M72 81.5 Q80 79.5 88 81.5 L87 84 Q80 83 73 84 Z" fill="#fff"/>
      <ellipse cx="80" cy="90" rx="5" ry="2.6" fill="#d9605e"/>
    </g>
    <g class="hm-mouth hm-oh"><ellipse cx="80" cy="86" rx="5" ry="6" fill="#5a1212"/></g>
    <g class="hm-mouth hm-sad"><path d="M70 89 Q80 81 90 89" fill="none" stroke="#6e1717" stroke-width="3" stroke-linecap="round"/></g>
  </g>
  <g class="hm-arm">
    <path d="M22 190 C22 166 32 148 46 140 L62 151 C53 160 48 174 48 190 Z" fill="url(#${j})"/>
    <path d="M22 190 C22 166 32 148 46 140 L50 143 C38 152 31 168 31 190Z" fill="#fff" opacity="0.08"/>
    <g transform="rotate(16 60 128)">
      <rect x="56" y="113" width="8" height="30" rx="3" fill="#1d1d22"/>
      <rect x="55.6" y="117" width="8.8" height="3.6" rx="1" fill="#e4a21c"/>
      <circle cx="60" cy="107" r="8.6" fill="url(#hm-mic)"/>
      <path d="M53.5 104 h13 M52 108 h16 M53.5 112 h13" stroke="#5c3d02" stroke-opacity="0.35" stroke-width="0.9"/>
    </g>
    <ellipse cx="60" cy="140" rx="9.5" ry="8.5" fill="#e3ad88"/>
    <path d="M55 135 q5 -3 10 0 M54 139 q6 -3 12 0 M55 143 q5 -3 10 0" fill="none" stroke="#b9754f" stroke-width="1.3" stroke-linecap="round"/>
  </g>
</svg>`;
}

// ---------- league divisions ----------
export const DIVISIONS = [
  { id: 'bronze', name: { pt: 'Bronze', en: 'Bronze', es: 'Bronce' }, c1: '#f0b27a', c2: '#8a4b1c' },
  { id: 'silver', name: { pt: 'Prata', en: 'Silver', es: 'Plata' }, c1: '#f4f6fa', c2: '#7d8696' },
  { id: 'gold', name: { pt: 'Ouro', en: 'Gold', es: 'Oro' }, c1: '#fff0a8', c2: '#c98a10' },
  { id: 'platinum', name: { pt: 'Platina', en: 'Platinum', es: 'Platino' }, c1: '#c9fff6', c2: '#2c9c8e' },
  { id: 'diamond', name: { pt: 'Diamante', en: 'Diamond', es: 'Diamante' }, c1: '#d6ecff', c2: '#2f6fd6' },
  { id: 'million', name: { pt: 'Clube do Milhão', en: 'Million Club', es: 'Club del Millón' }, c1: '#fff6cf', c2: '#b97f0e', dark: true },
];

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const roman = (n) => (n <= 10 ? ROMAN[n] : String(n));

// Divisions never end: past the Million Club come Million Club II, III, …
export function divisionInfo(idx) {
  const top = DIVISIONS.length - 1;
  const d = DIVISIONS[Math.min(idx, top)];
  const tier = idx >= top ? idx - top + 1 : 0;
  return { ...d, idx, tier };
}

export function divisionName(idx, pick) {
  const d = divisionInfo(idx);
  return d.tier > 1 ? `${pick(d.name)} ${roman(d.tier)}` : pick(d.name);
}

export function divisionBadge(idx, size = 64) {
  const d = divisionInfo(idx);
  const g = `dv-${d.id}-${idx}`;
  const inner = d.dark ? '#141414' : 'rgba(0,0,0,0.18)';
  const gem =
    d.id === 'million'
      ? `<path d="M22 40 L26 28 L32 35 L36 24 L40 35 L46 28 L50 40 Z" fill="url(#${g})" stroke="#5c3d02" stroke-width="1"/>`
      : d.id === 'diamond'
        ? `<path d="M36 24 L48 34 L36 50 L24 34 Z" fill="#fff" opacity="0.9"/><path d="M24 34 H48 M30 34 L36 24 L42 34 L36 50" fill="none" stroke="${d.c2}" stroke-width="1.2"/>`
        : `<path d="M36 22 l4 8.5 9.3 1.2 -6.8 6.4 1.8 9.2 -8.3 -4.6 -8.3 4.6 1.8 -9.2 -6.8 -6.4 9.3 -1.2 z" fill="#fff" opacity="0.92"/>`;
  const label = d.tier > 1 ? `<text x="36" y="62" text-anchor="middle" font-size="10" font-weight="900" fill="${d.dark ? '#f3c24a' : '#1a1102'}" font-family="Nunito, sans-serif">${roman(d.tier)}</text>` : '';
  return `<svg class="g-million-badge" viewBox="0 0 72 72" width="${size}" height="${size}" aria-hidden="true">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${d.c1}"/><stop offset="1" stop-color="${d.c2}"/></linearGradient></defs>
    <path d="M36 4 L64 14 V36 C64 52 52 63 36 69 C20 63 8 52 8 36 V14 Z" fill="url(#${g})" stroke="#fff6cf" stroke-opacity="0.6" stroke-width="1.5"/>
    <path d="M36 11 L57 18.5 V36 C57 48 48 57 36 62 C24 57 15 48 15 36 V18.5 Z" fill="${inner}"/>
    ${gem}${label}
  </svg>`;
}

// ---------- icons ----------
const I = {
  cards: '<rect x="3" y="5" width="11" height="15" rx="2" fill="currentColor" transform="rotate(-12 8.5 12.5)" opacity="0.55"/><rect x="9" y="3.5" width="11" height="15.5" rx="2" fill="currentColor"/><path d="M14.5 8.2c1.6 1.9 3 3 3 4.4a1.6 1.6 0 0 1-3 .8 1.6 1.6 0 0 1-3-.8c0-1.4 1.4-2.5 3-4.4Z" fill="#111"/>',
  students: '<path d="M12 3 1.5 8 12 13l8.2-3.9V15h1.6V8L12 3Z" fill="currentColor"/><path d="M5.5 11.4v4.3c0 1.9 3 3.8 6.5 3.8s6.5-1.9 6.5-3.8v-4.3L12 14.5l-6.5-3.1Z" fill="currentColor" opacity="0.75"/>',
  audience: '<rect x="3" y="12" width="4" height="9" rx="1" fill="currentColor"/><rect x="10" y="4" width="4" height="17" rx="1" fill="currentColor"/><rect x="17" y="9" width="4" height="12" rx="1" fill="currentColor"/>',
  skip: '<path d="M3 5.5v13l8-6.5-8-6.5Zm8.5 0v13l8-6.5-8-6.5Z" fill="currentColor"/><rect x="19.5" y="5" width="2.2" height="14" rx="1" fill="currentColor"/>',
  ladder: '<path d="M6 2v20M18 2v20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M6 6h12M6 11h12M6 16h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  stop: '<rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor"/>',
  coin: '<circle cx="12" cy="12" r="10" fill="#e4a21c"/><circle cx="12" cy="12" r="8" fill="#ffd768"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#b97f0e" stroke-width="1.2"/><path d="M12 7.5v9M14.2 9.2c-.5-.7-1.3-1-2.2-1-1.3 0-2.2.7-2.2 1.7 0 2.4 4.6 1.3 4.6 3.9 0 1-1 1.8-2.4 1.8-1 0-1.9-.4-2.4-1.2" fill="none" stroke="#7a5200" stroke-width="1.4" stroke-linecap="round"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="11" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/>',
  shop: '<path d="M4 9h16l-1.2 11a1.5 1.5 0 0 1-1.5 1.3H6.7A1.5 1.5 0 0 1 5.2 20L4 9Z" fill="currentColor"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" stroke-width="2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  help: '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.3-1.2.9-1.2 1.7v.5" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.3" fill="#111"/>',
  play: '<path d="M7 4.6v14.8a1 1 0 0 0 1.5.9l12-7.4a1 1 0 0 0 0-1.8l-12-7.4A1 1 0 0 0 7 4.6Z" fill="currentColor"/>',
  trophy: '<path fill="currentColor" d="M7 3h10v2h3a1 1 0 0 1 1 1v1.5a4.5 4.5 0 0 1-4.1 4.5A5.5 5.5 0 0 1 13 15.9V18h3a1 1 0 0 1 1 1v2H7v-2a1 1 0 0 1 1-1h3v-2.1A5.5 5.5 0 0 1 7.1 12 4.5 4.5 0 0 1 3 7.5V6a1 1 0 0 1 1-1h3V3Zm10 4v2.9A2.5 2.5 0 0 0 19 7.5V7h-2ZM5 7v.5a2.5 2.5 0 0 0 2 2.4V7H5Z"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5v-14ZM13 3h5.5A1.5 1.5 0 0 1 20 4.5v14a1.5 1.5 0 0 1-1.5 1.5H13V3Z" fill="currentColor"/>',
  fire: '<path d="M12 2c1 3.5 5 5.8 5 11a5 5 0 0 1-10 0c0-2.4 1.2-4 2.4-5 .1 1.6.8 2.7 2 3.2C11 8.6 11.3 5 12 2Z" fill="currentColor"/>',
};

export function ico(name, cls = '') {
  return `<svg class="g-million-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name] || ''}</svg>`;
}

// Studio preview tile for the shop: a tiny stage in the theme's colours.
export function studioPreview(st) {
  return `<div class="g-million-stprev" style="--st-bg1:${st.bg1};--st-bg2:${st.bg2};--st-spot:${st.spot};--st-spot2:${st.spot2};--st-led:${st.led}">
    <i class="b1"></i><i class="b2"></i><i class="b3"></i><span class="led"></span><span class="floor"></span></div>`;
}
