// ---------------------------------------------------------------------------
// terrain.js — altura procedural, raster da pista, máscaras e malhas
// ---------------------------------------------------------------------------
'use strict';

const TERRAIN = (() => {
  const T = {};
  const CX = -62, CZ = -98;          // centro da região interna
  const HALF = 800;                  // região interna 1600 m
  const R1 = 1600;                   // raster 1 m
  const HN = 801, HS = 2;            // grade de alturas 2 m
  T.CX = CX; T.CZ = CZ; T.HALF = HALF; T.R1 = R1; T.HN = HN; T.HS = HS;
  T.X0 = CX - HALF; T.Z0 = CZ - HALF;

  // base suave que interpola a elevação da pista (IDW sobre subamostras)
  const TR = TRACK;
  const sub = []; for (let i = 0; i < TR.N; i += 8) sub.push(TR.px[i], TR.pz[i], TR.py[i]);
  function baseIDW(x, z) {
    let ws = 0, ys = 0;
    for (let k = 0; k < sub.length; k += 3) {
      const dx = x - sub[k], dz = z - sub[k + 1];
      const w = 1 / (dx * dx + dz * dz + 400); const w2 = w * w;
      ws += w2; ys += w2 * sub[k + 2];
    }
    return ys / ws;
  }
  // altura natural (sem pista)
  function natural(x, z, base) {
    const dx = x - CX, dz = z - CZ;
    const d = Math.sqrt(dx * dx + dz * dz);
    let h = base;
    // colinas locais
    h += fbm2(x * 0.006, z * 0.006, 4) * (3 + smoothstep(150, 700, d) * 16);
    h += fbm2(x * 0.02 + 3, z * 0.02, 3) * 1.2;
    // morro grande a nordeste e cadeia ao longe
    const m1x = x - 900, m1z = z + 1400; const dm1 = Math.sqrt(m1x * m1x + m1z * m1z);
    h += 160 * Math.exp(-dm1 * dm1 / (700 * 700));
    const m2x = x + 1300, m2z = z - 600; const dm2 = Math.sqrt(m2x * m2x + m2z * m2z);
    h += 90 * Math.exp(-dm2 * dm2 / (520 * 520));
    const far = smoothstep(900, 6000, d);
    h += far * (ridge2(x * 0.00036 + 11, z * 0.00036 - 4, 5) * 700 - 100) + smoothstep(1200, 3000, d) * fbm2(x * 0.0012, z * 0.0012, 5) * 120;
    return h;
  }
  T.natural = natural;

  // ---------------- raster da pista (1 m) ----------------
  const N1 = R1 * R1;
  const rU = new Float32Array(N1).fill(1e4);   // u assinado do ponto mais próximo
  const rS = new Float32Array(N1);             // s
  const rD = new Float32Array(N1).fill(1e8);   // dist² horizontal
  const RAD = 85;
  for (let i = 0; i < TR.N; i++) {
    const ax = TR.px[i], az = TR.pz[i], j = (i + 1) % TR.N;
    const bx = TR.px[j], bz = TR.pz[j];
    const sx = bx - ax, sz = bz - az, sl2 = sx * sx + sz * sz;
    const gx0 = Math.max(0, Math.floor(ax - RAD - T.X0)), gx1 = Math.min(R1 - 1, Math.ceil(ax + RAD - T.X0));
    const gz0 = Math.max(0, Math.floor(az - RAD - T.Z0)), gz1 = Math.min(R1 - 1, Math.ceil(az + RAD - T.Z0));
    for (let gz = gz0; gz <= gz1; gz++) {
      const z = T.Z0 + gz + 0.5;
      for (let gx = gx0; gx <= gx1; gx++) {
        const x = T.X0 + gx + 0.5;
        let t = ((x - ax) * sx + (z - az) * sz) / sl2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + sx * t - x, qz = az + sz * t - z, d = qx * qx + qz * qz;
        const k = gz * R1 + gx;
        if (d < rD[k]) {
          rD[k] = d;
          // u: >0 à direita. right = (-tz, tx)
          const l = Math.sqrt(sl2);
          rU[k] = ((x - ax) * (-sz) + (z - az) * sx) / l;
          rS[k] = (i + t) * TR.ds;
        }
      }
    }
  }
  T.rU = rU; T.rS = rS; T.rD = rD;
  function rasterAt(x, z, out) {
    const gx = Math.floor(x - T.X0), gz = Math.floor(z - T.Z0);
    if (gx < 0 || gz < 0 || gx >= R1 || gz >= R1) { out[0] = 1e4; out[1] = 0; out[2] = 1e8; return out; }
    const k = gz * R1 + gx; out[0] = rU[k]; out[1] = rS[k]; out[2] = Math.sqrt(rD[k]); return out;
  }
  T.rasterAt = rasterAt;

  // ---------------- alturas (2 m) ----------------
  const H = new Float32Array(HN * HN);
  const tmp = [0, 0, 0];
  // base IDW numa grade grossa (16 m) e interpolada — barato
  const BN = 101, BS = 16, base = new Float32Array(BN * BN);
  for (let j = 0; j < BN; j++) for (let i = 0; i < BN; i++) base[j * BN + i] = baseIDW(T.X0 + i * BS, T.Z0 + j * BS);
  function baseAt(x, z) {
    let fx = (x - T.X0) / BS, fz = (z - T.Z0) / BS;
    fx = clamp(fx, 0, BN - 1.001); fz = clamp(fz, 0, BN - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    return lerp(lerp(base[j * BN + i], base[j * BN + i + 1], tx), lerp(base[(j + 1) * BN + i], base[(j + 1) * BN + i + 1], tx), tz);
  }
  T.baseAt = baseAt;
  // altura "corredor" pista: plataforma plana até a barreira, depois funde
  function corridor(x, z, hNat) {
    rasterAt(x, z, tmp);
    const u = tmp[0], s = tmp[1], d = tmp[2];
    if (d > 84) return hNat;
    const ty = TR.lerpArr(TR.py, s);
    const hw = TR.lerpArr(TR.hw, s);
    const wall = u > 0 ? TR.lerpArr(TR.wallR, s) : TR.lerpArr(TR.wallL, s);
    const au = Math.abs(u);
    let hp;
    if (au < hw + 0.32) hp = ty - 0.3;                        // sob o asfalto
    else hp = ty - 0.048 - smoothstep(hw + 1.0, hw + 3.0, au) * 0.02 - (au - hw) * 0.006;   // escape rente à borda do asfalto
    const w = 1 - smoothstep(wall + 3, wall + 38, au);
    return lerp(hNat, hp, w);
  }
  for (let j = 0; j < HN; j++) for (let i = 0; i < HN; i++) {
    const x = T.X0 + i * HS, z = T.Z0 + j * HS;
    H[j * HN + i] = corridor(x, z, natural(x, z, baseAt(x, z)));
  }
  T.H = H;
  // altura do terreno (bilinear na grade; fora dela, função natural)
  T.heightAt = (x, z) => {
    let fx = (x - T.X0) / HS, fz = (z - T.Z0) / HS;
    if (fx < 0 || fz < 0 || fx >= HN - 1 || fz >= HN - 1) return natural(x, z, baseAt(x, z));
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const k = j * HN + i;
    // triangulação igual à malha (diagonal i,j -> i+1,j+1)
    if (tx > tz) return H[k] + (H[k + 1] - H[k]) * tx + (H[k + HN + 1] - H[k + 1]) * tz;
    return H[k] + (H[k + HN + 1] - H[k + HN]) * tx + (H[k + HN] - H[k]) * tz;
  };

  // ---------------- máscaras de superfície (1 m, rgba8) ----------------
  // R: brita   G: grama alta   B: chão de mata/terra   A: densidade de floresta
  const MASK = new Uint8Array(N1 * 4);
  for (let gz = 0; gz < R1; gz++) for (let gx = 0; gx < R1; gx++) {
    const k = gz * R1 + gx;
    const x = T.X0 + gx + 0.5, z = T.Z0 + gz + 0.5;
    const u = rU[k], s = rS[k], d = Math.sqrt(rD[k]);
    let grav = 0, tall = 0, floor = 0, forest = 0;
    const near = d < 84;
    let wall = 60, hw = 6;
    if (near) {
      hw = TR.lerpArr(TR.hw, s);
      wall = u > 0 ? TR.lerpArr(TR.wallR, s) : TR.lerpArr(TR.wallL, s);
      const gw = u > 0 ? TR.lerpArr(TR.gravR, s) : TR.lerpArr(TR.gravL, s);
      const kw = u > 0 ? TR.lerpArr(TR.kerbR, s) : TR.lerpArr(TR.kerbL, s);
      const g0 = hw + kw + 1.6, g1 = g0 + gw;
      const au = Math.abs(u);
      if (gw > 1.5) grav = smoothstep(g0 - 0.4, g0 + 0.4, au) * (1 - smoothstep(g1 - 0.4, g1 + 0.4, au));
    }
    const au = Math.abs(u);
    // grama alta: além da barreira (e na faixa larga entre escape e barreira)
    const n = fbm2(x * 0.05, z * 0.05, 3);
    tall = smoothstep(wall + 0.5, wall + 4, au) * (0.55 + 0.45 * n);
    // tufos de capim alto também no miolo (manchas)
    tall = Math.max(tall, smoothstep(0.1, 0.4, fbm2(x * 0.03 + 9, z * 0.03 - 2, 3)) * smoothstep(wall + 0.5, wall + 5, au));
    if (near && au < wall) tall = Math.max(tall, smoothstep(wall - 2.5, wall - 0.6, au) * 0.5) * (1 - grav);
    // floresta: longe da pista, ruído de clareiras
    const fn = fbm2(x * 0.0045 + 7, z * 0.0045 - 3, 4) * 2.2 + 0.55;
    forest = smoothstep(wall + 7, wall + 16, au) * smoothstep(-0.1, 0.25, fn);
    // exclusões: boxes / arquibancada / estacionamento perto da reta
    if (x > -240 && x < 60 && z > -70 && z < 70) forest *= smoothstep(-70, -55, -Math.abs(z)) * 0 + (Math.abs(z) > 58 ? 1 : 0);
    // sem grama alta na pit lane / boxes / base da arquibancada
    if (x > -205 && x < 45 && z > -42 && z < -8) tall = 0;
    if (x > -160 && x < -5 && z > 9 && z < 34) tall = 0;
    // infield: mais aberto
    floor = forest * 0.9;
    tall *= 1 - forest * 0.6;
    MASK[k * 4] = Math.round(grav * 255); MASK[k * 4 + 1] = Math.round(clamp(tall, 0, 1) * 255);
    MASK[k * 4 + 2] = Math.round(floor * 255); MASK[k * 4 + 3] = Math.round(forest * 255);
  }
  T.MASK = MASK;
  T.maskAt = (x, z, ch) => {
    const gx = Math.floor(x - T.X0), gz = Math.floor(z - T.Z0);
    if (gx < 0 || gz < 0 || gx >= R1 || gz >= R1) return ch === 3 ? 255 : 0;
    return MASK[(gz * R1 + gx) * 4 + ch];
  };

  // ---------------- malha interna em blocos com LOD estático ----------------
  // retorna {pos: Float32Array (x,y,z), idx: Uint32Array}
  T.buildInnerMesh = () => {
    const CH = 32;              // bloco de 64 m (32 células de 2 m)
    const NC = (HN - 1) / CH;   // 25
    const lod = new Int32Array(NC * NC);
    for (let cj = 0; cj < NC; cj++) for (let ci = 0; ci < NC; ci++) {
      // distância mínima do bloco à pista
      let dmin = 1e9;
      for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) {
        const x = T.X0 + (ci * CH + a * CH / 4) * HS, z = T.Z0 + (cj * CH + b * CH / 4) * HS;
        let best = 1e18; for (let i = 0; i < TR.N; i += 4) { const dx = x - TR.px[i], dz = z - TR.pz[i]; const dd = dx * dx + dz * dz; if (dd < best) best = dd; }
        dmin = Math.min(dmin, Math.sqrt(best));
      }
      lod[cj * NC + ci] = dmin < 130 ? 0 : dmin < 300 ? 1 : dmin < 520 ? 2 : 3;
    }
    // restringe diferença de LOD entre vizinhos a 1
    for (let it = 0; it < 4; it++) for (let cj = 0; cj < NC; cj++) for (let ci = 0; ci < NC; ci++) {
      const k = cj * NC + ci;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= NC || nj >= NC) continue;
        if (lod[k] > lod[nj * NC + ni] + 1) lod[k] = lod[nj * NC + ni] + 1;
      }
    }
    const P = [], I = [];
    const hAt = (i, j) => H[j * HN + i];
    for (let cj = 0; cj < NC; cj++) for (let ci = 0; ci < NC; ci++) {
      const L = lod[cj * NC + ci], st = 1 << L, n = CH / st;
      const base = P.length / 3;
      const lodN = (di, dj) => { const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= NC || nj >= NC) return L; return lod[nj * NC + ni]; };
      for (let b = 0; b <= n; b++) for (let a = 0; a <= n; a++) {
        const i = ci * CH + a * st, j = cj * CH + b * st;
        let y = hAt(i, j);
        // costura com vizinho mais grosso
        const fixEdge = (Ln, along, ii0, jj0, di, dj) => {
          const stn = 1 << Ln; const r = along % stn;
          if (r === 0) return hAt(ii0, jj0);
          const i0 = ii0 - di * r, j0 = jj0 - dj * r, i1 = i0 + di * stn, j1 = j0 + dj * stn;
          return lerp(hAt(i0, j0), hAt(i1, j1), r / stn);
        };
        if (a === 0 && lodN(-1, 0) > L) y = fixEdge(lodN(-1, 0), b * st, i, j, 0, 1);
        if (a === n && lodN(1, 0) > L) y = fixEdge(lodN(1, 0), b * st, i, j, 0, 1);
        if (b === 0 && lodN(0, -1) > L) y = fixEdge(lodN(0, -1), a * st, i, j, 1, 0);
        if (b === n && lodN(0, 1) > L) y = fixEdge(lodN(0, 1), a * st, i, j, 1, 0);
        P.push(T.X0 + i * HS, y, T.Z0 + j * HS);
      }
      for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
        const v0 = base + b * (n + 1) + a, v1 = v0 + 1, v2 = v0 + n + 1, v3 = v2 + 1;
        I.push(v0, v2, v3, v0, v3, v1);
      }
    }
    return { pos: new Float32Array(P), idx: new Uint32Array(I), lod };
  };

  // ---------------- malha distante (anéis até ~18 km) ----------------
  // anel 0 coincide exatamente com a borda da malha interna (passo 8 células = 16 m)
  T.buildOuterMesh = () => {
    const P = [], I = [];
    const E = HN - 1, STEP = 4;
    const ring0 = [];
    for (let i = 0; i < E; i += STEP) ring0.push([i, 0]);
    for (let j = 0; j < E; j += STEP) ring0.push([E, j]);
    for (let i = E; i > 0; i -= STEP) ring0.push([i, E]);
    for (let j = E; j > 0; j -= STEP) ring0.push([0, j]);
    const NA = ring0.length, NR = 90;
    const rMax = 18000;
    for (let rj = 0; rj <= NR; rj++) {
      const t = rj / NR;
      const scale = Math.pow(rMax / HALF, t);           // multiplica a distância
      const circ = smoothstep(0.0, 0.45, t);            // quadrado -> círculo
      for (let a = 0; a < NA; a++) {
        const gi = ring0[a][0], gj = ring0[a][1];
        const sx = T.X0 + gi * HS - CX, sz = T.Z0 + gj * HS - CZ;
        if (rj === 0) { P.push(CX + sx, H[gj * HN + gi], CZ + sz); continue; }
        const l = Math.hypot(sx, sz);
        const cx = sx / l * HALF * 1.12, cz = sz / l * HALF * 1.12;
        const x = CX + lerp(sx, cx, circ) * scale, z = CZ + lerp(sz, cz, circ) * scale;
        P.push(x, natural(x, z, baseAt(x, z)), z);
      }
    }
    for (let rj = 0; rj < NR; rj++) for (let a = 0; a < NA; a++) {
      const a0 = rj * NA + a, a1 = rj * NA + (a + 1) % NA, b0 = a0 + NA, b1 = a1 + NA;
      I.push(a0, b1, a1, a0, b0, b1);
    }
    return { pos: new Float32Array(P), idx: new Uint32Array(I) };
  };
  return T;
})();
