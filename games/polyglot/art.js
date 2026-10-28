// Artwork: the Polyglot mascot ("Poli", a green tree frog) and gold line icons.

let uid = 0;

// mood: 'happy' | 'cheer' | 'sad' | 'wow' ; book: holds an open book
export function mascotSVG({ mood = 'happy', book = false } = {}) {
  const id = 'pgm' + ++uid;
  const mouth = {
    happy: '<path d="M93 113 Q120 140 147 113" stroke="#17520f" stroke-width="6" stroke-linecap="round" fill="none"/>',
    cheer:
      '<path d="M90 108 Q120 152 150 108 Z" fill="#7a1626"/><path d="M104 127 Q120 140 136 127 Q120 120 104 127Z" fill="#ff7b8c"/>',
    sad: '<path d="M98 126 Q120 108 142 126" stroke="#17520f" stroke-width="6" stroke-linecap="round" fill="none"/>',
    wow: '<ellipse cx="120" cy="120" rx="13" ry="15" fill="#7a1626"/>',
  }[mood];
  const brows =
    mood === 'sad'
      ? '<path d="M60 40 L96 50" stroke="#17520f" stroke-width="5" stroke-linecap="round"/><path d="M180 40 L144 50" stroke="#17520f" stroke-width="5" stroke-linecap="round"/>'
      : '';
  const tear = mood === 'sad' ? '<path d="M66 96 q-7 12 0 16 q7 -4 0 -16z" fill="#7fd3ff"/>' : '';
  const arms =
    mood === 'cheer' && !book
      ? `<path d="M52 150 Q22 120 30 86" stroke="url(#${id}b)" stroke-width="22" stroke-linecap="round" fill="none"/>
         <path d="M188 150 Q218 120 210 86" stroke="url(#${id}b)" stroke-width="22" stroke-linecap="round" fill="none"/>
         <circle cx="30" cy="82" r="13" fill="#4fbf35"/><circle cx="210" cy="82" r="13" fill="#4fbf35"/>`
      : !book
        ? `<ellipse cx="50" cy="168" rx="14" ry="22" fill="#45b02f" transform="rotate(18 50 168)"/>
           <ellipse cx="190" cy="168" rx="14" ry="22" fill="#45b02f" transform="rotate(-18 190 168)"/>`
        : '';
  const bookSvg = book
    ? `<g class="pg-m-book">
        <path d="M120 146 L54 134 L50 198 L120 210 Z" fill="url(#${id}k)"/>
        <path d="M120 146 L186 134 L190 198 L120 210 Z" fill="url(#${id}k)"/>
        <path d="M120 146 L58 135 L57 141 L120 152 Z" fill="#f4f1e6"/>
        <path d="M120 146 L182 135 L183 141 L120 152 Z" fill="#e9e4d2"/>
        <path d="M120 147 L120 210" stroke="#1b2f7a" stroke-width="3"/>
        <path d="M70 160 L106 166 M70 172 L106 178 M134 166 L170 160 M134 178 L170 172" stroke="#8fb0ff" stroke-width="3" stroke-linecap="round" opacity=".55"/>
        <circle cx="54" cy="168" r="15" fill="#4fbf35"/><circle cx="186" cy="168" r="15" fill="#4fbf35"/>
        <path d="M46 162 q8 -6 16 0" stroke="#2f8a22" stroke-width="3" fill="none"/><path d="M178 162 q8 -6 16 0" stroke="#2f8a22" stroke-width="3" fill="none"/>
      </g>`
    : '';
  return `<svg class="pg-mascot mood-${mood}" viewBox="0 0 240 240" aria-hidden="true">
  <defs>
    <radialGradient id="${id}b" cx="40%" cy="28%" r="80%"><stop offset="0" stop-color="#a6f06f"/><stop offset=".5" stop-color="#5cc83b"/><stop offset="1" stop-color="#2a8a1e"/></radialGradient>
    <radialGradient id="${id}y" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#f6ffe2"/><stop offset="1" stop-color="#c3ef93"/></radialGradient>
    <linearGradient id="${id}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d95ff"/><stop offset="1" stop-color="#2440b0"/></linearGradient>
  </defs>
  <ellipse cx="120" cy="226" rx="72" ry="9" fill="rgba(0,0,0,.45)"/>
  <ellipse cx="74" cy="214" rx="28" ry="11" fill="#3a9f28"/><ellipse cx="166" cy="214" rx="28" ry="11" fill="#3a9f28"/>
  ${arms}
  <path d="M120 66 C190 66 210 122 204 162 C198 204 162 220 120 220 C78 220 42 204 36 162 C30 122 50 66 120 66 Z" fill="url(#${id}b)"/>
  <ellipse cx="120" cy="170" rx="56" ry="42" fill="url(#${id}y)"/>
  <circle cx="80" cy="70" r="36" fill="url(#${id}b)"/><circle cx="160" cy="70" r="36" fill="url(#${id}b)"/>
  <g class="pg-m-eye"><circle cx="80" cy="70" r="25" fill="#fff"/><circle class="pg-m-pupil" cx="84" cy="73" r="12.5" fill="#15161a"/><circle cx="89" cy="67" r="4.5" fill="#fff"/></g>
  <g class="pg-m-eye"><circle cx="160" cy="70" r="25" fill="#fff"/><circle class="pg-m-pupil" cx="156" cy="73" r="12.5" fill="#15161a"/><circle cx="161" cy="67" r="4.5" fill="#fff"/></g>
  ${brows}
  <ellipse cx="62" cy="116" rx="14" ry="8" fill="#ff8fa3" opacity=".55"/><ellipse cx="178" cy="116" rx="14" ry="8" fill="#ff8fa3" opacity=".55"/>
  ${tear}
  ${mouth}
  ${bookSvg}
</svg>`;
}

const S = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const ICON = {
  chevron: S('<path d="M9 5l7 7-7 7"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>', 'stroke-width="3"'),
  check: S('<path d="M4.5 12.5l5 5 10-11"/>', 'stroke-width="3.4"'),
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z"/></svg>',
  lock: S('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  speaker: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.5 8.5 0 0 1 0 12"/>'),
  turtle:
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M4 15.5c0-4 3.4-7 7.5-7s7.5 3 7.5 7z"/><circle cx="20.6" cy="13.6" r="2.1"/><rect x="5.2" y="15.6" width="3" height="3.4" rx="1.4"/><rect x="14" y="15.6" width="3" height="3.4" rx="1.4"/><path d="M8 11.2l3.5 2.4 3.5-2.4" stroke="#000" stroke-opacity=".3" stroke-width="1.3" fill="none"/></svg>',
  mic: S('<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>'),
  book: S('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'),
  home: S('<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>'),
  dumbbell: S('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'),
  shield: S('<path d="M12 3l7.5 3v5.5c0 4.8-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.7-7.5-9.5V6z"/><path d="M12 8l1.5 3 3.2.4-2.3 2.2.6 3.2L12 15.3l-3 1.5.6-3.2-2.3-2.2 3.2-.4z" fill="currentColor" stroke="none"/>'),
  target: S('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  user: S('<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'),
  gear: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  globe: S('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>'),
  infinity: S('<path d="M7 9.2c-3.8 0-3.8 5.6 0 5.6 2.8 0 7.2-5.6 10-5.6 3.8 0 3.8 5.6 0 5.6-2.8 0-7.2-5.6-10-5.6z"/>'),
  back: S('<path d="M15 5l-7 7 7 7"/>', 'stroke-width="3"'),
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 2L4.5 13.5h6L9.5 22l9-11.5h-6z"/></svg>',
  trophy: S('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4"/>'),
  medal: S('<circle cx="12" cy="15" r="5.5"/><path d="M9 3.5l3 6 3-6M7 3.5h4M13 3.5h4"/>'),
};
