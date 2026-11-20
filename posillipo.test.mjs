import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadPosillipoContext(eraId = '1955', qualityId = 'molto-bassa') {
  const mathSrc = fs.readFileSync('posillipo/source/js/00_math.js', 'utf8');
  const gpuSrc = fs.readFileSync('posillipo/source/js/01_gpu.js', 'utf8');
  const glbSrc = fs.readFileSync('posillipo/source/js/03_glb.js', 'utf8');
  const trackSrc = fs.readFileSync('posillipo/source/js/10_track.js', 'utf8');
  const vehSrc = fs.readFileSync('posillipo/source/js/40_vehicle.js', 'utf8');
  const aiSrc = fs.readFileSync('posillipo/source/js/42_ai.js', 'utf8');

  const ctx = {
    Math,
    Float32Array,
    Float64Array,
    Int32Array,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Int16Array,
    DataView,
    ArrayBuffer,
    TextDecoder,
    Array,
    Object,
    String,
    Number,
    URLSearchParams,
    URL,
    console,
    location: { search: `?era=${eraId}&q=${qualityId}`, href: `http://localhost:3000/posillipo/?era=${eraId}&q=${qualityId}` },
    navigator: { webdriver: true },
    localStorage: { getItem: () => null, setItem: () => {} },
    GPUBufferUsage: { VERTEX: 32, INDEX: 16, UNIFORM: 64, STORAGE: 128, COPY_DST: 8 },
  };
  vm.createContext(ctx);
  return vm.runInContext(
    `${mathSrc}\n${gpuSrc}\n${glbSrc}\n${trackSrc}\n${vehSrc}\n${aiSrc}\n
     trackBuild();
     heightFieldBuild();
     aiBuild();
     ({ TRK, HF, AI, QUAL, QUALITY_PRESETS, ERA, ERA_CONFIGS, VP, VP_ERAS, VEH, vehicleReset, vehicleStep, K_W, K_S, K_SPACE, naturalH, forestAt, parseGlbBinary });`,
    ctx
  );
}

test('Posillipo 5.13 km circuit is closed, non-self-intersecting, and has realistic elevation + Nisida', () => {
  const { TRK, AI, naturalH, forestAt } = loadPosillipoContext('1955', 'alta');

  assert.ok(TRK.N > 2000, `expected >2000 centerline samples, got ${TRK.N}`);
  assert.ok(
    TRK.L >= 4850 && TRK.L <= 5450,
    `expected Posillipo length ~5130 m (4850..5450), got ${TRK.L.toFixed(1)} m`
  );

  // Closure gap check
  const gap = Math.hypot(TRK.x[TRK.N - 1] - TRK.x[0], TRK.z[TRK.N - 1] - TRK.z[0]);
  assert.ok(gap < TRK.ds * 2.5, `Posillipo closure gap too large: ${gap.toFixed(2)} m`);

  // Realistic Posillipo elevation (~108 m at Coroglio up to ~152 m on Via Manzoni)
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < TRK.N; i++) {
    if (TRK.y[i] < minY) minY = TRK.y[i];
    if (TRK.y[i] > maxY) maxY = TRK.y[i];
  }
  assert.ok(minY < 116 && minY > 95, `Coroglio low point should be ~108 m, got ${minY.toFixed(1)} m`);
  assert.ok(maxY > 147 && maxY < 165, `Via Manzoni ridge should exceed 147 m, got ${maxY.toFixed(1)} m`);

  // Non-self-intersection check on 30 m coarse polygon
  const stride = Math.max(1, Math.round(30 / TRK.ds));
  const pts = [];
  for (let i = 0; i < TRK.N; i += stride) pts.push([TRK.x[i], TRK.z[i]]);
  const segIntersects = (a, b, c, d) => {
    const ccw = (p, q, r) => (r[1] - p[1]) * (q[0] - p[0]) > (q[1] - p[1]) * (r[0] - p[0]);
    return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
  };
  let crossings = 0;
  for (let i = 0; i < pts.length; i++) {
    const i2 = (i + 1) % pts.length;
    for (let j = i + 2; j < pts.length; j++) {
      const j2 = (j + 1) % pts.length;
      if (j2 === i) continue;
      if (segIntersects(pts[i], pts[i2], pts[j], pts[j2])) crossings++;
    }
  }
  assert.equal(crossings, 0, `Posillipo track must not self-intersect, found ${crossings} crossings`);

  // Tyrrhenian Sea is at y=0, Isola di Nisida rises >80 m
  assert.equal(naturalH(1500, 1100), 0, 'open Gulf of Pozzuoli should be at y=0');
  assert.ok(naturalH(1140, 440) > 80, `Isola di Nisida peak should exceed 80 m, got ${naturalH(1140, 440).toFixed(1)} m`);
  assert.equal(forestAt(1500, 1100), 0, 'no trees allowed in the sea');
  assert.equal(forestAt(TRK.x[0], TRK.z[0]), 0, 'no trees allowed on the road');

  // AI speed profile finite & positive
  assert.equal(AI.vt.length, TRK.N);
  for (let i = 0; i < TRK.N; i++) {
    assert.ok(Number.isFinite(AI.vt[i]) && AI.vt[i] > 8, `invalid AI speed at ${i}: ${AI.vt[i]}`);
  }
});

test('4-level quality presets enforce AMD Radeon R5 2014 optimizations on molto-bassa and full PBR on alta', () => {
  const low = loadPosillipoContext('1937', 'molto-bassa');
  assert.equal(low.QUAL.id, 'molto-bassa');
  assert.equal(low.QUAL.shadows, 0);
  assert.equal(low.QUAL.staticShadow, false);
  assert.equal(low.QUAL.grass, false);
  assert.equal(low.QUAL.half, false);
  assert.equal(low.QUAL.taa, false);
  assert.equal(low.QUAL.ssr, false);
  assert.match(low.ERA.cssFilter, /grayscale\(1\)/);

  const high = loadPosillipoContext('2026', 'alta');
  assert.equal(high.QUAL.id, 'alta');
  assert.equal(high.QUAL.shadows, 3);
  assert.equal(high.QUAL.shadowRes, 2048);
  assert.equal(high.QUAL.ssr, true);
  assert.equal(high.QUAL.taa, true);
  assert.equal(high.QUAL.grass, true);
});

test('3-epoch RWD vehicle physics: 1937/1955/2026 accelerate cleanly and SF-26 Active Aero X-Mode cuts drag & downforce', () => {
  const c37 = loadPosillipoContext('1937', 'bassa');
  const c55 = loadPosillipoContext('1955', 'bassa');
  const c26 = loadPosillipoContext('2026', 'bassa');

  assert.ok(c37.VP.mu < c55.VP.mu && c55.VP.mu < c26.VP.mu, 'grip must progress 1937 < 1955 < 2026');
  assert.equal(c37.ERA.hasActiveAero, false);
  assert.equal(c55.ERA.hasActiveAero, false);
  assert.equal(c26.ERA.hasActiveAero, true);

  // Accelerate 2026 SF-26 for 2.5 seconds in Z-Mode vs X-Mode
  c26.vehicleReset(10, 0, 0);
  for (let i = 0; i < 300; i++) c26.vehicleStep(c26.K_W);
  const vZ = c26.VEH.vx;
  const fzZ = c26.VEH.fz[2] + c26.VEH.fz[3];
  assert.ok(vZ > 26, `SF-26 should exceed 26 m/s (~94 km/h) after 2.5 s, got ${vZ.toFixed(1)} m/s`);

  // Switch to X-Mode (low drag / lower downforce) at the same speed and verify rear vertical load drops
  c26.VEH.aeroX = true;
  c26.vehicleStep(c26.K_W);
  const fzX = c26.VEH.fz[2] + c26.VEH.fz[3];
  assert.ok(fzX < fzZ, `X-Mode must reduce aero downforce on rear axle (Z=${fzZ.toFixed(0)} N vs X=${fzX.toFixed(0)} N)`);

  // Braking automatically drops X-Mode back to Z-Mode
  c26.vehicleStep(c26.K_S);
  assert.equal(c26.VEH.aeroX, false, 'braking must revert SF-26 to Z-Mode high downforce');
});

test('Zero-dependency binary glTF 2.0 (.glb) parser extracts geometry primitives cleanly', () => {
  const { parseGlbBinary } = loadPosillipoContext('1955', 'alta');

  // Build a minimal valid binary .glb with 1 triangle (POSITION vec3 + NORMAL vec3 + INDICES u16)
  const pos = new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]);
  const nrm = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const idx = new Uint16Array([0, 1, 2, 0]); // padded to 8 bytes
  const binLen = pos.byteLength + nrm.byteLength + idx.byteLength;
  const binBuf = new Uint8Array(binLen);
  binBuf.set(new Uint8Array(pos.buffer), 0);
  binBuf.set(new Uint8Array(nrm.buffer), 36);
  binBuf.set(new Uint8Array(idx.buffer), 72);

  const jsonObj = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: binLen }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 36 },
      { buffer: 0, byteOffset: 72, byteLength: 6 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.8, 0.7, 0.5, 1.0] } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    nodes: [{ mesh: 0, translation: [1, 2, 3] }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  let jsonStr = JSON.stringify(jsonObj);
  while (jsonStr.length % 4 !== 0) jsonStr += ' ';
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const totalLen = 12 + 8 + jsonBytes.byteLength + 8 + binBuf.byteLength;
  const glb = new ArrayBuffer(totalLen);
  const dv = new DataView(glb);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, totalLen, true);
  dv.setUint32(12, jsonBytes.byteLength, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  new Uint8Array(glb, 20, jsonBytes.byteLength).set(jsonBytes);
  const binOff = 20 + jsonBytes.byteLength;
  dv.setUint32(binOff, binBuf.byteLength, true);
  dv.setUint32(binOff + 4, 0x004e4942, true); // 'BIN\0'
  new Uint8Array(glb, binOff + 8, binBuf.byteLength).set(binBuf);

  const parsed = parseGlbBinary(glb);
  assert.equal(parsed.primitives.length, 1);
  assert.equal(parsed.primitives[0].pos.data.length, 9);
  assert.equal(parsed.primitives[0].idx.data.length, 3);
  assert.equal(parsed.primitives[0].mat[12], 1);
  assert.equal(parsed.primitives[0].mat[13], 2);
  assert.equal(parsed.primitives[0].mat[14], 3);
});

test('Built /posillipo/index.html single-HTML WebGPU bundle parses cleanly with zero syntax errors', () => {
  const html = fs.readFileSync('posillipo/index.html', 'utf8');
  assert.ok(html.includes('Circuito di Posillipo'));
  assert.ok(html.includes('Alfa Romeo 12C-36'));
  assert.ok(html.includes('Lancia D50'));
  assert.ok(html.includes('Ferrari SF-26'));
  assert.ok(html.includes('parseGlbBinary'));
  assert.ok(html.includes('QUALITY_PRESETS'));

  const match = html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(match && match[1].length > 50_000, 'expected bundled WebGPU engine script inside posillipo/index.html');
  assert.doesNotThrow(() => {
    new vm.Script(match[1], { filename: 'posillipo/index.html' });
  }, 'bundled JS in posillipo/index.html must parse with zero syntax errors');
});
