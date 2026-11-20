// ---------------------------------------------------------------------------
// cargfx.js — malhas do carro na GPU, vidro, matrizes por quadro (sem alocação)
// slots de objeto: 1 carroceria, 2..5 rodas (DE, DD, TE, TD), 6 volante
// ---------------------------------------------------------------------------
'use strict';

const CARGFX = (() => {
  const C = {};
  let glassPipe, glassBG, glassMesh, bodyMesh;
  const M = { chassis: new Float32Array(16), body: new Float32Array(16), t: new Float32Array(16), t2: new Float32Array(16), w: new Float32Array(16) };
  const prev = [];
  for (let i = 0; i < 8; i++) prev.push(new Float32Array(16));
  const cur = [];
  for (let i = 0; i < 8; i++) cur.push(new Float32Array(16));
  let first = true, first2 = true;
  const lastSpin = new Float64Array(4), prevSpinV = new Float64Array(4), prevChassis = new Float32Array(16);
  const wheelPrev = []; for (let i = 0; i < 4; i++) wheelPrev.push(new Float32Array(16));
  C.ready = false;

  C.init = async () => {
    const R = RENDER, device = R.device;
    const parts = await CARMODEL.build(device);
    const bp = parts.body.pack();
    bodyMesh = R.addMesh(bp, { name: 'car', obj: 1, cube: false, maxShadowCascade: 0 });
    if (parts.proxy) { const pp = parts.proxy.pack(); R.addMesh(pp, { name: 'carShadow', obj: 1, cube: false, main: false, minShadowCascade: 1, maxShadowCascade: 3 }); C.stats2 = pp.count / 3; }
    const wR = parts.wheelR.pack(), wL = parts.wheelL.pack();
    const mFL = R.addMesh(wL, { name: 'wFL', obj: 2, cube: false, maxShadowCascade: 1 });
    R.addMeshShared(mFL, { name: 'wRL', obj: 4 });
    const mFR = R.addMesh(wR, { name: 'wFR', obj: 3, cube: false, maxShadowCascade: 1 });
    R.addMeshShared(mFR, { name: 'wRR', obj: 5 });
    R.addMesh(parts.steer.pack(), { name: 'steer', obj: 6, cube: false, maxShadowCascade: 0 });
    const gp = parts.glass.pack();
    glassMesh = { vb: device.createBuffer({ size: gp.vb.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }), ib: device.createBuffer({ size: gp.ib.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST }), count: gp.count };
    device.queue.writeBuffer(glassMesh.vb, 0, gp.vb); device.queue.writeBuffer(glassMesh.ib, 0, gp.ib);
    C.stats = { bodyVerts: bp.nverts, bodyTris: bp.count / 3 };
    // pipeline do vidro
    const gbgl = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: 'cube' } }] });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [R.sceneBGL, R.objBGL, gbgl] });
    const dual = R.hasDual;
    const code = (dual ? 'enable dual_source_blending;\n' : '') + R.S('common', 'scene', 'mesh', 'car_shape', 'car_mat') + '\n' + (dual ? SHADERS.glass : SHADERS.glass.replace(/@blend_src\(\d\) /g, '').replace('@location(0) @blend_src(1) trans', '@location(1) trans'));
    const mod = R.shader(code, 'glass');
    const blend = dual ? { color: { srcFactor: 'one', dstFactor: 'src1', operation: 'add' }, alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' } }
      : { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } };
    glassPipe = device.createRenderPipeline({ layout, vertex: { module: mod, entryPoint: 'vsMesh', buffers: R.VB_LAYOUT },
      fragment: { module: mod, entryPoint: 'fsGlass', targets: [{ format: 'rgba16float', blend }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' }, depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater' } });
    glassBG = device.createBindGroup({ layout: gbgl, entries: [{ binding: 0, resource: R.cubeTex.createView({ dimension: 'cube' }) }] });
    const prevFwd = R.drawForward;
    R.drawForward = (pass, sceneBG, off) => {
      if (prevFwd) prevFwd(pass, sceneBG, off);
      if (!C.visible) return;
      pass.setPipeline(glassPipe);
      pass.setBindGroup(0, sceneBG, off);
      pass.setBindGroup(1, R.objBG(), R.dynObj[1]);
      pass.setBindGroup(2, glassBG);
      pass.setVertexBuffer(0, glassMesh.vb); pass.setIndexBuffer(glassMesh.ib, 'uint32');
      pass.drawIndexed(glassMesh.count);
    };
    C.ready = true; C.visible = true;
  };

  // pose: {x,y,z, fx,fy,fz (frente), ux,uy,uz (cima), roll, pitch, steer, spin[4], drop[4], brake, reverse}
  function rotAxisInto(o, ax, ay, az, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    o[0] = t * ax * ax + c; o[1] = t * ax * ay + s * az; o[2] = t * ax * az - s * ay; o[3] = 0;
    o[4] = t * ax * ay - s * az; o[5] = t * ay * ay + c; o[6] = t * ay * az + s * ax; o[7] = 0;
    o[8] = t * ax * az + s * ay; o[9] = t * ay * az - s * ax; o[10] = t * az * az + c; o[11] = 0;
    o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
  }
  C.update = (p, cut) => {
    // chassi: base (frente=X, cima=Y, direita=Z)
    const fx = p.fx, fy = p.fy, fz = p.fz, ux = p.ux, uy = p.uy, uz = p.uz;
    const rx = fy * uz - fz * uy, ry = fz * ux - fx * uz, rz = fx * uy - fy * ux;
    M4.fromBasis(M.chassis, fx, fy, fz, ux, uy, uz, rx, ry, rz, p.x, p.y, p.z);
    // carroceria: rolagem em X e arfagem em Z em torno do CG
    const cg = CARDIM.cgH;
    rotAxisInto(M.t, 1, 0, 0, p.roll);
    rotAxisInto(M.t2, 0, 0, 1, p.pitch);
    M4.mul(M.w, M.t, M.t2);
    M.w[12] = -(M.w[4] * cg) + 0; M.w[13] = cg - M.w[5] * cg + (p.heave || 0); M.w[14] = -(M.w[6] * cg);
    M4.mul(cur[1], M.chassis, M.w);
    // volante
    const sp = CARMODEL.steerPivot;
    rotAxisInto(M.t, 0, 0, 1, -sp.tilt);
    M.t[12] = sp.x; M.t[13] = sp.y; M.t[14] = sp.z;
    rotAxisInto(M.t2, 1, 0, 0, -p.steer * 7.5);
    M4.mul(M.w, M.t, M.t2);
    M4.mul(cur[6], cur[1], M.w);
    // rodas
    for (let k = 0; k < 4; k++) {
      const front = k < 2, right = (k & 1) === 1;
      // giro anterior "virtual": só 12% do giro do quadro entra no vetor de movimento
      // (o borrão linear de um giro rápido espalharia o pneu pelo asfalto)
      let dsp = p.spin[k] - lastSpin[k]; while (dsp > Math.PI) dsp -= TAU; while (dsp < -Math.PI) dsp += TAU;
      lastSpin[k] = p.spin[k];
      prevSpinV[k] = p.spin[k] - dsp * 0.35;
      const wx = front ? CARDIM.axleF : CARDIM.axleR;
      const wz = (right ? 1 : -1) * (front ? CARDIM.trackF : CARDIM.trackR) / 2;
      const steer = front ? p.steer * (1 + (right ? -1 : 1) * p.steer * 0.12) : 0;
      rotAxisInto(M.t, 0, 1, 0, steer);
      rotAxisInto(M.t2, 0, 0, 1, -p.spin[k]);
      M4.mul(M.w, M.t, M.t2);
      M.w[12] = wx; M.w[13] = CARDIM.wheelR + p.drop[k]; M.w[14] = wz;
      M4.mul(cur[2 + k], M.chassis, M.w);
      // matriz anterior com o giro virtual (sobre o chassi anterior)
      rotAxisInto(M.t2, 0, 0, 1, -prevSpinV[k]);
      M4.mul(M.w, M.t, M.t2);
      M.w[12] = wx; M.w[13] = CARDIM.wheelR + p.drop[k]; M.w[14] = wz;
      M4.mul(wheelPrev[k], prevChassis, M.w);
    }
    if (first || cut) { for (let i = 1; i <= 6; i++) M4.copy(prev[i], cur[i]); first = false; }
    const R = RENDER;
    R.setObj(1, cur[1], prev[1], p.brake, p.reverse, p.lights || 0, 0);
    for (let k = 0; k < 4; k++) R.setObj(2 + k, cur[2 + k], (first2 || cut) ? cur[2 + k] : wheelPrev[k], 0, 0, 0, 0);
    first2 = false;
    M4.copy(prevChassis, M.chassis);
    R.setObj(6, cur[6], prev[6], 0, 0, 0, 0);
    for (let i = 1; i <= 6; i++) M4.copy(prev[i], cur[i]);
  };
  return C;
})();
