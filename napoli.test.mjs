import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let _cached = null;
function loadTrackContext() {
  if (_cached) return _cached;
  const mathSrc = fs.readFileSync('napoli/source/js/00_math.js', 'utf8');
  const trackSrc = fs.readFileSync('napoli/source/js/10_track.js', 'utf8');
  const aiSrc = fs.readFileSync('napoli/source/js/42_ai.js', 'utf8');
  const ctx = {
    Math,
    Float32Array,
    Float64Array,
    Int32Array,
    Uint8Array,
    Uint32Array,
    Array,
    console,
    VP: { L: 2.362 },
    VEH: { x: 0, z: 0, yaw: 0, vx: 10, vy: 0, r: 0, steer: 0, s: 0, steps: 0 },
    K_W: 1, K_S: 2, K_A: 4, K_D: 8, K_SPACE: 16, K_C: 32, K_R: 64, K_V: 128,
  };
  vm.createContext(ctx);
  _cached = vm.runInContext(
    `${mathSrc}\n${trackSrc}\n${aiSrc}\ntrackBuild();\naiBuild();\n({ TRK, AI, naturalH, forestAt });`,
    ctx
  );
  return _cached;
}

test('Lungomare di Napoli track geometry is closed, anti-clockwise, non-self-intersecting, and ~1,275 m', () => {
  const { TRK, AI } = loadTrackContext();

  assert.ok(TRK.N > 1000, `expected >1000 centerline samples, got ${TRK.N}`);
  assert.ok(
    TRK.L >= 1180 && TRK.L <= 1380,
    `expected Napoli circuit length ~1275 m (1180..1380), got ${TRK.L.toFixed(1)} m`
  );

  // Start-to-end closure check
  const dx = TRK.x[TRK.N - 1] - TRK.x[0];
  const dz = TRK.z[TRK.N - 1] - TRK.z[0];
  const stepGap = Math.hypot(dx, dz);
  assert.ok(stepGap < TRK.ds * 2.2, `track closure gap too large: ${stepGap.toFixed(2)} m`);

  // Verify 7 chicanes exist and lie within [0, TRK.L)
  assert.equal(TRK.chicanes.length, 7, 'circuit must define 7 chicanes matching Napoli Racing Show Arena');
  for (const ch of TRK.chicanes) {
    assert.ok(ch.s0 >= 0 && ch.s1 > ch.s0 && ch.s1 <= TRK.L, `chicane [${ch.s0}, ${ch.s1}] out of range`);
  }

  // Verify Rotonda Diaz protrudes seawards (+Z)
  let maxZ = -Infinity;
  for (let i = 0; i < TRK.N; i++) {
    if (TRK.z[i] > maxZ) maxZ = TRK.z[i];
  }
  assert.ok(maxZ > 25, `Rotonda Diaz should protrude seawards (z > 25), got maxZ=${maxZ.toFixed(1)}`);

  // Signed area check in (x, -z) (North = -z, East = +x): anti-clockwise loop has positive signed area
  let area2 = 0;
  for (let i = 0; i < TRK.N; i++) {
    const j = (i + 1) % TRK.N;
    const x0 = TRK.x[i], y0 = -TRK.z[i];
    const x1 = TRK.x[j], y1 = -TRK.z[j];
    area2 += x0 * y1 - x1 * y0;
  }
  assert.ok(area2 > 0, `expected anti-clockwise track loop in map coordinates (North=-z), got area2=${area2.toFixed(1)}`);

  // Non-self-intersection check on coarse 12 m segments (excluding adjacent segments)
  const stride = Math.max(1, Math.round(12 / TRK.ds));
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
  assert.equal(crossings, 0, `track centerline must not self-intersect, found ${crossings} crossings`);

  // Verify AI speed profile is finite and strictly positive
  assert.equal(AI.vt.length, TRK.N);
  for (let i = 0; i < TRK.N; i++) {
    assert.ok(Number.isFinite(AI.vt[i]) && AI.vt[i] > 5, `invalid AI target speed at ${i}: ${AI.vt[i]}`);
  }
});

test('Bay of Naples coastal terrain, Vesuvius, Megaride islet, and vegetation exclusion work as designed', () => {
  const { naturalH, forestAt } = loadTrackContext();

  // Gulf of Naples open sea is at sea level (0)
  assert.equal(naturalH(400, 300), 0, 'open Gulf of Naples should be at y=0');
  // Megaride islet (Castel dell'Ovo) rises out of the bay
  assert.ok(naturalH(760, 115) > 3.0, `Megaride islet should rise above water, got ${naturalH(760, 115)}`);
  // Mount Vesuvius dominates the eastern horizon
  assert.ok(naturalH(3450, -220) > 450, `Vesuvius peak should exceed 450 m, got ${naturalH(3450, -220)}`);
  // No trees in the sea, on Mappatella beach, on the promenade, or inside Tribuna/Event Village clearing
  assert.equal(forestAt(100, 100), 0, 'no trees allowed in the sea');
  assert.equal(forestAt(80, 10), 0, 'no trees allowed on the seafront promenade');
  assert.equal(forestAt(0, -75), 0, 'Tribuna Principale & Event Village area should remain cleared');
  // Villa Comunale park inland east and north of Tribuna has dense tree canopy
  assert.ok(forestAt(160, -75) > 0.4, `Villa Comunale east should have trees, got ${forestAt(160, -75)}`);
  assert.ok(forestAt(0, -105) > 0.4, `Villa Comunale north of Event Village should have trees, got ${forestAt(0, -105)}`);
});

test('Built /napoli/index.html single-HTML WebGPU bundle parses cleanly and embeds Napoli shaders and livery', () => {
  const html = fs.readFileSync('napoli/index.html', 'utf8');
  assert.ok(html.includes('Gran Premio di Napoli · Fiat 127 Napoli 1926'));
  assert.ok(html.includes('FORZA NAPOLI'));
  assert.ok(html.includes('1926S3'));
  assert.ok(html.includes('PAINT_COL'));
  assert.ok(html.includes('world_ground'));
  assert.ok(html.includes('mat_car'));

  // Extract the main inline script and verify it has zero JavaScript syntax errors
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(match && match[1].length > 50_000, 'expected bundled WebGPU engine script inside napoli/index.html');
  assert.doesNotThrow(() => {
    new vm.Script(match[1], { filename: 'napoli/index.html' });
  }, 'bundled JS in napoli/index.html must parse with zero syntax errors');
});
