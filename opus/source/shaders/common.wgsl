diagnostic(off, derivative_uniformity);
// ---------------------------------------------------------------------------
// common.wgsl — estruturas compartilhadas, ruídos, BRDF
// ---------------------------------------------------------------------------
const PI: f32 = 3.14159265;
const TAU: f32 = 6.2831853;

struct View {
  viewProj: mat4x4f,       // com jitter (rasterização)
  viewProjNJ: mat4x4f,     // sem jitter
  prevViewProjNJ: mat4x4f, // quadro anterior, sem jitter
  invViewProj: mat4x4f,    // inversa da com jitter
  view: mat4x4f,
  camPos: vec4f,           // w = near
  params: vec4f,           // x: tipo (0 principal, 1 sombra, 2 cubo), y: cascata, z: lodScale, w: fovScale
  jitter: vec4f,           // xy atual (ndc), zw anterior
  res: vec4f,              // w, h, 1/w, 1/h
  prevCamPos: vec4f,
  camFwd: vec4f,
};

struct Globals {
  sunDir: vec4f,           // direção PARA o sol
  sunColor: vec4f,         // rgb irradiância, w = raio angular
  time: vec4f,             // t, dt, frame, wetness global
  wind: vec4f,             // dir xz, força, rajada
  fog: vec4f,              // densidade, queda por altura, altura base, exposição
  cascadeSplits: vec4f,
  shadowVP: array<mat4x4f, 4>,
  shadowTexel: vec4f,      // tamanho do texel (m) por cascata
  carPos: vec4f,           // centro do carro (cubo dinâmico), w = 1 se ativo
  terrain: vec4f,          // X0, Z0, 1/HS, HN
  mask: vec4f,             // X0, Z0, 1/R1, R1
  track: vec4f,            // L, N, ds, 0
  misc: vec4f,             // x: cloudRot, y: exposure, z: debug, w: hud
  hud: vec4f,              // velocidade, câmera, tempo de volta, marcha
  hud2: vec4f,
  sh: array<vec4f, 9>,     // irradiância do céu (SH L2)
  carNow: vec4f,           // centro atual do carro (contato), w = 1 se ativo
};

struct Obj {
  model: mat4x4f,
  prevModel: mat4x4f,
  params: vec4f,           // carro: x freio, y ré, z faróis, w sujeira
  params2: vec4f,
};

// ---------------- hash / ruído ----------------
fn pcg(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
fn hash21(p: vec2f) -> f32 {
  let q = vec2u(vec2i(floor(p)) + vec2i(32768));
  return f32(pcg(q.x + pcg(q.y))) / 4294967295.0;
}
fn hash22(p: vec2f) -> vec2f {
  let q = vec2u(vec2i(floor(p)) + vec2i(32768));
  let h = pcg(q.x + pcg(q.y));
  return vec2f(f32(h & 0xffffu), f32(h >> 16u)) / 65535.0;
}
fn hash31(p: vec3f) -> f32 {
  let q = vec3u(vec3i(floor(p)) + vec3i(32768));
  return f32(pcg(q.x + pcg(q.y + pcg(q.z)))) / 4294967295.0;
}
fn hash11u(x: u32) -> f32 { return f32(pcg(x)) / 4294967295.0; }

fn vnoise2(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let a = hash21(i); let b = hash21(i + vec2f(1, 0)); let c = hash21(i + vec2f(0, 1)); let d = hash21(i + vec2f(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
fn vnoise3(p: vec3f) -> f32 {
  let i = floor(p); let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let n000 = hash31(i); let n100 = hash31(i + vec3f(1, 0, 0)); let n010 = hash31(i + vec3f(0, 1, 0)); let n110 = hash31(i + vec3f(1, 1, 0));
  let n001 = hash31(i + vec3f(0, 0, 1)); let n101 = hash31(i + vec3f(1, 0, 1)); let n011 = hash31(i + vec3f(0, 1, 1)); let n111 = hash31(i + vec3f(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
fn fbm2(p: vec2f, oct: i32) -> f32 {
  var s = 0.0; var a = 0.5; var q = p;
  for (var i = 0; i < oct; i++) { s += a * vnoise2(q); q = q * 2.03 + vec2f(17.1, -9.3); a *= 0.5; }
  return s;
}
fn ridge2(p: vec2f, oct: i32) -> f32 {
  var s = 0.0; var a = 0.5; var q = p;
  for (var i = 0; i < oct; i++) { let v = 1.0 - abs(vnoise2(q) * 2.0 - 1.0); s += a * v * v; q = q * 2.03 + vec2f(17.1, -9.3); a *= 0.5; }
  return s;
}
fn fbm3(p: vec3f, oct: i32) -> f32 {
  var s = 0.0; var a = 0.5; var q = p;
  for (var i = 0; i < oct; i++) { s += a * vnoise3(q); q = q * 2.02 + vec3f(17.1, -9.3, 5.7); a *= 0.5; }
  return s;
}
// voronoi: x = dist F1, y = F2, zw = id
fn voronoi2(p: vec2f) -> vec4f {
  let i = floor(p); let f = fract(p);
  var d1 = 8.0; var d2 = 8.0; var id = vec2f(0);
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let g = vec2f(f32(x), f32(y));
    let o = hash22(i + g);
    let r = g + o - f;
    let d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) { d2 = d; }
  } }
  return vec4f(sqrt(d1), sqrt(d2), id);
}

// Interleaved gradient noise (para dithering temporal)
fn ign(p: vec2f, frame: f32) -> f32 {
  let q = p + 5.588238 * (frame % 64.0);
  return fract(52.9829189 * fract(dot(q, vec2f(0.06711056, 0.00583715))));
}

// ---------------- codificação ----------------
fn octWrap(v: vec2f) -> vec2f { return (1.0 - abs(v.yx)) * select(vec2f(-1.0), vec2f(1.0), v.xy >= vec2f(0.0)); }
fn octEncode(n0: vec3f) -> vec2f {
  var n = n0 / (abs(n0.x) + abs(n0.y) + abs(n0.z));
  var r = select(octWrap(n.xz), n.xz, n.y >= 0.0);
  return r;
}
fn octDecode(e: vec2f) -> vec3f {
  var n = vec3f(e.x, 1.0 - abs(e.x) - abs(e.y), e.y);
  let t = clamp(-n.y, 0.0, 1.0);
  n.x += select(t, -t, n.x >= 0.0);
  n.z += select(t, -t, n.z >= 0.0);
  return normalize(n);
}
fn luminance(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }

// panorama equiretangular: dir -> uv
fn dirToPano(d: vec3f) -> vec2f {
  let u = atan2(d.z, d.x) * (0.5 / PI) + 0.5;
  let v = acos(clamp(d.y, -1.0, 1.0)) / PI;
  return vec2f(u, v);
}
fn panoToDir(uv: vec2f) -> vec3f {
  let phi = (uv.x - 0.5) * TAU;
  let th = uv.y * PI;
  return vec3f(sin(th) * cos(phi), cos(th), sin(th) * sin(phi));
}

// ---------------- BRDF ----------------
fn D_GGX(NoH: f32, a: f32) -> f32 {
  let a2 = a * a; let d = (NoH * a2 - NoH) * NoH + 1.0;
  return a2 / (PI * d * d + 1e-7);
}
fn V_SmithGGX(NoV: f32, NoL: f32, a: f32) -> f32 {
  let a2 = a * a;
  let gv = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2);
  let gl = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
  return 0.5 / (gv + gl + 1e-6);
}
fn F_Schlick(f0: vec3f, VoH: f32) -> vec3f {
  let f = pow(1.0 - VoH, 5.0);
  return f0 + (vec3f(1.0) - f0) * f;
}
fn F_Schlick1(f0: f32, VoH: f32) -> f32 { return f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0); }
// aproximação analítica do termo de ambiente (Karis)
fn envBRDF(f0: vec3f, rough: f32, NoV: f32) -> vec3f {
  let c0 = vec4f(-1.0, -0.0275, -0.572, 0.022);
  let c1 = vec4f(1.0, 0.0425, 1.04, -0.04);
  let r = rough * c0 + c1;
  let a004 = min(r.x * r.x, exp2(-9.28 * NoV)) * r.x + r.y;
  let ab = vec2f(-1.04, 1.04) * a004 + r.zw;
  return f0 * ab.x + ab.y;
}
fn shIrradiance(n: vec3f, sh: array<vec4f, 9>) -> vec3f {
  // coeficientes já convolvidos (cosseno) no bake
  var r = sh[0].rgb;
  r += sh[1].rgb * n.y + sh[2].rgb * n.z + sh[3].rgb * n.x;
  r += sh[4].rgb * (n.x * n.y) + sh[5].rgb * (n.y * n.z) + sh[6].rgb * (3.0 * n.z * n.z - 1.0);
  r += sh[7].rgb * (n.x * n.z) + sh[8].rgb * (n.x * n.x - n.y * n.y);
  return max(r, vec3f(0.0));
}
