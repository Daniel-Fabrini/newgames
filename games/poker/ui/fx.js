// Celebration particles (DOM + WAAPI). kind: chips | confetti | spotlight | gold_rain
export function celebrate(app, host, kind = 'chips', power = 1) {
  if (app.reduce()) return;
  const layer = document.createElement('div');
  layer.className = 'pk-fxlayer';
  host.append(layer);
  const W = host.clientWidth || 360;
  const H = host.clientHeight || 700;
  const n = Math.round((kind === 'spotlight' ? 0 : 36) * power);
  if (kind === 'confetti') {
    try { app.ctx.ui.confetti(); } catch (e) { /* ignore */ }
  }
  const colors = kind === 'gold_rain' ? ['#fff1b8', '#f3c24a', '#e3a723', '#fff'] : ['#d63a3a', '#2a6fd6', '#2a9d5a', '#f3c24a', '#ececec'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'pk-part ' + (kind === 'gold_rain' ? 'gold' : 'chip');
    p.style.background = colors[i % colors.length];
    const x = Math.random() * W;
    const s = 8 + Math.random() * 10;
    p.style.width = s + 'px';
    p.style.height = (kind === 'gold_rain' ? s * 1.6 : s * 0.6) + 'px';
    p.style.left = x + 'px';
    layer.append(p);
    const dur = 1800 + Math.random() * 1600;
    p.animate([{ transform: `translate(0,-30px) rotate(0deg)`, opacity: 0 }, { opacity: 1, offset: 0.1 }, { transform: `translate(${(Math.random() - 0.5) * 120}px,${H + 40}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 1 }], { duration: dur, delay: Math.random() * 900, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'both' });
  }
  if (kind === 'spotlight') {
    const s = document.createElement('div');
    s.className = 'pk-spot';
    layer.append(s);
  }
  setTimeout(() => layer.remove(), 5200);
}
