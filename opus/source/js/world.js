// ---------------------------------------------------------------------------
// world.js — malhas estáticas do circuito: pista, zebras, terreno, barreiras,
// pórtico, arquibancada, boxes, postes, torres de TV
// ---------------------------------------------------------------------------
'use strict';

const WORLD = {};

WORLD.buildTrack = () => {
  const T = TRACK, mb = new MB();
  const N = T.N;
  // asfalto: seção transversal com 11 vértices
  const US = [-1, -0.9, -0.7, -0.45, -0.2, 0, 0.2, 0.45, 0.7, 0.9, 1];
  const cols = US.length;
  const rowStart = [];
  for (let i = 0; i <= N; i++) {
    const k = i % N, s = i * T.ds;
    const x = T.px[k], z = T.pz[k], tx = T.tx[k], tz = T.tz[k];
    const rx = -tz, rz = tx;
    const hw = T.hw[k] + 0.3;
    rowStart.push(mb.count);
    for (let c = 0; c < cols; c++) {
      const u = US[c] * hw;
      const y = T.surfaceY(s, u) + 0.0;
      const wet = Math.round(T.wet[k] * 255);
      // normal aproximada (coroamento)
      const dydu = -0.06 * u / (hw * hw);
      const nx = -rx * dydu, nz = -rz * dydu;
      mb.vert(x + rx * u, y, z + rz * u, nx, 1, nz, u, s, MAT.ASPHALT, wet, 0, 0, clamp(T.racing[k] / 10, -1, 1));
    }
  }
  for (let i = 0; i < N; i++) for (let c = 0; c < cols - 1; c++) {
    const a = rowStart[i] + c, b = a + 1, d = rowStart[i + 1] + c, e = d + 1;
    mb.quad(a, d, e, b);
  }
  // saias laterais (borda do asfalto)
  for (const side of [-1, 1]) {
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const k = i % N, s = i * T.ds;
      const rx = -T.tz[k], rz = T.tx[k];
      const hw = T.hw[k] + 0.3, u = side * hw;
      const y = T.surfaceY(s, u);
      const x = T.px[k] + rx * u, z = T.pz[k] + rz * u;
      top.push(mb.vert(x, y, z, rx * side, 0, rz * side, u, s, MAT.ASPHALT));
      bot.push(mb.vert(x + rx * side * 0.05, y - 0.2, z + rz * side * 0.05, rx * side, 0, rz * side, u, s, MAT.ASPHALT));
    }
    for (let i = 0; i < N; i++) { if (side > 0) mb.quad(top[i], bot[i], bot[i + 1], top[i + 1]); else mb.quad(top[i], top[i + 1], bot[i + 1], bot[i]); }
  }
  // zebras
  for (const side of [-1, 1]) {
    const kb = side < 0 ? T.kerbL : T.kerbR;
    let i = 0;
    while (i < N) {
      if (kb[i] <= 0) { i++; continue; }
      let j = i; while (j < N && kb[j] > 0) j++;
      // perfil: plano inclinado subindo para fora, com borda
      const prof = [[0, 0.0], [0.15, 0.012], [0.85, 0.035], [1, 0.035], [1.0, -0.05]];
      const rows = [];
      for (let q = i - 1; q <= j; q++) {
        const k = ((q % N) + N) % N, s = q * T.ds;
        const rx = -T.tz[k], rz = T.tx[k];
        const endFac = clamp(Math.min(q - i + 1, j - q) / 4, 0.12, 1);
        const kw = Math.max(kb[k], kb[((q - 1) % N + N) % N], 0.9) * endFac;
        const hw = T.hw[k] + 0.3;
        const r = [];
        for (const [t, h] of prof) {
          const u = side * (hw - 0.05 + t * kw);
          const y = T.surfaceY(s, side * (hw)) + h * endFac + 0.004;
          r.push(mb.vert(T.px[k] + rx * u, y, T.pz[k] + rz * u, -rx * side * 0.25 * (t > 0.9 ? -2 : 1), 1, -rz * side * 0.25 * (t > 0.9 ? -2 : 1), t * kw, s, MAT.KERB));
        }
        rows.push(r);
      }
      for (let q = 0; q < rows.length - 1; q++) for (let c = 0; c < prof.length - 1; c++) {
        const a = rows[q][c], b = rows[q][c + 1], d = rows[q + 1][c], e = rows[q + 1][c + 1];
        if (side > 0) mb.quad(a, d, e, b); else mb.quad(a, b, e, d);
      }
      i = j;
    }
  }
  return mb;
};

WORLD.buildTerrain = () => {
  const inner = TERRAIN.buildInnerMesh(), outer = TERRAIN.buildOuterMesh();
  const H = TERRAIN.H, HN = TERRAIN.HN, HS = TERRAIN.HS;
  const mb = new MB();
  const nrmAt = (x, z) => {
    const e = 2.0;
    const hx = TERRAIN.heightAt(x + e, z) - TERRAIN.heightAt(x - e, z);
    const hz = TERRAIN.heightAt(x, z + e) - TERRAIN.heightAt(x, z - e);
    return [-hx, 2 * e, -hz];
  };
  const add = (m, far) => {
    const b = mb.count;
    for (let i = 0; i < m.pos.length; i += 3) {
      const x = m.pos[i], y = m.pos[i + 1], z = m.pos[i + 2];
      let n;
      if (far) {
        const e = Math.max(8, Math.hypot(x - TERRAIN.CX, z - TERRAIN.CZ) * 0.01);
        const h0 = TERRAIN.natural(x - e, z, TERRAIN.baseAt(x - e, z)), h1 = TERRAIN.natural(x + e, z, TERRAIN.baseAt(x + e, z));
        const h2 = TERRAIN.natural(x, z - e, TERRAIN.baseAt(x, z - e)), h3 = TERRAIN.natural(x, z + e, TERRAIN.baseAt(x, z + e));
        n = [h0 - h1, 2 * e, h2 - h3];
      } else n = nrmAt(x, z);
      mb.vert(x, y, z, n[0], n[1], n[2], x, z, MAT.TERRAIN);
    }
    for (let i = 0; i < m.idx.length; i++) mb.ix.push(m.idx[i] + b);
  };
  add(inner, false);
  const innerCount = mb.ix.length;
  add(outer, true);
  // versão grossa (16 m) da região interna para o cubo de reflexo
  const coarse = new MB();
  const CN = 101, st = 16;
  for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) {
    const x = TERRAIN.X0 + i * st, z = TERRAIN.Z0 + j * st, y = TERRAIN.heightAt(x, z) - 0.15;
    const n = nrmAt(x, z);
    coarse.vert(x, y, z, n[0], n[1], n[2], x, z, MAT.TERRAIN);
  }
  for (let j = 0; j < CN - 1; j++) for (let i = 0; i < CN - 1; i++) { const a = j * CN + i; coarse.quad(a, a + CN, a + CN + 1, a + 1); }
  return { mb, innerCount, coarse };
};

// guard-rail (perfil W) varrido ao longo de um offset lateral
function railProfile() {
  // perfil W (meia altura 0.16 m), espessura visual
  const P = [];
  const pts = [[0, -0.17], [0.04, -0.12], [0.0, -0.06], [0.0, 0.06], [0.04, 0.12], [0, 0.17]];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    P.push([pts[k][0], pts[k][1], dy / l, -dx / l]);
  }
  return P;
}
WORLD.buildBarriers = () => {
  const T = TRACK, N = T.N, mb = new MB();
  const posts = [];
  for (const side of [-1, 1]) {
    const wall = side < 0 ? T.wallL : T.wallR;
    const wtype = side < 0 ? T.wallTypeL : T.wallTypeR;
    const tyre = side < 0 ? T.tyreL : T.tyreR;
    // segmentos contínuos por tipo
    let i = 0;
    while (i < N) {
      const type = wtype[i];
      let j = i; while (j < N && wtype[j] === type) j++;
      const pathTop = [], pathBase = [];
      for (let q = i; q <= Math.min(j, N); q++) {
        const k = q % N, s = q * T.ds;
        const rx = -T.tz[k], rz = T.tx[k];
        const u = side * wall[k];
        const x = T.px[k] + rx * u, z = T.pz[k] + rz * u;
        const y = TERRAIN.heightAt(x, z);
        pathBase.push([x, y, z, rx * side, rz * side, s]);
      }
      if (type === 0) {
        // duas lâminas W
        for (const hgt of [0.55, 1.05]) {
          const path = pathBase.map(p => [p[0], p[1] + hgt, p[2]]);
          const prof = railProfile().map(([a, b, na, nb]) => [a * -side, b, na * -side, nb]);
          mb.sweep(path, prof, MAT.ARMCO, { closed: false, vScale: 1, up: [0, 1, 0], uvU: (k) => k / 5, flip: side > 0 });
          // face de trás
          const back = path.map((p, idx) => [p[0] + pathBase[idx][3] * 0.06, p[1], p[2] + pathBase[idx][4] * 0.06]);
          mb.sweep(back, [[0, -0.17, 1, 0], [0, 0.17, 1, 0]].map(([a, b, na, nb]) => [a, b, na * side, nb]), MAT.ARMCO, { closed: false, flip: side < 0 });
        }
        for (let q = 0; q < pathBase.length; q += 4) {
          const p = pathBase[q];
          posts.push([p[0] + p[3] * 0.12, p[1], p[2] + p[4] * 0.12]);
        }
      } else {
        // muro de concreto (1.1 m) com tela acima (só como geometria simples)
        const prof = [[0, 0, -side, 0], [0, 1.15, -side, 0], [0.18 * side, 1.15, 0, 1], [0.18 * side, 0, side, 0]];
        const path = pathBase.map(p => [p[0], p[1] - 0.1, p[2]]);
        const flat = [[0, 0, -1, 0], [0, 1.25, -1, 0]];
        // muro: duas faces + topo
        for (let f = 0; f < 3; f++) {
          const pa = prof[f], pb = prof[f + 1];
          const base = mb.count;
          for (let q = 0; q < path.length; q++) {
            const p = path[q], rx = pathBase[q][3], rz = pathBase[q][4];
            for (const pp of [pa, pb]) {
              const off = pp[0] * side;
              const nx = f === 1 ? 0 : (f === 0 ? -1 : 1), ny = f === 1 ? 1 : 0;
              mb.vert(p[0] + rx * off, p[1] + pp[1], p[2] + rz * off, rx * nx, ny, rz * nx, pathBase[q][5], pp[1] / 1.15, MAT.PIT_WALL, 1);
            }
          }
          for (let q = 0; q < path.length - 1; q++) {
            const a = base + q * 2, b = a + 1, c = a + 2, d = a + 3;
            if (f === 1) mb.quad(a, b, d, c); else if (f === 0) mb.quad(a, c, d, b); else mb.quad(a, b, d, c);
          }
        }
        // tela/alambrado: postes
        for (let q = 0; q < pathBase.length; q += 3) {
          const p = pathBase[q];
          mb.cylinder([p[0] + p[3] * 0.09, p[1] + 1.1, p[2] + p[4] * 0.09], [p[0] + p[3] * 0.09, p[1] + 3.6, p[2] + p[4] * 0.09], 0.035, 0.035, 6, MAT.POLE);
        }
        // cabos horizontais
        for (const hh of [1.6, 2.4, 3.4]) {
          const path2 = pathBase.map(p => [p[0] + p[3] * 0.09, p[1] + hh, p[2] + p[4] * 0.09]);
          const prof2 = []; for (let a = 0; a < 4; a++) { const an = a / 4 * TAU; prof2.push([Math.cos(an) * 0.012, Math.sin(an) * 0.012, Math.cos(an), Math.sin(an)]); }
          mb.sweep(path2, prof2, MAT.FENCE, { closed: true });
        }
      }
      i = j;
    }
    // barreiras de pneus (pilhas) na frente do guard-rail onde há brita
    for (let q = 0; q < N; q += 1) {
      if (!tyre[q]) continue;
    }
  }
  // postes do guard-rail
  for (const p of posts) mb.box(p[0], p[1] + 0.45, p[2], 0.05, 0.6, 0.05, MAT.METAL_GALV);
  return mb;
};

// pilhas de pneus: retorna lista de instâncias [x,y,z,yaw,painted]
WORLD.tyreStacks = () => {
  const T = TRACK, N = T.N, out = [];
  for (const side of [-1, 1]) {
    const wall = side < 0 ? T.wallL : T.wallR, tyre = side < 0 ? T.tyreL : T.tyreR;
    let acc = 0;
    for (let q = 0; q < N; q++) {
      if (!tyre[q]) continue;
      acc += T.ds;
      if (acc < 0.62) continue; acc = 0;
      const rx = -T.tz[q], rz = T.tx[q];
      for (let row = 0; row < 2; row++) {
        const u = side * (wall[q] - 0.45 - row * 0.62);
        const x = T.px[q] + rx * u, z = T.pz[q] + rz * u;
        const y = TERRAIN.heightAt(x, z);
        const band = Math.floor(q / 6) % 2;
        out.push([x, y, z, Math.atan2(T.tz[q], T.tx[q]), row === 0 ? (band ? 1 : 2) : 0]);
      }
    }
  }
  return out;
};
WORLD.buildTyreStacks = () => {
  const mb = new MB();
  const stacks = WORLD.tyreStacks();
  // pilha de 4 pneus como um único sólido de revolução com 4 bojos (8 segmentos)
  const prof = [];
  const R = 0.30, r0 = 0.25;
  const pts = [[0.17, -0.02]];
  for (let h = 0; h < 4; h++) { const y0 = h * 0.2; pts.push([r0, y0 + 0.01], [R, y0 + 0.06], [R, y0 + 0.14], [r0, y0 + 0.19]); }
  pts.push([0.17, 0.80]);
  for (let k = 0; k < pts.length; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    const dr = b[0] - a[0], dx = b[1] - a[1], l = Math.hypot(dr, dx) || 1;
    prof.push([pts[k][0], pts[k][1], -dx / l, dr / l]);
  }
  for (const [x, y, z, yaw, painted] of stacks) {
    mb.setTransform(m4Trs(x, y, z, yaw, 0, Math.PI / 2, 1));
    mb.lathe(prof, 7, MAT.TYRE_BARRIER, { attr: [painted, 0, 0], vfn: (k) => pts[k][1] * 1.25 + 0.0 });
  }
  mb.setTransform(null);
  return mb;
};

// ---------------- pórtico, arquibancada, boxes, placas, torres de TV ----------------
WORLD.buildProps = () => {
  const mb = new MB(), M = MAT;
  const mbC = new MB();   // assentos + público (malha separada, sombra só de perto)
  WORLD.crowdMesh = mbC;
  const T = TRACK;
  const ts = new Float64Array(6);
  const groundY = (x, z) => TERRAIN.heightAt(x, z);
  // ---- pórtico de largada (linha em x≈-40, reta ao longo de +X)
  T.sampleS(T.sStart, ts);
  const gx = ts[0], gy = ts[1];
  for (const z of [-10.6, 11.6]) {
    mb.box(gx, gy + 3.6, z, 0.28, 3.9, 0.28, M.GANTRY);
    mb.box(gx, gy + 0.15, z, 0.6, 0.15, 0.6, M.CONCRETE);
  }
  for (const y of [6.6, 7.6]) for (const dx of [-0.35, 0.35]) mb.box(gx + dx, gy + y, 0.5, 0.06, 0.06, 11.4, M.GANTRY);
  for (let k = 0; k < 23; k++) {
    const z = -10.5 + k;
    for (const dx of [-0.35, 0.35]) mb.cylinder([gx + dx, gy + 6.6, z], [gx + dx, gy + 7.6, z + 1], 0.025, 0.025, 4, M.GANTRY);
    mb.cylinder([gx - 0.35, gy + 6.6, z], [gx + 0.35, gy + 6.6, z], 0.02, 0.02, 4, M.GANTRY);
  }
  for (const z of [-3.2, 3.2]) {
    mb.box(gx - 0.42, gy + 6.0, z, 0.08, 0.32, 1.9, M.GANTRY);
    const b = mb.count;
    const x = gx - 0.505;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) mb.vert(x, gy + 5.72 + v * 0.56, z + 1.8 - u * 3.6, -1, 0, 0, u, v, M.LIGHTPANEL);
    mb.quad(b, b + 1, b + 2, b + 3);
  }
  mb.box(gx - 0.42, gy + 8.25, 0.5, 0.05, 0.5, 11.2, M.SIGN);
  // ---- arquibancada (lado +Z)
  const xa = -150, xb = -15;
  const baseY = groundY(-80, 14);
  const rows = 14;
  for (let r = 0; r < rows; r++) {
    const z0 = 13.5 + r * 1.25, h = 1.2 + r * 0.62;
    mb.box((xa + xb) / 2, baseY + h / 2 - 1, z0 + 0.62, (xb - xa) / 2, h / 2 + 1, 0.625, M.GRANDSTAND);
    // assentos individuais (encosto + assento)
    for (let x = xa + 0.6; x < xb - 0.4; x += 0.52) {
      if (((x - xa - 15) % 22 + 22) % 22 < 1.0) continue;   // corredores das escadas
      const mb = mbC;
      mb.box(x, baseY + h + 0.26, z0 + 0.98, 0.21, 0.2, 0.025, M.SEAT_PLASTIC, [r, 0, 0]);
      mb.box(x, baseY + h + 0.07, z0 + 0.78, 0.21, 0.03, 0.18, M.SEAT_PLASTIC, [r, 0, 0]);
      // público (~40% dos assentos, mais perto da linha de chegada)
      const hh = hash2i(Math.round(x * 10), r * 31 + 7);
      if (hh < 0.48 - Math.abs(x + 50) / 400) {
        const col = Math.floor(hash2i(Math.round(x * 10), r) * 8), skin = hash2i(r, Math.round(x * 7)) < 0.5 ? 1 : 2;
        const lean = (hash2i(Math.round(x * 3), r * 5) - 0.5) * 0.06;
        const by0 = baseY + h + 0.12 + (hash2i(r, Math.round(x * 13)) - 0.5) * 0.08, zc = z0 + 0.86;
        // tronco afunilado (ombros mais largos), braços, cabeça arredondada, pernas
        mb.cylinder([x + lean, by0 + 0.08, zc], [x + lean * 1.4, by0 + 0.56, zc], 0.13, 0.17, 5, M.CROWD, { attr: [col, 0, 0] });
        mb.cylinder([x + lean * 1.4 - 0.17, by0 + 0.52, zc], [x + lean - 0.2, by0 + 0.22, zc - 0.12], 0.04, 0.035, 5, M.CROWD, { attr: [col, 0, 0] });
        mb.cylinder([x + lean * 1.4 + 0.17, by0 + 0.52, zc], [x + lean + 0.2, by0 + 0.22, zc - 0.12], 0.04, 0.035, 5, M.CROWD, { attr: [col, 0, 0] });
        mb.cylinder([x + lean * 1.5, by0 + 0.61, zc - 0.005], [x + lean * 1.5, by0 + 0.81, zc], 0.08, 0.07, 6, M.CROWD, { attr: [0, skin, 0], caps: true });
        if (hh < 0.12) mb.cylinder([x + lean * 1.5, by0 + 0.78, zc], [x + lean * 1.5, by0 + 0.84, zc - 0.03], 0.09, 0.085, 6, M.CROWD, { attr: [(col + 5) % 8, 0, 0], caps: true });
        for (const sx of [-0.08, 0.08]) mb.cylinder([x + sx, by0 + 0.08, zc - 0.02], [x + sx, by0 + 0.06, zc - 0.36], 0.06, 0.055, 5, M.CROWD, { attr: [(col + 3) % 8, 0, 0] });
      }
    }
  }
  for (let x = xa + 15; x < xb; x += 22) for (let r = 0; r < rows; r++) mb.box(x, baseY + 1.25 + r * 0.62, 13.5 + r * 1.25 + 0.62, 0.7, 0.06, 0.63, M.CONCRETE);
  const topY = baseY + 1.2 + rows * 0.62;
  mb.box((xa + xb) / 2, topY / 2 + baseY / 2, 13.5 + rows * 1.25 + 0.2, (xb - xa) / 2, (topY - baseY) / 2 + 1.5, 0.2, M.CONCRETE, [1, 0, 0]);
  for (const x of [xa, xb]) mb.box(x, (topY + baseY) / 2, 13.5 + rows * 0.625, 0.25, (topY - baseY) / 2 + 1.2, rows * 0.625 + 0.4, M.CONCRETE);
  // parede de fundo: nervuras verticais e painéis coloridos (sem marcas)
  const zb = 13.5 + rows * 1.25 + 0.42;
  for (let x = xa + 2.5; x < xb; x += 5) mb.box(x, (topY + baseY) / 2, zb, 0.12, (topY - baseY) / 2 + 1.4, 0.08, M.CONCRETE);
  for (let x = xa + 6; x < xb - 6; x += 18) mb.box(x, baseY + 3.0, zb + 0.1, 6.0, 1.1, 0.04, M.SIGN, [Math.floor(hash2i(x, 3) * 4), 0, 0]);
  for (let x = xa; x <= xb + 0.1; x += 15) {
    mb.box(x, topY + 3.2, 13.5 + rows * 1.25, 0.18, 4.8, 0.18, M.POLE);
    mb.obox([x, topY + 6.4, 13.5 + rows * 0.625 - 2], [0.12, 0, 0], [0, 0.35, 0], [0, 0, rows * 0.625 + 3.5], M.POLE);
  }
  {
    const z0 = 8.5, z1 = 13.5 + rows * 1.25 + 0.4, y0 = topY + 5.6, y1 = topY + 6.9;
    const b = mb.count;
    for (const [x, z, y, u, v] of [[xa - 2, z0, y0, 0, 0], [xb + 2, z0, y0, (xb - xa + 4) / 4, 0], [xb + 2, z1, y1, (xb - xa + 4) / 4, 1], [xa - 2, z1, y1, 0, 1]]) mb.vert(x, y, z, 0, 1, -0.05, u * 4, v * 6, M.ROOF_METAL);
    mb.quad(b, b + 1, b + 2, b + 3);
    const b2 = mb.count;
    for (const [x, z, y] of [[xa - 2, z0, y0 - 0.15], [xb + 2, z0, y0 - 0.15], [xb + 2, z1, y1 - 0.15], [xa - 2, z1, y1 - 0.15]]) mb.vert(x, y, z, 0, -1, 0, x, z, M.GANTRY);
    mb.quad(b2, b2 + 3, b2 + 2, b2 + 1);
    mb.box((xa + xb) / 2, y0 - 0.35, z0, (xb - xa) / 2 + 2, 0.35, 0.12, M.SIGN);
  }
  // fachada traseira da arquibancada: pilastras, vigas, portas, torres de escada e calhas
  {
    const wz = 13.5 + rows * 1.25 + 0.4;
    for (let x = xa + 5; x < xb - 1; x += 10) mb.box(x, baseY + 4.7, wz + 0.3, 0.35, 6.2, 0.3, M.CONCRETE, [1, 0, 0]);
    for (const hy of [5.4, 9.2]) mb.box((xa + xb) / 2, baseY + hy, wz + 0.2, (xb - xa) / 2, 0.2, 0.2, M.CONCRETE);
    let k = 0;
    for (let x = xa + 10; x < xb - 4; x += 10, k++) {
      const h = hash2i(k, 17);
      if (h < 0.55) {
        mb.box(x, baseY + 1.15, wz + 0.04, 1.3, 1.15, 0.04, M.GLASS_DARK);
        mb.box(x, baseY + 2.4, wz + 0.12, 1.5, 0.1, 0.12, M.CONCRETE);
      } else {
        mb.box(x, baseY + 1.5, wz + 0.05, 2.0, 1.5, 0.05, M.ROOF_METAL);
        mb.box(x, baseY + 3.15, wz + 0.15, 2.15, 0.15, 0.15, M.METAL_GALV);
      }
      // janelas altas em fita
      mb.box(x, baseY + 7.3, wz + 0.03, 3.6, 0.55, 0.03, M.GLASS_DARK);
    }
    for (let x = xa + 7.5; x < xb; x += 20) {
      mb.cylinder([x, baseY - 0.5, wz + 0.12], [x, topY + 6.6, wz + 0.12], 0.06, 0.06, 8, M.POLE);
    }
    for (let x = xa + 15; x < xb; x += 44) {
      // torre de escada saliente com fenda de vidro
      mb.box(x, baseY + 5.2, wz + 1.9, 1.7, 6.9, 1.5, M.PAINT_WHITE);
      mb.box(x, baseY + 6.0, wz + 3.42, 0.35, 4.8, 0.03, M.GLASS_DARK);
      mb.box(x, baseY + 12.25, wz + 1.9, 1.85, 0.15, 1.65, M.ROOF_METAL);
      mb.box(x, baseY + 1.2, wz + 3.41, 0.9, 1.2, 0.03, M.GLASS_DARK);
    }
    // laterais: pilastras
    for (const x of [xa - 0.3, xb + 0.3]) for (let z = 15; z < wz; z += 5) mb.box(x, (topY + baseY) / 2, z, 0.12, (topY - baseY) / 2 + 1.0, 0.25, M.CONCRETE);
  }
  // ---- boxes (lado -Z)
  const pxa = -190, pxb = 30;
  {
    const b = mb.count, y0 = groundY(-80, -9) + 0.02;
    for (const [x, z] of [[pxa, -10.2], [pxb, -10.2], [pxb, -23.5], [pxa, -23.5]]) mb.vert(x, y0, z, 0, 1, 0, z, x, M.RUNOFF_ASPHALT);
    mb.quad(b, b + 3, b + 2, b + 1);
    mb.box((pxa + pxb) / 2, y0 + 0.01, -12.2, (pxb - pxa) / 2, 0.01, 0.1, M.PAINT_WHITE);
  }
  const by = groundY(-80, -24);
  const gxa = -175, gxb = -15, nG = 16, gw = (gxb - gxa) / nG;
  mb.box((gxa + gxb) / 2, by + 6.6, -31, (gxb - gxa) / 2 + 0.5, 0.3, 7.5, M.PAINT_WHITE);
  mb.box((gxa + gxb) / 2, by + 3.2, -38.3, (gxb - gxa) / 2 + 0.5, 3.5, 0.3, M.CONCRETE);
  for (let i = 0; i <= nG; i++) mb.box(gxa + i * gw, by + 3.2, -31, 0.35, 3.4, 7.3, M.PAINT_WHITE);
  for (let i = 0; i < nG; i++) {
    const cx = gxa + (i + 0.5) * gw;
    mb.box(cx, by + 2.4, -30.5, gw / 2 - 0.36, 2.4, 0.05, M.GLASS_DARK, [1, 0, 0]);
    const open = 0.4 + 0.5 * hash2i(i, 7);
    mb.box(cx, by + 4.8 - (1 - open) * 1.2, -24.4, gw / 2 - 0.36, Math.max(0.05, (1 - open) * 1.2), 0.04, M.ROOF_METAL);
    mb.box(cx, by + 5.4, -24.2, gw / 2 - 0.36, 0.5, 0.04, M.SIGN);
  }
  mb.box((gxa + gxb) / 2, by + 6.95, -31, (gxb - gxa) / 2 + 0.6, 0.06, 7.6, M.ROOF_METAL);
  mb.box((gxa + gxb) / 2, by + 8.4, -33, (gxb - gxa) / 2, 1.4, 4.5, M.PAINT_WHITE);
  mb.box((gxa + gxb) / 2, by + 8.5, -28.45, (gxb - gxa) / 2 - 0.2, 0.9, 0.05, M.GLASS_DARK);
  for (let x = gxa + 1.5; x < gxb; x += 3) mb.box(x, by + 8.5, -28.42, 0.06, 0.92, 0.04, M.METAL_GALV);
  mb.box((gxa + gxb) / 2, by + 7.25, -28.4, (gxb - gxa) / 2, 0.22, 0.05, M.SIGN);
  mb.box((gxa + gxb) / 2, by + 9.7, -28.45, (gxb - gxa) / 2 + 0.3, 0.12, 0.25, M.METAL_GALV);
  mb.box(-8, by + 9, -31, 6, 9, 6, M.PAINT_WHITE);
  for (let k = 0; k < 4; k++) mb.box(-8, by + 3 + k * 3, -24.95, 4.5, 0.6, 0.05, M.GLASS_DARK);
  for (let k = 0; k < 4; k++) mb.box(-1.95, by + 3 + k * 3, -31, 0.05, 0.6, 4.5, M.GLASS_DARK);
  for (let k = 0; k < 4; k++) mb.box(-8, by + 2.3 + k * 3, -24.9, 4.7, 0.08, 0.12, M.METAL_GALV);
  mb.box(-8, by + 18.2, -31, 0.08, 1.0, 0.08, M.POLE);
  mb.box(-8, by + 15.5, -31, 6.4, 1.6, 6.4, M.GLASS_DARK);
  mb.box(-8, by + 17.3, -31, 6.8, 0.2, 6.8, M.ROOF_METAL);
  // detalhes: equipamentos e guarda-corpo no teto dos boxes, fachada traseira, torre
  {
    const ry = by + 9.8;
    for (let x = gxa + 8, k = 0; x < gxb - 4; x += 17, k++) {
      const z = -35.2 + hash2i(k, 3) * 2.0;
      mb.box(x, ry + 0.45, z, 1.1, 0.45, 0.75, M.METAL_GALV);
      mb.cylinder([x - 0.5, ry + 0.9, z], [x - 0.5, ry + 0.95, z], 0.38, 0.38, 12, M.GANTRY, { caps: true });
      mb.cylinder([x + 0.5, ry + 0.9, z], [x + 0.5, ry + 0.95, z], 0.38, 0.38, 12, M.GANTRY, { caps: true });
      mb.box(x, ry + 0.12, z + 1.2, 0.12, 0.12, 0.5, M.METAL_GALV);
    }
    for (const z of [-28.7, -37.3]) {
      for (let x = gxa; x <= gxb + 0.1; x += 2.5) mb.box(x, ry + 0.55, z, 0.025, 0.55, 0.025, M.POLE);
      mb.cylinder([gxa, ry + 1.08, z], [gxb, ry + 1.08, z], 0.03, 0.03, 6, M.POLE);
      mb.cylinder([gxa, ry + 0.6, z], [gxb, ry + 0.6, z], 0.018, 0.018, 4, M.POLE);
    }
    for (const x of [gxa + 30, gxa + 95]) {
      mb.cylinder([x, ry, -36], [x, ry + 5.5, -36], 0.05, 0.03, 6, M.POLE);
      for (const hy of [3.0, 4.2, 5.2]) mb.box(x, ry + hy, -36, 0.5, 0.02, 0.02, M.POLE);
    }
    // fachada traseira: pilastras, portas de serviço e luminárias
    for (let i = 0; i <= nG; i++) mb.box(gxa + i * gw, by + 3.4, -38.75, 0.3, 3.6, 0.18, M.CONCRETE, [1, 0, 0]);
    for (let i = 0; i < nG; i++) {
      const cx = gxa + (i + 0.5) * gw;
      if (hash2i(i, 11) < 0.6) mb.box(cx - 1.5, by + 1.1, -38.63, 0.55, 1.1, 0.04, M.GLASS_DARK);
      mb.box(cx + 1.0, by + 4.8, -38.65, 1.6, 0.35, 0.03, M.GLASS_DARK);
      mb.box(cx, by + 2.8, -38.7, 0.12, 0.06, 0.12, M.METAL_GALV);
    }
    // torre de controle: laje/varanda, guarda-corpo, montantes do vidro, aletas e mastro
    mb.box(-8, by + 13.85, -31, 7.3, 0.14, 7.3, M.CONCRETE);
    for (const sgn of [-1, 1]) for (let t = -7.2; t <= 7.21; t += 1.2) {
      mb.box(-8 + t, by + 14.5, -31 + sgn * 7.2, 0.025, 0.5, 0.025, M.POLE);
      mb.box(-8 + sgn * 7.2, by + 14.5, -31 + t, 0.025, 0.5, 0.025, M.POLE);
    }
    for (const sgn of [-1, 1]) {
      mb.box(-8, by + 15.0, -31 + sgn * 7.2, 7.2, 0.03, 0.03, M.POLE);
      mb.box(-8 + sgn * 7.2, by + 15.0, -31, 0.03, 0.03, 7.2, M.POLE);
    }
    for (const sgn of [-1, 1]) for (let t = -6.4; t <= 6.41; t += 1.6) {
      mb.box(-8 + t, by + 15.5, -31 + sgn * 6.42, 0.05, 1.6, 0.04, M.METAL_GALV);
      mb.box(-8 + sgn * 6.42, by + 15.5, -31 + t, 0.04, 1.6, 0.05, M.METAL_GALV);
    }
    for (let t = -5.25; t <= 5.3; t += 1.5) mb.box(-8 + t, by + 7.0, -24.85, 0.12, 6.4, 0.18, M.PAINT_WHITE);
    mb.cylinder([-6, by + 17.5, -33], [-6, by + 23, -33], 0.06, 0.03, 6, M.POLE);
    mb.cylinder([-10.5, by + 17.5, -29.5], [-10.5, by + 19.5, -29.5], 0.3, 0.3, 10, M.METAL_GALV, { caps: true });
  }
  // ---- placas de distância antes do grampo
  for (const [d, n] of [[150, 3], [100, 2], [50, 1]]) {
    const s = 365 - d;
    T.sampleS(s, ts);
    const i = Math.floor(s / T.ds);
    const u = -(T.wallL[i] - 1.0);
    const x = ts[0] - ts[4] * u, z = ts[2] + ts[3] * u, y = groundY(x, z);
    const ang = Math.atan2(ts[4], ts[3]);
    mb.setTransform(m4Trs(x, y, z, -ang, 0, 0, 1));
    mb.box(0, 0.6, 0, 0.04, 0.6, 0.04, M.POLE);
    mb.box(-0.03, 1.55, 0, 0.02, 0.45, 0.45, M.PAINT_WHITE);
    for (let k = 0; k < n; k++) mb.box(-0.055, 1.25 + k * 0.22, 0, 0.005, 0.05, 0.38, M.GANTRY);
    mb.setTransform(null);
  }
  // ---- torres de TV e postos de fiscal
  const camS = [70, 250, 400, 520, 640, 760, 880, 1000, 1120];
  for (const s0 of camS) {
    T.sampleS(s0, ts);
    const i = Math.floor(s0 / T.ds) % T.N;
    let sg = 0; for (let k = -30; k <= 30; k++) sg += T.curv[(i + k + T.N) % T.N];
    const side = sg > 0 ? -1 : 1;
    const wall = side < 0 ? T.wallL[i] : T.wallR[i];
    const u = side * (wall + 4.5);
    const x = ts[0] - ts[4] * u, z = ts[2] + ts[3] * u, y = groundY(x, z);
    for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) mb.cylinder([x + ox, y, z + oz], [x + ox * 0.7, y + 3.6, z + oz * 0.7], 0.05, 0.05, 6, M.POLE);
    mb.box(x, y + 3.65, z, 0.9, 0.06, 0.9, M.WOOD);
    mb.box(x, y + 1.8, z, 0.62, 0.03, 0.62, M.POLE);
    const u2 = side * (wall + 2.0);
    const x2 = ts[0] - ts[4] * u2 + ts[3] * 6, z2 = ts[2] + ts[3] * u2 + ts[4] * 6, y2 = groundY(x2, z2);
    mb.box(x2, y2 + 1.1, z2, 0.9, 1.1, 0.9, M.CANVAS);
    mb.box(x2, y2 + 2.25, z2, 1.05, 0.06, 1.05, M.ROOF_METAL);
  }
  return mb;
};
