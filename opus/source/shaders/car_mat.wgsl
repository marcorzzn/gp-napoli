// ---------------------------------------------------------------------------
// car_mat.wgsl — materiais do Uno Mille EP
// ---------------------------------------------------------------------------
fn segDist(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let pa = p - a; let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// distância às juntas de carroceria (frisos), em coordenadas locais
fn panelGap(lp: vec3f, n: vec3f) -> f32 {
  let az = abs(lp.z);
  var g = 1.0;
  let side = abs(n.z) > 0.55;
  if (side) {
    // porta: borda dianteira e traseira
    g = min(g, select(1.0, abs(lp.x - 0.775), lp.y > 0.27 && lp.y < 0.875));
    g = min(g, select(1.0, abs(lp.x + 0.548), lp.y > 0.27 && lp.y < 0.99));
    // capô na lateral do para-lama
    // vinco/friso lateral
    g = min(g, select(1.0, abs(lp.y - 0.612) * 0.9, lp.x > -1.70 && lp.x < 1.76));
    // tampa do tanque (lado esquerdo)
    if (lp.z < 0.0) { g = min(g, abs(length(vec2f(lp.x + 1.27, lp.y - 0.83)) - 0.052)); }
  }
  if (n.y > 0.5 && lp.x > 0.5) {
    // capô: traseira e laterais
    g = min(g, select(1.0, abs(lp.x - 0.865), az < 0.72));
    g = min(g, select(1.0, abs(az - 0.703), lp.x > 0.86 && lp.x < 1.80));
    // vincos do capô (painel central levemente elevado)
    g = min(g, select(1.0, abs(az - (0.34 - (lp.x - 0.9) * 0.03)) * 2.2, lp.x > 0.9 && lp.x < 1.78));
  }
  if (n.x > 0.6 && lp.x > 1.6) {
    g = min(g, select(1.0, abs(lp.y - 0.737), az < 0.74));
  }
  if (n.x < -0.5 && lp.x < -1.5) {
    // tampa traseira
    g = min(g, select(1.0, abs(az - 0.655), lp.y > 0.53 && lp.y < 1.38));
    g = min(g, select(1.0, abs(lp.y - 0.535), az < 0.655));
  }
  if (n.y > 0.6 && lp.x < -1.3) { g = min(g, select(1.0, abs(lp.x + 1.505), az < 0.62)); }
  return g;
}
fn triDetail(lp: vec3f, n: vec3f, layer: i32, scale: f32) -> vec4f {
  let a = abs(n);
  var uvp = lp.xy;
  if (a.x > a.y && a.x > a.z) { uvp = lp.zy; } else if (a.y > a.z) { uvp = lp.xz; }
  return textureSample(detailTex, sampRep, uvp / scale, layer);
}
fn textMask(uv: vec2f) -> f32 { return textureSampleLevel(textTex, sampClamp, uv, 0.0).r; }

fn paint(i: VOut, lp: vec3f, ln: vec3f, s0: Surf) -> Surf {
  var s = s0;
  var base = PAINT_RGB;
  let g = panelGap(lp, ln);
  let w = max(fwidth(g), 1e-5);
  let gap = 1.0 - smoothstep(0.0012, 0.0012 + w * 1.5, g);
  let gapEdge = (1.0 - smoothstep(0.0012, 0.0045 + w, g)) - gap;
  let dirt = (1.0 - smoothstep(0.26, 0.5, lp.y)) * 0.22 * (0.6 + 0.4 * vnoise2(lp.xz * 20.0));
  base = mix(base, vec3f(0.20, 0.18, 0.15), dirt);
  // faixa de proteção inferior (cinza-azulado) nas laterais entre as caixas de roda
  let side = abs(ln.z) > 0.35 && lp.y < 0.445 && lp.y > 0.25;
  if (side) {
    let edgeL = smoothstep(0.43, 0.445, lp.y);
    let stripC = mix(vec3f(0.14, 0.19, 0.25), base, edgeL);
    base = stripC; s.metal = 0.3;
  }
  // grelha de ventilação do capô (perto do para-brisa)
  if (ln.y > 0.6 && lp.x > 0.93 && lp.x < 1.03 && abs(lp.z) < 0.24) {
    let slot = step(0.45, fract(lp.z * 52.0)) * smoothstep(0.93, 0.945, lp.x) * (1.0 - smoothstep(1.015, 1.03, lp.x));
    base = mix(base, vec3f(0.01), slot); s.clear = 1.0 - slot; s.rough = mix(s.rough, 0.8, slot);
  }
  s.albedo = mix(base, base * 0.08, gap) * (1.0 - gapEdge * 0.25);
  s.rough = mix(0.28, 0.7, gap);
  s.metal = 0.55;
  s.clear = 1.0 - gap * 0.9;
  let fp = lp * 650.0;
  let fh = hash31(floor(fp));
  let fw = max(fwidth(fp.x) + fwidth(fp.y), 1e-3);
  s.emis = step(0.93, fh) * fract(fh * 37.1) * 0.6 * (1.0 - gap) * (1.0 - smoothstep(0.5, 1.5, fw));
  s.cls = 2u;
  return s;
}
const PAINT_RGB: vec3f = vec3f(0.30, 0.455, 0.60);
fn matCar(i: VOut) -> Surf {
  var s = surfDefault(normalize(i.nrm));
  let lp = i.lpos;
  let ln = normalize(i.lnrm);
  let m = i.attr.x;
  switch (m) {
    case 40u, 63u: {
      // pesos interpolados da casca SDF
      let wp = i.uv.x; let wr = i.uv.y; let wu = i.extra; let wi = 1.0 - wp - wr - wu;
      // fronteiras exatas por pixel: vedação das janelas e caixa de roda
      let wwin = windows(lp);
      let azl = abs(lp.z);
      let rArch = length(vec2f(lp.x - select(-1.18, 1.18, lp.x > 0.0), (lp.y - 0.295) * 1.04));
      let inArch = azl > 0.45 && azl < 0.725 && rArch < 0.352 && wi < 0.5;
      let seal = wwin < 0.017 && wi < 0.6 && wu < 0.5;
      let bumpZone = ((lp.x > 1.50 && lp.y > 0.215 && lp.y < 0.502) || (lp.x < -1.488 && lp.y > 0.23 && lp.y < 0.517)) && wi < 0.5;
      if (seal) { s.albedo = vec3f(0.012); s.rough = 0.55; }
      else if (bumpZone && !inArch) { let d = triDetail(lp, ln, 6, 0.25); s.albedo = vec3f(0.008, 0.0085, 0.010) * (0.8 + 0.45 * d.w); s.rough = 0.5; }
      else if (inArch) { s.albedo = vec3f(0.016, 0.016, 0.018); s.rough = 0.85; s.ao = 0.4; }
      else if (wu >= wp && wu >= wi) { s.albedo = vec3f(0.016, 0.016, 0.018); s.rough = 0.85; s.ao = 0.4; }
      else if (wi > wp) { let d = triDetail(lp, ln, 7, 0.08); s.albedo = vec3f(0.045, 0.045, 0.05) * (0.8 + 0.4 * d.z); s.rough = 0.85; s.ao = 0.4; }
      else { s = paint(i, lp, ln, s); }
    }
    case 67u: { s = paint(i, lp, ln, s); }
    case 41u, 62u: { // plástico preto texturizado (para-choques, espelhos)
      let d = triDetail(lp, ln, 6, 0.25);
      var c = vec3f(0.008, 0.0085, 0.010) * (0.8 + 0.45 * d.w);
      var rough = select(0.34, 0.5, m == 41u);
      let az = abs(lp.z);
      if (m == 41u && lp.x > 1.55 && ln.x > 0.3) {
        // grelhas laterais inferiores + tomada central
        let vent = step(0.235, lp.y) * step(lp.y, 0.30) * step(0.36, az) * step(az, 0.66);
        let slat = step(0.5, fract(lp.y * 90.0));
        let intake = step(0.445, lp.y) * step(lp.y, 0.485) * step(az, 0.32);
        c = mix(c, vec3f(0.006), max(vent * (0.5 + 0.5 * slat), intake * 0.9));
        // friso horizontal
        let groove = 1.0 - smoothstep(0.0, 0.004, abs(lp.y - 0.395));
        c *= 1.0 - groove * 0.6;
        s.n = perturb(s.n, i.wpos, lp.zy, normalize(vec3f(0.0, (slat - 0.5) * vent * 0.6, 1.0)));
      }
      if (m == 41u && lp.x < -1.5 && ln.x < -0.3) {
        let groove = 1.0 - smoothstep(0.0, 0.004, abs(lp.y - 0.41));
        c *= 1.0 - groove * 0.6;
      }
      s.albedo = c; s.rough = rough;
      s.n = perturb(s.n, i.wpos, lp.xy * 4.0 + lp.zz, normalize(vec3f((d.xy - 0.5) * 0.3, 1.0)));
    }
    case 42u: { s.albedo = vec3f(0.95, 0.95, 0.96); s.metal = 0.75; s.rough = 0.16; s.emis = 0.0; }
    case 43u: { // pneu
      let v = i.uv.y; let u = i.uv.x;
      var c = vec3f(0.028, 0.028, 0.03);
      var rough = 0.82;
      let tread = smoothstep(0.38, 0.42, v) * (1.0 - smoothstep(0.58, 0.62, v));
      if (tread > 0.0) {
        let lat = (v - 0.5) / 0.08;
        let grooveL = (1.0 - smoothstep(0.03, 0.07, abs(abs(lat) - 0.36))) + (1.0 - smoothstep(0.03, 0.06, abs(lat)));
        let blk = fract(u * 72.0 + sign(lat) * 0.5 * step(0.36, abs(lat)) + lat * 0.25);
        let sipe = (1.0 - smoothstep(0.03, 0.08, abs(blk - 0.5))) * step(0.2, abs(lat)) * step(abs(lat), 0.85);
        let gro = clamp(grooveL + sipe * 0.8, 0.0, 1.0) * tread;
        c *= 1.0 - gro * 0.7;
        s.ao = 1.0 - gro * 0.6;
        s.n = perturb(s.n, i.wpos, vec2f(u * 6.0, v), normalize(vec3f(0.0, (gro - 0.5) * 0.4, 1.0)));
        rough = 0.75;
      } else {
        // lateral com letreiro discreto em relevo
        let ring = (1.0 - smoothstep(0.0, 0.01, abs(v - 0.2))) + (1.0 - smoothstep(0.0, 0.01, abs(v - 0.8)));
        let txt = step(0.6, fract(u * 40.0)) * step(0.5, fract(u * 3.0)) * ((1.0 - smoothstep(0.0, 0.025, abs(v - 0.27))) + (1.0 - smoothstep(0.0, 0.025, abs(v - 0.73))));
        c *= 1.0 + ring * 0.4 + txt * 0.5;
        rough = 0.7 - txt * 0.1;
      }
      s.albedo = c; s.rough = rough;
    }
    case 44u: { // calota de plástico prateada com aletas
      let r = i.uv.y; let a = i.uv.x;
      var c = vec3f(0.62, 0.63, 0.64);
      var hole = 0.0;
      // 14 aletas trapezoidais
      let sec = fract(a * 10.0);
      let slot = step(0.42, r) * step(r, 0.82) * (1.0 - smoothstep(0.24, 0.28, abs(sec - 0.5) * (1.5 - r * 0.6)));
      hole = max(hole, slot);
      // anel de furos pequenos
      let sec2 = fract(a * 28.0 + 0.5);

      // tampa central
      let cap = 1.0 - smoothstep(0.17, 0.18, r);
      let ringL = (1.0 - smoothstep(0.0, 0.012, abs(r - 0.25))) + (1.0 - smoothstep(0.0, 0.012, abs(r - 0.95)));
      c = mix(c, vec3f(0.012), hole);
      c *= 1.0 - ringL * 0.35;
      c = mix(c, vec3f(0.55, 0.56, 0.58), cap);
      s.albedo = c; s.rough = mix(0.32, 0.9, hole); s.metal = mix(0.35, 0.0, hole); s.ao = 1.0 - hole * 0.7;
      // relevo das aletas
      s.n = perturb(s.n, i.wpos, vec2f(a * 10.0, r * 4.0), normalize(vec3f((sec - 0.5) * slot * 1.2, 0.0, 1.0)));
    }
    case 45u: { // farol: lente estriada sobre refletor parabólico cromado, aro escuro
      let ry = (lp.y - 0.64) / 0.066; let rz = (abs(lp.z) - 0.455) / 0.146;
      let bowl = clamp(length(vec2f(ry * 1.05, rz * 0.75)), 0.0, 1.0);
      let flute = fract(lp.z * 70.0) - 0.5;
      s.n = perturb(s.n, i.wpos, lp.zy * 50.0, normalize(vec3f(flute * 0.6 + rz * 0.6, ry * 0.6, 1.0)));
      let bulb = 1.0 - smoothstep(0.0, 0.14, length(vec2f(ry, rz * 0.9 + 0.15)));
      let rim = smoothstep(0.82, 0.95, max(abs(ry), abs(rz)));
      s.albedo = mix(vec3f(0.9, 0.9, 0.9), vec3f(0.35, 0.35, 0.36), bowl * 0.7);
      s.albedo = mix(s.albedo, vec3f(0.95, 0.9, 0.75), bulb * 0.8);
      s.albedo = mix(s.albedo, vec3f(0.05), rim);
      s.metal = 0.85 * (1.0 - rim); s.rough = mix(0.04, 0.15, bowl); s.ao = 1.0;
      s.emis = O.params.z * 30.0 + 0.08 * (1.0 - rim);
    }
    case 46u: { // lanterna: âmbar em cima, vermelho (freio), fumê embaixo
      let y = lp.y;
      var c = vec3f(0.42, 0.012, 0.01);
      var e = O.params.x * 7.0;
      if (y > 0.80) { c = vec3f(0.62, 0.22, 0.01); e = 0.0; }
      else if (y < 0.60) { c = vec3f(0.18, 0.02, 0.02); e = O.params.y * 4.0; if (O.params.y > 0.0) { c = vec3f(0.6, 0.6, 0.6); } }
      let rib = sin(lp.z * 120.0) * 0.5 + 0.5;
      let seg = step(0.5, fract((y - 0.6) / 0.034));
      c *= 0.92 + 0.12 * seg * (1.0 - O.params.x);
      let sep = 1.0 - smoothstep(0.0, 0.003, min(abs(y - 0.80), abs(y - 0.60)));
      c *= (0.75 + 0.35 * rib) * (1.0 - sep * 0.8);
      s.albedo = c; s.rough = 0.08; s.metal = 0.3; s.emis = e;
      s.n = perturb(s.n, i.wpos, lp.zy * 40.0, normalize(vec3f((rib - 0.5) * 0.25, 0.0, 1.0)));
    }
    case 47u: { let d = triDetail(lp, ln, 7, 0.08); s.albedo = vec3f(0.045, 0.045, 0.048) * (0.8 + 0.4 * d.z); s.rough = 0.85; s.ao = 0.45; }
    case 48u: { // tecido dos bancos
      let d = triDetail(lp, ln, 7, 0.06);
      let stripe = step(0.5, fract(lp.z * 18.0));
      s.albedo = mix(vec3f(0.055, 0.056, 0.06), vec3f(0.075, 0.075, 0.08), stripe) * (0.75 + 0.5 * d.z);
      s.rough = 0.9; s.ao = 0.55;
    }
    case 49u: { let d = triDetail(lp, ln, 6, 0.2); s.albedo = vec3f(0.028, 0.028, 0.03) * (0.85 + 0.3 * d.w); s.rough = 0.55; s.ao = 0.55; }
    case 50u: { s.albedo = vec3f(0.014); s.rough = 0.65; }
    case 51u: { // alumínio da escada
      let br = vnoise2(vec2f(lp.x * 3.0, lp.y * 900.0 + lp.z * 900.0));
      var c = vec3f(0.78, 0.79, 0.80) * (0.9 + 0.12 * br);
      var rough = 0.48 + 0.12 * br;
      if (i.attr.y == 2u) { // degrau estriado
        let rib = sin(atan2(lp.y - 1.559, (lp.x - floor(lp.x / 0.27) * 0.27)) * 18.0);
        rough += 0.1;
        c *= 0.95;
      }
      // marcas de uso / oxidação leve
      c *= 1.0 - 0.1 * smoothstep(0.6, 0.9, vnoise2(lp.xz * 18.0));
      s.albedo = c * vec3f(1.0, 0.99, 0.97); s.metal = 0.6; s.rough = rough;
    }
    case 52u: { // cinta de poliéster laranja
      let wv = sin(lp.y * 1200.0 + lp.z * 1200.0) * 0.5 + 0.5;
      s.albedo = vec3f(0.78, 0.30, 0.025) * (0.85 + 0.2 * wv); s.rough = 0.65;
      s.n = perturb(s.n, i.wpos, lp.yz * 300.0, normalize(vec3f((wv - 0.5) * 0.3, 0.0, 1.0)));
    }
    case 53u: { s.albedo = vec3f(0.025, 0.026, 0.028); s.rough = 0.38; }
    case 54u: { // placa cinza com caracteres pretos
      var u: f32; var v: f32;
      if (i.attr.y == 0u) { u = (0.20 - lp.z) / 0.40; v = (0.425 - lp.y) / 0.13; }
      else { u = (lp.z + 0.20) / 0.40; v = (0.685 - lp.y) / 0.13; }
      let inner = step(0.03, u) * step(u, 0.97) * step(0.08, v) * step(v, 0.92);
      let t = textMask(vec2f(mix(14.0, 446.0, u) / 1024.0, mix(248.0, 352.0, v) / 512.0)) * inner;
      let t2 = textMask(vec2f(mix(14.0, 446.0, u) / 1024.0, mix(248.0, 352.0, (v - 0.28) / 0.72) / 512.0)) * inner * step(0.28, v);
      let city = step(0.08, v) * step(v, 0.24) * step(0.25, u) * step(u, 0.75) * step(0.5, fract(u * 40.0)) * 0.7;
      var c = mix(vec3f(0.06), vec3f(0.40, 0.40, 0.39), inner);
      c = mix(c, vec3f(0.015), max(t2, city));
      s.albedo = c; s.rough = 0.45; s.metal = 0.2;
    }
    case 55u: { // emblemas traseiros
      var u: f32; var v: f32; var t: f32;
      if (i.attr.y == 0u) {
        u = (lp.z - 0.33) / 0.22; v = (0.931 - lp.y) / 0.052;
        t = textMask(vec2f(mix(10.0, 300.0, u) / 1024.0, mix(108.0, 172.0, v) / 512.0));
        s.albedo = mix(vec3f(0.33, 0.53, 0.70), vec3f(0.62, 0.08, 0.04), t); s.rough = mix(0.36, 0.3, t); s.clear = 1.0 - t; s.cls = select(2u, 0u, t > 0.5);
      } else {
        u = (lp.z + 0.515) / 0.15; v = (0.929 - lp.y) / 0.048;
        t = textMask(vec2f(mix(10.0, 250.0, u) / 1024.0, mix(178.0, 242.0, v) / 512.0));
        let plate = step(0.0, u) * step(u, 1.0);
        s.albedo = mix(vec3f(0.03, 0.10, 0.45), vec3f(0.85), t); s.metal = t; s.rough = 0.25;
      }
    }
    case 56u: { s.albedo = vec3f(0.62, 0.36, 0.08); s.rough = 0.05; s.metal = 0.35; s.n = perturb(s.n, i.wpos, lp.zy * 60.0, normalize(vec3f(sin(lp.y * 600.0) * 0.2, 0.0, 1.0))); }
    case 57u: { // grade / molduras
      var c = vec3f(0.018);
      if (i.attr.y == 1u) {
        let y = lp.y;
        let bar = (1.0 - smoothstep(0.004, 0.007, abs(y - 0.622))) + (1.0 - smoothstep(0.004, 0.007, abs(y - 0.658))) + (1.0 - smoothstep(0.006, 0.009, abs(y - 0.64) - 0.058));
        let mesh = step(0.5, fract(lp.z * 120.0)) * step(0.5, fract(y * 120.0));
        c = mix(vec3f(0.003) + mesh * 0.004, vec3f(0.028), clamp(bar, 0.0, 1.0));
        s.rough = mix(0.6, 0.25, clamp(bar, 0.0, 1.0)); s.metal = 0.2;
        s.n = perturb(s.n, i.wpos, lp.zy * 30.0, normalize(vec3f(0.0, (bar - 0.5) * 0.3, 1.0)));
        s.ao = 0.6 + 0.4 * clamp(bar, 0.0, 1.0);
      }
      s.albedo = c; if (i.attr.y != 1u) { s.rough = 0.5; }
    }
    case 58u: { s.albedo = vec3f(0.018, 0.018, 0.02); s.rough = 0.9; s.ao = 0.5; }
    case 59u: { s.albedo = vec3f(0.22, 0.17, 0.14); s.metal = 0.6; s.rough = 0.55; }
    case 66u: { s.albedo = vec3f(0.025); s.rough = 0.5; s.ao = 0.6; }
    default: { s.albedo = vec3f(0.05); s.rough = 0.6; }
  }
  if (s.cls == 0u && m != 40u && m != 63u) { s.cls = 4u; }
  return s;
}
