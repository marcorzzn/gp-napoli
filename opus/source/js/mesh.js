// ---------------------------------------------------------------------------
// mesh.js — construtor de malhas (apenas em tempo de carga)
// Vértice: pos f32x3 | nrm snorm16x4 (w = extra) | uv f32x2 | attr u8x4  = 32 B
// ---------------------------------------------------------------------------
'use strict';

const MAT = {
  TERRAIN: 1, ASPHALT: 2, KERB: 3, CONCRETE: 4, ARMCO: 5, TYRE_BARRIER: 6, PAINT_WHITE: 7,
  METAL_GALV: 8, ROOF_METAL: 9, SEAT_PLASTIC: 10, SIGN: 11, GLASS_DARK: 12, BRICK: 13, FENCE: 14, POLE: 15,
  GRANDSTAND: 16, PIT_WALL: 17, CROWD: 23, GANTRY: 18, LIGHTPANEL: 19, CANVAS: 20, WOOD: 21, RUNOFF_ASPHALT: 22,
  // carro (>= 40)
  CAR_PAINT: 40, CAR_PLASTIC: 41, CAR_CHROME: 42, CAR_TYRE: 43, CAR_HUBCAP: 44, CAR_HEADLIGHT: 45,
  CAR_TAILLIGHT: 46, CAR_INTERIOR: 47, CAR_SEAT: 48, CAR_DASH: 49, CAR_RUBBER: 50, CAR_ALU: 51,
  CAR_STRAP: 52, CAR_RACK: 53, CAR_PLATE: 54, CAR_BADGE: 55, CAR_INDICATOR: 56, CAR_GRILLE: 57,
  CAR_UNDER: 58, CAR_EXHAUST: 59, CAR_REFLECTOR: 60, CAR_WHEEL_STEEL: 61, CAR_MIRROR: 62, CAR_INNER_PAINT: 63,
  CAR_BRAKE: 64, CAR_GLASS_BLACK: 65, CAR_STEER: 66, CAR_PAINT_SOLID: 67,
  // vegetação
  BARK: 80, LEAF: 81,
};

class MB {
  constructor() { this.v = []; this.ix = []; this.xf = null; this.nxf = null; }
  get count() { return this.v.length / 13; }
  setTransform(m) {
    this.xf = m;
    if (!m) { this.nxf = null; return; }
    // matriz normal (inversa transposta 3x3)
    const inv = new Float32Array(16); M4.invert(inv, m);
    this.nxf = [inv[0], inv[1], inv[2], inv[4], inv[5], inv[6], inv[8], inv[9], inv[10]];
  }
  vert(x, y, z, nx, ny, nz, u, v, mat, a1 = 0, a2 = 0, a3 = 0, w = 0) {
    if (this.xf) {
      const m = this.xf;
      const X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], Z = m[2] * x + m[6] * y + m[10] * z + m[14];
      const n = this.nxf;
      const NX = n[0] * nx + n[1] * ny + n[2] * nz, NY = n[3] * nx + n[4] * ny + n[5] * nz, NZ = n[6] * nx + n[7] * ny + n[8] * nz;
      x = X; y = Y; z = Z; nx = NX; ny = NY; nz = NZ;
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    this.v.push(x, y, z, nx / l, ny / l, nz / l, u, v, mat, a1, a2, a3, w);
    return this.v.length / 13 - 1;
  }
  tri(a, b, c) { this.ix.push(a, b, c); }
  quad(a, b, c, d) { this.ix.push(a, b, c, a, c, d); }
  // grade paramétrica: f(u,v) -> [x,y,z]; normais por diferenças finitas
  param(nu, nv, f, mat, uvScale = [1, 1], a = [0, 0, 0], flip = false, wfn = null) {
    const base = this.count, P = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) P.push(f(i / nu, j / nv));
    const g = (i, j) => P[clamp(j, 0, nv) * (nu + 1) + clamp(i, 0, nu)];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const p = g(i, j);
      const du = sub3(g(i + 1, j), g(i - 1, j)), dv = sub3(g(i, j + 1), g(i, j - 1));
      let n = cross3(du, dv); if (flip) n = [-n[0], -n[1], -n[2]];
      if (Math.hypot(n[0], n[1], n[2]) < 1e-12) n = [0, 1, 0];
      this.vert(p[0], p[1], p[2], n[0], n[1], n[2], (i / nu) * uvScale[0], (j / nv) * uvScale[1], mat, a[0], a[1], a[2], wfn ? wfn(i / nu, j / nv) : 0);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const v0 = base + j * (nu + 1) + i, v1 = v0 + 1, v2 = v0 + nu + 1, v3 = v2 + 1;
      if (flip) this.quad(v0, v2, v3, v1); else this.quad(v0, v1, v3, v2);
    }
  }
  // caixa alinhada (centro, meias-dimensões), normais planas
  box(cx, cy, cz, hx, hy, hz, mat, a = [0, 0, 0], uvs = 1) {
    const F = [
      [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    ];
    const H = [hx, hy, hz];
    for (const [n, t, b] of F) {
      const idx = [];
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = cx + (n[0] * hx + t[0] * su * hx + b[0] * sv * hx * 0) + 0;
        const p = [0, 1, 2].map(k => [cx, cy, cz][k] + n[k] * H[k] + t[k] * su * H[k] + b[k] * sv * H[k]);
        const ut = (su * 0.5 + 0.5) * 2 * Math.abs(t[0] * hx + t[1] * hy + t[2] * hz) * uvs;
        const vt = (sv * 0.5 + 0.5) * 2 * Math.abs(b[0] * hx + b[1] * hy + b[2] * hz) * uvs;
        idx.push(this.vert(p[0], p[1], p[2], n[0], n[1], n[2], ut, vt, mat, a[0], a[1], a[2]));
      }
      this.quad(idx[0], idx[1], idx[2], idx[3]);
    }
  }
  // caixa orientada por 3 eixos (cada eixo já com meia-dimensão)
  obox(c, ax, ay, az, mat, a = [0, 0, 0]) {
    const F = [[ax, ay, az], [neg3(ax), az, ay], [ay, az, ax], [neg3(ay), ax, az], [az, ax, ay], [neg3(az), ay, ax]];
    for (const [n, t, b] of F) {
      const idx = [];
      const nn = norm3(n);
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = [0, 1, 2].map(k => c[k] + n[k] + t[k] * su + b[k] * sv);
        idx.push(this.vert(p[0], p[1], p[2], nn[0], nn[1], nn[2], su * 0.5 + 0.5, sv * 0.5 + 0.5, mat, a[0], a[1], a[2]));
      }
      // garante orientação para fora
      const e1 = sub3(this.pos(idx[1]), this.pos(idx[0])), e2 = sub3(this.pos(idx[2]), this.pos(idx[0]));
      if (dot3(cross3(e1, e2), nn) < 0) this.quad(idx[0], idx[3], idx[2], idx[1]); else this.quad(idx[0], idx[1], idx[2], idx[3]);
    }
  }
  pos(i) { return [this.v[i * 13], this.v[i * 13 + 1], this.v[i * 13 + 2]]; }
  // tubo ao longo de uma polilinha (perfil circular ou fornecido em 2D)
  sweep(path, profile, mat, opts = {}) {
    const n = path.length, m = profile.length;
    const up0 = opts.up || [0, 1, 0];
    const base = this.count;
    let vacc = 0;
    for (let i = 0; i < n; i++) {
      const p = path[i];
      const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
      const t = norm3(sub3(b, a));
      let up = typeof up0 === 'function' ? up0(i) : up0;
      let side = norm3(cross3(t, up)); if (!isFinite(side[0])) side = [1, 0, 0];
      const upn = cross3(side, t);
      const sc = opts.scale ? opts.scale(i / (n - 1)) : 1;
      if (i > 0) vacc += Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1], p[2] - path[i - 1][2]);
      for (let k = 0; k < m; k++) {
        const [px2, py2, nx2, ny2] = profile[k];
        const q = [p[0] + (side[0] * px2 + upn[0] * py2) * sc, p[1] + (side[1] * px2 + upn[1] * py2) * sc, p[2] + (side[2] * px2 + upn[2] * py2) * sc];
        const nn = [side[0] * nx2 + upn[0] * ny2, side[1] * nx2 + upn[1] * ny2, side[2] * nx2 + upn[2] * ny2];
        const a3 = opts.attr || [0, 0, 0];
        this.vert(q[0], q[1], q[2], nn[0], nn[1], nn[2], opts.uvU ? opts.uvU(k) : k / (m - 1), vacc * (opts.vScale || 1), mat, a3[0], a3[1], a3[2], opts.w ? opts.w(i / (n - 1), k) : 0);
      }
    }
    const closed = opts.closed !== false;
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < (closed ? m : m - 1); k++) {
      const k2 = (k + 1) % m;
      const v0 = base + i * m + k, v1 = base + i * m + k2, v2 = base + (i + 1) * m + k2, v3 = base + (i + 1) * m + k;
      if (opts.flip) this.quad(v0, v3, v2, v1); else this.quad(v0, v1, v2, v3);
    }
  }
  // revolução em torno do eixo X local: profile [[r, x, nr, nx], ...]; seg = nº de segmentos
  lathe(profile, seg, mat, opts = {}) {
    const base = this.count, m = profile.length;
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * TAU, c = Math.cos(a), sn = Math.sin(a);
      for (let k = 0; k < m; k++) {
        const [r, x, nr, nx] = profile[k];
        const a3 = opts.attr || [0, 0, 0];
        this.vert(x, r * c, r * sn, nx, nr * c, nr * sn, s / seg, opts.vfn ? opts.vfn(k) : k / (m - 1), mat, a3[0], a3[1], a3[2], opts.w ? opts.w(k) : 0);
      }
    }
    for (let s = 0; s < seg; s++) for (let k = 0; k < m - 1; k++) {
      const v0 = base + s * m + k, v1 = v0 + 1, v2 = v0 + m + 1, v3 = v0 + m;
      if (opts.flip) this.quad(v0, v1, v2, v3); else this.quad(v0, v3, v2, v1);
    }
  }
  cylinder(p0, p1, r0, r1, seg, mat, opts = {}) {
    const d = sub3(p1, p0), L = len3(d), t = scale3(d, 1 / L);
    let up = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const sx = norm3(cross3(up, t)), sy = cross3(t, sx);
    const base = this.count;
    const slope = (r0 - r1) / L;
    for (let e = 0; e < 2; e++) {
      const p = e ? p1 : p0, r = e ? r1 : r0;
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * TAU, c = Math.cos(a), sn = Math.sin(a);
        const n = [sx[0] * c + sy[0] * sn + t[0] * slope, sx[1] * c + sy[1] * sn + t[1] * slope, sx[2] * c + sy[2] * sn + t[2] * slope];
        const a3 = opts.attr || [0, 0, 0];
        this.vert(p[0] + (sx[0] * c + sy[0] * sn) * r, p[1] + (sx[1] * c + sy[1] * sn) * r, p[2] + (sx[2] * c + sy[2] * sn) * r, n[0], n[1], n[2], s / seg * (opts.uScale || 1), e * L * (opts.vScale || 1), mat, a3[0], a3[1], a3[2], opts.w ? opts.w(e) : 0);
      }
    }
    for (let s = 0; s < seg; s++) this.quad(base + s, base + s + 1, base + seg + 2 + s, base + seg + 1 + s);
    if (opts.caps) {
      for (let e = 0; e < 2; e++) {
        const p = e ? p1 : p0, r = e ? r1 : r0, n = e ? t : neg3(t);
        const c0 = this.vert(p[0], p[1], p[2], n[0], n[1], n[2], 0.5, 0.5, mat);
        const b2 = this.count;
        for (let s = 0; s <= seg; s++) {
          const a = (s / seg) * TAU, c = Math.cos(a), sn = Math.sin(a);
          this.vert(p[0] + (sx[0] * c + sy[0] * sn) * r, p[1] + (sx[1] * c + sy[1] * sn) * r, p[2] + (sx[2] * c + sy[2] * sn) * r, n[0], n[1], n[2], 0.5 + c * 0.5, 0.5 + sn * 0.5, mat);
        }
        for (let s = 0; s < seg; s++) { if (e) this.tri(c0, b2 + s, b2 + s + 1); else this.tri(c0, b2 + s + 1, b2 + s); }
      }
    }
  }
  append(o) { const b = this.count; for (const x of o.v) this.v.push(x); for (const i of o.ix) this.ix.push(i + b); }
  pack() {
    const n = this.count, buf = new ArrayBuffer(n * 32), f = new Float32Array(buf), s16 = new Int16Array(buf), u8 = new Uint8Array(buf);
    const v = this.v;
    for (let i = 0; i < n; i++) {
      const o = i * 13;
      f[i * 8] = v[o]; f[i * 8 + 1] = v[o + 1]; f[i * 8 + 2] = v[o + 2];
      s16[i * 16 + 6] = Math.round(clamp(v[o + 3], -1, 1) * 32767); s16[i * 16 + 7] = Math.round(clamp(v[o + 4], -1, 1) * 32767);
      s16[i * 16 + 8] = Math.round(clamp(v[o + 5], -1, 1) * 32767); s16[i * 16 + 9] = Math.round(clamp(v[o + 12], -1, 1) * 32767);
      f[i * 8 + 5] = v[o + 6]; f[i * 8 + 6] = v[o + 7];
      u8[i * 32 + 28] = v[o + 8]; u8[i * 32 + 29] = clamp(Math.round(v[o + 9]), 0, 255); u8[i * 32 + 30] = clamp(Math.round(v[o + 10]), 0, 255); u8[i * 32 + 31] = clamp(Math.round(v[o + 11]), 0, 255);
    }
    // bbox
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[i * 13 + k]); mx[k] = Math.max(mx[k], v[i * 13 + k]); }
    return { vb: buf, ib: new Uint32Array(this.ix), count: this.ix.length, nverts: n, min: mn, max: mx };
  }
}
// vetores 3D com arrays (somente carga)
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale3(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function len3(a) { return Math.hypot(a[0], a[1], a[2]); }
function norm3(a) { const l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function neg3(a) { return [-a[0], -a[1], -a[2]]; }
function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function m4Trs(tx, ty, tz, ry = 0, rx = 0, rz = 0, s = 1) {
  // rotação Y*X*Z, escala uniforme
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
  const o = new Float32Array(16);
  const Ry = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1];
  const Rx = [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1];
  const Rz = [cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const t1 = new Float32Array(16); M4.mul(t1, Ry, Rx); M4.mul(o, t1, Rz);
  for (let i = 0; i < 12; i++) o[i] *= s;
  o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
  return o;
}
