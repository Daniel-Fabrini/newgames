// Placeholder — replaced by the real game.
export async function mount(root, ctx) {
  const { h } = ctx.ui;
  root.append(h('div', { class: 'screen center' }, h('div', { class: 'big-emoji' }, '🚧'), h('p', { class: 'muted' }, 'Em construção · Under construction · En construcción')));
  return () => {};
}
