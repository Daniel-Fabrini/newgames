// Vector art: crest, trophy, stadium backdrops, crowd silhouettes, silhouette avatars, icons.
// All original; shared gradients live in one persistent <svg> (`defs()`), referenced as url(#tc-…).
import { rng } from './rngart.js';

const star5 = (cx, cy, R, fill) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * 0.4 : R;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="rgba(0,0,0,.35)" stroke-width=".8" stroke-linejoin="round"/>`;
};

/** SPFC crest (white pentagon shield, black banner, red/black triangles, white stem, 5 stars). */
export function crest({ stars = true, cls = '' } = {}) {
  const st = stars
    ? [
        [225, 34, '#e8202a'],
        [80, 94, '#ffd21f'],
        [178, 94, '#e8202a'],
        [274, 94, '#e8202a'],
        [370, 94, '#ffd21f'],
      ]
        .map(([x, y, c]) => star5(x, y, 30, c))
        .join('')
    : '';
  const vb = stars ? '0 0 455 520' : '14 120 427 398';
  return (
    `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" aria-hidden="true">${st}` +
    `<path d="M28 128H427V270L227.5 510L28 270Z" fill="#fff" stroke="#111" stroke-width="5" stroke-linejoin="miter"/>` +
    `<rect x="52" y="152" width="351" height="100" fill="#111"/>` +
    `<text x="227.5" y="232" text-anchor="middle" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="92" fill="#fff" textLength="318" lengthAdjust="spacingAndGlyphs">SPFC</text>` +
    `<polygon points="53,272 198,272 198,442" fill="#e8202a"/><polygon points="402,272 257,272 257,442" fill="#111"/></svg>`
  );
}

/** shared gradients (inject once, keep for the whole mount) */
export const defs = () =>
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="tc-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".35" stop-color="#f7cf4f"/><stop offset=".7" stop-color="#d9981a"/><stop offset="1" stop-color="#8e5a07"/></linearGradient>
<linearGradient id="tc-goldH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a4b06"/><stop offset=".18" stop-color="#e9ae2a"/><stop offset=".42" stop-color="#fff0a0"/><stop offset=".62" stop-color="#f0bb36"/><stop offset=".85" stop-color="#b47810"/><stop offset="1" stop-color="#6b4005"/></linearGradient>
<linearGradient id="tc-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff3a43"/><stop offset=".55" stop-color="#d4101c"/><stop offset="1" stop-color="#8a0710"/></linearGradient>
<linearGradient id="tc-black" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34343a"/><stop offset="1" stop-color="#0a0a0c"/></linearGradient>
<radialGradient id="tc-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".25" stop-color="#fff4d8" stop-opacity=".85"/><stop offset=".6" stop-color="#ff8a70" stop-opacity=".25"/><stop offset="1" stop-color="#ff3030" stop-opacity="0"/></radialGradient>
<linearGradient id="tc-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0e0" stop-opacity=".34"/><stop offset="1" stop-color="#ff5a50" stop-opacity="0"/></linearGradient>
</defs></svg>`;

// ---------------------------------------------------------------- trophy
/** Golden cup with the crest on the bowl, on a plinth. */
export function trophy({ cls = '' } = {}) {
  return `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 300" aria-hidden="true">
<ellipse cx="110" cy="286" rx="86" ry="10" fill="#000" opacity=".45"/>
<path d="M50 268h120l8 14H42z" fill="url(#tc-black)" stroke="#e9ae2a" stroke-width="2"/>
<rect x="62" y="244" width="96" height="26" rx="4" fill="url(#tc-goldH)"/>
<path d="M70 244c4-12 14-18 40-18s36 6 40 18z" fill="url(#tc-goldH)"/>
<rect x="96" y="176" width="28" height="56" fill="url(#tc-goldH)"/>
<ellipse cx="110" cy="196" rx="22" ry="7" fill="url(#tc-goldH)"/><ellipse cx="110" cy="216" rx="20" ry="6" fill="url(#tc-goldH)"/>
<path d="M44 52c-30 0-34 40-6 62 14 11 30 12 36 10l2-14c-10 2-20-2-26-12-8-13-2-28 10-28z" fill="none" stroke="url(#tc-goldH)" stroke-width="11" stroke-linecap="round"/>
<path d="M176 52c30 0 34 40 6 62-14 11-30 12-36 10l-2-14c10 2 20-2 26-12 8-13 2-28-10-28z" fill="none" stroke="url(#tc-goldH)" stroke-width="11" stroke-linecap="round"/>
<path d="M36 36h148c0 62-14 112-74 140C50 148 36 98 36 36z" fill="url(#tc-goldH)"/>
<path d="M46 40h20c0 56 10 96 36 122-34-24-56-60-56-122z" fill="#fff" opacity=".28"/>
<ellipse cx="110" cy="36" rx="74" ry="11" fill="#f9d96a"/><ellipse cx="110" cy="36" rx="64" ry="7" fill="#7a4b06"/>
<g transform="translate(86 62) scale(.092)">${crest({ stars: true }).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
</svg>`;
}

// ---------------------------------------------------------------- stadium backdrop
const FLAG_COLS = ['#d4101c', '#f4f4f4', '#141416'];
const flag = (x, y, w, h, cls = '', dir = 1) => {
  const hh = h / 3;
  return `<g class="tc-flag ${cls}" transform="translate(${x} ${y})"><rect x="0" y="0" width="1.6" height="${h * 2.4}" fill="#d9d2c4"/>${FLAG_COLS.map(
    (c, i) => `<rect x="${dir > 0 ? 1.6 : -w}" y="${i * hh}" width="${w}" height="${hh + 0.4}" fill="${c}"/>`,
  ).join('')}</g>`;
};

/** Floodlit night stadium: lights, light beams, stands full of fans (red/white/black), flags. viewBox 390×844 (slice). */
export function stadiumBg(seed = 7) {
  const R = rng(seed);
  const W = 390;
  const H = 844;
  const cols = [
    ['#c40f1b', 0.34],
    ['#f1f1f1', 0.26],
    ['#16161a', 0.22],
    ['#7d0a12', 0.18],
  ];
  const buckets = cols.map(() => []);
  const rows = [];
  // three tiers of stands curving around, denser/smaller towards the top
  const tiers = [
    { y0: 150, y1: 330, r: 3.4 },
    { y0: 330, y1: 520, r: 4.3 },
    { y0: 520, y1: 720, r: 5.4 },
  ];
  for (const t of tiers) {
    const n = Math.round((t.y1 - t.y0) / (t.r * 2.4));
    for (let i = 0; i < n; i++) {
      const y = t.y0 + (i + 0.5) * ((t.y1 - t.y0) / n);
      const step = t.r * 2.1;
      for (let x = (i % 2) * (step / 2) - 2; x < W + 4; x += step) {
        let r = R();
        let k = 0;
        for (; k < cols.length - 1; k++) {
          r -= cols[k][1];
          if (r < 0) break;
        }
        const rr = t.r * (0.85 + R() * 0.25);
        const px = x + (R() - 0.5) * 1.2;
        const py = y + (R() - 0.5) * 1.2;
        buckets[k].push(`M${px.toFixed(1)} ${(py - rr).toFixed(1)}a${rr.toFixed(1)} ${rr.toFixed(1)} 0 1 0 .1 0zM${(px - rr * 1.5).toFixed(1)} ${(py + rr * 2.1).toFixed(1)}q0 ${(-rr * 2.1).toFixed(1)} ${(rr * 1.5).toFixed(1)} ${(-rr * 0.4).toFixed(1)}q${(rr * 1.5).toFixed(1)} ${(-rr * 1.7).toFixed(1)} ${(rr * 1.5).toFixed(1)} ${(rr * 0.4).toFixed(1)}z`);
      }
    }
    rows.push(t);
  }
  const people = buckets.map((b, i) => `<path d="${b.join('')}" fill="${cols[i][0]}"/>`).join('');
  // light clusters along the top rim
  let lights = '';
  const spots = [
    [48, 78, 1],
    [118, 52, 1.15],
    [195, 40, 1.3],
    [272, 52, 1.15],
    [342, 78, 1],
    [14, 140, 0.8],
    [376, 140, 0.8],
  ];
  const beams = spots
    .map(([x, y]) => `<polygon points="${x - 5},${y} ${x + 5},${y} ${x + (195 - x) * 0.9 + 70},${H * 0.78} ${x + (195 - x) * 0.9 - 70},${H * 0.78}" fill="url(#tc-beam)" class="tc-beam"/>`)
    .join('');
  for (const [x, y, s] of spots) {
    lights += `<g class="tc-lamp"><circle cx="${x}" cy="${y}" r="${46 * s}" fill="url(#tc-glow)"/>`;
    for (let i = 0; i < 6; i++) lights += `<circle cx="${x + ((i % 3) - 1) * 7 * s}" cy="${y + (i < 3 ? -4 : 4) * s}" r="${2.4 * s}" fill="#fff"/>`;
    lights += '</g>';
  }
  // flags & banners over the stands (edges + mid)
  let flags = '';
  const fp = [
    [10, 300, 20, 14, 'a'],
    [40, 410, 16, 11, 'b'],
    [70, 560, 22, 15, 'c'],
    [370, 330, -20, 14, 'b'],
    [338, 450, -16, 11, 'a'],
    [310, 590, -22, 15, 'c'],
    [180, 480, 14, 10, 'a'],
    [225, 600, -14, 10, 'b'],
    [120, 250, 12, 9, 'c'],
    [260, 270, -12, 9, 'a'],
  ];
  for (const [x, y, w, h, c] of fp) flags += flag(x, y, Math.abs(w), h, c, w > 0 ? 1 : -1);
  // roof rim
  const rim = `<path d="M-10 170Q195 60 400 170L400 190Q195 82 -10 190Z" fill="#050506"/><path d="M-10 190Q195 82 400 190" fill="none" stroke="#3a0a0e" stroke-width="2"/>`;
  return `<svg class="tc-bg-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<rect width="${W}" height="${H}" fill="#0a0507"/>
<g opacity=".92">${people}</g>
${flags}
<rect y="130" width="${W}" height="${H - 130}" fill="url(#tc-fade)" opacity="0"/>
${rim}
<g class="tc-beams">${beams}</g>
<g class="tc-lamps">${lights}</g>
</svg>`;
}

/** crowd silhouettes with raised arms & flags (black), for victory screens. viewBox 390×150 */
export function crowdSil(seed = 3) {
  const R = rng(seed);
  let body = '';
  let flags = '';
  for (let x = -6; x < 400; x += 15 + R() * 6) {
    const h = 50 + R() * 46;
    const y = 150 - h;
    const arm = R() < 0.55;
    body += `<circle cx="${x.toFixed(1)}" cy="${(y + 7).toFixed(1)}" r="${6.4 + R() * 1.5}"/><path d="M${x - 12} 152q0-${h - 14} 12-${h - 14}q12 0 12 ${h - 14}z"/>`;
    if (arm) {
      const dx = (R() - 0.5) * 12;
      body += `<path d="M${x + 5} ${y + 18}l${dx + 4} -${22 + R() * 10}" stroke="#050506" stroke-width="4.4" stroke-linecap="round" fill="none"/>`;
    }
    if (R() < 0.17) flags += flag(x + 6, y - 30 - R() * 8, 18 + R() * 8, 12, ['a', 'b', 'c'][Math.floor(R() * 3)]);
  }
  return `<svg class="tc-crowd" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><g fill="#050506">${body}</g>${flags}</svg>`;
}

/** The "Morumbi" strip of the mode screen: dusk sky, stands, floodlit pitch in perspective. viewBox 360×150 */
export function stadiumStrip(seed = 11) {
  const R = rng(seed);
  let fans = '';
  const cols = ['#c40f1b', '#f2f2f2', '#18181b', '#a30c16'];
  const arcs = [
    [34, 78, 70],
    [28, 62, 95],
    [22, 46, 120],
  ];
  arcs.forEach(([yTop, yBot, half], k) => {
    for (let x = 180 - half * 2.5; x <= 180 + half * 2.5; x += 4.2) {
      const t = Math.abs(x - 180) / (half * 2.5);
      const yy = yTop + (yBot - yTop) * (1 - t * t * 0.0) + t * t * 22;
      for (let y = yy; y < yy + 14; y += 4.2) {
        fans += `<circle cx="${(x + (R() - 0.5) * 1.5).toFixed(1)}" cy="${(y + (R() - 0.5)).toFixed(1)}" r="1.5" fill="${cols[Math.floor(R() * 4)]}"/>`;
      }
    }
  });
  let stripes = '';
  for (let i = 0; i < 8; i++) {
    const y0 = 96 + i * 8.5;
    stripes += `<rect x="0" y="${y0}" width="360" height="4.6" fill="#000" opacity="${i % 2 ? 0.12 : 0}"/>`;
  }
  return `<svg class="tc-strip" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs><linearGradient id="tcs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26508f"/><stop offset=".6" stop-color="#8aa3c9"/><stop offset="1" stop-color="#e9b98a"/></linearGradient>
<linearGradient id="tcs-pitch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d8f3b"/><stop offset="1" stop-color="#1f6a28"/></linearGradient></defs>
<rect width="360" height="150" fill="url(#tcs-sky)"/>
<path d="M0 44Q180 -6 360 44V104H0Z" fill="#1b1d24"/>
<path d="M0 54Q180 8 360 54" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
${fans}
<path d="M0 100Q180 70 360 100V150H0Z" fill="url(#tcs-pitch)"/>${stripes}
<ellipse cx="180" cy="124" rx="52" ry="12" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.6"/>
<line x1="0" y1="122" x2="360" y2="122" stroke="#fff" stroke-opacity=".4" stroke-width="1.2"/>
<g transform="translate(168 108) scale(.052)">${crest({ stars: false }).replace(/<svg[^>]*>|<\/svg>/g, '').replace(/<text[^>]*>.*?<\/text>/, '')}</g>
<rect x="0" y="100" width="360" height="1.4" fill="#fff" opacity=".35"/>
</svg>`;
}

// ---------------------------------------------------------------- avatars (silhouettes — no real people)
const AV_BG = ['#7a0c14', '#4b0a10', '#2a0608'];
/** @param {'exPlayer'|'coach'|'fan'|'journalist'|'director'} kind */
export function avatar(kind) {
  const skin = '#0d0d10';
  const shoulders = {
    exPlayer: `<path d="M20 190c0-34 24-52 60-56h40c36 4 60 22 60 56z" fill="#c8101c"/><path d="M92 134l28 26 28-26z" fill="#fff" opacity=".9"/><path d="M104 150h32v40h-32z" fill="#fff" opacity=".12"/>`,
    coach: `<path d="M20 190c0-34 24-52 60-56h40c36 4 60 22 60 56z" fill="#1b1b20"/><path d="M104 134l16 40 16-40z" fill="#fff"/><path d="M116 140h8l3 34-7 8-7-8z" fill="#c8101c"/>`,
    fan: `<path d="M20 190c0-34 24-52 60-56h40c36 4 60 22 60 56z" fill="#f1f1f1"/><path d="M70 136c20 26 80 26 100 0l6 12c-24 34-88 34-112 0z" fill="#c8101c"/><rect x="86" y="148" width="14" height="42" fill="#141416" transform="rotate(14 93 168)"/>`,
    journalist: `<path d="M20 190c0-34 24-52 60-56h40c36 4 60 22 60 56z" fill="#2b2b33"/><path d="M104 134l16 22 16-22z" fill="#d8d8de"/><rect x="170" y="150" width="9" height="34" rx="4" fill="#9a9aa4"/><circle cx="174.5" cy="146" r="9" fill="#c8101c"/>`,
    director: `<path d="M20 190c0-34 24-52 60-56h40c36 4 60 22 60 56z" fill="#16161b"/><path d="M104 134l16 30 16-30z" fill="#fff"/><path d="M118 142h4l2 18-4 4-4-4z" fill="#d6a823"/>`,
  }[kind];
  const head = {
    exPlayer: `<ellipse cx="120" cy="92" rx="30" ry="36" fill="${skin}"/><path d="M90 84c4-26 56-26 60 0-14-10-46-10-60 0z" fill="#050506"/>`,
    coach: `<ellipse cx="120" cy="92" rx="30" ry="36" fill="${skin}"/><path d="M89 86c0-22 18-30 31-30s31 8 31 30c-8-12-22-18-31-18s-23 6-31 18z" fill="#2c2c32"/>`,
    fan: `<ellipse cx="120" cy="94" rx="30" ry="35" fill="${skin}"/><path d="M86 82c0-26 20-34 34-34s34 8 34 34c-12-6-22-8-34-8s-22 2-34 8z" fill="#c8101c"/><rect x="82" y="80" width="76" height="8" rx="4" fill="#f1f1f1"/>`,
    journalist: `<ellipse cx="120" cy="92" rx="30" ry="36" fill="${skin}"/><path d="M88 90c0-34 64-34 64 0" fill="none" stroke="#6a6a74" stroke-width="5"/><rect x="82" y="86" width="9" height="20" rx="4" fill="#6a6a74"/>`,
    director: `<ellipse cx="120" cy="92" rx="30" ry="36" fill="${skin}"/><path d="M92 80c8-18 48-18 56 0-14-6-42-6-56 0z" fill="#3a3a42"/><rect x="96" y="90" width="20" height="13" rx="5" fill="none" stroke="#d6a823" stroke-width="3"/><rect x="124" y="90" width="20" height="13" rx="5" fill="none" stroke="#d6a823" stroke-width="3"/>`,
  }[kind];
  return `<svg class="tc-avatar-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 190" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<defs><radialGradient id="tca-bg-${kind}" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#b3141f"/><stop offset=".6" stop-color="${AV_BG[0]}"/><stop offset="1" stop-color="#1a0407"/></radialGradient></defs>
<rect width="240" height="190" fill="url(#tca-bg-${kind})"/>
<g opacity=".25" fill="#fff"><circle cx="30" cy="30" r="3"/><circle cx="200" cy="22" r="2.4"/><circle cx="214" cy="60" r="3.4"/><circle cx="24" cy="70" r="2.2"/></g>
<rect x="107" y="118" width="26" height="22" fill="${skin}"/>${shoulders}${head}</svg>`;
}

// ---------------------------------------------------------------- icons (24×24, currentColor)
const P = {
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M9.5 18h5"/>',
  bolt: '<path d="M13 2 5 13h6l-1 9 8-12h-6z" fill="currentColor"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.6" cy="6" r="1.2" fill="currentColor"/><circle cx="3.6" cy="12" r="1.2" fill="currentColor"/><circle cx="3.6" cy="18" r="1.2" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  grad: '<path d="m2 9 10-5 10 5-10 5z" fill="currentColor"/><path d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5M22 9v6"/>',
  bars: '<path d="M5 20V10M12 20V4M19 20v-7" stroke-width="3.2" stroke-linecap="butt"/>',
  cup: '<path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8"/>',
  shield: '<path d="M4 4h16v9c0 4-4 6-8 8-4-2-8-4-8-8z" fill="currentColor"/><rect x="6.4" y="6.6" width="11.2" height="3.4" fill="#000" opacity=".8"/>',
  shirt: '<path d="m8 3-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c-1 2-5 2-8 0z" fill="currentColor"/>',
  coach: '<circle cx="12" cy="7" r="4" fill="currentColor"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8z" fill="currentColor"/>',
  stadium: '<path d="M2 9c0-2 4-4 10-4s10 2 10 4v6c0 2-4 4-10 4S2 17 2 15z"/><ellipse cx="12" cy="12" rx="6" ry="2.6"/><path d="M12 9.4v5.2"/>',
  swords: '<path d="m4 4 16 16M20 4 4 20"/><path d="m4 4 4 0 0 4M20 4h-4v4M4 20l3-3M20 20l-3-3"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  star: '<path d="m12 3 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z" fill="currentColor"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  crowd: '<circle cx="12" cy="8" r="3" fill="currentColor"/><circle cx="5.5" cy="10" r="2.3" fill="currentColor"/><circle cx="18.5" cy="10" r="2.3" fill="currentColor"/><path d="M6.5 20c0-4 2.5-6 5.5-6s5.5 2 5.5 6zM1 19c0-3 1.6-4.7 4-4.8M23 19c0-3-1.6-4.7-4-4.8" fill="currentColor"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" fill="currentColor"/>',
  swap: '<path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2"/><path d="M20 3v5h-5M4 21v-5h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1" stroke-width="2.6"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="m17 9 5 6M22 9l-5 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="m4 12 5 5L20 6" stroke-width="3"/>',
  cross: '<path d="M6 6l12 12M18 6 6 18" stroke-width="3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  hat: '<path d="m2 9 10-5 10 5-10 5z" fill="currentColor"/><path d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5"/>',
  skull: '<path d="M12 3C7 3 4 6.5 4 10.5c0 2.6 1.4 4.3 3 5.3V20h10v-4.2c1.6-1 3-2.7 3-5.3C20 6.5 17 3 12 3z" fill="currentColor"/><circle cx="9" cy="11" r="1.8" fill="#000"/><circle cx="15" cy="11" r="1.8" fill="#000"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  back: '<path d="m15 5-7 7 7 7" stroke-width="3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18" stroke-width="2.6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  ladder: '<path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
};
export const ico = (n, cls = '') => `<svg class="tc-ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
