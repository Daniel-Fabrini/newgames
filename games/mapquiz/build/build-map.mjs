// Build-time generator for ../map-data.js (run: npm install && npm run build).
//
// Source: world-atlas countries-50m.json (Natural Earth 1:50m, public domain).
// Steps: decode TopoJSON arcs -> project (Patterson cylindrical, cut at 169°W so
// Chukotka stays with Russia and Fiji/Tonga/Samoa stay together) -> simplify
// every shared arc once (Douglas-Peucker, so neighbouring borders stay
// identical) -> rebuild polygons -> split / merge features into the codes of
// js/data/countries.js -> unwrap each country's polygons next to its centre
// (the runtime map wraps horizontally) -> drop tiny islands -> quantize to
// integers -> write compact SVG path strings at two levels of detail.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as topojson from 'topojson-client';
import polylabel from 'polylabel';
import { COUNTRIES } from '../../../js/data/countries.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const topo = JSON.parse(fs.readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'));

// ---------------------------------------------------------------- projection
const W = 2000; // map width in "units"
const Q = 10; // stored coordinates are integers in 1/Q units
const CUT = -169; // longitude of the left/right edge
const LAT_TOP = 84;
const LAT_BOTTOM = -58;
const rad = Math.PI / 180;
// Patterson cylindrical (Tom Patterson, 2014), y in radians-equivalent.
function pattersonY(phi) {
  const p2 = phi * phi;
  return phi * (1.0148 + p2 * p2 * (0.23185 + p2 * (-0.14499 + 0.02406 * p2)));
}
const K = W / (2 * Math.PI);
const Y0 = pattersonY(LAT_TOP * rad);
const H = Math.round((Y0 - pattersonY(LAT_BOTTOM * rad)) * K);
const projX = (lng) => ((lng - CUT) / 360) * W;
const projY = (lat) => (Y0 - pattersonY(Math.max(-89, Math.min(89, lat)) * rad)) * K;
const normX = (x) => ((x % W) + W) % W;

// ---------------------------------------------------------------- arcs
function decodeArcs(t) {
  const [sx, sy] = t.transform.scale;
  const [tx, ty] = t.transform.translate;
  return t.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty];
    });
  });
}

function segDist2(p, a, b) {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function dp(points, tol) {
  const n = points.length;
  if (n <= 2) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const tol2 = tol * tol;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segDist2(points[i], points[a], points[b]);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (idx > 0 && max > tol2) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function simplifyArc(points, tol) {
  const n = points.length;
  const closed = n > 3 && points[0][0] === points[n - 1][0] && points[0][1] === points[n - 1][1];
  if (!closed) return dp(points, tol);
  // closed ring arc: split at the point farthest from the start
  let far = 1;
  let max = -1;
  for (let i = 1; i < n - 1; i++) {
    const d = (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2;
    if (d > max) {
      max = d;
      far = i;
    }
  }
  const a = dp(points.slice(0, far + 1), tol);
  const b = dp(points.slice(far), tol);
  return a.concat(b.slice(1));
}

const lonlatArcs = decodeArcs(topo);
const projectedArcs = lonlatArcs.map((arc) => arc.map(([lng, lat]) => [projX(lng), projY(lat)]));

function featuresAt(tol) {
  const t = { type: 'Topology', objects: topo.objects, arcs: projectedArcs.map((a) => simplifyArc(a, tol)) };
  return topojson.feature(t, topo.objects.countries).features;
}

// ---------------------------------------------------------------- geometry helpers
function ringArea(r) {
  let s = 0;
  for (let i = 0, n = r.length, j = n - 1; i < n; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return s / 2;
}
function ringCentroid(r) {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0, n = r.length, j = n - 1; i < n; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    x += (r[j][0] + r[i][0]) * f;
    y += (r[j][1] + r[i][1]) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-9) return [r[0][0], r[0][1]];
  return [x / (3 * a), y / (3 * a)];
}
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const shiftPoly = (poly, dx) => (dx ? poly.map((r) => r.map(([x, y]) => [x + dx, y])) : poly);

// ---------------------------------------------------------------- feature -> codes
const byNum = new Map(COUNTRIES.filter((c) => c.num).map((c) => [c.num, c]));
const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));
// Overseas parts that Natural Earth stores inside another country's geometry.
const SPLIT = {
  250: ['FR', 'GF', 'GP', 'MQ', 'RE', 'YT'],
  528: ['NL', 'BQ'],
  554: ['NZ', 'TK'],
};
// Features without an ISO id.
const BY_NAME = {
  Kosovo: ['XK'],
  Somaliland: ['SO'],
  'N. Cyprus': ['CY'],
  'Indian Ocean Ter.': ['CX', 'CC'],
};
const DROP = new Set(['010']); // Antarctica
const EXCLUDE = new Set(['GB-ENG', 'GB-SCT', 'GB-WLS', 'GB-NIR']); // only drawn as part of GB

function refX(c) {
  return normX(projX(c.lng));
}
function nearestCode(codes, cx, cy) {
  let best = codes[0];
  let bd = Infinity;
  for (const code of codes) {
    const c = byCode.get(code);
    let dx = Math.abs(normX(cx) - refX(c));
    dx = Math.min(dx, W - dx);
    const d = dx * dx + (cy - projY(c.lat)) ** 2;
    if (d < bd) {
      bd = d;
      best = code;
    }
  }
  return best;
}

function collect(features) {
  const out = new Map(); // code -> polygons
  const other = [];
  for (const f of features) {
    if (DROP.has(f.id)) continue;
    let codes = null;
    if (f.id && SPLIT[f.id]) codes = SPLIT[f.id];
    else if (f.id && byNum.has(f.id)) codes = [byNum.get(f.id).code];
    else if (BY_NAME[f.properties.name]) codes = BY_NAME[f.properties.name];
    for (const poly of polysOf(f.geometry)) {
      const [cx, cy] = ringCentroid(poly[0]);
      if (!codes) {
        other.push(poly);
        continue;
      }
      const code = nearestCode(codes, cx, cy);
      const c = byCode.get(code);
      // unwrap next to the country's reference point
      const r = refX(c);
      let best = 0;
      for (const k of [-1, 1]) if (Math.abs(cx + k * W - r) < Math.abs(cx + best * W - r)) best = k;
      if (!out.has(code)) out.set(code, []);
      out.get(code).push(shiftPoly(poly, best * W));
    }
  }
  return { out, other };
}

// ---------------------------------------------------------------- encoding
function encodePolys(polys, minArea) {
  let s = '';
  let pts = 0;
  // the largest polygon of a country is always kept
  const areas = polys.map((p) => Math.abs(ringArea(p[0])));
  const maxA = Math.max(...areas);
  polys.forEach((poly, pi) => {
    if (areas[pi] < minArea && areas[pi] < maxA) return;
    poly.forEach((ring, ri) => {
      if (ri > 0 && Math.abs(ringArea(ring)) < minArea) return; // tiny holes
      const q = [];
      for (const [x, y] of ring) {
        const p = [Math.round(x * Q), Math.round(y * Q)];
        const last = q[q.length - 1];
        if (!last || last[0] !== p[0] || last[1] !== p[1]) q.push(p);
      }
      if (q.length > 1 && q[0][0] === q[q.length - 1][0] && q[0][1] === q[q.length - 1][1]) q.pop();
      if (q.length < 3) return;
      s += 'M' + q[0][0] + ' ' + q[0][1];
      let nums = [];
      for (let i = 1; i < q.length; i++) nums.push(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
      s += 'l' + nums.map((n, i) => (i === 0 || n < 0 ? String(n) : ' ' + n)).join('') + 'z';
      pts += q.length;
    });
  });
  return { d: s, pts };
}

function bboxOf(polys) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of polys)
    for (const [x, y] of p[0]) {
      if (x < b[0]) b[0] = x;
      if (y < b[1]) b[1] = y;
      if (x > b[2]) b[2] = x;
      if (y > b[3]) b[3] = y;
    }
  return b;
}

// ---------------------------------------------------------------- build
const HI_TOL = Number(process.env.HI_TOL || 0.09);
const LO_TOL = Number(process.env.LO_TOL || 0.7);
const HI_MIN = Number(process.env.HI_MIN || 0.012); // units² (≈5 km²)
const LO_MIN = Number(process.env.LO_MIN || 0.6);

const hi = collect(featuresAt(HI_TOL));
const lo = collect(featuresAt(LO_TOL));
// detailed (unsimplified) geometry for label points / areas
const full = collect(featuresAt(0));

const shapes = {};
let ptsHi = 0;
let ptsLo = 0;
for (const c of COUNTRIES) {
  if (EXCLUDE.has(c.code)) continue;
  const polys = full.out.get(c.code);
  if (!polys) {
    // marker only (no geometry at 1:50m): Gibraltar, Tuvalu…
    const kmPerUnit = (40075 * Math.cos(c.lat * rad)) / W;
    shapes[c.code] = {
      p: [Math.round(refX(c) * Q), Math.round(projY(c.lat) * Q)],
      s: Math.round((Math.sqrt(c.area) / kmPerUnit) * Q),
    };
    continue;
  }
  const areas = polys.map((p) => Math.abs(ringArea(p[0])));
  const total = areas.reduce((a, b) => a + b, 0);
  const iMax = areas.indexOf(Math.max(...areas));
  // label point: pole of inaccessibility of the largest polygon; for scattered
  // archipelagos (largest island < 35% of the land) use the area centroid.
  let p;
  if (areas[iMax] / total >= 0.35) p = polylabel(polys[iMax], 0.3);
  else {
    let x = 0;
    let y = 0;
    polys.forEach((poly, i) => {
      const [cx, cy] = ringCentroid(poly[0]);
      x += cx * areas[i];
      y += cy * areas[i];
    });
    p = [x / total, y / total];
  }
  const h = encodePolys(hi.out.get(c.code), HI_MIN);
  const l = encodePolys(lo.out.get(c.code), LO_MIN);
  ptsHi += h.pts;
  ptsLo += l.pts;
  const b = bboxOf(polys);
  shapes[c.code] = {
    d: h.d,
    l: l.d,
    p: [Math.round(p[0] * Q), Math.round(p[1] * Q)],
    b: b.map((v) => Math.round(v * Q)),
    s: Math.round(Math.sqrt(total) * Q),
  };
}
const otherHi = encodePolys(hi.other, HI_MIN);
const otherLo = encodePolys(lo.other, LO_MIN);

// Camera boxes per continent (lng0, lat0, lng1, lat1); lng1 may exceed 180.
const VIEWS = {
  world: [CUT, LAT_BOTTOM, CUT + 360, LAT_TOP],
  eu: [-24, 34, 42, 71],
  as: [26, -10, 146, 54],
  af: [-18, -35, 52, 37],
  na: [-168, 7, -52, 72],
  sa: [-82, -55, -34, 13],
  oc: [112, -47, 232, 20],
};
const views = {};
for (const [k, [a, b, c, d]] of Object.entries(VIEWS)) {
  const x0 = k === 'world' ? 0 : normX(projX(a));
  const x1 = k === 'world' ? W : x0 + ((c - a) / 360) * W;
  views[k] = [x0, projY(d), x1, projY(b)].map((v) => Math.round(v * Q));
}

// graticule latitudes (every 30°) for the runtime background
const grat = [-30, 0, 30, 60].map((lat) => Math.round(projY(lat) * Q));

const header = `// GENERATED by build/build-map.mjs — do not edit by hand.
// Geometry: Natural Earth 1:50m via world-atlas (public domain), Patterson
// cylindrical projection, map edge at ${-CUT}°W, Antarctica dropped.
// All coordinates are integers in 1/${Q} map units; the map is ${W}×${H} units
// (${W * Q}×${H * Q} stored) and wraps horizontally.
//   SHAPES[code] = { d: detailed path, l: low-detail path, p: label point,
//                    b: bbox [x0,y0,x1,y1], s: size (√area) }   (no d/l/b = marker only)
`;
const js =
  header +
  `export const MAP_W = ${W * Q};\nexport const MAP_H = ${H * Q};\n` +
  `export const VIEWS = ${JSON.stringify(views)};\n` +
  `export const GRATICULE = ${JSON.stringify(grat)};\n` +
  `export const OTHER = ${JSON.stringify({ d: otherHi.d, l: otherLo.d })};\n` +
  `export const SHAPES = {\n` +
  Object.entries(shapes)
    .map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`)
    .join(',\n') +
  `\n};\n`;
const outFile = path.join(here, '..', 'map-data.js');
fs.writeFileSync(outFile, js);
console.log(
  `map ${W}x${H} units · ${Object.keys(shapes).length} shapes · points hi ${ptsHi} lo ${ptsLo} · ` +
    `${(js.length / 1024).toFixed(0)} KB -> ${path.relative(process.cwd(), outFile)}`,
);
const missing = Object.entries(shapes)
  .filter(([, v]) => !v.d)
  .map(([k]) => k);
console.log('marker-only:', missing.join(' '));
