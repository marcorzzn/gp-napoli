// ---------------------------------------------------------------------------
// renderer.js — WebGPU: bakes, G-buffer diferido, sombras em cascata, cubo de
// reflexo dinâmico, GTAO, volumétrico, TAA, desfoque de movimento, bloom
// Regra: nada de alocação no caminho por quadro (descritores reutilizados)
// ---------------------------------------------------------------------------
'use strict';

const RENDER = (() => {
  const R = {};
  let device, ctx, canvas, swapFormat;
  const VIEW_FLOATS = 128, VIEW_BYTES = 512, N_VIEWS = 12;   // 0 principal, 1-4 sombras, 5-10 cubo
  const OBJ_BYTES = 256, N_OBJ = 32;
  const SHADOW_RES = 3072, CUBE_RES = 384, CUBE_MIPS = 6;
  const G_FLOATS = 160;
  const viewData = new Float32Array(VIEW_FLOATS * N_VIEWS);
  const globData = new Float32Array(G_FLOATS);
  const objData = new Float32Array((OBJ_BYTES / 4) * N_OBJ);
  R.viewData = viewData; R.globData = globData; R.objData = objData;
  // matrizes temporárias (pré-alocadas)
  const tm = { a: new Float32Array(16), b: new Float32Array(16), c: new Float32Array(16), proj: new Float32Array(16), view: new Float32Array(16), vp: new Float32Array(16), vpNJ: new Float32Array(16), prevVP: new Float32Array(16), inv: new Float32Array(16) };
  const shadowVP = [new Float32Array(16), new Float32Array(16), new Float32Array(16), new Float32Array(16)];
  const cubeVP = []; for (let i = 0; i < 6; i++) cubeVP.push(new Float32Array(16));
  const frustum = new Float32Array(24);
  R.frustumMain = new Float32Array(24);
  R.frustumShadow = [new Float32Array(24), new Float32Array(24), new Float32Array(24), new Float32Array(24)];
  R.frustumCube = []; for (let i = 0; i < 6; i++) R.frustumCube.push(new Float32Array(24));
  const tmp3 = new Float32Array(3);

  R.W = 0; R.H = 0;
  R.frame = 0;
  R.stats = { gpuMs: 0, passes: null };
  R.sun = { az: 0, el: 0, dir: new Float32Array(3) };

  function shader(code, label) {
    const m = device.createShaderModule({ code, label });
    m.getCompilationInfo().then(info => {
      for (const msg of info.messages) if (msg.type === 'error') console.error(`[${label}] ${msg.lineNum}:${msg.linePos} ${msg.message}`);
    });
    return m;
  }
  const S = (...names) => names.map(n => SHADERS[n]).join('\n');

  // ------------------------------------------------------------------ init
  R.init = async (cv, opts) => {
    canvas = cv;
    if (!navigator.gpu) throw new Error('WebGPU indisponível neste navegador.');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('Sem adaptador WebGPU.');
    const feats = [];
    for (const f of ['timestamp-query', 'dual-source-blending', 'float32-filterable', 'rg11b10ufloat-renderable', 'indirect-first-instance']) if (adapter.features.has(f)) feats.push(f);
    R.hasTimestamps = adapter.features.has('timestamp-query');
    R.hasDual = adapter.features.has('dual-source-blending');
    device = await adapter.requestDevice({ requiredFeatures: feats, requiredLimits: { maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize, maxBufferSize: adapter.limits.maxBufferSize, maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize } });
    device.lost.then(i => console.error('device lost', i.message));
    device.onuncapturederror = (e) => { console.error('WebGPU:', e.error.message); R.lastError = e.error.message; };
    R.device = device;
    ctx = canvas.getContext('webgpu');
    swapFormat = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format: swapFormat, alphaMode: 'opaque' });
    createSamplers();
    createUniforms();
    await bakeAll();
    createScenePipelines();
    createPostPipelines();
    if (R.hasTimestamps) createTimestamps();
  };

  let sampLinRep, sampLinClamp, sampCmp, sampNearest;
  function createSamplers() {
    sampLinRep = device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', maxAnisotropy: 16 });
    sampLinClamp = device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    sampCmp = device.createSampler({ compare: 'greater-equal', magFilter: 'linear', minFilter: 'linear' });
    sampNearest = device.createSampler({});
  }
  let viewsBuf, globBuf, objBuf;
  function createUniforms() {
    viewsBuf = device.createBuffer({ size: VIEW_BYTES * N_VIEWS, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    globBuf = device.createBuffer({ size: G_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    objBuf = device.createBuffer({ size: OBJ_BYTES * N_OBJ, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    for (let i = 0; i < N_OBJ; i++) { const o = i * 64; M4.identity(objData.subarray(o, o + 16)); M4.identity(objData.subarray(o + 16, o + 32)); }
  }
  R.objMatrix = (slot) => objData.subarray(slot * 64, slot * 64 + 16);       // (só na carga)
  R.setObj = (slot, model, prevModel, p0, p1, p2, p3) => {
    const o = slot * 64;
    for (let i = 0; i < 16; i++) { objData[o + i] = model[i]; objData[o + 16 + i] = prevModel[i]; }
    objData[o + 32] = p0; objData[o + 33] = p1; objData[o + 34] = p2; objData[o + 35] = p3;
  };

  // ------------------------------------------------------------------ bakes
  let noise3D, skyHi, skyLo, shBuf, detailTex, leafAlb, leafNrm, maskTex, heightTex, textTex, tdBuf;
  async function bakeAll() {
    const t0 = performance.now();
    // ---- sol
    const el = 9.5 * Math.PI / 180, az = -38 * Math.PI / 180;     // az a partir de +X em direção a -Z
    R.sun.el = el; R.sun.az = az;
    R.sun.dir[0] = Math.cos(el) * Math.cos(az); R.sun.dir[1] = Math.sin(el); R.sun.dir[2] = Math.cos(el) * Math.sin(az);
    const bpBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const sunE = 22.0;
    const bp = new Float32Array([R.sun.dir[0], R.sun.dir[1], R.sun.dir[2], 0, sunE, sunE, sunE, 0, 0, 1e9, 0, 0, 0.30, 0.48, 0.85, 0]);
    device.queue.writeBuffer(bpBuf, 0, bp);
    // cor do sol no chão = iluminância * transmitância atmosférica (mesmo modelo do bake)
    {
      const RE = 6360e3, RA = 6460e3, BR = [5.802e-6, 13.558e-6, 33.1e-6], BO = [0.650e-6, 1.881e-6, 0.085e-6];
      const ro = [0, RE + 60, 0], sd = R.sun.dir;
      const b = ro[1] * sd[1], cc = ro[1] * ro[1] - RA * RA, tA = -b + Math.sqrt(b * b - cc);
      const od = [0, 0, 0], n = 200, dt = tA / n;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) * dt, p = [sd[0] * t, ro[1] + sd[1] * t, sd[2] * t];
        const h = Math.hypot(p[0], p[1], p[2]) - RE;
        const dr = Math.exp(-h / 8000), dm = Math.exp(-h / 1200) + 0.6 * Math.exp(-h / 380), dO = Math.max(0, 1 - Math.abs(h - 25000) / 15000);
        for (let k = 0; k < 3; k++) od[k] += (BR[k] * dr + 4.4e-6 * dm + BO[k] * dO) * dt;
      }
      for (let k = 0; k < 3; k++) R.sunColor[k] = sunE * Math.exp(-od[k]);
      // dessaturação parcial (sol dourado sem virar laranja)
      const lum = 0.2126 * R.sunColor[0] + 0.7152 * R.sunColor[1] + 0.0722 * R.sunColor[2];
      for (let k = 0; k < 3; k++) R.sunColor[k] = R.sunColor[k] * 0.62 + lum * 0.38;
    }
    const skyMod = shader(S('common', 'sky_bake'), 'sky_bake');
    // ---- ruído 3D
    noise3D = device.createTexture({ size: [128, 128, 128], dimension: '3d', format: 'rgba8unorm', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    {
      const p = device.createComputePipeline({ layout: 'auto', compute: { module: skyMod, entryPoint: 'csNoise3D' } });
      const bg = device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [{ binding: 1, resource: noise3D.createView() }] });
      const e = device.createCommandEncoder(); const c = e.beginComputePass(); c.setPipeline(p); c.setBindGroup(0, bg); c.dispatchWorkgroups(32, 32, 32); c.end(); device.queue.submit([e.finish()]);
    }
    // ---- panorama alto
    const HI_W = 6144, HI_H = 1280;
    skyHi = device.createTexture({ size: [HI_W, HI_H], format: 'rgba16float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    {
      const p = device.createComputePipeline({ layout: 'auto', compute: { module: skyMod, entryPoint: 'csSkyHi' } });
      const sampN3 = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', addressModeW: 'repeat' });
      const rowsPer = 64;
      for (let r0 = 0; r0 < HI_H; r0 += rowsPer) {
        const ub = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        const b2 = bp.slice(); b2[8] = r0; b2[9] = r0 + rowsPer;
        device.queue.writeBuffer(ub, 0, b2);
        const bg = device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: ub } }, { binding: 2, resource: noise3D.createView() }, { binding: 3, resource: sampN3 }, { binding: 4, resource: skyHi.createView() }] });
        const e = device.createCommandEncoder(); const c = e.beginComputePass(); c.setPipeline(p); c.setBindGroup(0, bg); c.dispatchWorkgroups(HI_W / 8, rowsPer / 8); c.end(); device.queue.submit([e.finish()]);
        await device.queue.onSubmittedWorkDone();
      }
    }
    // ---- panorama baixo + mips
    const LO_W = 512, LO_H = 256, LO_MIPS = 7;
    skyLo = device.createTexture({ size: [LO_W, LO_H], format: 'rgba16float', mipLevelCount: LO_MIPS, usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    {
      const p = device.createComputePipeline({ layout: 'auto', compute: { module: skyMod, entryPoint: 'csSkyLo' } });
      const bg = device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: bpBuf } }, { binding: 2, resource: noise3D.createView() }, { binding: 3, resource: sampLinRep }, { binding: 5, resource: skyHi.createView() }, { binding: 6, resource: skyLo.createView({ baseMipLevel: 0, mipLevelCount: 1 }) }] });
      const e = device.createCommandEncoder(); const c = e.beginComputePass(); c.setPipeline(p); c.setBindGroup(0, bg); c.dispatchWorkgroups(LO_W / 8, LO_H / 8); c.end(); device.queue.submit([e.finish()]);
    }
    mipChainF16(skyLo, LO_W, LO_H, LO_MIPS, 1, true);
    // ---- SH
    shBuf = device.createBuffer({ size: 144, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    {
      const p = device.createComputePipeline({ layout: 'auto', compute: { module: skyMod, entryPoint: 'csSH' } });
      const bg = device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
        { binding: 3, resource: sampLinRep }, { binding: 7, resource: skyLo.createView() }, { binding: 8, resource: { buffer: shBuf } }] });
      const e = device.createCommandEncoder(); const c = e.beginComputePass(); c.setPipeline(p); c.setBindGroup(0, bg); c.dispatchWorkgroups(1); c.end();
      e.copyBufferToBuffer(shBuf, 0, globBuf, 120 * 4, 144);
      device.queue.submit([e.finish()]);
    }
    // ---- texturas de detalhe
    const texMod = shader(S('common', 'bake_tex'), 'bake_tex');
    const DL = 10;
    detailTex = device.createTexture({ size: [1024, 1024, DL], format: 'rgba8unorm', mipLevelCount: 11, usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    {
      const p = device.createComputePipeline({ layout: 'auto', compute: { module: texMod, entryPoint: 'csDetail' } });
      for (let l = 0; l < DL; l++) {
        const ub = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(ub, 0, new Uint32Array([l, 0, 0, 0]));
        const bg = device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ub } }, { binding: 1, resource: detailTex.createView({ dimension: '2d-array', baseMipLevel: 0, mipLevelCount: 1 }) }] });
        const e = device.createCommandEncoder(); const c = e.beginComputePass(); c.setPipeline(p); c.setBindGroup(0, bg); c.dispatchWorkgroups(128, 128); c.end(); device.queue.submit([e.finish()]);
      }
    }
    mipChain8(texMod, detailTex, 1024, 11, DL, 0);
    // ---- atlas de folhas
    leafAlb = device.createTexture({ size: [4096, 4096, 1], format: 'rgba8unorm', mipLevelCount: 13, usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    leafNrm = device.createTexture({ size: [4096, 4096, 1], format: 'rgba8unorm', mipLevelCount: 13, usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    {
      const p = device.createComputePipeline({ layout: 'auto', compute: { module: texMod, entryPoint: 'csLeaves' } });
      const bg = device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
        { binding: 2, resource: leafAlb.createView({ dimension: '2d', baseMipLevel: 0, mipLevelCount: 1, baseArrayLayer: 0, arrayLayerCount: 1 }) },
        { binding: 3, resource: leafNrm.createView({ dimension: '2d', baseMipLevel: 0, mipLevelCount: 1, baseArrayLayer: 0, arrayLayerCount: 1 }) }] });
      const e = device.createCommandEncoder(); const c = e.beginComputePass(); c.setPipeline(p); c.setBindGroup(0, bg); c.dispatchWorkgroups(512, 512); c.end(); device.queue.submit([e.finish()]);
    }
    mipChain8(texMod, leafAlb, 4096, 13, 1, 1);
    mipChain8(texMod, leafNrm, 4096, 13, 1, 0);
    // ---- máscara do terreno e alturas
    maskTex = device.createTexture({ size: [TERRAIN.R1, TERRAIN.R1], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    device.queue.writeTexture({ texture: maskTex }, TERRAIN.MASK, { bytesPerRow: TERRAIN.R1 * 4 }, [TERRAIN.R1, TERRAIN.R1]);
    heightTex = device.createTexture({ size: [TERRAIN.HN, TERRAIN.HN], format: 'r32float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    device.queue.writeTexture({ texture: heightTex }, TERRAIN.H, { bytesPerRow: TERRAIN.HN * 4 }, [TERRAIN.HN, TERRAIN.HN]);
    // ---- dados da pista
    const N = TRACK.N, td = new Float32Array(N * 8);
    for (let i = 0; i < N; i++) {
      td[i * 8] = TRACK.hw[i]; td[i * 8 + 1] = TRACK.racing[i]; td[i * 8 + 2] = TRACK.wet[i]; td[i * 8 + 3] = TRACK.brake ? TRACK.brake[i] : 0;
      td[i * 8 + 4] = TRACK.kerbL[i]; td[i * 8 + 5] = TRACK.kerbR[i]; td[i * 8 + 6] = TRACK.gravL[i]; td[i * 8 + 7] = TRACK.gravR[i];
    }
    tdBuf = device.createBuffer({ size: td.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(tdBuf, 0, td);
    // ---- atlas de texto (HUD, emblemas, placas)
    textTex = makeTextAtlas();
    await device.queue.onSubmittedWorkDone();
    R.bakeMs = performance.now() - t0;
  }
  function mipChain8(mod, tex, size, mips, layers, mode) {
    const p = device.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'csMip' } });
    const ub = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(ub, 0, new Uint32Array([mode, 0, 0, 0]));
    const e = device.createCommandEncoder();
    for (let m = 1; m < mips; m++) {
      const s = Math.max(1, size >> m);
      const bg = device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
        { binding: 0, resource: tex.createView({ dimension: '2d-array', baseMipLevel: m - 1, mipLevelCount: 1 }) },
        { binding: 1, resource: tex.createView({ dimension: '2d-array', baseMipLevel: m, mipLevelCount: 1 }) },
        { binding: 2, resource: { buffer: ub } }] });
      const c = e.beginComputePass(); c.setPipeline(p); c.setBindGroup(0, bg); c.dispatchWorkgroups(Math.ceil(s / 8), Math.ceil(s / 8), layers); c.end();
    }
    device.queue.submit([e.finish()]);
  }
  let mipF16Pipe = null;
  function mipF16Module() {
    return shader(`
@group(0) @binding(0) var src: texture_2d_array<f32>;
@group(0) @binding(1) var dst: texture_storage_2d_array<rgba16float, write>;
@compute @workgroup_size(8, 8)
fn csMipF16(@builtin(global_invocation_id) id: vec3u) {
  let dd = textureDimensions(dst);
  if (id.x >= dd.x || id.y >= dd.y) { return; }
  let sd = vec2i(textureDimensions(src));
  let b = vec2i(id.xy) * 2; let l = i32(id.z);
  var r = vec4f(0.0);
  for (var y = -1; y <= 2; y++) { for (var x = -1; x <= 2; x++) {
    let w = select(1.0, 3.0, x >= 0 && x <= 1) * select(1.0, 3.0, y >= 0 && y <= 1);
    var p = b + vec2i(x, y);
    p.x = (p.x + sd.x) % sd.x; p = clamp(p, vec2i(0), sd - 1);
    r += textureLoad(src, p, l, 0) * w;
  } }
  textureStore(dst, id.xy, l, r / 64.0);
}`, 'mipF16');
  }
  function mipChainF16(tex, w, h, mips, layers, encOrNull) {
    if (!mipF16Pipe) mipF16Pipe = device.createComputePipeline({ layout: 'auto', compute: { module: mipF16Module(), entryPoint: 'csMipF16' } });
    const e = device.createCommandEncoder();
    for (let m = 1; m < mips; m++) {
      const bg = device.createBindGroup({ layout: mipF16Pipe.getBindGroupLayout(0), entries: [
        { binding: 0, resource: tex.createView({ dimension: '2d-array', baseMipLevel: m - 1, mipLevelCount: 1 }) },
        { binding: 1, resource: tex.createView({ dimension: '2d-array', baseMipLevel: m, mipLevelCount: 1 }) }] });
      const c = e.beginComputePass(); c.setPipeline(mipF16Pipe); c.setBindGroup(0, bg);
      c.dispatchWorkgroups(Math.ceil(Math.max(1, w >> m) / 8), Math.ceil(Math.max(1, h >> m) / 8), layers); c.end();
    }
    device.queue.submit([e.finish()]);
  }
  function makeTextAtlas() {
    // 1024x512: linha 0 = glifos do HUD (64x96), restante = emblemas/placas
    const W = 1024, H = 512;
    const cv = new OffscreenCanvas(W, H), g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'center';
    const glyphs = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'k', 'm', '/', 'h', ':', '.'];
    g.font = '600 78px "Helvetica Neue", Helvetica, Arial, sans-serif';
    for (let i = 0; i < glyphs.length; i++) g.fillText(glyphs[i], i * 64 + 32, 50);
    // emblemas (canal R = máscara do texto). y=96..: "Mille EP" itálico, "FIAT", placa
    g.textAlign = 'left';
    g.font = 'italic 700 64px "Helvetica Neue", Helvetica, Arial, sans-serif';
    g.fillText('Mille', 16, 140);
    g.font = 'italic 800 64px "Helvetica Neue", Helvetica, Arial, sans-serif';
    g.fillText('EP', 190, 140);
    g.font = '800 60px "Helvetica Neue", Helvetica, Arial, sans-serif';
    g.fillText('F I A T', 16, 210);
    // placa: fundo cinza claro com caracteres (canal G = fundo da placa)
    g.font = '700 84px "DIN Alternate", "Helvetica Neue", Arial, sans-serif';
    g.fillText('MLE-1996', 20, 300);
    g.fillText('UNO 4421', 20, 400);
    const img = g.getImageData(0, 0, W, H);
    const tex = device.createTexture({ size: [W, H], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    device.queue.writeTexture({ texture: tex }, img.data, { bytesPerRow: W * 4 }, [W, H]);
    return tex;
  }

  // ------------------------------------------------------------------ cena
  let sceneBGL, objBGL, sceneBG, sceneBGShadow, objBG, dummyShadow;
  let shadowTex, shadowViews = [], cubeTex, cubeDepth, cubeFaceViews = [];
  let pipes = {};
  const meshes = [];   // {vb, ib, count, kind:'static'|'car', obj, shadow, cube}
  R.meshes = meshes;
  const VB_LAYOUT = [{ arrayStride: 32, attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'snorm16x4' },
    { shaderLocation: 2, offset: 20, format: 'float32x2' }, { shaderLocation: 3, offset: 28, format: 'uint8x4' }] }];
  R.VB_LAYOUT = VB_LAYOUT;

  function createScenePipelines() {
    const VFC = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE;
    const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    sceneBGL = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: VFC, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 416 } },
      { binding: 1, visibility: VFC, buffer: { type: 'uniform' } },
      { binding: 2, visibility: VF, sampler: { type: 'filtering' } },
      { binding: 3, visibility: VF, texture: { sampleType: 'float', viewDimension: '2d-array' } },
      { binding: 4, visibility: VF, texture: { sampleType: 'float', viewDimension: '2d-array' } },
      { binding: 5, visibility: VF, texture: { sampleType: 'float', viewDimension: '2d-array' } },
      { binding: 6, visibility: VF, texture: { sampleType: 'float' } },
      { binding: 7, visibility: VF, buffer: { type: 'read-only-storage' } },
      { binding: 8, visibility: VF, texture: { sampleType: 'float' } },
      { binding: 9, visibility: VF, sampler: { type: 'filtering' } },
      { binding: 10, visibility: VF, texture: { sampleType: 'unfilterable-float' } },
      { binding: 11, visibility: VF, texture: { sampleType: 'float' } },
      { binding: 12, visibility: VF, texture: { sampleType: 'depth', viewDimension: '2d-array' } },
      { binding: 13, visibility: VF, sampler: { type: 'comparison' } },
    ] });
    objBGL = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: VF, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 160 } }] });
    shadowTex = device.createTexture({ size: [SHADOW_RES, SHADOW_RES, 4], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    for (let i = 0; i < 4; i++) shadowViews.push(shadowTex.createView({ dimension: '2d', baseArrayLayer: i, arrayLayerCount: 1 }));
    dummyShadow = device.createTexture({ size: [4, 4, 4], format: 'depth32float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT });
    cubeTex = device.createTexture({ size: [CUBE_RES, CUBE_RES, 6], format: 'rgba16float', mipLevelCount: CUBE_MIPS, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING });
    cubeDepth = device.createTexture({ size: [CUBE_RES, CUBE_RES], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT });
    for (let i = 0; i < 6; i++) cubeFaceViews.push(cubeTex.createView({ dimension: '2d', baseArrayLayer: i, arrayLayerCount: 1, baseMipLevel: 0, mipLevelCount: 1 }));
    const mkSceneBG = (sh) => device.createBindGroup({ layout: sceneBGL, entries: [
      { binding: 0, resource: { buffer: viewsBuf, size: 416 } }, { binding: 1, resource: { buffer: globBuf } },
      { binding: 2, resource: sampLinRep }, { binding: 3, resource: detailTex.createView({ dimension: '2d-array' }) },
      { binding: 4, resource: leafAlb.createView({ dimension: '2d-array' }) }, { binding: 5, resource: leafNrm.createView({ dimension: '2d-array' }) },
      { binding: 6, resource: maskTex.createView() }, { binding: 7, resource: { buffer: tdBuf } }, { binding: 8, resource: textTex.createView() },
      { binding: 9, resource: sampLinClamp }, { binding: 10, resource: heightTex.createView() }, { binding: 11, resource: skyLo.createView() },
      { binding: 12, resource: sh.createView({ dimension: '2d-array' }) }, { binding: 13, resource: sampCmp }] });
    sceneBG = mkSceneBG(shadowTex);
    sceneBGShadow = mkSceneBG(dummyShadow);
    objBG = device.createBindGroup({ layout: objBGL, entries: [{ binding: 0, resource: { buffer: objBuf, size: 160 } }] });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [sceneBGL, objBGL] });
    R.sceneLayout = layout; R.globBuf = globBuf; R.maskTex = maskTex; R.heightTex = heightTex; R.sampLinClamp = sampLinClamp; R.sceneBGL = sceneBGL; R.objBGL = objBGL; R.cubeTex = cubeTex; R.shader = shader; R.S = S;
    const meshMod = shader(S('common', 'scene', 'mesh', 'car_shape', 'car_mat'), 'mesh');
    const GT = [{ format: 'rgba8unorm-srgb' }, { format: 'rgba16float' }, { format: 'rgba8unorm' }, { format: 'rg16float' }];
    R.GT = GT;
    const dsG = { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' };
    pipes.meshG = device.createRenderPipeline({ layout, vertex: { module: meshMod, entryPoint: 'vsMesh', buffers: VB_LAYOUT },
      fragment: { module: meshMod, entryPoint: 'fsMeshG', targets: GT }, primitive: { topology: 'triangle-list', cullMode: 'none' }, depthStencil: dsG });
    pipes.meshShadow = device.createRenderPipeline({ layout, vertex: { module: meshMod, entryPoint: 'vsMeshShadow', buffers: VB_LAYOUT },
      primitive: { topology: 'triangle-list', cullMode: 'none' }, depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater', depthBias: -2, depthBiasSlopeScale: -2.0 } });
    pipes.meshCube = device.createRenderPipeline({ layout, vertex: { module: meshMod, entryPoint: 'vsMesh', buffers: VB_LAYOUT },
      fragment: { module: meshMod, entryPoint: 'fsMeshCube', targets: [{ format: 'rgba16float' }] }, primitive: { topology: 'triangle-list', cullMode: 'none' }, depthStencil: dsG });
    // céu no cubo
    const skyCubeMod = shader(S('common', 'scene') + `
struct SkyO { @builtin(position) p: vec4f, @location(0) ndc: vec2f };
@vertex fn vsSky(@builtin(vertex_index) i: u32) -> SkyO {
  var o: SkyO; let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  o.p = vec4f(p, 0.0, 1.0); o.ndc = p; return o; }
@fragment fn fsSky(i: SkyO) -> @location(0) vec4f {
  let w = V.invViewProj * vec4f(i.ndc, 0.5, 1.0);
  let d = normalize(w.xyz / w.w - V.camPos.xyz);
  return vec4f(skyLo(d, 0.0), 1.0); }`, 'skycube');
    pipes.skyCube = device.createRenderPipeline({ layout, vertex: { module: skyCubeMod, entryPoint: 'vsSky' },
      fragment: { module: skyCubeMod, entryPoint: 'fsSky', targets: [{ format: 'rgba16float' }] }, primitive: { topology: 'triangle-list' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'always' } });
    if (R.onScenePipelines) R.onScenePipelines(device, layout, shader, S);
  }

  // registra malha estática/dinâmica
  R.addMesh = (packed, opts) => {
    const vb = device.createBuffer({ size: packed.vb.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(vb, 0, packed.vb);
    const ib = device.createBuffer({ size: packed.ib.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(ib, 0, packed.ib);
    const m = { vb, ib, count: opts.count || packed.count, first: opts.first || 0, obj: opts.obj || 0, shadow: opts.shadow !== false, cube: opts.cube !== false,
      main: opts.main !== false, maxShadowCascade: opts.maxShadowCascade ?? 3, minShadowCascade: opts.minShadowCascade || 0, name: opts.name || '', min: packed.min, max: packed.max, visible: true };
    meshes.push(m);
    return m;
  };
  R.addMeshShared = (base, opts) => {
    const m = Object.assign({}, base, opts);
    meshes.push(m); return m;
  };

  // ------------------------------------------------------------------ alvos de tela
  let tg = {};
  R.resize = (W, H) => {
    if (W === R.W && H === R.H) return;
    R.W = W; R.H = H;
    canvas.width = W; canvas.height = H;
    for (const k in tg) if (tg[k] && tg[k].destroy) tg[k].destroy();
    const RT = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
    const ST = GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING;
    tg.alb = device.createTexture({ size: [W, H], format: 'rgba8unorm-srgb', usage: RT });
    tg.nrm = device.createTexture({ size: [W, H], format: 'rgba16float', usage: RT });
    tg.misc = device.createTexture({ size: [W, H], format: 'rgba8unorm', usage: RT });
    tg.vel = device.createTexture({ size: [W, H], format: 'rg16float', usage: RT });
    tg.depth = device.createTexture({ size: [W, H], format: 'depth32float', usage: RT });
    tg.hdr = device.createTexture({ size: [W, H], format: 'rgba16float', usage: RT | ST });
    tg.hist0 = device.createTexture({ size: [W, H], format: 'rgba16float', usage: ST });
    tg.hist1 = device.createTexture({ size: [W, H], format: 'rgba16float', usage: ST });
    tg.mb = device.createTexture({ size: [W, H], format: 'rgba16float', usage: ST });
    const hw = Math.ceil(W / 2), hh = Math.ceil(H / 2);
    tg.ao0 = device.createTexture({ size: [hw, hh], format: 'rgba16float', usage: ST });
    tg.ao1 = device.createTexture({ size: [hw, hh], format: 'rgba16float', usage: ST });
    tg.vol = device.createTexture({ size: [hw, hh], format: 'rgba16float', usage: ST });
    const tw = Math.ceil(W / 16), th = Math.ceil(H / 16);
    tg.tile = device.createTexture({ size: [tw, th], format: 'rgba16float', usage: ST });
    tg.nb = device.createTexture({ size: [tw, th], format: 'rgba16float', usage: ST });
    tg.bd = []; tg.bu = [];
    for (let i = 0; i < 6; i++) {
      const w = Math.max(1, Math.ceil(W / (2 << i))), h = Math.max(1, Math.ceil(H / (2 << i)));
      tg.bd.push(device.createTexture({ size: [w, h], format: 'rgba16float', usage: ST }));
      if (i < 5) tg.bu.push(device.createTexture({ size: [w, h], format: 'rgba16float', usage: ST }));
    }
    buildFrameDescriptors();
    buildPostBindGroups();
  };

  // ------------------------------------------------------------------ pós
  let post = {};
  function createPostPipelines() {
    const mk = (mod, ep) => device.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: ep } });
    const lightMod = shader(S('common', 'lighting'), 'lighting');
    post.light = mk(lightMod, 'csLight');
    const aoMod = shader(S('common', 'ao'), 'ao');
    post.ao = mk(aoMod, 'csAO'); post.aoBlur = mk(aoMod, 'csAOBlur');
    const volMod = shader(S('common', 'volumetric'), 'vol');
    post.vol = mk(volMod, 'csVol');
    const taaMod = shader(S('common', 'taa'), 'taa');
    post.taa = mk(taaMod, 'csTAA');
    const mbMod = shader(S('common', 'motionblur'), 'mb');
    post.tile = mk(mbMod, 'csTileMax'); post.nb = mk(mbMod, 'csNeighborMax'); post.mb = mk(mbMod, 'csMotionBlur');
    const blMod = shader(S('common', 'bloom'), 'bloom');
    post.down = mk(blMod, 'csDown'); post.up = mk(blMod, 'csUp');
    const toneMod = shader(S('common', 'tonemap'), 'tone');
    post.tone = device.createRenderPipeline({ layout: 'auto', vertex: { module: toneMod, entryPoint: 'vsFull' },
      fragment: { module: toneMod, entryPoint: 'fsTone', targets: [{ format: swapFormat }] }, primitive: { topology: 'triangle-list' } });
    // mips do cubo
    post.cubeMip = mk(shader(`
@group(0) @binding(0) var src: texture_2d_array<f32>;
@group(0) @binding(1) var dst: texture_storage_2d_array<rgba16float, write>;
@compute @workgroup_size(8, 8)
fn csCubeMip(@builtin(global_invocation_id) id: vec3u) {
  let dd = textureDimensions(dst);
  if (id.x >= dd.x || id.y >= dd.y) { return; }
  let sd = vec2i(textureDimensions(src)); let b = vec2i(id.xy) * 2; let l = i32(id.z);
  var r = vec4f(0.0); var w = 0.0;
  for (var y = -1; y <= 2; y++) { for (var x = -1; x <= 2; x++) {
    let p = clamp(b + vec2i(x, y), vec2i(0), sd - 1);
    let ww = select(1.0, 3.0, x >= 0 && x <= 1) * select(1.0, 3.0, y >= 0 && y <= 1);
    r += textureLoad(src, p, l, 0) * ww; w += ww;
  } }
  textureStore(dst, id.xy, l, r / w);
}`, 'cubemip'), 'csCubeMip');
    post.cubeMipBG = [];
    for (let m = 1; m < CUBE_MIPS; m++) post.cubeMipBG.push(device.createBindGroup({ layout: post.cubeMip.getBindGroupLayout(0), entries: [
      { binding: 0, resource: cubeTex.createView({ dimension: '2d-array', baseMipLevel: m - 1, mipLevelCount: 1 }) },
      { binding: 1, resource: cubeTex.createView({ dimension: '2d-array', baseMipLevel: m, mipLevelCount: 1 }) }] }));
    // parâmetros do bloom
    post.blP = [];
    for (let i = 0; i < 6; i++) { const b = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); device.queue.writeBuffer(b, 0, new Float32Array([i === 0 ? 1 : 0, 1.0, 0, 0])); post.blP.push(b); }
  }
  let pbg = {};
  function buildPostBindGroups() {
    const v = (t) => t.createView();
    const U0 = { buffer: viewsBuf, size: 416 }, U1 = { buffer: globBuf };
    pbg.light = [0, 1].map(par => device.createBindGroup({ layout: post.light.getBindGroupLayout(0), entries: [
      { binding: 0, resource: U0 }, { binding: 1, resource: U1 }, { binding: 2, resource: v(tg.alb) }, { binding: 3, resource: v(tg.nrm) },
      { binding: 4, resource: v(tg.misc) }, { binding: 5, resource: v(tg.vel) }, { binding: 6, resource: v(tg.depth) }, { binding: 7, resource: v(tg.ao1) },
      { binding: 8, resource: shadowTex.createView({ dimension: '2d-array' }) }, { binding: 9, resource: sampCmp }, { binding: 10, resource: v(skyHi) },
      { binding: 11, resource: v(skyLo) }, { binding: 12, resource: cubeTex.createView({ dimension: 'cube' }) }, { binding: 13, resource: v(tg.vol) },
      { binding: 14, resource: v(par ? tg.hist0 : tg.hist1) }, { binding: 15, resource: sampLinClamp }, { binding: 16, resource: v(tg.hdr) }, { binding: 17, resource: sampLinRep }] }));
    pbg.ao = device.createBindGroup({ layout: post.ao.getBindGroupLayout(0), entries: [
      { binding: 0, resource: U0 }, { binding: 1, resource: U1 }, { binding: 2, resource: v(tg.depth) }, { binding: 3, resource: v(tg.nrm) }, { binding: 4, resource: v(tg.ao0) }] });
    pbg.aoBlur = device.createBindGroup({ layout: post.aoBlur.getBindGroupLayout(0), entries: [{ binding: 5, resource: v(tg.ao0) }, { binding: 6, resource: v(tg.ao1) }] });
    pbg.vol = device.createBindGroup({ layout: post.vol.getBindGroupLayout(0), entries: [
      { binding: 0, resource: U0 }, { binding: 1, resource: U1 }, { binding: 2, resource: v(tg.depth) }, { binding: 3, resource: shadowTex.createView({ dimension: '2d-array' }) },
      { binding: 4, resource: sampCmp }, { binding: 5, resource: v(skyLo) }, { binding: 6, resource: sampLinClamp }, { binding: 7, resource: v(tg.vol) }] });
    // TAA: par 0 escreve hist0 lendo hist1
    pbg.taa = [0, 1].map(par => device.createBindGroup({ layout: post.taa.getBindGroupLayout(0), entries: [
      { binding: 0, resource: U0 }, { binding: 1, resource: U1 }, { binding: 2, resource: v(tg.hdr) }, { binding: 3, resource: v(par ? tg.hist0 : tg.hist1) },
      { binding: 4, resource: v(tg.vel) }, { binding: 5, resource: v(tg.depth) }, { binding: 6, resource: sampLinClamp }, { binding: 7, resource: v(par ? tg.hist1 : tg.hist0) }] }));
    pbg.tile = device.createBindGroup({ layout: post.tile.getBindGroupLayout(0), entries: [{ binding: 0, resource: U0 }, { binding: 1, resource: U1 }, { binding: 2, resource: v(tg.vel) }, { binding: 3, resource: v(tg.tile) }] });
    pbg.nb = device.createBindGroup({ layout: post.nb.getBindGroupLayout(0), entries: [{ binding: 4, resource: v(tg.tile) }, { binding: 5, resource: v(tg.nb) }] });
    pbg.mb = [0, 1].map(par => device.createBindGroup({ layout: post.mb.getBindGroupLayout(0), entries: [
      { binding: 0, resource: U0 }, { binding: 1, resource: U1 }, { binding: 2, resource: v(tg.vel) }, { binding: 6, resource: v(par ? tg.hist1 : tg.hist0) },
      { binding: 7, resource: v(tg.nb) }, { binding: 8, resource: v(tg.depth) }, { binding: 10, resource: v(tg.mb) }] }));
    pbg.down = []; pbg.up = [];
    for (let i = 0; i < 6; i++) pbg.down.push(device.createBindGroup({ layout: post.down.getBindGroupLayout(0), entries: [
      { binding: 0, resource: v(i === 0 ? tg.mb : tg.bd[i - 1]) }, { binding: 1, resource: sampLinClamp }, { binding: 2, resource: v(tg.bd[i]) }, { binding: 3, resource: { buffer: post.blP[i] } }] }));
    for (let i = 4; i >= 0; i--) pbg.up[i] = device.createBindGroup({ layout: post.up.getBindGroupLayout(0), entries: [
      { binding: 0, resource: v(i === 4 ? tg.bd[5] : tg.bu[i + 1]) }, { binding: 1, resource: sampLinClamp }, { binding: 2, resource: v(tg.bu[i]) },
      { binding: 3, resource: { buffer: post.blP[1] } }, { binding: 4, resource: v(tg.bd[i]) }] });
    pbg.tone = device.createBindGroup({ layout: post.tone.getBindGroupLayout(0), entries: [
      { binding: 0, resource: U0 }, { binding: 1, resource: U1 }, { binding: 2, resource: v(tg.mb) }, { binding: 3, resource: v(tg.bu[0]) },
      { binding: 4, resource: sampLinClamp }, { binding: 5, resource: v(textTex) }] });
    if (R.onResize) R.onResize(device, tg);
  }
  R.tg = () => tg;

  // descritores de passes reutilizados (zero alocação por quadro)
  let gPassDesc, shadowPassDesc = [], cubePassDesc = [], tonePassDesc, fwdPassDesc;
  const tsW = { querySet: null, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: undefined };
  function buildFrameDescriptors() {
    gPassDesc = { colorAttachments: [
      { view: tg.alb.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } },
      { view: tg.nrm.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } },
      { view: tg.misc.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 1, g: 0, b: 0, a: 0 } },
      { view: tg.vel.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }],
      depthStencilAttachment: { view: tg.depth.createView(), depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' } };
    shadowPassDesc = [];
    for (let i = 0; i < 4; i++) shadowPassDesc.push({ colorAttachments: [], depthStencilAttachment: { view: shadowViews[i], depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' } });
    cubePassDesc = [];
    const cdv = cubeDepth.createView();
    for (let i = 0; i < 6; i++) cubePassDesc.push({ colorAttachments: [{ view: cubeFaceViews[i], loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
      depthStencilAttachment: { view: cdv, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' } });
    fwdPassDesc = { colorAttachments: [{ view: tg.hdr.createView(), loadOp: 'load', storeOp: 'store' }],
      depthStencilAttachment: { view: tg.depth.createView(), depthReadOnly: true } };
    tonePassDesc = { colorAttachments: [{ view: null, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] };
  }
  R.fwdPassDesc = () => fwdPassDesc;

  // ------------------------------------------------------------------ timestamps
  let qs, qsResolve, qsRead = [], qsReadBusy = [false, false, false], tsBig = null, tsBigFrames = 0;
  const N_TS = 24;
  R.passNames = new Array(N_TS / 2).fill('');
  function createTimestamps() {
    qs = device.createQuerySet({ type: 'timestamp', count: N_TS });
    qsResolve = device.createBuffer({ size: N_TS * 8, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
    for (let i = 0; i < 3; i++) qsRead.push(device.createBuffer({ size: N_TS * 8, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }));
    tsW.querySet = qs;
  }
  // gravação de longa duração (perf): resolve cada quadro num buffer grande, lido só no fim
  R.startTimestampLog = (maxFrames) => {
    if (!R.hasTimestamps) return false;
    tsBig = device.createBuffer({ size: maxFrames * 256, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
    tsBigFrames = 0; R.tsLogMax = maxFrames; return true;
  };
  R.stopTimestampLog = async () => {
    if (!tsBig) return null;
    const n = tsBigFrames;
    const rb = device.createBuffer({ size: Math.max(256, n * 256), usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const e = device.createCommandEncoder(); e.copyBufferToBuffer(tsBig, 0, rb, 0, Math.max(256, n * 256)); device.queue.submit([e.finish()]);
    await rb.mapAsync(GPUMapMode.READ);
    const b = new BigUint64Array(rb.getMappedRange());
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = Number(b[i * 32 + 1] - b[i * 32]) / 1e6;
    rb.unmap(); tsBig = null;
    return out;
  };
  // leitura ao vivo (estatísticas na tela, só com R.tsLive): mede 1 quadro em cada 30 e lê de forma assíncrona
  R.tsLive = false;
  let liveNow = false, liveBusy = false;
  const liveDone = () => { const b = new BigUint64Array(qsRead[0].getMappedRange(0, 16)); R.stats.gpuMs = Number(b[1] - b[0]) / 1e6; qsRead[0].unmap(); liveBusy = false; };
  // ---- perfil por passe (modo de depuração; aloca ao ler)
  R.profile = false;
  R.flags = { shadows: true, cube: true, trees: true, grass: true, ao: true, vol: true, mb: true, bloom: true, gbuf: true, fwd: true, light: true, taa: true };
  let pqs = null, pqRes = null, pqRead = null, pqBusy = false, pIdx = 0;
  const PMAX = 32;
  const pDesc = []; for (let i = 0; i < PMAX / 2; i++) pDesc.push({ querySet: null, beginningOfPassWriteIndex: i * 2, endOfPassWriteIndex: i * 2 + 1 });
  const pNames = new Array(PMAX / 2).fill('');
  R.profAcc = {}; R.profN = 0; R.profFrames = [];
  function tsp(name) {
    if (!R.profile || !R.hasTimestamps) return undefined;
    if (!pqs) { pqs = device.createQuerySet({ type: 'timestamp', count: PMAX }); pqRes = device.createBuffer({ size: PMAX * 8, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }); pqRead = device.createBuffer({ size: PMAX * 8, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }); for (const d of pDesc) d.querySet = pqs; }
    if (pIdx >= PMAX / 2) return undefined;
    pNames[pIdx] = name;
    return pDesc[pIdx++];
  }
  function profResolve(enc) {
    if (!R.profile || !pqs || pIdx === 0 || pqBusy) { pIdx = 0; return false; }
    enc.resolveQuerySet(pqs, 0, pIdx * 2, pqRes, 0);
    enc.copyBufferToBuffer(pqRes, 0, pqRead, 0, pIdx * 16);
    return true;
  }
  function profRead() {
    const n = pIdx; const names = pNames.slice(0, n); pqBusy = true;
    pqRead.mapAsync(GPUMapMode.READ).then(() => {
      const b = new BigUint64Array(pqRead.getMappedRange());
      const fr = {}; let total = 0;
      for (let i = 0; i < n; i++) { const ms = Number(b[i * 2 + 1] - b[i * 2]) / 1e6; fr[names[i]] = (fr[names[i]] || 0) + ms; total += ms; }
      fr.total = total;
      R.profFrames.push(fr);
      pqRead.unmap(); pqBusy = false;
    });
  }

  // ------------------------------------------------------------------ visões
  function writeView(slot, vpJ, vpNJ, prevVPNJ, view, cx, cy, cz, near, type, cascade, fovy, jx, jy, pjx, pjy, w, h, fx, fy, fz) {
    const o = slot * VIEW_FLOATS;
    viewData.set(vpJ, o); viewData.set(vpNJ, o + 16); viewData.set(prevVPNJ, o + 32);
    M4.invert(tm.inv, vpJ); viewData.set(tm.inv, o + 48);
    viewData.set(view, o + 64);
    viewData[o + 80] = cx; viewData[o + 81] = cy; viewData[o + 82] = cz; viewData[o + 83] = near;
    viewData[o + 84] = type; viewData[o + 85] = cascade; viewData[o + 86] = 1; viewData[o + 87] = fovy;
    viewData[o + 88] = jx; viewData[o + 89] = jy; viewData[o + 90] = pjx; viewData[o + 91] = pjy;
    viewData[o + 92] = w; viewData[o + 93] = h; viewData[o + 94] = 1 / w; viewData[o + 95] = 1 / h;
    viewData[o + 100] = fx; viewData[o + 101] = fy; viewData[o + 102] = fz;
  }
  const prevVPMain = new Float32Array(16); let hasPrev = false;
  const camState = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1, fovy: 0.8, near: 0.08 };
  R.cam = camState;
  const cascadeSplits = new Float32Array([9, 28, 90, 300]);
  R.cascadeSplits = cascadeSplits;
  const cascadeNear = [0.05, 9, 28, 90];
  const shadowTexel = new Float32Array(4);
  const shadowUpdated = [false, false, false, false];
  R.shadowUpdated = shadowUpdated;
  const SH_RANGE = 600;

  function computeCascade(c, cx, cy, cz, fx, fy, fz, fovy, aspect) {
    const n = cascadeNear[c], f = cascadeSplits[c];
    const tv = Math.tan(fovy / 2), th = tv * aspect, k2 = tv * tv + th * th;
    let cd = (f + n) * (1 + k2) / 2;
    if (cd > f) cd = f;
    const rad = Math.sqrt((f - cd) * (f - cd) + f * f * k2) * 1.04;
    const r = Math.ceil(rad * 4) / 4;   // quantiza o raio (estável)
    const px = cx + fx * cd, py = cy + fy * cd, pz = cz + fz * cd;
    const sd = R.sun.dir;
    // base do espaço de luz
    M4.lookAt(tm.view, 0, 0, 0, -sd[0], -sd[1], -sd[2], 0, 1, 0);
    // centro no espaço de luz e encaixe na grade de texels
    const texel = 2 * r / SHADOW_RES;
    let lx = tm.view[0] * px + tm.view[4] * py + tm.view[8] * pz;
    let ly = tm.view[1] * px + tm.view[5] * py + tm.view[9] * pz;
    let lz = tm.view[2] * px + tm.view[6] * py + tm.view[10] * pz;
    lx = Math.floor(lx / texel) * texel; ly = Math.floor(ly / texel) * texel;
    M4.orthoRev(tm.proj, lx - r, lx + r, ly - r, ly + r, -lz - SH_RANGE * 0.5, -lz + SH_RANGE * 0.5);
    M4.mul(shadowVP[c], tm.proj, tm.view);
    shadowTexel[c] = texel;
  }

  const cubeDirs = [[1, 0, 0, 0, 1, 0], [-1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, -1], [0, -1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, -1, 0, 1, 0]];
  let cubeCenter = new Float32Array(3);

  // ------------------------------------------------------------------ quadro
  // st: { cam:{x,y,z,tx,ty,tz,fovy}, time, dt, objs..., hud }
  const submitArr = [null];
  R.renderFrame = (st) => {
    const W = R.W, H = R.H, aspect = W / H;
    const f = R.frame;
    // ---- câmera principal
    const c = st.cam;
    M4.lookAt(tm.view, c.x, c.y, c.z, c.tx, c.ty, c.tz, 0, 1, 0);
    M4.perspRevInf(tm.proj, c.fovy, aspect, camState.near);
    M4.mul(tm.vpNJ, tm.proj, tm.view);
    const jx = st.taa ? (halton((f % 16) + 1, 2) - 0.5) * 2 / W : 0;
    const jy = st.taa ? (halton((f % 16) + 1, 3) - 0.5) * 2 / H : 0;
    tm.proj[8] += jx * tm.proj[11]; tm.proj[9] += jy * tm.proj[11];
    M4.mul(tm.vp, tm.proj, tm.view);
    if (!hasPrev || st.cut) M4.copy(prevVPMain, tm.vpNJ);
    R.lastCut = st.cut;
    let fx = c.tx - c.x, fy = c.ty - c.y, fz = c.tz - c.z; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    camState.x = c.x; camState.y = c.y; camState.z = c.z; camState.fx = fx; camState.fy = fy; camState.fz = fz; camState.fovy = c.fovy;
    writeView(0, tm.vp, tm.vpNJ, prevVPMain, tm.view, c.x, c.y, c.z, camState.near, 0, 0, c.fovy, jx, jy, 0, 0, W, H, fx, fy, fz);
    extractFrustum(R.frustumMain, tm.vpNJ);
    M4.copy(prevVPMain, tm.vpNJ); hasPrev = true;
    // ---- cascatas (atualização escalonada)
    for (let k = 0; k < 4; k++) {
      const upd = st.allShadows || k === 0 || (k === 1 && (f & 1) === 0) || (k === 2 && (f & 3) === 1) || (k === 3 && (f & 3) === 3) || f < 4;
      shadowUpdated[k] = upd;
      if (upd) {
        computeCascade(k, c.x, c.y, c.z, fx, fy, fz, c.fovy, aspect);
        writeView(1 + k, shadowVP[k], shadowVP[k], shadowVP[k], tm.view, c.x, c.y, c.z, 0, 1, k, 1, 0, 0, 0, 0, SHADOW_RES, SHADOW_RES, -R.sun.dir[0], -R.sun.dir[1], -R.sun.dir[2]);
        extractFrustum(R.frustumShadow[k], shadowVP[k]);
      }
    }
    // ---- cubo: 2 faces por quadro (todas no 1º quadro / captura)
    const cubeOn = st.cubeCenter != null;
    let face0 = (f >> 1) % 6, nFaces = (f & 1) ? 0 : 1;
    if (st.allCubeFaces || f < 1) { face0 = 0; nFaces = 6; }
    if (cubeOn) {
      if ((face0 === 0 && nFaces > 0) || nFaces === 6) { cubeCenter[0] = st.cubeCenter[0]; cubeCenter[1] = st.cubeCenter[1]; cubeCenter[2] = st.cubeCenter[2]; }
      for (let q = face0; q < face0 + nFaces; q++) {
        const d = cubeDirs[q];
        M4.lookAt(tm.view, cubeCenter[0], cubeCenter[1], cubeCenter[2], cubeCenter[0] + d[0], cubeCenter[1] + d[1], cubeCenter[2] + d[2], d[3], d[4], d[5]);
        M4.perspRevInf(tm.proj, Math.PI / 2, 1, 0.05); tm.proj[0] = -tm.proj[0];
        M4.mul(cubeVP[q], tm.proj, tm.view);
        writeView(5 + q, cubeVP[q], cubeVP[q], cubeVP[q], tm.view, cubeCenter[0], cubeCenter[1], cubeCenter[2], 0.05, 2, q, Math.PI / 2, 0, 0, 0, 0, CUBE_RES, CUBE_RES, d[0], d[1], d[2]);
        extractFrustum(R.frustumCube[q], cubeVP[q]);
      }
    }
    // ---- globais
    const g = globData;
    g[0] = R.sun.dir[0]; g[1] = R.sun.dir[1]; g[2] = R.sun.dir[2]; g[3] = 0;
    g[4] = R.sunColor[0]; g[5] = R.sunColor[1]; g[6] = R.sunColor[2]; g[7] = 0.0046;
    g[8] = st.time; g[9] = st.dt; g[10] = f; g[11] = st.cut ? 1 : 0;
    g[12] = 0.8; g[13] = 0.6; g[14] = 1.0; g[15] = 0.5;
    g[16] = R.fog[0]; g[17] = R.fog[1]; g[18] = R.fog[2]; g[19] = R.fog[3];
    g[20] = cascadeSplits[0]; g[21] = cascadeSplits[1]; g[22] = cascadeSplits[2]; g[23] = cascadeSplits[3];
    for (let k = 0; k < 4; k++) if (shadowUpdated[k]) g.set(shadowVP[k], 24 + k * 16);
    for (let k = 0; k < 4; k++) if (shadowUpdated[k]) g[88 + k] = shadowTexel[k];
    g[92] = cubeCenter[0]; g[93] = cubeCenter[1]; g[94] = cubeCenter[2]; g[95] = cubeOn ? 1 : 0;
    g[96] = TERRAIN.X0; g[97] = TERRAIN.Z0; g[98] = 1 / TERRAIN.HS; g[99] = TERRAIN.HN;
    g[100] = TERRAIN.X0; g[101] = TERRAIN.Z0; g[102] = 1 / TERRAIN.R1; g[103] = TERRAIN.R1;
    g[104] = TRACK.L; g[105] = TRACK.N; g[106] = TRACK.ds; g[107] = TRACK.sStart;
    g[108] = st.time * 0.00012; g[109] = R.exposure; g[110] = R.debug || 0; g[111] = st.hud ? 1 : 0;
    g[112] = st.speedKmh || 0; g[113] = st.camIndex || 0; g[114] = st.lapTime || 0; g[115] = 0;
    g[116] = st.motionBlur ?? 1; g[117] = st.carFx || 1; g[118] = st.carFz || 0; g[119] = 0;
    if (cubeOn) { g[156] = st.cubeCenter[0]; g[157] = st.cubeCenter[1]; g[158] = st.cubeCenter[2]; g[159] = 1; } else g[159] = 0;
    device.queue.writeBuffer(globBuf, 0, globData, 0, 120);
    device.queue.writeBuffer(globBuf, 156 * 4, globData, 156, 4);
    device.queue.writeBuffer(viewsBuf, 0, viewData, 0, VIEW_FLOATS * 11);
    device.queue.writeBuffer(objBuf, 0, objData, 0, (OBJ_BYTES / 4) * N_OBJ);
    if (R.beforeEncode) R.beforeEncode(st);

    // ---- codificação
    const enc = device.createCommandEncoder();
    liveNow = R.tsLive && !tsBig && !R.profile && !!qs && !liveBusy && f % 30 === 0;
    R.tsBeginPass(enc);
    if (R.encodeCompute) R.encodeCompute(enc, cubeOn ? face0 : 99, cubeOn ? nFaces : 0);
    // sombras
    for (let k = 0; k < 4; k++) {
      if (!shadowUpdated[k] || !R.flags.shadows) continue;
      shadowPassDesc[k].timestampWrites = tsp('shadow' + k); const pass = enc.beginRenderPass(shadowPassDesc[k]);
      pass.setBindGroup(0, sceneBGShadow, dynOff[1 + k]);
      drawMeshes(pass, pipes.meshShadow, 1, k);
      if (R.drawExtra) R.drawExtra(pass, 'shadow', k, sceneBGShadow, dynOff[1 + k]);
      pass.end();
    }
    // cubo
    if (cubeOn && R.flags.cube) {
      for (let q = face0; q < face0 + nFaces; q++) {
        cubePassDesc[q].timestampWrites = tsp('cube'); const pass = enc.beginRenderPass(cubePassDesc[q]);
        pass.setBindGroup(0, sceneBG, dynOff[5 + q]);
        pass.setPipeline(pipes.skyCube); pass.setBindGroup(1, objBG, dynObj[0]); pass.draw(3);
        drawMeshes(pass, pipes.meshCube, 2, q);
        if (R.drawExtra) R.drawExtra(pass, 'cube', q, sceneBG, dynOff[5 + q]);
        pass.end();
      }
      if (nFaces > 0 && face0 + nFaces === 6) {
        const cp = enc.beginComputePass(cpDesc('cubemip'));
        cp.setPipeline(post.cubeMip);
        for (let m = 1; m < CUBE_MIPS; m++) { cp.setBindGroup(0, post.cubeMipBG[m - 1]); const s = CUBE_RES >> m; cp.dispatchWorkgroups(Math.ceil(s / 8), Math.ceil(s / 8), 6); }
        cp.end();
      }
    }
    // G-buffer
    {
      gPassDesc.timestampWrites = tsp('gbuffer'); const pass = enc.beginRenderPass(gPassDesc);
      pass.setBindGroup(0, sceneBG, dynOff[0]);
      if (R.flags.gbuf) drawMeshes(pass, pipes.meshG, 0, 0);
      if (R.drawExtra) R.drawExtra(pass, 'gbuffer', 0, sceneBG, dynOff[0]);
      pass.end();
    }
    const par = f & 1;
    const hw = Math.ceil(W / 2), hh = Math.ceil(H / 2);
    let cp = enc.beginComputePass(cpDesc('ao'));
    if (R.flags.ao) { cp.setPipeline(post.ao); cp.setBindGroup(0, pbg.ao); cp.dispatchWorkgroups(Math.ceil(hw / 8), Math.ceil(hh / 8)); }
    if (R.flags.ao) { cp.setPipeline(post.aoBlur); cp.setBindGroup(0, pbg.aoBlur); cp.dispatchWorkgroups(Math.ceil(hw / 8), Math.ceil(hh / 8)); }
    cp.end();
    cp = enc.beginComputePass(cpDesc('vol'));
    if (R.flags.vol) { cp.setPipeline(post.vol); cp.setBindGroup(0, pbg.vol); cp.dispatchWorkgroups(Math.ceil(hw / 8), Math.ceil(hh / 8)); }
    cp.end();
    cp = enc.beginComputePass(cpDesc('light'));
    if (R.flags.light) { cp.setPipeline(post.light); cp.setBindGroup(0, pbg.light[par]); cp.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8)); }
    cp.end();
    // transparentes (vidro, fumaça)
    if (R.drawForward && R.flags.fwd) {
      fwdPassDesc.timestampWrites = tsp('forward'); const pass = enc.beginRenderPass(fwdPassDesc);
      pass.setBindGroup(0, sceneBG, dynOff[0]);
      R.drawForward(pass, sceneBG, dynOff[0]);
      pass.end();
    }
    let cp2 = enc.beginComputePass(cpDesc('taa'));
    cp2.setPipeline(post.taa); cp2.setBindGroup(0, pbg.taa[par]); cp2.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));
    cp2.end(); cp2 = enc.beginComputePass(cpDesc('mb'));
    const tw = Math.ceil(W / 16), th = Math.ceil(H / 16);
    cp2.setPipeline(post.tile); cp2.setBindGroup(0, pbg.tile); cp2.dispatchWorkgroups(Math.ceil(tw / 8), Math.ceil(th / 8));
    cp2.setPipeline(post.nb); cp2.setBindGroup(0, pbg.nb); cp2.dispatchWorkgroups(Math.ceil(tw / 8), Math.ceil(th / 8));
    if (R.flags.mb) { cp2.setPipeline(post.mb); cp2.setBindGroup(0, pbg.mb[par]); cp2.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8)); }
    cp2.end(); cp2 = enc.beginComputePass(cpDesc('bloom'));
    cp2.setPipeline(post.down);
    for (let i = 0; i < 6; i++) { cp2.setBindGroup(0, pbg.down[i]); const w = Math.ceil(W / (2 << i)), h = Math.ceil(H / (2 << i)); cp2.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8)); }
    cp2.setPipeline(post.up);
    for (let i = 4; i >= 0; i--) { cp2.setBindGroup(0, pbg.up[i]); const w = Math.ceil(W / (2 << i)), h = Math.ceil(H / (2 << i)); cp2.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8)); }
    cp2.end();
    // tonemap -> tela
    tonePassDesc.colorAttachments[0].view = ctx.getCurrentTexture().createView();
    if (tsBig || liveNow) { tsW.beginningOfPassWriteIndex = undefined; tsW.endOfPassWriteIndex = 1; tonePassDesc.timestampWrites = tsW; }
    else tonePassDesc.timestampWrites = tsp('tone');
    const tp = enc.beginRenderPass(tonePassDesc);
    tp.setPipeline(post.tone); tp.setBindGroup(0, pbg.tone); tp.draw(3);
    tp.end();
    if (tsBig && tsBigFrames < R.tsLogMax) {
      enc.resolveQuerySet(qs, 0, 2, tsBig, tsBigFrames * 256);
      tsBigFrames++;
    } else if (liveNow) { enc.resolveQuerySet(qs, 0, 2, qsResolve, 0); enc.copyBufferToBuffer(qsResolve, 0, qsRead[0], 0, 16); }
    const pr = profResolve(enc);
    submitArr[0] = enc.finish();
    device.queue.submit(submitArr);
    if (pr) profRead();
    if (liveNow) { liveBusy = true; qsRead[0].mapAsync(GPUMapMode.READ).then(liveDone); }
    pIdx = 0;
    R.frame++;
  };
  // timestamp de início: escrito por um passe de compute vazio no começo do quadro
  // (feito via beforeEncode quando o log está ativo)
  const tsBeginDesc = { timestampWrites: { querySet: null, beginningOfPassWriteIndex: 0 } };
  let nopPipe = null, nopBG = null, nopBuf = null;
  R.tsBeginPass = (enc) => {
    if (!tsBig && !liveNow) return;
    if (!nopPipe) {
      nopPipe = device.createComputePipeline({ layout: 'auto', compute: { module: device.createShaderModule({ code: '@group(0) @binding(0) var<storage, read_write> b: array<u32>; @compute @workgroup_size(1) fn m() { b[0] = b[0] + 1u; }' }), entryPoint: 'm' } });
      nopBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE });
      nopBG = device.createBindGroup({ layout: nopPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: nopBuf } }] });
    }
    tsBeginDesc.timestampWrites.querySet = qs;
    const p = enc.beginComputePass(tsBeginDesc); p.setPipeline(nopPipe); p.setBindGroup(0, nopBG); p.dispatchWorkgroups(1); p.end();
  };

  const cpD = []; for (let i = 0; i < 16; i++) cpD.push({ timestampWrites: undefined });
  let cpI = 0;
  function cpDesc(name) { const d = cpD[cpI++ & 15]; d.timestampWrites = tsp(name); return d; }
  R.cpDesc = cpDesc;
  // offsets dinâmicos pré-alocados (arrays fixos)
  const dynOff = []; for (let i = 0; i < N_VIEWS; i++) dynOff.push([i * VIEW_BYTES]);
  const dynObj = []; for (let i = 0; i < N_OBJ; i++) dynObj.push([i * OBJ_BYTES]);
  R.dynOff = dynOff; R.dynObj = dynObj;
  R.objBG = () => objBG;

  // desenho de malhas com culling por AABB/esfera
  function drawMeshes(pass, pipe, mode, sub) {
    pass.setPipeline(pipe);
    let lastObj = -1;
    const fr = mode === 0 ? R.frustumMain : mode === 1 ? R.frustumShadow[sub] : R.frustumCube[sub];
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      if (!m.visible) continue;
      if (mode === 0 && !m.main) continue;
      if (mode === 1 && (!m.shadow || sub > m.maxShadowCascade || sub < (m.minShadowCascade || 0))) continue;
      if (mode === 2 && !m.cube) continue;
      if (m.obj === 0 && m.min) {
        const cx = (m.min[0] + m.max[0]) * 0.5, cy = (m.min[1] + m.max[1]) * 0.5, cz = (m.min[2] + m.max[2]) * 0.5;
        const dx = m.max[0] - cx, dy = m.max[1] - cy, dz = m.max[2] - cz;
        if (!sphereInFrustum(fr, cx, cy, cz, Math.sqrt(dx * dx + dy * dy + dz * dz), mode === 1 ? 4 : 5)) continue;
      }
      if (m.obj !== lastObj) { pass.setBindGroup(1, objBG, dynObj[m.obj]); lastObj = m.obj; }
      pass.setVertexBuffer(0, m.vb);
      pass.setIndexBuffer(m.ib, 'uint32');
      pass.drawIndexed(m.count, 1, m.first, 0, 0);
    }
  }
  R.drawMeshesFiltered = drawMeshes;

  R.sunColor = new Float32Array([1, 1, 1]);
  R.fog = new Float32Array([0.00017, 0.0032, 0, 150]);
  R.exposure = 0.5;
  return R;
})();
