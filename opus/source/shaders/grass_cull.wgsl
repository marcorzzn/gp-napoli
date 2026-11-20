// ---------------------------------------------------------------------------
// grass_cull.wgsl — seleciona as touceiras visíveis (densidade, distância, frustum)
// ---------------------------------------------------------------------------
struct CullU { planes: array<vec4f, 6>, cam: vec4f, lod: vec4f, cap: vec4f };
@group(0) @binding(0) var<uniform> CU: CullU;
@group(0) @binding(1) var<uniform> G: Globals;
@group(0) @binding(2) var maskTex: texture_2d<f32>;
@group(0) @binding(3) var samp: sampler;
@group(0) @binding(4) var heightTex: texture_2d<f32>;
@group(0) @binding(5) var<storage, read_write> clumps: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> gargs: array<atomic<u32>>;
const GN: u32 = 200u;
const GCELL: f32 = 0.45;
fn terrainH(xz: vec2f) -> f32 {
  let f = (xz - G.terrain.xy) * G.terrain.z;
  let i = vec2i(floor(f)); let t = fract(f);
  let n = i32(G.terrain.w) - 1;
  let a = textureLoad(heightTex, clamp(i, vec2i(0), vec2i(n)), 0).r;
  let b = textureLoad(heightTex, clamp(i + vec2i(1, 0), vec2i(0), vec2i(n)), 0).r;
  let c = textureLoad(heightTex, clamp(i + vec2i(0, 1), vec2i(0), vec2i(n)), 0).r;
  let d = textureLoad(heightTex, clamp(i + vec2i(1, 1), vec2i(0), vec2i(n)), 0).r;
  if (t.x > t.y) { return a + (b - a) * t.x + (d - b) * t.y; }
  return a + (d - c) * t.x + (c - a) * t.y;
}
@compute @workgroup_size(8, 8)
fn csGrassCull(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= GN || id.y >= GN) { return; }
  let camPos = CU.cam.xyz;
  let snap = floor(camPos.xz / GCELL);
  let cell = snap + vec2f(f32(id.x), f32(id.y)) - f32(GN / 2u);
  let h0 = hash22(cell * 1.31 + 7.0);
  let base = (cell + h0) * GCELL;
  let muv = (base - G.mask.xy) * G.mask.z;
  let m = textureSampleLevel(maskTex, samp, muv, 0.0);
  let dens = m.g * (1.0 - m.a * 0.7) * (1.0 - m.r);
  let dist = length(base - camPos.xz);
  let fade = 1.0 - smoothstep(26.0, 42.0, dist);
  let hh = hash21(cell * 3.7 + 1.0);
  if (hh > dens * 1.6 * fade || dens < 0.06) { return; }
  let y = terrainH(base);
  let c = vec3f(base.x, y + 0.4, base.y);
  for (var k = 0u; k < 6u; k++) {
    let pl = CU.planes[k];
    if (dot(pl.xyz, c) + pl.w < -1.2) { return; }
  }
  let slot = atomicAdd(&gargs[1], 1u);
  clumps[slot * 2u] = vec4f(base.x, y, base.y, dens);
  clumps[slot * 2u + 1u] = vec4f(cell, fade, 0.0);
}
