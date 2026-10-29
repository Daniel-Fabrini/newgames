// 40-card Portuguese deck helpers (pure). A card is an integer: suit * 10 + rank,
// where rank 0..9 is also its strength: 2 3 4 5 6 Q J K 7 A.
export const SUITS = ['hearts', 'diamonds', 'spades', 'clubs']; // Copas, Ouros, Espadas, Paus
export const SUIT_SYM = ['♥', '♦', '♠', '♣'];
export const RANK_LABEL = ['2', '3', '4', '5', '6', 'Q', 'J', 'K', '7', 'A'];
export const PTS = [0, 0, 0, 0, 0, 2, 3, 4, 10, 11];
export const TOTAL_POINTS = 120;

export const suitOf = (c) => (c / 10) | 0;
export const rankOf = (c) => c % 10;
export const pts = (c) => PTS[c % 10];
export const mk = (s, r) => s * 10 + r;
export const cardName = (c) => RANK_LABEL[rankOf(c)] + SUIT_SYM[suitOf(c)];
export const newDeck = () => Array.from({ length: 40 }, (_, i) => i);

// Deterministic PRNG whose whole state is one uint32 (kept inside the game state).
export function nextRand(st) {
  st.rs = (st.rs + 0x6d2b79f5) >>> 0;
  let t = st.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randInt = (st, n) => Math.floor(nextRand(st) * n);
// Fisher–Yates with the seeded PRNG.
export function shuffleInPlace(arr, st) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(st, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export function randomSeed() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] >>> 0;
  } catch (e) {
    return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0;
  }
}
// Display order for a hand: by suit, strongest first.
export const sortHand = (hand) => hand.sort((a, b) => suitOf(a) - suitOf(b) || rankOf(b) - rankOf(a));
