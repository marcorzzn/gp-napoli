// ---------------------------------------------------------------------------
// taa.wgsl — anti-aliasing temporal (Catmull-Rom + recorte por variância YCoCg)
// ---------------------------------------------------------------------------
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<uniform> G: Globals;
@group(0) @binding(2) var curTex: texture_2d<f32>;
@group(0) @binding(3) var histTex: texture_2d<f32>;
@group(0) @binding(4) var gVel: texture_2d<f32>;
@group(0) @binding(5) var gDepth: texture_depth_2d;
@group(0) @binding(6) var linClamp: sampler;
@group(0) @binding(7) var outTex: texture_storage_2d<rgba16float, write>;

fn rgb2ycocg(c: vec3f) -> vec3f { return vec3f(0.25 * c.r + 0.5 * c.g + 0.25 * c.b, 0.5 * c.r - 0.5 * c.b, -0.25 * c.r + 0.5 * c.g - 0.25 * c.b); }
fn ycocg2rgb(c: vec3f) -> vec3f { return vec3f(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }
// mapeamento reversível para reduzir cintilação de altas luzes
fn tm(c: vec3f) -> vec3f { return c / (1.0 + luminance(c)); }
fn itm(c: vec3f) -> vec3f { return c / max(1.0 - luminance(c), 1e-4); }

fn sampleHistory(uv: vec2f) -> vec3f {
  let dim = vec2f(textureDimensions(histTex));
  let sp = uv * dim;
  let tc = floor(sp - 0.5) + 0.5;
  let f = sp - tc;
  let w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  let w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  let w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  let w3 = f * f * (-0.5 + 0.5 * f);
  let w12 = w1 + w2;
  let o12 = w2 / w12;
  let t0 = (tc - 1.0) / dim; let t3 = (tc + 2.0) / dim; let t12 = (tc + o12) / dim;
  var r = vec3f(0.0);
  r += textureSampleLevel(histTex, linClamp, vec2f(t12.x, t0.y), 0.0).rgb * (w12.x * w0.y);
  r += textureSampleLevel(histTex, linClamp, vec2f(t0.x, t12.y), 0.0).rgb * (w0.x * w12.y);
  r += textureSampleLevel(histTex, linClamp, vec2f(t12.x, t12.y), 0.0).rgb * (w12.x * w12.y);
  r += textureSampleLevel(histTex, linClamp, vec2f(t3.x, t12.y), 0.0).rgb * (w3.x * w12.y);
  r += textureSampleLevel(histTex, linClamp, vec2f(t12.x, t3.y), 0.0).rgb * (w12.x * w3.y);
  let wsum = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
  return max(r / wsum, vec3f(0.0));
}

@compute @workgroup_size(8, 8)
fn csTAA(@builtin(global_invocation_id) gid: vec3u) {
  let px = vec2i(gid.xy);
  let dim = vec2i(V.res.xy);
  if (px.x >= dim.x || px.y >= dim.y) { return; }
  let uv = (vec2f(px) + 0.5) * V.res.zw;
  // vizinhança 3x3
  var m1 = vec3f(0.0); var m2 = vec3f(0.0);
  var mn = vec3f(1e9); var mx = vec3f(-1e9);
  var cur = vec3f(0.0);
  var bestD = -1.0; var bestP = px;
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let p = clamp(px + vec2i(x, y), vec2i(0), dim - 1);
    let c = rgb2ycocg(tm(textureLoad(curTex, p, 0).rgb));
    if (x == 0 && y == 0) { cur = c; }
    m1 += c; m2 += c * c; mn = min(mn, c); mx = max(mx, c);
    let d = textureLoad(gDepth, p, 0);
    if (d > bestD) { bestD = d; bestP = p; }
  } }
  let vel = textureLoad(gVel, bestP, 0).xy;
  let puv = uv - vel;
  let mean = m1 / 9.0;
  let sd = sqrt(max(m2 / 9.0 - mean * mean, vec3f(0.0)));
  let velPx = length(vel * V.res.xy);
  let gamma = mix(1.25, 0.85, clamp(velPx / 12.0, 0.0, 1.0));
  let bmn = max(mn, mean - sd * gamma); let bmx = min(mx, mean + sd * gamma);
  var outc: vec3f;
  if (G.time.z < 1.5 || G.time.w > 0.5 || any(puv < vec2f(0.0)) || any(puv > vec2f(1.0))) {
    // sem histórico (corte de câmera / borda): suavização espacial guiada pelo contraste local
    let con = mx.x - mn.x;
    outc = mix(cur, (mean * 9.0 + cur * 3.0) / 12.0, smoothstep(0.015, 0.12, con) * 0.75);
  } else {
    var h = rgb2ycocg(tm(sampleHistory(puv)));
    // recorte em direção ao centro da AABB
    let c = (bmx + bmn) * 0.5; let e = (bmx - bmn) * 0.5 + 1e-5;
    let off = h - c; let ts = abs(off / e);
    let mxs = max(ts.x, max(ts.y, ts.z));
    if (mxs > 1.0) { h = c + off / mxs; }
    // fator de mistura: mais atual quando há movimento rápido (menos fantasma)
    var a = mix(0.08, 0.22, clamp(velPx / 30.0, 0.0, 1.0));
    // anti-cintilação: pesos por luminância
    let wc = a / (1.0 + cur.x); let wh = (1.0 - a) / (1.0 + h.x);
    outc = (cur * wc + h * wh) / (wc + wh);
  }
  textureStore(outTex, px, vec4f(itm(ycocg2rgb(outc)), 1.0));
}
