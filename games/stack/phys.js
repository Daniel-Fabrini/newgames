// Tiny rigid-body engine for boxes (own code, MIT-style, no dependencies).
// - SAT box/box collision with face clipping (up to 4 points per pair) and edge/edge contacts
// - sequential-impulse solver with warm starting, Coulomb friction (limited by the real normal impulse)
//   and speculative contacts, which is what keeps a 54-block tower standing still
// - global sleeping (the whole world sleeps when nothing moves)
// Units are arbitrary but consistent. Pure module: runs in node for tests.

const v3 = {
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
};
export { v3 };

let NEXT_ID = 1;

export class Body {
  constructor({ pos = [0, 0, 0], quat = [0, 0, 0, 1], half = [0.5, 0.5, 0.5], mass = 1, friction = 0.5, isStatic = false }) {
    this.id = NEXT_ID++;
    this.p = pos.slice();
    this.q = quat.slice();
    this.v = new Float64Array(3);
    this.w = new Float64Array(3);
    this.e = half.slice();
    this.f = [0, 0, 0]; // external force (cleared every step)
    this.friction = friction;
    this.isStatic = isStatic;
    this.kinematic = false;
    this.userData = null;
    this.ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    this.angDamp = 0.0;
    this.setMass(isStatic ? 0 : mass);
    this.updateAxes();
  }
  setMass(m) {
    this.mass = m;
    this.invM = m > 0 ? 1 / m : 0;
    const [hx, hy, hz] = this.e;
    const x = 2 * hx, y = 2 * hy, z = 2 * hz;
    // box inertia about its own axes
    const ix = (m * (y * y + z * z)) / 12, iy = (m * (x * x + z * z)) / 12, iz = (m * (x * x + y * y)) / 12;
    this.invI = m > 0 ? [1 / ix, 1 / iy, 1 / iz] : [0, 0, 0];
  }
  setKinematic(on) {
    this.kinematic = on;
    if (on) {
      this._m = this.mass || this._m;
      this.invM = 0;
      this.invI = [0, 0, 0];
    } else {
      this.setMass(this._m || 1);
    }
  }
  updateAxes() {
    const [x, y, z, w] = this.q;
    const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
    this.ax[0] = [1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy)];
    this.ax[1] = [2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx)];
    this.ax[2] = [2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy)];
  }
  setQuat(q) {
    const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    this.q = [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
    this.updateAxes();
  }
  // world-space inverse inertia times vector
  invIw(v) {
    const a = this.ax, d = this.invI;
    const s0 = (a[0][0] * v[0] + a[0][1] * v[1] + a[0][2] * v[2]) * d[0];
    const s1 = (a[1][0] * v[0] + a[1][1] * v[1] + a[1][2] * v[2]) * d[1];
    const s2 = (a[2][0] * v[0] + a[2][1] * v[1] + a[2][2] * v[2]) * d[2];
    return [a[0][0] * s0 + a[1][0] * s1 + a[2][0] * s2, a[0][1] * s0 + a[1][1] * s1 + a[2][1] * s2, a[0][2] * s0 + a[1][2] * s1 + a[2][2] * s2];
  }
  up() {
    return this.ax[1];
  }
  toLocal(pt) {
    const d = [pt[0] - this.p[0], pt[1] - this.p[1], pt[2] - this.p[2]];
    return [v3.dot(d, this.ax[0]), v3.dot(d, this.ax[1]), v3.dot(d, this.ax[2])];
  }
  toWorld(l) {
    const a = this.ax;
    return [this.p[0] + a[0][0] * l[0] + a[1][0] * l[1] + a[2][0] * l[2], this.p[1] + a[0][1] * l[0] + a[1][1] * l[1] + a[2][1] * l[2], this.p[2] + a[0][2] * l[0] + a[1][2] * l[1] + a[2][2] * l[2]];
  }
}

// ---------------------------------------------------------------- narrowphase
const MARGIN = 0.008; // speculative contact distance

function projR(e, ax, n) {
  return e[0] * Math.abs(v3.dot(ax[0], n)) + e[1] * Math.abs(v3.dot(ax[1], n)) + e[2] * Math.abs(v3.dot(ax[2], n));
}

function clipPoly(poly, n, d) {
  // keep points with dot(n,p) <= d
  const out = [];
  const m = poly.length;
  for (let i = 0; i < m; i++) {
    const a = poly[i], b = poly[(i + 1) % m];
    const da = v3.dot(n, a) - d, db = v3.dot(n, b) - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out;
}

// keep at most 4 points: deepest, farthest from it, then the ones that maximise the area
function reduce4(pts) {
  if (pts.length <= 4) return pts;
  let i0 = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].depth > pts[i0].depth) i0 = i;
  const a = pts[i0];
  let i1 = -1, bd = -1;
  for (let i = 0; i < pts.length; i++) if (i !== i0) {
    const d = (pts[i].p[0] - a.p[0]) ** 2 + (pts[i].p[1] - a.p[1]) ** 2 + (pts[i].p[2] - a.p[2]) ** 2;
    if (d > bd) { bd = d; i1 = i; }
  }
  const b = pts[i1];
  const ab = v3.sub(b.p, a.p);
  let i2 = -1, i3 = -1, best = 0, worst = 0;
  for (let i = 0; i < pts.length; i++) if (i !== i0 && i !== i1) {
    const area = v3.dot(v3.cross(ab, v3.sub(pts[i].p, a.p)), [0, 1, 0]) || 0;
    const full = v3.len(v3.cross(ab, v3.sub(pts[i].p, a.p)));
    const sgn = Math.sign(area) || 1;
    if (sgn > 0 && full > best) { best = full; i2 = i; }
    if (sgn < 0 && full > worst) { worst = full; i3 = i; }
  }
  const out = [a, b];
  if (i2 >= 0) out.push(pts[i2]);
  if (i3 >= 0) out.push(pts[i3]);
  if (out.length < 4) for (let i = 0; i < pts.length && out.length < 4; i++) if (!out.includes(pts[i])) out.push(pts[i]);
  return out;
}

// Returns { n (A to B), pts:[{p, depth}] } or null.
export function boxBox(A, B) {
  const ta = A.ax, tb = B.ax;
  const t = [B.p[0] - A.p[0], B.p[1] - A.p[1], B.p[2] - A.p[2]];
  let faceSep = -Infinity, faceIdx = -1;
  for (let k = 0; k < 6; k++) {
    const n = k < 3 ? ta[k] : tb[k - 3];
    const sep = Math.abs(v3.dot(t, n)) - (projR(A.e, ta, n) + projR(B.e, tb, n));
    if (sep > MARGIN) return null;
    if (sep > faceSep) { faceSep = sep; faceIdx = k; }
  }
  let edgeSep = -Infinity, ei = -1, ej = -1, edgeN = null;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const c = v3.cross(ta[i], tb[j]);
    const l = v3.len(c);
    if (l < 1e-4) continue;
    const n = [c[0] / l, c[1] / l, c[2] / l];
    const sep = Math.abs(v3.dot(t, n)) - (projR(A.e, ta, n) + projR(B.e, tb, n));
    if (sep > MARGIN) return null;
    if (sep > edgeSep) { edgeSep = sep; ei = i; ej = j; edgeN = n; }
  }
  if (edgeN && 0.95 * edgeSep > faceSep + 0.01) {
    // edge / edge
    const n = edgeN;
    if (v3.dot(t, n) < 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
    const PA = A.p.slice(), PB = B.p.slice();
    for (let k = 0; k < 3; k++) {
      if (k !== ei) {
        const s = v3.dot(n, ta[k]) > 0 ? 1 : -1;
        for (let c = 0; c < 3; c++) PA[c] += s * A.e[k] * ta[k][c];
      }
      if (k !== ej) {
        const s = v3.dot(n, tb[k]) > 0 ? -1 : 1;
        for (let c = 0; c < 3; c++) PB[c] += s * B.e[k] * tb[k][c];
      }
    }
    const da = ta[ei], db = tb[ej];
    const r = v3.sub(PA, PB);
    const b = v3.dot(da, db), d = v3.dot(da, r), e = v3.dot(db, r);
    const den = 1 - b * b;
    let s = (b * e - d) / den, u = (e - b * d) / den;
    s = Math.max(-A.e[ei], Math.min(A.e[ei], s));
    u = Math.max(-B.e[ej], Math.min(B.e[ej], u));
    const CA = [PA[0] + da[0] * s, PA[1] + da[1] * s, PA[2] + da[2] * s];
    const CB = [PB[0] + db[0] * u, PB[1] + db[1] * u, PB[2] + db[2] * u];
    return { n, pts: [{ p: [(CA[0] + CB[0]) / 2, (CA[1] + CB[1]) / 2, (CA[2] + CB[2]) / 2], depth: -edgeSep }] };
  }
  // face contact: reference face on R, incident face on I
  const refIsA = faceIdx < 3;
  const R = refIsA ? A : B, I = refIsA ? B : A;
  const k = refIsA ? faceIdx : faceIdx - 3;
  const rel = refIsA ? t : [-t[0], -t[1], -t[2]]; // from R to I
  const sgn = v3.dot(R.ax[k], rel) >= 0 ? 1 : -1;
  const nRef = v3.scale(R.ax[k], sgn);
  // incident face: the one most anti-parallel to nRef
  let ki = 0, bestD = 0;
  for (let m = 0; m < 3; m++) {
    const dd = v3.dot(I.ax[m], nRef);
    if (Math.abs(dd) > Math.abs(bestD)) { bestD = dd; ki = m; }
  }
  const nInc = v3.scale(I.ax[ki], bestD > 0 ? -1 : 1);
  const ic = [I.p[0] + nInc[0] * I.e[ki], I.p[1] + nInc[1] * I.e[ki], I.p[2] + nInc[2] * I.e[ki]];
  const k1 = (ki + 1) % 3, k2 = (ki + 2) % 3;
  const u1 = v3.scale(I.ax[k1], I.e[k1]), u2 = v3.scale(I.ax[k2], I.e[k2]);
  let poly = [
    [ic[0] + u1[0] + u2[0], ic[1] + u1[1] + u2[1], ic[2] + u1[2] + u2[2]],
    [ic[0] - u1[0] + u2[0], ic[1] - u1[1] + u2[1], ic[2] - u1[2] + u2[2]],
    [ic[0] - u1[0] - u2[0], ic[1] - u1[1] - u2[1], ic[2] - u1[2] - u2[2]],
    [ic[0] + u1[0] - u2[0], ic[1] + u1[1] - u2[1], ic[2] + u1[2] - u2[2]],
  ];
  const ka = (k + 1) % 3, kb = (k + 2) % 3;
  for (const kk of [ka, kb]) {
    const n = R.ax[kk];
    const off = v3.dot(n, R.p);
    poly = clipPoly(poly, n, off + R.e[kk]);
    if (!poly.length) return null;
    poly = clipPoly(poly, [-n[0], -n[1], -n[2]], -off + R.e[kk]);
    if (!poly.length) return null;
  }
  const planeD = v3.dot(nRef, R.p) + R.e[k];
  let pts = [];
  for (const p of poly) {
    const sep = v3.dot(nRef, p) - planeD; // negative when penetrating
    if (sep <= MARGIN) pts.push({ p: [p[0] - nRef[0] * sep * 0.5, p[1] - nRef[1] * sep * 0.5, p[2] - nRef[2] * sep * 0.5], depth: -sep });
  }
  if (!pts.length) return null;
  pts = reduce4(pts);
  const n = refIsA ? nRef : [-nRef[0], -nRef[1], -nRef[2]];
  return { n, pts };
}

// ---------------------------------------------------------------- world
export class World {
  constructor({ gravity = [0, -30, 0], iterations = 10 } = {}) {
    this.gravity = gravity;
    this.iterations = iterations;
    this.bodies = [];
    this.cache = new Map(); // pair key -> previous contacts (warm start)
    this.contacts = [];
    this.asleep = false;
    this.quiet = 0;
    this.beta = 0.2;
    this.slop = 0.004;
    this.linDamp = 0.02;
    this.angDamp = 0.08;
    this.onImpact = null;
    this.time = 0;
    this.sleepEnabled = true;
    this.preStep = null;
    this.substeps = 4;
    this.contactHertz = 30;
    this.contactDamping = 10;
    this.pushMax = 3;
    this._cap = 0;
    this._ccap = 0;
    this.layout(64);
  }
  // velocities of all bodies live in one typed array: body.v / body.w are views into it
  layout(cap) {
    const old = this.V;
    this.V = new Float64Array(cap * 6);
    this._cap = cap;
    this.DP = new Float64Array(cap * 3);
    this.DR = new Float64Array(cap * 9);
    this.QD = new Float64Array(cap * 4);
    this.bodies.forEach((b, i) => {
      if (old) this.V.set(old.subarray(0, 0)); // (values are copied per body below)
      const v = b.v, w = b.w;
      const vv = [v[0], v[1], v[2]], ww = [w[0], w[1], w[2]];
      b.v = this.V.subarray(i * 6, i * 6 + 3);
      b.w = this.V.subarray(i * 6 + 3, i * 6 + 6);
      b.v.set(vv);
      b.w.set(ww);
    });
  }
  reindex() {
    if (this.bodies.length > this._cap) return this.layout(this.bodies.length * 2);
    this.layout(this._cap);
  }
  add(b) {
    this.bodies.push(b);
    this.reindex();
    this.wake();
    return b;
  }
  remove(b) {
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
    this.reindex();
    this.wake();
  }
  wake() {
    this.asleep = false;
    this.quiet = 0;
  }
  ensureContacts(n) {
    if (n <= this._ccap) return;
    this._ccap = Math.max(n, this._ccap * 2, 256);
    this.D = new Float64Array(this._ccap * 45);
    this.M = new Float64Array(this._ccap * 3);
    this.J = new Float64Array(this._ccap * 3);
    this.S0 = new Float64Array(this._ccap);
    this.RA = new Float64Array(this._ccap * 3);
    this.RB = new Float64Array(this._ccap * 3);
    this.MU = new Float64Array(this._ccap);
    this.CA = new Int32Array(this._ccap);
    this.CB = new Int32Array(this._ccap);
    this.IMA = new Float64Array(this._ccap);
    this.IMB = new Float64Array(this._ccap);
  }
  step(dt) {
    if (this.asleep) return;
    this.time += dt;
    if (this.preStep) this.preStep(dt);
    const g = this.gravity;
    const bodies = this.bodies;
    const n = bodies.length;
    for (let i = 0; i < n; i++) bodies[i].idx = i;
    // broadphase + narrowphase
    const aabbs = new Array(n);
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      const ax = b.ax, e = b.e;
      const rx = e[0] * Math.abs(ax[0][0]) + e[1] * Math.abs(ax[1][0]) + e[2] * Math.abs(ax[2][0]);
      const ry = e[0] * Math.abs(ax[0][1]) + e[1] * Math.abs(ax[1][1]) + e[2] * Math.abs(ax[2][1]);
      const rz = e[0] * Math.abs(ax[0][2]) + e[1] * Math.abs(ax[1][2]) + e[2] * Math.abs(ax[2][2]);
      aabbs[i] = [b.p[0] - rx, b.p[1] - ry, b.p[2] - rz, b.p[0] + rx, b.p[1] + ry, b.p[2] + rz];
    }
    const contacts = [];
    const newCache = new Map();
    for (let i = 0; i < n; i++) {
      const A = bodies[i];
      const a = aabbs[i];
      for (let j = i + 1; j < n; j++) {
        const B = bodies[j];
        if (A.invM === 0 && B.invM === 0) continue;
        const c = aabbs[j];
        if (a[0] > c[3] + MARGIN || c[0] > a[3] + MARGIN || a[1] > c[4] + MARGIN || c[1] > a[4] + MARGIN || a[2] > c[5] + MARGIN || c[2] > a[5] + MARGIN) continue;
        const m = boxBox(A, B);
        if (!m) continue;
        const key = A.id * 100000 + B.id;
        const old = this.cache.get(key);
        const list = [];
        const mu = Math.sqrt(A.friction * B.friction);
        for (const pt of m.pts) {
          const la = A.toLocal(pt.p);
          const ct = { A, B, n: m.n, p: pt.p, depth: pt.depth, la, mu, jn: 0, j1: 0, j2: 0 };
          if (old) {
            let bd = 0.0036; // 0.06^2
            for (const o of old) {
              const w = A.toWorld(o.la);
              const d = (w[0] - pt.p[0]) ** 2 + (w[1] - pt.p[1]) ** 2 + (w[2] - pt.p[2]) ** 2;
              if (d < bd) { bd = d; ct.jn = o.jn; ct.j1 = o.j1; ct.j2 = o.j2; }
            }
          }
          list.push(ct);
          contacts.push(ct);
        }
        newCache.set(key, list);
      }
    }
    this.contacts = contacts;
    const nc = contacts.length;
    this.ensureContacts(nc);
    const { D, M, J, MU, CA, CB, IMA, IMB, V, S0, RA, RB } = this;
    // ---- contact set-up (once per frame)
    for (let k = 0; k < nc; k++) {
      const c = contacts[k];
      const { A, B, n } = c;
      const ra = [c.p[0] - A.p[0], c.p[1] - A.p[1], c.p[2] - A.p[2]];
      const rb = [c.p[0] - B.p[0], c.p[1] - B.p[1], c.p[2] - B.p[2]];
      const ref = Math.abs(n[0]) > 0.7 ? [0, 1, 0] : [1, 0, 0];
      let t1 = v3.cross(n, ref);
      const l = v3.len(t1);
      t1 = [t1[0] / l, t1[1] / l, t1[2] / l];
      const t2 = v3.cross(n, t1);
      const dirs = [n, t1, t2];
      const base = k * 45;
      for (let r = 0; r < 3; r++) {
        const dd = dirs[r];
        const o = base + r * 15;
        const rax = v3.cross(ra, dd), rbx = v3.cross(rb, dd);
        const ia = A.invIw(rax), ib = B.invIw(rbx);
        D[o] = dd[0]; D[o + 1] = dd[1]; D[o + 2] = dd[2];
        D[o + 3] = rax[0]; D[o + 4] = rax[1]; D[o + 5] = rax[2];
        D[o + 6] = rbx[0]; D[o + 7] = rbx[1]; D[o + 8] = rbx[2];
        D[o + 9] = ia[0]; D[o + 10] = ia[1]; D[o + 11] = ia[2];
        D[o + 12] = ib[0]; D[o + 13] = ib[1]; D[o + 14] = ib[2];
        const kk = A.invM + B.invM + v3.dot(ia, rax) + v3.dot(ib, rbx);
        M[k * 3 + r] = kk > 0 ? 1 / kk : 0;
      }
      CA[k] = A.idx;
      CB[k] = B.idx;
      IMA[k] = A.invM;
      IMB[k] = B.invM;
      MU[k] = c.mu;
      S0[k] = -c.depth;
      RA[k * 3] = ra[0]; RA[k * 3 + 1] = ra[1]; RA[k * 3 + 2] = ra[2];
      RB[k * 3] = rb[0]; RB[k * 3 + 1] = rb[1]; RB[k * 3 + 2] = rb[2];
      J[k * 3] = c.jn; J[k * 3 + 1] = c.j1; J[k * 3 + 2] = c.j2;
      c.vn0 = rowVel(D, base, V, A.idx * 6, B.idx * 6);
    }
    // ---- sub-stepped soft-constraint solver
    const sub = this.substeps;
    const h = dt / sub, invH = 1 / h;
    const hertz = Math.min(this.contactHertz, 0.25 * invH);
    const zeta = this.contactDamping;
    const omega = 2 * Math.PI * hertz;
    const a1 = 2 * zeta + h * omega, a2 = h * omega * a1, a3 = 1 / (1 + a2);
    const biasRate = omega / a1, massScale = a2 * a3, impulseScale = a3;
    const pushMax = this.pushMax;
    const DP = this.DP, DR = this.DR, QD = this.QD;
    DP.fill(0, 0, n * 3);
    for (let i = 0; i < n; i++) { QD[i * 4] = 0; QD[i * 4 + 1] = 0; QD[i * 4 + 2] = 0; QD[i * 4 + 3] = 1; const o = i * 9; DR.fill(0, o, o + 9); DR[o] = DR[o + 4] = DR[o + 8] = 1; }
    const solveAll = (useBias) => {
      for (let ii = 0; ii < nc; ii++) {
        const k = useBias ? ii : nc - 1 - ii;
        const ia = CA[k], ib = CB[k];
        const a = ia * 6, b = ib * 6, imA = IMA[k], imB = IMB[k], base = k * 45, k3 = k * 3;
        // friction rows first (limited by the normal impulse of the previous pass)
        const maxF = MU[k] * J[k3];
        let l = -M[k3 + 1] * rowVel(D, base + 15, V, a, b);
        let nj = J[k3 + 1] + l;
        nj = nj > maxF ? maxF : nj < -maxF ? -maxF : nj;
        l = nj - J[k3 + 1];
        J[k3 + 1] = nj;
        if (l !== 0) rowApply(D, base + 15, l, V, a, b, imA, imB);
        l = -M[k3 + 2] * rowVel(D, base + 30, V, a, b);
        nj = J[k3 + 2] + l;
        nj = nj > maxF ? maxF : nj < -maxF ? -maxF : nj;
        l = nj - J[k3 + 2];
        J[k3 + 2] = nj;
        if (l !== 0) rowApply(D, base + 30, l, V, a, b, imA, imB);
        // normal row: current separation from the accumulated body displacement
        const nx = D[base], ny = D[base + 1], nz = D[base + 2];
        const pa = ia * 3, pb = ib * 3, ra9 = ia * 9, rb9 = ib * 9, k3r = k * 3;
        const rax = RA[k3r], ray = RA[k3r + 1], raz = RA[k3r + 2], rbx = RB[k3r], rby = RB[k3r + 1], rbz = RB[k3r + 2];
        const dx = DP[pb] - DP[pa] + (DR[rb9] * rbx + DR[rb9 + 1] * rby + DR[rb9 + 2] * rbz - rbx) - (DR[ra9] * rax + DR[ra9 + 1] * ray + DR[ra9 + 2] * raz - rax);
        const dy = DP[pb + 1] - DP[pa + 1] + (DR[rb9 + 3] * rbx + DR[rb9 + 4] * rby + DR[rb9 + 5] * rbz - rby) - (DR[ra9 + 3] * rax + DR[ra9 + 4] * ray + DR[ra9 + 5] * raz - ray);
        const dz = DP[pb + 2] - DP[pa + 2] + (DR[rb9 + 6] * rbx + DR[rb9 + 7] * rby + DR[rb9 + 8] * rbz - rbz) - (DR[ra9 + 6] * rax + DR[ra9 + 7] * ray + DR[ra9 + 8] * raz - raz);
        const sep = S0[k] + nx * dx + ny * dy + nz * dz;
        let bias = 0, ms = 1, is = 0;
        if (sep > 0) bias = sep * invH;
        else if (useBias) {
          bias = Math.max(biasRate * (sep + this.slop), -pushMax);
          if (bias > 0) bias = 0;
          ms = massScale;
          is = impulseScale;
        }
        l = -M[k3] * ms * (rowVel(D, base, V, a, b) + bias) - is * J[k3];
        nj = J[k3] + l;
        if (nj < 0) nj = 0;
        l = nj - J[k3];
        J[k3] = nj;
        if (l !== 0) rowApply(D, base, l, V, a, b, imA, imB);
      }
    };
    const ld = 1 / (1 + this.linDamp * h);
    for (let sIdx = 0; sIdx < sub; sIdx++) {
      // integrate velocities
      for (let i = 0; i < n; i++) {
        const bd = bodies[i];
        if (bd.invM === 0) continue;
        const o = i * 6;
        V[o] += (g[0] + bd.f[0] * bd.invM) * h;
        V[o + 1] += (g[1] + bd.f[1] * bd.invM) * h;
        V[o + 2] += (g[2] + bd.f[2] * bd.invM) * h;
        const ad = 1 / (1 + (this.angDamp + bd.angDamp) * h);
        V[o] *= ld; V[o + 1] *= ld; V[o + 2] *= ld;
        V[o + 3] *= ad; V[o + 4] *= ad; V[o + 5] *= ad;
      }
      // warm start
      for (let k = 0; k < nc; k++) {
        const a = CA[k] * 6, b = CB[k] * 6, base = k * 45, k3 = k * 3, imA = IMA[k], imB = IMB[k];
        if (J[k3] !== 0) rowApply(D, base, J[k3], V, a, b, imA, imB);
        if (J[k3 + 1] !== 0) rowApply(D, base + 15, J[k3 + 1], V, a, b, imA, imB);
        if (J[k3 + 2] !== 0) rowApply(D, base + 30, J[k3 + 2], V, a, b, imA, imB);
      }
      solveAll(true);
      // integrate positions (as displacements from the start of the frame)
      for (let i = 0; i < n; i++) {
        const bd = bodies[i];
        if (bd.invM === 0) continue;
        const o = i * 6;
        const wx = V[o + 3], wy = V[o + 4], wz = V[o + 5];
        const wl = Math.hypot(wx, wy, wz);
        if (wl > 30) { const sc = 30 / wl; V[o + 3] *= sc; V[o + 4] *= sc; V[o + 5] *= sc; }
        DP[i * 3] += V[o] * h; DP[i * 3 + 1] += V[o + 1] * h; DP[i * 3 + 2] += V[o + 2] * h;
        const q = i * 4;
        const x = QD[q], y = QD[q + 1], z = QD[q + 2], w = QD[q + 3];
        const hw = 0.5 * h, ux = V[o + 3], uy = V[o + 4], uz = V[o + 5];
        let nx = x + hw * (ux * w + uy * z - uz * y), ny = y + hw * (uy * w + uz * x - ux * z), nz = z + hw * (uz * w + ux * y - uy * x), nw = w + hw * (-ux * x - uy * y - uz * z);
        const ln = 1 / Math.hypot(nx, ny, nz, nw);
        nx *= ln; ny *= ln; nz *= ln; nw *= ln;
        QD[q] = nx; QD[q + 1] = ny; QD[q + 2] = nz; QD[q + 3] = nw;
        const r = i * 9;
        const xx = nx * nx, yy = ny * ny, zz = nz * nz, xy = nx * ny, xz = nx * nz, yz = ny * nz, wx2 = nw * nx, wy2 = nw * ny, wz2 = nw * nz;
        DR[r] = 1 - 2 * (yy + zz); DR[r + 1] = 2 * (xy - wz2); DR[r + 2] = 2 * (xz + wy2);
        DR[r + 3] = 2 * (xy + wz2); DR[r + 4] = 1 - 2 * (xx + zz); DR[r + 5] = 2 * (yz - wx2);
        DR[r + 6] = 2 * (xz - wy2); DR[r + 7] = 2 * (yz + wx2); DR[r + 8] = 1 - 2 * (xx + yy);
      }
      solveAll(false);
    }
    for (let k = 0; k < nc; k++) {
      const c = contacts[k];
      c.jn = J[k * 3]; c.j1 = J[k * 3 + 1]; c.j2 = J[k * 3 + 2];
    }
    if (this.onImpact) for (const c of contacts) if (c.vn0 < -1.5 && c.jn > 0) this.onImpact(-c.vn0, c.A, c.B);
    // write back the displacements
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (b.kinematic || b.invM === 0) continue;
      b.f[0] = b.f[1] = b.f[2] = 0;
      b.p[0] += DP[i * 3]; b.p[1] += DP[i * 3 + 1]; b.p[2] += DP[i * 3 + 2];
      const q = i * 4;
      const x = QD[q], y = QD[q + 1], z = QD[q + 2], w = QD[q + 3];
      const [bx, by, bz, bw] = b.q;
      b.setQuat([w * bx + x * bw + y * bz - z * by, w * by - x * bz + y * bw + z * bx, w * bz + x * by - y * bx + z * bw, w * bw - x * bx - y * by - z * bz]);
    }
    this.cache = newCache;
    // global sleeping
    if (this.sleepEnabled) {
      let moving = false;
      for (const b of bodies) {
        if (b.invM === 0) continue;
        if (b.v[0] * b.v[0] + b.v[1] * b.v[1] + b.v[2] * b.v[2] > 0.01 || b.w[0] * b.w[0] + b.w[1] * b.w[1] + b.w[2] * b.w[2] > 0.02) { moving = true; break; }
      }
      if (moving) this.quiet = 0;
      else if ((this.quiet += dt) > 0.4) {
        this.asleep = true;
        for (const b of bodies) { b.v.fill(0); b.w.fill(0); }
      }
    }
  }
}

function rowVel(D, o, V, a, b) {
  return D[o] * (V[b] - V[a]) + D[o + 1] * (V[b + 1] - V[a + 1]) + D[o + 2] * (V[b + 2] - V[a + 2]) + V[b + 3] * D[o + 6] + V[b + 4] * D[o + 7] + V[b + 5] * D[o + 8] - V[a + 3] * D[o + 3] - V[a + 4] * D[o + 4] - V[a + 5] * D[o + 5];
}

function rowApply(D, o, l, V, a, b, imA, imB) {
  if (imA !== 0) {
    const k = l * imA;
    V[a] -= D[o] * k; V[a + 1] -= D[o + 1] * k; V[a + 2] -= D[o + 2] * k;
    V[a + 3] -= D[o + 9] * l; V[a + 4] -= D[o + 10] * l; V[a + 5] -= D[o + 11] * l;
  }
  if (imB !== 0) {
    const k = l * imB;
    V[b] += D[o] * k; V[b + 1] += D[o + 1] * k; V[b + 2] += D[o + 2] * k;
    V[b + 3] += D[o + 12] * l; V[b + 4] += D[o + 13] * l; V[b + 5] += D[o + 14] * l;
  }
}
