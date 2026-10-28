// TEMP preview
import { createMatch } from './match.js';
export async function mount(root, ctx) {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;inset:0;';
  root.append(host);
  const L = window.__heroLevel || { type: 'open', att: [{ x: -8, y: 26 }, { x: 4, y: 16, hero: 1 }, { x: 12, y: 22 , run:[-4,-9]}], ball: 0, def: [{ x: -2, y: 21 }, { x: 5, y: 13 }, { x: 10, y: 18 }] };
  const m = createMatch(host, {
    level: L,
    kits: { home: { shirt: '#f3c24a', shirt2: '#111111', shorts: '#111111', socks: '#f3c24a', pattern: 'plain', numColor: '#111' }, away: { shirt: '#c8102e', shirt2: '#ffffff', shorts: '#ffffff', socks: '#c8102e', pattern: 'plain' }, gk: { shirt: '#20c997', shirt2: '#0b4', shorts: '#111', socks: '#20c997', gloves: '#fff' } },
    heroLook: { skin: '#c48a5e', hair: 'curly', hairColor: '#1b1410', boots: '#ff3fa4' },
    heroName: 'DANIEL', heroNum: 10,
    sfx: ctx.sfx, t: (k) => k,
    onResult: (r) => { window.__heroResult = r; },
  });
  window.__heroMatch = m;
  return () => m.destroy();
}
