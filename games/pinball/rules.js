// Pinball Pro — game rules on top of the physics (scoring, balls, multipliers, combos, missions, multiball, tilt).
import { Sim } from './sim.js';
import { makeTable } from './tables.js';

export const SCORE = {
  bumper: 100, sling: 25, standup: 500, drop: 1000, bank: 10000, spin: 100, lane: 500, lanes: 5000,
  inlane: 250, outlane: 100, ramp: 5000, kickback: 1000, jackpot: 25000, mission: 25000, skill: 10000,
  combo: 250, allClear: 100000,
};
export const SAVER_TIME = 12;
export const MB_SAVER_TIME = 10;
export const COMBO_WINDOW = 1.8;
export const TILT_LIMIT = 3.2;
export const BONUS_TIME = 2.6;
export const MAX_MULT = 5;
export const RANKS = [0, 10000, 30000, 75000, 150000, 300000];
export const rankFor = (score) => {
  let r = 0;
  for (let i = 0; i < RANKS.length; i++) if (score >= RANKS[i]) r = i;
  return r;
};

function mulberry(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Game {
  constructor({ table = 'neon', balls = 3, seed = 1, missionsMode = false } = {}) {
    this.tableId = table;
    this.tb = makeTable(table);
    this.sim = new Sim(this.tb);
    this.rnd = mulberry(seed);
    this.ballsTotal = balls;
    this.missionsMode = missionsMode;
    this.score = 0;
    this.ballNo = 1;
    this.phase = 'ready';
    this.fx = [];
    this.stats = { bonus: 0, missions: 0, ramps: 0, banks: 0, multiballs: 0, maxCombo: 0, bumpers: 0, spins: 0, skill: 0, jackpots: 0, tilts: 0, saves: 0 };
    this.mi = 0;
    this.mp = 0;
    this.mround = 0;
    this.mset = new Set();
    this.allClear = false;
    this.msg = { text: '', sub: '', t: 0 };
    this.shake = 0;
    this.charge = 0;
    this.charging = false;
    this.time = 0;
    this.startBall();
  }

  // ---------------------------------------------------------------- ball lifecycle
  startBall() {
    const sim = this.sim;
    sim.balls.length = 0;
    sim.serve();
    sim.live = true;
    sim.flippersOn = true;
    sim.resetDrops();
    sim.kickArmed = { L: true, R: true };
    for (const f of sim.flippers) f.on = false;
    this.phase = 'ready';
    this.mult = 1;
    this.bonus = 0;
    this.lanes = this.tb.lanes.map(() => false);
    this.saver = 0;
    this.saverOn = false;
    this.multiball = false;
    this.mbLit = false;
    this.bankCount = 0;
    this.combo = 0;
    this.comboT = 0;
    this.tiltMeter = 0;
    this.tilted = false;
    this.tiltForce = 0;
    this.autoLaunch = 0;
    this.dropReset = 0;
    this.skillT = 0;
    this.skillLane = Math.floor(this.rnd() * this.tb.lanes.length);
    this.skillOpen = true;
    this.charge = 0;
    this.charging = false;
    this.bonusInfo = null;
    this.bonusT = 0;
    this.flash = 0;
    this.say(this.ballsTotal > 1 ? 'ballN' : 'ready', { n: this.ballNo, of: this.ballsTotal }, 1.8);
    this.emit({ t: 'ballStart', n: this.ballNo });
  }

  emit(e) {
    if (this.fx.length < 300) this.fx.push(e);
  }
  takeFx() {
    const f = this.fx;
    this.fx = [];
    return f;
  }
  say(key, params, dur = 1.4, sub) {
    this.msg = { key, params: params || {}, sub: sub || null, t: dur, dur };
    this.emit({ t: 'msg', key, params });
  }

  // ---------------------------------------------------------------- input
  pressFlipper(btn, on) {
    if (this.tilted) {
      this.sim.setFlipper(btn, false);
      return;
    }
    const was = this.sim.flippers.some((f) => f.btn === btn && f.on);
    this.sim.setFlipper(btn, on);
    if (on && !was) {
      this.emit({ t: 'flipUp', btn });
      if (this.phase === 'play') {
        // rotate lit rollover lanes
        const l = this.lanes;
        if (l.some(Boolean) && !l.every(Boolean)) {
          if (btn === 'L') l.push(l.shift());
          else l.unshift(l.pop());
        }
      }
    } else if (!on && was) this.emit({ t: 'flipDown', btn });
  }
  plunger(down) {
    if (this.phase !== 'ready') {
      this.charging = false;
      return;
    }
    if (down) {
      this.charging = true;
    } else if (this.charging) {
      this.charging = false;
      if (this.charge > 0.06) {
        if (this.sim.launch(this.charge)) {
          this.emit({ t: 'plunge', power: this.charge });
        }
      }
      this.charge = 0;
    }
  }
  nudge(dir = 0) {
    if (this.phase !== 'play' || this.tilted) return false;
    const d = dir || (this.rnd() < 0.5 ? -1 : 1);
    this.sim.nudge(d, -1);
    this.shake = 1;
    this.tiltMeter += 1;
    this.emit({ t: 'nudge' });
    if (this.tiltMeter >= TILT_LIMIT) this.doTilt();
    else if (this.tiltMeter >= 2) this.say('danger', {}, 1.0);
    return true;
  }
  doTilt() {
    this.tilted = true;
    this.sim.live = false;
    this.sim.flippersOn = false;
    for (const f of this.sim.flippers) f.on = false;
    this.tiltForce = 6;
    this.stats.tilts++;
    this.say('tilt', {}, 3);
    this.emit({ t: 'tilt' });
  }

  // ---------------------------------------------------------------- scoring helpers
  addScore(base, mul = true) {
    const v = Math.round(base * (mul ? this.mult : 1));
    this.score += v;
    return v;
  }
  touch() {
    this.comboT = COMBO_WINDOW;
    this.combo++;
    if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;
    if (this.combo >= 3) {
      this.score += SCORE.combo * this.combo;
      this.say('combo', { n: this.combo }, 1.0);
      this.emit({ t: 'combo', n: this.combo });
    }
    this.mission('combo', { n: this.combo });
  }
  raiseMult() {
    if (this.mult < MAX_MULT) {
      this.mult++;
      this.say('mult', { n: this.mult }, 1.4);
      this.emit({ t: 'mult', n: this.mult });
    } else this.score += 1000;
  }

  // ---------------------------------------------------------------- missions
  mission(ev, data) {
    const ms = this.tb.missions;
    const m = ms[this.mi];
    if (!m || this.allClear) return;
    const goal = Math.ceil(m.goal * (1 + 0.5 * this.mround));
    if (m.type === 'bumperAll') {
      if (ev === 'bumper') {
        this.mset.add(data.i);
        this.mp = this.mset.size;
      }
    } else if (m.type === 'count') {
      if (ev === m.ev) this.mp += data && data.n ? data.n : 1;
    } else if (m.type === 'combo') {
      if (ev === 'combo' && data.n >= goal) this.mp = goal;
    }
    if (this.mp >= (m.type === 'bumperAll' ? m.goal : goal)) this.completeMission(m);
  }
  missionGoal() {
    const m = this.tb.missions[this.mi];
    if (!m) return 0;
    return m.type === 'bumperAll' ? m.goal : Math.ceil(m.goal * (1 + 0.5 * this.mround));
  }
  completeMission(m) {
    const k = this.missionsMode ? 2 : 1;
    this.score += SCORE.mission * k;
    this.bonus += 5000;
    this.stats.missions++;
    this.say('missionDone', {}, 2.0);
    this.emit({ t: 'mission', id: m.id });
    this.mi++;
    this.mp = 0;
    this.mset = new Set();
    if (this.mi >= this.tb.missions.length) {
      if (this.missionsMode) {
        this.allClear = true;
        this.score += SCORE.allClear;
        this.say('allClear', {}, 3);
        this.emit({ t: 'allClear' });
      } else {
        this.mi = 0;
        this.mround++;
      }
    }
  }

  // ---------------------------------------------------------------- table events
  handle(e) {
    const tb = this.tb;
    this.emit(e);
    switch (e.t) {
      case 'launch':
        this.phase = 'play';
        this.saver = SAVER_TIME;
        this.skillT = 5;
        this.skillOpen = true;
        this.emit({ t: 'launched' });
        break;
      case 'bumper':
        this.addScore(SCORE.bumper);
        this.bonus += 10;
        this.stats.bumpers++;
        this.touch();
        this.mission('bumper', e);
        break;
      case 'sling':
        this.addScore(SCORE.sling);
        this.touch();
        break;
      case 'standup': {
        this.addScore(SCORE.standup);
        this.bonus += 250;
        this.touch();
        this.mission('standup', e);
        break;
      }
      case 'drop': {
        this.addScore(SCORE.drop);
        this.bonus += 300;
        this.touch();
        if (this.sim.drops.every((d) => d.down) && !this.dropReset) {
          this.stats.banks++;
          this.bankCount++;
          this.addScore(SCORE.bank);
          this.bonus += 3000;
          this.dropReset = 1.3;
          this.say('bank', {}, 1.5);
          this.emit({ t: 'bank' });
          if (this.bankCount % 2 === 0 && !this.multiball) {
            this.mbLit = true;
            this.say('mbLit', {}, 2);
          }
          this.mission('bank', e);
        }
        break;
      }
      case 'spin':
        this.addScore(SCORE.spin);
        this.stats.spins++;
        this.mission('spin', e);
        break;
      case 'lane': {
        this.skillCheck(e.i);
        if (this.lanes[e.i]) {
          this.score += 100;
        } else {
          this.lanes[e.i] = true;
          this.addScore(SCORE.lane);
          this.bonus += 200;
          if (this.lanes.every(Boolean)) {
            this.lanes = this.lanes.map(() => false);
            this.addScore(SCORE.lanes);
            this.bonus += 2000;
            this.raiseMult();
            this.emit({ t: 'lanesDone' });
            this.mission('lanes', e);
          }
        }
        break;
      }
      case 'inlane':
        this.addScore(SCORE.inlane);
        this.bonus += 50;
        break;
      case 'outlane':
        this.addScore(SCORE.outlane);
        break;
      case 'kickback':
        this.addScore(SCORE.kickback);
        this.say('kickback', {}, 1.2);
        break;
      case 'ramp': {
        this.stats.ramps++;
        this.addScore(SCORE.ramp);
        this.bonus += 1500;
        this.touch();
        if (this.mbLit && !this.multiball) this.startMultiball();
        else if (this.multiball) {
          this.stats.jackpots++;
          this.addScore(SCORE.jackpot);
          this.say('jackpot', {}, 2);
          this.emit({ t: 'jackpot' });
        } else this.say('ramp', {}, 1.0);
        this.mission('ramp', e);
        break;
      }
      case 'drain':
        this.onDrain(e);
        break;
      default:
    }
    void tb;
  }
  skillCheck(i) {
    if (this.skillT > 0 && this.skillOpen) {
      this.skillOpen = false;
      if (i === this.skillLane) {
        this.score += SCORE.skill;
        this.stats.skill++;
        this.say('skill', {}, 2);
        this.emit({ t: 'skill' });
      }
    }
  }
  startMultiball() {
    this.mbLit = false;
    this.multiball = true;
    this.stats.multiballs++;
    this.saver = Math.max(this.saver, MB_SAVER_TIME);
    this.sim.addBall(150, 130, 90, 60);
    this.sim.addBall(214, 140, -90, 40);
    this.say('multiball', {}, 2.5);
    this.emit({ t: 'multiball' });
    this.mission('multiball', {});
  }
  onDrain() {
    if (this.phase !== 'play') {
      // drained while waiting (should not happen): serve a fresh ball
      if (this.sim.balls.length === 0 && this.phase === 'ready') this.sim.serve();
      return;
    }
    const left = this.sim.balls.length;
    if (this.tilted) {
      if (left === 0) this.endBall(false);
      return;
    }
    if (this.saver > 0) {
      this.sim.serve();
      this.autoLaunch = 0.9;
      this.stats.saves++;
      this.say('saved', {}, 1.8);
      this.emit({ t: 'saved' });
      return;
    }
    if (left > 0) {
      if (this.multiball && left === 1) {
        this.multiball = false;
        this.emit({ t: 'mbEnd' });
      }
      return;
    }
    this.endBall(true);
  }
  endBall(eligible) {
    this.sim.balls.length = 0;
    this.phase = 'bonus';
    this.bonusT = 0;
    this.multiball = false;
    this.bonusInfo = eligible ? { base: this.bonus, mult: this.mult, total: this.bonus * this.mult } : { base: 0, mult: 1, total: 0, tilt: true };
    this.emit({ t: 'bonus', info: this.bonusInfo });
  }
  finishBonus() {
    if (this.phase !== 'bonus') return;
    const add = this.bonusInfo.total;
    this.score += add;
    this.stats.bonus += add;
    this.bonusInfo = null;
    this.emit({ t: 'bonusDone', add });
    if (this.ballNo >= this.ballsTotal || this.allClear) {
      this.phase = 'over';
      this.sim.balls.length = 0;
      this.emit({ t: 'over' });
    } else {
      this.ballNo++;
      this.startBall();
    }
  }

  // ---------------------------------------------------------------- per-frame
  update(dt) {
    if (this.phase === 'over') return;
    this.time += dt;
    if (this.msg.t > 0) this.msg.t -= dt;
    this.shake = Math.max(0, this.shake - dt * 4);
    if (this.phase === 'bonus') {
      this.bonusT += dt;
      this.sim.update(dt);
      this.sim.takeEvents();
      if (this.bonusT >= BONUS_TIME) this.finishBonus();
      return;
    }
    if (this.phase === 'ready') {
      if (this.charging) this.charge = Math.min(1, this.charge + dt / 0.9);
      else this.charge = Math.max(0, this.charge - dt * 3);
    }
    if (this.autoLaunch > 0) {
      this.autoLaunch -= dt;
      if (this.autoLaunch <= 0) {
        if (this.sim.launch(0.97)) this.autoLaunch = 0;
        else this.autoLaunch = 0.05;
      }
    }
    this.sim.update(dt);
    for (const e of this.sim.takeEvents()) {
      if (this.phase === 'bonus' || this.phase === 'over') break;
      this.handle(e);
    }
    if (this.phase !== 'play' && this.phase !== 'ready') return;
    if (this.phase === 'play') {
      if (this.saver > 0) this.saver = Math.max(0, this.saver - dt);
      if (this.skillT > 0) this.skillT -= dt;
      if (this.comboT > 0) {
        this.comboT -= dt;
        if (this.comboT <= 0) this.combo = 0;
      }
      if (this.tiltMeter > 0) this.tiltMeter = Math.max(0, this.tiltMeter - 0.5 * dt);
      if (this.tilted) {
        this.tiltForce -= dt;
        if (this.tiltForce <= 0) {
          this.sim.balls.length = 0;
          this.endBall(false);
          return;
        }
      }
      if (this.dropReset > 0) {
        this.dropReset -= dt;
        if (this.dropReset <= 0) {
          this.dropReset = 0;
          this.sim.resetDrops();
        }
      }
      this.stuck(dt);
    }
    this.saverOn = this.saver > 0;
  }

  stuck(dt) {
    const sim = this.sim;
    for (const b of sim.balls) {
      if (b.ramp || sim.inLane(b)) {
        b.still = 0;
        continue;
      }
      const sp = Math.hypot(b.vx, b.vy);
      if (sp < 14) b.still = (b.still || 0) + dt;
      else b.still = 0;
      let held = false;
      for (const f of sim.flippers) if (f.on && Math.hypot(b.x - f.px, b.y - f.py) < 90) held = true;
      if (b.still > (held ? 9 : 2.2)) {
        b.still = 0;
        b.kicks = (b.kicks || 0) + 1;
        if (b.kicks >= 3) {
          // re-serve this ball in the launch lane
          sim.balls.splice(sim.balls.indexOf(b), 1);
          sim.serve();
          this.autoLaunch = 0.9;
          this.say('reset', {}, 1.5);
          this.emit({ t: 'reserve' });
        } else {
          b.vx += (this.rnd() * 2 - 1) * 220;
          b.vy -= 260;
          this.emit({ t: 'unstick' });
        }
        return;
      }
    }
  }

  // ---------------------------------------------------------------- snapshot for results screens
  result() {
    return {
      table: this.tableId,
      score: this.score,
      rank: rankFor(this.score),
      balls: this.ballsTotal,
      stats: { ...this.stats },
      missionsMode: this.missionsMode,
      allClear: this.allClear,
    };
  }
}
