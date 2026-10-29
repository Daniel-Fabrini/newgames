// Registry entry for the lobby (copied into js/games.js by the shell owner).
export default {
  id: 'goo',
  cat: 'puzzle',
  progress: 100,
  name: { pt: 'Goo Builder', en: 'Goo Builder', es: 'Goo Builder' },
  sub: { pt: 'Construa com Física', en: 'Build with Physics', es: 'Construye con Física' },
  about: {
    pt: 'Arraste bolinhas de gosma e construa pontes, torres e balanços elásticos até o cano de saída. Cada fio estica, segura peso e pode arrebentar! 30 fases em 5 mundos, com balões, pedras, espinhos, vento e pêndulos.',
    en: 'Drag sticky goo balls and build bridges, towers and cantilevers of stretchy strands all the way to the exit pipe. Every strand stretches, bears weight and can snap! 30 levels in 5 worlds with balloons, heavy stones, spikes, wind and pendulums.',
    es: 'Arrastra bolitas de gosma y construye puentes, torres y voladizos elásticos hasta la tubería de salida. ¡Cada hilo se estira, soporta peso y puede romperse! 30 niveles en 5 mundos con globos, piedras, pinchos, viento y péndulos.',
  },
  modes: [
    { id: 'campaign', icon: 'play', label: { pt: 'Campanha', en: 'Campaign', es: 'Campaña' } },
    { id: 'worlds', icon: 'grid', label: { pt: 'Fases', en: 'Levels', es: 'Niveles' } },
    { id: 'sandbox', icon: 'infinity', label: { pt: 'Livre', en: 'Sandbox', es: 'Libre' } },
  ],
  trophies: ['🟢', '🌉', '🏗️', '🎈', '⭐'],
  load: () => import('./main.js'),
};
