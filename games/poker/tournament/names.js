// Original, non-real filler names for generated field players.
const FIRST = ['Alma', 'Bruno', 'Caio', 'Dara', 'Eli', 'Fabio', 'Gaia', 'Hugo', 'Iris', 'Joel', 'Kira', 'Leo', 'Mara', 'Nuno', 'Olga', 'Pablo', 'Quin', 'Rosa', 'Saul', 'Tess', 'Ugo', 'Vera', 'Wes', 'Xena', 'Yara', 'Zeno', 'Ana', 'Beto', 'Cleo', 'Dino', 'Edna', 'Flor', 'Gus', 'Hana', 'Ivo', 'Jade', 'Kai', 'Lia', 'Milo', 'Nina'];
const LAST = ['Alder', 'Barros', 'Castel', 'Dunmore', 'Esteves', 'Falk', 'Garrido', 'Holt', 'Ibarra', 'Janssen', 'Keller', 'Lund', 'Moreau', 'Nakai', 'Ortega', 'Pires', 'Quist', 'Rangel', 'Sato', 'Tavares', 'Ulloa', 'Varga', 'Weiss', 'Yilmaz', 'Zambrano', 'Brandt', 'Costa', 'Duarte', 'Eriksen', 'Ferraz'];
export function fillerName(rng, used) {
  for (let t = 0; t < 50; t++) {
    const n = FIRST[Math.floor(rng() * FIRST.length)] + ' ' + LAST[Math.floor(rng() * LAST.length)];
    if (!used.has(n)) { used.add(n); return n; }
  }
  const n = 'Player ' + (used.size + 1); used.add(n); return n;
}
