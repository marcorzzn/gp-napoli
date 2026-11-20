// ---------------------------------------------------------------------------
// veg_cull.wgsl — culling de árvores por vista + seleção de LOD (desenho indireto)
// ---------------------------------------------------------------------------
struct CullU { planes: array<vec4f, 6>, cam: vec4f, lod: vec4f, cap: vec4f };
@group(0) @binding(0) var<uniform> CU: CullU;
@group(0) @binding(1) var<storage, read> trees: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> vis: array<u32>;
@group(0) @binding(3) var<storage, read_write> args: array<atomic<u32>>;

@compute @workgroup_size(64)
fn csCull(@builtin(global_invocation_id) id: vec3u) {
  let n = arrayLength(&trees) / 2u;
  let i = id.x;
  if (i >= n) { return; }
  let t0 = trees[i * 2u]; let t1 = trees[i * 2u + 1u];
  let sp = u32(t1.y + 0.5);
  let s = t0.w;
  var hc = 8.5; var r = 9.5;
  if (sp == 1u) { hc = 14.0; r = 13.5; } else if (sp == 2u) { hc = 2.3; r = 3.6; } else if (sp == 3u) { hc = 6.5; r = 10.0; }
  let c = t0.xyz + vec3f(0.0, hc * s, 0.0);
  let rr = r * s;
  let kind = u32(CU.cam.w + 0.5);
  let d = distance(c, CU.cam.xyz);
  if (kind != 1u && d > CU.lod.z + rr) { return; }
  let np = select(6u, 4u, kind == 1u);
  for (var k = 0u; k < np; k++) {
    let pl = CU.planes[k];
    if (dot(pl.xyz, c) + pl.w < -rr) { return; }
  }
  if (kind == 1u) {
    // sombras: limita pela distância horizontal à câmera
    if (length(c.xz - CU.cam.xz) > CU.lod.z + rr) { return; }
  }
  var l = 2u;
  if (kind != 2u) {
    if (d < CU.lod.x) { l = 0u; } else if (d < CU.lod.y) { l = 1u; }
    if (kind == 1u && CU.lod.w >= 3.0) { l = 2u; }
    if (kind == 1u && (CU.lod.w == 1.0 || CU.lod.w == 2.0)) { l = max(l, 1u); }
  }
  let v = u32(CU.cap.w + 0.5);
  let a = (v * 12u + l * 4u + sp) * 5u;
  let slot = atomicAdd(&args[a + 1u], 1u);
  let cap = u32(CU.cap[l]);
  if (slot >= cap) { atomicSub(&args[a + 1u], 1u); return; }
  let base = atomicLoad(&args[a + 4u]);
  vis[base + slot] = i;
}
