// ---------------------------------------------------------------------------
// car_model.js — Fiat Uno Mille EP 1996 (2 portas) procedural
// Local: +X frente, +Y cima, +Z direita. Origem no chão, entre os eixos.
// ---------------------------------------------------------------------------
'use strict';

const CARDIM = {
  wheelbase: 2.36, axleF: 1.18, axleR: -1.18, trackF: 1.34, trackR: 1.31,
  wheelR: 0.292, wheelW: 0.145, length: 3.69, width: 1.55, height: 1.44,
  mass: 845, cgH: 0.50,
};

const CARMODEL = (() => {
  const C = {};
  const SDF_MAT = [MAT.CAR_PAINT, MAT.CAR_INTERIOR, MAT.CAR_RUBBER, MAT.CAR_UNDER, MAT.CAR_PLASTIC];

  async function runSDF(device, module, entry, params, bufs, wg) {
    const p = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: entry } });
    const ub = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(ub, 0, params);
    const entries = [{ binding: 0, resource: { buffer: ub } }];
    for (const [b, buf] of bufs) entries.push({ binding: b, resource: { buffer: buf } });
    const bg = device.createBindGroup({ layout: p.getBindGroupLayout(0), entries });
    const e = device.createCommandEncoder(); const c = e.beginComputePass(); c.setPipeline(p); c.setBindGroup(0, bg);
    c.dispatchWorkgroups(wg[0], wg[1], wg[2]); c.end(); device.queue.submit([e.finish()]);
  }
  async function readBuf(device, src, size) {
    const rb = device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const e = device.createCommandEncoder(); e.copyBufferToBuffer(src, 0, rb, 0, size); device.queue.submit([e.finish()]);
    await rb.mapAsync(GPUMapMode.READ);
    const out = new Float32Array(rb.getMappedRange().slice(0));
    rb.unmap(); rb.destroy();
    return out;
  }
  // refina/raios: pontos (vec4) -> resultado
  async function gpuPoints(device, mod, entry, pts, dirs) {
    const n = pts.length / 4;
    const pb = device.createBuffer({ size: pts.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
    const nb = device.createBuffer({ size: pts.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(pb, 0, pts);
    if (dirs) device.queue.writeBuffer(nb, 0, dirs);
    const prm = new ArrayBuffer(48); const u = new Uint32Array(prm); u[8] = 0; u[9] = 0; u[10] = 0; u[11] = n;
    await runSDF(device, mod, entry, prm, [[2, pb], [3, nb]], [Math.ceil(n / 64), 1, 1]);
    const P = await readBuf(device, pb, pts.byteLength), N = await readBuf(device, nb, pts.byteLength);
    pb.destroy(); nb.destroy();
    return [P, N];
  }

  async function surfaceNets(device, mod, cell, proxy) {
    // ---------------- grade SDF
    
    const ox = -1.96, oy = 0.17, oz = -0.83;
    const nx = Math.ceil((1.99 - ox) / cell) + 1, ny = Math.ceil((1.50 - oy) / cell) + 1, nz = Math.ceil((0.83 - oz) / cell) + 1;
    const total = nx * ny * nz;
    const gb = device.createBuffer({ size: total * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const prm = new ArrayBuffer(48); const f = new Float32Array(prm), u = new Uint32Array(prm);
    f[0] = ox; f[1] = oy; f[2] = oz; f[4] = cell; u[8] = nx; u[9] = ny; u[10] = nz; u[11] = 0;
    await runSDF(device, mod, 'csGrid', prm, [[1, gb]], [Math.ceil(nx / 4), Math.ceil(ny / 4), Math.ceil(nz / 4)]);
    const grid = await readBuf(device, gb, total * 8);
    gb.destroy();
    // ---------------- surface nets
    const idx = (i, j, k) => (k * ny + j) * nx + i;
    const D = (i, j, k) => grid[idx(i, j, k) * 2];
    const cellV = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
    const cIdx = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
    const pts = [];
    const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const cd = new Float32Array(8);
    for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      let neg = 0;
      for (let c = 0; c < 8; c++) { const v = D(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1)); cd[c] = v; if (v < 0) neg++; }
      if (neg === 0 || neg === 8) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of EDGES) {
        if ((cd[a] < 0) === (cd[b] < 0)) continue;
        const t = cd[a] / (cd[a] - cd[b]);
        const ax = a & 1, ay = (a >> 1) & 1, az = (a >> 2) & 1, bx = b & 1, by = (b >> 1) & 1, bz = (b >> 2) & 1;
        sx += ax + (bx - ax) * t; sy += ay + (by - ay) * t; sz += az + (bz - az) * t; n++;
      }
      cellV[cIdx(i, j, k)] = pts.length / 4;
      pts.push(ox + (i + sx / n) * cell, oy + (j + sy / n) * cell, oz + (k + sz / n) * cell, 0);
    }
    const quads = [];
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const d0 = D(i, j, k);
      // aresta em x
      const dx = D(i + 1, j, k);
      if ((d0 < 0) !== (dx < 0)) {
        const a = cellV[cIdx(i, j - 1, k - 1)], b = cellV[cIdx(i, j, k - 1)], c = cellV[cIdx(i, j, k)], d = cellV[cIdx(i, j - 1, k)];
        if (d0 < 0) quads.push(a, b, c, d); else quads.push(a, d, c, b);
      }
      const dy = D(i, j + 1, k);
      if ((d0 < 0) !== (dy < 0)) {
        const a = cellV[cIdx(i - 1, j, k - 1)], b = cellV[cIdx(i - 1, j, k)], c = cellV[cIdx(i, j, k)], d = cellV[cIdx(i, j, k - 1)];
        if (d0 < 0) quads.push(a, b, c, d); else quads.push(a, d, c, b);
      }
      const dz = D(i, j, k + 1);
      if ((d0 < 0) !== (dz < 0)) {
        const a = cellV[cIdx(i - 1, j - 1, k)], b = cellV[cIdx(i, j - 1, k)], c = cellV[cIdx(i, j, k)], d = cellV[cIdx(i - 1, j, k)];
        if (d0 < 0) quads.push(a, b, c, d); else quads.push(a, d, c, b);
      }
    }
    const [P, NN] = await gpuPoints(device, mod, 'csRefine', new Float32Array(pts), null);
    const body = new MB();
    const nv = P.length / 4;
    // casca: material único (pintura) com pesos interpolados -> fronteiras suaves por pixel
    //   uv.x = peso pintura, uv.y = peso vedação, nrm.w = peso preto; forração = resto
    for (let v = 0; v < nv; v++) {
      const k = Math.round(P[v * 4 + 3]);
      if (k === 4) { body.vert(P[v * 4], P[v * 4 + 1], P[v * 4 + 2], NN[v * 4], NN[v * 4 + 1], NN[v * 4 + 2], 0, 0, MAT.CAR_PLASTIC); continue; }
      body.vert(P[v * 4], P[v * 4 + 1], P[v * 4 + 2], NN[v * 4], NN[v * 4 + 1], NN[v * 4 + 2], k === 0 ? 1 : 0, k === 2 ? 1 : 0, MAT.CAR_PAINT, 0, 0, 0, k === 3 ? 1 : 0);
    }
    for (let q = 0; q < quads.length; q += 4) {
      const a = quads[q], b = quads[q + 1], c = quads[q + 2], d = quads[q + 3];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      body.quad(a, b, c, d);
    }
    return body;
  }
  C.buildProxy = async (device) => {
    const mod = device.createShaderModule({ code: SHADERS.common + '\n' + SHADERS.car_shape + '\n' + SHADERS.car_sdf });
    return await surfaceNets(device, mod, C.cell, true);
  };
  C.build = async (device) => {
    const mod = device.createShaderModule({ code: SHADERS.common + '\n' + SHADERS.car_shape + '\n' + SHADERS.car_sdf });
    const body = await surfaceNets(device, mod, C.cell || 0.0105, false);
    // ---------------- vidros
    const glass = new MB();
    await buildGlass(device, mod, glass);
    // ---------------- peças
    const parts = new MB();
    buildParts(parts);
    const steer = new MB();
    buildSteeringWheel(steer);
    const wheelR = new MB(), wheelL = new MB();
    buildWheel(wheelR, 1); buildWheel(wheelL, -1);
    body.append(parts);
    // proxy grosso para sombras distantes
    let proxy = null;
    if (!C.cell) { C.cell = 0.032; const r = await C.buildProxy(device); proxy = r; C.cell = 0; proxy.append(parts); }
    return { body, glass, steer, wheelR, wheelL, proxy };
  };

  // ---------------- vidros por raios contra a superfície externa
  function inPoly(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }
  async function buildGlass(device, mod, mb) {
    const door = [[0.63, 0.96], [0.105, 1.385], [0.04, 1.40], [-0.53, 1.40], [-0.53, 0.96]];
    const quarter = [[-0.57, 0.96], [-0.57, 1.40], [-1.06, 1.40], [-1.16, 1.37], [-1.39, 1.04], [-1.365, 0.96]];
    const jobs = [];
    // laterais: grade em (x,y), raio de z=±0.95 para dentro
    for (const side of [1, -1]) for (const poly of [door, quarter]) {
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const NX = 40, NY = 18; const g = [];
      for (let b = 0; b <= NY; b++) for (let a = 0; a <= NX; a++) {
        const x = lerp(x0, x1, a / NX), y = lerp(y0, y1, b / NY);
        g.push([x, y, 0.95 * side, 0, 0, -side, inPoly(x, y, poly)]);
      }
      jobs.push({ g, NX, NY, side, kind: 'side', inset: 0.006 });
    }
    // para-brisa: grade em (z,y), raio de x=1.3 para -x
    {
      const NX = 44, NY = 24, g = [];
      for (let b = 0; b <= NY; b++) for (let a = 0; a <= NX; a++) {
        const y = lerp(0.91, 1.395, b / NY), z = lerp(-0.70, 0.70, a / NX);
        g.push([1.3, y, z, -1, 0, 0, true]);
      }
      jobs.push({ g, NX, NY, kind: 'front', inset: 0.007 });
    }
    {
      const NX = 44, NY = 20, g = [];
      for (let b = 0; b <= NY; b++) for (let a = 0; a <= NX; a++) {
        const y = lerp(0.98, 1.37, b / NY), z = lerp(-0.70, 0.70, a / NX);
        g.push([-2.2, y, z, 1, 0, 0, true]);
      }
      jobs.push({ g, NX, NY, kind: 'rear', inset: 0.007 });
    }
    // largura da abertura frontal (mesma do sdFront recuado) para recortar
    const frontHalf = (y, inset) => {
      const prof = [[0.748, 0.99], [0.722, 1.05], [0.672, 1.28], [0.645, 1.365], [0.60, 1.415]];
      let w = 0.748;
      for (let i = 0; i < prof.length - 1; i++) if (y >= prof[i][1] && y <= prof[i + 1][1]) w = lerp(prof[i][0], prof[i + 1][0], (y - prof[i][1]) / (prof[i + 1][1] - prof[i][1]));
      if (y < 0.99) w = 0.75;
      return w - inset;
    };
    for (const job of jobs) {
      const n = job.g.length, O = new Float32Array(n * 4), Dd = new Float32Array(n * 4);
      job.g.forEach((p, i) => { O.set([p[0], p[1], p[2], 0], i * 4); Dd.set([p[3], p[4], p[5], 0], i * 4); });
      const [Pp, Nn] = await gpuPoints(device, mod, 'csRay', O, Dd);
      const base = mb.count;
      const keep = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const hit = Pp[i * 4 + 3] > 0.5;
        let x = Pp[i * 4], y = Pp[i * 4 + 1], z = Pp[i * 4 + 2];
        const nx = Nn[i * 4], ny = Nn[i * 4 + 1], nz = Nn[i * 4 + 2];
        x -= nx * job.inset; y -= ny * job.inset; z -= nz * job.inset;
        let ok = hit && job.g[i][6];
        if (job.kind !== 'side') ok = ok && Math.abs(z) < frontHalf(y, job.kind === 'front' ? 0.05 : 0.06);
        keep[i] = ok ? 1 : 0;
        mb.vert(x, y, z, nx, ny, nz, (job.kind === 'rear' ? 1 : 0), y, MAT.CAR_PAINT, job.kind === 'rear' ? 1 : 0);
      }
      for (let b = 0; b < job.NY; b++) for (let a = 0; a < job.NX; a++) {
        const i0 = b * (job.NX + 1) + a, i1 = i0 + 1, i2 = i0 + job.NX + 1, i3 = i2 + 1;
        if (keep[i0] && keep[i1] && keep[i2] && keep[i3]) mb.quad(base + i0, base + i1, base + i3, base + i2);
      }
    }
  }

  // ---------------- roda (pneu + calota), eixo ao longo de Z; face externa em +Z*side
  function buildWheel(mb, side) {
    const R = CARDIM.wheelR, W = CARDIM.wheelW, rim = 0.168;
    // perfil do pneu [r, x] com x = eixo (face externa +x)
    const tp = [];
    const hw = W / 2;
    const ptsT = [
      [rim + 0.004, -hw + 0.012], [rim + 0.02, -hw - 0.004], [rim + 0.06, -hw - 0.010], [R - 0.045, -hw - 0.006], [R - 0.016, -hw + 0.008],
      [R - 0.004, -hw + 0.022], [R, -hw + 0.04], [R, hw - 0.04], [R - 0.004, hw - 0.022], [R - 0.016, hw - 0.008], [R - 0.045, hw + 0.006],
      [rim + 0.06, hw + 0.010], [rim + 0.02, hw + 0.004], [rim + 0.004, hw - 0.012]];
    for (let k = 0; k < ptsT.length; k++) {
      const a = ptsT[Math.max(0, k - 1)], b = ptsT[Math.min(ptsT.length - 1, k + 1)];
      const dr = b[0] - a[0], dx = b[1] - a[1], l = Math.hypot(dr, dx);
      tp.push([ptsT[k][0], ptsT[k][1], dx / l, -dr / l]);
    }
    const rot = m4Trs(0, 0, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0, 1);
    mb.setTransform(rot);
    mb.lathe(tp, 72, MAT.CAR_TYRE, { vfn: (k) => k / (tp.length - 1) });
    // calota (disco abaulado) — face externa
    const hp = [[0.0, hw + 0.012, 0, 1], [0.05, hw + 0.011, 0.05, 1], [0.12, hw + 0.006, 0.15, 1], [0.155, hw - 0.002, 0.5, 1], [0.170, hw - 0.012, 1, 0.2], [0.172, hw - 0.03, 1, 0]];
    mb.lathe(hp.map(([r, x, nr, nx]) => { const l = Math.hypot(nr, nx); return [r, x, nr / l, nx / l]; }), 64, MAT.CAR_HUBCAP, { vfn: (k) => hp[k][0] / 0.172 });
    // face interna escura (roda de aço/tambor)
    const ip = [[0.0, -hw + 0.02, 0, -1], [0.17, -hw + 0.02, 0, -1]];
    mb.lathe(ip, 24, MAT.CAR_UNDER, {});
    mb.setTransform(null);
  }

  function buildSteeringWheel(mb) {
    // em coordenadas locais do volante: eixo = X; posicionado pela matriz de objeto
    const ringR = 0.185, tube = 0.016;
    const path = [], prof = [];
    for (let a = 0; a <= 48; a++) { const t = a / 48 * TAU; path.push([0, Math.cos(t) * ringR, Math.sin(t) * ringR]); }
    for (let a = 0; a < 10; a++) { const t = a / 10 * TAU; prof.push([Math.cos(t) * tube, Math.sin(t) * tube, Math.cos(t), Math.sin(t)]); }
    mb.sweep(path, prof, MAT.CAR_STEER, { up: [1, 0, 0] });
    // cubo e raios
    mb.cylinder([0.02, 0, 0], [-0.04, 0, 0], 0.055, 0.045, 16, MAT.CAR_STEER, { caps: true });
    for (const ang of [Math.PI * 0.5 + 0.2, Math.PI * 0.5 - 0.2 + Math.PI, -Math.PI * 0.5]) {
      mb.cylinder([0, Math.cos(ang) * 0.04, Math.sin(ang) * 0.04], [0.005, Math.cos(ang) * ringR, Math.sin(ang) * ringR], 0.012, 0.009, 8, MAT.CAR_STEER);
    }
    // logotipo central
    mb.cylinder([0.025, 0, 0], [0.022, 0, 0], 0.022, 0.022, 16, MAT.CAR_CHROME, { caps: true });
  }

  function roundedBox(mb, c, h, mat, r = 0.02, attr, e = 0.42) {
    // caixa com cantos arredondados — superelipsoide (e=1: elipsoide)
    const [hx, hy, hz] = h;
    mb.param(28, 18, (u, v) => {
      const th = (v - 0.5) * PI, ph = u * TAU;
      const sgn = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p);
      const ct = sgn(Math.cos(th), e), st = sgn(Math.sin(th), e), cp = sgn(Math.cos(ph), e), sp = sgn(Math.sin(ph), e);
      return [c[0] + hx * ct * cp, c[1] + hy * st, c[2] + hz * ct * sp];
    }, mat, [1, 1], attr || [0, 0, 0], true);
  }

  function buildParts(mb) {
    const M = MAT;
    // --- faróis (lente + moldura)
    for (const s of [1, -1]) {
      mb.box(1.838, 0.64, s * 0.455, 0.008, 0.072, 0.152, M.CAR_GRILLE);
      mb.box(1.844, 0.64, s * 0.455, 0.004, 0.066, 0.146, M.CAR_HEADLIGHT, [0, 0, 0]);
      mb.box(1.8415, 0.64, s * 0.455, 0.0045, 0.069, 0.149, M.CAR_CHROME);
      // pisca (canto)
      const m = m4Trs(1.83, 0.64, s * 0.643, s * 0.33, 0, 0, 1); mb.setTransform(m);
      mb.box(0, 0, 0, 0.003, 0.064, 0.04, M.CAR_INDICATOR, [0, 0, 0]);
      mb.setTransform(null);
    }
    // --- grade preta com dois frisos e emblema de 5 barras
    mb.box(1.838, 0.64, 0, 0.005, 0.072, 0.302, M.CAR_PAINT_SOLID);
    for (const gy of [0.622, 0.658]) mb.box(1.8405, gy, 0, 0.004, 0.0085, 0.272, M.CAR_GRILLE, [0, 0, 0]);
    for (let b = 0; b < 5; b++) {
      const z = (b - 2) * 0.023;
      const m = m4Trs(1.85, 0.64, z, 0, 0, 0, 1); mb.setTransform(m);
      // barras inclinadas ~20°
      const ax = [0.006, 0, 0], ay = [0, 0.058, -0.02], az = [0, 0, 0.0055];
      mb.obox([0, 0, 0], ax, ay, az, M.CAR_CHROME);
      mb.setTransform(null);
    }
    // --- placas
    mb.box(1.912, 0.36, 0, 0.004, 0.065, 0.20, M.CAR_PLATE, [0, 0, 0]);
    mb.box(-1.79, 0.62, 0, 0.004, 0.065, 0.20, M.CAR_PLATE, [1, 0, 0]);
    // --- lanternas traseiras
    for (const s of [1, -1]) {
      mb.box(-1.772, 0.70, s * 0.625, 0.012, 0.168, 0.118, M.CAR_PLASTIC);
      mb.box(-1.776, 0.70, s * 0.625, 0.012, 0.158, 0.108, M.CAR_TAILLIGHT, [0, 0, 0]);
      const m = m4Trs(-1.762, 0.70, s * 0.735, -s * 0.9, 0, 0, 1); mb.setTransform(m);
      mb.box(0, 0, 0, 0.006, 0.162, 0.03, M.CAR_TAILLIGHT, [0, 0, 0]);
      mb.setTransform(null);
    }
    // puxador da tampa traseira
    mb.box(-1.787, 0.665, 0.30, 0.008, 0.016, 0.055, M.CAR_PLASTIC);
    // emblemas traseiros (decalques)
    mb.box(-1.7375, 0.905, 0.44, 0.002, 0.026, 0.11, M.CAR_BADGE, [0, 0, 0]);   // "Mille EP"
    mb.box(-1.7375, 0.905, -0.44, 0.002, 0.024, 0.075, M.CAR_BADGE, [1, 0, 0]); // "FIAT"
    // --- espelhos
    for (const s of [1, -1]) {
      roundedBox(mb, [0.605, 1.03, s * 0.835], [0.05, 0.036, 0.058], M.CAR_MIRROR);
      mb.box(0.62, 1.01, s * 0.772, 0.05, 0.03, 0.012, M.CAR_PLASTIC);
      mb.box(0.63, 1.005, s * 0.79, 0.03, 0.014, 0.02, M.CAR_PLASTIC);
      // vidro do espelho (face traseira)
      mb.box(0.553, 1.03, s * 0.838, 0.002, 0.03, 0.05, M.CAR_CHROME);
    }
    // --- maçanetas
    for (const s of [1, -1]) mb.box(-0.40, 0.915, s * 0.770, 0.055, 0.012, 0.006, M.CAR_PLASTIC);
    // --- limpadores (dianteiros + traseiro)
    for (const [z0, len] of [[-0.46, 0.50], [0.06, 0.48]]) {
      // braço e palheta deitados sobre o vidro, inclinados ~12° para cima
      const m = m4Trs(0.738, 0.952, z0, -0.18, 0, -0.9, 1); mb.setTransform(m);
      mb.box(0.0, 0.006, len * 0.5, 0.008, 0.006, len * 0.5, M.CAR_PLASTIC);
      mb.box(0.012, 0.0, len * 0.52, 0.006, 0.01, len * 0.47, M.CAR_RUBBER);
      mb.setTransform(null);
    }
    mb.cylinder([-1.735, 1.02, 0.0], [-1.66, 1.25, -0.28], 0.006, 0.005, 6, M.CAR_PLASTIC);
    // --- calhas de chuva no teto
    for (const s of [1, -1]) mb.cylinder([0.12, 1.400, s * 0.612], [-1.46, 1.405, s * 0.612], 0.009, 0.009, 6, M.CAR_PAINT_SOLID);
    // --- escapamento
    mb.cylinder([-1.55, 0.21, -0.44], [-1.89, 0.205, -0.44], 0.022, 0.022, 12, M.CAR_EXHAUST, { caps: true });
    // --- tampa do tanque (anel)
    // --- rack de teto: duas barras transversais com pés
    const rackX = [-0.02, -1.10];
    for (const x of rackX) {
      mb.box(x, 1.49, 0, 0.016, 0.013, 0.56, M.CAR_RACK);
      for (const s of [1, -1]) {
        const m = m4Trs(x, 1.45, s * 0.55, 0, s * 0.35, 0, 1); mb.setTransform(m);
        mb.box(0, 0, 0, 0.026, 0.035, 0.013, M.CAR_RACK);
        mb.setTransform(null);
        mb.box(x, 1.408, s * 0.565, 0.036, 0.01, 0.022, M.CAR_RUBBER);
      }
    }
    // --- escada de alumínio (3,0 m, 11 degraus)
    const lx0 = 0.72, lx1 = -2.08, railZ = 0.212, yb = 1.503;
    for (const s of [1, -1]) {
      // perfil C: alma + abas
      const cx = (lx0 + lx1) / 2, hl = (lx0 - lx1) / 2;
      mb.box(cx, yb + 0.034, s * (railZ + 0.011), hl, 0.034, 0.0022, M.CAR_ALU, [0, 0, 0]);
      mb.box(cx, yb + 0.0015, s * (railZ), hl, 0.0018, 0.013, M.CAR_ALU, [1, 0, 0]);
      mb.box(cx, yb + 0.0665, s * (railZ), hl, 0.0018, 0.013, M.CAR_ALU, [1, 0, 0]);
      // ponteiras de borracha
      mb.box(lx0 + 0.012, yb + 0.034, s * railZ, 0.012, 0.036, 0.015, M.CAR_RUBBER);
      mb.box(lx1 - 0.012, yb + 0.034, s * railZ, 0.012, 0.036, 0.015, M.CAR_RUBBER);
    }
    for (let r = 0; r < 10; r++) {
      const x = lx0 - 0.15 - r * 0.27;
      // degrau em D (tubo achatado com estrias)
      const prof = [];
      for (let a = 0; a < 12; a++) { const t = a / 12 * TAU; const cy = Math.cos(t), sy = Math.sin(t); prof.push([cy * 0.016, sy * 0.014 + (sy > 0 ? 0.002 : 0), cy, sy]); }
      const path = [[x, yb + 0.034, -railZ], [x, yb + 0.034, railZ]];
      mb.sweep(path, prof, M.CAR_ALU, { up: [0, 1, 0], attr: [2, 0, 0] });
      // rebites
      for (const s of [1, -1]) mb.cylinder([x, yb + 0.034, s * (railZ + 0.012)], [x, yb + 0.034, s * (railZ + 0.016)], 0.012, 0.01, 10, M.CAR_ALU, { caps: true });
    }
    // --- cintas (laranja) em volta da longarina e da barra, com catraca
    for (const x of rackX) for (const s of [1, -1]) {
      const zc = s * railZ;
      const loop = [];
      const yt = yb + 0.0705, ybot = 1.474, zi = zc - s * 0.019, zo = zc + s * 0.019;
      const P = [[zi, ybot], [zo, ybot], [zo + s * 0.004, ybot + 0.015], [zo + s * 0.004, yt - 0.004], [zo, yt], [zi, yt], [zi - s * 0.004, yt - 0.004], [zi - s * 0.004, ybot + 0.015], [zi, ybot]];
      for (const [z, y] of P) loop.push([x + 0.004, y, z]);
      const prof = [[0, -0.0125, 0, -1], [0.0012, -0.0125, 1, 0], [0.0012, 0.0125, 1, 0], [0, 0.0125, 0, 1]];
      // perfil plano (fita): eixo "up" = X para a fita ficar larga em X
      const band = [[-0.0016, -0.018, -1, 0], [0.0016, -0.018, 1, 0], [0.0016, 0.018, 1, 0], [-0.0016, 0.018, -1, 0]];
      mb.sweep(loop, band, M.CAR_STRAP, { up: [1, 0, 0] });
      // catraca e ponta solta da cinta caindo sobre o teto
      mb.box(x + 0.004, yb + 0.034, zo + s * 0.006, 0.016, 0.02, 0.005, M.CAR_RACK);
      // (sem ponta solta: fita rente à barra)
    }
    // ---------------- interior
    // painel (perfil varrido em z)
    {
      const prof = [[0.88, 0.935], [0.58, 0.985], [0.50, 0.95], [0.47, 0.86], [0.52, 0.76], [0.80, 0.74], [0.88, 0.935]];
      const pr = prof.map((p, i) => { const a = prof[Math.max(0, i - 1)], b = prof[Math.min(prof.length - 1, i + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [p[0], p[1], dy / l, -dx / l]; });
      const base = mb.count;
      for (const z of [-0.70, 0.70]) for (const [x, y, nx, ny] of pr) mb.vert(x, y, z, nx, ny, 0, z, y, M.CAR_DASH);
      const n = pr.length;
      for (let i = 0; i < n - 1; i++) mb.quad(base + i, base + i + 1, base + n + i + 1, base + n + i);
      // binóculo do quadro de instrumentos (lado do motorista: z<0)
      roundedBox(mb, [0.55, 0.995, -0.36], [0.07, 0.04, 0.17], M.CAR_DASH);
      // console central + alavanca
      mb.box(0.55, 0.62, 0, 0.08, 0.14, 0.12, M.CAR_DASH);
      mb.box(0.25, 0.36, 0, 0.30, 0.05, 0.10, M.CAR_DASH);
      mb.cylinder([0.22, 0.40, 0], [0.18, 0.62, 0], 0.008, 0.008, 8, M.CAR_CHROME);
      roundedBox(mb, [0.18, 0.64, 0], [0.022, 0.025, 0.022], M.CAR_DASH);
      // coluna de direção
      mb.cylinder([0.62, 0.78, -0.36], [0.44, 0.90, -0.36], 0.03, 0.026, 10, M.CAR_DASH);
      // retrovisor interno
      roundedBox(mb, [0.30, 1.33, 0], [0.02, 0.03, 0.10], M.CAR_PLASTIC);
    }
    // assoalho (carpete)
    mb.box(-0.4, 0.29, 0, 1.15, 0.02, 0.68, M.CAR_INTERIOR, [1, 0, 0]);
    // bancos dianteiros
    for (const s of [1, -1]) {
      const z = s * 0.36;
      roundedBox(mb, [0.02, 0.50, z], [0.24, 0.07, 0.235], M.CAR_SEAT);
      const m = m4Trs(-0.27, 0.83, z, 0, 0, 0.26, 1); mb.setTransform(m);
      roundedBox(mb, [0, 0, 0], [0.07, 0.31, 0.235], M.CAR_SEAT);
      roundedBox(mb, [-0.035, 0.40, 0], [0.05, 0.085, 0.13], M.CAR_SEAT);
      mb.setTransform(null);
      mb.box(0.0, 0.38, z, 0.20, 0.06, 0.18, M.CAR_UNDER);
    }
    // banco traseiro
    roundedBox(mb, [-0.95, 0.47, 0], [0.24, 0.075, 0.62], M.CAR_SEAT);
    { const m = m4Trs(-1.24, 0.79, 0, 0, 0, 0.32, 1); mb.setTransform(m); roundedBox(mb, [0, 0, 0], [0.065, 0.28, 0.62], M.CAR_SEAT); mb.setTransform(null); }
    // motorista (lado esquerdo): tronco arredondado, pescoço, cabeça e cabelo, braços até o volante
    { const m = m4Trs(-0.12, 0.82, -0.36, 0, 0, 0.2, 1); mb.setTransform(m);
      roundedBox(mb, [0, 0, 0], [0.105, 0.21, 0.175], MAT.CROWD, 0, [1, 0, 0], 0.62);
      roundedBox(mb, [-0.005, 0.17, 0], [0.09, 0.07, 0.19], MAT.CROWD, 0, [1, 0, 0], 0.8);
      mb.setTransform(null); }
    mb.cylinder([-0.11, 1.0, -0.36], [-0.085, 1.075, -0.36], 0.045, 0.042, 12, MAT.CROWD, { attr: [0, 1, 0] });
    // capacete fechado (casco claro) com viseira escura
    roundedBox(mb, [-0.075, 1.15, -0.36], [0.12, 0.125, 0.105], MAT.CROWD, 0, [2, 0, 0], 1.0);
    roundedBox(mb, [-0.005, 1.155, -0.36], [0.07, 0.042, 0.104], MAT.CAR_PLASTIC, 0, [0, 0, 0], 1.0);
    roundedBox(mb, [-0.085, 1.03, -0.36], [0.1, 0.03, 0.095], MAT.CROWD, 0, [3, 0, 0], 1.0);
    for (const sz of [-1, 1]) {
      mb.cylinder([-0.09, 0.97, -0.36 + sz * 0.175], [0.15, 0.86, -0.36 + sz * 0.155], 0.042, 0.036, 12, MAT.CROWD, { attr: [1, 0, 0] });
      mb.cylinder([0.15, 0.86, -0.36 + sz * 0.155], [0.38, 0.95, -0.36 + sz * 0.16], 0.034, 0.028, 12, MAT.CROWD, { attr: [0, 1, 0] });
      roundedBox(mb, [0.15, 0.86, -0.36 + sz * 0.155], [0.04, 0.04, 0.04], MAT.CROWD, 0, [1, 0, 0], 1.0);
    }
    for (const sz of [-1, 1]) mb.cylinder([0.0, 0.58, -0.36 + sz * 0.09], [0.38, 0.52, -0.36 + sz * 0.1], 0.065, 0.05, 12, MAT.CROWD, { attr: [6, 0, 0] });
    // tampão do porta-malas
    mb.box(-1.54, 0.99, 0, 0.17, 0.008, 0.66, M.CAR_DASH);
    // forros de porta (painel interno simples)
    for (const s of [1, -1]) mb.box(0.05, 0.72, s * 0.735, 0.55, 0.20, 0.006, M.CAR_INTERIOR, [0, 0, 0]);
    // tambores de freio (visíveis atrás das rodas)
  }
  C.steerPivot = { x: 0.43, y: 0.915, z: -0.36, tilt: 0.56 };
  return C;
})();
