// ---------------------------------------------------------------------------
// mesh.wgsl — pipeline de malhas (terreno, pista, cenário, carro)
// ---------------------------------------------------------------------------
struct VIn { @location(0) pos: vec3f, @location(1) nrm: vec4f, @location(2) uv: vec2f, @location(3) attr: vec4u };
struct VOut {
  @builtin(position) clip: vec4f,
  @location(0) wpos: vec3f,
  @location(1) nrm: vec3f,
  @location(2) uv: vec2f,
  @location(3) @interpolate(flat) attr: vec4u,
  @location(4) lpos: vec3f,
  @location(5) cur: vec4f,
  @location(6) prev: vec4f,
  @location(7) extra: f32,
  @location(8) lnrm: vec3f,
};

@vertex
fn vsMesh(v: VIn) -> VOut {
  var o: VOut;
  let wp = O.model * vec4f(v.pos, 1.0);
  let pp = O.prevModel * vec4f(v.pos, 1.0);
  o.wpos = wp.xyz;
  o.nrm = normalize((O.model * vec4f(v.nrm.xyz, 0.0)).xyz);
  o.lnrm = v.nrm.xyz;
  o.uv = v.uv; o.attr = v.attr; o.lpos = v.pos; o.extra = v.nrm.w;
  o.clip = V.viewProj * wp;
  o.cur = V.viewProjNJ * wp;
  o.prev = V.prevViewProjNJ * pp;
  return o;
}
@vertex
fn vsMeshShadow(v: VIn) -> @builtin(position) vec4f {
  let wp = O.model * vec4f(v.pos, 1.0);
  return V.viewProj * wp;
}

// ---------------- materiais do mundo ----------------
fn matTerrain(i: VOut) -> Surf {
  var s = surfDefault(normalize(i.nrm));
  let wp = i.wpos;
  let camd = length(wp - V.camPos.xyz);
  let muv = (wp.xz - G.mask.xy) * G.mask.z;
  let inner = all(muv > vec2f(0.0)) && all(muv < vec2f(1.0));
  var m = vec4f(0.0, 0.6, 0.0, 1.0);
  if (inner) { m = textureSampleLevel(maskTex, sampClamp, muv, 0.0); }
  // variação macro
  let macro1 = fbm2(wp.xz * 0.012, 4);
  let macro2 = fbm2(wp.xz * 0.07 + 13.0, 3);
  let dry = smoothstep(0.35, 0.75, macro1 + macro2 * 0.35);
  let mid = vnoise2(wp.xz * 0.17) * 0.6 + vnoise2(wp.xz * 0.6) * 0.4;
  var grass = mix(vec3f(0.036, 0.092, 0.018), vec3f(0.085, 0.110, 0.032), dry * 0.7);
  grass *= 0.75 + 0.5 * mid;
  let patchy = fbm2(wp.xz * 0.045 + 3.0, 3);
  grass = mix(grass * vec3f(0.8, 0.9, 0.7), grass * vec3f(1.15, 1.1, 0.9), smoothstep(0.3, 0.7, patchy));
  // faixas de corte da grama (padrão de roçadeira) e tufos em média distância
  let mow = step(0.5, fract(dot(wp.xz, vec2f(0.6, 0.8)) / 7.0));
  grass *= mix(1.0, 0.94 + 0.12 * mow, (1.0 - m.g) * (1.0 - m.a) * 0.8);
  let dmid = textureSample(detailTex, sampRep, wp.xz / 9.0, 2);
  grass *= 0.8 + 0.4 * dmid.z;
  let tufts = vnoise2(wp.xz * 2.3) * 0.5 + vnoise2(wp.xz * 5.1) * 0.5;
  grass *= 0.82 + 0.36 * tufts;
  grass = mix(grass, grass * vec3f(0.8, 1.05, 0.8), m.g * 0.6);
  let dsoil = detailNXZ(2, wp.xz, 2.0, 0.0);
  let fade = 1.0 - smoothstep(50.0, 220.0, camd);
  grass *= mix(1.0, 0.75 + 0.5 * dsoil.w, fade * 0.8);
  // pequenas manchas de terra
  let bare = smoothstep(0.62, 0.75, fbm2(wp.xz * 0.11 + 5.0, 4)) * (1.0 - m.a) * 0.7;
  var alb = mix(grass, vec3f(0.11, 0.085, 0.06), bare);
  var n = applyNXZ(s.n, dsoil.xy, 0.35 * fade);
  var rough = 0.92;
  // chão de mata: serrapilheira
  if (m.b > 0.01) {
    let dl = detailNXZ(5, wp.xz, 2.0, 0.0);
    let lit = mix(vec3f(0.10, 0.065, 0.035), vec3f(0.16, 0.11, 0.05), dl.w) * (0.6 + 0.6 * dl.z);
    alb = mix(alb, lit, m.b);
    n = normalize(mix(n, applyNXZ(s.n, dl.xy, 0.8 * fade), m.b));
  }
  // brita
  let gn = fbm2(wp.xz * 0.9, 3) * 0.2 + fbm2(wp.xz * 3.0, 2) * 0.08;
  let gm = smoothstep(0.47, 0.53, m.r + gn - 0.12);
  if (gm > 0.0) {
    let dg = detailNXZ(1, wp.xz, 2.6, 0.0);
    let dg2 = detailNXZ(1, wp.xz * 1.37 + 3.1, 2.6, 0.0);
    let id = dg.w;
    var gc = mix(vec3f(0.36, 0.33, 0.29), vec3f(0.52, 0.47, 0.40), id);
    gc = mix(gc, vec3f(0.30, 0.30, 0.31), step(0.75, fract(id * 7.31)));
    gc *= 0.55 + 0.6 * dg.z;
    gc *= mix(1.0, 0.85, smoothstep(0.4, 0.8, dg2.z));
    alb = mix(alb, gc, gm);
    n = normalize(mix(n, applyNXZ(s.n, dg.xy + dg2.xy * 0.5, 1.7 * fade), gm));
    rough = mix(rough, 0.75, gm);
    s.ao = mix(1.0, 0.3 + 0.7 * dg.z * dg.z, gm);
    alb = mix(alb, alb * (0.55 + 0.6 * dg.z), gm);
  }
  // região distante: dossel de floresta (fora da região interna)
  let dc = length(wp.xz - vec2f(-62.0, -98.0));
  let canopy = select(m.a * smoothstep(380.0, 700.0, dc), 1.0, !inner);
  if (canopy > 0.0) {
    let c1 = fbm2(wp.xz * 0.11, 4);
    let c2 = vnoise2(wp.xz * 0.45);
    let crown = smoothstep(0.25, 0.75, c1 * 0.8 + c2 * 0.4);
    var cc = mix(vec3f(0.018, 0.032, 0.012), vec3f(0.055, 0.085, 0.028), crown);
    cc = mix(cc, cc * vec3f(1.35, 1.0, 0.7), smoothstep(0.55, 0.8, fbm2(wp.xz * 0.004, 3)));
    let slope = 1.0 - s.n.y;
    cc = mix(cc, vec3f(0.12, 0.11, 0.09), smoothstep(0.45, 0.7, slope) * 0.6);
    alb = mix(alb, cc, canopy);
    // relevo de copas na normal
    let e = 1.5;
    let hc = fbm2(wp.xz * 0.11, 3); let hx = fbm2((wp.xz + vec2f(e, 0.0)) * 0.11, 3); let hz = fbm2((wp.xz + vec2f(0.0, e)) * 0.11, 3);
    n = normalize(mix(n, normalize(s.n + vec3f(hc - hx, 0.0, hc - hz) * 5.0), canopy));
    // relevo de grande escala (ravinas e cristas) para quebrar as facetas das montanhas
    let farK = smoothstep(250.0, 1200.0, camd) * canopy;
    if (farK > 0.0) {
      let e2 = 30.0; let q = wp.xz * 0.0045;
      let g0 = ridge2(q, 4); let gx = ridge2(q + vec2f(e2 * 0.0045, 0.0), 4); let gz = ridge2(q + vec2f(0.0, e2 * 0.0045), 4);
      n = normalize(n + vec3f(g0 - gx, 0.0, g0 - gz) * 9.0 * farK);
      let rock = smoothstep(0.62, 0.8, g0) * smoothstep(0.25, 0.5, 1.0 - n.y);
      alb = mix(alb, vec3f(0.13, 0.12, 0.10) * (0.8 + 0.4 * c2), rock * farK * 0.7);
      alb *= mix(1.0, 0.7 + 0.5 * g0, farK);
    }
    s.ao = mix(s.ao, 0.55 + 0.45 * crown, canopy);
    s.cls = select(0u, 1u, canopy > 0.5);
  }
  // grama espalha luz (contraluz): tratada como folhagem fora da brita/serrapilheira
  s.albedo = alb; s.n = n; s.rough = rough;
  return s;
}

fn matAsphalt(i: VOut, runoff: bool) -> Surf {
  var s = surfDefault(normalize(i.nrm));
  let wp = i.wpos;
  let u = i.uv.x; let sv = i.uv.y;
  let camd = length(wp - V.camPos.xyz);
  let td0 = trackData(sv, 0u);
  let hw = td0.x; let rl = select(td0.y, 99.0, runoff); let wetS = select(td0.z, 0.0, runoff); let brake = select(td0.w, 0.0, runoff);
  let d1 = detailNXZ(0, wp.xz, 4.0, 0.6);
  let d2 = detailNXZ(0, vec2f(wp.x * 0.8 - wp.z * 0.6, wp.x * 0.6 + wp.z * 0.8), 1.7, 0.0);
  var base = 0.085 + (d1.w - 0.4) * 0.07 + (d2.w - 0.4) * 0.03;
  // manchas grandes / desgaste
  let wear = fbm2(vec2f(u * 0.25, sv * 0.02), 4);
  base *= 0.92 + 0.16 * wear;
  // remendos retangulares (asfalto mais novo, bordas nítidas)
  let seg = floor(sv / 19.0);
  let hp = hash21(vec2f(seg, 3.0));
  var seam = 0.0;
  if (hp > 0.62 && !runoff) {
    let pc = (hash21(vec2f(seg, 7.0)) - 0.5) * hw * 1.2;
    let pw = 1.2 + hash21(vec2f(seg, 9.0)) * 2.5;
    let s0 = seg * 19.0 + 2.0 + hash21(vec2f(seg, 11.0)) * 5.0;
    let s1 = s0 + 4.0 + hash21(vec2f(seg, 13.0)) * 9.0;
    let du = abs(u - pc) - pw; let dsv = max(s0 - sv, sv - s1);
    let dd = max(du, dsv);
    base *= mix(1.0, 0.86 + 0.08 * d2.w, smoothstep(0.03, -0.03, dd));
    seam = max(seam, smoothstep(0.03, 0.0, abs(dd)) * 0.6);
  }
  // junta longitudinal (faixa de pavimentação) e fissuras transversais
  seam = max(seam, smoothstep(0.03, 0.0, abs(u - 0.4 + sin(sv * 0.05) * 0.03)) * 0.8);
  let crackN = fbm2(vec2f(u * 2.0, sv * 0.8), 3);
  let crackS = fract(sv / 11.3 + crackN * 0.08);
  seam = max(seam, smoothstep(0.004, 0.0, abs(crackS - 0.5) * 11.3 * 0.1) * step(0.55, hash21(vec2f(floor(sv / 11.3), 1.0))) * smoothstep(0.3, 0.6, crackN));
  // borracha na trajetória
  let rub = (1.0 - smoothstep(0.5, 1.6, abs(u - rl))) * 0.85 + (1.0 - smoothstep(0.3, 1.0, abs(u - rl - 1.45))) * 0.3 + (1.0 - smoothstep(0.3, 1.0, abs(u - rl + 1.45))) * 0.3;
  let rubN = 0.7 + 0.3 * vnoise2(vec2f(u * 3.0, sv * 0.3));
  var rough = 0.88 - rub * 0.2;
  base = mix(base, base * 0.55, clamp(rub * rubN, 0.0, 1.0) * select(1.0, 0.0, runoff));
  // marcas de freada antes das curvas
  if (brake > 0.01 && !runoff) {
    let lane = abs(fract((u - rl) / 1.35 + 0.5) - 0.5);
    let streak = smoothstep(0.12, 0.0, lane) * step(abs(u - rl), 1.8) * (0.5 + 0.5 * vnoise2(vec2f(u * 12.0, sv * 0.08)));
    base = mix(base, base * 0.45, streak * brake * 0.8);
  }
  base = mix(base, base * 0.7, seam);
  var alb = vec3f(base * 0.98, base, base * 1.03);
  // linhas brancas da borda
  var paint = 0.0;
  if (!runoff) {
    let edge = hw - 0.12;
    paint = smoothstep(0.012, 0.0, abs(abs(u) - edge) - 0.11);
    // largada / chegada
    let sl = sv - G.track.w;
    let lineS = smoothstep(0.02, 0.0, abs(sl) - 0.3);
    // xadrez fino junto à linha
    let chk = step(0.0, sl - 0.3) * step(sl, 1.3) * step(0.5, fract(floor(u / 0.5) * 0.5 + floor((sl - 0.3) / 0.5) * 0.5));
    paint = max(paint, lineS * step(abs(u), hw - 0.2));
    // grid: caixas alternadas atrás da linha
    let gs = -sl - 8.0;
    if (gs > 0.0 && gs < 64.0) {
      let k = floor(gs / 8.0);
      let side = select(-1.0, 1.0, (k % 2.0) < 0.5);
      let lu = u * side;
      let f = gs - k * 8.0;
      let box = (step(1.0, lu) * step(lu, 4.4) * smoothstep(0.02, 0.0, abs(f - 0.0) - 0.08)) +
                (smoothstep(0.02, 0.0, abs(lu - 1.0) - 0.08) * step(f, 1.6)) + (smoothstep(0.02, 0.0, abs(lu - 4.4) - 0.08) * step(f, 1.6));
      paint = max(paint, clamp(box, 0.0, 1.0));
    }
    let worn = smoothstep(0.25, 0.65, vnoise2(vec2f(u * 6.0, sv * 1.3)) * 0.6 + d1.w * 0.6);
    paint *= mix(1.0, 0.55, worn * 0.7);
    let pc = mix(vec3f(0.72, 0.72, 0.70), vec3f(0.08), chk * 0.0);
    alb = mix(alb, pc, paint);
    alb = mix(alb, vec3f(0.02), chk * 0.0);
    rough = mix(rough, 0.6, paint);
  }
  // normal de detalhe
  let fade = 1.0 - smoothstep(20.0, 90.0, camd);
  var n = applyNXZ(s.n, d1.xy * 0.9 + d2.xy * 0.5, 0.55 * fade * (1.0 - paint * 0.6));
  // poças / trechos molhados
  var wet = 0.0;
  if (wetS > 0.01) {
    let warp = vec2f(fbm2(wp.xz * 0.5, 2), fbm2(wp.xz * 0.5 + 7.0, 2)) * 1.5;
    let pn = fbm2(wp.xz * 0.2 + warp, 4) + fbm2(wp.xz * 1.3, 3) * 0.12;
    let edgeBias = smoothstep(hw * 0.35, hw, abs(u)) * 0.22 + (1.0 - smoothstep(0.0, 1.0, abs(abs(u - rl) - 0.9))) * 0.08;
    let v = pn + edgeBias + (wetS - 1.0) * 0.6;
    let w = smoothstep(0.72, 0.86, v);
    let damp = smoothstep(0.56, 0.78, v);
    wet = w;
    alb *= mix(1.0, 0.62, max(damp * 0.6, w));
    rough = mix(rough, 0.75, damp * 0.4);
    rough = mix(rough, 0.14, w);
    // ondulações finas na água
    let rip = vec2f(vnoise2(wp.xz * 9.0 + G.time.x * 0.3) - 0.5, vnoise2(wp.xz * 9.0 + 4.0 - G.time.x * 0.25) - 0.5) * 0.06;
    n = normalize(mix(n, normalize(s.n + vec3f(rip.x, 0.0, rip.y)), w));
  }
  s.albedo = alb; s.rough = rough; s.n = n; s.wet = wet; s.ao = 0.9 + 0.1 * d1.z;
  s.cls = select(0u, 3u, wet > 0.02);
  return s;
}

fn matKerb(i: VOut) -> Surf {
  var s = surfDefault(normalize(i.nrm));
  let sv = i.uv.y; let t = i.uv.x;
  let stripe = step(0.5, fract(sv / 1.5));
  var c = select(vec3f(0.62, 0.05, 0.035), vec3f(0.70, 0.70, 0.68), stripe > 0.5);
  let d = detailNXZ(3, i.wpos.xz, 2.0, 0.0);
  let dirt = smoothstep(0.3, 0.8, vnoise2(vec2f(sv * 0.7, t * 4.0)) * 0.7 + d.w * 0.5);
  c *= mix(1.0, 0.55, dirt * 0.5);
  // borracha escura na borda interna
  let rub = (1.0 - smoothstep(0.0, 0.35, t)) * (0.5 + 0.5 * vnoise2(vec2f(sv * 2.0, 1.0)));
  c = mix(c, vec3f(0.03), rub * 0.6);
  s.albedo = c; s.rough = 0.55 + dirt * 0.2; s.n = applyNXZ(s.n, d.xy, 0.3);
  return s;
}
fn matConcrete(i: VOut, tint: vec3f) -> Surf {
  var s = surfDefault(normalize(i.nrm));
  let p = i.wpos;
  let a = abs(s.n);
  // projeção triplanar simples
  var uvp = p.xz;
  if (a.x > a.y && a.x > a.z) { uvp = p.zy; } else if (a.z > a.y) { uvp = p.xy; }
  let d = textureSample(detailTex, sampRep, uvp / 2.0, 3);
  var c = tint * (0.94 + 0.08 * d.w) * (0.94 + 0.06 * d.z);
  // juntas verticais entre painéis pré-moldados e manchas de escorrimento
  let jx = abs(fract(uvp.x / 3.0) - 0.5) * 3.0;
  c *= 1.0 - (1.0 - smoothstep(0.0, 0.02, jx)) * 0.35;
  c *= 1.0 - 0.12 * smoothstep(0.55, 0.9, vnoise2(vec2f(uvp.x * 2.0, uvp.y * 0.2))) * (1.0 - smoothstep(0.0, 1.0, fract(uvp.y)));
  // sujeira na base
  let lowDirt = 1.0 - smoothstep(0.0, 0.6, i.uv.y);
  c *= mix(1.0, 0.6, lowDirt * select(0.0, 1.0, i.attr.y == 1u));
  s.albedo = c; s.rough = 0.85;
  return s;
}

fn matWorld(i: VOut) -> Surf {
  let m = i.attr.x;
  var s = surfDefault(normalize(i.nrm));
  switch (m) {
    case 1u: { s = matTerrain(i); }
    case 2u: { s = matAsphalt(i, false); }
    case 22u: { s = matAsphalt(i, true); }
    case 3u: { s = matKerb(i); }
    case 4u: { s = matConcrete(i, vec3f(0.42, 0.41, 0.39)); }
    case 17u: { // muro dos boxes: branco com faixas
      s = matConcrete(i, vec3f(0.62, 0.62, 0.6));
      // marcas de pneu pretas na base do muro
      let tm = smoothstep(0.6, 0.9, vnoise2(vec2f(i.uv.x * 0.15, 3.0))) * (1.0 - smoothstep(0.1, 0.45, i.uv.y));
      s.albedo = mix(s.albedo, vec3f(0.04), tm * 0.7);
      let band = step(0.5, fract(i.uv.x / 4.0));
      if (i.uv.y > 0.75) { s.albedo = mix(s.albedo, select(vec3f(0.55, 0.04, 0.03), vec3f(0.6), band > 0.5), 0.9); }
    }
    case 5u: { // guard-rail galvanizado
      let d = textureSample(detailTex, sampRep, i.uv * vec2f(0.5, 1.0), 8);
      s.albedo = vec3f(0.56, 0.57, 0.58) * (0.8 + 0.35 * d.w); s.metal = 1.0; s.rough = 0.48 + 0.2 * d.w;
      // sujeira/ferrugem leve na parte de baixo
      s.albedo = mix(s.albedo, vec3f(0.25, 0.2, 0.15), (1.0 - smoothstep(0.0, 0.5, i.uv.y)) * 0.3);
      let rust = smoothstep(0.7, 0.9, vnoise2(vec2f(i.wpos.x + i.wpos.z, i.wpos.y * 6.0) * 1.3));
      s.albedo = mix(s.albedo, vec3f(0.30, 0.20, 0.13), rust * 0.25); s.rough = mix(s.rough, 0.8, rust); s.metal = mix(1.0, 0.3, rust);
      let scuff = smoothstep(0.7, 0.95, vnoise2(vec2f((i.wpos.x + i.wpos.z) * 0.4, 0.0)));
      s.albedo = mix(s.albedo, vec3f(0.03), scuff * 0.5 * (1.0 - smoothstep(0.3, 0.7, i.uv.y)));
    }
    case 6u: { // barreira de pneus
      let d = textureSample(detailTex, sampRep, i.uv * vec2f(1.0, 2.0), 9);
      let painted = i.attr.y;
      var c = vec3f(0.025, 0.025, 0.027);
      if (painted == 1u) { c = vec3f(0.6, 0.6, 0.58); } else if (painted == 2u) { c = vec3f(0.55, 0.05, 0.04); }
      // sulco/lateral do pneu
      let tread = smoothstep(0.35, 0.5, abs(fract(i.uv.x * 24.0) - 0.5)) * step(0.3, i.uv.y) * step(i.uv.y, 0.7);
      s.albedo = c * (0.85 + 0.3 * d.w) * (1.0 - tread * 0.3); s.rough = select(0.85, 0.6, painted > 0u);
      s.n = perturb(s.n, i.wpos, i.uv * 4.0, normalize(vec3f(d.xy * 2.0 - 1.0, 2.0)));
    }
    case 7u: { // pintura branca sobre concreto: juntas, escorrimento e sujeira na base
      s = matConcrete(i, vec3f(0.72, 0.72, 0.70));
      let a = abs(s.n); var uvp = i.wpos.xz;
      if (a.x > a.y && a.x > a.z) { uvp = i.wpos.zy; } else if (a.z > a.y) { uvp = i.wpos.xy; }
      let streak = smoothstep(0.55, 0.85, vnoise2(vec2f(uvp.x * 3.0, uvp.y * 0.25))) * smoothstep(0.0, 2.0, fract(uvp.y / 4.0) * 4.0);
      s.albedo *= 1.0 - streak * 0.18;
      s.rough = 0.7;
    }
    case 8u: { s.albedo = vec3f(0.6, 0.61, 0.62); s.metal = 1.0; s.rough = 0.38; }
    case 9u: { // telhado metálico ondulado
      let r = sin(i.uv.x * TAU * 6.0);
      s.n = perturb(s.n, i.wpos, i.uv, normalize(vec3f(r * 0.35, 0.0, 1.0)));
      s.albedo = vec3f(0.5, 0.52, 0.54); s.metal = 0.8; s.rough = 0.45;
    }
    case 10u: { // assentos da arquibancada
      let row = i.attr.y;
      s.albedo = select(vec3f(0.05, 0.16, 0.42), vec3f(0.62, 0.62, 0.6), row % 7u == 3u); s.rough = 0.45;
    }
    case 11u: { // painéis/placas genéricos: faixas e blocos de cor variados (sem marcas)
      let k = i.attr.y;
      let pal = array<vec3f, 4>(vec3f(0.06, 0.2, 0.5), vec3f(0.55, 0.08, 0.05), vec3f(0.08, 0.32, 0.12), vec3f(0.6, 0.45, 0.05));
      let b = step(0.5, fract(i.uv.x * 2.0));
      let band = step(0.55, fract(i.uv.y * 1.0 + 0.2));
      s.albedo = mix(vec3f(0.85, 0.85, 0.82), pal[k % 4u], max(b * select(1.0, 0.0, k > 0u), band * select(0.0, 1.0, k > 0u)));
      s.rough = 0.5;
    }
    case 12u: { // vidro escuro / interior de garagem com luz quente
      s.albedo = vec3f(0.03, 0.04, 0.05); s.rough = 0.06; s.metal = 0.6; s.cls = 0u;
      if (i.attr.y == 1u) { let strip = smoothstep(0.02, 0.0, abs(fract(i.wpos.y * 0.25 + 0.1) - 0.5) - 0.06); s.albedo = vec3f(0.12, 0.1, 0.08); s.metal = 0.0; s.rough = 0.8; s.emis = 0.6 + strip * 3.0; }
    }
    case 13u: { s = matConcrete(i, vec3f(0.55, 0.3, 0.22)); }
    case 14u: { s.albedo = vec3f(0.45, 0.46, 0.47); s.metal = 1.0; s.rough = 0.5; }
    case 15u: { s.albedo = vec3f(0.55, 0.56, 0.56); s.metal = 0.6; s.rough = 0.4; }
    case 16u: { s = matConcrete(i, vec3f(0.5, 0.5, 0.48)); }
    case 18u: { s.albedo = vec3f(0.06, 0.06, 0.065); s.rough = 0.4; s.metal = 0.5; }
    case 19u: { // painel de luzes do pórtico
      let g = fract(i.uv * vec2f(5.0, 1.0)) - 0.5;
      let lamp = smoothstep(0.32, 0.28, length(g));
      s.albedo = mix(vec3f(0.02), vec3f(0.08, 0.6, 0.12), lamp); s.rough = 0.2; s.emis = lamp * 2.5;
    }
    case 20u: { s.albedo = vec3f(0.65, 0.12, 0.08); s.rough = 0.8; }
    case 23u: { // público: camisetas variadas e pele
      let k = i.attr.y;
      let pal = array<vec3f, 8>(vec3f(0.32, 0.08, 0.07), vec3f(0.07, 0.10, 0.22), vec3f(0.55, 0.55, 0.52), vec3f(0.06, 0.06, 0.07), vec3f(0.36, 0.30, 0.18), vec3f(0.10, 0.18, 0.12), vec3f(0.28, 0.29, 0.32), vec3f(0.42, 0.26, 0.16));
      s.albedo = select(pal[k % 8u], select(vec3f(0.42, 0.26, 0.17), vec3f(0.2, 0.12, 0.07), i.attr.z == 2u), i.attr.z > 0u); s.rough = 0.8;
    }
    case 21u: { s.albedo = vec3f(0.3, 0.2, 0.12); s.rough = 0.8; }
    default: { s.albedo = vec3f(0.5); }
  }
  return s;
}

fn twoSided(i: VOut) -> vec3f {
  let ds = i.attr.x == 5u || i.attr.x == 14u || i.attr.x == 52u;
  if (ds && dot(i.nrm, V.camPos.xyz - i.wpos) < 0.0) { return -i.nrm; }
  return i.nrm;
}
fn matAll(i: VOut) -> Surf {
  if (i.attr.x >= 40u && i.attr.x < 80u) { return matCar(i); }
  return matWorld(i);
}

@fragment
fn fsMeshG(i0: VOut) -> GOut {
  var i = i0; i.nrm = twoSided(i);
  let s = matAll(i);
  return packG(s, i.cur, i.prev);
}
@fragment
fn fsMeshCube(i0: VOut) -> @location(0) vec4f {
  var i = i0; i.nrm = twoSided(i);
  var s: Surf;
  if (i.attr.x == 1u) { s = surfDefault(normalize(i.nrm)); s.albedo = vec3f(0.06, 0.09, 0.03); s.cls = 1u; }
  else { s = matAll(i); }
  return vec4f(shadeForward(s, i.wpos, V.camPos.xyz), 1.0);
}
