// ---------------------------------------------------------------------------
// sky_bake.wgsl — bake (uma vez) da atmosfera + nuvens volumétricas
//   noise3d:  128³ rgba8 (Perlin-Worley + Worley fbm), ladrilhável
//   skyHi:    panorama do hemisfério superior, alta resolução, v = sqrt(elev/90°)
//   skyLo:    panorama equiretangular completo 512x256 (reflexos, névoa, SH)
// ---------------------------------------------------------------------------
struct BakeParams { sunDir: vec4f, sunE: vec4f, rows: vec4f, misc: vec4f };
@group(0) @binding(0) var<uniform> BP: BakeParams;

// ---------- ruído ladrilhável ----------
fn hash3p(p: vec3i, period: i32) -> vec3f {
  let q = vec3u(((p % period) + period) % period);
  let h = pcg(q.x + pcg(q.y + pcg(q.z)));
  let h2 = pcg(h); let h3 = pcg(h2);
  return vec3f(f32(h), f32(h2), f32(h3)) / 4294967295.0;
}
fn worleyT(p: vec3f, period: i32) -> f32 {
  let i = vec3i(floor(p)); let f = fract(p);
  var d = 1.0;
  for (var z = -1; z <= 1; z++) { for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let g = vec3i(x, y, z);
    let o = hash3p(i + g, period);
    let r = vec3f(g) + o - f;
    d = min(d, dot(r, r));
  } } }
  return 1.0 - sqrt(d);
}
fn gradT(p: vec3f, period: i32) -> f32 {
  let i = vec3i(floor(p)); let f = fract(p);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  var acc = array<f32, 8>();
  for (var k = 0; k < 8; k++) {
    let o = vec3i(k & 1, (k >> 1) & 1, (k >> 2) & 1);
    let g = normalize(hash3p(i + o, period) * 2.0 - 1.0);
    acc[k] = dot(g, f - vec3f(o));
  }
  return mix(mix(mix(acc[0], acc[1], u.x), mix(acc[2], acc[3], u.x), u.y), mix(mix(acc[4], acc[5], u.x), mix(acc[6], acc[7], u.x), u.y), u.z);
}
fn remap(x: f32, a: f32, b: f32, c: f32, d: f32) -> f32 { return c + (x - a) / (b - a) * (d - c); }

@group(0) @binding(1) var noiseOut: texture_storage_3d<rgba8unorm, write>;
@compute @workgroup_size(4, 4, 4)
fn csNoise3D(@builtin(global_invocation_id) id: vec3u) {
  if (any(id >= vec3u(128u))) { return; }
  let p = vec3f(id) / 128.0;
  // Perlin fbm (ladrilha em 4,8,16)
  var pf = 0.0; var a = 0.5;
  for (var o = 0; o < 4; o++) { let per = 4 << u32(o); pf += a * gradT(p * f32(per), per); a *= 0.5; }
  pf = pf * 0.5 + 0.5;
  let w1 = worleyT(p * 4.0, 4); let w2 = worleyT(p * 8.0, 8); let w3 = worleyT(p * 16.0, 16);
  let wf = w1 * 0.625 + w2 * 0.25 + w3 * 0.125;
  let pw = clamp(remap(pf, wf - 1.0, 1.0, 0.0, 1.0), 0.0, 1.0);
  let d1 = worleyT(p * 8.0, 8); let d2 = worleyT(p * 16.0, 16); let d3 = worleyT(p * 32.0, 32); let d4 = worleyT(p * 64.0, 64);
  textureStore(noiseOut, id, vec4f(pw, d1 * 0.625 + d2 * 0.25 + d3 * 0.125, d2 * 0.625 + d3 * 0.25 + d4 * 0.125, wf));
}

// ---------- atmosfera ----------
const RE: f32 = 6360e3;
const RA: f32 = 6460e3;
const BR: vec3f = vec3f(5.802e-6, 13.558e-6, 33.1e-6);
const BM_S: f32 = 3.996e-6;
const BM_E: f32 = 4.40e-6;
const BO: vec3f = vec3f(0.650e-6, 1.881e-6, 0.085e-6);
const CAM_H: f32 = 60.0;

fn raySphere(ro: vec3f, rd: vec3f, r: f32) -> vec2f {
  let b = dot(ro, rd); let c = dot(ro, ro) - r * r; let d = b * b - c;
  if (d < 0.0) { return vec2f(-1.0); }
  let s = sqrt(d);
  return vec2f(-b - s, -b + s);
}
fn densities(h: f32) -> vec3f {
  let r = exp(-h / 8000.0);
  let m = exp(-h / 1200.0) + 0.6 * exp(-h / 380.0) ; // um pouco mais de neblina baixa (fim de tarde)
  let o = max(0.0, 1.0 - abs(h - 25000.0) / 15000.0);
  return vec3f(r, m, o);
}
fn extinction(d: vec3f) -> vec3f { return BR * d.x + vec3f(BM_E) * d.y + BO * d.z; }
fn sunTransmittance(p: vec3f, sd: vec3f) -> vec3f {
  let t = raySphere(p, sd, RA).y;
  let tg = raySphere(p, sd, RE);
  if (tg.x > 0.0) { return vec3f(0.0); }
  let n = 12; let dt = t / f32(n);
  var od = vec3f(0.0);
  for (var i = 0; i < n; i++) {
    let q = p + sd * (f32(i) + 0.5) * dt;
    od += extinction(densities(length(q) - RE)) * dt;
  }
  return exp(-od);
}
fn phaseR(c: f32) -> f32 { return 3.0 / (16.0 * PI) * (1.0 + c * c); }
fn phaseHG(c: f32, g: f32) -> f32 { let g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
fn phaseM(c: f32) -> f32 { return mix(phaseHG(c, 0.8), phaseHG(c, -0.2), 0.15); }

// integra espalhamento de ro ao longo de rd até tMax; devolve (L, T)
struct AtmoOut { L: vec3f, T: vec3f };
fn atmosphere(ro: vec3f, rd: vec3f, tMax0: f32, steps: i32) -> AtmoOut {
  var tMax = tMax0;
  let ta = raySphere(ro, rd, RA);
  tMax = min(tMax, ta.y);
  let tg = raySphere(ro, rd, RE);
  if (tg.x > 0.0) { tMax = min(tMax, tg.x); }
  let sd = BP.sunDir.xyz;
  let c = dot(rd, sd);
  let pr = phaseR(c); let pm = phaseM(c);
  var L = vec3f(0.0); var T = vec3f(1.0);
  // passos não-uniformes (mais densos perto)
  var tPrev = 0.0;
  for (var i = 0; i < steps; i++) {
    let f = (f32(i) + 0.5) / f32(steps);
    let t = tMax * f * f;
    let f1 = (f32(i) + 1.0) / f32(steps);
    let dt = tMax * f1 * f1 - tPrev; tPrev = tMax * f1 * f1;
    let p = ro + rd * t;
    let h = length(p) - RE;
    let d = densities(h);
    let ext = extinction(d);
    let ts = sunTransmittance(p, normalize(p * 0.0 + sd));
    let scat = (BR * d.x * pr + vec3f(BM_S) * d.y * pm) * ts;
    // múltiplo espalhamento barato (termo isotrópico)
    let ms = (BR * d.x + vec3f(BM_S) * d.y) * 0.08 * (ts + vec3f(0.05)) ;
    let sint = (scat + ms) * BP.sunE.xyz;
    let Ts = exp(-ext * dt);
    L += T * (sint - sint * Ts) / max(ext, vec3f(1e-9));
    T *= Ts;
  }
  return AtmoOut(L, T);
}

// ---------- nuvens ----------
@group(0) @binding(2) var noiseTex: texture_3d<f32>;
@group(0) @binding(3) var linSamp: sampler;
const CL_BOT: f32 = 1350.0;
const CL_TOP: f32 = 3300.0;

fn weather(xz: vec2f) -> f32 {
  var q = xz / 8000.0;
  q = vec2f(q.x * 0.8 - q.y * 0.6, q.x * 0.6 + q.y * 0.8);
  q += vec2f(fbm2(q * 2.1 + 5.0, 3), fbm2(q * 2.1 - 3.0, 3)) * 0.6;
  var c = fbm2(q * 1.0 + vec2f(3.1, 7.7), 5);
  c = c + 0.25 * (fbm2(q * 3.7 - vec2f(1.0, 4.0), 3) - 0.5);
  // faixa mais carregada ao longe (oposta ao sol), céu aberto perto do sol
  return smoothstep(0.45, 0.70, c);
}
fn cloudDensity(p: vec3f, hFrac: f32, cheap: bool) -> f32 {
  let cov = weather(p.xz);
  if (cov < 0.01) { return 0.0; }
  // perfil de cúmulo: base arredondada e topo afunilado
  let prof = smoothstep(0.0, 0.08, hFrac) * smoothstep(1.0, 0.45, hFrac);
  let base = textureSampleLevel(noiseTex, linSamp, p / 5200.0 + vec3f(0.0, 0.0, 0.0), 0.0);
  let lowF = dot(base.gba, vec3f(0.625, 0.25, 0.125));
  var shape = remap(base.r, -(1.0 - lowF), 1.0, 0.0, 1.0);
  let cv = cov * mix(1.0, 0.5, pow(hFrac, 0.8));
  shape = remap(shape * prof, 1.0 - cv, 1.0, 0.0, 1.0);
  shape = clamp(shape, 0.0, 1.0) * cv;
  if (shape <= 0.0) { return 0.0; }
  if (cheap) { return shape; }
  let det = textureSampleLevel(noiseTex, linSamp, p / 1150.0 + vec3f(0.1, 0.0, 0.3), 0.0);
  let hf = dot(det.gba, vec3f(0.625, 0.25, 0.125));
  let er = mix(hf, 1.0 - hf, clamp(hFrac * 4.0, 0.0, 1.0));
  return clamp(remap(shape, er * 0.45, 1.0, 0.0, 1.0), 0.0, 1.0);
}

struct CloudOut { L: vec3f, T: f32, dist: f32 };
fn clouds(rd: vec3f, jitter: f32) -> CloudOut {
  var co = CloudOut(vec3f(0.0), 1.0, 1e9);
  if (rd.y < 0.003) { return co; }
  let ro = vec3f(0.0, RE + CAM_H, 0.0);
  let t0 = raySphere(ro, rd, RE + CL_BOT).y;
  var t1 = raySphere(ro, rd, RE + CL_TOP).y;
  t1 = min(t1, t0 + 42000.0);
  let n = 160;
  let dt = (t1 - t0) / f32(n);
  let sd = BP.sunDir.xyz;
  let cth = dot(rd, sd);
  let ph = mix(phaseHG(cth, 0.78), phaseHG(cth, -0.25), 0.35) ;
  // cor do sol na altura das nuvens
  let pc = ro + rd * t0;
  let sunCol = sunTransmittance(pc, sd) * BP.sunE.xyz;
  let ambTop = BP.misc.xyz;            // céu (azul) em cima
  var T = 1.0; var L = vec3f(0.0); var wsum = 0.0; var dsum = 0.0;
  let sigma = 0.03;
  for (var i = 0; i < n; i++) {
    if (T < 0.01) { break; }
    let t = t0 + (f32(i) + jitter) * dt;
    let p = ro + rd * t;
    let h = length(p) - RE;
    let hf = clamp((h - CL_BOT) / (CL_TOP - CL_BOT), 0.0, 1.0);
    let wp = vec3f(p.x, h, p.z);
    let d = cloudDensity(wp, hf, false);
    if (d > 0.001) {
      // marcha de luz
      var od = 0.0; var ls = 45.0;
      var q = wp;
      for (var k = 0; k < 7; k++) {
        q += sd * ls;
        let hq = clamp((q.y - CL_BOT) / (CL_TOP - CL_BOT), 0.0, 1.0);
        od += cloudDensity(q, hq, k > 3) * ls;
        ls *= 1.6;
      }
      let beer = exp(-sigma * od);
      let powder = 1.0 - exp(-sigma * od * 2.0 - d * 0.6);
      let direct = sunCol * (beer * 0.8 + 0.2 * exp(-sigma * od * 0.25)) * ph * mix(1.0, powder * 2.0, 0.5);
      let ms = sunCol * (exp(-sigma * od * 0.12) * 0.09 + exp(-sigma * od * 0.04) * 0.05);
      let amb = mix(ambTop * vec3f(0.8, 0.74, 0.72) * 1.0, ambTop * 1.25, hf) * 1.5;
      let S = (direct * 3.2 + ms + amb) * d * sigma;
      let Ti = exp(-d * sigma * dt);
      L += T * (S - S * Ti) / (d * sigma);
      dsum += T * (1.0 - Ti) * t; wsum += T * (1.0 - Ti);
      T *= Ti;
    }
  }
  co.L = L; co.T = T;
  co.dist = select(1e9, dsum / max(wsum, 1e-5), wsum > 1e-4);
  return co;
}
// cirros finos (camada 2D a 8 km)
fn cirrus(rd: vec3f) -> vec4f {
  if (rd.y < 0.01) { return vec4f(0.0); }
  let ro = vec3f(0.0, RE + CAM_H, 0.0);
  let t = raySphere(ro, rd, RE + 8500.0).y;
  let p = ro + rd * t;
  var q = p.xz / 9000.0;
  q = vec2f(q.x * 0.6 + q.y * 0.8, -q.x * 0.8 + q.y * 0.6);
  let n = fbm2(vec2f(q.x * 0.6, q.y * 3.5) + fbm2(q * 2.0, 3) * 0.8, 6);
  let a = smoothstep(0.52, 0.85, n) * 0.55 * smoothstep(0.01, 0.12, rd.y);
  let sunCol = sunTransmittance(p, BP.sunDir.xyz) * BP.sunE.xyz;
  let c = dot(rd, BP.sunDir.xyz);
  let col = sunCol * (0.06 + phaseHG(c, 0.6) * 0.5) + BP.misc.xyz * 0.25;
  return vec4f(col, a);
}

fn skyColor(rd: vec3f, jitter: f32, withClouds: bool) -> vec3f {
  let ro = vec3f(0.0, RE + CAM_H, 0.0);
  if (rd.y < -0.02) {
    // "chão" distante para reflexos: tom de mata enevoada
    let a = atmosphere(ro, rd, 9000.0, 16);
    let gnd = vec3f(0.035, 0.045, 0.028) * BP.sunE.xyz * 0.25;
    return a.L + a.T * gnd;
  }
  var rr = rd; rr.y = max(rr.y, 0.0005); rr = normalize(rr);
  let full = atmosphere(ro, rr, 1e9, 40);
  var col = full.L;
  if (withClouds) {
    let ci = cirrus(rr);
    col = mix(col, ci.rgb + col * 0.4, ci.a);
    let cl = clouds(rr, jitter);
    if (cl.T < 0.999) {
      let front = atmosphere(ro, rr, cl.dist, 24);
      col = front.L + front.T * cl.L + col * cl.T * mix(1.0, 0.92, 1.0 - cl.T) ;
      // reforça: céu atrás das nuvens é atenuado por T
      col = front.L * (1.0 - cl.T) + front.T * cl.L + full.L * cl.T;
    }
  }
  // suaviza a transição até abaixo do horizonte
  return col;
}

@group(0) @binding(4) var skyHiOut: texture_storage_2d<rgba16float, write>;
@compute @workgroup_size(8, 8)
fn csSkyHi(@builtin(global_invocation_id) id: vec3u) {
  let dim = textureDimensions(skyHiOut);
  let px = id.xy + vec2u(0u, u32(BP.rows.x));
  if (px.x >= dim.x || px.y >= dim.y || f32(px.y) >= BP.rows.y) { return; }
  let uv = (vec2f(px) + 0.5) / vec2f(dim);
  // v = sqrt(elev/90°); v=0 horizonte, v=1 zênite (linha 0 = horizonte)
  let elev = uv.y * uv.y * (PI * 0.5) - 0.012;
  let phi = (uv.x - 0.5) * TAU;
  let rd = vec3f(cos(elev) * cos(phi), sin(elev), cos(elev) * sin(phi));
  let j = hash21(vec2f(px) + 0.37);
  let c = skyColor(rd, j, true);
  textureStore(skyHiOut, px, vec4f(c, 1.0));
}

// panorama pequeno (equiretangular, esfera completa) amostrando o grande
@group(0) @binding(5) var skyHiTex: texture_2d<f32>;
@group(0) @binding(6) var skyLoOut: texture_storage_2d<rgba16float, write>;
fn sampleHi(rd: vec3f) -> vec3f {
  let elev = asin(clamp(rd.y, -1.0, 1.0));
  let v = sqrt(clamp((elev + 0.012) / (PI * 0.5), 0.0, 1.0));
  let u = atan2(rd.z, rd.x) / TAU + 0.5;
  return textureSampleLevel(skyHiTex, linSamp, vec2f(u, v), 0.0).rgb;
}
@compute @workgroup_size(8, 8)
fn csSkyLo(@builtin(global_invocation_id) id: vec3u) {
  let dim = textureDimensions(skyLoOut);
  if (id.x >= dim.x || id.y >= dim.y) { return; }
  // supersample 4x4 do panorama grande
  var acc = vec3f(0.0);
  for (var a = 0; a < 4; a++) { for (var b = 0; b < 4; b++) {
    let uv = (vec2f(id.xy) + (vec2f(f32(a), f32(b)) + 0.5) / 4.0) / vec2f(dim);
    let rd = panoToDir(uv);
    if (rd.y > -0.01) { acc += sampleHi(rd); } else { acc += skyColor(rd, 0.5, false); }
  } }
  textureStore(skyLoOut, id.xy, vec4f(acc / 16.0, 1.0));
}

// SH L2 de irradiância a partir do panorama pequeno (1 workgroup)
@group(0) @binding(7) var skyLoTex: texture_2d<f32>;
@group(0) @binding(8) var<storage, read_write> shOut: array<vec4f, 9>;
var<workgroup> wsh: array<array<vec3f, 9>, 64>;
@compute @workgroup_size(64)
fn csSH(@builtin(local_invocation_index) li: u32) {
  var c = array<vec3f, 9>();
  let W = 128u; let H = 64u;
  var wsum = 0.0;
  for (var k = li; k < W * H; k += 64u) {
    let x = k % W; let y = k / W;
    let uv = (vec2f(f32(x), f32(y)) + 0.5) / vec2f(f32(W), f32(H));
    let d = panoToDir(uv);
    let L = textureSampleLevel(skyLoTex, linSamp, uv, 2.0).rgb;
    let dw = sin(uv.y * PI) * (TAU / f32(W)) * (PI / f32(H));
    c[0] += L * 0.282095 * dw;
    c[1] += L * 0.488603 * d.y * dw; c[2] += L * 0.488603 * d.z * dw; c[3] += L * 0.488603 * d.x * dw;
    c[4] += L * 1.092548 * d.x * d.y * dw; c[5] += L * 1.092548 * d.y * d.z * dw;
    c[6] += L * 0.315392 * (3.0 * d.z * d.z - 1.0) * dw;
    c[7] += L * 1.092548 * d.x * d.z * dw; c[8] += L * 0.546274 * (d.x * d.x - d.y * d.y) * dw;
  }
  for (var i = 0; i < 9; i++) { wsh[li][i] = c[i]; }
  workgroupBarrier();
  if (li == 0u) {
    var t = array<vec3f, 9>();
    for (var j = 0; j < 64; j++) { for (var i = 0; i < 9; i++) { t[i] += wsh[j][i]; } }
    // convolução cosseno (A0=π, A1=2π/3, A2=π/4) e constantes da base dobradas;
    // dividido por π => irradiância/π (radiância difusa refletida p/ albedo 1)
    let A = array<f32, 9>(PI, 2.0 * PI / 3.0, 2.0 * PI / 3.0, 2.0 * PI / 3.0, PI / 4.0, PI / 4.0, PI / 4.0, PI / 4.0, PI / 4.0);
    let K = array<f32, 9>(0.282095, 0.488603, 0.488603, 0.488603, 1.092548, 1.092548, 0.315392, 1.092548, 0.546274);
    for (var i = 0; i < 9; i++) { shOut[i] = vec4f(t[i] * A[i] * K[i] / PI, 0.0); }
  }
}
