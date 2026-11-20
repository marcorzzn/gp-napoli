// ---------------------------------------------------------------------------
// bake_tex.wgsl — texturas de detalhe ladrilháveis e atlas de folhas
// detalhe (array 1024² x 10): rgba8 = (nx, ny, altura/ao, variação)
//  0 asfalto (4 m)  1 brita (2 m)  2 solo/grama (2 m)  3 concreto (2 m)
//  4 casca (1 m)    5 serrapilheira (2 m) 6 plástico granulado (0.25 m)
//  7 tecido (0.1 m) 8 metal galvanizado (1 m) 9 borracha/pneu (0.5 m)
// ---------------------------------------------------------------------------
struct BakeU { layer: vec4u };
@group(0) @binding(0) var<uniform> BU: BakeU;
@group(0) @binding(1) var detailOut: texture_storage_2d_array<rgba8unorm, write>;

fn phash2(p: vec2i, per: vec2i) -> f32 {
  let q = vec2u(((p % per) + per) % per);
  return f32(pcg(q.x + pcg(q.y + 913u))) / 4294967295.0;
}
fn phash22(p: vec2i, per: vec2i) -> vec2f {
  let q = vec2u(((p % per) + per) % per);
  let h = pcg(q.x + pcg(q.y + 77u));
  return vec2f(f32(h & 0xffffu), f32(h >> 16u)) / 65535.0;
}
fn pnoise(p: vec2f, per: vec2i) -> f32 {
  let i = vec2i(floor(p)); let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(phash2(i, per), phash2(i + vec2i(1, 0), per), u.x), mix(phash2(i + vec2i(0, 1), per), phash2(i + vec2i(1, 1), per), u.x), u.y);
}
fn pfbm(p: vec2f, per0: vec2i, oct: i32) -> f32 {
  var s = 0.0; var a = 0.5; var per = per0; var q = p;
  for (var i = 0; i < oct; i++) { s += a * pnoise(q, per); q *= 2.0; per *= 2; a *= 0.5; }
  return s;
}
// voronoi periódico: x F1, y F2, z hash da célula, w distância à borda
fn pvor(p: vec2f, per: vec2i, jit: f32) -> vec4f {
  let i = vec2i(floor(p)); let f = fract(p);
  var d1 = 9.0; var d2 = 9.0; var h = 0.0; var mr = vec2f(0); var mg = vec2i(0);
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let g = vec2i(x, y);
    let o = phash22(i + g, per) * jit + (1.0 - jit) * 0.5;
    let r = vec2f(g) + o - f;
    let d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; h = phash2(i + g + vec2i(7, 3), per); mr = r; mg = g; } else if (d < d2) { d2 = d; }
  } }
  // distância à borda (aprox. de Quilez)
  var md = 9.0;
  for (var y = -2; y <= 2; y++) { for (var x = -2; x <= 2; x++) {
    let g = mg + vec2i(x, y);
    let o = phash22(i + g, per) * jit + (1.0 - jit) * 0.5;
    let r = vec2f(g) + o - f;
    if (dot(mr - r, mr - r) > 1e-5) { md = min(md, dot(0.5 * (mr + r), normalize(r - mr))); }
  } }
  return vec4f(sqrt(d1), sqrt(d2), h, md);
}

// altura + variação por camada, coordenada uv em [0,1)
fn layerHV(layer: u32, uv: vec2f) -> vec2f {
  switch (layer) {
    case 0u: { // asfalto: agregado
      let v = pvor(uv * 420.0, vec2i(420), 1.0);
      let stone = smoothstep(0.0, 0.18, v.w);
      let v2 = pvor(uv * 900.0 + 0.5, vec2i(900), 1.0);
      let fine = smoothstep(0.0, 0.2, v2.w) * 0.4;
      let big = pfbm(uv * 8.0, vec2i(8), 4);
      let h = stone * (0.55 + 0.45 * v.z) * 0.8 + fine * 0.3 + big * 0.15;
      let lum = mix(0.35, 1.0, step(0.82, v.z)) * stone + (1.0 - stone) * 0.22 + (v2.z - 0.5) * 0.15;
      return vec2f(h, clamp(lum * (0.8 + big * 0.4), 0.0, 1.0));
    }
    case 1u: { // brita: seixos 2–4 cm
      let v = pvor(uv * 70.0, vec2i(70), 0.9);
      let dome = sqrt(clamp(v.w * 3.2, 0.0, 1.0));
      let v2 = pvor(uv * 150.0 + 0.3, vec2i(150), 0.9);
      let dome2 = sqrt(clamp(v2.w * 3.0, 0.0, 1.0));
      let sel = step(0.5, pfbm(uv * 20.0, vec2i(20), 2));
      let h = max(dome * (0.7 + 0.3 * v.z), dome2 * 0.7 * sel);
      let id = select(v.z, v2.z, dome2 * 0.7 * sel > dome * (0.7 + 0.3 * v.z));
      return vec2f(h, id);
    }
    case 2u: { // solo
      let n = pfbm(uv * 32.0, vec2i(32), 5);
      let v = pvor(uv * 120.0, vec2i(120), 1.0);
      return vec2f(n * 0.7 + smoothstep(0.0, 0.3, v.w) * 0.3, pfbm(uv * 6.0, vec2i(6), 3));
    }
    case 3u: { // concreto
      let n = pfbm(uv * 64.0, vec2i(64), 5);
      let pores = smoothstep(0.03, 0.0, pvor(uv * 260.0, vec2i(260), 1.0).x) * step(0.7, phash2(vec2i(uv * 260.0), vec2i(260)));
      let blot = pfbm(uv * 4.0, vec2i(4), 4);
      return vec2f(0.6 + n * 0.3 - pores * 0.5, blot);
    }
    case 4u: { // casca (fissuras verticais)
      let q = vec2f(uv.x * 10.0, uv.y * 2.0);
      let n = pfbm(q + vec2f(pfbm(uv * vec2f(6.0, 2.0), vec2i(6, 2), 3) * 1.5, 0.0), vec2i(10, 2), 5);
      let fiss = smoothstep(0.42, 0.55, n);
      let fine = pfbm(uv * vec2f(80.0, 20.0), vec2i(80, 20), 3);
      return vec2f(fiss * 0.8 + fine * 0.2, n);
    }
    case 5u: { // serrapilheira: folhas sobrepostas
      var h = 0.0; var id = 0.0;
      for (var k = 0; k < 3; k++) {
        let sc = 28.0 + f32(k) * 9.0;
        let v = pvor(uv * sc + f32(k) * 0.37, vec2i(i32(sc)), 1.0);
        let leaf = smoothstep(0.0, 0.12, v.w) * (0.6 + 0.4 * v.z);
        if (leaf * (1.0 + f32(k) * 0.2) > h) { h = leaf * (1.0 + f32(k) * 0.2); id = v.z; }
      }
      return vec2f(h * 0.8, id);
    }
    case 6u: { // plástico granulado
      let n = pnoise(uv * 512.0, vec2i(512)) * 0.6 + pnoise(uv * 1024.0, vec2i(1024)) * 0.4;
      return vec2f(n, pfbm(uv * 4.0, vec2i(4), 3));
    }
    case 7u: { // tecido
      let g = uv * 128.0;
      let wx = abs(sin(g.x * PI)) * step(0.5, fract(g.y * 0.5 + floor(g.x) * 0.5));
      let wy = abs(sin(g.y * PI)) * (1.0 - step(0.5, fract(g.y * 0.5 + floor(g.x) * 0.5)));
      return vec2f(max(wx, wy) * 0.8 + pnoise(uv * 512.0, vec2i(512)) * 0.2, pnoise(uv * 32.0, vec2i(32)));
    }
    case 8u: { // galvanizado (mosqueado)
      let v = pvor(uv * 40.0, vec2i(40), 1.0);
      return vec2f(pnoise(uv * 256.0, vec2i(256)) * 0.3, v.z * 0.6 + pfbm(uv * 8.0, vec2i(8), 3) * 0.4);
    }
    default: { // borracha
      let n = pnoise(uv * 256.0, vec2i(256));
      return vec2f(n * 0.4, pfbm(uv * 8.0, vec2i(8), 3));
    }
  }
}
fn layerStrength(layer: u32) -> f32 {
  switch (layer) {
    case 0u: { return 2.2; } case 1u: { return 5.0; } case 2u: { return 1.5; } case 3u: { return 1.2; }
    case 4u: { return 4.0; } case 5u: { return 2.0; } case 6u: { return 0.8; } case 7u: { return 1.4; }
    case 8u: { return 0.5; } default: { return 0.6; }
  }
}
@compute @workgroup_size(8, 8)
fn csDetail(@builtin(global_invocation_id) id: vec3u) {
  let N = 1024u;
  if (id.x >= N || id.y >= N) { return; }
  let layer = BU.layer.x;
  let e = 1.0 / f32(N);
  let uv = (vec2f(id.xy) + 0.5) * e;
  let c = layerHV(layer, uv);
  let hx0 = layerHV(layer, fract(uv - vec2f(e, 0.0))).x; let hx1 = layerHV(layer, fract(uv + vec2f(e, 0.0))).x;
  let hy0 = layerHV(layer, fract(uv - vec2f(0.0, e))).x; let hy1 = layerHV(layer, fract(uv + vec2f(0.0, e))).x;
  let k = layerStrength(layer);
  let n = normalize(vec3f((hx0 - hx1) * k, (hy0 - hy1) * k, 1.0));
  textureStore(detailOut, id.xy, layer, vec4f(n.xy * 0.5 + 0.5, clamp(c.x, 0.0, 1.0), clamp(c.y, 0.0, 1.0)));
}

// ---------------- atlas de folhas (2048², 2x2 células) ----------------
// albedo.rgb + alpha ; normal.xy + translucência + ao
@group(0) @binding(2) var leafAlb: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var leafNrm: texture_storage_2d<rgba8unorm, write>;

fn sdSeg(p: vec2f, a: vec2f, b: vec2f) -> vec2f {
  let pa = p - a; let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return vec2f(length(pa - ba * h), h);
}
@compute @workgroup_size(8, 8)
fn csLeaves(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= 4096u || id.y >= 4096u) { return; }
  let cell = id.xy / 2048u;
  let kind = cell.x + cell.y * 2u;
  let p = (vec2f(id.xy % 2048u) + 0.5) / 2048.0;   // [0,1] dentro da célula, y para baixo
  let q = vec2f(p.x - 0.5, 1.0 - p.y);             // origem embaixo no centro, y para cima
  var alpha = 0.0; var col = vec3f(0.0); var nrm = vec3f(0.0, 0.0, 1.0); var trans = 0.0; var ao = 1.0;
  var best = -1.0;
  var nLeaves = 80; var lenL = 0.088; var widL = 0.034; var spread = 0.40;
  var baseC = vec3f(0.10, 0.20, 0.05);
  if (kind == 1u) { nLeaves = 40; lenL = 0.19; widL = 0.022; spread = 0.40; baseC = vec3f(0.17, 0.22, 0.12); }
  if (kind == 2u) { nLeaves = 64; lenL = 0.085; widL = 0.034; spread = 0.46; baseC = vec3f(0.09, 0.17, 0.045); }
  if (kind == 3u) { nLeaves = 30; lenL = 0.5; widL = 0.012; spread = 0.45; baseC = vec3f(0.18, 0.24, 0.08); }
  col = baseC;  // dilatação: texels transparentes com a cor média (evita borda escura)
  // galho principal
  let stemTop = vec2f(0.0, 0.88);
  let ds = sdSeg(q, vec2f(0.0, 0.0), stemTop);
  let stemW = mix(0.012, 0.003, ds.y);
  if (kind != 3u && ds.x < stemW) { alpha = 1.0; col = vec3f(0.16, 0.11, 0.07); best = 0.0; nrm = normalize(vec3f((q.x) / stemW * 0.8, 0.0, 1.0)); ao = 0.7; }
  // folhosas (0 e 2): raminho com eixo central + 4 ramos laterais, folhas em várias direções
  let multi = kind == 0u || kind == 2u;
  if (multi) {
    nLeaves = select(150, 175, kind == 0u); lenL = 0.064; widL = 0.026;
    for (var j = 1; j < 5; j++) {
      let side = select(-1.0, 1.0, (j % 2) == 0);
      let sy = 0.15 + 0.13 * f32(j);
      let sa = side * (0.75 + 0.1 * f32(j) + (hash11u(u32(j * 31 + i32(kind) * 7)) - 0.5) * 0.3);
      let sl = 0.30 - 0.03 * f32(j);
      let tw = sdSeg(q, vec2f(0.0, sy), vec2f(0.0, sy) + vec2f(sin(sa), cos(sa)) * sl);
      if (tw.x < mix(0.006, 0.0022, tw.y) && best < 0.0) { alpha = 1.0; col = vec3f(0.16, 0.11, 0.07); best = 0.0; ao = 0.7; }
    }
  }
  for (var i = 0; i < nLeaves; i++) {
    let hi = f32(i) + f32(kind) * 100.0;
    let r0 = hash11u(u32(hi * 13.0 + 1.0)); let r1 = hash11u(u32(hi * 13.0 + 2.0)); let r2 = hash11u(u32(hi * 13.0 + 3.0)); let r3 = hash11u(u32(hi * 13.0 + 4.0));
    // ponto de inserção no galho e direção
    var base = vec2f(0.0, mix(0.12, 0.86, r0));
    var ang = (r1 - 0.5) * 2.0 * 1.25 + select(0.0, sign(r1 - 0.5) * 0.35, kind != 3u);
    if (multi) {
      let j = i % 5;
      if (j == 0) {
        base = vec2f(0.0, mix(0.10, 0.84, r0));
        ang = sign(r1 - 0.5) * mix(0.45, 1.5, abs(r1 - 0.5) * 2.0);
      } else {
        let side = select(-1.0, 1.0, (j % 2) == 0);
        let sy = 0.15 + 0.13 * f32(j);
        let sa = side * (0.75 + 0.1 * f32(j) + (hash11u(u32(j * 31 + i32(kind) * 7)) - 0.5) * 0.3);
        let sl = 0.30 - 0.03 * f32(j);
        base = vec2f(0.0, sy) + vec2f(sin(sa), cos(sa)) * sl * mix(0.15, 1.0, r0);
        ang = sa + sign(r1 - 0.5) * mix(0.35, 1.45, abs(r1 - 0.5) * 2.0);
      }
    }
    let L = lenL * mix(0.7, 1.15, r2) * select(1.0, mix(1.0, 0.7, r0), kind != 3u);
    let W = widL * mix(0.8, 1.2, r3);
    var dir = vec2f(sin(ang), cos(ang));
    if (kind == 1u) { dir = normalize(vec2f(sin(ang), cos(ang) - 0.9)); }  // eucalipto pende
    // pecíolo
    let tip0 = base + dir * spread * select(0.18, 0.08, multi);
    let dp = sdSeg(q, base, tip0);
    if (kind != 3u && dp.x < 0.003 && best < 0.5) { alpha = 1.0; col = vec3f(0.18, 0.15, 0.08); best = 0.5; ao = 0.8; }
    // lâmina: coordenadas locais
    let lp = q - tip0;
    var t = dot(lp, dir); var s = dot(lp, vec2f(-dir.y, dir.x));
    // curvatura da folha (arqueia)
    let bend = (r2 - 0.5) * 0.6;
    s -= bend * t * t / max(L, 1e-3);
    let tt = t / L;
    if (tt > 0.0 && tt < 1.0) {
      var prof = sin(pow(tt, 0.75) * PI);
      if (kind == 3u) { prof = 1.0 - tt; }
      let hw = W * prof;
      if (abs(s) < hw) {
        let depth = 1.0 + f32(i) / f32(nLeaves);
        if (depth > best) {
          best = depth; alpha = 1.0;
          let ss = s / hw;
          let hue = hash11u(u32(hi * 7.0 + 5.0));
          var c = baseC * mix(0.75, 1.35, hue);
          c = mix(c, c * vec3f(1.2, 1.08, 0.6), smoothstep(0.6, 1.0, hash11u(u32(hi * 3.0 + 9.0))) * 0.35); // algumas amareladas
          c *= mix(0.85, 1.1, tt);
          let rib = smoothstep(0.08, 0.0, abs(ss)) * 0.25;
          let veins = smoothstep(0.85, 1.0, abs(sin((tt * 9.0 - abs(ss) * 2.5) * PI))) * 0.08 * (1.0 - abs(ss));
          let edgeDark = smoothstep(0.65, 1.0, abs(ss)) * 0.25;
          let blot = (hash11u(u32(hi * 11.0 + 3.0)) - 0.5) * 0.25 * smoothstep(0.3, 0.9, vnoise2(lp * 60.0));
          col = c * (1.0 + rib + veins - edgeDark + blot);
          // normal: abaulada transversalmente + nervura
          let nl = vec2f(-dir.y, dir.x) * (ss * 0.55) + dir * (tt - 0.5) * 0.25;
          nrm = normalize(vec3f(nl.x, nl.y, 1.0));
          trans = mix(0.75, 1.0, hue) * (1.0 - rib * 2.0);
          ao = mix(0.55, 1.0, f32(i) / f32(nLeaves)) * (0.8 + 0.2 * (1.0 - abs(ss)));
        }
      }
    }
  }
  textureStore(leafAlb, id.xy, vec4f(col, alpha));
  textureStore(leafNrm, id.xy, vec4f(nrm.xy * 0.5 + 0.5, trans, ao));
}

// ---------------- mipmaps genéricos ----------------
@group(0) @binding(0) var mipSrc: texture_2d_array<f32>;
@group(0) @binding(1) var mipDst: texture_storage_2d_array<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> mipMode: vec4u;   // x: 0 média simples, 1 ponderada por alfa
@compute @workgroup_size(8, 8)
fn csMip(@builtin(global_invocation_id) id: vec3u) {
  let dd = textureDimensions(mipDst);
  if (id.x >= dd.x || id.y >= dd.y) { return; }
  let b = vec2i(id.xy) * 2;
  let l = i32(id.z);
  let a = textureLoad(mipSrc, b, l, 0); let c = textureLoad(mipSrc, b + vec2i(1, 0), l, 0);
  let d = textureLoad(mipSrc, b + vec2i(0, 1), l, 0); let e = textureLoad(mipSrc, b + vec2i(1, 1), l, 0);
  var r = (a + c + d + e) * 0.25;
  if (mipMode.x == 1u) {
    let w = a.a + c.a + d.a + e.a;
    if (w > 0.0) { r = vec4f((a.rgb * a.a + c.rgb * c.a + d.rgb * d.a + e.rgb * e.a) / w, r.a); }
  }
  textureStore(mipDst, id.xy, l, r);
}
