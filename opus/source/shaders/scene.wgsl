// ---------------------------------------------------------------------------
// scene.wgsl — bindings da cena + utilidades de material compartilhadas
// ---------------------------------------------------------------------------
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<uniform> G: Globals;
@group(0) @binding(2) var sampRep: sampler;
@group(0) @binding(3) var detailTex: texture_2d_array<f32>;
@group(0) @binding(4) var leafAlbTex: texture_2d_array<f32>;
@group(0) @binding(5) var leafNrmTex: texture_2d_array<f32>;
@group(0) @binding(6) var maskTex: texture_2d<f32>;
@group(0) @binding(7) var<storage, read> TD: array<vec4f>;
@group(0) @binding(8) var textTex: texture_2d<f32>;
@group(0) @binding(9) var sampClamp: sampler;
@group(0) @binding(10) var heightTex: texture_2d<f32>;
@group(0) @binding(11) var skyLoTex: texture_2d<f32>;
@group(0) @binding(12) var shadowTex: texture_depth_2d_array;
@group(0) @binding(13) var shadowSamp: sampler_comparison;
@group(1) @binding(0) var<uniform> O: Obj;

struct Surf {
  albedo: vec3f, rough: f32,
  n: vec3f, metal: f32,
  ao: f32, clear: f32, wet: f32, emis: f32,
  cls: u32, alpha: f32,
};
fn surfDefault(n: vec3f) -> Surf { return Surf(vec3f(0.5), 0.6, n, 0.0, 1.0, 0.0, 0.0, 0.0, 0u, 1.0); }

// dados da pista por amostra (2 vec4 por amostra)
//  [0]: hw, racing, wet, brake   [1]: kerbL, kerbR, gravL, gravR
fn trackData(s: f32, row: u32) -> vec4f {
  let N = u32(G.track.y);
  let f = s / G.track.z;
  let i0 = u32(floor(f)) % N; let i1 = (i0 + 1u) % N;
  return mix(TD[i0 * 2u + row], TD[i1 * 2u + row], fract(f));
}
// frame tangente por derivadas (sem atributo de tangente)
fn perturb(n: vec3f, p: vec3f, uv: vec2f, tn: vec3f) -> vec3f {
  let dp1 = dpdx(p); let dp2 = dpdy(p); let du1 = dpdx(uv); let du2 = dpdy(uv);
  let dp2p = cross(dp2, n); let dp1p = cross(n, dp1);
  let T = dp2p * du1.x + dp1p * du2.x;
  let B = dp2p * du1.y + dp1p * du2.y;
  let im = inverseSqrt(max(max(dot(T, T), dot(B, B)), 1e-20));
  return normalize(T * im * tn.x + B * im * tn.y + n * tn.z);
}
// normal de detalhe projetada no plano XZ do mundo (superfícies ~horizontais)
fn detailNXZ(layer: i32, p: vec2f, scale: f32, bias: f32) -> vec4f {
  let s = textureSampleBias(detailTex, sampRep, p / scale, layer, bias);
  return vec4f(s.xy * 2.0 - 1.0, s.z, s.w);
}
fn applyNXZ(n: vec3f, d: vec2f, k: f32) -> vec3f {
  // n quase vertical: perturba em x/z (z da textura = z do mundo)
  return normalize(n + vec3f(d.x, 0.0, d.y) * k);
}
fn velocity(cur: vec4f, prev: vec4f) -> vec2f {
  let a = cur.xy / cur.w; let b = prev.xy / prev.w;
  return (a - b) * vec2f(0.5, -0.5);
}

struct GOut {
  @location(0) albedo: vec4f,
  @location(1) normal: vec4f,
  @location(2) misc: vec4f,
  @location(3) vel: vec2f,
};
fn packG(s: Surf, cur: vec4f, prev: vec4f) -> GOut {
  var o: GOut;
  o.albedo = vec4f(s.albedo, f32(s.cls) / 255.0);
  o.normal = vec4f(octEncode(s.n), s.rough, s.metal);
  o.misc = vec4f(s.ao, s.clear, s.wet, sqrt(clamp(s.emis / 64.0, 0.0, 1.0)));
  o.vel = velocity(cur, prev);
  return o;
}

// ------------- iluminação simplificada (cubo de reflexo) -------------
fn skyLo(d: vec3f, lod: f32) -> vec3f { return textureSampleLevel(skyLoTex, sampClamp, dirToPano(d), lod).rgb; }
fn shadowSimple(wp: vec3f, c: i32) -> f32 {
  let sp = G.shadowVP[c] * vec4f(wp, 1.0);
  let uv = sp.xy * vec2f(0.5, -0.5) + 0.5;
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { return 1.0; }
  return textureSampleCompareLevel(shadowTex, shadowSamp, uv, c, sp.z + 0.0015);
}
fn fogApply(col: vec3f, wp: vec3f, cam: vec3f) -> vec3f {
  let d = wp - cam; let dist = length(d); let rd = d / max(dist, 1e-3);
  let dens = G.fog.x;
  let hf = G.fog.y;
  let h0 = cam.y - G.fog.z;
  // névoa de altura integrada analiticamente
  let k = max(abs(rd.y) * hf, 1e-4);
  var od = dens * exp(-h0 * hf) * (1.0 - exp(-dist * k)) / k;
  od = max(od, 0.0);
  let fogC = skyLo(normalize(vec3f(rd.x, max(rd.y, 0.02), rd.z)), 4.0);
  let sunAmt = pow(max(dot(rd, G.sunDir.xyz), 0.0), 8.0);
  let fc = fogC + G.sunColor.rgb * sunAmt * 0.04;
  return mix(col, fc, 1.0 - exp(-od));
}
fn shadeForward(s: Surf, wp: vec3f, cam: vec3f) -> vec3f {
  let L = G.sunDir.xyz;
  let NoL = max(dot(s.n, L), 0.0);
  let sh = shadowSimple(wp, 3);
  let amb = shIrradiance(s.n, G.sh) * 1.9 * s.ao;
  var c = s.albedo * (1.0 - s.metal) * (amb + G.sunColor.rgb * NoL * sh / PI);
  if (s.cls == 1u) { c += s.albedo * G.sunColor.rgb * 0.15 * max(dot(-s.n, L), 0.0) * sh; }
  let V = normalize(cam - wp);
  let R = reflect(-V, s.n);
  let f0 = mix(vec3f(0.04), s.albedo, s.metal);
  c += skyLo(R, s.rough * 6.0) * envBRDF(f0, s.rough, max(dot(s.n, V), 0.01)) * s.ao;
  c += s.albedo * s.emis;
  return fogApply(c, wp, cam);
}
