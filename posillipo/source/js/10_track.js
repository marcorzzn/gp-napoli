// Circuito Storico di Posillipo (Napoli, ~5.130 m) — Epoche 1937 · 1955 · 2026.
// Convenzioni: +X = direzione partenza Viale Virgilio verso Parco Virgiliano, +Z = lato Isola di Nisida / Baia di Coroglio, +Y = quota s.l.m.
// Profilo altimetrico realistico di Posillipo (~108,5 m a Coroglio fino a ~152 m sul crinale di Via Manzoni, mare a Y = 0 m).
const TRK = {
  N: 0, L: 0, ds: 1,
  x: null, z: null, y: null, tx: null, tz: null, k: null, bank: null, slope: null,
  hw: ERA.id === '1937' ? 4.4 : ERA.id === '1955' ? 4.7 : 5.4,
  kerbL: null, kerbR: null,
  gravL: null, gravR: null,
  barL: null, barR: null,
  tyreL: null, tyreR: null,
  segs: [], corners: [], chicanes: [],
  grid: null, gridX0: 0, gridZ0: 0, gridW: 0, gridH: 0, gridCell: 40,
  pit: { s0: -140, s1: 160, wallD: 7.4, laneD0: 8.4, laneD1: 15.6, bldS0: -90, bldS1: 110, bldD0: 17.5, bldD1: 30, padD1: 48 },
  stand: { s0: -110, s1: 150, d0: -19.5, d1: -36.0 },
  startS: -16, startD: -1.6,
};
const KERB_W = ERA.id === '1937' ? 0.45 : ERA.id === '1955' ? 0.65 : 1.05;
const APRON = 2.4;
const ZONE = { ASPHALT: 0, KERB: 1, GRASS: 2, GRAVEL: 3, ROUGH: 4, PIT: 5, CONCRETE: 6 };

function trackBuild() {
  // Tracciato chiuso (~5.130 m) fedele alla topografia di Posillipo:
  // Viale Virgilio (145m) -> Parco Virgiliano (138m) -> Via Tito Lucrezio Caro / Discesa Coroglio (108.5m)
  // -> Salita Via G. Boccaccio / Via Pascoli (136m) -> Crinale Via Manzoni (152m) -> Via Petrarca / San Luigi -> Viale Virgilio.
  // Somma angoli: -90 - 90 + 70 - 110 + 40 - 90 - 45 + 45 - 90 - 32 + 32 = -360° (esatto).
  const def = [
    ['S', 670, 144.2],                                                                  // Viale Virgilio (rettilineo alberato di partenza)
    ['A', 62, -90, 138.0, 'Curva Parco Virgiliano', 'fast'],                            // Belvedere su Nisida e Golfo
    ['S', 540, 131.0],                                                                  // Viale Parco Virgiliano
    ['A', 54, -90, 124.5, 'Curva Via Tito Lucrezio Caro', 'medium'],                    // Ingresso discesa panoramica
    ['S', 410, 116.5],                                                                  // Discesa Via Tito Lucrezio Caro
    ['A', 74, 70, 111.5, 'Curva Coroglio Alta', 'medium'],                              // Piega panoramica verso Coroglio
    ['S', 420, 108.5],                                                                  // Discesa di Coroglio (punto più basso)
    ['A', 52, -110, 113.0, 'Tornante di Coroglio', 'hairpin'],                          // Tornante sui costoni di tufo
    ['S', 320, 123.5],                                                                  // Salita Via G. Boccaccio
    ['A', 78, 40, 130.5, 'Curva Villa Boccaccio', 'fast'],                              // Tra i muri in tufo giallo e le ville Liberty
    ['S', 'Lw', 138.5],                                                                 // Via Giovanni Pascoli (risolve chiusura in X)
    ['A', 56, -90, 144.5, 'Tornante di Posillipo Alto', 'hairpin'],                     // Risalita verso il crinale
    ['S', 'Ln', 150.0],                                                                 // Salita Via Manzoni (risolve chiusura in Z)
    ['A', 82, -45, 152.0, 'Crinale Via Manzoni', 'fast'],                               // Punto più alto del circuito (152 m)
    ['S', 390, 150.2],                                                                  // Rettilineo Via Manzoni
    ['A', 70, 45, 148.5, 'Curva Via Petrarca', 'medium'],                               // Immissione su Via Petrarca
    ['S', 135, 147.2],                                                                  // Via Petrarca panoramica
    ['A', 58, -90, 146.2, 'Curva Piazza San Luigi', 'hairpin'],                         // Raccordo di Piazza San Luigi
    ['S', 420, 145.6],                                                                  // Rettilineo San Luigi
    ['A', 95, -32, 145.3, 'Variante Posillipo', 'fast'],                                // S veloce di rientro
    ['A', 95, 32, 145.0, 'Ingresso Viale Virgilio', 'fast'],                            // Rientro sul rettilineo principale
  ];

  // Risoluzione lineare esatta della chiusura (Δx = 0, Δz = 0) tramite le due incognite ortogonali Lw (-X) e Ln (+Z)
  const walk = (Lw, Ln, emit) => {
    let x = 0, z = 0, th = 0, s = 0;
    for (const sg of def) {
      const s0 = s;
      if (sg[0] === 'S') {
        const L = sg[1] === 'Lw' ? Lw : sg[1] === 'Ln' ? Ln : sg[1];
        if (emit) emit(sg, s0, L, x, z, th, 0);
        x += Math.cos(th) * L; z += Math.sin(th) * L; s += L;
      } else {
        const R = sg[1], a = sg[2] * PI / 180, L = Math.abs(a) * R, sgn = Math.sign(a);
        if (emit) emit(sg, s0, L, x, z, th, sgn / R);
        const cx = x - Math.sin(th) * R * sgn, cz = z + Math.cos(th) * R * sgn;
        th += a; x = cx + Math.sin(th) * R * sgn; z = cz - Math.cos(th) * R * sgn; s += L;
      }
    }
    return [x, z, s];
  };
  const p00 = walk(0, 0), p10 = walk(1, 0), p01 = walk(0, 1);
  const a11 = p10[0] - p00[0], a12 = p01[0] - p00[0], a21 = p10[1] - p00[1], a22 = p01[1] - p00[1];
  const det = a11 * a22 - a12 * a21;
  const Lw = (-p00[0] * a22 + p00[1] * a12) / det;
  const Ln = (-a11 * p00[1] + a21 * p00[0]) / det;

  TRK.segs.length = 0; TRK.corners.length = 0; TRK.chicanes.length = 0;
  const raw = [], elevKeys = [[0, 145.0]];
  const total = walk(Lw, Ln, (sg, s0, L, x, z, th, k) => {
    const rec = { type: sg[0], s0, s1: s0 + L, k, name: sg[4] || '', kind: sg[5] || '', R: sg[0] === 'A' ? sg[1] : 0, ang: sg[0] === 'A' ? sg[2] : 0 };
    TRK.segs.push(rec);
    elevKeys.push([s0 + L, sg[0] === 'S' ? sg[2] : sg[3]]);
    const n = Math.max(1, Math.round(L / 1.0));
    for (let i = 0; i < n; i++) {
      const t = i / n * L;
      if (k === 0) raw.push([x + Math.cos(th) * t, z + Math.sin(th) * t]);
      else { const R = 1 / Math.abs(k), sgn = Math.sign(k), cx = x - Math.sin(th) * R * sgn, cz = z + Math.cos(th) * R * sgn, t2 = th + t * k; raw.push([cx + Math.sin(t2) * R * sgn, cz - Math.cos(t2) * R * sgn]); }
    }
  })[2];
  TRK.Lw = Lw; TRK.Ln = Ln;

  // Smoothing gaussiano C2 (stile Catmull-Rom metrico continuo senza scatti di curvatura)
  const M = raw.length, sm = new Array(M), SG = 7.0, KS = 22;
  for (let i = 0; i < M; i++) {
    let sx = 0, sz = 0, sw = 0;
    for (let j = -KS; j <= KS; j++) { const w = Math.exp(-0.5 * j * j / (SG * SG)), p = raw[(i + j + M * 4) % M]; sx += p[0] * w; sz += p[1] * w; sw += w; }
    sm[i] = [sx / sw, sz / sw];
  }
  const cum = new Float64Array(M + 1);
  for (let i = 0; i < M; i++) { const p = sm[i], q = sm[(i + 1) % M]; cum[i + 1] = cum[i] + Math.hypot(q[0] - p[0], q[1] - p[1]); }
  const L = cum[M], N = Math.round(L / 1.25), ds = L / N;
  TRK.N = N; TRK.L = L; TRK.ds = ds;
  const F = () => new Float32Array(N);
  const X = TRK.x = F(), Z = TRK.z = F(), Y = TRK.y = F(), TX = TRK.tx = F(), TZ = TRK.tz = F(), K = TRK.k = F(), BK = TRK.bank = F(); TRK.slope = F();
  TRK.kerbL = F(); TRK.kerbR = F(); TRK.gravL = F(); TRK.gravR = F(); TRK.barL = F(); TRK.barR = F(); TRK.tyreL = F(); TRK.tyreR = F();

  let j = 0;
  for (let i = 0; i < N; i++) {
    const t = i * ds; while (cum[j + 1] < t) j++;
    const f = (t - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]), p = sm[j], q = sm[(j + 1) % M];
    X[i] = p[0] + (q[0] - p[0]) * f; Z[i] = p[1] + (q[1] - p[1]) * f;
  }
  const scl = L / total;
  for (const sg of TRK.segs) { sg.s0 *= scl; sg.s1 *= scl; }
  for (const ek of elevKeys) ek[0] *= scl;

  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N, b = (i + 1) % N; let tx = X[b] - X[a], tz = Z[b] - Z[a]; const l = Math.hypot(tx, tz); TX[i] = tx / l; TZ[i] = tz / l;
  }
  for (let i = 0; i < N; i++) { const a = (i - 1 + N) % N, b = (i + 1) % N; K[i] = (TX[a] * TZ[b] - TZ[a] * TX[b]) / (2 * ds); }

  // Profilo altimetrico realistico di Posillipo (interpolato e smussato C2 lungo il circuito)
  const yRaw = F();
  for (let i = 0; i < N; i++) {
    const s = i * ds;
    let k = 0; while (k + 1 < elevKeys.length && elevKeys[k + 1][0] < s) k++;
    const a = elevKeys[k], b = elevKeys[Math.min(elevKeys.length - 1, k + 1)];
    const u = b[0] > a[0] ? sat((s - a[0]) / (b[0] - a[0])) : 0;
    yRaw[i] = lerp(a[1], b[1], u * u * (3 - 2 * u));
  }
  const gs = (src, dst, sg) => { const ks = Math.ceil(sg * 3); for (let i = 0; i < N; i++) { let s = 0, w = 0; for (let q = -ks; q <= ks; q++) { const g = Math.exp(-0.5 * q * q / (sg * sg)); s += src[(i + q + N * 4) % N] * g; w += g; } dst[i] = s / w; } };
  gs(yRaw, Y, 28);

  const kb = F(); gs(K, kb, 6);
  for (let i = 0; i < N; i++) {
    BK[i] = clamp(kb[i] * 0.45, -0.025, 0.025);
    TRK.slope[i] = (Y[(i + 1) % N] - Y[(i - 1 + N) % N]) / (2 * ds);
  }

  // Cordoli, protezioni e barriere per epoca
  const mark = (arr, s0, s1, val, ramp) => {
    const i0 = Math.floor(s0 / ds), i1 = Math.ceil(s1 / ds);
    for (let i = i0; i <= i1; i++) { const q = ((i % N) + N) % N; const e = ramp ? Math.min(1, (i - i0 + 1) / ramp, (i1 - i + 1) / ramp) : 1; arr[q] = Math.max(arr[q], val * (e * e * (3 - 2 * e))); }
  };
  const hw = TRK.hw;
  for (const sg of TRK.segs) if (sg.type === 'A') {
    const right = sg.k > 0, inK = right ? TRK.kerbR : TRK.kerbL, outK = right ? TRK.kerbL : TRK.kerbR;
    // 1937: zero cordoli FIA moderni, solo marciapiedi/bordi in curva; 1955: cordoli in basalto; 2026: cordoli rosso-bianco-verde
    if (ERA.id !== '1937') {
      mark(inK, sg.s0 - 4, sg.s1 + 4, 1, 0);
      if (sg.kind === 'hairpin' || sg.kind === 'medium') mark(outK, sg.s0 - 6, sg.s1 + 14, 1, 0);
    }
    if (sg.kind === 'hairpin' || sg.kind === 'medium') {
      mark(outK === TRK.kerbL ? TRK.tyreL : TRK.tyreR, sg.s0 - 12, sg.s1 + 16, 1, 0);
    }
    TRK.corners.push(sg);
  }

  // Distanza barriere: 1937/1955 più ravvicinate con balle di paglia/muri in tufo; 2026 TecPro con margine FIA
  const baseBar = ERA.id === '2026' ? hw + 3.4 : hw + 2.6;
  for (let i = 0; i < N; i++) {
    TRK.barL[i] = baseBar + (i * ds < 180 || i * ds > L - 160 ? 2.4 : 0);
    TRK.barR[i] = baseBar + (i * ds < 180 || i * ds > L - 160 ? 3.2 : 0);
  }
  const tmp = F(); gs(TRK.barL, tmp, 6); TRK.barL.set(tmp); gs(TRK.barR, tmp, 6); TRK.barR.set(tmp);

  // Griglia spaziale per trackLocate
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (let i = 0; i < N; i++) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); z0 = Math.min(z0, Z[i]); z1 = Math.max(z1, Z[i]); }
  TRK.bx0 = x0; TRK.bx1 = x1; TRK.bz0 = z0; TRK.bz1 = z1; TRK.cx = (x0 + x1) / 2; TRK.cz = (z0 + z1) / 2;
  const cell = TRK.gridCell, pad = 260; TRK.gridX0 = x0 - pad; TRK.gridZ0 = z0 - pad;
  TRK.gridW = Math.ceil((x1 - x0 + 2 * pad) / cell); TRK.gridH = Math.ceil((z1 - z0 + 2 * pad) / cell);
  TRK.grid = new Int32Array(TRK.gridW * TRK.gridH); TRK.gridDist = new Float32Array(TRK.gridW * TRK.gridH); TRK.cellList = new Array(TRK.gridW * TRK.gridH);
  const tmpL = [];
  for (let gz = 0; gz < TRK.gridH; gz++) for (let gx = 0; gx < TRK.gridW; gx++) {
    const px = TRK.gridX0 + (gx + 0.5) * cell, pz = TRK.gridZ0 + (gz + 0.5) * cell; let best = 0, bd = 1e18; tmpL.length = 0;
    for (let i = 0; i < N; i++) { const dx = X[i] - px, dz = Z[i] - pz, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = i; } if (d2 < 92 * 92) tmpL.push(i); }
    const c = gz * TRK.gridW + gx; TRK.grid[c] = best; TRK.gridDist[c] = Math.sqrt(bd); TRK.cellList[c] = tmpL.length ? Int32Array.from(tmpL) : null;
  }
}

function trackFarDist(x, z) {
  const gx = Math.floor((x - TRK.gridX0) / TRK.gridCell), gz = Math.floor((z - TRK.gridZ0) / TRK.gridCell);
  if (gx < 0 || gz < 0 || gx >= TRK.gridW || gz >= TRK.gridH) return 1e9;
  return TRK.gridDist[gz * TRK.gridW + gx] - TRK.gridCell * 0.7072;
}

const _loc = new Float64Array(4), _lq = new Float64Array(12);
function trackLocate(x, z, hint, out) { _lq[0] = x; _lq[1] = z; trackLocateQ(hint, _lq); out[0] = _lq[2]; out[1] = _lq[3]; out[2] = _lq[4]; out[3] = _lq[5]; return out; }
function trackLocateQ(hint, q) {
  const x = q[0], z = q[1];
  const N = TRK.N, X = TRK.x, Z = TRK.z; let best = 0, bd = 1e18;
  if (hint < 0) {
    const gx = Math.floor((x - TRK.gridX0) / TRK.gridCell), gz = Math.floor((z - TRK.gridZ0) / TRK.gridCell);
    const lst = (gx >= 0 && gz >= 0 && gx < TRK.gridW && gz < TRK.gridH) ? TRK.cellList[gz * TRK.gridW + gx] : null;
    if (lst) { for (let k = 0; k < lst.length; k++) { const i = lst[k], dx = X[i] - x, dz = Z[i] - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = i; } } }
    else for (let i = 0; i < N; i++) { const dx = X[i] - x, dz = Z[i] - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = i; } }
  } else {
    for (let k = -26; k <= 26; k++) { const i = (hint + k + N * 2) % N, dx = X[i] - x, dz = Z[i] - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = i; } }
  }
  const tx = TRK.tx[best], tz = TRK.tz[best]; const along = (x - X[best]) * tx + (z - Z[best]) * tz;
  let i0 = best, f = along / TRK.ds;
  if (f < 0) { i0 = (best - 1 + N) % N; f += 1; }
  f = f < 0 ? 0 : f > 1 ? 1 : f; const i1 = (i0 + 1) % N;
  const px = X[i0] + (X[i1] - X[i0]) * f, pz = Z[i0] + (Z[i1] - Z[i0]) * f;
  const ttx = TRK.tx[i0] + (TRK.tx[i1] - TRK.tx[i0]) * f, ttz = TRK.tz[i0] + (TRK.tz[i1] - TRK.tz[i0]) * f;
  q[2] = (i0 + f) * TRK.ds; q[3] = (x - px) * (-ttz) + (z - pz) * ttx; q[4] = i0; q[5] = f;
}
function trkAt(arr, i0, f) { const i1 = (i0 + 1) % TRK.N; return arr[i0] + (arr[i1] - arr[i0]) * f; }
function trackPos(s, d, out) {
  const N = TRK.N; let u = s / TRK.ds; u = ((u % N) + N) % N; const i0 = Math.floor(u), f = u - i0, i1 = (i0 + 1) % N;
  const tx = lerp(TRK.tx[i0], TRK.tx[i1], f), tz = lerp(TRK.tz[i0], TRK.tz[i1], f), l = Math.sqrt(tx * tx + tz * tz);
  const x = lerp(TRK.x[i0], TRK.x[i1], f), z = lerp(TRK.z[i0], TRK.z[i1], f);
  out[0] = x - tz / l * d; out[2] = z + tx / l * d; out[1] = trackSurfY(i0, f, d); out[3] = tx / l; out[4] = tz / l;
  return out;
}
function kerbProfile(x) {
  if (ERA.id === '1937') return 0;
  return x <= 0 || x >= KERB_W ? 0 : 0.015 + (ERA.id === '1955' ? 0.065 : 0.042) * Math.sin(Math.min(1, x / (KERB_W * 0.82)) * PI * 0.5) * (x > KERB_W * 0.82 ? (KERB_W - x) / (KERB_W * 0.18) : 1);
}
function trackSurfY(i0, f, d) {
  const y = trkAt(TRK.y, i0, f), b = trkAt(TRK.bank, i0, f), lim = TRK.hw + APRON;
  return y - clamp(d, -lim, lim) * b;
}

// ---------- Promontorio vulcanico di Posillipo, Isola di Nisida, Golfo di Pozzuoli/Campi Flegrei e Vesuvio ----------
function naturalH(x, z) {
  let h = 0.0;
  const hn = fbm(x * 0.0018 + 3.1, z * 0.0018 - 2.4, 3);
  const fine = fbm(x * 0.0065 - 1.7, z * 0.0065 + 4.2, 2);

  // 1. Promontorio di Posillipo: falesia alta ~145 m attorno al circuito che precipita nel mare verso Est/Sud (+X, +Z) e Ovest/Nord
  {
    const px = (x + 120) / 1080;
    const pz = (z + 410) / 760;
    const r = Math.hypot(px, pz);
    // Scarpata costiera netta sul lato mare (Parco Virgiliano / Coroglio)
    const prom = 1 - smooth(0.76, 1.18 + (hn - 0.5) * 0.18, r);
    // Cresta alta verso Via Manzoni / Posillipo Alto (x < -300, z > -400) e discesa naturale verso Coroglio (z < -680)
    const coroglioDip = smooth(-450, -980, z) * 44;
    const manzoniRidge = smooth(-120, -850, x) * smooth(-600, 120, z) * 16;
    const baseElev = 144 + manzoniRidge - coroglioDip + (hn - 0.5) * 28 + (fine - 0.5) * 8;
    h = Math.max(h, prom * Math.max(0, baseElev));
  }

  // 2. Continuità della collina di Posillipo verso Napoli / Vomero (a Ovest/Sud-Ovest x < -700)
  {
    const inland = smooth(-420, -1450, x) * (1 - smooth(380, 960, z)) * (1 - smooth(-1100, -1750, z));
    if (inland > 0.001) {
      const hill = (138 + 75 * hn + 32 * fine) * inland;
      h = Math.max(h, hill);
    }
  }

  // 3. Isola di Nisida (iconico cono vulcanico nel mare davanti a Parco Virgiliano e Coroglio: x = 1140, z = 440, quota ~102 m)
  {
    const nx = (x - 1140) / 265, nz = (z - 440) / 235, nr = Math.hypot(nx, nz);
    if (nr < 1.35) {
      let cone = (1 - smooth(0.45, 1.18, nr)) * (104 + 14 * fine);
      // Cratere interno di Porto Paone sul versante Sud-Ovest di Nisida
      const cr = Math.hypot((x - 1195) / 88, (z - 490) / 78);
      if (cr < 1.0) cone -= (1 - cr * cr) * 52;
      h = Math.max(h, Math.max(0, cone));
    }
    // Istmo / ponte borbonico di collegamento tra Coroglio e Isola di Nisida
    if (x > 760 && x < 1030 && z > 180 && z < 440) {
      const t = clamp((x - 780) / 230, 0, 1);
      const cz = 220 + t * 195;
      const distC = Math.abs(z - cz);
      if (distC < 16) h = Math.max(h, (1 - smooth(5, 16, distC)) * 4.5);
    }
  }

  // 4. Campi Flegrei & Capo Miseno sullo sfondo a Nord-Est / Est sul Golfo di Pozzuoli
  {
    const fx = (x - 2950) / 1450, fz = (z + 1850) / 1150, fr = Math.hypot(fx, fz);
    if (fr < 1.35) {
      const flegrei = (1 - smooth(0.35, 1.3, fr)) * (215 + 115 * hn);
      h = Math.max(h, flegrei);
    }
    // Isola di Procida & Ischia lontane sull'orizzonte marino
    const ix = (x - 3600) / 850, iz = (z - 1650) / 620, ir = Math.hypot(ix, iz);
    if (ir < 1.25) {
      const ischia = (1 - smooth(0.25, 1.2, ir)) * (380 + 95 * hn);
      h = Math.max(h, ischia);
    }
  }

  // 5. Monte Vesuvio e Penisola Sorrentina lontani sul lato Golfo di Napoli (Sud-Ovest / Sud)
  {
    const vx = x + 3100, vz = z - 2550, vr = Math.hypot(vx, vz);
    if (vr < 2400) {
      let cone = 590 * Math.pow(Math.max(0, 1 - vr / 2200), 1.65) + (hn - 0.5) * 42;
      if (vr < 220) cone -= (1 - smooth(60, 220, vr)) * 55;
      h = Math.max(h, Math.max(0, cone));
    }
  }

  return h;
}

const _th = new Float64Array(4);
function terrainH(x, z) {
  const nat = naturalH(x, z);
  const OUT = 58;
  if (trackFarDist(x, z) > OUT) return nat;
  trackLocate(x, z, -1, _th);
  const dmin = Math.abs(_th[1]);
  if (dmin > OUT) return nat;
  const gx = Math.floor((x - TRK.gridX0) / TRK.gridCell), gz = Math.floor((z - TRK.gridZ0) / TRK.gridCell), lst = TRK.cellList[gz * TRK.gridW + gx];
  const X = TRK.x, Z = TRK.z, tau = 5.0; let sw = 0, sh = 0;
  for (let q = 0; q < lst.length; q += 4) {
    const i = lst[q], ddx = x - X[i], ddz = z - Z[i]; const d = Math.sqrt(ddx * ddx + ddz * ddz); if (d > dmin + 24) continue;
    const lat = ddx * -TRK.tz[i] + ddz * TRK.tx[i], lim = TRK.hw + APRON;
    const h = TRK.y[i] - clamp(lat, -lim, lim) * TRK.bank[i] + TRK.slope[i] * (ddx * TRK.tx[i] + ddz * TRK.tz[i]);
    const w = Math.exp(-(d - dmin) / tau); sw += w; sh += w * h;
  }
  const soft = sw > 1e-6 ? sh / sw : trackSurfY(_th[2], _th[3], _th[1]), exact = trackSurfY(_th[2], _th[3], _th[1]);
  const hw = TRK.hw;
  let h = lerp(exact, soft, smooth(hw + 1.8, hw + 7.5, dmin));
  const w = smooth(hw + 7.0, OUT * 0.85, dmin);
  h = lerp(h, nat, w * w * (3 - 2 * w) * 0.999);
  h -= 0.28 * (1 - smooth(hw + 0.15, hw + 2.0, dmin));
  return h;
}

// Passo 6 m sul campo di altezze: avvio <150 ms e ~400 KB di RAM sul circuito da 5,13 km (target PC 2014)
const HF = { x0: 0, z0: 0, w: 0, h: 0, step: 6, d: null };
function heightFieldBuild() {
  const pad = 180, st = HF.step;
  HF.x0 = Math.floor((TRK.bx0 - pad) / st) * st;
  HF.z0 = Math.floor((TRK.bz0 - pad) / st) * st;
  HF.w = Math.ceil((TRK.bx1 + pad - HF.x0) / st) + 1;
  HF.h = Math.ceil((TRK.bz1 + pad - HF.z0) / st) + 1;
  HF.d = new Float32Array(HF.w * HF.h);
  for (let j = 0; j < HF.h; j++) for (let i = 0; i < HF.w; i++) HF.d[j * HF.w + i] = terrainH(HF.x0 + i * st, HF.z0 + j * st);
}
function hfAt(x, z) {
  const fx = (x - HF.x0) / HF.step, fz = (z - HF.z0) / HF.step;
  if (fx < 0 || fz < 0 || fx >= HF.w - 1 || fz >= HF.h - 1) return terrainH(x, z);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * HF.w + i, d = HF.d;
  return (d[k] * (1 - u) + d[k + 1] * u) * (1 - v) + (d[k + HF.w] * (1 - u) + d[k + HF.w + 1] * u) * v;
}
function hfAtQ(q) {
  const fx = (q[0] - HF.x0) / HF.step, fz = (q[1] - HF.z0) / HF.step;
  if (fx < 0 || fz < 0 || fx >= HF.w - 1 || fz >= HF.h - 1) { q[6] = terrainH(q[0], q[1]); return; }
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * HF.w + i, d = HF.d;
  q[6] = (d[k] * (1 - u) + d[k + 1] * u) * (1 - v) + (d[k + HF.w] * (1 - u) + d[k + HF.w + 1] * u) * v;
}

const _zq = new Float64Array(12);
function zoneAt(i0, f, d) { _zq[3] = d; _zq[4] = i0; _zq[5] = f; return zoneAtQ(_zq); }
function zoneAtQ(q) {
  const d = q[3], i0 = q[4] | 0, f = q[5], N = TRK.N, i1 = (i0 + 1) % N;
  const hw = TRK.hw, ad = d < 0 ? -d : d;
  if (ad <= hw) return ZONE.ASPHALT;
  const left = d < 0, ka = left ? TRK.kerbL : TRK.kerbR;
  if (ad <= hw + KERB_W && ka[i0] + (ka[i1] - ka[i0]) * f > 0.5) return ZONE.KERB;
  if (ad <= hw + 5.2) return ZONE.CONCRETE;
  return ZONE.GRASS;
}

// Vegetazione mediterranea di Posillipo (pini marittimi, lecci, macchia mediterranea — ZERO alberi in mare, in pista o sulle falesie ripide)
function forestAt(x, z) {
  const h = naturalH(x, z);
  if (h < 18) return 0; // mai alberi sul mare, sulle scogliere basse o sull'istmo di Nisida
  // Escludi la fascia della pista e dei box/tribune
  if (trackFarDist(x, z) < 28) {
    trackLocate(x, z, -1, _loc);
    if (Math.abs(_loc[1]) < TRK.hw + 9.5) return 0;
  }
  // Radura area paddock / tribune su Viale Virgilio
  if (x > -150 && x < 180 && z > -45 && z < 45) return 0;
  // Escludi i pendii troppo ripidi (falesie in tufo giallo)
  const gx = naturalH(x + 8, z) - naturalH(x - 8, z), gz = naturalH(x, z + 8) - naturalH(x, z - 8);
  if (Math.hypot(gx, gz) > 10.5) return 0;
  if (typeof WORLD !== 'undefined' && WORLD.tvCams) {
    for (let i = 0; i < WORLD.tvCams.length; i++) {
      const c = WORLD.tvCams[i], dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < 18 * 18) return 0;
    }
  }
  const n = fbm(x * 0.0075 + 4.1, z * 0.0075 - 2.9, 3);
  const park = smooth(18, 55, h) * smooth(0.28, 0.62, n);
  return clamp(park * 0.85, 0, 1);
}
