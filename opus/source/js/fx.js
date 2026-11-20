// ---------------------------------------------------------------------------
// fx.js — marcas de pneu (anel de quads) e fumaça (partículas) — sem alocação
// ---------------------------------------------------------------------------
'use strict';

const FX = (() => {
  const F = {};
  const MAXSEG = 6144, SEGF = 4 * 5;           // 4 vértices x (x,y,z,int,lat)
  const seg = new Float32Array(MAXSEG * SEGF);
  let segHead = 0, dirtyA = -1, dirtyB = -1, segCount = 0;
  const last = new Float64Array(4 * 3), lastOn = new Uint8Array(4), lastN = new Float64Array(4 * 2);
  const MAXP = 1024, PF = 8;                   // x,y,z,size,alpha,rot,seed,age
  const pos = new Float32Array(MAXP * 3), vel = new Float32Array(MAXP * 3), age = new Float32Array(MAXP), life = new Float32Array(MAXP), seedA = new Float32Array(MAXP), sz0 = new Float32Array(MAXP);
  let pHead = 0;
  const inst = new Float32Array(MAXP * PF);
  let nInst = 0;
  const rng = makeRng(99);
  let segBuf, segIB, instBuf, decalPipe, smokePipe, smokeBG;
  const emitAcc = new Float64Array(4);

  F.init = () => {
    const R = RENDER, device = R.device;
    segBuf = device.createBuffer({ size: seg.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    const ib = new Uint32Array(MAXSEG * 6);
    for (let i = 0; i < MAXSEG; i++) { const b = i * 4; ib.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6); }
    segIB = device.createBuffer({ size: ib.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(segIB, 0, ib);
    instBuf = device.createBuffer({ size: inst.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    const mod = R.shader(R.S('common', 'scene', 'fx'), 'fx');
    const layout = device.createPipelineLayout({ bindGroupLayouts: [R.sceneBGL, R.objBGL] });
    const T = R.GT;
    decalPipe = device.createRenderPipeline({ layout,
      vertex: { module: mod, entryPoint: 'vsDecal', buffers: [{ arrayStride: 20, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x2' }] }] },
      fragment: { module: mod, entryPoint: 'fsDecal', targets: [
        { format: T[0].format, blend: { color: { srcFactor: 'zero', dstFactor: 'src', operation: 'add' }, alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' } } },
        { format: T[1].format, writeMask: 0 }, { format: T[2].format, writeMask: 0 }, { format: T[3].format, writeMask: 0 }] },
      primitive: { cullMode: 'none' }, depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater' } });
    // fumaça: precisa ler a profundidade (atributo somente-leitura no passe forward)
    const sbgl = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } }] });
    const slayout = device.createPipelineLayout({ bindGroupLayouts: [R.sceneBGL, R.objBGL, sbgl] });
    smokePipe = device.createRenderPipeline({ layout: slayout,
      vertex: { module: mod, entryPoint: 'vsSmoke', buffers: [{ arrayStride: PF * 4, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }, { shaderLocation: 1, offset: 16, format: 'float32x4' }] }] },
      fragment: { module: mod, entryPoint: 'fsSmoke', targets: [{ format: 'rgba16float', blend: { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } }] },
      primitive: { topology: 'triangle-strip' }, depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater' } });
    const mkBG = () => { if (!R.tg().depth) return; smokeBG = device.createBindGroup({ layout: sbgl, entries: [{ binding: 0, resource: R.tg().depth.createView() }] }); };
    const prevResize = R.onResize; R.onResize = (d, tg) => { if (prevResize) prevResize(d, tg); mkBG(); };
    mkBG();
    const prevExtra = R.drawExtra;
    R.drawExtra = (pass, mode, sub, sceneBG, off) => {
      if (prevExtra) prevExtra(pass, mode, sub, sceneBG, off);
      if (mode !== 'gbuffer' || segCount === 0) return;
      pass.setPipeline(decalPipe); pass.setBindGroup(1, R.objBG(), R.dynObj[0]);
      pass.setVertexBuffer(0, segBuf); pass.setIndexBuffer(segIB, 'uint32');
      pass.drawIndexed(segCount * 6);
    };
    const prevFwd = R.drawForward;
    R.drawForward = (pass, sceneBG, off) => {
      if (prevFwd) prevFwd(pass, sceneBG, off);
      if (nInst === 0) return;
      pass.setPipeline(smokePipe); pass.setBindGroup(0, sceneBG, off); pass.setBindGroup(1, R.objBG(), R.dynObj[0]); pass.setBindGroup(2, smokeBG);
      pass.setVertexBuffer(0, instBuf); pass.draw(4, nInst);
    };
  };
  F.reset = () => {
    segHead = 0; segCount = 0; dirtyA = dirtyB = -1; lastOn.fill(0);
    age.fill(99); life.fill(0); nInst = 0;
  };
  function addSeg(k, x, y, z, intensity) {
    const lx = last[k * 3], ly = last[k * 3 + 1], lz = last[k * 3 + 2];
    let dx = x - lx, dz = z - lz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const w = 0.075;
    const nx = -dz * w, nz = dx * w;
    const pnx = lastOn[k] === 2 ? lastN[k * 2] : nx, pnz = lastOn[k] === 2 ? lastN[k * 2 + 1] : nz;
    const o = segHead * SEGF;
    const i0 = lastOn[k] === 2 ? intensity : 0;
    seg[o] = lx - pnx; seg[o + 1] = ly; seg[o + 2] = lz - pnz; seg[o + 3] = i0; seg[o + 4] = -1;
    seg[o + 5] = lx + pnx; seg[o + 6] = ly; seg[o + 7] = lz + pnz; seg[o + 8] = i0; seg[o + 9] = 1;
    seg[o + 10] = x + nx; seg[o + 11] = y; seg[o + 12] = z + nz; seg[o + 13] = intensity; seg[o + 14] = 1;
    seg[o + 15] = x - nx; seg[o + 16] = y; seg[o + 17] = z - nz; seg[o + 18] = intensity; seg[o + 19] = -1;
    lastN[k * 2] = nx; lastN[k * 2 + 1] = nz;
    if (dirtyA < 0) { dirtyA = segHead; dirtyB = segHead; } else dirtyB = segHead;
    segHead = (segHead + 1) % MAXSEG;
    if (segCount < MAXSEG) segCount++;
  }
  function emit(x, y, z, vx, vz, strength) {
    const i = pHead; pHead = (pHead + 1) % MAXP;
    pos[i * 3] = x + (rng() - 0.5) * 0.2; pos[i * 3 + 1] = y + 0.15; pos[i * 3 + 2] = z + (rng() - 0.5) * 0.2;
    vel[i * 3] = vx * 0.25 + (rng() - 0.5) * 1.2; vel[i * 3 + 1] = 0.5 + rng() * 0.7; vel[i * 3 + 2] = vz * 0.25 + (rng() - 0.5) * 1.2;
    age[i] = 0; life[i] = 1.3 + rng() * 1.2 * strength; seedA[i] = rng() * 100; sz0[i] = 0.25 + rng() * 0.25;
  }
  // chamado a cada passo de física
  F.simStep = (car, dt) => {
    const c = Math.cos(car.psi), s = Math.sin(car.psi);
    const vxw = c * car.u - s * car.v, vzw = s * car.u + c * car.v;
    for (let k = 0; k < 4; k++) {
      const sl = car.slip[k];
      const surf = car.surf[k];
      const x = car.wx[k], z = car.wz[k], y = car.wy[k] + 0.012;
      const marking = sl > 2.2 && surf <= 1 && Math.abs(car.u) > 1.0 && car.wetW[k] < 0.3;
      if (marking) {
        const inten = clamp((sl - 2.2) / 5, 0.15, 1);
        if (!lastOn[k]) { last[k * 3] = x; last[k * 3 + 1] = y; last[k * 3 + 2] = z; lastOn[k] = 1; }
        else {
          const d = Math.hypot(x - last[k * 3], z - last[k * 3 + 2]);
          if (d > 0.3) { addSeg(k, x, y, z, inten); last[k * 3] = x; last[k * 3 + 1] = y; last[k * 3 + 2] = z; lastOn[k] = 2; }
        }
      } else lastOn[k] = 0;
      // fumaça (pneu no asfalto) e poeira (grama/brita)
      const smokeAmt = (Math.abs(car.u) < 7 || (car.brk < 0.7 && car.hb < 0.3) ? 0 : 1) * (surf <= 1 ? clamp((sl - 9.0) / 8, 0, 1) : clamp((Math.abs(car.u) - 3) / 15, 0, 1) * 0.6) * (1 - clamp(car.wetW[k] * 3, 0, 1));
      if (smokeAmt > 0) {
        emitAcc[k] += smokeAmt * 75 * dt;
        while (emitAcc[k] >= 1) { emitAcc[k] -= 1; emit(x, y, z, vxw, vzw, smokeAmt); }
      }
    }
    for (let i = 0; i < MAXP; i++) {
      if (age[i] >= life[i]) continue;
      age[i] += dt;
      vel[i * 3] *= 1 - 1.2 * dt; vel[i * 3 + 2] *= 1 - 1.2 * dt; vel[i * 3 + 1] = vel[i * 3 + 1] * (1 - 0.8 * dt) + 0.25 * dt;
      pos[i * 3] += (vel[i * 3] + 0.6) * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += (vel[i * 3 + 2] + 0.4) * dt;
    }
  };
  // chamado por quadro: envia dados à GPU
  F.frame = (fs, dt) => {
    const dev = RENDER.device;
    if (dirtyA >= 0) {
      if (dirtyB >= dirtyA) dev.queue.writeBuffer(segBuf, dirtyA * SEGF * 4, seg, dirtyA * SEGF, (dirtyB - dirtyA + 1) * SEGF);
      else { dev.queue.writeBuffer(segBuf, dirtyA * SEGF * 4, seg, dirtyA * SEGF, (MAXSEG - dirtyA) * SEGF); dev.queue.writeBuffer(segBuf, 0, seg, 0, (dirtyB + 1) * SEGF); }
      dirtyA = dirtyB = -1;
    }
    nInst = 0;
    for (let i = 0; i < MAXP; i++) {
      if (age[i] >= life[i]) continue;
      const t = age[i] / life[i];
      const o = nInst * PF;
      inst[o] = pos[i * 3]; inst[o + 1] = pos[i * 3 + 1]; inst[o + 2] = pos[i * 3 + 2];
      inst[o + 3] = sz0[i] + age[i] * 1.3;
      inst[o + 4] = (1 - t) * Math.min(1, age[i] * 6) * 0.24;
      inst[o + 5] = seedA[i] + age[i] * 0.4; inst[o + 6] = seedA[i]; inst[o + 7] = t;
      nInst++;
    }
    if (nInst > 0) dev.queue.writeBuffer(instBuf, 0, inst, 0, nInst * PF);
  };
  // aquecimento: gera algumas partículas e marcas para compilar os pipelines antes da volta
  F.warm = (car) => {
    for (let i = 0; i < 40; i++) emit(car.x + 2, car.y, car.z, 0, 0, 1);
    for (let k = 0; k < 2; k++) { last[k * 3] = car.x; last[k * 3 + 1] = car.y + 0.01; last[k * 3 + 2] = car.z; lastOn[k] = 2; addSeg(k, car.x + 1, car.y + 0.01, car.z + 0.2, 0.5); }
  };
  F.stats = () => ({ segs: segCount, particles: nInst });
  return F;
})();
