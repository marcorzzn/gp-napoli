// ---------------------------------------------------------------------------
// util.js — matemática sem alocação (tudo escreve em arrays de saída)
// ---------------------------------------------------------------------------
'use strict';

const PI = Math.PI, TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// RNG determinístico
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2i(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// value noise 2D suave (quíntica)
function vnoise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const a = hash2i(xi, yi), b = hash2i(xi + 1, yi), c = hash2i(xi, yi + 1), d = hash2i(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}
function fbm2(x, y, oct) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise2(x * f + i * 17.3, y * f - i * 9.1); f *= 2.03; a *= 0.5; }
  return s;
}
function ridge2(x, y, oct) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(vnoise2(x * f + i * 7.7, y * f + i * 3.1)); s += a * n * n; f *= 2.1; a *= 0.5; }
  return s;
}

// ---------------- mat4 (coluna-maior, como WGSL) ----------------
const M4 = {
  identity(o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
  copy(o, a) { for (let i = 0; i < 16; i++) o[i] = a[i]; return o; },
  mul(o, a, b) { // o = a*b
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
      o[i * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
      o[i * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
      o[i * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    }
    return o;
  },
  invert(o, m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  },
  // perspectiva reverse-Z, far infinito, RH (olha para -Z)
  perspRevInf(o, fovy, aspect, near) {
    const f = 1 / Math.tan(fovy * 0.5);
    o.fill(0);
    o[0] = f / aspect; o[5] = f; o[11] = -1; o[14] = near;
    return o;
  },
  // ortográfica reverse-Z (depth 1 no near, 0 no far), RH
  orthoRev(o, l, r, b, t, n, f) {
    o.fill(0);
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = 1 / (f - n); o[15] = 1;
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = f / (f - n);
    return o;
  },
  lookAt(o, ex, ey, ez, tx, ty, tz, ux, uy, uz) {
    let zx = ex - tx, zy = ey - ty, zz = ez - tz;
    let l = 1 / Math.sqrt(zx * zx + zy * zy + zz * zz); zx *= l; zy *= l; zz *= l;
    let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
    l = Math.sqrt(xx * xx + xy * xy + xz * xz);
    if (l < 1e-8) { xx = 1; xy = 0; xz = 0; } else { l = 1 / l; xx *= l; xy *= l; xz *= l; }
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * ex + xy * ey + xz * ez); o[13] = -(yx * ex + yy * ey + yz * ez); o[14] = -(zx * ex + zy * ey + zz * ez); o[15] = 1;
    return o;
  },
  // matriz a partir de base (colunas X,Y,Z) + translação
  fromBasis(o, xx, xy, xz, yx, yy, yz, zx, zy, zz, tx, ty, tz) {
    o[0] = xx; o[1] = xy; o[2] = xz; o[3] = 0;
    o[4] = yx; o[5] = yy; o[6] = yz; o[7] = 0;
    o[8] = zx; o[9] = zy; o[10] = zz; o[11] = 0;
    o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
    return o;
  },
  transformPoint(o, m, x, y, z) {
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    o[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    o[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    o[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return o;
  },
};

// Planos do frustum a partir de viewProj (Gribb-Hartmann), reverse-Z: 0<=z<=w
function _setPlane(planes, i, a, b, c, d) { const l = 1 / Math.sqrt(a * a + b * b + c * c); planes[i * 4] = a * l; planes[i * 4 + 1] = b * l; planes[i * 4 + 2] = c * l; planes[i * 4 + 3] = d * l; }
function extractFrustum(planes, m) {
  // planes: Float32Array(24)  (a,b,c,d) x 6 — sem closures (zero alocação)
  const r0x = m[0], r0y = m[4], r0z = m[8], r0w = m[12];
  const r1x = m[1], r1y = m[5], r1z = m[9], r1w = m[13];
  const r2x = m[2], r2y = m[6], r2z = m[10], r2w = m[14];
  const r3x = m[3], r3y = m[7], r3z = m[11], r3w = m[15];
  _setPlane(planes, 0, r3x + r0x, r3y + r0y, r3z + r0z, r3w + r0w);
  _setPlane(planes, 1, r3x - r0x, r3y - r0y, r3z - r0z, r3w - r0w);
  _setPlane(planes, 2, r3x + r1x, r3y + r1y, r3z + r1z, r3w + r1w);
  _setPlane(planes, 3, r3x - r1x, r3y - r1y, r3z - r1z, r3w - r1w);
  _setPlane(planes, 4, r2x, r2y, r2z, r2w);
  _setPlane(planes, 5, r3x - r2x, r3y - r2y, r3z - r2z, r3w - r2w);
}
function sphereInFrustum(planes, x, y, z, r, nplanes) {
  for (let i = 0; i < nplanes; i++) {
    if (planes[i * 4] * x + planes[i * 4 + 1] * y + planes[i * 4 + 2] * z + planes[i * 4 + 3] < -r) return false;
  }
  return true;
}

// Halton para jitter TAA
function halton(i, b) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }
