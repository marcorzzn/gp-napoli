// ---------------------------------------------------------------------------
// bloom.wgsl — cadeia de redução (13 taps, média de Karis no 1º nível) e
// ampliação em tenda com soma
// ---------------------------------------------------------------------------
@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var linClamp: sampler;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var<uniform> BPm: vec4f;   // x: primeiro nível (karis), y: raio
@group(0) @binding(4) var addTex: texture_2d<f32>;

fn karis(c: vec3f) -> f32 { return 1.0 / (1.0 + luminance(c)); }
@compute @workgroup_size(8, 8)
fn csDown(@builtin(global_invocation_id) gid: vec3u) {
  let dd = textureDimensions(dstTex);
  if (gid.x >= dd.x || gid.y >= dd.y) { return; }
  let ts = 1.0 / vec2f(textureDimensions(srcTex));
  let uv = (vec2f(gid.xy) + 0.5) / vec2f(dd);
  let a = textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(-2, -2), 0.0).rgb;
  let b = textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(0, -2), 0.0).rgb;
  let c = textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(2, -2), 0.0).rgb;
  let d = textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(-2, 0), 0.0).rgb;
  let e = textureSampleLevel(srcTex, linClamp, uv, 0.0).rgb;
  let f = textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(2, 0), 0.0).rgb;
  let g = textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(-2, 2), 0.0).rgb;
  let h = textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(0, 2), 0.0).rgb;
  let i = textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(2, 2), 0.0).rgb;
  let j = textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(-1, -1), 0.0).rgb;
  let k = textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(1, -1), 0.0).rgb;
  let l = textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(-1, 1), 0.0).rgb;
  let m = textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(1, 1), 0.0).rgb;
  var r: vec3f;
  if (BPm.x > 0.5) {
    let g0 = (j + k + l + m) * 0.25; let g1 = (a + b + d + e) * 0.25; let g2 = (b + c + e + f) * 0.25;
    let g3 = (d + e + g + h) * 0.25; let g4 = (e + f + h + i) * 0.25;
    let w0 = karis(g0) * 0.5; let w1 = karis(g1) * 0.125; let w2 = karis(g2) * 0.125; let w3 = karis(g3) * 0.125; let w4 = karis(g4) * 0.125;
    r = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
    r = min(r, vec3f(6e4));
  } else {
    r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  textureStore(dstTex, gid.xy, vec4f(r, 1.0));
}
@compute @workgroup_size(8, 8)
fn csUp(@builtin(global_invocation_id) gid: vec3u) {
  let dd = textureDimensions(dstTex);
  if (gid.x >= dd.x || gid.y >= dd.y) { return; }
  let uv = (vec2f(gid.xy) + 0.5) / vec2f(dd);
  let ts = 1.0 / vec2f(textureDimensions(srcTex)) * BPm.y;
  var r = textureSampleLevel(srcTex, linClamp, uv, 0.0).rgb * 4.0;
  r += (textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(-1, 0), 0.0).rgb + textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(1, 0), 0.0).rgb +
        textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(0, -1), 0.0).rgb + textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(0, 1), 0.0).rgb) * 2.0;
  r += textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(-1, -1), 0.0).rgb + textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(1, -1), 0.0).rgb +
       textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(-1, 1), 0.0).rgb + textureSampleLevel(srcTex, linClamp, uv + ts * vec2f(1, 1), 0.0).rgb;
  r /= 16.0;
  let base = textureSampleLevel(addTex, linClamp, uv, 0.0).rgb;
  textureStore(dstTex, gid.xy, vec4f(base + r, 1.0));
}
