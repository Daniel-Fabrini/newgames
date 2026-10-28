// Arena themes: city venues with a printed floor, LED boards, crowd, skyline and a designer table.
//   sky: 'day' | 'dusk' | 'night'; skyline: list of backdrop features
//   floor: base colours + pattern; boards: banner palette; table: top colour + base style
export const ARENAS = [
  {
    id: 0, key: 'arenaName0', sky: 'night', skyline: ['arches', 'lamps'],
    floor: { a: '#1b2a86', b: '#24379e', ink: 'rgba(160,190,255,0.35)', pattern: 'logo' },
    boards: { bg: ['#d8142c', '#ffffff', '#1d3aa8'], text: '#ffffff', textBg: '#1d3aa8', style: 'stripes' },
    table: '#3f7fdc', edge: '#14204f', apron: '#d8142c', base: 'posts', baseColor: '#f2f2f2', baseAccent: '#d8142c',
    light: '#ffd9a0', wall: '#0c1030', crowdTint: '#2a2f48',
  },
  {
    id: 1, key: 'arenaName1', sky: 'day', skyline: ['tent', 'mountain', 'towers', 'palms'],
    floor: { a: '#1838c8', b: '#2348d8', ink: 'rgba(150,200,255,0.4)', pattern: 'logo' },
    boards: { bg: ['#ffd400', '#22c55e', '#ff3d9a'], text: '#ffffff', textBg: '#ff3d9a', style: 'gradient' },
    table: '#1fc744', edge: '#0f1a2e', apron: '#7a2bd9', base: 'prism', baseColor: '#ff3d9a', baseAccent: '#22d3ee',
    light: '#fff6d8', wall: '#4aa3df', crowdTint: '#3a3a44',
  },
  {
    id: 2, key: 'arenaName2', sky: 'night', skyline: ['towers', 'lanterns', 'pagoda'],
    floor: { a: '#a80f1a', b: '#c4141f', ink: 'rgba(255,255,255,0.16)', pattern: 'rays' },
    boards: { bg: ['#ffffff', '#f4f4f4', '#ffffff'], text: '#e0102a', textBg: '#ffffff', style: 'led' },
    table: '#e9e9ec', edge: '#2a2a30', apron: '#e0102a', base: 'drum', baseColor: '#202026', baseAccent: '#e0102a',
    light: '#ffb070', wall: '#120a14', crowdTint: '#2a2228',
  },
  {
    id: 3, key: 'arenaName3', sky: 'night', skyline: ['industrial', 'lamps'],
    floor: { a: '#c8121c', b: '#e01822', ink: 'rgba(0,0,0,0.22)', pattern: 'grid' },
    boards: { bg: ['#141418', '#1d1d22', '#141418'], text: '#ffd400', textBg: '#e01822', style: 'led' },
    table: '#4a4e57', edge: '#1a1b20', apron: '#2a2c33', base: 'block', baseColor: '#5c6069', baseAccent: '#ffd400',
    light: '#ffe2a8', wall: '#0b0b10', crowdTint: '#24242c',
  },
  {
    id: 4, key: 'arenaName4', sky: 'night', skyline: ['strings', 'statue', 'towers'],
    floor: { a: '#1a2664', b: '#22327c', ink: 'rgba(130,160,255,0.3)', pattern: 'stars' },
    boards: { bg: ['#c8102e', '#ffffff', '#0a2a7a'], text: '#ffffff', textBg: '#c8102e', style: 'flag' },
    table: '#e2394e', edge: '#3a0a14', apron: '#0a2a7a', base: 'x', baseColor: '#2a5bd8', baseAccent: '#ffffff',
    light: '#fff1c4', wall: '#0a0e24', crowdTint: '#262a3a',
  },
  {
    id: 5, key: 'arenaName5', sky: 'day', skyline: ['deco', 'palms'],
    floor: { a: '#2d5868', b: '#356a7c', ink: 'rgba(170,240,255,0.32)', pattern: 'waves' },
    boards: { bg: ['#1aa5b8', '#0e7f92', '#1aa5b8'], text: '#ff4fa8', textBg: '#ffffff', style: 'waves' },
    table: '#a3a6ad', edge: '#2b2b33', apron: '#ff3fa0', base: 'arch', baseColor: '#18181e', baseAccent: '#ff3fa0',
    light: '#fff8e0', wall: '#9fd8f0', crowdTint: '#3a3a42',
  },
  {
    id: 6, key: 'arenaName6', sky: 'night', skyline: ['dome', 'lamps'],
    floor: { a: '#2c1660', b: '#3a1d78', ink: 'rgba(220,150,255,0.25)', pattern: 'rays' },
    boards: { bg: ['#d0208a', '#7b2bd9', '#d0208a'], text: '#ffe14d', textBg: '#7b2bd9', style: 'gradient' },
    table: '#7b3557', edge: '#22102a', apron: '#21d4d4', base: 'vlegs', baseColor: '#21d4d4', baseAccent: '#ff4fd8',
    light: '#e6c8ff', wall: '#120a24', crowdTint: '#2a2238',
  },
  {
    id: 7, key: 'arenaName7', sky: 'dusk', skyline: ['shells', 'towers'],
    floor: { a: '#0c628e', b: '#1176a8', ink: 'rgba(160,230,255,0.3)', pattern: 'waves' },
    boards: { bg: ['#ff8a1f', '#ffb347', '#ff8a1f'], text: '#ffffff', textBg: '#0c628e', style: 'gradient' },
    table: '#1e8fb8', edge: '#0b2a3a', apron: '#ff8a1f', base: 'posts', baseColor: '#ff8a1f', baseAccent: '#ffffff',
    light: '#ffd7a8', wall: '#f39a5a', crowdTint: '#33303a',
  },
  {
    id: 8, key: 'arenaName8', sky: 'dusk', skyline: ['spire', 'towers', 'palms'],
    floor: { a: '#9a6f22', b: '#b5852e', ink: 'rgba(255,240,200,0.28)', pattern: 'logo' },
    boards: { bg: ['#141414', '#2a2418', '#141414'], text: '#f7d774', textBg: '#141414', style: 'led' },
    table: '#26262b', edge: '#0d0d10', apron: '#c9971c', base: 'prism', baseColor: '#c9971c', baseAccent: '#fff1b8',
    light: '#ffe2a0', wall: '#e0884a', crowdTint: '#2e2a26',
  },
  {
    id: 9, key: 'arenaName9', sky: 'night', skyline: ['towers', 'neon'],
    floor: { a: '#a8236a', b: '#c22f7e', ink: 'rgba(255,200,240,0.28)', pattern: 'grid' },
    boards: { bg: ['#1a0d2e', '#2a1248', '#1a0d2e'], text: '#3ff0ff', textBg: '#ff3fa8', style: 'led' },
    table: '#e8579b', edge: '#2a0a1e', apron: '#3ff0ff', base: 'vlegs', baseColor: '#3ff0ff', baseAccent: '#ff4fd8',
    light: '#ffc8f0', wall: '#0e0618', crowdTint: '#2a2234',
  },
];
