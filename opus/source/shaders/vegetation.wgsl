// ---------------------------------------------------------------------------
// vegetation.wgsl — árvores instanciadas (alpha estocástico, vento) e grama
// ---------------------------------------------------------------------------
struct VIn { @location(0) pos: vec3f, @location(1) nrm: vec4f, @location(2) uv: vec2f, @location(3) attr: vec4u };
struct TOut {
  @builtin(position) @invariant clip: vec4f,
  @location(0) wpos: vec3f,
  @location(1) nrm: vec3f,
  @location(2) uv: vec2f,
  @location(3) @interpolate(flat) attr: vec4u,
  @location(4) cur: vec4f,
  @location(5) prev: vec4f,
  @location(6) @interpolate(flat) inst: vec4f,   // hue, espécie, escala, w
  @location(7) wind: f32,
};
@group(2) @binding(0) var<storage, read> trees: array<vec4f>;
@group(2) @binding(1) var<storage, read> vis: array<u32>;

fn windOffset(lp: vec3f, w: f32, phase: f32, t: f32, isLeaf: bool, s: f32) -> vec3f {
  let wd = vec3f(G.wind.x, 0.0, G.wind.y);
  let gust = 0.6 + 0.4 * sin(t * 0.31 + phase * 0.2);
  let sway = (sin(t * 0.85 + phase) * 0.6 + sin(t * 1.9 + phase * 1.7) * 0.25) * gust;
  var o = wd * sway * w * w * 0.32 * s * G.wind.z;
  if (isLeaf) {
    let h = fract(sin(dot(lp, vec3f(12.9, 78.2, 37.7))) * 43758.5);
    o += vec3f(sin(t * 6.0 + h * 30.0), sin(t * 7.3 + h * 21.0) * 0.6, cos(t * 5.1 + h * 17.0)) * 0.035 * w;
  }
  return o;
}
fn treeWorld(v: VIn, id: u32, t: f32) -> vec3f {
  let t0 = trees[id * 2u]; let t1 = trees[id * 2u + 1u];
  let s = t0.w; let r = t1.x;
  let c = cos(r); let sn = sin(r);
  var lp = v.pos * s;
  // variação por instância: altura e largura independentes
  let hv = fract(t1.z * 7.31); let wv = fract(t1.z * 3.17 + 0.5);
  lp = vec3f(lp.x * (0.82 + 0.36 * wv), lp.y * (0.8 + 0.4 * hv), lp.z * (0.82 + 0.36 * wv));
  lp = vec3f(lp.x * c - lp.z * sn, lp.y, lp.x * sn + lp.z * c);
  return t0.xyz + lp + windOffset(v.pos, v.nrm.w, t1.w + t0.x * 0.05, t, v.attr.x == 81u, s);
}
@vertex
fn vsTree(v: VIn, @builtin(instance_index) ii: u32) -> TOut {
  var o: TOut;
  let id = vis[ii];
  let t = G.time.x;
  let wp = treeWorld(v, id, t);
  let pp = treeWorld(v, id, t - G.time.y);
  let t1 = trees[id * 2u + 1u];
  let r = t1.x; let c = cos(r); let sn = sin(r);
  o.nrm = normalize(vec3f(v.nrm.x * c - v.nrm.z * sn, v.nrm.y, v.nrm.x * sn + v.nrm.z * c));
  o.wpos = wp; o.uv = v.uv; o.attr = v.attr; o.wind = v.nrm.w;
  o.inst = vec4f(t1.z, t1.y, trees[id * 2u].w, 0.0);
  o.clip = V.viewProj * vec4f(wp, 1.0);
  o.cur = V.viewProjNJ * vec4f(wp, 1.0);
  o.prev = V.prevViewProjNJ * vec4f(pp, 1.0);
  return o;
}
struct SOut { @builtin(position) clip: vec4f, @location(0) uv: vec2f, @location(1) @interpolate(flat) leaf: u32, @location(2) @interpolate(flat) tile: u32 };
@vertex
fn vsTreeShadow(v: VIn, @builtin(instance_index) ii: u32) -> SOut {
  var o: SOut;
  let wp = treeWorld(v, vis[ii], G.time.x);
  o.clip = V.viewProj * vec4f(wp, 1.0);
  o.uv = v.uv; o.leaf = select(0u, 1u, v.attr.x == 81u); o.tile = v.attr.y;
  return o;
}
// repete a textura dentro da célula do atlas (cartões grandes dos LODs distantes)
fn leafUV(uv: vec2f, tile: u32) -> vec2f {
  if (tile <= 1u) { return uv; }
  let org = floor(uv * 2.0) * 0.5;
  return org + fract((uv - org) * 2.0 * f32(tile)) * 0.5;
}
fn leafAlpha(uv0: vec2f, px: vec2f, hashed: bool, tile: u32) -> f32 {
  let uv = leafUV(uv0, tile);
  let g = vec2f(f32(tile));
  let a = textureSampleGrad(leafAlbTex, sampRep, uv, 0, dpdx(uv0) * g, dpdy(uv0) * g).a;
  let w = max(fwidth(a), 1e-4);
  let sharp = clamp((a - 0.5) / w + 0.5, 0.0, 1.0);
  let k = clamp(w * 2.0, 0.0, 1.0);
  let cov = mix(sharp, a, k);
  let th = select(0.5, 0.15 + 0.7 * ign(px, G.time.z), hashed);
  return cov - th;
}
@fragment
fn fsTreeShadow(i: SOut) {
  if (i.leaf == 1u) {
    let a = textureSampleLevel(leafAlbTex, sampRep, leafUV(i.uv, i.tile), 0, 1.0).a;
    if (a < 0.5) { discard; }
  }
}
fn treeSurf(i: TOut) -> Surf {
  var s = surfDefault(normalize(i.nrm));
  let hue = i.inst.x; let sp = u32(i.inst.y + 0.5);
  if (i.attr.x == 81u) {
    let tl = i.attr.y; let luv = leafUV(i.uv, tl); let gs = vec2f(f32(max(tl, 1u))) * 0.8;
    let al = textureSampleGrad(leafAlbTex, sampRep, luv, 0, dpdx(i.uv) * gs, dpdy(i.uv) * gs);
    let ln = textureSampleGrad(leafNrmTex, sampRep, luv, 0, dpdx(i.uv) * gs, dpdy(i.uv) * gs);
    var c = al.rgb;
    // variação por instância e estação (algumas copas amareladas/avermelhadas)
    c *= mix(0.75, 1.2, hue);
    if (hue > 0.88 && (sp == 0u || sp == 3u)) { c = mix(c, c * vec3f(1.45, 1.05, 0.5), 0.35); }
    if (sp == 1u) { c = mix(c, c * vec3f(0.95, 1.0, 1.1), 0.5); }
    s.albedo = c;
    let tn = normalize(vec3f((ln.xy - 0.5) * 2.0 * 0.6, 1.0));
    s.n = perturb(s.n, i.wpos, i.uv * 8.0, tn);
    s.rough = 0.5; s.cls = 1u;
    s.ao = ln.a * mix(0.3, 1.0, clamp(i.wind * i.wind, 0.0, 1.0));
  } else {
    let d = textureSample(detailTex, sampRep, i.uv * vec2f(1.0, 0.5), 4);
    var c = vec3f(0.11, 0.085, 0.065) * (0.6 + 0.6 * d.z);
    if (i.attr.y == 1u) {
      // eucalipto: casca clara descascando
      let patchN = vnoise2(i.uv * vec2f(4.0, 1.5) + hue * 10.0);
      c = mix(vec3f(0.33, 0.30, 0.26), vec3f(0.20, 0.16, 0.13), smoothstep(0.45, 0.6, patchN)) * (0.8 + 0.3 * d.z);
    }
    s.albedo = c; s.rough = 0.85;
    s.n = perturb(s.n, i.wpos, i.uv * 4.0, normalize(vec3f((d.xy - 0.5) * 2.0, 1.0)));
    s.ao = 0.75;
  }
  return s;
}
// pré-passada de profundidade (só o teste alfa)
@fragment
fn fsTreeZ(i: TOut) {
  if (i.attr.x == 81u) { if (leafAlpha(i.uv, i.clip.xy, distance(i.wpos, V.camPos.xyz) > 45.0, i.attr.y) < 0.0) { discard; } }
}
// G-buffer com teste "equal": só fragmentos visíveis, sem descarte (mantém HSR)
@fragment
fn fsTreeG(i: TOut) -> GOut {
  var s = treeSurf(i);
  // folha de duas faces: normal voltada para a câmera
  if (dot(s.n, V.camPos.xyz - i.wpos) < 0.0 && i.attr.x == 81u) { s.n = reflect(s.n, normalize(V.camPos.xyz - i.wpos)) * -1.0; s.n = normalize(mix(s.n, normalize(i.nrm), 0.3)); }
  return packG(s, i.cur, i.prev);
}
@fragment
fn fsTreeCube(i: TOut) -> @location(0) vec4f {
  if (i.attr.x == 81u) { if (textureSampleLevel(leafAlbTex, sampRep, leafUV(i.uv, i.attr.y), 0, 2.0).a < 0.5) { discard; } }
  let s = treeSurf(i);
  return vec4f(shadeForward(s, i.wpos, V.camPos.xyz), 1.0);
}

// ---------------- grama alta procedural ----------------
const GN: u32 = 200u;
const GCELL: f32 = 0.45;
struct GOutV {
  @builtin(position) clip: vec4f,
  @location(0) wpos: vec3f,
  @location(1) nrm: vec3f,
  @location(2) t: f32,
  @location(3) cur: vec4f,
  @location(4) prev: vec4f,
  @location(5) @interpolate(flat) col: vec3f,
};
fn terrainH_unused(xz: vec2f) -> f32 {
  let f = (xz - G.terrain.xy) * G.terrain.z;
  let i = vec2i(floor(f)); let t = fract(f);
  let n = i32(G.terrain.w) - 1;
  let a = textureLoad(heightTex, clamp(i, vec2i(0), vec2i(n)), 0).r;
  let b = textureLoad(heightTex, clamp(i + vec2i(1, 0), vec2i(0), vec2i(n)), 0).r;
  let c = textureLoad(heightTex, clamp(i + vec2i(0, 1), vec2i(0), vec2i(n)), 0).r;
  let d = textureLoad(heightTex, clamp(i + vec2i(1, 1), vec2i(0), vec2i(n)), 0).r;
  if (t.x > t.y) { return a + (b - a) * t.x + (d - b) * t.y; }
  return a + (d - c) * t.x + (c - a) * t.y;
}
struct Blade { p: vec3f, prev: vec3f, n: vec3f, t: f32, ok: bool, col: vec3f };
@group(2) @binding(2) var<storage, read> clumps: array<vec4f>;
fn grassBlade(vi: u32, ii: u32) -> Blade {
  var b: Blade; b.ok = true;
  let c0 = clumps[ii * 2u]; let c1 = clumps[ii * 2u + 1u];
  let base = c0.xz; let y0c = c0.y; let dens = c0.w; let cell = c1.xy; let fade = c1.z;
  let dist = length(base - V.camPos.xz);
  let blade = vi / 18u; let k = vi % 18u;
  let quadI = k / 6u; let corner = array<u32, 6>(0u, 1u, 2u, 2u, 1u, 3u)[k % 6u];
  let row = quadI + (corner >> 1u); let side = f32(corner & 1u) * 2.0 - 1.0;
  let hb = hash22(cell * 5.1 + f32(blade) * 13.3);
  let ang = hb.x * TAU;
  let dir = vec2f(cos(ang), sin(ang));
  let off = (hb - 0.5) * 0.35;
  let H = (0.35 + 0.55 * hash21(cell + f32(blade) * 3.1)) * mix(0.6, 1.0, dens) * (0.4 + 0.6 * fade);
  let t = f32(row) / 3.0;
  let width = 0.022 * (1.0 - t * 0.85) * (1.0 + smoothstep(25.0, 44.0, dist) * 2.0);
  let bend = (0.25 + hb.y * 0.3) * t * t;
  var p = vec3f(base.x + off.x, y0c, base.y + off.y);
  let perp = vec2f(-dir.y, dir.x);
  p += vec3f(dir.x * bend * H, t * H, dir.y * bend * H) + vec3f(perp.x, 0.0, perp.y) * side * width;
  let ph = dot(base, vec2f(0.21, 0.17));
  let tt = G.time.x;
  let wv = sin(tt * 1.6 + ph) * 0.5 + sin(tt * 3.1 + ph * 1.7) * 0.2 + 0.25;
  let wvp = sin((tt - G.time.y) * 1.6 + ph) * 0.5 + sin((tt - G.time.y) * 3.1 + ph * 1.7) * 0.2 + 0.25;
  let wd = vec3f(G.wind.x, 0.0, G.wind.y) * t * t * H * 0.35 * G.wind.z;
  b.p = p + wd * wv;
  b.prev = p + wd * wvp;
  b.n = normalize(vec3f(perp.x, 0.6, perp.y) * side + vec3f(0.0, 0.9, 0.0));
  b.t = t;
  let dry = hash21(cell * 0.71);
  b.col = mix(vec3f(0.07, 0.12, 0.03), vec3f(0.24, 0.20, 0.08), smoothstep(0.4, 1.0, dry));
  return b;
}
@vertex
fn vsGrass(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> GOutV {
  var o: GOutV;
  let b = grassBlade(vi, ii);
  o.wpos = b.p; o.nrm = b.n; o.t = b.t; o.col = b.col;
  o.clip = V.viewProj * vec4f(b.p, 1.0);
  o.cur = V.viewProjNJ * vec4f(b.p, 1.0);
  o.prev = V.prevViewProjNJ * vec4f(b.prev, 1.0);
  return o;
}
@vertex
fn vsGrassShadow(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> @builtin(position) vec4f {
  let b = grassBlade(vi, ii);
  return V.viewProj * vec4f(b.p, 1.0);
}
@fragment
fn fsGrassG(i: GOutV) -> GOut {
  var s = surfDefault(normalize(i.nrm));
  s.albedo = mix(i.col * 0.55, i.col * vec3f(1.5, 1.45, 1.0), i.t);
  s.rough = 0.6; s.cls = 1u; s.ao = mix(0.35, 1.0, i.t);
  return packG(s, i.cur, i.prev);
}
