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
  invIw(x, y, z) {
    const a = this.ax, d = this.invI;
    const s0 = (a[0][0] * x + a[0][1] * y + a[0][2] * z) * d[0];
    const s1 = (a[1][0] * x + a[1][1] * y + a[1][2] * z) * d[1];
    const s2 = (a[2][0] * x + a[2][1] * y + a[2][2] * z) * d[2];
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

// ---------------------------------------------------------------- narrowphase (allocation free)
const MARGIN = 0.008; // speculative contact distance

// scratch manifold written by satBoxBox()
const MF = { n: new Float64Array(3), cnt: 0, p: new Float64Array(12), depth: new Float64Array(4) };
const polyA = new Float64Array(3 * 12);
const polyB = new Float64Array(3 * 12);
const cand = { p: new Float64Array(3 * 12), d: new Float64Array(12), k: 0 };

// clip polygon src (n points) keeping nx*x+ny*y+nz*z <= d; writes to dst, returns the new count
function clipPlane(src, n, dst, nx, ny, nz, d) {
  let m = 0;
  for (let i = 0; i < n; i++) {
    const j = i + 1 === n ? 0 : i + 1;
    const ax = src[i * 3], ay = src[i * 3 + 1], az = src[i * 3 + 2];
    const bx = src[j * 3], by = src[j * 3 + 1], bz = src[j * 3 + 2];
    const da = nx * ax + ny * ay + nz * az - d, db = nx * bx + ny * by + nz * bz - d;
    if (da <= 0) {
      dst[m * 3] = ax; dst[m * 3 + 1] = ay; dst[m * 3 + 2] = az;
      m++;
    }
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      dst[m * 3] = ax + (bx - ax) * t; dst[m * 3 + 1] = ay + (by - ay) * t; dst[m * 3 + 2] = az + (bz - az) * t;
      m++;
    }
    if (m > 10) break;
  }
  return m;
}

// keep at most 4 manifold points (deepest, farthest, then the largest triangle areas on both sides)
function reduceTo4(k) {
  const P = cand.p, D = cand.d;
  let i0 = 0;
  for (let i = 1; i < k; i++) if (D[i] > D[i0]) i0 = i;
  let i1 = -1, bd = -1;
  for (let i = 0; i < k; i++) if (i !== i0) {
    const dx = P[i * 3] - P[i0 * 3], dy = P[i * 3 + 1] - P[i0 * 3 + 1], dz = P[i * 3 + 2] - P[i0 * 3 + 2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d > bd) { bd = d; i1 = i; }
  }
  const abx = P[i1 * 3] - P[i0 * 3], aby = P[i1 * 3 + 1] - P[i0 * 3 + 1], abz = P[i1 * 3 + 2] - P[i0 * 3 + 2];
  let i2 = -1, i3 = -1, best = 0, worst = 0;
  for (let i = 0; i < k; i++) if (i !== i0 && i !== i1) {
    const px = P[i * 3] - P[i0 * 3], py = P[i * 3 + 1] - P[i0 * 3 + 1], pz = P[i * 3 + 2] - P[i0 * 3 + 2];
    const cx = aby * pz - abz * py, cy = abz * px - abx * pz, cz = abx * py - aby * px;
    const area = Math.hypot(cx, cy, cz);
    const side = cy >= 0 ? 1 : -1; // approximate "side" using the vertical component (contacts are mostly horizontal)
    if (side > 0) { if (area > best) { best = area; i2 = i; } } else if (area > worst) { worst = area; i3 = i; }
  }
  const pick = [i0, i1];
  if (i2 >= 0) pick.push(i2);
  if (i3 >= 0) pick.push(i3);
  for (let i = 0; i < k && pick.length < 4; i++) if (!pick.includes(i)) pick.push(i);
  for (let q = 0; q < 4; q++) {
    const i = pick[q];
    MF.p[q * 3] = P[i * 3]; MF.p[q * 3 + 1] = P[i * 3 + 1]; MF.p[q * 3 + 2] = P[i * 3 + 2];
    MF.depth[q] = D[i];
  }
  MF.cnt = 4;
}

// SAT on the 15 axes. Returns true on contact; the manifold (normal from A to B) is in MF.
function satBoxBox(A, B) {
  const a0 = A.ax[0], a1 = A.ax[1], a2 = A.ax[2], b0 = B.ax[0], b1 = B.ax[1], b2 = B.ax[2];
  const ea0 = A.e[0], ea1 = A.e[1], ea2 = A.e[2], eb0 = B.e[0], eb1 = B.e[1], eb2 = B.e[2];
  const tx = B.p[0] - A.p[0], ty = B.p[1] - A.p[1], tz = B.p[2] - A.p[2];
  const R00 = a0[0] * b0[0] + a0[1] * b0[1] + a0[2] * b0[2], R01 = a0[0] * b1[0] + a0[1] * b1[1] + a0[2] * b1[2], R02 = a0[0] * b2[0] + a0[1] * b2[1] + a0[2] * b2[2];
  const R10 = a1[0] * b0[0] + a1[1] * b0[1] + a1[2] * b0[2], R11 = a1[0] * b1[0] + a1[1] * b1[1] + a1[2] * b1[2], R12 = a1[0] * b2[0] + a1[1] * b2[1] + a1[2] * b2[2];
  const R20 = a2[0] * b0[0] + a2[1] * b0[1] + a2[2] * b0[2], R21 = a2[0] * b1[0] + a2[1] * b1[1] + a2[2] * b1[2], R22 = a2[0] * b2[0] + a2[1] * b2[1] + a2[2] * b2[2];
  const t0 = tx * a0[0] + ty * a0[1] + tz * a0[2], t1 = tx * a1[0] + ty * a1[1] + tz * a1[2], t2 = tx * a2[0] + ty * a2[1] + tz * a2[2];
  const E = 1e-6;
  const A00 = Math.abs(R00) + E, A01 = Math.abs(R01) + E, A02 = Math.abs(R02) + E;
  const A10 = Math.abs(R10) + E, A11 = Math.abs(R11) + E, A12 = Math.abs(R12) + E;
  const A20 = Math.abs(R20) + E, A21 = Math.abs(R21) + E, A22 = Math.abs(R22) + E;
  let faceSep = -Infinity, faceIdx = -1;
  let sep;
  // faces of A
  sep = Math.abs(t0) - (ea0 + eb0 * A00 + eb1 * A01 + eb2 * A02);
  if (sep > MARGIN) return false;
  if (sep > faceSep) { faceSep = sep; faceIdx = 0; }
  sep = Math.abs(t1) - (ea1 + eb0 * A10 + eb1 * A11 + eb2 * A12);
  if (sep > MARGIN) return false;
  if (sep > faceSep) { faceSep = sep; faceIdx = 1; }
  sep = Math.abs(t2) - (ea2 + eb0 * A20 + eb1 * A21 + eb2 * A22);
  if (sep > MARGIN) return false;
  if (sep > faceSep) { faceSep = sep; faceIdx = 2; }
  // faces of B
  sep = Math.abs(t0 * R00 + t1 * R10 + t2 * R20) - (ea0 * A00 + ea1 * A10 + ea2 * A20 + eb0);
  if (sep > MARGIN) return false;
  if (sep > faceSep) { faceSep = sep; faceIdx = 3; }
  sep = Math.abs(t0 * R01 + t1 * R11 + t2 * R21) - (ea0 * A01 + ea1 * A11 + ea2 * A21 + eb1);
  if (sep > MARGIN) return false;
  if (sep > faceSep) { faceSep = sep; faceIdx = 4; }
  sep = Math.abs(t0 * R02 + t1 * R12 + t2 * R22) - (ea0 * A02 + ea1 * A12 + ea2 * A22 + eb2);
  if (sep > MARGIN) return false;
  if (sep > faceSep) { faceSep = sep; faceIdx = 5; }
  // edges: A_i x B_j
  let edgeSep = -Infinity, ei = -1, ej = -1;
  const Rm = [R00, R01, R02, R10, R11, R12, R20, R21, R22];
  const Am = [A00, A01, A02, A10, A11, A12, A20, A21, A22];
  const tA = [t0, t1, t2];
  const eA = [ea0, ea1, ea2], eB = [eb0, eb1, eb2];
  for (let i = 0; i < 3; i++) {
    const i1 = (i + 1) % 3, i2 = (i + 2) % 3;
    for (let j = 0; j < 3; j++) {
      const j1 = (j + 1) % 3, j2 = (j + 2) % 3;
      const r = Rm[i * 3 + j];
      const l2 = 1 - r * r;
      if (l2 < 1e-6) continue;
      const ra = eA[i1] * Am[i2 * 3 + j] + eA[i2] * Am[i1 * 3 + j];
      const rb = eB[j1] * Am[i * 3 + j2] + eB[j2] * Am[i * 3 + j1];
      const dist = Math.abs(tA[i2] * Rm[i1 * 3 + j] - tA[i1] * Rm[i2 * 3 + j]);
      sep = (dist - (ra + rb)) / Math.sqrt(l2);
      if (sep > MARGIN) return false;
      if (sep > edgeSep) { edgeSep = sep; ei = i; ej = j; }
    }
  }
  if (ei >= 0 && 0.95 * edgeSep > faceSep + 0.01) {
    // edge / edge: one contact point
    const da = A.ax[ei], db = B.ax[ej];
    let nx = da[1] * db[2] - da[2] * db[1], ny = da[2] * db[0] - da[0] * db[2], nz = da[0] * db[1] - da[1] * db[0];
    const nl = Math.hypot(nx, ny, nz);
    nx /= nl; ny /= nl; nz /= nl;
    if (nx * tx + ny * ty + nz * tz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    let pax = A.p[0], pay = A.p[1], paz = A.p[2], pbx = B.p[0], pby = B.p[1], pbz = B.p[2];
    for (let k = 0; k < 3; k++) {
      if (k !== ei) {
        const ax = A.ax[k];
        const sg = (nx * ax[0] + ny * ax[1] + nz * ax[2] > 0 ? 1 : -1) * eA[k];
        pax += sg * ax[0]; pay += sg * ax[1]; paz += sg * ax[2];
      }
      if (k !== ej) {
        const bx = B.ax[k];
        const sg = (nx * bx[0] + ny * bx[1] + nz * bx[2] > 0 ? -1 : 1) * eB[k];
        pbx += sg * bx[0]; pby += sg * bx[1]; pbz += sg * bx[2];
      }
    }
    const rx = pax - pbx, ry = pay - pby, rz = paz - pbz;
    const bb = da[0] * db[0] + da[1] * db[1] + da[2] * db[2];
    const d = da[0] * rx + da[1] * ry + da[2] * rz, e = db[0] * rx + db[1] * ry + db[2] * rz;
    const den = 1 - bb * bb;
    let s = (bb * e - d) / den, u = (e - bb * d) / den;
    s = Math.max(-eA[ei], Math.min(eA[ei], s));
    u = Math.max(-eB[ej], Math.min(eB[ej], u));
    MF.n[0] = nx; MF.n[1] = ny; MF.n[2] = nz;
    MF.cnt = 1;
    MF.p[0] = (pax + da[0] * s + pbx + db[0] * u) * 0.5;
    MF.p[1] = (pay + da[1] * s + pby + db[1] * u) * 0.5;
    MF.p[2] = (paz + da[2] * s + pbz + db[2] * u) * 0.5;
    MF.depth[0] = -edgeSep;
    return true;
  }
  // face contact: clip the incident face against the side planes of the reference face
  const refIsA = faceIdx < 3;
  const R = refIsA ? A : B, I = refIsA ? B : A;
  const k = refIsA ? faceIdx : faceIdx - 3;
  const rx0 = refIsA ? tx : -tx, ry0 = refIsA ? ty : -ty, rz0 = refIsA ? tz : -tz;
  const rk = R.ax[k];
  const sg = rk[0] * rx0 + rk[1] * ry0 + rk[2] * rz0 >= 0 ? 1 : -1;
  const nrx = rk[0] * sg, nry = rk[1] * sg, nrz = rk[2] * sg;
  let ki = 0, bestD = 0;
  for (let m = 0; m < 3; m++) {
    const ia = I.ax[m];
    const dd = ia[0] * nrx + ia[1] * nry + ia[2] * nrz;
    if (Math.abs(dd) > Math.abs(bestD)) { bestD = dd; ki = m; }
  }
  const ni = bestD > 0 ? -1 : 1;
  const iax = I.ax[ki];
  const icx = I.p[0] + iax[0] * ni * I.e[ki], icy = I.p[1] + iax[1] * ni * I.e[ki], icz = I.p[2] + iax[2] * ni * I.e[ki];
  const k1 = (ki + 1) % 3, k2 = (ki + 2) % 3;
  const u1 = I.ax[k1], u2 = I.ax[k2], e1 = I.e[k1], e2 = I.e[k2];
  const w = polyA;
  for (let c = 0; c < 4; c++) {
    const s1 = c === 0 || c === 3 ? 1 : -1, s2 = c < 2 ? 1 : -1;
    w[c * 3] = icx + s1 * u1[0] * e1 + s2 * u2[0] * e2;
    w[c * 3 + 1] = icy + s1 * u1[1] * e1 + s2 * u2[1] * e2;
    w[c * 3 + 2] = icz + s1 * u1[2] * e1 + s2 * u2[2] * e2;
  }
  let src = polyA, dst = polyB, cnt = 4;
  const ka = (k + 1) % 3, kb = (k + 2) % 3;
  for (let q = 0; q < 2 && cnt; q++) {
    const kk = q === 0 ? ka : kb;
    const n = R.ax[kk];
    const off = n[0] * R.p[0] + n[1] * R.p[1] + n[2] * R.p[2];
    cnt = clipPlane(src, cnt, dst, n[0], n[1], n[2], off + R.e[kk]);
    let tmp = src; src = dst; dst = tmp;
    if (!cnt) return false;
    cnt = clipPlane(src, cnt, dst, -n[0], -n[1], -n[2], -off + R.e[kk]);
    tmp = src; src = dst; dst = tmp;
    if (!cnt) return false;
  }
  const planeD = nrx * R.p[0] + nry * R.p[1] + nrz * R.p[2] + R.e[k];
  let kc = 0;
  for (let i = 0; i < cnt; i++) {
    const px = src[i * 3], py = src[i * 3 + 1], pz = src[i * 3 + 2];
    const sp = nrx * px + nry * py + nrz * pz - planeD;
    if (sp <= MARGIN) {
      cand.p[kc * 3] = px - nrx * sp * 0.5; cand.p[kc * 3 + 1] = py - nry * sp * 0.5; cand.p[kc * 3 + 2] = pz - nrz * sp * 0.5;
      cand.d[kc] = -sp;
      kc++;
    }
  }
  if (!kc) return false;
  if (refIsA) { MF.n[0] = nrx; MF.n[1] = nry; MF.n[2] = nrz; } else { MF.n[0] = -nrx; MF.n[1] = -nry; MF.n[2] = -nrz; }
  if (kc > 4) reduceTo4(kc);
  else {
    MF.cnt = kc;
    for (let i = 0; i < kc; i++) { MF.p[i * 3] = cand.p[i * 3]; MF.p[i * 3 + 1] = cand.p[i * 3 + 1]; MF.p[i * 3 + 2] = cand.p[i * 3 + 2]; MF.depth[i] = cand.d[i]; }
  }
  return true;
}

// Convenience wrapper for tests: { n, pts:[{p, depth}] } or null.
export function boxBox(A, B) {
  if (!satBoxBox(A, B)) return null;
  const pts = [];
  for (let i = 0; i < MF.cnt; i++) pts.push({ p: [MF.p[i * 3], MF.p[i * 3 + 1], MF.p[i * 3 + 2]], depth: MF.depth[i] });
  return { n: [MF.n[0], MF.n[1], MF.n[2]], pts };
}

// ---------------------------------------------------------------- world
export class World {
  constructor({ gravity = [0, -30, 0] } = {}) {
    this.gravity = gravity;
    this.bodies = [];
    this.asleep = false;
    this.quiet = 0;
    this.slop = 0.004;
    this.linDamp = 0.02;
    this.angDamp = 0.08;
    this.onImpact = null;
    this.time = 0;
    this.sleepEnabled = true;
    this.preStep = null;
    this.substeps = 4;
    this.contactHertz = 40;
    this.contactDamping = 10;
    this.pushMax = 3;
    this._cap = 0;
    this._ccap = 0;
    this.nc = 0;
    this.pc = 0; // previous contacts (warm start)
    this.pairMap = new Map();
    this.prevPairMap = new Map();
    this.layout(64);
    this.ensureContacts(512);
  }
  get contacts() {
    return { length: this.nc };
  }
  // velocities of all bodies live in one typed array: body.v / body.w are views into it
  layout(cap) {
    const oldBodies = this.bodies.map((b) => [b.v.slice ? Array.from(b.v) : [0, 0, 0], Array.from(b.w)]);
    this.V = new Float64Array(cap * 6);
    this._cap = cap;
    this.DP = new Float64Array(cap * 3);
    this.DR = new Float64Array(cap * 9);
    this.QD = new Float64Array(cap * 4);
    this.bodies.forEach((b, i) => {
      b.v = this.V.subarray(i * 6, i * 6 + 3);
      b.w = this.V.subarray(i * 6 + 3, i * 6 + 6);
      b.v.set(oldBodies[i][0]);
      b.w.set(oldBodies[i][1]);
    });
  }
  reindex() {
    this.layout(Math.max(this._cap, this.bodies.length * 2));
    this.pairMap.clear();
    this.prevPairMap.clear();
    this.pc = 0;
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
    const cap = Math.max(n, this._ccap * 2, 256);
    const grow = (Ctor, len, old) => {
      const a = new Ctor(cap * len);
      if (old) a.set(old.subarray(0, Math.min(old.length, a.length)));
      return a;
    };
    this.D = grow(Float64Array, 45, this.D);
    this.M = grow(Float64Array, 3, this.M);
    this.J = grow(Float64Array, 3, this.J);
    this.S0 = grow(Float64Array, 1, this.S0);
    this.RA = grow(Float64Array, 3, this.RA);
    this.RB = grow(Float64Array, 3, this.RB);
    this.MU = grow(Float64Array, 1, this.MU);
    this.CA = grow(Int32Array, 1, this.CA);
    this.CB = grow(Int32Array, 1, this.CB);
    this.IMA = grow(Float64Array, 1, this.IMA);
    this.IMB = grow(Float64Array, 1, this.IMB);
    this.VN0 = grow(Float64Array, 1, this.VN0);
    // warm-start memory: previous frame's local anchors (on A), impulses and pair
    this.LA = grow(Float64Array, 3, this.LA);
    this.PJ = grow(Float64Array, 3, this.PJ);
    this.PLA = grow(Float64Array, 3, this.PLA);
    this.PKEY = grow(Float64Array, 1, this.PKEY);
    this.KEY = grow(Float64Array, 1, this.KEY);
    this._ccap = cap;
  }

  step(dt) {
    if (this.asleep) return;
    this.time += dt;
    if (this.preStep) this.preStep(dt);
    const g = this.gravity;
    const bodies = this.bodies;
    const n = bodies.length;
    for (let i = 0; i < n; i++) bodies[i].idx = i;
    // ---- broadphase + narrowphase -> contact arrays
    const aabb = this._aabb || (this._aabb = new Float64Array(0));
    if (aabb.length < n * 6) this._aabb = new Float64Array(n * 12);
    const AB = this._aabb;
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      const ax = b.ax, e = b.e, o = i * 6;
      const rx = e[0] * Math.abs(ax[0][0]) + e[1] * Math.abs(ax[1][0]) + e[2] * Math.abs(ax[2][0]);
      const ry = e[0] * Math.abs(ax[0][1]) + e[1] * Math.abs(ax[1][1]) + e[2] * Math.abs(ax[2][1]);
      const rz = e[0] * Math.abs(ax[0][2]) + e[1] * Math.abs(ax[1][2]) + e[2] * Math.abs(ax[2][2]);
      AB[o] = b.p[0] - rx - MARGIN; AB[o + 1] = b.p[1] - ry - MARGIN; AB[o + 2] = b.p[2] - rz - MARGIN;
      AB[o + 3] = b.p[0] + rx + MARGIN; AB[o + 4] = b.p[1] + ry + MARGIN; AB[o + 5] = b.p[2] + rz + MARGIN;
    }
    this.ensureContacts(n * 12);
    // swap warm-start memory
    const PJ = this.PJ, PLA = this.PLA, PKEY = this.PKEY, pc = this.pc;
    const oldMap = this.pairMap;
    this.pairMap = this.prevPairMap;
    this.pairMap.clear();
    this.prevPairMap = oldMap;
    const { D, M, J, MU, CA, CB, IMA, IMB, V, S0, RA, RB, LA, KEY, VN0 } = this;
    let nc = 0;
    for (let i = 0; i < n; i++) {
      const A = bodies[i];
      const o = i * 6;
      for (let j = i + 1; j < n; j++) {
        const B = bodies[j];
        if (A.invM === 0 && B.invM === 0) continue;
        const q = j * 6;
        if (AB[o] > AB[q + 3] || AB[q] > AB[o + 3] || AB[o + 1] > AB[q + 4] || AB[q + 1] > AB[o + 4] || AB[o + 2] > AB[q + 5] || AB[q + 2] > AB[o + 5]) continue;
        if (!satBoxBox(A, B)) continue;
        if (nc + MF.cnt > this._ccap) this.ensureContacts(nc + MF.cnt + 64);
        const key = A.id * 100000 + B.id;
        const pm = oldMap.get(key);
        const mu = Math.sqrt(A.friction * B.friction);
        this.pairMap.set(key, nc);
        for (let c = 0; c < MF.cnt; c++) {
          const px = MF.p[c * 3], py = MF.p[c * 3 + 1], pz = MF.p[c * 3 + 2];
          // anchor in A's frame (for matching next frame)
          const dx = px - A.p[0], dy = py - A.p[1], dz = pz - A.p[2];
          const lx = dx * A.ax[0][0] + dy * A.ax[0][1] + dz * A.ax[0][2];
          const ly = dx * A.ax[1][0] + dy * A.ax[1][1] + dz * A.ax[1][2];
          const lz = dx * A.ax[2][0] + dy * A.ax[2][1] + dz * A.ax[2][2];
          const k3 = nc * 3;
          LA[k3] = lx; LA[k3 + 1] = ly; LA[k3 + 2] = lz;
          J[k3] = J[k3 + 1] = J[k3 + 2] = 0;
          if (pm !== undefined) {
            let bd = 0.0036;
            for (let m = pm; m < pc && PKEY[m] === key; m++) {
              const ex = PLA[m * 3] - lx, ey = PLA[m * 3 + 1] - ly, ez = PLA[m * 3 + 2] - lz;
              const dd = ex * ex + ey * ey + ez * ez;
              if (dd < bd) { bd = dd; J[k3] = PJ[m * 3]; J[k3 + 1] = PJ[m * 3 + 1]; J[k3 + 2] = PJ[m * 3 + 2]; }
            }
          }
          KEY[nc] = key;
          // rows: normal, tangent 1, tangent 2
          const nx = MF.n[0], ny = MF.n[1], nz = MF.n[2];
          let t1x, t1y, t1z;
          if (Math.abs(nx) > 0.7) { t1x = -nz; t1y = 0; t1z = nx; } else { t1x = 0; t1y = nz; t1z = -ny; }
          const tl = Math.hypot(t1x, t1y, t1z);
          t1x /= tl; t1y /= tl; t1z /= tl;
          const t2x = ny * t1z - nz * t1y, t2y = nz * t1x - nx * t1z, t2z = nx * t1y - ny * t1x;
          const rax = px - A.p[0], ray = py - A.p[1], raz = pz - A.p[2];
          const rbx = px - B.p[0], rby = py - B.p[1], rbz = pz - B.p[2];
          RA[k3] = rax; RA[k3 + 1] = ray; RA[k3 + 2] = raz;
          RB[k3] = rbx; RB[k3 + 1] = rby; RB[k3 + 2] = rbz;
          const base = nc * 45;
          for (let r = 0; r < 3; r++) {
            const dX = r === 0 ? nx : r === 1 ? t1x : t2x, dY = r === 0 ? ny : r === 1 ? t1y : t2y, dZ = r === 0 ? nz : r === 1 ? t1z : t2z;
            const o2 = base + r * 15;
            const cax = ray * dZ - raz * dY, cay = raz * dX - rax * dZ, caz = rax * dY - ray * dX;
            const cbx = rby * dZ - rbz * dY, cby = rbz * dX - rbx * dZ, cbz = rbx * dY - rby * dX;
            D[o2] = dX; D[o2 + 1] = dY; D[o2 + 2] = dZ;
            D[o2 + 3] = cax; D[o2 + 4] = cay; D[o2 + 5] = caz;
            D[o2 + 6] = cbx; D[o2 + 7] = cby; D[o2 + 8] = cbz;
            let kk = A.invM + B.invM;
            if (A.invM > 0) {
              const ia = A.invIw(cax, cay, caz);
              D[o2 + 9] = ia[0]; D[o2 + 10] = ia[1]; D[o2 + 11] = ia[2];
              kk += ia[0] * cax + ia[1] * cay + ia[2] * caz;
            } else { D[o2 + 9] = D[o2 + 10] = D[o2 + 11] = 0; }
            if (B.invM > 0) {
              const ib = B.invIw(cbx, cby, cbz);
              D[o2 + 12] = ib[0]; D[o2 + 13] = ib[1]; D[o2 + 14] = ib[2];
              kk += ib[0] * cbx + ib[1] * cby + ib[2] * cbz;
            } else { D[o2 + 12] = D[o2 + 13] = D[o2 + 14] = 0; }
            M[k3 + r] = kk > 0 ? 1 / kk : 0;
          }
          CA[nc] = i * 6;
          CB[nc] = j * 6;
          IMA[nc] = A.invM;
          IMB[nc] = B.invM;
          MU[nc] = mu;
          S0[nc] = -MF.depth[c];
          nc++;
        }
      }
    }
    this.nc = nc;
    // approach speed before solving (impact events)
    for (let k = 0; k < nc; k++) VN0[k] = rowVel(D, k * 45, V, CA[k], CB[k]);

    // ---- sub-stepped soft-constraint solver
    const sub = this.substeps;
    const h = dt / sub, invH = 1 / h;
    const hertz = Math.min(this.contactHertz, 0.25 * invH);
    const zeta = this.contactDamping;
    const omega = 2 * Math.PI * hertz;
    const a1 = 2 * zeta + h * omega, a2 = h * omega * a1, a3 = 1 / (1 + a2);
    const biasRate = omega / a1, massScale = a2 * a3, impulseScale = a3;
    const pushMax = this.pushMax, slop = this.slop;
    const DP = this.DP, DR = this.DR, QD = this.QD;
    DP.fill(0, 0, n * 3);
    for (let i = 0; i < n; i++) {
      QD[i * 4] = 0; QD[i * 4 + 1] = 0; QD[i * 4 + 2] = 0; QD[i * 4 + 3] = 1;
      const o = i * 9;
      DR[o] = 1; DR[o + 1] = 0; DR[o + 2] = 0; DR[o + 3] = 0; DR[o + 4] = 1; DR[o + 5] = 0; DR[o + 6] = 0; DR[o + 7] = 0; DR[o + 8] = 1;
    }
    const solveAll = (useBias, warm) => {
      for (let ii = 0; ii < nc; ii++) {
        const k = useBias ? ii : nc - 1 - ii;
        const a = CA[k], b = CB[k], imA = IMA[k], imB = IMB[k], base = k * 45, k3 = k * 3;
        // local copies of the two velocities
        let avx = V[a], avy = V[a + 1], avz = V[a + 2], awx = V[a + 3], awy = V[a + 4], awz = V[a + 5];
        let bvx = V[b], bvy = V[b + 1], bvz = V[b + 2], bwx = V[b + 3], bwy = V[b + 4], bwz = V[b + 5];
        if (warm) {
          // warm start: apply the accumulated impulses
          for (let r = 0; r < 3; r++) {
            const l = J[k3 + r];
            if (l === 0) continue;
            const o = base + r * 15;
            const ka = l * imA, kb = l * imB;
            avx -= D[o] * ka; avy -= D[o + 1] * ka; avz -= D[o + 2] * ka;
            awx -= D[o + 9] * l; awy -= D[o + 10] * l; awz -= D[o + 11] * l;
            bvx += D[o] * kb; bvy += D[o + 1] * kb; bvz += D[o + 2] * kb;
            bwx += D[o + 12] * l; bwy += D[o + 13] * l; bwz += D[o + 14] * l;
          }
        } else {
          // friction rows first (limited by the normal impulse of the previous pass)
          const maxF = MU[k] * J[k3];
          for (let r = 1; r < 3; r++) {
            const o = base + r * 15;
            const vr = D[o] * (bvx - avx) + D[o + 1] * (bvy - avy) + D[o + 2] * (bvz - avz) + bwx * D[o + 6] + bwy * D[o + 7] + bwz * D[o + 8] - awx * D[o + 3] - awy * D[o + 4] - awz * D[o + 5];
            let nj = J[k3 + r] - M[k3 + r] * vr;
            nj = nj > maxF ? maxF : nj < -maxF ? -maxF : nj;
            const l = nj - J[k3 + r];
            J[k3 + r] = nj;
            const ka = l * imA, kb = l * imB;
            avx -= D[o] * ka; avy -= D[o + 1] * ka; avz -= D[o + 2] * ka;
            awx -= D[o + 9] * l; awy -= D[o + 10] * l; awz -= D[o + 11] * l;
            bvx += D[o] * kb; bvy += D[o + 1] * kb; bvz += D[o + 2] * kb;
            bwx += D[o + 12] * l; bwy += D[o + 13] * l; bwz += D[o + 14] * l;
          }
          // normal row: current separation from the accumulated body displacement
          const ia = a / 6, ib = b / 6;
          const nx = D[base], ny = D[base + 1], nz = D[base + 2];
          const pa = ia * 3, pb = ib * 3, ra9 = ia * 9, rb9 = ib * 9;
          const rax = RA[k3], ray = RA[k3 + 1], raz = RA[k3 + 2], rbx = RB[k3], rby = RB[k3 + 1], rbz = RB[k3 + 2];
          const dx = DP[pb] - DP[pa] + (DR[rb9] * rbx + DR[rb9 + 1] * rby + DR[rb9 + 2] * rbz - rbx) - (DR[ra9] * rax + DR[ra9 + 1] * ray + DR[ra9 + 2] * raz - rax);
          const dy = DP[pb + 1] - DP[pa + 1] + (DR[rb9 + 3] * rbx + DR[rb9 + 4] * rby + DR[rb9 + 5] * rbz - rby) - (DR[ra9 + 3] * rax + DR[ra9 + 4] * ray + DR[ra9 + 5] * raz - ray);
          const dz = DP[pb + 2] - DP[pa + 2] + (DR[rb9 + 6] * rbx + DR[rb9 + 7] * rby + DR[rb9 + 8] * rbz - rbz) - (DR[ra9 + 6] * rax + DR[ra9 + 7] * ray + DR[ra9 + 8] * raz - raz);
          const sep = S0[k] + nx * dx + ny * dy + nz * dz;
          let bias = 0, ms = 1, is = 0;
          if (sep > 0) bias = sep * invH;
          else if (useBias) {
            bias = Math.max(biasRate * (sep + slop), -pushMax);
            if (bias > 0) bias = 0;
            ms = massScale;
            is = impulseScale;
          }
          const vn = nx * (bvx - avx) + ny * (bvy - avy) + nz * (bvz - avz) + bwx * D[base + 6] + bwy * D[base + 7] + bwz * D[base + 8] - awx * D[base + 3] - awy * D[base + 4] - awz * D[base + 5];
          let nj = J[k3] - M[k3] * ms * (vn + bias) - is * J[k3];
          if (nj < 0) nj = 0;
          const l = nj - J[k3];
          J[k3] = nj;
          const ka = l * imA, kb = l * imB;
          avx -= nx * ka; avy -= ny * ka; avz -= nz * ka;
          awx -= D[base + 9] * l; awy -= D[base + 10] * l; awz -= D[base + 11] * l;
          bvx += nx * kb; bvy += ny * kb; bvz += nz * kb;
          bwx += D[base + 12] * l; bwy += D[base + 13] * l; bwz += D[base + 14] * l;
        }
        if (imA !== 0) { V[a] = avx; V[a + 1] = avy; V[a + 2] = avz; V[a + 3] = awx; V[a + 4] = awy; V[a + 5] = awz; }
        if (imB !== 0) { V[b] = bvx; V[b + 1] = bvy; V[b + 2] = bvz; V[b + 3] = bwx; V[b + 4] = bwy; V[b + 5] = bwz; }
      }
    };
    const ld = 1 / (1 + this.linDamp * h);
    const gx = g[0] * h, gy = g[1] * h, gz = g[2] * h;
    for (let sIdx = 0; sIdx < sub; sIdx++) {
      for (let i = 0; i < n; i++) {
        const bd = bodies[i];
        if (bd.invM === 0) continue;
        const o = i * 6;
        const im = bd.invM * h;
        V[o] = (V[o] + gx + bd.f[0] * im) * ld;
        V[o + 1] = (V[o + 1] + gy + bd.f[1] * im) * ld;
        V[o + 2] = (V[o + 2] + gz + bd.f[2] * im) * ld;
        const ad = 1 / (1 + (this.angDamp + bd.angDamp) * h);
        V[o + 3] *= ad; V[o + 4] *= ad; V[o + 5] *= ad;
      }
      solveAll(true, true);
      solveAll(true, false);
      for (let i = 0; i < n; i++) {
        const bd = bodies[i];
        if (bd.invM === 0) continue;
        const o = i * 6;
        const ux = V[o + 3], uy = V[o + 4], uz = V[o + 5];
        const wl2 = ux * ux + uy * uy + uz * uz;
        if (wl2 > 900) { const sc = 30 / Math.sqrt(wl2); V[o + 3] *= sc; V[o + 4] *= sc; V[o + 5] *= sc; }
        DP[i * 3] += V[o] * h; DP[i * 3 + 1] += V[o + 1] * h; DP[i * 3 + 2] += V[o + 2] * h;
        const q = i * 4;
        const x = QD[q], y = QD[q + 1], z = QD[q + 2], w = QD[q + 3];
        const hw = 0.5 * h, vx = V[o + 3], vy = V[o + 4], vz = V[o + 5];
        let qx = x + hw * (vx * w + vy * z - vz * y), qy = y + hw * (vy * w + vz * x - vx * z), qz = z + hw * (vz * w + vx * y - vy * x), qw = w + hw * (-vx * x - vy * y - vz * z);
        const ln = 1 / Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
        qx *= ln; qy *= ln; qz *= ln; qw *= ln;
        QD[q] = qx; QD[q + 1] = qy; QD[q + 2] = qz; QD[q + 3] = qw;
        const r = i * 9;
        const xx = qx * qx, yy = qy * qy, zz = qz * qz, xy = qx * qy, xz = qx * qz, yz = qy * qz, wx = qw * qx, wy = qw * qy, wz = qw * qz;
        DR[r] = 1 - 2 * (yy + zz); DR[r + 1] = 2 * (xy - wz); DR[r + 2] = 2 * (xz + wy);
        DR[r + 3] = 2 * (xy + wz); DR[r + 4] = 1 - 2 * (xx + zz); DR[r + 5] = 2 * (yz - wx);
        DR[r + 6] = 2 * (xz - wy); DR[r + 7] = 2 * (yz + wx); DR[r + 8] = 1 - 2 * (xx + yy);
      }
      solveAll(false, false);
    }
    // ---- remember impulses for warm starting, impact events
    for (let k = 0; k < nc; k++) {
      PJ[k * 3] = J[k * 3]; PJ[k * 3 + 1] = J[k * 3 + 1]; PJ[k * 3 + 2] = J[k * 3 + 2];
      PLA[k * 3] = LA[k * 3]; PLA[k * 3 + 1] = LA[k * 3 + 1]; PLA[k * 3 + 2] = LA[k * 3 + 2];
      PKEY[k] = KEY[k];
    }
    this.pc = nc;
    if (this.onImpact) {
      for (let k = 0; k < nc; k++) {
        if (VN0[k] < -1.5 && J[k * 3] > 0) {
          const A = bodies[CA[k] / 6], B = bodies[CB[k] / 6];
          this.onImpact(-VN0[k], A, B);
        }
      }
    }
    // ---- write back the displacements
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (b.kinematic || b.invM === 0) continue;
      b.f[0] = b.f[1] = b.f[2] = 0;
      b.p[0] += DP[i * 3]; b.p[1] += DP[i * 3 + 1]; b.p[2] += DP[i * 3 + 2];
      const q = i * 4;
      const x = QD[q], y = QD[q + 1], z = QD[q + 2], w = QD[q + 3];
      const bx = b.q[0], by = b.q[1], bz = b.q[2], bw = b.q[3];
      b.setQuat([w * bx + x * bw + y * bz - z * by, w * by - x * bz + y * bw + z * bx, w * bz + x * by - y * bx + z * bw, w * bw - x * bx - y * by - z * bz]);
    }
    // ---- global sleeping
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
