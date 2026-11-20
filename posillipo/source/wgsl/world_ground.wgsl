// Materiale del suolo per Napoli: Golfo di Napoli (mare animato + schiuma), spiaggia vulcanica Mappatella,
// scogliere bianche, basolato del Lungomare / Rotonda Diaz, parco Villa Comunale e pendici del Vesuvio.
#include palette
fn grHash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }

fn groundSurf(wpos: vec3f, Ng: vec3f, forest: f32) -> Surface {
  var s = surfDefault(Ng);
  let xz = wpos.xz;
#ifdef PASS_CUBE
  let dist = distance(wpos, P.camPos.xyz);
#else
  let dist = distance(wpos, F.camPos.xyz);
#endif
  let z = wmZone(xz);
  let nA = textureSample(tNoise, sLin, xz * 0.0137);
  let nB = textureSample(tNoise, sLin, vec2f(xz.x * 0.8 - xz.y * 0.6, xz.x * 0.6 + xz.y * 0.8) * 0.083);
  let nC = textureSample(tNoise, sLin, xz * 0.61 + nA.rg * 0.2);
  let nD = (textureSample(tNoise, sLin, vec2f(xz.x * 0.6 + xz.y * 0.8, -xz.x * 0.8 + xz.y * 0.6) * 4.7) + textureSample(tNoise, sLin, vec2f(xz.x * 0.966 - xz.y * 0.259, xz.x * 0.259 + xz.y * 0.966) * 3.31 + 0.37)) * 0.5;
  let near = 1.0 - smoothstep(20.0, 120.0, dist);
  let near2 = 1.0 - smoothstep(4.0, 32.0, dist);

  // ---- 1. GOLFO DI NAPOLI (MARE TIRRENO ANIMATO) ----
  if (wpos.y < 0.16) {
    let t = F.wind.w;
    let w1 = textureSample(tNoise, sLin, xz * 0.032 + vec2f(t * 0.035, -t * 0.022));
    let w2 = textureSample(tNoise, sLin, vec2f(xz.x * 0.7 - xz.y * 0.7, xz.x * 0.7 + xz.y * 0.7) * 0.095 + vec2f(-t * 0.048, t * 0.031));
    let w3 = textureSample(tNoise, sLin, xz * 0.27 + vec2f(t * 0.06, t * 0.04));
    let shallow = smoothstep(0.01, 0.16, wpos.y);
    let deepCol = vec3f(0.008, 0.036, 0.095);
    let midCol = vec3f(0.014, 0.065, 0.135);
    let coveCol = vec3f(0.028, 0.092, 0.135);
    var wcol = mix(deepCol, midCol, smoothstep(0.3, 0.75, w1.r) * 0.6 + (1.0 - smoothstep(150.0, 1400.0, dist)) * 0.45);
    wcol = mix(wcol, coveCol, shallow * 0.7);
    // Schiuma bianca lungo le scogliere e la battigia della Mappatella
    let foamN = smoothstep(0.36, 0.68, w2.b * 0.6 + w3.r * 0.4);
    let foam = smoothstep(0.025, 0.14, wpos.y) * foamN * 0.85;
    wcol = mix(wcol, vec3f(0.68, 0.73, 0.76), foam);
    let waveFade = 1.0 - smoothstep(400.0, 4500.0, dist) * 0.75;
    let wgrad = ((w1.rg - 0.5) * 0.32 + (w2.rg - 0.5) * 0.24 + (w3.rg - 0.5) * 0.14 * near) * waveFade;
    s.albedo = wcol;
    s.rough = mix(0.075 + 0.04 * w2.g, 0.55, foam);
    s.metal = 0.04;
    s.coat = (1.0 - foam) * 0.85;
    s.ao = 1.0;
    s.normal = bumpXZ(vec3f(0.0, 1.0, 0.0), wgrad);
    return s;
  }

  // ---- 2. PARCO VILLA COMUNALE & COLLINE DEL VOMERO ----
  var g = mix(COL_GRASS_ROOT * 1.6, COL_GRASS, 0.3 + 0.7 * nC.r);
  g *= 0.8 + 0.4 * nB.r;
  let dry = smoothstep(0.45, 0.72, nA.g * 0.6 + nB.g * 0.4);
  g = mix(g, COL_GRASS_TALL * vec3f(1.06, 0.94, 0.64), dry * 0.45);
  var alb = g;
  var rough = 0.9;
  var grad = (nC.rg - 0.5) * 1.0 * near + (nD.rg - 0.5) * 1.4 * near2;
  var ao = 0.78 + 0.22 * nC.r;
  var sss = 0.22;

  // Fogliame distante su Villa Comunale e Vomero (con tocchi caldi autunnali rosso-arancio dei platani di Napoli!)
  let fo = smoothstep(0.2, 0.6, forest);
  if (fo > 0.0) {
    let litter = mix(vec3f(0.06, 0.045, 0.028), COL_FOREST * 1.3, nC.g * 0.55 + nB.r * 0.25);
    alb = mix(alb, litter, fo * 0.82); ao *= mix(1.0, 0.75, fo);
#ifndef PASS_CUBE
    let cf = smoothstep(CANOPY_A, CANOPY_B, dist) * smoothstep(0.3, 0.6, forest + (nB.r - 0.5) * 0.2);
    if (cf > 0.0) {
      let cuv = xz / 170.0 + (nB.rg - 0.5) * 0.012;
      let c0 = textureSample(tNoise, sLin, cuv).b;
      var cc = COL_FOREST * (0.6 + 0.9 * c0) * (0.78 + 0.44 * nA.r);
      let autumn = smoothstep(0.56, 0.76, nB.g) * 0.55;
      cc = mix(cc, vec3f(0.18, 0.075, 0.024) * (0.7 + 0.5 * c0), autumn);
      alb = mix(alb, cc, cf); rough = mix(rough, 0.84, cf); sss = mix(sss, 0.4, cf);
    }
#endif
  }

  // ---- 3. SPIAGGIA VULCANICA MAPPATELLA & SCOGLIERE BIANCHE CALCAREE ----
  // Spiaggia vulcanica scura nell'insenatura di Rotonda Diaz (x ∈ [85..280], z > 10, bassa quota)
  let inBeachX = smoothstep(82.0, 112.0, xz.x) * (1.0 - smoothstep(220.0, 282.0, xz.x));
  let inBeachZ = smoothstep(8.0, 18.0, xz.y) * (1.0 - smoothstep(58.0, 78.0, xz.y));
  let beachM = inBeachX * inBeachZ * (1.0 - smoothstep(1.65, 2.25, wpos.y));
  if (beachM > 0.01) {
    let wetSand = 1.0 - smoothstep(0.16, 0.52, wpos.y);
    var sandC = vec3f(0.105, 0.092, 0.072) * (0.82 + 0.36 * nB.r) * (0.9 + 0.2 * nD.a * near2);
    sandC *= mix(1.0, 0.48, wetSand);
    alb = mix(alb, sandC, beachM);
    rough = mix(rough, mix(0.94, 0.28, wetSand), beachM);
    sss *= 1.0 - beachM;
    grad = mix(grad, (nC.rg - 0.5) * 0.45 * near, beachM);
  }

  // Scogliere bianche frangiflutti sul mare (rocce calcaree chiare, iconiche sul Lungomare!)
  let rockZone = smoothstep(11.0, 16.0, xz.y) * smoothstep(0.16, 0.45, wpos.y) * (1.0 - beachM * 0.92);
  let megaride = smoothstep(690.0, 725.0, xz.x) * (1.0 - smoothstep(815.0, 845.0, xz.x)) * smoothstep(55.0, 80.0, xz.y);
  let rockM = sat(max(rockZone * (1.0 - smoothstep(0.45, 0.65, z.a)), megaride));
  if (rockM > 0.01) {
    let b1 = textureSample(tNoise, sLin, xz * 0.42);
    let b2 = textureSample(tNoise, sLin, xz * 1.35 + 0.31);
    let boulder = smoothstep(0.28, 0.72, b1.b) * (0.75 + 0.45 * b2.r);
    var rcol = mix(vec3f(0.32, 0.31, 0.29), vec3f(0.68, 0.66, 0.61), boulder);
    // Base scura bagnata dagli spruzzi vicino all'acqua
    let splash = 1.0 - smoothstep(0.16, 0.68, wpos.y);
    rcol *= mix(1.0, 0.44, splash);
    // Isolotto di Megaride: tufo dorato napoletano
    rcol = mix(rcol, vec3f(0.36, 0.29, 0.19) * (0.75 + 0.45 * b1.r), megaride);
    alb = mix(alb, rcol, rockM);
    rough = mix(rough, mix(0.86, 0.42, splash), rockM);
    sss *= 1.0 - rockM;
    ao = mix(ao, 0.62 + 0.38 * boulder, rockM);
    grad = mix(grad, ((b1.rg - 0.5) * 3.2 + (b2.rg - 0.5) * 2.1 * near) * (1.0 - smoothstep(120.0, 500.0, dist)), rockM);
  }

  // ---- 4. MONTE VESUVIO, MONTE SOMMA & PENISOLA SORRENTINA ----
  let vesM = smoothstep(1200.0, 2100.0, xz.x) * smoothstep(15.0, 95.0, wpos.y);
  if (vesM > 0.01) {
    let ash = smoothstep(160.0, 420.0, wpos.y + (nA.r - 0.5) * 90.0);
    let scrub = vec3f(0.055, 0.075, 0.042) * (0.75 + 0.5 * nA.g);
    let lava = vec3f(0.095, 0.09, 0.092) * (0.78 + 0.44 * nB.r);
    let vc = mix(scrub, lava, ash);
    alb = mix(alb, vc, vesM);
    rough = mix(rough, 0.92, vesM);
    sss *= 1.0 - vesM;
  }

  // ---- 5. PAVIMENTAZIONE DEL LUNGOMARE CARACCIOLO, ROTONDA DIAZ & EVENT VILLAGE ----
  let cw = max(fwidth(z.a) * 1.2, 0.004);
  let cm = smoothstep(0.5 - cw, 0.5 + cw, z.a) * smoothstep(1.6, 2.1, wpos.y);
  if (cm > 0.01) {
    // Basolato / pavimentazione chiara del lungomare e asfalto delle corsie cittadine
    let sl = xz / 3.2; let jf = abs(fract(sl) - 0.5); let jd = (0.5 - max(jf.x, jf.y)) * 3.2;
    let joint = 1.0 - smoothstep(0.014, 0.014 + max(fwidth(jd), 0.004), jd);
    let tone = 0.88 + 0.24 * grHash(floor(sl));
    var pc = vec3f(0.24, 0.235, 0.225) * tone * (0.86 + 0.28 * nC.r) * (0.92 + 0.16 * nD.a * near2);
    pc = mix(pc, vec3f(0.06), joint * 0.55 * near);
    // Segni di pneumatici sulla piazza di Rotonda Diaz (come in image_89486885.png!)
    let rotD = length(xz - vec2f(67.5, 16.0));
    let skidRing = exp(-sq(rotD - 22.0) / 14.0) * smoothstep(6.0, 14.0, xz.y) * (0.5 + 0.5 * nB.g);
    pc = mix(pc, pc * 0.58, skidRing * 0.45);
    alb = mix(alb, pc, cm);
    rough = mix(rough, 0.78, cm);
    sss *= 1.0 - cm;
    grad = mix(grad, (nD.rg - 0.5) * 0.35 * near2, cm);
    ao = mix(ao, 1.0 - joint * 0.28, cm);
  }

  s.albedo = alb; s.rough = rough; s.ao = ao; s.sss = sss * 0.5;
  s.normal = bumpXZ(Ng, grad);
  return s;
}
