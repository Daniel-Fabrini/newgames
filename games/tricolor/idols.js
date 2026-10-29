// Roster for "Ligação a um Ídolo". Names/positions/years verified on the Wikipédia (pt) page of each person
// (fetched in this session). No photos: the UI draws a silhouette avatar with initials in the club palette.
// `from`/`to` = overall span at the club (used to match the era of a question). `coach`: shown as técnico.
export const IDOLS = [
  { id: 'ceni', name: 'Rogério Ceni', pos: 'gk', years: '1990–2015', from: 1990, to: 2015, initials: 'RC', url: 'https://pt.wikipedia.org/wiki/Rog%C3%A9rio_Ceni' },
  { id: 'rai', name: 'Raí', pos: 'mid', years: '1987–1993 · 1998–2000', from: 1987, to: 2000, initials: 'RA', url: 'https://pt.wikipedia.org/wiki/Ra%C3%AD' },
  { id: 'cafu', name: 'Cafu', pos: 'fb', years: '1989–1994', from: 1989, to: 1994, initials: 'CF', url: 'https://pt.wikipedia.org/wiki/Cafu' },
  { id: 'zetti', name: 'Zetti', pos: 'gk', years: '1990–1997', from: 1990, to: 1997, initials: 'ZE', url: 'https://pt.wikipedia.org/wiki/Zetti' },
  { id: 'kaka', name: 'Kaká', pos: 'mid', years: '2001–2003 · 2014', from: 2001, to: 2014, initials: 'KK', url: 'https://pt.wikipedia.org/wiki/Kak%C3%A1' },
  { id: 'muller', name: 'Müller', pos: 'fw', years: '1984–1988 · 1990–1994 · 1996', from: 1984, to: 1996, initials: 'MÜ', url: 'https://pt.wikipedia.org/wiki/M%C3%BCller_(futebolista)' },
  { id: 'careca', name: 'Careca', pos: 'fw', years: '1983–1987', from: 1983, to: 1987, initials: 'CA', url: 'https://pt.wikipedia.org/wiki/Careca_(futebolista)' },
  { id: 'tele', name: 'Telê Santana', pos: 'coach', coach: true, years: '1973 · 1990–1996', from: 1990, to: 1996, initials: 'TS', url: 'https://pt.wikipedia.org/wiki/Tel%C3%AA_Santana' },
  { id: 'leonidas', name: 'Leônidas da Silva', pos: 'fw', years: '1942–1950', from: 1942, to: 1950, initials: 'LS', url: 'https://pt.wikipedia.org/wiki/Le%C3%B4nidas_da_Silva' },
  { id: 'gerson', name: 'Gérson', pos: 'mid', years: '1969–1972', from: 1969, to: 1972, initials: 'GE', url: 'https://pt.wikipedia.org/wiki/G%C3%A9rson_(futebolista)' },
  { id: 'pedrorocha', name: 'Pedro Rocha', pos: 'mid', years: '1970–1977', from: 1970, to: 1977, initials: 'PR', url: 'https://pt.wikipedia.org/wiki/Pedro_Rocha' },
  { id: 'lugano', name: 'Lugano', pos: 'cb', years: '2003–2006 · 2016–2017', from: 2003, to: 2017, initials: 'LU', url: 'https://pt.wikipedia.org/wiki/Diego_Lugano' },
  { id: 'muricy', name: 'Muricy Ramalho', pos: 'coach', coach: true, years: '2006–2009 · 2013–2015', from: 2006, to: 2015, initials: 'MR', url: 'https://pt.wikipedia.org/wiki/Muricy_Ramalho' },
  { id: 'chulapa', name: 'Serginho Chulapa', pos: 'fw', years: '1973–1982', from: 1973, to: 1982, initials: 'SC', url: 'https://pt.wikipedia.org/wiki/Serginho_Chulapa' },
  { id: 'lf', name: 'Luís Fabiano', pos: 'fw', years: '2001 · 2002–2004 · 2011–2015', from: 2001, to: 2015, initials: 'LF', url: 'https://pt.wikipedia.org/wiki/Lu%C3%ADs_Fabiano' },
];
export const POS = {
  gk: { pt: 'Goleiro', en: 'Goalkeeper', es: 'Portero' },
  mid: { pt: 'Meia', en: 'Midfielder', es: 'Mediocampista' },
  fb: { pt: 'Lateral', en: 'Full-back', es: 'Lateral' },
  fw: { pt: 'Atacante', en: 'Forward', es: 'Delantero' },
  cb: { pt: 'Zagueiro', en: 'Centre-back', es: 'Defensa central' },
  coach: { pt: 'Técnico', en: 'Coach', es: 'Entrenador' },
};
