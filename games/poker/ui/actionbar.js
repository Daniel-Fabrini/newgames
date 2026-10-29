// Action bar: Fold / Check|Call / Bet|Raise with a sizing sheet (slider, presets, stepper).
// Amounts are "total bet for this street" (raise TO). prompt() resolves with { type, amount }.
import { fmt } from './table.js';

export function createActionBar(host, { t, onSound = () => {}, prefs }) {
  const el = document.createElement('div');
  el.className = 'pk-bar';
  el.innerHTML = `
    <div class="pk-sheet" hidden>
      <div class="pk-sheet-top">
        <div class="pk-sheet-val"><small></small><b></b></div>
        <div class="pk-step">
          <button type="button" class="pk-stepb dec" aria-label="-"></button>
          <button type="button" class="pk-stepb inc" aria-label="+"></button>
        </div>
      </div>
      <input class="pk-slider" type="range" min="0" max="100" step="1" aria-label="">
      <div class="pk-quick"></div>
    </div>
    <div class="pk-timer" hidden><i></i></div>
    <div class="pk-btns">
      <button type="button" class="pk-ab fold"><b></b><small></small></button>
      <button type="button" class="pk-ab call"><b></b><small></small></button>
      <button type="button" class="pk-ab raise"><b></b><small></small></button>
    </div>
    <div class="pk-wait" hidden></div>`;
  host.append(el);
  const q = (s) => el.querySelector(s);
  const sheet = q('.pk-sheet');
  const slider = q('.pk-slider');
  const valBig = q('.pk-sheet-val b');
  const valSmall = q('.pk-sheet-val small');
  const quick = q('.pk-quick');
  const btnFold = q('.pk-ab.fold');
  const btnCall = q('.pk-ab.call');
  const btnRaise = q('.pk-ab.raise');
  const timerEl = q('.pk-timer');
  const waitEl = q('.pk-wait');
  const decB = q('.pk-stepb.dec');
  const incB = q('.pk-stepb.inc');
  decB.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 12h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  incB.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 12h12M12 6v12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  slider.setAttribute('aria-label', t('raiseAmount'));

  let cur = null; // active prompt
  let resolve = null;
  let value = 0;
  let sheetOpen = false;
  let confirmTimer = 0;
  let tickRaf = 0;

  const clamp = (v) => Math.max(cur.minTo, Math.min(cur.maxTo, Math.round(v)));
  const snapStep = (v) => {
    // magnet to whole big blinds when comfortably inside the range
    if (v >= cur.maxTo || v <= cur.minTo) return clamp(v);
    const u = Math.max(1, cur.step || 1);
    return clamp(Math.round(v / u) * u);
  };

  function finish(action) {
    if (!resolve) return;
    const r = resolve;
    resolve = null;
    cur = null;
    cancelAnimationFrame(tickRaf);
    clearTimeout(confirmTimer);
    document.removeEventListener('keydown', onKey, true);
    closeSheet();
    el.classList.remove('active');
    timerEl.hidden = true;
    for (const b of [btnFold, btnCall, btnRaise]) b.disabled = true;
    onSound(action.type);
    r(action);
  }

  function raiseLabel() {
    return cur.facing ? t('act.raise') : t('act.bet');
  }
  function sizeText(v) {
    if (v >= cur.maxTo) return `${t('act.allin')} · ${fmt(v, true)}`;
    return `${cur.facing ? t('raiseTo') : t('betAmount')} ${fmt(v, true)}`;
  }

  function setValue(v, fromSlider = false) {
    value = snapStep(v);
    valBig.textContent = fmt(value, true);
    valSmall.textContent = value >= cur.maxTo ? t('act.allin') : cur.facing ? t('raiseTo') : t('betAmount');
    if (!fromSlider) slider.value = String(value);
    const allin = value >= cur.maxTo;
    const bbs = cur.bb ? (value / cur.bb).toFixed(value / cur.bb >= 10 ? 0 : 1).replace(/\.0$/, '') : '';
    btnRaise.querySelector('small').textContent = sheetOpen ? (bbs ? `${bbs} BB` : '') : '';
    btnRaise.querySelector('b').textContent = sheetOpen ? (allin ? t('act.allin') : sizeText(value).replace(/ · .*/, '')) : raiseLabel();
    btnRaise.classList.toggle('allin', allin && sheetOpen);
    decB.disabled = value <= cur.minTo;
    incB.disabled = value >= cur.maxTo;
    quick.querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === value));
    slider.style.setProperty('--p', ((value - cur.minTo) / Math.max(1, cur.maxTo - cur.minTo)) * 100 + '%');
  }

  function buildQuick() {
    quick.textContent = '';
    const potAfterCall = cur.pot + cur.toCall;
    const opts = [
      ['min', t('q.min'), cur.minTo],
      ['half', '½', cur.heroBet + cur.toCall + potAfterCall * 0.5],
      ['tq', '¾', cur.heroBet + cur.toCall + potAfterCall * 0.75],
      ['pot', t('q.pot'), cur.heroBet + cur.toCall + potAfterCall],
      ['allin', t('act.allin'), cur.maxTo],
    ];
    const seen = new Set();
    for (const [id, label, raw] of opts) {
      const v = id === 'min' ? cur.minTo : id === 'allin' ? cur.maxTo : clamp(raw);
      if (seen.has(v) && id !== 'allin') continue;
      if (id === 'allin') seen.delete(v);
      seen.add(v);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pk-q' + (id === 'allin' ? ' allin' : '');
      b.dataset.v = v;
      b.innerHTML = `<b>${label}</b><small>${fmt(v)}</small>`;
      b.addEventListener('click', () => {
        onSound('tick');
        setValue(v);
      });
      quick.append(b);
    }
  }

  function openSheet(preset) {
    if (!cur || !cur.canRaise) return;
    sheetOpen = true;
    sheet.hidden = false;
    el.classList.add('sheet');
    slider.min = String(cur.minTo);
    slider.max = String(cur.maxTo);
    slider.step = '1';
    buildQuick();
    setValue(preset != null ? preset : cur.minTo);
    btnRaise.classList.add('confirm');
    btnCall.querySelector('b').textContent = t('cancel');
    btnCall.querySelector('small').textContent = '';
    btnCall.classList.add('cancel');
  }
  function closeSheet() {
    sheetOpen = false;
    sheet.hidden = true;
    el.classList.remove('sheet');
    btnRaise.classList.remove('confirm', 'allin', 'armed');
    btnCall.classList.remove('cancel');
    clearTimeout(confirmTimer);
    if (cur) paintButtons();
  }

  function paintButtons() {
    btnFold.querySelector('b').textContent = t('act.fold');
    btnFold.querySelector('small').textContent = '';
    btnCall.classList.toggle('check', cur.toCall === 0);
    if (cur.toCall === 0) {
      btnCall.querySelector('b').textContent = t('act.check');
      btnCall.querySelector('small').textContent = '';
    } else {
      btnCall.querySelector('b').textContent = cur.callAllIn ? t('act.callAllin') : t('act.call');
      btnCall.querySelector('small').textContent = fmt(cur.callAmount, true);
    }
    btnRaise.querySelector('b').textContent = raiseLabel();
    btnRaise.querySelector('small').textContent = cur.canRaise ? t('from', { n: fmt(cur.minTo) }) : '';
    btnRaise.disabled = !cur.canRaise;
    btnRaise.hidden = false;
    btnFold.classList.toggle('soft', cur.toCall === 0);
  }

  function armedConfirm(btn, label) {
    // returns true when the second press arrived in time
    if (btn.classList.contains('armed')) {
      btn.classList.remove('armed');
      return true;
    }
    btn.classList.add('armed');
    btn.dataset.l = btn.querySelector('b').textContent;
    btn.querySelector('b').textContent = label;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => {
      btn.classList.remove('armed');
      if (cur) (sheetOpen ? setValue(value) : paintButtons());
    }, 2600);
    return false;
  }

  function doFold() {
    if (!cur) return;
    if (cur.toCall === 0 && prefs.get('confirmFold') !== false) {
      if (!armedConfirm(btnFold, t('foldConfirm'))) return;
    }
    finish({ type: 'fold' });
  }
  function doCall() {
    if (!cur) return;
    if (sheetOpen) return closeSheet();
    if (cur.toCall === 0) finish({ type: 'check' });
    else finish({ type: 'call', amount: cur.callAmount });
  }
  function doRaise() {
    if (!cur || !cur.canRaise) return;
    if (!sheetOpen) return openSheet();
    const allin = value >= cur.maxTo;
    if (allin && prefs.get('confirmAllIn') !== false && cur.maxTo - cur.heroBet >= (cur.bb || 1) * 12) {
      if (!armedConfirm(btnRaise, t('allinConfirm'))) return;
    }
    finish({ type: allin ? 'allin' : cur.facing ? 'raise' : 'bet', amount: value });
  }

  function onKey(e) {
    if (!cur || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName) && e.target.type !== 'range') return;
    const k = e.key.toLowerCase();
    if (k === 'f') doFold();
    else if (k === 'c') doCall();
    else if (k === 'r') (sheetOpen ? doRaise() : openSheet());
    else if (k === 'a') {
      if (!cur.canRaise) {
        if (cur.callAllIn) doCall();
        return;
      }
      if (!sheetOpen) openSheet(cur.maxTo);
      else if (value < cur.maxTo) setValue(cur.maxTo);
      else doRaise();
    } else if (k === 'escape' && sheetOpen) closeSheet();
    else if (k === 'enter' && sheetOpen) doRaise();
    else if (sheetOpen && (k === 'arrowup' || k === 'arrowright')) setValue(value + (cur.step || 1));
    else if (sheetOpen && (k === 'arrowdown' || k === 'arrowleft')) setValue(value - (cur.step || 1));
    else return;
    e.preventDefault();
  }

  btnFold.addEventListener('click', doFold);
  btnCall.addEventListener('click', doCall);
  btnRaise.addEventListener('click', doRaise);
  slider.addEventListener('input', () => setValue(Number(slider.value), true));
  decB.addEventListener('click', () => setValue(value - (cur.step || 1)));
  incB.addEventListener('click', () => setValue(value + (cur.step || 1)));

  function startTimer(sec) {
    if (!sec) {
      timerEl.hidden = true;
      return;
    }
    timerEl.hidden = false;
    const bar = timerEl.firstElementChild;
    const t0 = performance.now();
    const loop = () => {
      if (!cur) return;
      const f = Math.max(0, 1 - (performance.now() - t0) / (sec * 1000));
      bar.style.transform = `scaleX(${f})`;
      timerEl.classList.toggle('low', f < 0.25);
      if (f <= 0) {
        // time out: check if possible, else fold
        finish(cur.toCall === 0 ? { type: 'check', timeout: true } : { type: 'fold', timeout: true });
        return;
      }
      tickRaf = requestAnimationFrame(loop);
    };
    tickRaf = requestAnimationFrame(loop);
  }

  /**
   * opts: { toCall, callAmount (chips to put in, capped by stack), callAllIn, canRaise, facing (a bet exists),
   *         minTo, maxTo, heroBet, pot, bb, step, timer }
   */
  function prompt(opts) {
    if (resolve) finish({ type: 'fold' });
    cur = { step: opts.bb || 1, ...opts };
    el.classList.add('active');
    waitEl.hidden = true;
    q('.pk-btns').hidden = false;
    for (const b of [btnFold, btnCall, btnRaise]) {
      b.disabled = false;
      b.classList.remove('armed');
    }
    paintButtons();
    closeSheet();
    startTimer(opts.timer || 0);
    document.addEventListener('keydown', onKey, true);
    return new Promise((res) => (resolve = res));
  }

  /** Waiting / informational line instead of the buttons. */
  function wait(text, node) {
    if (resolve) finish({ type: 'fold' });
    el.classList.remove('active');
    closeSheet();
    q('.pk-btns').hidden = true;
    waitEl.hidden = !text && !node;
    waitEl.textContent = text || '';
    if (node) waitEl.append(node);
  }
  function cancel() {
    if (resolve) {
      const r = resolve;
      resolve = null;
      cur = null;
      cancelAnimationFrame(tickRaf);
      document.removeEventListener('keydown', onKey, true);
      r(null);
    }
    closeSheet();
  }
  function destroy() {
    cancel();
    el.remove();
  }
  return { el, prompt, wait, cancel, destroy, get active() { return !!cur; } };
}
