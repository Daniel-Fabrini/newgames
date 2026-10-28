// Sea Battle — career: ranks (endless stars after the top rank), medals,
// unlockable ship paints and sea themes.

export const RANK_XP = [0, 200, 500, 900, 1400, 2000, 2800, 3800, 5000, 6500, 8300, 10500, 13000, 16000, 19500, 23500, 28000, 33000];
export const STAR_XP = 6000;
export const TOP_RANK = RANK_XP.length - 1;

export function rankInfo(xp) {
  xp = Math.max(0, xp | 0);
  let idx = 0;
  while (idx < TOP_RANK && xp >= RANK_XP[idx + 1]) idx++;
  if (idx === TOP_RANK) {
    const over = xp - RANK_XP[idx];
    const stars = Math.floor(over / STAR_XP);
    const from = RANK_XP[idx] + stars * STAR_XP;
    return { idx, stars, from, to: from + STAR_XP, pct: (xp - from) / STAR_XP, xp };
  }
  const from = RANK_XP[idx];
  const to = RANK_XP[idx + 1];
  return { idx, stars: 0, from, to, pct: (xp - from) / (to - from), xp };
}

// Ship paints and sea themes unlock by rank index.
export const SKIN_UNLOCK = { grey: 0, teak: 2, blue: 4, arctic: 6, dazzle: 8, rust: 10, stealth: 12, gold: 15 };
export const THEME_UNLOCK = { atlantic: 0, tropical: 1, night: 3, arctic: 5, radar: 7, sunset: 9, imperial: 13 };

export const MEDALS = [
  { id: 'firstSink', icon: '💥', xp: 50 },
  { id: 'firstWin', icon: '🏆', xp: 100 },
  { id: 'eagle', icon: '🎯', xp: 150 },
  { id: 'intact', icon: '🛡️', xp: 200 },
  { id: 'thread', icon: '🪢', xp: 150 },
  { id: 'chain', icon: '🔥', xp: 120 },
  { id: 'tide', icon: '🌊', xp: 200 },
  { id: 'wolf', icon: '🐺', xp: 250 },
  { id: 'hunter', icon: '⚓', xp: 400 },
  { id: 'salvo', icon: '💣', xp: 150 },
  { id: 'north', icon: '❄️', xp: 150 },
  { id: 'classic', icon: '📜', xp: 150 },
  { id: 'duel', icon: '🤝', xp: 100 },
  { id: 'blitz', icon: '⚡', xp: 250 },
  { id: 'veteran', icon: '🎖️', xp: 300 },
  { id: 'fleetHunter', icon: '🚢', xp: 500 },
  { id: 'centurion', icon: '👑', xp: 800 },
];

// Medal ids earned by this match (only the new ones are rewarded by the caller).
export function medalsFor(ev, career) {
  const out = [];
  const add = (id) => out.push(id);
  if (ev.sunk > 0) add('firstSink');
  if (ev.bestRun >= 5) add('chain');
  if (ev.twoP) add('duel');
  if (ev.win && !ev.twoP) {
    add('firstWin');
    if (ev.acc >= 0.6) add('eagle');
    if (ev.lost === 0) add('intact');
    if (ev.left === 1) add('thread');
    if (career.streak >= 3) add('tide');
    if (ev.ai === 'hard' || ev.ai === 'admiral') add('wolf');
    if (ev.ai === 'admiral') add('hunter');
    if (ev.rule === 'salvo') add('salvo');
    if (ev.fleet === 'russian') add('north');
    if (ev.fleet === 'classic') add('classic');
    if (ev.shots <= Math.round(ev.cells * 2.2) && ev.ai !== 'easy') add('blitz');
  }
  if (career.matches >= 25) add('veteran');
  if (career.sunk >= 100) add('fleetHunter');
  if (career.wins >= 100) add('centurion');
  return out;
}

const DIFF_MULT = { easy: 1, medium: 1.5, hard: 2.2, admiral: 3 };
const FLEET_BONUS = { standard: 0, classic: 25, russian: 25 };

// Career XP for one match. Returns { total, parts: [[key, n], ...] }.
export function matchXP(ev) {
  const parts = [];
  if (ev.twoP) {
    parts.push(['xpDuel', 60]);
  } else {
    const m = DIFF_MULT[ev.ai] || 1;
    if (ev.win) {
      parts.push(['xpVictory', Math.round(100 * m)]);
      parts.push(['xpAccuracy', Math.round(ev.acc * 100 * m * 0.6)]);
      if (ev.lost === 0) parts.push(['xpIntact', Math.round(50 * m)]);
    } else {
      parts.push(['xpBattle', Math.round(30 * m)]);
    }
    parts.push(['xpSunk', Math.round(ev.sunk * 8 * m)]);
    if (FLEET_BONUS[ev.fleet]) parts.push(['xpFleet', FLEET_BONUS[ev.fleet]]);
  }
  return { total: parts.reduce((a, p) => a + p[1], 0), parts };
}

// ---------------------------------------------------------------- insignia (SVG)
// Enlisted: stripes then chevrons; officers: sleeve stripes; flag officers: stars.
export function insigniaSVG(idx, stars = 0) {
  const gold = 'url(#gnvGold)';
  let art = '';
  const star = (x, y, r) => {
    let d = '';
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.45 : r;
      d += (k ? 'L' : 'M') + (x + Math.cos(a) * rr).toFixed(2) + ' ' + (y + Math.sin(a) * rr).toFixed(2);
    }
    return `<path d="${d}Z" fill="${gold}"/>`;
  };
  const chevron = (y) => `<path d="M18 ${y + 8} L32 ${y} L46 ${y + 8} L46 ${y + 13} L32 ${y + 5} L18 ${y + 13}Z" fill="${gold}"/>`;
  const bar = (y, h = 5) => `<rect x="15" y="${y}" width="34" height="${h}" rx="1.5" fill="${gold}"/>`;
  if (idx <= 1) {
    for (let k = 0; k <= idx; k++) art += `<path d="M${20 + k * 9} 44 L${30 + k * 9} 20 L${35 + k * 9} 20 L${25 + k * 9} 44Z" fill="${gold}"/>`;
  } else if (idx <= 5) {
    const n = Math.min(3, idx - 1);
    const top = 24 - (n - 1) * 5;
    art += star(32, top - 8, 5);
    for (let k = 0; k < n; k++) art += chevron(top + k * 9);
    if (idx === 5) art += `<path d="M18 ${top + n * 9 + 2} Q32 ${top + n * 9 + 12} 46 ${top + n * 9 + 2} L46 ${top + n * 9 + 7} Q32 ${top + n * 9 + 17} 18 ${top + n * 9 + 7}Z" fill="${gold}"/>`;
  } else if (idx === 6) {
    art += `<g fill="none" stroke="${gold}" stroke-width="3.2" stroke-linecap="round"><circle cx="32" cy="18" r="4"/><path d="M32 22 V47 M24 28 H40 M19 38 Q22 48 32 48 Q42 48 45 38"/></g>`;
  } else if (idx <= 12) {
    // ensign .. captain: stripes (thin = half stripe)
    const sets = { 7: [5], 8: [5, 2], 9: [5, 5], 10: [5, 2, 5], 11: [5, 5, 5], 12: [5, 5, 5, 5] }[idx];
    const total = sets.reduce((a, h) => a + h + 3, -3);
    let y = 38 - total / 2 + 6;
    art += star(32, y - 9, 5);
    for (const h of sets) {
      art += bar(y, h);
      y += h + 3;
    }
  } else if (idx === 13) {
    art += star(32, 22, 8) + bar(36, 9);
  } else {
    const n = idx - 12; // 2..5 stars
    const r = n >= 5 ? 5.4 : n === 4 ? 6 : 7;
    if (n >= 5) {
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
        art += star(32 + Math.cos(a) * 12, 33 + Math.sin(a) * 12, r);
      }
    } else {
      const w = (n - 1) * r * 2.3;
      for (let k = 0; k < n; k++) art += star(32 - w / 2 + k * r * 2.3, 32, r);
    }
  }
  const extra = stars > 0 ? `<g><circle cx="50" cy="50" r="11" fill="#0b0b0e" stroke="${gold}" stroke-width="1.5"/><text x="50" y="54.5" text-anchor="middle" font-size="12" font-weight="900" fill="#ffe08a" font-family="Nunito,system-ui,sans-serif">${stars}</text></g>` : '';
  return `<svg viewBox="0 0 64 64" class="g-naval-insignia" aria-hidden="true"><defs><linearGradient id="gnvGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".45" stop-color="#f3c24a"/><stop offset="1" stop-color="#b47d10"/></linearGradient><radialGradient id="gnvBadge" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#1d2a44"/><stop offset="1" stop-color="#070b14"/></radialGradient></defs><circle cx="32" cy="32" r="29" fill="url(#gnvBadge)" stroke="${gold}" stroke-width="2.5"/><circle cx="32" cy="32" r="25" fill="none" stroke="rgba(243,194,74,.35)" stroke-width="1" stroke-dasharray="2 3"/>${art}${extra}</svg>`;
}
