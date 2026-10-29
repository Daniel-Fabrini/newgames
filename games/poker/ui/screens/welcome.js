// New career: choose a name and an avatar.
import { h } from '../dom.js';
import { topbar, btn } from '../kit.js';
import { avatarEl } from '../avatars.js';
import { trophySVG, suitsDeco } from '../art.js';
import { ICON } from '../icons.js';

export default function welcomeScreen(app) {
  const { t } = app;
  const el = h('div', { class: 'pk-screen' });
  el.append(topbar(t('welcome.title'), { onBack: () => { if (!app.back()) app.ctx.exit(); } }));
  const sc = h('div', { class: 'pk-scroll' });
  el.append(sc);
  const free = ['p1', 'p2', 'p3', 'p4'];
  let avatar = app.prefs.get('avatar') && free.includes(app.prefs.get('avatar')) ? app.prefs.get('avatar') : 'p1';
  const input = h('input', { type: 'text', class: 'pk-input', maxlength: '18', placeholder: t('welcome.placeholder'), value: app.prefs.get('name') || '', 'aria-label': t('prof.name') });
  const grid = h('div', { class: 'pk-av-grid' });
  const paint = () => {
    grid.textContent = '';
    for (const id of free) {
      const b = h('button', { type: 'button', class: 'pk-av-pick' + (id === avatar ? ' on' : ''), 'aria-pressed': String(id === avatar), onclick: () => { avatar = id; paint(); } }, avatarEl(id, { size: 64 }));
      grid.append(b);
    }
  };
  paint();
  sc.append(
    h('div', { class: 'pk-hero-welcome' }, h('div', { class: 'pk-suits-wrap' }, suitsDeco()), h('span', { html: trophySVG('world', { size: 92 }) }), h('h1', { class: 'pk-title' }, t('welcome.h')), h('p', { class: 'pk-sub' }, t('welcome.p'))),
    h('div', { class: 'pk-panel' }, h('label', { class: 'pk-lbl' }, t('prof.name')), input, h('label', { class: 'pk-lbl', style: { marginTop: '14px' } }, t('welcome.avatar')), grid, h('div', { class: 'pk-sub pk-muted', style: { marginTop: '8px' } }, t('welcome.more'))),
    h('div', { class: 'pk-panel' }, h('div', { class: 'pk-h2' }, t('welcome.path')), h('div', { class: 'pk-sub', style: { marginTop: '6px' } }, t('welcome.pathText'))),
    h('div', { style: { marginTop: '14px' } }, btn(t('welcome.go'), () => {
      const name = input.value.trim() || t('you');
      app.prefs.set('name', name);
      app.prefs.set('avatar', avatar);
      app.startCareer({ name, avatar });
      app.go('home');
    }, 'block', ICON.play)),
    h('div', { class: 'pk-sub pk-muted', style: { marginTop: '10px', textAlign: 'center' } }, t('legal.virtual')),
  );
  return { el };
}
