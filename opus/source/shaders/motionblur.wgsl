// ---------------------------------------------------------------------------
// motionblur.wgsl — desfoque por velocidade (tile max + neighbor max + gather)
// ---------------------------------------------------------------------------
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<uniform> G: Globals;
@group(0) @binding(2) var gVel: texture_2d<f32>;
@group(0) @binding(3) var tileOut: texture_storage_2d<rgba16float, write>;
const TILE: i32 = 16;

// escala de velocidade: obturador de 1/120 s independente da taxa de quadros
fn velScale() -> f32 { return clamp((1.0 / 160.0) / max(G.time.y, 1e-4), 0.0, 2.0) * G.hud2.x; }

@compute @workgroup_size(8, 8)
fn csTileMax(@builtin(global_invocation_id) gid: vec3u) {
  let td = textureDimensions(tileOut);
  if (gid.x >= td.x || gid.y >= td.y) { return; }
  var best = vec2f(0.0); var bl = 0.0;
  let base = vec2i(gid.xy) * TILE;
  let dim = vec2i(V.res.xy);
  for (var y = 0; y < TILE; y += 2) { for (var x = 0; x < TILE; x += 2) {
    let p = min(base + vec2i(x, y), dim - 1);
    let v = textureLoad(gVel, p, 0).xy * V.res.xy * velScale();
    let l = dot(v, v);
    if (l > bl) { bl = l; best = v; }
  } }
  textureStore(tileOut, gid.xy, vec4f(best, 0.0, 0.0));
}

@group(0) @binding(4) var tileIn: texture_2d<f32>;
@group(0) @binding(5) var nbOut: texture_storage_2d<rgba16float, write>;
@compute @workgroup_size(8, 8)
fn csNeighborMax(@builtin(global_invocation_id) gid: vec3u) {
  let td = vec2i(textureDimensions(nbOut));
  if (i32(gid.x) >= td.x || i32(gid.y) >= td.y) { return; }
  var best = vec2f(0.0); var bl = 0.0;
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let p = clamp(vec2i(gid.xy) + vec2i(x, y), vec2i(0), td - 1);
    let v = textureLoad(tileIn, p, 0).xy;
    let l = dot(v, v);
    if (l > bl) { bl = l; best = v; }
  } }
  textureStore(nbOut, gid.xy, vec4f(best, 0.0, 0.0));
}

@group(0) @binding(6) var colorIn: texture_2d<f32>;
@group(0) @binding(7) var nbIn: texture_2d<f32>;
@group(0) @binding(8) var gDepth: texture_depth_2d;
@group(0) @binding(9) var linClamp: sampler;
@group(0) @binding(10) var mbOut: texture_storage_2d<rgba16float, write>;

fn linZ(d: f32) -> f32 { return V.camPos.w / max(d, 1e-7); }
fn cone(dist: f32, vl: f32) -> f32 { return clamp(1.0 - dist / max(vl, 1e-3), 0.0, 1.0); }
fn cyl(dist: f32, vl: f32) -> f32 { return 1.0 - smoothstep(0.95 * vl, 1.05 * vl, dist); }
fn softD(za: f32, zb: f32) -> f32 { return clamp(1.0 - (za - zb) / (0.02 * min(za, zb) + 0.05), 0.0, 1.0); }

@compute @workgroup_size(8, 8)
fn csMotionBlur(@builtin(global_invocation_id) gid: vec3u) {
  let px = vec2i(gid.xy);
  let dim = vec2i(V.res.xy);
  if (px.x >= dim.x || px.y >= dim.y) { return; }
  let c0 = textureLoad(colorIn, px, 0);
  let jn = vec2f(ign(vec2f(px), G.time.z), ign(vec2f(px.yx) + 17.0, G.time.z)) - 0.5;
  let tp = clamp(vec2i((vec2f(px) + jn * f32(TILE)) / f32(TILE)), vec2i(0), vec2i(textureDimensions(nbIn)) - 1);
  let nb = textureLoad(nbIn, tp, 0).xy;
  let nl = length(nb);
  if (nl < 0.6) { textureStore(mbOut, px, c0); return; }
  let maxLen = 36.0;
  var vn = nb; if (nl > maxLen) { vn = nb * (maxLen / nl); }
  let vC = textureLoad(gVel, px, 0).xy * V.res.xy * velScale();
  let vCl = min(length(vC), maxLen);
  let zC = linZ(textureLoad(gDepth, px, 0));
  let noise = ign(vec2f(px), G.time.z) - 0.5;
  let S = 14;
  var sum = c0.rgb * (1.0 / max(vCl, 1.0)); var wsum = 1.0 / max(vCl, 1.0);
  for (var i = 0; i < S; i++) {
    if (i == S / 2) { continue; }
    let t = mix(-1.0, 1.0, (f32(i) + noise + 1.0) / f32(S + 1));
    let off = vn * (t * 0.5);
    let sp = clamp(vec2i(vec2f(px) + off + 0.5), vec2i(0), dim - 1);
    let vS = textureLoad(gVel, sp, 0).xy * V.res.xy * velScale();
    let vSl = min(length(vS), maxLen);
    let zS = linZ(textureLoad(gDepth, sp, 0));
    let dist = length(off);
    let f = softD(zC, zS); let b = softD(zS, zC);
    let w = f * cone(dist, vSl) + b * cone(dist, vCl) + cyl(dist, vSl) * cyl(dist, vCl) * 2.0;
    sum += textureLoad(colorIn, sp, 0).rgb * w; wsum += w;
  }
  textureStore(mbOut, px, vec4f(sum / wsum, 1.0));
}
