// ---------------------------------------------------------------------------
// tonemap.wgsl — exposição, bloom, curva filmica, gradação, nitidez, HUD
// ---------------------------------------------------------------------------
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<uniform> G: Globals;
@group(0) @binding(2) var colTex: texture_2d<f32>;
@group(0) @binding(3) var bloomTex: texture_2d<f32>;
@group(0) @binding(4) var linClamp: sampler;
@group(0) @binding(5) var hudTex: texture_2d<f32>;

struct FsIn { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex
fn vsFull(@builtin(vertex_index) i: u32) -> FsIn {
  var o: FsIn;
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}
// ACES (ajuste de Hill)
fn acesFit(c: vec3f) -> vec3f {
  let m1 = mat3x3f(vec3f(0.59719, 0.07600, 0.02840), vec3f(0.35458, 0.90834, 0.13383), vec3f(0.04823, 0.01566, 0.83777));
  let m2 = mat3x3f(vec3f(1.60475, -0.10208, -0.00327), vec3f(-0.53108, 1.10813, -0.07276), vec3f(-0.07367, -0.00605, 1.07602));
  let v = m1 * c;
  let a = v * (v + 0.0245786) - 0.000090537;
  let b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp(m2 * (a / b), vec3f(0.0), vec3f(1.0));
}
fn srgb(c: vec3f) -> vec3f {
  return select(1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055, c * 12.92, c <= vec3f(0.0031308));
}
fn hudGlyph(p: vec2f, ch: u32) -> f32 {
  // atlas: 16 células por linha, 64x96 px cada, linha 0 = '0'..'9', 'k','m','/','h',':','.'
  let cell = vec2f(f32(ch % 16u), f32(ch / 16u));
  let uv = (cell + p) * vec2f(64.0, 96.0) / vec2f(textureDimensions(hudTex));
  return textureSampleLevel(hudTex, linClamp, uv, 0.0).r;
}
fn hud(px: vec2f) -> vec4f {
  // canto inferior direito: velocidade
  let sc = V.res.y / 1440.0;
  let org = vec2f(V.res.x - 330.0 * sc, V.res.y - 150.0 * sc);
  let q = (px - org) / sc;
  var a = 0.0;
  let spd = u32(clamp(G.hud.x, 0.0, 999.0));
  let digits = array<u32, 3>(spd / 100u, (spd / 10u) % 10u, spd % 10u);
  for (var k = 0; k < 3; k++) {
    if (k == 0 && spd < 100u) { continue; }
    if (k == 1 && spd < 10u) { continue; }
    let o = vec2f(f32(k) * 56.0, 0.0);
    let lp = (q - o) / vec2f(64.0, 96.0);
    if (all(lp >= vec2f(0.0)) && all(lp < vec2f(1.0))) { a = max(a, hudGlyph(lp, digits[k])); }
  }
  // "km/h"
  for (var k = 0; k < 4; k++) {
    let o = vec2f(176.0 + f32(k) * 22.0, 52.0);
    let lp = (q - o) / vec2f(32.0, 48.0);
    if (all(lp >= vec2f(0.0)) && all(lp < vec2f(1.0))) { a = max(a, hudGlyph(lp, 10u + u32(k)) * 0.85); }
  }
  // tempo de volta (canto superior esquerdo): m:ss.d
  let org2 = vec2f(48.0 * sc, 40.0 * sc);
  let q2 = (px - org2) / sc;
  let t = max(G.hud.z, 0.0);
  let mm = u32(t / 60.0) % 10u; let ss = u32(t) % 60u; let ds = u32(fract(t) * 10.0);
  let ch = array<u32, 6>(mm, 14u, ss / 10u, ss % 10u, 15u, ds);
  var xo = 0.0;
  for (var k = 0; k < 6; k++) {
    let w = select(24.0, 12.0, k == 1 || k == 4);
    let lp = (q2 - vec2f(xo - select(0.0, 9.0, k == 1 || k == 4), 0.0)) / vec2f(32.0, 48.0);
    if (all(lp >= vec2f(0.0)) && all(lp < vec2f(1.0))) { a = max(a, hudGlyph(lp, ch[k]) * 0.9); }
    xo += w;
  }
  return vec4f(vec3f(1.0), a * G.misc.w);
}

@fragment
fn fsTone(i: FsIn) -> @location(0) vec4f {
  let px = vec2i(i.pos.xy);
  let dim = vec2i(V.res.xy);
  // nitidez adaptativa (CAS simplificado)
  let c = textureLoad(colTex, px, 0).rgb;
  let n = textureLoad(colTex, clamp(px + vec2i(0, -1), vec2i(0), dim - 1), 0).rgb;
  let s = textureLoad(colTex, clamp(px + vec2i(0, 1), vec2i(0), dim - 1), 0).rgb;
  let w = textureLoad(colTex, clamp(px + vec2i(-1, 0), vec2i(0), dim - 1), 0).rgb;
  let e = textureLoad(colTex, clamp(px + vec2i(1, 0), vec2i(0), dim - 1), 0).rgb;
  let mn = min(c, min(min(n, s), min(w, e))); let mx = max(c, max(max(n, s), max(w, e)));
  let amp = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, vec3f(1e-4)), vec3f(0.0), vec3f(1.0)));
  let wgt = -amp * 0.1;
  var col = max((c + (n + s + w + e) * wgt) / (1.0 + 4.0 * wgt), vec3f(0.0));
  // bloom
  let b = textureSampleLevel(bloomTex, linClamp, i.uv, 0.0).rgb / 6.0;
  col = mix(col, b, 0.055);
  // exposição
  col *= G.misc.y;
  // gradação: leve aquecimento nos médios, sombras um pouco frias
  let l = luminance(col);
  col = mix(col, col * vec3f(0.96, 1.0, 1.08), (1.0 - smoothstep(0.0, 0.18, l)) * 0.35);
  col = mix(col, col * vec3f(1.04, 1.0, 0.95), smoothstep(0.1, 0.8, l) * 0.4);
  var tc = acesFit(col * 1.0);
  // leve elevação das sombras (evita pretos esmagados)
  tc = tc + vec3f(0.008) * (1.0 - tc) * (1.0 - smoothstep(0.0, 0.25, luminance(tc)));
  // saturação leve
  let tl = luminance(tc);
  tc = mix(vec3f(tl), tc, 1.16);
  // curva em S leve
  tc = clamp(tc + (tc - 0.5) * 0.11 * (1.0 - abs(tc - 0.5) * 2.0), vec3f(0.0), vec3f(1.0));
  // vinheta
  let vv = i.uv - 0.5;
  tc *= 1.0 - dot(vv, vv) * 0.42;
  var o = srgb(clamp(tc, vec3f(0.0), vec3f(1.0)));
  // grão de filme sutil
  let gn = ign(i.pos.xy, G.time.z * 7.0) - 0.5;
  o += gn * 0.005;
  // HUD
  if (G.misc.w > 0.0) {
    let h = hud(i.pos.xy);
    // sombra
    let hs = hud(i.pos.xy - vec2f(2.0, 2.0));
    o = mix(o, vec3f(0.0), hs.a * 0.45);
    o = mix(o, h.rgb, h.a);
  }
  return vec4f(o, 1.0);
}
