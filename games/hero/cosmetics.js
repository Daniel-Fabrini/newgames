// Ball Hero — hero customization catalog (kits, boots, hair, skin).

export const KITS = [
  { id: 'gold', price: 0, shirt: '#f3c24a', shirt2: '#141414', shorts: '#141414', socks: '#f3c24a', pattern: 'band', numColor: '#141414' },
  { id: 'white', price: 0, shirt: '#f4f4f6', shirt2: '#c9a227', shorts: '#f4f4f6', socks: '#f4f4f6', pattern: 'plain', numColor: '#141414' },
  { id: 'red', price: 150, shirt: '#d7263d', shirt2: '#ffffff', shorts: '#ffffff', socks: '#d7263d', pattern: 'plain', numColor: '#ffffff' },
  { id: 'blue', price: 150, shirt: '#1f5fd6', shirt2: '#ffffff', shorts: '#0d2a6b', socks: '#1f5fd6', pattern: 'plain', numColor: '#ffffff' },
  { id: 'hoops', price: 250, shirt: '#2f9e44', shirt2: '#ffffff', shorts: '#ffffff', socks: '#2f9e44', pattern: 'hoops', numColor: '#141414' },
  { id: 'stripes', price: 300, shirt: '#f4f4f6', shirt2: '#141414', shorts: '#141414', socks: '#141414', pattern: 'stripes', numColor: '#d7263d' },
  { id: 'sky', price: 350, shirt: '#7fc8ff', shirt2: '#ffffff', shorts: '#141414', socks: '#7fc8ff', pattern: 'stripes', numColor: '#141414' },
  { id: 'sash', price: 450, shirt: '#f4f4f6', shirt2: '#d7263d', shorts: '#141414', socks: '#f4f4f6', pattern: 'sash', numColor: '#141414' },
  { id: 'halves', price: 550, shirt: '#ff7a1a', shirt2: '#141414', shorts: '#141414', socks: '#ff7a1a', pattern: 'halves', numColor: '#ffffff' },
  { id: 'royal', price: 700, shirt: '#6a1b9a', shirt2: '#ffd54f', shorts: '#6a1b9a', socks: '#ffd54f', pattern: 'band', numColor: '#ffd54f' },
  { id: 'noir', price: 900, shirt: '#141414', shirt2: '#f3c24a', shorts: '#141414', socks: '#141414', pattern: 'stripes', numColor: '#f3c24a' },
];

export const BOOTS = [
  { id: 'black', price: 0, color: '#17171c' },
  { id: 'white', price: 0, color: '#f2f2f5' },
  { id: 'neon', price: 120, color: '#b6ff2e' },
  { id: 'blue', price: 150, color: '#2b7bff' },
  { id: 'red', price: 150, color: '#ff2d46' },
  { id: 'pink', price: 200, color: '#ff4fa3' },
  { id: 'orange', price: 200, color: '#ff8a1f' },
  { id: 'gold', price: 400, color: '#f3c24a' },
];

export const HAIRS = [
  { id: 'short', price: 0 },
  { id: 'buzz', price: 0 },
  { id: 'bald', price: 0 },
  { id: 'fringe', price: 100 },
  { id: 'curly', price: 150 },
  { id: 'afro', price: 250 },
  { id: 'long', price: 250 },
  { id: 'bun', price: 300 },
  { id: 'mohawk', price: 350 },
  { id: 'spiky', price: 350 },
];

export const HAIR_COLORS = [
  { id: 'black', price: 0, color: '#1b1410' },
  { id: 'brown', price: 0, color: '#4a3020' },
  { id: 'blonde', price: 120, color: '#d8b46a' },
  { id: 'red', price: 150, color: '#b5442a' },
  { id: 'platinum', price: 220, color: '#ece7dc' },
  { id: 'blue', price: 300, color: '#2f6bff' },
  { id: 'pink', price: 300, color: '#ff5fae' },
  { id: 'green', price: 300, color: '#36d27a' },
];

export const SKINS = ['#f3cfae', '#e0ac85', '#c48a5e', '#9a6440', '#6e4428', '#4b2e1c'];

export const DEFAULT_HERO = {
  name: '',
  num: 10,
  kit: 'gold',
  boots: 'black',
  hair: 'short',
  hairColor: 'black',
  skin: 2,
  country: 'BR',
  owned: ['kit:gold', 'kit:white', 'boots:black', 'boots:white', 'hair:short', 'hair:buzz', 'hair:bald', 'hc:black', 'hc:brown'],
};

export function kitById(id) {
  return KITS.find((k) => k.id === id) || KITS[0];
}

export function heroLook(h) {
  return {
    skin: SKINS[h.skin] || SKINS[2],
    hair: h.hair,
    hairColor: (HAIR_COLORS.find((c) => c.id === h.hairColor) || HAIR_COLORS[0]).color,
    boots: (BOOTS.find((b) => b.id === h.boots) || BOOTS[0]).color,
  };
}
