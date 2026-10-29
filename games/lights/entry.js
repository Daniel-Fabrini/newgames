export default {
  id: 'lights',
  cat: 'puzzle',
  progress: 100,
  name: { pt: 'Siga as Luzes', en: 'Light Echo', es: 'Sigue las Luces' },
  sub: { pt: 'Memória e Reflexo', en: 'Memory & Reflex', es: 'Memoria y Reflejos' },
  about: {
    pt: 'Observe a sequência de luzes e sons e repita na ordem certa. A cada rodada o padrão cresce e o ritmo acelera. Até onde vai a sua memória?',
    en: 'Watch the sequence of lights and sounds, then repeat it in the right order. Each round the pattern grows and the pace picks up. How far can your memory go?',
    es: 'Observa la secuencia de luces y sonidos y repítela en el orden correcto. En cada ronda el patrón crece y el ritmo se acelera. ¿Hasta dónde llega tu memoria?',
  },
  modes: [
    { id: 'classic', icon: 'play', label: { pt: 'Clássico', en: 'Classic', es: 'Clásico' } },
    { id: 'fast', icon: 'clock', label: { pt: 'Rápido', en: 'Fast', es: 'Rápido' } },
    { id: 'expert', icon: 'crown', label: { pt: 'Expert', en: 'Expert', es: 'Experto' } },
  ],
  trophies: ['🏆', '💡', '🎵', '🔥', '🧠'],
  load: () => import('./main.js'),
};
