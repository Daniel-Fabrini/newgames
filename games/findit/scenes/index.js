// The places of "Caça-Objetos", in chapter order (indoor and outdoor mixed).
// Each one is a rendered photo (<id>.webp), a small preview (<id>_s.webp) and
// the hit data of its objects (<id>.json), all made by build3d/.

export const SCENES = [
  { id: 'study', kind: 'indoor', name: { pt: 'Escritório Antigo', en: 'Antique Study', es: 'Estudio Antiguo' } },
  { id: 'alley', kind: 'outdoor', name: { pt: 'Beco dos Fundos', en: 'Back Alley', es: 'Callejón Trasero' } },
  { id: 'kitchen', kind: 'indoor', name: { pt: 'Cozinha da Vovó', en: "Grandma's Kitchen", es: 'Cocina de la Abuela' } },
  { id: 'harbor', kind: 'outdoor', name: { pt: 'Cais dos Contrabandistas', en: "Smugglers' Wharf", es: 'Muelle de los Contrabandistas' } },
  { id: 'workshop', kind: 'indoor', name: { pt: 'Oficina', en: 'Workshop', es: 'Taller' } },
  { id: 'backyard', kind: 'outdoor', name: { pt: 'Quintal do Jardineiro', en: "Gardener's Backyard", es: 'Patio del Jardinero' } },
  { id: 'attic', kind: 'indoor', name: { pt: 'Sótão Esquecido', en: 'Forgotten Attic', es: 'Ático Olvidado' } },
  { id: 'market', kind: 'outdoor', name: { pt: 'Feira de Rua', en: 'Street Market', es: 'Mercadillo' } },
  { id: 'alchemy', kind: 'indoor', name: { pt: 'Laboratório do Alquimista', en: "Alchemist's Lab", es: 'Laboratorio del Alquimista' } },
  { id: 'campsite', kind: 'outdoor', name: { pt: 'Acampamento na Floresta', en: 'Forest Campsite', es: 'Campamento en el Bosque' } },
  { id: 'keeper', kind: 'indoor', name: { pt: 'Casa do Faroleiro', en: "Lighthouse Keeper's Room", es: 'Casa del Farero' } },
  { id: 'courtyard', kind: 'outdoor', name: { pt: 'Pátio Florido', en: 'Flowery Courtyard', es: 'Patio Florido' } },
  { id: 'teahouse', kind: 'indoor', name: { pt: 'Sala de Chá Oriental', en: 'Oriental Tea Room', es: 'Salón de Té Oriental' } },
  { id: 'scrapyard', kind: 'outdoor', name: { pt: 'Ferro-Velho', en: 'Scrapyard', es: 'Chatarrería' } },
  { id: 'livingroom', kind: 'indoor', name: { pt: 'Sala dos Anos 80', en: '80s Living Room', es: 'Sala de los 80' } },
  { id: 'castle', kind: 'indoor', name: { pt: 'Salão do Castelo', en: 'Castle Hall', es: 'Salón del Castillo' } },
  { id: 'antiques', kind: 'indoor', name: { pt: 'Antiquário', en: 'Antique Shop', es: 'Tienda de Antigüedades' } },
];
