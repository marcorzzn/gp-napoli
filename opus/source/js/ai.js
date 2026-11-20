// ---------------------------------------------------------------------------
// ai.js — trajetória de curvatura mínima, perfil de velocidade e piloto que
// gera teclas digitais (usado para gravar a volta roteirizada e nos testes)
// ---------------------------------------------------------------------------
'use strict';

const AI = (() => {
  const A = {};
  const T = TRACK, N = T.N;
  // ---- trajetória (banda elástica)
  const off = new Float64Array(N);
  const lim = new Float64Array(N);
  for (let i = 0; i < N; i++) lim[i] = T.hw[i] - 1.7;
  const px = new Float64Array(N), pz = new Float64Array(N);
  for (let it = 0; it < 2500; it++) {
    for (let i = 0; i < N; i++) { px[i] = T.px[i] - T.tz[i] * off[i]; pz[i] = T.pz[i] + T.tx[i] * off[i]; }
    for (let i = 0; i < N; i++) {
      const a = (i - 6 + N) % N, b = (i + 6) % N;
      const mx = (px[a] + px[b]) * 0.5, mz = (pz[a] + pz[b]) * 0.5;
      // projeta o ponto médio na normal lateral
      const rx = -T.tz[i], rz = T.tx[i];
      const target = (mx - T.px[i]) * rx + (mz - T.pz[i]) * rz;
      off[i] += (target - off[i]) * 0.5;
      off[i] = clamp(off[i], -lim[i], lim[i]);
    }
  }
  // suaviza
  for (let it = 0; it < 20; it++) { const o2 = Float64Array.from(off); for (let i = 0; i < N; i++) off[i] = (o2[(i - 1 + N) % N] + 2 * o2[i] + o2[(i + 1) % N]) / 4; }
  for (let i = 0; i < N; i++) T.racing[i] = off[i];
  for (let i = 0; i < N; i++) { px[i] = T.px[i] - T.tz[i] * off[i]; pz[i] = T.pz[i] + T.tx[i] * off[i]; }
  // curvatura da trajetória
  const kap = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - 4 + N) % N, b = (i + 4) % N;
    const ax = px[i] - px[a], az = pz[i] - pz[a], bx = px[b] - px[i], bz = pz[b] - pz[i];
    const cr = ax * bz - az * bx, la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    kap[i] = 2 * cr / (la * lb * Math.hypot(px[b] - px[a], pz[b] - pz[a]) + 1e-9);
  }
  // ---- perfil de velocidade
  const vmax = new Float64Array(N);
  A.params = { mu: 0.9, brake: 5.6, accel: 3.4, vtop: 44 };
  A.buildProfile = () => {
    const P = A.params;
    for (let i = 0; i < N; i++) vmax[i] = Math.min(P.vtop, Math.sqrt(P.mu * 9.81 / Math.max(Math.abs(kap[i]), 1e-4)));
    for (let pass = 0; pass < 3; pass++) {
      for (let i = N - 1; i >= 0; i--) { const j = (i + 1) % N; vmax[i] = Math.min(vmax[i], Math.sqrt(vmax[j] * vmax[j] + 2 * P.brake * T.ds)); }
    }
  };
  A.buildProfile();
  A.vmax = vmax; A.kap = kap;
  // zonas de freada para o asfalto (marcas)
  T.brake = new Float32Array(N);
  for (let i = 0; i < N; i++) { const j = (i + 25) % N; T.brake[i] = clamp((vmax[(i + 1) % N] - vmax[j]) / 6, 0, 1); }

  // ---- piloto: produz teclas
  const inp = { up: false, down: false, left: false, right: false, hand: false };
  A.inp = inp;
  const tmp = new Float64Array(6);
  A.drive = (car, speedScale) => {
    const s = car.s, v = car.u;
    const i = Math.floor(s / T.ds) % N;
    // alvo de velocidade (olhando um pouco à frente)
    let vt = 1e9;
    for (let k = 0; k < 10; k++) vt = Math.min(vt, vmax[(i + k) % N]);
    vt *= speedScale;
    // ponto de mira
    const Ld = 5 + Math.abs(v) * 0.42;
    const j = (i + Math.round(Ld / T.ds)) % N;
    const dx = px[j] - car.x, dz = pz[j] - car.z;
    const c = Math.cos(car.psi), sn = Math.sin(car.psi);
    const la = dx * c + dz * sn, lb = -dx * sn + dz * c;
    const alpha = Math.atan2(lb, la);
    let delta = Math.atan(2 * 2.36 * Math.sin(alpha) / Math.hypot(dx, dz));
    // amortecimento da guinada
    delta -= car.r * 0.03;
    const lock = PHYS.maxSteer / (1 + Math.abs(v) * 0.045);
    const want = clamp(delta / lock, -1, 1);
    const db = 0.03;
    inp.left = false; inp.right = false;
    if (car.steerIn < want - db) inp.right = true;
    else if (car.steerIn > want + db) inp.left = true;
    else if (Math.abs(want) > 0.06) { if (want > 0) inp.right = car.steerIn < want; else inp.left = car.steerIn > want; }
    // acelerador/freio
    inp.up = false; inp.down = false; inp.hand = false;
    if (v < vt - 0.3) inp.up = true;
    else if (v > vt + 1.2) inp.down = true;
    return inp;
  };
  return A;
})();
