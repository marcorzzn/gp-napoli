// ---------------------------------------------------------------------------
// fx.wgsl — marcas de pneu (multiplicam o albedo do G-buffer) e fumaça
// ---------------------------------------------------------------------------
struct DIn { @location(0) pos: vec3f, @location(1) p: vec2f };
struct DOut { @builtin(position) clip: vec4f, @location(0) p: vec2f, @location(1) w: vec3f };
@vertex
fn vsDecal(v: DIn) -> DOut {
  var o: DOut; o.clip = V.viewProj * vec4f(v.pos, 1.0); o.p = v.p; o.w = v.pos; return o;
}
struct DecOut { @location(0) a: vec4f, @location(1) b: vec4f, @location(2) c: vec4f, @location(3) d: vec2f };
@fragment
fn fsDecal(i: DOut) -> DecOut {
  var o: DecOut;
  let edge = 1.0 - smoothstep(0.55, 1.0, abs(i.p.y));
  let grain = 0.7 + 0.3 * vnoise2(i.w.xz * vec2f(9.0, 9.0)) ;
  let tread = 0.85 + 0.15 * step(0.5, fract(i.p.y * 2.5 + 0.5));
  let k = clamp(i.p.x, 0.0, 1.0) * edge * grain * tread;
  o.a = vec4f(vec3f(mix(1.0, 0.28, k)), 1.0);
  return o;
}

struct SIn { @location(0) a: vec4f, @location(1) b: vec4f };
struct SOut2 { @builtin(position) clip: vec4f, @location(0) uv: vec2f, @location(1) @interpolate(flat) prm: vec4f, @location(2) @interpolate(flat) col: vec3f, @location(3) vz: f32, @location(4) nuv: vec2f };
@group(2) @binding(0) var depthTex: texture_depth_2d;
@vertex
fn vsSmoke(@builtin(vertex_index) vi: u32, s: SIn) -> SOut2 {
  var o: SOut2;
  let c = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  let rot = s.b.y;
  let cr = cos(rot); let sr = sin(rot);
  let q = vec2f(c.x * cr - c.y * sr, c.x * sr + c.y * cr);
  let right = vec3f(V.view[0][0], V.view[1][0], V.view[2][0]);
  let up = vec3f(V.view[0][1], V.view[1][1], V.view[2][1]);
  let wp = s.a.xyz + (right * q.x + up * q.y) * s.a.w;
  o.clip = V.viewProj * vec4f(wp, 1.0);
  o.uv = c; o.prm = vec4f(s.b.x, s.b.z, s.b.w, s.a.w);
  o.vz = -(V.view * vec4f(wp, 1.0)).z;
  o.nuv = q * 0.22 + vec2f(s.b.z * 0.137, s.b.z * 0.311) + vec2f(s.b.w * 0.05, 0.0);
  // iluminação por partícula (constante): sol com dispersão frontal + céu + névoa
  let Vd = normalize(V.camPos.xyz - s.a.xyz);
  let cosT = dot(-Vd, G.sunDir.xyz);
  let g = 0.55; let ph = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosT, 1.5) * 0.25;
  let sh = shadowSimple(s.a.xyz, 1);
  let amb = shIrradiance(vec3f(0.0, 1.0, 0.0), G.sh) * 1.9;
  let col = vec3f(0.5, 0.51, 0.53) * (amb + G.sunColor.rgb * (0.1 + min(ph, 0.6) * 0.4) * mix(0.35, 1.0, sh));
  o.col = fogApply(col, s.a.xyz, V.camPos.xyz);
  return o;
}
@fragment
fn fsSmoke(i: SOut2) -> @location(0) vec4f {
  let r = length(i.uv);
  if (r > 1.0) { discard; }
  let n = textureSampleLevel(detailTex, sampRep, i.nuv, 3, 2.0).w * 0.65 + textureSampleLevel(detailTex, sampRep, i.nuv * 2.3 + 0.37, 3, 1.0).w * 0.35;
  var a = smoothstep(1.0, 0.0, r) * smoothstep(1.0, 0.0, r) * smoothstep(0.38, 0.8, n * 1.3 + 0.25 * (1.0 - r * r));
  let d = textureLoad(depthTex, vec2i(i.clip.xy), 0);
  let sceneZ = V.camPos.w / max(d, 1e-7);
  a *= clamp((sceneZ - i.vz) / (i.prm.w * 1.6), 0.0, 1.0);
  a *= i.prm.x * clamp((i.vz - 2.0) / 4.0, 0.0, 1.0);
  if (a < 0.004) { discard; }
  return vec4f(i.col * (0.8 + 0.4 * n) * a, a);
}
