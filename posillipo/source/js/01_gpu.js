// Dispositivo WebGPU, preset grafici a 4 livelli (target AMD Radeon R5 2014 → PBR moderno) ed epoche storiche Posillipo.
const Q = new URLSearchParams(location.search);
const BUILD = [];
const GAME = { ready: false, mode: Q.get('scene') || 'game', capture: Q.has('cap'), tick: null, init: null, minFrameMs: 0, gpuWorstMs: 0, ui: false };
GAME.ui = Q.has('ui') ? Q.get('ui') !== '0' : !(Q.has('cap') || Q.has('perf') || Q.has('replay') || Q.has('auto') || Q.has('scene') || navigator.webdriver);
const RT = new Float64Array([0, 1 / 60, 1 / 60, 0]);

const QUALITY_PRESETS = {
  'molto-bassa': {
    id: 'molto-bassa', label: 'Molto Bassa', note: 'APU 2014 · 60 FPS',
    scale: 0.55, maxDpr: 1.0, maxW: 960, maxH: 540,
    shadowRes: 256, shadowSRes: 256, shadows: 0, staticShadow: false,
    half: false, ssr: false, taa: false, mblur: false, bloom: false,
    envRes: 128, envMips: 5, envFacesPerFrame: 0, grass: false, vegScale: 0.45, distScale: 0.55,
  },
  bassa: {
    id: 'bassa', label: 'Bassa', note: 'Ombra 512px · Bilanciata',
    scale: 0.72, maxDpr: 1.0, maxW: 1280, maxH: 720,
    shadowRes: 512, shadowSRes: 1024, shadows: 1, staticShadow: true,
    half: false, ssr: false, taa: false, mblur: false, bloom: false,
    envRes: 256, envMips: 6, envFacesPerFrame: 0, grass: false, vegScale: 0.65, distScale: 0.72,
  },
  media: {
    id: 'media', label: 'Media', note: 'PBR · 2 Cascate · TAA',
    scale: 0.85, maxDpr: 1.25, maxW: 1920, maxH: 1080,
    shadowRes: 1024, shadowSRes: 2048, shadows: 2, staticShadow: true,
    half: true, ssr: false, taa: true, mblur: false, bloom: true,
    envRes: 256, envMips: 6, envFacesPerFrame: 1, grass: true, vegScale: 0.85, distScale: 0.88,
  },
  alta: {
    id: 'alta', label: 'Alta', note: 'PBR Completo · Originale',
    scale: 1.0, maxDpr: 2.0, maxW: 5120, maxH: 2880,
    shadowRes: 2048, shadowSRes: 4096, shadows: 3, staticShadow: true,
    half: true, ssr: true, taa: true, mblur: true, bloom: true,
    envRes: 512, envMips: 7, envFacesPerFrame: 2, grass: true, vegScale: 1.0, distScale: 1.0,
  },
};

const ERA_CONFIGS = {
  '1937': {
    id: '1937', year: 1937,
    title: 'Coppa Principessa di Piemonte',
    subtitle: 'Alfa Romeo 12C-36 (#32) · Posillipo 1937 · Cinegiornale Luce B/N',
    carName: 'Alfa Romeo 12C-36',
    driver: 'T. Nuvolari / N. Farina (#32)',
    spec: 'V12 4.1L Compressore · 370 CV · 820 kg · RWD',
    cssFilter: 'grayscale(1) contrast(1.18) sepia(0.06)',
    sunEl: 24, sunAz: 162, sunGain: 1.55,
    maxKmh: 300, maxRpm: 7000, redRpm: 5800,
    accent: '#c8c4b8',
    hasActiveAero: false,
  },
  '1955': {
    id: '1955', year: 1955,
    title: 'VII Gran Premio di Napoli',
    subtitle: 'Lancia D50 (#6) · Alberto Ascari · Posillipo 1955 · Kodachrome',
    carName: 'Lancia D50',
    driver: 'Alberto Ascari (#6)',
    spec: 'V8 90° 2.5L · 260 CV · 620 kg · Serbatoi a Siluro',
    cssFilter: 'contrast(1.04) saturate(1.08)',
    sunEl: 15.5, sunAz: 196, sunGain: 1.52,
    maxKmh: 280, maxRpm: 9000, redRpm: 8000,
    accent: '#e0422e',
    hasActiveAero: false,
  },
  '2026': {
    id: '2026', year: 2026,
    title: 'Gran Premio di Posillipo 2026',
    subtitle: 'Ferrari SF-26 (#16) · Hyper-Tech F1 · Active Aero Z-Mode / X-Mode',
    carName: 'Ferrari SF-26',
    driver: 'Scuderia #16 · Active Aero',
    spec: 'V6 Turbo Hybrid · 1.020 CV · 798 kg · Spazio: Z/X-Mode',
    cssFilter: 'none',
    sunEl: 21, sunAz: 174, sunGain: 1.48,
    maxKmh: 380, maxRpm: 15000, redRpm: 13200,
    accent: '#e62429',
    hasActiveAero: true,
  },
};

const QUAL = (function () {
  let id = (Q.get('q') || '').toLowerCase();
  if (!QUALITY_PRESETS[id]) {
    try { id = (localStorage.getItem('gpn-quality') || '').toLowerCase(); } catch (e) { id = ''; }
  }
  return QUALITY_PRESETS[id] || QUALITY_PRESETS.alta;
})();

const ERA = (function () {
  const id = String(Q.get('era') || '1955');
  return ERA_CONFIGS[id] || ERA_CONFIGS['1955'];
})();

function setQualityPreset(id) {
  if (!QUALITY_PRESETS[id]) return;
  try { localStorage.setItem('gpn-quality', id); } catch (e) {}
  const u = new URL(location.href);
  u.searchParams.set('q', id);
  location.href = u.toString();
}
function setEraPreset(id) {
  if (!ERA_CONFIGS[id]) return;
  const u = new URL(location.href);
  u.searchParams.set('era', id);
  u.searchParams.set('q', QUAL.id);
  location.href = u.toString();
}

const G = { dev: null, ctx: null, fmt: 'bgra8unorm', W: 0, H: 0, hasTS: false, canvas: null };

async function gpuInit() {
  G.canvas = document.getElementById('c');
  if (G.canvas && ERA.cssFilter && ERA.cssFilter !== 'none') {
    // Epoca 1 (1937): filtro CSS zero-cost sul canvas invece di post-processing shader per preservare fillrate APU
    G.canvas.style.filter = ERA.cssFilter;
  }
  if (!navigator.gpu) throw new Error('WebGPU non disponibile in questo browser.');
  const ad = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!ad) throw new Error('Nessun adattatore GPU WebGPU disponibile.');
  const feats = [];
  for (const f of ['float32-filterable', 'rg11b10ufloat-renderable'].concat((Q.has('perf') || GAME.ui) && !Q.has('nots') ? ['timestamp-query'] : [])) if (ad.features.has(f)) feats.push(f);
  if (!ad.features.has('float32-filterable')) throw new Error('GPU senza supporto float32-filterable.');
  G.hasTS = feats.includes('timestamp-query');
  G.dev = await ad.requestDevice({
    requiredFeatures: feats,
    requiredLimits: { maxColorAttachmentBytesPerSample: Math.min(64, ad.limits.maxColorAttachmentBytesPerSample), maxSampledTexturesPerShaderStage: 24, maxBufferSize: ad.limits.maxBufferSize, maxTextureDimension2D: Math.min(8192, ad.limits.maxTextureDimension2D) }
  });
  G.dev.addEventListener('uncapturederror', e => { console.error('GPU: ' + e.error.message); G.lastErr = e.error.message; });
  const res = (Q.get('res') || '').split('x');
  const dpr = Math.min(window.devicePixelRatio || 1, QUAL.maxDpr);
  G.W = res.length === 2 ? +res[0] : Math.round(innerWidth * dpr * QUAL.scale);
  G.H = res.length === 2 ? +res[1] : Math.round(innerHeight * dpr * QUAL.scale);
  G.W = clamp(G.W & ~1, 320, QUAL.maxW); G.H = clamp(G.H & ~1, 180, QUAL.maxH);
  G.canvas.width = G.W; G.canvas.height = G.H;
  G.ctx = G.canvas.getContext('webgpu');
  G.fmt = navigator.gpu.getPreferredCanvasFormat();
  G.ctx.configure({ device: G.dev, format: G.fmt, alphaMode: 'opaque' });
}

const TU = { RT: 0x10, TB: 0x04, CS: 0x01, CD: 0x02, ST: 0x08 };
function mkTex(w, h, format, usage, extra) {
  const d = { size: [w, h, 1], format, usage: usage ?? (TU.RT | TU.TB), mipLevelCount: 1 };
  if (extra) Object.assign(d, extra);
  return G.dev.createTexture(d);
}
function mkBuf(size, usage, data) {
  const b = G.dev.createBuffer({ size: (size + 3) & ~3, usage, mappedAtCreation: !!data });
  if (data) { new Uint8Array(b.getMappedRange()).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)); b.unmap(); }
  return b;
}
const BU = { V: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, I: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, U: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, S: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST };

function wgslPP(name, defs) {
  defs = Object.assign({}, defs);
  const seen = {};
  const run = (nm) => {
    const src = WGSL[nm]; if (src === undefined) throw new Error('wgsl ausente: ' + nm);
    const out = []; const st = []; let on = true;
    for (const line of src.split('\n')) {
      const t = line.trim();
      if (t[0] === '#') {
        const p = t.split(/\s+/);
        if (p[0] === '#ifdef') { st.push(on); on = on && (p[1] in defs); continue; }
        if (p[0] === '#ifndef') { st.push(on); on = on && !(p[1] in defs); continue; }
        if (p[0] === '#else') { on = st[st.length - 1] && !on; continue; }
        if (p[0] === '#endif') { on = st.pop(); continue; }
        if (!on) continue;
        if (p[0] === '#include') { if (!seen[p[1]]) { seen[p[1]] = 1; out.push(run(p[1])); } continue; }
        if (p[0] === '#define') { defs[p[1]] = p.slice(2).join(' '); continue; }
        continue;
      }
      if (on) out.push(line);
    }
    return out.join('\n');
  };
  let code = 'diagnostic(off, derivative_uniformity);\n' + run(name);
  for (const k in defs) if (defs[k] !== '' && defs[k] !== true) code = code.replace(new RegExp('\\b' + k + '\\b', 'g'), defs[k]);
  return code;
}
const _modCache = {};
function mkShader(name, defs) {
  const key = name + JSON.stringify(defs || {});
  if (_modCache[key]) return _modCache[key];
  const code = wgslPP(name, defs);
  const m = G.dev.createShaderModule({ code, label: name });
  m.getCompilationInfo().then(info => {
    for (const msg of info.messages) if (msg.type === 'error') {
      const ln = code.split('\n'); console.error(`WGSL ${name}:${msg.lineNum}: ${msg.message}\n${ln.slice(Math.max(0, msg.lineNum - 3), msg.lineNum + 1).join('\n')}`);
      G.lastErr = `WGSL ${name}:${msg.lineNum}: ${msg.message}`;
    }
  });
  return _modCache[key] = m;
}
function mkFsPipe(name, defs, targets, opts) {
  const mod = mkShader(name, defs);
  return G.dev.createRenderPipeline({
    label: name, layout: 'auto',
    vertex: { module: mod, entryPoint: 'vs' },
    fragment: { module: mod, entryPoint: (opts && opts.entry) || 'fs', targets: targets.map(t => typeof t === 'string' ? { format: t } : t) },
    primitive: { topology: 'triangle-list' },
  });
}
function mkBG(pipe, idx, entries) {
  return G.dev.createBindGroup({ layout: pipe.getBindGroupLayout(idx), entries: entries.map((r, i) => ({ binding: i, resource: (r instanceof GPUBuffer) ? { buffer: r } : r })) });
}
function mkBGL(layout, entries) {
  return G.dev.createBindGroup({ layout, entries: entries.map((r, i) => ({ binding: i, resource: (r instanceof GPUBuffer) ? { buffer: r } : (r && r.buffer instanceof GPUBuffer) ? r : r })) });
}
function mkPassDesc(nColor, depth, clear, label) {
  const d = { label, colorAttachments: [] };
  for (let i = 0; i < nColor; i++) d.colorAttachments.push({ view: null, loadOp: clear ? 'clear' : 'load', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } });
  if (depth) d.depthStencilAttachment = { view: null, depthLoadOp: depth === 'load' || depth === 'ro' ? 'load' : 'clear', depthStoreOp: 'store', depthClearValue: depth === 'clear1' ? 1 : 0 };
  if (depth === 'ro') { const a = d.depthStencilAttachment; delete a.depthLoadOp; delete a.depthStoreOp; delete a.depthClearValue; a.depthReadOnly = true; }
  return d;
}
let _mipPipe = {};
function genMips(tex, format, layers) {
  const dev = G.dev;
  if (!_mipPipe[format]) _mipPipe[format] = mkFsPipe('blit', {}, [format]);
  const pipe = _mipPipe[format];
  const samp = dev.createSampler({ minFilter: 'linear', magFilter: 'linear' });
  const enc = dev.createCommandEncoder();
  for (let L = 0; L < (layers || 1); L++) for (let m = 1; m < tex.mipLevelCount; m++) {
    const srcV = tex.createView({ dimension: '2d', baseMipLevel: m - 1, mipLevelCount: 1, baseArrayLayer: L, arrayLayerCount: 1 });
    const dstV = tex.createView({ dimension: '2d', baseMipLevel: m, mipLevelCount: 1, baseArrayLayer: L, arrayLayerCount: 1 });
    const p = enc.beginRenderPass({ colorAttachments: [{ view: dstV, loadOp: 'clear', storeOp: 'store' }] });
    p.setPipeline(pipe); p.setBindGroup(0, mkBG(pipe, 0, [srcV, samp])); p.draw(3); p.end();
  }
  dev.queue.submit([enc.finish()]);
}
const mipCount = (w, h) => 1 + Math.floor(Math.log2(Math.max(w, h)));
