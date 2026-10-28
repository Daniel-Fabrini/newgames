// Original characters drawn as SVG portraits (64x64).
const CFG = {
  zelia:   { bg: '#7a2d4a', skin: '#f1c6a0', hair: '#d7d3dc', style: 'bun', glasses: true, cloth: '#e05f8b', apron: true },
  teodoro: { bg: '#8a6a2a', skin: '#d9a26f', hair: '#ece6d8', style: 'short', mustache: true, hat: 'straw', cloth: '#4f7a3a' },
  lia:     { bg: '#1f6f8b', skin: '#f0c29a', hair: '#7a4a22', style: 'ponytail', hat: 'cap', goggles: true, cloth: '#e8a33d' },
  bento:   { bg: '#4a4a58', skin: '#c98c5d', hair: '#2b2b2b', style: 'short', beard: true, hat: 'helmet', cloth: '#6b7280' },
  marta:   { bg: '#2e6b4f', skin: '#e2b08a', hair: '#2a1d15', style: 'bob', glasses: true, scarf: '#2e9a6b', cloth: '#3c6e91' },
  caio:    { bg: '#6b2d2d', skin: '#b8794e', hair: '#1f1f1f', style: 'short', mustache: true, hat: 'conductor', cloth: '#1f2a44' },
  sol:     { bg: '#20507a', skin: '#f0c9a4', hair: '#8a2e2e', style: 'long', hat: 'captain', cloth: '#ffffff' },
};

export function portrait(id) {
  const c = CFG[id] || CFG.zelia;
  const g = `pg-${id}`;
  const hairBack = {
    bun: '',
    long: `<path d="M19 26 Q18 52 22 56 L42 56 Q46 52 45 26 Z" fill="${c.hair}"/>`,
    ponytail: `<path d="M44 22 Q56 30 50 48 Q48 52 45 46 Q48 34 40 26 Z" fill="${c.hair}"/>`,
    bob: `<path d="M19 24 Q18 44 22 46 L42 46 Q46 44 45 24 Z" fill="${c.hair}"/>`,
    short: '',
  }[c.style];
  const hairTop = {
    bun: `<path d="M20 26 Q20 12 32 12 Q44 12 44 26 Q40 19 32 19 Q24 19 20 26 Z" fill="${c.hair}"/><circle cx="32" cy="10" r="6" fill="${c.hair}"/>`,
    long: `<path d="M19 28 Q18 12 32 11 Q46 12 45 28 Q42 20 32 19 Q22 20 19 28 Z" fill="${c.hair}"/>`,
    ponytail: `<path d="M20 26 Q20 13 32 13 Q44 13 44 26 Q40 19 32 19 Q24 19 20 26 Z" fill="${c.hair}"/>`,
    bob: `<path d="M19 28 Q18 12 32 12 Q46 12 45 28 Q40 20 32 20 Q24 20 19 28 Z" fill="${c.hair}"/>`,
    short: `<path d="M20 27 Q19 13 32 13 Q45 13 44 27 Q41 20 32 20 Q23 20 20 27 Z" fill="${c.hair}"/>`,
  }[c.style];
  let hat = '';
  if (c.hat === 'straw') hat = `<ellipse cx="32" cy="16" rx="24" ry="5" fill="#e9c46a"/><path d="M20 16 Q22 4 32 4 Q42 4 44 16 Z" fill="#f0d083"/><rect x="20" y="12" width="24" height="3" fill="#b8462e"/>`;
  if (c.hat === 'cap') hat = `<path d="M18 22 Q18 8 32 8 Q46 8 46 22 Z" fill="#c2412d"/><rect x="18" y="20" width="30" height="3.5" rx="1.5" fill="#8f2c1f"/><path d="M42 21 L56 24 Q52 27 42 25 Z" fill="#8f2c1f"/>`;
  if (c.hat === 'helmet') hat = `<path d="M17 24 Q17 8 32 8 Q47 8 47 24 Z" fill="#f2c230"/><rect x="17" y="22" width="30" height="3" fill="#c99512"/><circle cx="32" cy="10" r="3.4" fill="#fff6c4"/><circle cx="32" cy="10" r="1.6" fill="#ffd63a"/>`;
  if (c.hat === 'conductor') hat = `<path d="M18 22 Q18 9 32 9 Q46 9 46 22 Z" fill="#1d2b4d"/><rect x="17" y="20" width="31" height="4" rx="1.5" fill="#1d2b4d"/><rect x="18" y="16" width="28" height="2.6" fill="#f2c230"/>`;
  if (c.hat === 'captain') hat = `<path d="M18 22 Q18 9 32 9 Q46 9 46 22 Z" fill="#fbfbfb"/><rect x="17" y="20" width="31" height="4" rx="1.5" fill="#fbfbfb"/><rect x="18" y="16" width="28" height="2.6" fill="#e0b13a"/><circle cx="32" cy="12.6" r="1.6" fill="#e0b13a"/>`;
  const glasses = c.glasses ? `<g fill="none" stroke="#2a2a2a" stroke-width="1.3"><circle cx="27" cy="29" r="3.6"/><circle cx="37" cy="29" r="3.6"/><path d="M30.6 29 H33.4"/></g>` : '';
  const goggles = c.goggles ? `<path d="M21 23 Q32 18 43 23" fill="none" stroke="#2a2a2a" stroke-width="2.2"/><circle cx="27" cy="24.5" r="3.4" fill="#7fd6ff" stroke="#2a2a2a" stroke-width="1.2"/><circle cx="37" cy="24.5" r="3.4" fill="#7fd6ff" stroke="#2a2a2a" stroke-width="1.2"/>` : '';
  const eyes = c.goggles ? '' : `<circle cx="27" cy="29" r="1.7" fill="#222"/><circle cx="37" cy="29" r="1.7" fill="#222"/>`;
  const mustache = c.mustache ? `<path d="M26 37 Q32 34 38 37 Q32 39 26 37 Z" fill="${c.hair}"/>` : '';
  const beard = c.beard ? `<path d="M21 34 Q24 50 32 50 Q40 50 43 34 Q40 42 32 42 Q24 42 21 34 Z" fill="${c.hair}"/>` : '';
  const apron = c.apron ? `<path d="M22 50 L42 50 L44 64 L20 64 Z" fill="#fff3e6" opacity="0.92"/><path d="M26 44 Q32 47 38 44" fill="none" stroke="#fff3e6" stroke-width="2"/>` : '';
  const scarf = c.scarf ? `<path d="M20 46 Q32 54 44 46 L46 52 Q32 60 18 52 Z" fill="${c.scarf}"/>` : '';
  const collar = c.hat === 'captain' ? `<path d="M22 48 L32 56 L42 48" fill="none" stroke="#e0b13a" stroke-width="2"/>` : '';
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <defs><radialGradient id="${g}" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${c.bg}" stop-opacity="1"/><stop offset="1" stop-color="#0b0b0e"/></radialGradient></defs>
  <circle cx="32" cy="32" r="32" fill="url(#${g})"/>
  ${hairBack}
  <path d="M7 64 Q9 46 32 44 Q55 46 57 64 Z" fill="${c.cloth}"/>
  <rect x="27" y="36" width="10" height="10" rx="3" fill="${c.skin}"/>
  ${apron}${scarf}${collar}
  <ellipse cx="32" cy="28" rx="12" ry="13.5" fill="${c.skin}"/>
  <ellipse cx="20.8" cy="29" rx="2" ry="3" fill="${c.skin}"/><ellipse cx="43.2" cy="29" rx="2" ry="3" fill="${c.skin}"/>
  ${hairTop}
  ${hat}
  ${eyes}${glasses}${goggles}
  <path d="M28 38 Q32 41 36 38" fill="none" stroke="#8a4a3a" stroke-width="1.5" stroke-linecap="round"/>
  ${mustache}${beard}
  <circle cx="23" cy="34" r="2.2" fill="#ff8fa3" opacity="0.35"/><circle cx="41" cy="34" r="2.2" fill="#ff8fa3" opacity="0.35"/>
</svg>`;
}
