// Circuito Lungomare di Napoli ("Napoli Racing Show Arena" — Via Caracciolo & Rotonda Diaz, ~1.275 m).
// Convenzioni: X = Est (verso Castel dell'Ovo e Vesuvio), Z = Sud (Golfo di Napoli / Rotonda Diaz), Y = Alto.
// Senso di marcia ANTIORARIO (Anti-Clockwise): rettilineo lungomare verso Est (+X), Rotonda Diaz verso Sud (+Z),
// tornante Est (Castel dell'Ovo), rettilineo Villa Comunale / Tribuna Principale verso Ovest (-X), tornante Ovest (Mergellina).
const TRK = {
  N: 0, L: 0, ds: 1,
  x: null, z: null, y: null, tx: null, tz: null, k: null, bank: null, slope: null,
  hw: 4.6,                    // semilarghezza carreggiata cittadina (9,2 m totali)
  kerbL: null, kerbR: null,   // 0..1 cordoli rosso-bianchi in curva e chicane
  gravL: null, gravR: null,   // nessuna via di fuga in ghiaia su circuito cittadino
  barL: null, barR: null,     // distanza asse -> barriera (New Jersey / rotoballe / barriere rosso-bianche)
  tyreL: null, tyreR: null,   // 0/1 barriere morbide rosso-bianche / tricolore
  segs: [], corners: [], chicanes: [],
  grid: null, gridX0: 0, gridZ0: 0, gridW: 0, gridH: 0, gridCell: 24,
  // coordinate relative al rettilineo partenza (X = s, Z = d; Z negativo = Nord/Villa Comunale, Z positivo = Sud/Mare)
  pit: { s0: -110, s1: 95, wallD: 6.4, laneD0: 7.4, laneD1: 14.0, bldS0: -70, bldS1: 50, bldD0: 16.0, bldD1: 28, padD1: 42 },
  stand: { s0: -75, s1: 85, d0: -38.5, d1: -56.0 },
  startS: -14, startD: -1.4,
};
const KERB_W = 0.85, APRON = 2.0;
const ZONE = { ASPHALT: 0, KERB: 1, GRASS: 2, GRAVEL: 3, ROUGH: 4, PIT: 5, CONCRETE: 6 };

function trackBuild() {
  // Segmenti: ['S', lunghezza, quotaY] o ['A', raggio, angolo° (+ destra / Sud, - sinistra / Nord), quotaY, nome, tipo]
  // Tutte le chicane [a, -2a, a] sono simmetriche con ΔZ = 0 e Δth = 0; anche Rotonda Diaz [+82°, -164°, +82°] ha ΔZ = 0.
  const Y0 = 2.4;
  const def = [
    ['S', 34, Y0],
    // Rotonda Diaz — anello semicircolare sul mare (Sud, +Z)
    ['A', 12, 82, Y0, 'Ingresso Rotonda Diaz', 'rotonda'],
    ['A', 22, -164, Y0, 'Rotonda Diaz', 'rotonda'],
    ['A', 12, 82, Y0, 'Uscita Rotonda Diaz', 'rotonda'],
    // Rettilineo Lungomare Est verso Castel dell'Ovo e Vesuvio (Chicane 1 e 2)
    ['S', 66, Y0],
    ['A', 22, 20, Y0, 'Chicane 1', 'chicane'], ['A', 22, -40, Y0, 'Chicane 1', 'chicane'], ['A', 22, 20, Y0, 'Chicane 1', 'chicane'],
    ['S', 72, Y0],
    ['A', 22, -20, Y0, 'Chicane 2', 'chicane'], ['A', 22, 40, Y0, 'Chicane 2', 'chicane'], ['A', 22, -20, Y0, 'Chicane 2', 'chicane'],
    ['S', 54, Y0],
    // Tornante Est (Piazza Vittoria / vista Castel dell'Ovo) — 180° a sinistra (antiorario)
    ['A', 15.0, -180, Y0, 'Tornante Castel dell\'Ovo', 'hairpin'],
    // Rettilineo interno Villa Comunale & Tribuna Principale verso Ovest (Chicane 3, 4, 5)
    ['S', 124, Y0],
    ['A', 22, 20, Y0, 'Chicane 3', 'chicane'], ['A', 22, -40, Y0, 'Chicane 3', 'chicane'], ['A', 22, 20, Y0, 'Chicane 3', 'chicane'],
    ['S', 102, Y0],
    ['A', 22, -20, Y0, 'Chicane 4', 'chicane'], ['A', 22, 40, Y0, 'Chicane 4', 'chicane'], ['A', 22, -20, Y0, 'Chicane 4', 'chicane'],
    ['S', 98, Y0],
    ['A', 22, 20, Y0, 'Chicane 5', 'chicane'], ['A', 22, -40, Y0, 'Chicane 5', 'chicane'], ['A', 22, 20, Y0, 'Chicane 5', 'chicane'],
    ['S', 'Lw', Y0],
    // Tornante Ovest (Mergellina) — 180° a sinistra (antiorario)
    ['A', 15.0, -180, Y0, 'Tornante Mergellina', 'hairpin'],
    // Ritorno sul Lungomare verso Start/Finish A (Chicane 6 e 7)
    ['S', 52, Y0],
    ['A', 22, 20, Y0, 'Chicane 6', 'chicane'], ['A', 22, -40, Y0, 'Chicane 6', 'chicane'], ['A', 22, 20, Y0, 'Chicane 6', 'chicane'],
    ['S', 66, Y0],
    ['A', 22, -20, Y0, 'Chicane 7', 'chicane'], ['A', 22, 40, Y0, 'Chicane 7', 'chicane'], ['A', 22, -20, Y0, 'Chicane 7', 'chicane'],
    ['S', 64, Y0],
  ];

  // Risoluzione esatta della chiusura in X (Z chiude identicamente grazie alla simmetria dei tornanti R=15 -> ΔZ = -30 + 30 = 0)
  const walk = (Lw, emit) => {
    let x = 0, z = 0, th = 0, s = 0;
    for (const sg of def) {
      const s0 = s;
      if (sg[0] === 'S') {
        const L = sg[1] === 'Lw' ? Lw : sg[1];
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
  const p0 = walk(0), p1 = walk(1);
  const Lw = (0 - p0[0]) / (p1[0] - p0[0]);

  TRK.segs.length = 0; TRK.corners.length = 0; TRK.chicanes.length = 0;
  const raw = [], elevKeys = [];
  const total = walk(Lw, (sg, s0, L, x, z, th, k) => {
    const rec = { type: sg[0], s0, s1: s0 + L, k, name: sg[4] || '', kind: sg[5] || '', R: sg[0] === 'A' ? sg[1] : 0, ang: sg[0] === 'A' ? sg[2] : 0 };
    TRK.segs.push(rec);
    elevKeys.push([s0 + L, sg[0] === 'S' ? sg[2] : sg[3]]);
    const n = Math.max(1, Math.round(L / 0.5));
    for (let i = 0; i < n; i++) {
      const t = i / n * L;
      if (k === 0) raw.push([x + Math.cos(th) * t, z + Math.sin(th) * t]);
      else { const R = 1 / Math.abs(k), sgn = Math.sign(k), cx = x - Math.sin(th) * R * sgn, cz = z + Math.cos(th) * R * sgn, t2 = th + t * k; raw.push([cx + Math.sin(t2) * R * sgn, cz - Math.cos(t2) * R * sgn]); }
    }
  })[2];
  TRK.Lw = Lw; TRK.Ln = 0;

  // Smoothing gaussiano leggero (mantiene chicane e Rotonda Diaz nitide con curvatura continua C2)
  const M = raw.length, sm = new Array(M), SG = 5.5, KS = 18;
  for (let i = 0; i < M; i++) {
    let sx = 0, sz = 0, sw = 0;
    for (let j = -KS; j <= KS; j++) { const w = Math.exp(-0.5 * j * j / (SG * SG)), p = raw[(i + j + M * 4) % M]; sx += p[0] * w; sz += p[1] * w; sw += w; }
    sm[i] = [sx / sw, sz / sw];
  }
  const cum = new Float64Array(M + 1);
  for (let i = 0; i < M; i++) { const p = sm[i], q = sm[(i + 1) % M]; cum[i + 1] = cum[i] + Math.hypot(q[0] - p[0], q[1] - p[1]); }
  const L = cum[M], N = Math.round(L), ds = L / N;
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
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N, b = (i + 1) % N; let tx = X[b] - X[a], tz = Z[b] - Z[a]; const l = Math.hypot(tx, tz); TX[i] = tx / l; TZ[i] = tz / l;
  }
  for (let i = 0; i < N; i++) { const a = (i - 1 + N) % N, b = (i + 1) % N; K[i] = (TX[a] * TZ[b] - TZ[a] * TX[b]) / (2 * ds); }

  // Lungomare pianeggiante (2,4 m s.l.m.) con leggerissima ondulazione realistica (±8 cm)
  for (let i = 0; i < N; i++) {
    Y[i] = Y0 + 0.06 * Math.sin(X[i] * 0.015) + 0.03 * Math.cos(Z[i] * 0.05);
  }
  const gs = (src, dst, sg) => { const ks = Math.ceil(sg * 3); for (let i = 0; i < N; i++) { let s = 0, w = 0; for (let q = -ks; q <= ks; q++) { const g = Math.exp(-0.5 * q * q / (sg * sg)); s += src[(i + q + N * 4) % N] * g; w += g; } dst[i] = s / w; } };
  const kb = F(); gs(K, kb, 4);
  for (let i = 0; i < N; i++) { BK[i] = clamp(kb[i] * 0.35, -0.018, 0.018); TRK.slope[i] = (Y[(i + 1) % N] - Y[(i - 1 + N) % N]) / (2 * ds); }

  // Cordoli rosso-bianchi, chicane e barriere cittadine
  const mark = (arr, s0, s1, val, ramp) => {
    const i0 = Math.floor(s0 / ds), i1 = Math.ceil(s1 / ds);
    for (let i = i0; i <= i1; i++) { const q = ((i % N) + N) % N; const e = ramp ? Math.min(1, (i - i0 + 1) / ramp, (i1 - i + 1) / ramp) : 1; arr[q] = Math.max(arr[q], val * (e * e * (3 - 2 * e))); }
  };
  const hw = TRK.hw;
  for (const sg of TRK.segs) if (sg.type === 'A') {
    const right = sg.k > 0, inK = right ? TRK.kerbR : TRK.kerbL, outK = right ? TRK.kerbL : TRK.kerbR;
    mark(inK, sg.s0 - 2, sg.s1 + 2, 1, 0);
    if (sg.kind === 'rotonda' || sg.kind === 'hairpin') {
      mark(outK, sg.s0 - 6, sg.s1 + 10, 1, 0);
      mark(TRK.tyreL, sg.s0 - 8, sg.s1 + 8, 1, 0);
      mark(TRK.tyreR, sg.s0 - 8, sg.s1 + 8, 1, 0);
    } else if (sg.kind === 'chicane') {
      mark(outK, sg.s0 - 1, sg.s1 + 1, 1, 0);
      if (Math.abs(sg.ang) >= 35) TRK.chicanes.push(sg);
    }
    TRK.corners.push(sg);
  }
  // Barriere cittadine ravvicinate (New Jersey + barriere rosso-bianche a ~2,0 m dal bordo asfalto)
  for (let i = 0; i < N; i++) {
    TRK.barL[i] = hw + 2.2;
    TRK.barR[i] = hw + 2.2;
  }
  const tmp = F(); gs(TRK.barL, tmp, 3); TRK.barL.set(tmp); gs(TRK.barR, tmp, 3); TRK.barR.set(tmp);

  // Evita sovrapposizioni tra barriere di rettilinei paralleli
  for (let side = -1; side <= 1; side += 2) {
    const bar = side < 0 ? TRK.barL : TRK.barR;
    for (let i = 0; i < N; i++) {
      let b = bar[i];
      for (; b > hw + 1.4; b -= 0.25) {
        const px = X[i] - TZ[i] * side * b, pz = Z[i] + TX[i] * side * b; let ok = true;
        for (let q = 0; q < N; q += 2) { let di = Math.abs(q - i); di = Math.min(di, N - di); if (di < 40) continue; const dx = X[q] - px, dz = Z[q] - pz; if (dx * dx + dz * dz < (hw + 1.8) * (hw + 1.8)) { ok = false; break; } }
        if (ok) break;
      }
      bar[i] = b;
    }
  }

  // Griglia spaziale per trackLocate
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (let i = 0; i < N; i++) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); z0 = Math.min(z0, Z[i]); z1 = Math.max(z1, Z[i]); }
  TRK.bx0 = x0; TRK.bx1 = x1; TRK.bz0 = z0; TRK.bz1 = z1; TRK.cx = (x0 + x1) / 2; TRK.cz = (z0 + z1) / 2;
  const cell = TRK.gridCell, pad = 240; TRK.gridX0 = x0 - pad; TRK.gridZ0 = z0 - pad;
  TRK.gridW = Math.ceil((x1 - x0 + 2 * pad) / cell); TRK.gridH = Math.ceil((z1 - z0 + 2 * pad) / cell);
  TRK.grid = new Int32Array(TRK.gridW * TRK.gridH); TRK.gridDist = new Float32Array(TRK.gridW * TRK.gridH); TRK.cellList = new Array(TRK.gridW * TRK.gridH);
  const tmpL = [];
  for (let gz = 0; gz < TRK.gridH; gz++) for (let gx = 0; gx < TRK.gridW; gx++) {
    const px = TRK.gridX0 + (gx + 0.5) * cell, pz = TRK.gridZ0 + (gz + 0.5) * cell; let best = 0, bd = 1e18; tmpL.length = 0;
    for (let i = 0; i < N; i++) { const dx = X[i] - px, dz = Z[i] - pz, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = i; } if (d2 < 110 * 110) tmpL.push(i); }
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
    for (let k = -24; k <= 24; k++) { const i = (hint + k + N * 2) % N, dx = X[i] - x, dz = Z[i] - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = i; } }
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
function kerbProfile(x) { return x <= 0 || x >= KERB_W ? 0 : 0.012 + 0.042 * Math.sin(Math.min(1, x / (KERB_W * 0.82)) * PI * 0.5) * (x > KERB_W * 0.82 ? (KERB_W - x) / (KERB_W * 0.18) : 1); }
function trackSurfY(i0, f, d) {
  const y = trkAt(TRK.y, i0, f), b = trkAt(TRK.bank, i0, f), lim = TRK.hw + APRON;
  return y - clamp(d, -lim, lim) * b;
}

// ---------- Golfo di Napoli: Lungomare, Spiaggia Mappatella, Scogliere, Megaride (Castel dell'Ovo), Vesuvio & Vomero ----------
function napoliCoastZ(x) {
  // Muro del Lungomare Caracciolo a z ≈ +10,5 m con sporgenza semicircolare di Rotonda Diaz (x ∈ [22..114])
  const rot = Math.exp(-Math.pow((x - 67.5) / 42, 2)) * 37.5;
  // La costa curva leggermente verso Nord-Est oltre Piazza Vittoria (x > 380) verso Santa Lucia / Borgo Marinari
  const eastCurve = -smooth(380, 1200, x) * 145;
  // A Ovest (Mergellina / Posillipo) la costa curva verso Sud-Ovest
  const westCurve = smooth(-350, -1400, x) * 260;
  return 10.5 + rot + eastCurve + westCurve;
}

function naturalH(x, z) {
  const cz = napoliCoastZ(x);
  let h = 0.0;

  // 1. Terraferma (Lungomare pianeggiante -> Villa Comunale -> colline di Vomero, Pizzofalcone e Posillipo)
  if (z <= cz + 18) {
    const inland = cz - z;
    // Lungomare Caracciolo e Villa Comunale (0..130 m nell'entroterra): piano a 2,4 m -> 4,5 m
    let land = 2.4 * smooth(-4.0, 2.5, inland) + 1.8 * smooth(30, 125, inland);
    // Colline del Vomero / Posillipo dietro Riviera di Chiaia
    const hillD = Math.max(0, inland - 125);
    const hn = fbm(x * 0.0022 + 2.7, z * 0.0022 - 1.9, 4);
    const ridge = 1 - Math.abs(fbm(x * 0.001 + 5.3, z * 0.001 + 1.1, 4) * 2 - 1);
    const vomero = (smooth(0, 750, hillD) * (125 + 65 * hn) + smooth(700, 2600, hillD) * (160 * ridge + 90 * hn)) * (1 - 0.55 * smooth(900, 2200, x));
    // Promontorio di Posillipo a Ovest (x < -420)
    const posillipo = smooth(-380, -1300, x) * smooth(-60, 260, inland) * (95 + 45 * hn);
    land += vomero + posillipo;
    h = Math.max(h, land);
  }

  // 2. Spiaggia della Mappatella (insenatura sabbiosa vulcanica subito a Est di Rotonda Diaz, come nelle foto!)
  if (x > 78 && x < 285 && z > 8 && z < 88) {
    const bx = smooth(78, 118, x) * (1 - smooth(215, 285, x));
    const bz = (1 - smooth(20, 74, z));
    const sand = bx * bz * (1.75 + 0.25 * fbm(x * 0.06, z * 0.06, 2));
    h = Math.max(h, sand);
  }

  // 3. Scogliere bianche frangiflutti (scogliere del Lungomare e braccio curvo di Mappatella)
  // Scogliera lungomare Ovest (x ∈ [-280..40], z ∈ [15..38])
  if (x > -310 && x < 55 && z > 10 && z < 48) {
    const wlen = smooth(-300, -250, x) * (1 - smooth(18, 46, x));
    const wr = Math.exp(-Math.pow((z - 22) / 9.5, 2));
    const rn = fbm(x * 0.14 + 1.2, z * 0.14 - 0.8, 3);
    h = Math.max(h, wlen * wr * (2.1 + 1.3 * rn));
  }
  // Scogliera frangiflutti ad arco davanti a Rotonda Diaz e spiaggia Mappatella (esattamente come in image_2f330de5.png!)
  if (x > 95 && x < 395 && z > 22 && z < 112) {
    const t = clamp((x - 120) / 230, 0, 1);
    const arcZ = 78 - 22 * Math.sin(t * PI * 0.72) + (t > 0.75 ? (t - 0.75) * 45 : 0);
    const arm = Math.exp(-Math.pow((z - arcZ) / 9.0, 2)) * smooth(105, 130, x) * (1 - smooth(335, 385, x));
    const rn = fbm(x * 0.15 + 4.1, z * 0.15 + 2.3, 3);
    h = Math.max(h, arm * (2.0 + 1.45 * rn));
  }
  // Scogliera Est lungomare verso Piazza Vittoria (x ∈ [210..420], z ∈ [10..28])
  if (x > 205 && x < 430 && z > 6 && z < 34) {
    const elen = smooth(210, 240, x) * (1 - smooth(390, 425, x));
    const er = Math.exp(-Math.pow((z - 16) / 6.5, 2));
    const rn = fbm(x * 0.16, z * 0.16, 3);
    h = Math.max(h, elen * er * (1.9 + 1.1 * rn));
  }

  // 4. Isolotto di Megaride (base di Castel dell'Ovo) a Est-Sud-Est nel Golfo (x = 760, z = 115)
  {
    const dx = (x - 760) / 58, dz = (z - 115) / 36, d2 = dx * dx + dz * dz;
    if (d2 < 2.4) {
      const islet = (1 - smooth(0.55, 1.45, Math.sqrt(d2))) * (4.6 + 0.8 * fbm(x * 0.08, z * 0.08, 2));
      h = Math.max(h, islet);
    }
    // Pontile di collegamento a Santa Lucia
    if (x > 730 && x < 775 && z > -25 && z < 115) {
      const cw = Math.exp(-Math.pow((x - 752) / 9.0, 2)) * 2.4;
      h = Math.max(h, cw);
    }
  }

  // 5. Monte Vesuvio e Monte Somma (iconico profilo bicuspide sul Golfo di Napoli a Est!)
  {
    // Cono principale del Vesuvio (x = 3450, z = -220), quota 620 m con cratere leggermente tronco
    const vx = x - 3450, vz = z + 220, vr = Math.hypot(vx, vz);
    if (vr < 2600) {
      const ang = Math.atan2(vz, vx);
      const gullies = 0.05 * Math.sin(ang * 13 + 0.7) + 0.03 * Math.cos(ang * 23);
      const vn = (fbm(x * 0.0018 + 3.3, z * 0.0018 - 2.1, 4) - 0.5) * 38;
      let cone = 640 * Math.pow(Math.max(0, 1 - vr / 2350), 1.65) * (1 + gullies) + vn * smooth(2400, 900, vr);
      // Cratere sommitale tronco
      if (vr < 240) cone -= (1 - smooth(60, 240, vr)) * 58;
      h = Math.max(h, cone);
    }
    // Monte Somma (cresta a sinistra/Nord del Vesuvio: x = 3180, z = -980), quota 495 m
    const sx = (x - 3180) * 0.9, sz = (z + 980) * 1.15, sr = Math.hypot(sx, sz);
    if (sr < 2200) {
      const sn = (fbm(x * 0.002 + 7.1, z * 0.002 + 4.4, 4) - 0.5) * 32;
      const somma = 505 * Math.pow(Math.max(0, 1 - sr / 1950), 1.72) + sn * smooth(2000, 800, sr);
      h = Math.max(h, somma);
    }
    // Penisola Sorrentina / Monti Lattari lontani sul fondo del Golfo (Sud-Est)
    if (x > 2600 && z > 1800) {
      const pen = smooth(2600, 4200, x) * smooth(1800, 3400, z);
      const pn = fbm(x * 0.0008 + 1.4, z * 0.0008 - 3.2, 4);
      h = Math.max(h, pen * (210 + 190 * pn));
    }
  }

  return h;
}

const _th = new Float64Array(4);
function terrainH(x, z) {
  const nat = naturalH(x, z);
  const OUT = 44;
  if (trackFarDist(x, z) > OUT) return nat;
  trackLocate(x, z, -1, _th);
  const dmin = Math.abs(_th[1]);
  if (dmin > OUT) return nat;
  const gx = Math.floor((x - TRK.gridX0) / TRK.gridCell), gz = Math.floor((z - TRK.gridZ0) / TRK.gridCell), lst = TRK.cellList[gz * TRK.gridW + gx];
  const X = TRK.x, Z = TRK.z, tau = 4.2; let sw = 0, sh = 0;
  for (let q = 0; q < lst.length; q += 2) {
    const i = lst[q], ddx = x - X[i], ddz = z - Z[i]; const d = Math.sqrt(ddx * ddx + ddz * ddz); if (d > dmin + 22) continue;
    const lat = ddx * -TRK.tz[i] + ddz * TRK.tx[i], lim = TRK.hw + APRON;
    const h = TRK.y[i] - clamp(lat, -lim, lim) * TRK.bank[i] + TRK.slope[i] * (ddx * TRK.tx[i] + ddz * TRK.tz[i]);
    const w = Math.exp(-(d - dmin) / tau); sw += w; sh += w * h;
  }
  const soft = sh / sw, exact = trackSurfY(_th[2], _th[3], _th[1]);
  const hw = TRK.hw;
  let h = lerp(exact, soft, smooth(hw + 1.5, hw + 6.5, dmin));
  // Transizione rapida verso la costa/spiaggia a Sud o verso il Lungomare a Nord
  const w = smooth(hw + 5.5, OUT * 0.65, dmin);
  h = lerp(h, nat, w * w * (3 - 2 * w) * 0.999);
  h -= 0.28 * (1 - smooth(hw + 0.15, hw + 1.8, dmin));
  return h;
}

const HF = { x0: 0, z0: 0, w: 0, h: 0, d: null };
function heightFieldBuild() {
  const pad = 160; HF.x0 = Math.floor(TRK.bx0 - pad); HF.z0 = Math.floor(TRK.bz0 - pad);
  HF.w = Math.ceil(TRK.bx1 + pad) - HF.x0 + 1; HF.h = Math.ceil(TRK.bz1 + pad) - HF.z0 + 1;
  HF.d = new Float32Array(HF.w * HF.h);
  for (let j = 0; j < HF.h; j++) for (let i = 0; i < HF.w; i++) HF.d[j * HF.w + i] = terrainH(HF.x0 + i, HF.z0 + j);
}
function hfAt(x, z) {
  const fx = x - HF.x0, fz = z - HF.z0;
  if (fx < 0 || fz < 0 || fx >= HF.w - 1 || fz >= HF.h - 1) return terrainH(x, z);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * HF.w + i, d = HF.d;
  return (d[k] * (1 - u) + d[k + 1] * u) * (1 - v) + (d[k + HF.w] * (1 - u) + d[k + HF.w + 1] * u) * v;
}
function hfAtQ(q) {
  const fx = q[0] - HF.x0, fz = q[1] - HF.z0;
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
  // Su circuito cittadino tutta la fascia adiacente alla pista (Lungomare / Rotonda Diaz / Event Village) è lastricata
  if (ad <= hw + 16.0) return ZONE.CONCRETE;
  return ZONE.GRASS;
}

// Densità alberi (Villa Comunale a Nord del circuito e colline del Vomero/Posillipo — ZERO alberi in mare, spiaggia o sul cratere!)
function forestAt(x, z) {
  // Mai alberi sul Lungomare, nella piazza Rotonda Diaz, sulla spiaggia o in mare!
  if (z > -42) return 0;
  // Radura per Tribuna Principale A/B ed Event Village (x ∈ [-105..105], z ∈ [-78..-40])
  if (x > -108 && x < 108 && z > -80) return 0;
  // Mai alberi sul Vesuvio oltre 220 m o sul mare a Est
  if (x > 950 && z > -250) return 0;
  const h = naturalH(x, z);
  if (h < 1.8) return 0;
  // Fascia alberata fitta di Villa Comunale (z ∈ [-135..-44], x ∈ [-380..420])
  const villa = smooth(-43, -52, z) * (1 - smooth(-132, -165, z)) * smooth(-420, -340, x) * (1 - smooth(380, 460, x));
  // Parchi e pinete mediterranee sulle colline del Vomero e Posillipo (lasciando spazio ai palazzi sul lungomare)
  const hills = smooth(-175, -240, z) * (1 - smooth(1200, 1800, x)) * smooth(0.32, 0.58, fbm(x * 0.0085 + 7.2, z * 0.0085 - 3.4, 3));
  // Radura attorno alle telecamere TV
  if (typeof WORLD !== 'undefined' && WORLD.tvCams) {
    for (let i = 0; i < WORLD.tvCams.length; i++) {
      const c = WORLD.tvCams[i], dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < 16 * 16) return 0;
    }
  }
  return clamp(Math.max(villa * 0.92, hills * 0.72), 0, 1);
}
