// Strings for "findit": the shared hidden-object UI text plus a few lines that
// only make sense on the wide outdoor maps.

import BASE from '../hidden/strings.js';

const EXTRA = {
  pt: {
    tipPan: 'Os mapas são panorâmicos: arraste para os lados para ver tudo.',
  },
  en: {
    tipPan: 'The maps are panoramic: drag sideways to see everything.',
  },
  es: {
    tipPan: 'Los mapas son panorámicos: arrastra hacia los lados para verlo todo.',
  },
};

export default {
  pt: { ...BASE.pt, ...EXTRA.pt },
  en: { ...BASE.en, ...EXTRA.en },
  es: { ...BASE.es, ...EXTRA.es },
};
