// ---------------------------------------------------------------------------
// volumetric.wgsl — névoa próxima com sombra do sol (raios entre as árvores)
// meia resolução; saída rgb = luz espalhada, a = transmitância
// ---------------------------------------------------------------------------
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<uniform> G: Globals;
@group(0) @binding(2) var gDepth: texture_depth_2d;
@group(0) @binding(3) var shadowTex: texture_depth_2d_array;
@group(0) @binding(4) var shadowCmp: sampler_comparison;
@group(0) @binding(5) var skyLoTex: texture_2d<f32>;
@group(0) @binding(6) var linClamp: sampler;
@group(0) @binding(7) var volOut: texture_storage_2d<rgba16float, write>;

fn shadowAt(wp: vec3f, viewZ: f32) -> f32 {
  var c = 3;
  if (viewZ < G.cascadeSplits.z) { c = 2; }
  if (viewZ < G.cascadeSplits.y) { c = 1; }
  if (viewZ > G.cascadeSplits.w) { return 1.0; }
  let sp = G.shadowVP[c] * vec4f(wp, 1.0);
  let uv = sp.xy * vec2f(0.5, -0.5) + 0.5;
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { return 1.0; }
  return textureSampleCompareLevel(shadowTex, shadowCmp, uv, c, sp.z + 0.00003);
}
fn hg(c: f32, g: f32) -> f32 { let g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }

@compute @workgroup_size(8, 8)
fn csVol(@builtin(global_invocation_id) gid: vec3u) {
  let hd = textureDimensions(volOut);
  if (gid.x >= hd.x || gid.y >= hd.y) { return; }
  let fp = vec2i(gid.xy) * 2 + vec2i(1);
  let d = textureLoad(gDepth, min(fp, vec2i(V.res.xy) - 1), 0);
  let uv = (vec2f(fp) + 0.5) * V.res.zw;
  var far = G.fog.w;
  let ndc = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, max(d, 1e-7), 1.0);
  let w = V.invViewProj * ndc;
  let wp = w.xyz / w.w;
  let cam = V.camPos.xyz;
  var dist = length(wp - cam);
  if (d <= 0.0) { dist = far; }
  let rd = normalize(wp - cam);
  let tMax = min(dist, far);
  let N = 14;
  let noise = ign(vec2f(gid.xy), G.time.z);
  let dt = tMax / f32(N);
  let cth = dot(rd, G.sunDir.xyz);
  let ph = mix(hg(cth, 0.72), hg(cth, -0.1), 0.25);
  let amb = textureSampleLevel(skyLoTex, linClamp, dirToPano(normalize(vec3f(rd.x, max(rd.y, 0.05), rd.z))), 4.0).rgb;
  var T = 1.0; var Ls = vec3f(0.0);
  let fwd = V.camFwd.xyz;
  for (var i = 0; i < N; i++) {
    let t = (f32(i) + noise) * dt;
    let p = cam + rd * t;
    let dens = 0.75 * G.fog.x * exp(-max(p.y - G.fog.z, -20.0) * G.fog.y) * (1.0 + 0.6 * exp(-max(p.y - G.fog.z + 1.0, 0.0) * 0.35));
    let sh = shadowAt(p, t * dot(rd, fwd));
    let sc = dens * (G.sunColor.rgb * sh * min(ph, 0.4) * 0.9 + amb * 0.8);
    let Ti = exp(-dens * dt);
    Ls += T * sc * (1.0 - Ti) / max(dens, 1e-7);
    T *= Ti;
  }
  textureStore(volOut, gid.xy, vec4f(Ls, T));
}
