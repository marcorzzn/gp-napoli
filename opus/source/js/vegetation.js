// ---------------------------------------------------------------------------
// vegetation.js — árvores (3 espécies x 3 LODs) com culling na GPU e grama
// ---------------------------------------------------------------------------
'use strict';

const VEG = (() => {
  const V = {};
  const GRASS_VERTS_C = 72;
  const NSP = 4, NLOD = 3;
  // ---------------- geração das malhas
  let leafTile = 1;
  function leafCard(mb, c, n, size, cell, wind, crownC, rnd, sphereMix) {
    // quadrado orientado por n com rotação aleatória
    let up = Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
    let t = norm3(cross3(up, n)), b = cross3(n, t);
    const a = rnd() * TAU, ca = Math.cos(a), sa = Math.sin(a);
    const t2 = add3(scale3(t, ca), scale3(b, sa)), b2 = add3(scale3(t, -sa), scale3(b, ca));
    const cu = (cell % 2) * 0.5, cv = Math.floor(cell / 2) * 0.5;
    const base = mb.count;
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = add3(c, add3(scale3(t2, su * size * 0.5), scale3(b2, sv * size * 0.5)));
      const sn = norm3(sub3(p, crownC));
      const nn = norm3(lerp3(n, sn, sphereMix));
      // uv: v=0 em cima no atlas; "sv=1" é a ponta (cima) da textura
      mb.vert(p[0], p[1], p[2], nn[0], nn[1], nn[2], cu + (su * 0.5 + 0.5) * 0.5, cv + (0.5 - sv * 0.5) * 0.5, MAT.LEAF, leafTile, 0, 0, wind);
    }
    // centro elevado (cartão em pirâmide): quebra a planaridade vista de lado
    const cc2 = add3(c, scale3(n, size * 0.16));
    const snc = norm3(sub3(cc2, crownC)), nnc = norm3(lerp3(n, snc, sphereMix));
    const ci = mb.vert(cc2[0], cc2[1], cc2[2], nnc[0], nnc[1], nnc[2], cu + 0.25, cv + 0.25, MAT.LEAF, leafTile, 0, 0, wind);
    mb.tri(base, base + 1, ci); mb.tri(base + 1, base + 2, ci); mb.tri(base + 2, base + 3, ci); mb.tri(base + 3, base, ci);
  }
  function branch(mb, p0, p1, r0, r1, seg, wind0, wind1, barkTint) {
    const n = 4, path = [];
    for (let i = 0; i <= n; i++) path.push(lerp3(p0, p1, i / n));
    const prof = []; for (let a = 0; a < seg; a++) { const t = a / seg * TAU; prof.push([Math.cos(t), Math.sin(t), Math.cos(t), Math.sin(t)]); }
    const d = norm3(sub3(p1, p0));
    const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    mb.sweep(path, prof, MAT.BARK, { up, scale: (t) => lerp(r0, r1, t), vScale: 1 / (TAU * Math.max(r0, 0.05)) * 0.5, uvU: (k) => k / seg, w: (t) => lerp(wind0, wind1, t), attr: [barkTint, 0, 0] });
  }
  function makeTree(species, lod, seed) {
    const mb = new MB(), rnd = makeRng(seed);
    leafTile = lod === 0 ? 1 : lod === 1 ? 2 : 3;
    const segT = lod === 0 ? 10 : lod === 1 ? 6 : 4;
    if (species === 0 || species === 3) { // copa larga (3 = variante baixa e esparramada)
      const v3 = species === 3;
      const H = v3 ? 10.5 : 12.5, trunkH = v3 ? 2.2 : 3.0;
      branch(mb, [0, -0.3, 0], [0.1, trunkH, 0.05], 0.36, 0.26, segT, 0, 0.05, 0);
      const limbs = lod === 2 ? 3 : 5;
      const tips = [];
      for (let i = 0; i < limbs; i++) {
        const a = i / limbs * TAU + rnd() * 0.6, el = 0.55 + rnd() * 0.35, L = 4 + rnd() * 2.5;
        const p1 = [Math.cos(a) * Math.cos(el) * L * 0.8, trunkH + Math.sin(el) * L, Math.sin(a) * Math.cos(el) * L * 0.8];
        branch(mb, [0.1, trunkH - 0.3, 0.05], p1, 0.2, 0.08, lod === 0 ? 7 : 4, 0.05, 0.35, 0);
        tips.push(p1);
        if (lod === 0) for (let k = 0; k < 3; k++) {
          const q = lerp3([0.1, trunkH, 0.05], p1, 0.5 + rnd() * 0.4);
          const p2 = add3(q, [(rnd() - 0.5) * 3, 1 + rnd() * 2, (rnd() - 0.5) * 3]);
          branch(mb, q, p2, 0.07, 0.025, 5, 0.3, 0.6, 0); tips.push(p2);
        }
      }
      const cc = [0, H - 4.6, 0];
      const nCards = lod === 0 ? 440 : lod === 1 ? 120 : 22;
      const size = lod === 0 ? 1.25 : lod === 1 ? 2.4 : 5.6;
      for (let i = 0; i < nCards; i++) {
        // pontos num elipsóide irregular (mais na casca externa)
        const u = rnd() * TAU, v = Math.acos(rnd() * 1.6 - 0.6), r = Math.pow(rnd(), 0.35);
        const lob = 1 + 0.25 * Math.sin(u * 3 + seed) * Math.sin(v * 2);
        const d = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
        const wR = v3 ? 6.8 : 5.6, hR = v3 ? 3.4 : 4.4;
        const c = [cc[0] + d[0] * wR * r * lob, cc[1] + d[1] * hR * r * lob, cc[2] + d[2] * wR * r * lob];
        leafCard(mb, c, norm3(add3(d, [(rnd() - .5) * .8, (rnd() - .5) * .8, (rnd() - .5) * .8])), size * (0.8 + rnd() * 0.4), 0, 0.5 + 0.5 * r, cc, rnd, 0.7);
      }
    } else if (species === 1) { // eucalipto
      const H = 21;
      branch(mb, [0, -0.3, 0], [0.3, H * 0.62, 0.2], 0.28, 0.15, segT, 0, 0.12, 1);
      branch(mb, [0.3, H * 0.62, 0.2], [0.5, H - 1, 0.1], 0.15, 0.05, segT, 0.12, 0.4, 1);
      const nb = lod === 2 ? 3 : 7;
      for (let i = 0; i < nb; i++) {
        const h = H * (0.6 + rnd() * 0.33), a = rnd() * TAU, L = 2 + rnd() * 2.5;
        const p0 = [0.35, h, 0.15], p1 = [0.35 + Math.cos(a) * L, h + 1.5 + rnd() * 1.5, 0.15 + Math.sin(a) * L];
        branch(mb, p0, p1, 0.07, 0.03, lod === 0 ? 5 : 3, 0.2, 0.6, 1);
      }
      const cc = [0.4, H - 4.0, 0.15];
      const nCards = lod === 0 ? 300 : lod === 1 ? 90 : 18;
      const size = lod === 0 ? 1.7 : lod === 1 ? 3.0 : 5.4;
      for (let i = 0; i < nCards; i++) {
        const u = rnd() * TAU, v = Math.acos(rnd() * 2 - 1), r = Math.pow(rnd(), 0.5);
        const d = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
        const c = [cc[0] + d[0] * 4.2 * r, cc[1] + d[1] * 7.0 * r - 1.5, cc[2] + d[2] * 4.2 * r];
        leafCard(mb, c, norm3(add3(d, [0, -0.3, 0])), size * (0.8 + rnd() * 0.4), 1, 0.6 + 0.4 * r, cc, rnd, 0.6);
      }
    } else { // arbusto / arvoreta de borda
      const H = 4.2;
      if (lod < 2) for (let i = 0; i < 4; i++) {
        const a = rnd() * TAU;
        branch(mb, [0, -0.2, 0], [Math.cos(a) * 0.8, H * 0.7, Math.sin(a) * 0.8], 0.07, 0.03, 4, 0, 0.4, 0);
      }
      const cc = [0, H * 0.55, 0];
      const nCards = lod === 0 ? 160 : lod === 1 ? 48 : 12;
      const size = lod === 0 ? 1.15 : lod === 1 ? 2.0 : 3.4;
      for (let i = 0; i < nCards; i++) {
        const u = rnd() * TAU, v = Math.acos(rnd() * 1.7 - 0.7), r = Math.pow(rnd(), 0.4);
        const d = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
        const c = [d[0] * 2.4 * r, cc[1] + d[1] * 2.1 * r, d[2] * 2.4 * r];
        leafCard(mb, c, norm3(d), size * (0.8 + rnd() * 0.4), 2, 0.4 + 0.5 * r, cc, rnd, 0.75);
      }
    }
    return mb;
  }

  // ---------------- posicionamento
  function placeTrees() {
    const T = TERRAIN, out = [];
    const rnd = makeRng(1234);
    const step = 4.0;
    const X0 = T.X0 + 4, Z0 = T.Z0 + 4, n = Math.floor((T.HALF * 2 - 8) / step);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = X0 + (i + rnd()) * step, z = Z0 + (j + rnd()) * step;
      const f = T.maskAt(x, z, 3) / 255;
      const g = T.maskAt(x, z, 1) / 255;
      let p = f * 0.9;
      // árvores isoladas em campo aberto (longe da pista)
      T.rasterAt(x, z, tmp);
      const far = tmp[2] > 35;
      if (f < 0.05 && far && g > 0.3) p = 0.012;
      // clareiras e recortes na linha de árvores (quebra a 'parede' contínua)
      const gap = fbm2(x * 0.02 + 31, z * 0.02 - 7, 3);
      if (f > 0.05 && f < 0.85) p *= smoothstep(0.12, 0.32, gap + 0.25);
      if (rnd() > p) continue;
      const y = T.heightAt(x, z);
      // espécie
      const ns = fbm2(x * 0.01 + 50, z * 0.01, 3);
      let sp = ns > 0.34 ? 1 : (rnd() < 0.45 ? 3 : 0);
      if (f < 0.7 && rnd() < 0.75) sp = 2;                 // borda: arbustos
      if (rnd() < 0.4) sp = 2;                             // sub-bosque
      let sc = sp === 2 ? 0.75 + rnd() * 1.1 : 0.6 + rnd() * 0.8;
      if (sp !== 2 && rnd() < 0.06) sc *= 1.45;   // árvores emergentes
      out.push(x, y - 0.1, z, sc, rnd() * TAU, sp, rnd(), rnd() * TAU);
    }
    return new Float32Array(out);
  }
  const tmp = [0, 0, 0];

  // ---------------- GPU
  let treeBuf, visBuf, argsBuf, argsInit, cullPipe, cullBG = [], cullUB, nTrees = 0, meshes = [];
  let treePipeG, treePipeZ, treePipeS, treePipeC, treeBGL, treeBG;
  let grassPipeG, grassPipeS, clumpBuf, gArgs, grassBG, gCullPipe, gCullBG;
  const gArgsInit = new Uint32Array([GRASS_VERTS_C, 0, 0, 0]);
  const VIEWS = 11;   // 0 principal, 1-4 sombras, 5-10 cubo
  const CAP = [10000, 32000, 110000];   // capacidade por LOD (por vista, somando espécies)
  V.init = () => {
    const R = RENDER, device = R.device;
    const inst = placeTrees();
    nTrees = inst.length / 8;
    V.count = nTrees;
    treeBuf = device.createBuffer({ size: inst.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(treeBuf, 0, inst);
    // malhas: um VB/IB por espécie/LOD
    for (let sp = 0; sp < NSP; sp++) for (let l = 0; l < NLOD; l++) {
      const p = makeTree(sp, l, 77 + sp * 13 + (sp === 3 ? 500 : 0)).pack();
      const vb = device.createBuffer({ size: p.vb.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      const ib = device.createBuffer({ size: p.ib.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(vb, 0, p.vb); device.queue.writeBuffer(ib, 0, p.ib);
      meshes.push({ vb, ib, count: p.count });
    }
    // lista visível: por vista, [LOD][espécie] regiões
    const perView = (CAP[0] + CAP[1] + CAP[2]) * NSP;
    visBuf = device.createBuffer({ size: perView * VIEWS * 4, usage: GPUBufferUsage.STORAGE });
    // args indiretos: por vista, 9 draws x 5 u32
    const nArgs = VIEWS * NSP * NLOD;
    argsBuf = device.createBuffer({ size: nArgs * 20, usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    argsInit = new Uint32Array(nArgs * 5);
    for (let v = 0; v < VIEWS; v++) for (let l = 0; l < NLOD; l++) for (let sp = 0; sp < NSP; sp++) {
      const k = (v * NLOD * NSP + l * NSP + sp) * 5;
      let base = v * perView; for (let q = 0; q < l; q++) base += CAP[q] * NSP; base += sp * CAP[l];
      argsInit[k] = meshes[sp * NLOD + l].count; argsInit[k + 1] = 0; argsInit[k + 2] = 0; argsInit[k + 3] = 0; argsInit[k + 4] = base;
    }
    device.queue.writeBuffer(argsBuf, 0, argsInit);
    // culling
    const cullMod = R.shader(R.S('common') + '\n' + SHADERS.veg_cull, 'veg_cull');
    cullPipe = device.createComputePipeline({ layout: 'auto', compute: { module: cullMod, entryPoint: 'csCull' } });
    cullUB = device.createBuffer({ size: VIEWS * 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    for (let v = 0; v < VIEWS; v++) cullBG.push(device.createBindGroup({ layout: cullPipe.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: cullUB, offset: v * 256, size: 160 } }, { binding: 1, resource: { buffer: treeBuf } },
      { binding: 2, resource: { buffer: visBuf } }, { binding: 3, resource: { buffer: argsBuf } }] }));
    // pipelines de desenho
    treeBGL = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }] });
    treeBG = device.createBindGroup({ layout: treeBGL, entries: [{ binding: 0, resource: { buffer: treeBuf } }, { binding: 1, resource: { buffer: visBuf } }] });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [R.sceneBGL, R.objBGL, treeBGL] });
    const mod = R.shader(R.S('common', 'scene', 'vegetation'), 'vegetation');
    const ds = { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' };
    treePipeZ = device.createRenderPipeline({ layout, vertex: { module: mod, entryPoint: 'vsTree', buffers: R.VB_LAYOUT }, fragment: { module: mod, entryPoint: 'fsTreeZ', targets: R.GT.map(t => ({ format: t.format, writeMask: 0 })) }, primitive: { cullMode: 'none' }, depthStencil: ds });
    treePipeG = device.createRenderPipeline({ layout, vertex: { module: mod, entryPoint: 'vsTree', buffers: R.VB_LAYOUT }, fragment: { module: mod, entryPoint: 'fsTreeG', targets: R.GT }, primitive: { cullMode: 'none' }, depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'equal' } });
    treePipeS = device.createRenderPipeline({ layout, vertex: { module: mod, entryPoint: 'vsTreeShadow', buffers: R.VB_LAYOUT }, fragment: { module: mod, entryPoint: 'fsTreeShadow', targets: [] }, primitive: { cullMode: 'none' }, depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater', depthBias: -2, depthBiasSlopeScale: -2 } });
    treePipeC = device.createRenderPipeline({ layout, vertex: { module: mod, entryPoint: 'vsTree', buffers: R.VB_LAYOUT }, fragment: { module: mod, entryPoint: 'fsTreeCube', targets: [{ format: 'rgba16float' }] }, primitive: { cullMode: 'none' }, depthStencil: ds });
    // grama (procedural, sem vertex buffer)
    const ggbl = device.createBindGroupLayout({ entries: [{ binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }] });
    clumpBuf = device.createBuffer({ size: GRASS_INST * 32, usage: GPUBufferUsage.STORAGE });
    gArgs = device.createBuffer({ size: 16, usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    grassBG = device.createBindGroup({ layout: ggbl, entries: [{ binding: 2, resource: { buffer: clumpBuf } }] });
    const gcMod = R.shader(R.S('common') + '\n' + SHADERS.grass_cull, 'grass_cull');
    gCullPipe = device.createComputePipeline({ layout: 'auto', compute: { module: gcMod, entryPoint: 'csGrassCull' } });
    gCullBG = device.createBindGroup({ layout: gCullPipe.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: cullUB, offset: 0, size: 160 } }, { binding: 1, resource: { buffer: R.globBuf } },
      { binding: 2, resource: R.maskTex.createView() }, { binding: 3, resource: R.sampLinClamp }, { binding: 4, resource: R.heightTex.createView() },
      { binding: 5, resource: { buffer: clumpBuf } }, { binding: 6, resource: { buffer: gArgs } }] });
    const glayout = device.createPipelineLayout({ bindGroupLayouts: [R.sceneBGL, R.objBGL, ggbl] });
    grassPipeG = device.createRenderPipeline({ layout: glayout, vertex: { module: mod, entryPoint: 'vsGrass' }, fragment: { module: mod, entryPoint: 'fsGrassG', targets: R.GT }, primitive: { cullMode: 'none' }, depthStencil: ds });
    grassPipeS = device.createRenderPipeline({ layout: glayout, vertex: { module: mod, entryPoint: 'vsGrassShadow' }, primitive: { cullMode: 'none' }, depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater', depthBias: -2, depthBiasSlopeScale: -2 } });

    // ganchos no renderer
    const prevBefore = R.beforeEncode;
    R.beforeEncode = (st) => { if (prevBefore) prevBefore(st); writeCullUniforms(); };
    const prevExtra = R.drawExtra;
    R.drawExtra = (pass, mode, sub, sceneBG, off) => {
      if (prevExtra) prevExtra(pass, mode, sub, sceneBG, off);
      const v = mode === 'gbuffer' ? 0 : mode === 'shadow' ? 1 + sub : 5 + sub;
      const pipe = mode === 'gbuffer' ? treePipeG : mode === 'shadow' ? treePipeS : treePipeC;
      if (!R.flags.trees) { drawGrass(pass, mode, sub); return; }
      pass.setBindGroup(1, R.objBG(), R.dynObj[0]);
      pass.setBindGroup(2, treeBG);
      const l0 = mode === 'cube' ? 2 : 0;
      const nPass = mode === 'gbuffer' ? 2 : 1;
      for (let ps = 0; ps < nPass; ps++) {
        pass.setPipeline(nPass === 2 && ps === 0 ? treePipeZ : pipe);
        for (let l = l0; l < NLOD; l++) for (let sp = 0; sp < NSP; sp++) {
          const m = meshes[sp * NLOD + l];
          pass.setVertexBuffer(0, m.vb); pass.setIndexBuffer(m.ib, 'uint32');
          pass.drawIndexedIndirect(argsBuf, (v * NLOD * NSP + l * NSP + sp) * 20);
        }
      }
      drawGrass(pass, mode, sub);
    };
    function drawGrass(pass, mode, sub) {
      if (!R.flags.grass) return;
      if (mode === 'gbuffer') {
        pass.setPipeline(mode === 'gbuffer' ? grassPipeG : grassPipeS);
        pass.setBindGroup(1, R.objBG(), R.dynObj[0]);
        pass.setBindGroup(2, grassBG);
        pass.drawIndirect(gArgs, 0);
      }
    }
    const prevCompute = R.encodeCompute;
    R.encodeCompute = (enc, f0, nf) => { if (prevCompute) prevCompute(enc, f0, nf); V.encodeCull(enc, f0, nf); };
  };
  const GRASS_VERTS = 7 * 3 * 2 * 4;     // 4 lâminas x 3 segmentos (tiras)
  const GRASS_INST = 200 * 200;
  V.GRASS_INST = GRASS_INST;

  // uniformes de culling por vista: planos (6 vec4) + câmera + params
  const cu = new Float32Array(VIEWS * 64);
  function writeCullUniforms() {
    const R = RENDER;
    for (let v = 0; v < VIEWS; v++) {
      const o = v * 64;
      let fr, cx, cy, cz, kind;
      if (v === 0) { fr = R.frustumMain; cx = R.cam.x; cy = R.cam.y; cz = R.cam.z; kind = 0; }
      else if (v < 5) { fr = R.frustumShadow[v - 1]; cx = R.cam.x; cy = R.cam.y; cz = R.cam.z; kind = 1; }
      else { fr = R.frustumCube[v - 5]; cx = R.viewData[v * 128 + 80]; cy = R.viewData[v * 128 + 81]; cz = R.viewData[v * 128 + 82]; kind = 2; }
      for (let i = 0; i < 24; i++) cu[o + i] = fr[i];
      cu[o + 24] = cx; cu[o + 25] = cy; cu[o + 26] = cz; cu[o + 27] = kind;
      // distâncias de LOD (escala por fov) e alcance máximo
      const fovS = Math.tan(R.cam.fovy * 0.5) / Math.tan(0.36);
      cu[o + 28] = 27 * (kind === 0 ? 1 / fovS : 1); cu[o + 29] = 95 * (kind === 0 ? 1 / fovS : 1);
      cu[o + 30] = kind === 1 ? (v === 1 ? 30 : v === 2 ? 80 : v === 3 ? 200 : 330) : kind === 2 ? 220 : 1150;
      cu[o + 31] = kind === 1 ? (v - 1) : 0;
      // capacidade/base por lod+espécie
      cu[o + 32] = CAP[0]; cu[o + 33] = CAP[1]; cu[o + 34] = CAP[2]; cu[o + 35] = v;
    }
    R.device.queue.writeBuffer(cullUB, 0, cu);
  }
  V.encodeCull = (enc, cubeFace0, nCube) => {
    RENDER.device.queue.writeBuffer(argsBuf, 0, argsInit);
    RENDER.device.queue.writeBuffer(gArgs, 0, gArgsInit);
    const p = enc.beginComputePass(RENDER.cpDesc('cull'));
    p.setPipeline(cullPipe);
    const wg = Math.ceil(nTrees / 64);
    for (let v = 0; v < VIEWS; v++) {
      if (v >= 1 && v <= 4 && !RENDER.shadowUpdated[v - 1]) continue;
      if (v >= 5 && (v - 5 < cubeFace0 || v - 5 >= cubeFace0 + nCube)) continue;
      p.setBindGroup(0, cullBG[v]);
      p.dispatchWorkgroups(wg);
    }
    p.setPipeline(gCullPipe); p.setBindGroup(0, gCullBG); p.dispatchWorkgroups(25, 25);
    p.end();
  };
  return V;
})();
