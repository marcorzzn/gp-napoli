// Materiali della Fiat 127 — Livrea SSC Napoli 3° Scudetto 1926 (Azzurro Napoli, cofano bianco + Scudetto 3, tetto a scacchiera, Pulcinella, FORZA NAPOLI, cerchi bianchi con coppetta azzurra)
// id (mat.x): 1 vernice carrozzeria | 2 plastica nera | 3 gomma | 4 pneumatico | 5 cerchio/coppetta | 6 acciaio | 7 cromo | 8 interni | 9 lenti
//             10 alluminio | 11 fascia | 12 decal (targhe/badge) | 13 sottoscocca | 14 parabola faro | 15 specchio | 16 griglia | 17 vernice lucida (paraurti bianchi / specchietti / casco)
#include mesh_vert
@group(3) @binding(0) var tAtlas: texture_2d<f32>;
const PAINT_COL = vec3f(0.026, 0.255, 0.695);   // Azzurro Napoli vibrante (lineare PBR)
const WHITE_COL = vec3f(0.85, 0.87, 0.89);      // Bianco lucido cofano, scacchiera, fascione
fn carBulgeW(x: f32) -> f32 { return 0.055 * smoothstep(-0.15, 0.25, x) - 0.036 * smoothstep(-1.15, -1.42, x); }
fn surf(in: V2F, ff: bool) -> Surface {
  var s = surfDefault(normalize(in.nrm));
  let id = matId(in.mat); let pa = matA(in.mat) * 255.0;
  let lp = in.ext.xyz;
  s.albedo = in.col.rgb;
  switch (id) {
    case 1u: {   // carrozzeria Fiat 127 livrea SSC Napoli 1926
      // Campionamento atlas in flusso uniforme (all'inizio di case 1u, esattamente come tNoise)
      let uvScud = vec2f(
        clamp(0.502 + 0.496 * ((lp.z + 0.45) / 0.90), 0.502, 0.998),
        clamp(0.004 + 0.492 * ((1.72 - lp.x) / 0.84), 0.004, 0.496)
      );
      // Fiancata: u da 0 (davanti x=+0.78) a 1 (dietro x=-1.56) -> leggibile da sinistra a destra su ENTRAMBI i lati!
      let sideU = clamp((0.78 - lp.x) / 2.34, 0.0, 1.0);
      let sideV = clamp((0.92 - lp.y) / 0.68, 0.0, 1.0);
      let uvSide = vec2f(0.002 + 0.496 * sideU, 0.504 + 0.492 * sideV);
      // Parafango anteriore (Pulcinella + corona gialla): u da 0 (x=1.76) a 1 (x=1.06)
      let fendU = clamp((1.76 - lp.x) / 0.70, 0.0, 1.0);
      let fendV = clamp((0.92 - lp.y) / 0.42, 0.0, 1.0);
      let uvFend = vec2f(0.502 + 0.246 * fendU, 0.504 + 0.492 * fendV);
      // Muso "1926": guardando da davanti, +z è a sinistra e -z a destra -> u cresce con -lp.z
      let noseU = clamp((0.39 - lp.z) / 0.78, 0.0, 1.0);
      let noseV = clamp((0.81 - lp.y) / 0.24, 0.0, 1.0);
      let uvNose = vec2f(0.752 + 0.246 * noseU, 0.504 + 0.492 * noseV);

      let tScud = textureSample(tAtlas, sLin, uvScud);
      let tSide = textureSample(tAtlas, sLin, uvSide);
      let tFend = textureSample(tAtlas, sLin, uvFend);
      let tNose = textureSample(tAtlas, sLin, uvNose);

      let nO = normalize((vec4f(s.normal, 0.0) * O.model).xyz);
      let wt = abs(nO) / (abs(nO.x) + abs(nO.y) + abs(nO.z));
      let fl = textureSample(tNoise, sLin, lp.zy * 23.0).a * wt.x + textureSample(tNoise, sLin, lp.xz * 23.0).a * wt.y + textureSample(tNoise, sLin, lp.xy * 23.0).a * wt.z - 0.5;
      s.albedo = PAINT_COL * (1.0 + 0.04 * fl); s.metal = 0.24; s.rough = 0.22 + 0.025 * fl; s.coat = 1.0;

      // Zone inferiori sotto i paraurti (non schiarire)
      { let under = (1.0 - smoothstep(0.28, 0.315, lp.y)) * smoothstep(1.42, 1.52, abs(lp.x)); s.albedo = mix(s.albedo, vec3f(0.01), under); s.coat *= 1.0 - under; s.metal *= 1.0 - under; s.rough = mix(s.rough, 0.95, under); }
      if (pa > 0.5) {
        let low = 1.0 - smoothstep(0.20, 0.25, lp.y);
        s.albedo = mix(s.albedo, vec3f(0.012), low); s.coat *= 1.0 - low; s.metal *= 1.0 - low; s.rough = mix(s.rough, 0.9, low);
      }
      if (pa < 0.5) {
        let side = step(in.uv.y, 0.44);
        let topFace = step(0.65, in.uv.y);
        let zz = lp.z / 0.72; let xe = lp.x - carBulgeW(lp.x) * (1.0 - zz * zz);

        // 1) COFANO BIANCO che avvolge la parte superiore dei parafanghi anteriori (come foto)
        let hoodTop = topFace * smoothstep(0.735, 0.755, xe) * smoothstep(0.77, 0.79, lp.y);
        // Fascia bianca diagonale sulla parte alta del parafango anteriore (scende dietro al faro verso il montante A)
        let fendSplitY = mix(0.69, 0.66, sat((lp.x - 0.82) / 0.92));
        let hoodSide = side * smoothstep(0.76, 0.80, lp.x) * smoothstep(fendSplitY - 0.012, fendSplitY + 0.012, lp.y) * (1.0 - smoothstep(1.78, 1.82, lp.x));
        let whiteHood = max(hoodTop, hoodSide);
        s.albedo = mix(s.albedo, WHITE_COL, whiteHood);
        s.metal = mix(s.metal, 0.04, whiteHood);

        // 2) TETTO A SCACCHIERA AZZURRO E BIANCO (scacchiera classica Napoli sul tetto!)
        let roofMask = topFace * smoothstep(-1.38, -1.33, lp.x) * (1.0 - smoothstep(0.14, 0.19, lp.x)) * smoothstep(1.31, 1.35, lp.y);
        if (roofMask > 0.001) {
          let gx = floor((lp.x + 1.40) / 0.195);
          let gz = floor((lp.z + 0.78) / 0.195);
          let chk = fract((gx + gz) * 0.5) * 2.0;
          let roofCol = mix(PAINT_COL, WHITE_COL, step(0.5, chk));
          s.albedo = mix(s.albedo, roofCol, roofMask);
          s.metal = mix(s.metal, mix(0.24, 0.04, step(0.5, chk)), roofMask);
        }

        // 3) SCUDETTO TRICOLORE "3" SUL COFANO BIANCO
        let scudBox = topFace * step(0.88, lp.x) * step(lp.x, 1.72) * step(abs(lp.z), 0.45) * step(0.78, lp.y);
        let scudA = tScud.a * scudBox;
        s.albedo = mix(s.albedo, tScud.rgb, scudA);
        s.metal = mix(s.metal, 0.08, scudA);

        // 4) MUSO ANTERIORE "1926" BIANCO TRA I FARI
        let noseBox = topFace * step(1.74, lp.x) * step(abs(lp.z), 0.39) * step(0.57, lp.y) * step(lp.y, 0.81);
        let noseA = tNose.a * noseBox;
        s.albedo = mix(s.albedo, tNose.rgb, noseA);
        s.metal = mix(s.metal, 0.04, noseA);

        // 5) PARAFANGO ANTERIORE: MASCHERA DI PULCINELLA + PENNELLATA GIALLA
        let fendBox = side * step(1.06, lp.x) * step(lp.x, 1.76) * step(0.50, lp.y) * step(lp.y, 0.92);
        let fendA = tFend.a * fendBox;
        s.albedo = mix(s.albedo, tFend.rgb, fendA);
        s.metal = mix(s.metal, 0.04, fendA);

        // 6) FIANCATA: "FORZA NAPOLI" + "UN GIORNO ALL'IMPROVVISO..." + "9" + PRESE D'ARIA
        let sideBox = side * step(-1.56, lp.x) * step(lp.x, 0.78) * step(0.24, lp.y) * step(lp.y, 0.92);
        let sideA = tSide.a * sideBox;
        s.albedo = mix(s.albedo, tSide.rgb, sideA);
        s.metal = mix(s.metal, 0.04, sideA);

        // 7) FASCIONE LATERALE BIANCO (tra i due passaruota, sotto FORZA NAPOLI e sopra UN GIORNO ALL'IMPROVVISO)
        let wy = max(fwidth(lp.y), 1e-5);
        let sx = smoothstep(-0.84, -0.81, lp.x) * (1.0 - smoothstep(0.74, 0.77, lp.x));
        let sdy = lp.y - 0.505;
        let strip = sat((0.044 - abs(sdy)) / wy + 0.5) * min(1.0, 0.088 / wy) * side * sx;
        {
          let upS = normalize((O.model * vec4f(0.0, 1.0, 0.0, 0.0)).xyz);
          let eb = smoothstep(0.032, 0.043, abs(sdy)) * strip;
          s.normal = normalize(s.normal + upS * sign(sdy) * eb * 0.65);
        }
        s.albedo = mix(s.albedo, WHITE_COL * 0.98, strip);
        s.metal = mix(s.metal, 0.04, strip);
        s.rough = mix(s.rough, 0.28, strip);

        // Fessure pannelli (porta, cofano, portellone) e tappo serbatoio
        var d = abs(in.uv.x);
        if (lp.z < -0.5) { d = min(d, abs(length(vec2f(lp.x + 1.04, lp.y - 0.715)) - 0.058)); }
        let w = max(fwidth(d), 1e-5); let hw = 0.002;
        let line = sat((hw - d) / w + 0.5) * min(1.0, 2.0 * hw / w);
        let halo = (1.0 - smoothstep(hw, hw + 0.007, d)) * sat(0.0035 / w);
        s.albedo *= 1.0 - 0.22 * halo; s.ao = min(s.ao, 1.0 - 0.4 * halo);

        // Bordo sottoporta scuro
        let sill = (1.0 - smoothstep(0.215, 0.228, lp.y)) * side;
        s.albedo = mix(s.albedo, vec3f(0.016), sill * 0.9); s.coat *= 1.0 - sill; s.metal *= 1.0 - sill; s.rough = mix(s.rough, 0.85, sill);

        // Portellone posteriore (incavo targa e nervatura)
        if (lp.x < -1.5 && in.uv.y > 0.66) {
          let t = (lp.y - 0.836) / 0.007; let upW = normalize((O.model * vec4f(0.0, 1.0, 0.0, 0.0)).xyz);
          s.normal = normalize(s.normal + upW * (t * exp(-t * t) * 0.55) * (1.0 - smoothstep(0.44, 0.48, abs(lp.z))));
          let q = abs(vec2f(lp.z, lp.y - 0.71)) - vec2f(0.195, 0.06); let pr = length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - 0.012;
          let stepb = 1.0 - smoothstep(0.0, 0.007, abs(pr));
          s.albedo *= 1.0 - 0.3 * stepb - 0.07 * (1.0 - smoothstep(-0.004, 0.0, pr)); s.ao = min(s.ao, 1.0 - 0.5 * stepb);
        }

        // Griglietta alla base del parabrezza
        var black = line;
        if (in.uv.y > 0.66) {
          let cowl = smoothstep(0.60, 0.612, xe) * (1.0 - smoothstep(0.735, 0.742, xe));
          black = max(black, cowl);
        }
        s.albedo = mix(s.albedo, vec3f(0.016), black); s.coat *= 1.0 - black; s.rough = mix(s.rough, 0.92, black); s.metal *= 1.0 - black; s.ao = min(s.ao, 1.0 - line * 0.6);
      }
    }
    case 2u: {   // plastica nera
      let g = textureSample(tNoise, sLin, lp.xz * 57.0 + lp.yy * 43.0).b;
      let g2 = textureSample(tNoise, sLin, lp.zy * 131.0 + lp.xx * 97.0).a;
      s.albedo = in.col.rgb * vec3f(0.96, 1.0, 1.05) * (0.2 + 0.13 * g + 0.09 * g2); s.rough = select(0.94 + 0.05 * g2, 0.4, pa > 0.5); s.ao = 0.38 + 0.2 * g2; s.metal = select(0.0, 0.55, pa > 0.5);
    }
    case 3u: { s.albedo = in.col.rgb * vec3f(0.96, 1.0, 1.05); s.rough = 0.84; s.ao = 0.6; s.metal = 0.3; }
    case 4u: {   // pneumatico stradale/sportivo
      let r = length(lp.xy); let ang = atan2(lp.y, lp.x);
      let blur = sat(O.p0.x / 25.0);
      if (pa < 0.5) {
        let lane = floor((lp.z + 0.055) / 0.022);
        let k = fract(ang / 6.2831853 * 118.0 + lane * 0.5);
        let sipe = (1.0 - smoothstep(0.05, 0.1, abs(k - 0.5))) * (1.0 - blur) * (1.0 - smoothstep(0.03, 0.038, abs(lp.z)));
        s.albedo = in.col.rgb * vec3f(0.96, 1.0, 1.05) * 0.5 * (1.0 - 0.5 * sipe); s.ao = 0.45 - 0.2 * sipe; s.rough = 0.95; s.metal = 0.0;
      } else {
        let ring = (1.0 - smoothstep(0.0006, 0.0014, abs(r - 0.243))) + (1.0 - smoothstep(0.0006, 0.0014, abs(r - 0.196)));
        let tb = smoothstep(0.2075, 0.209, r) * (1.0 - smoothstep(0.2185, 0.22, r));
        let win = step(0.55, textureSampleLevel(tNoise, sLin, vec2f(ang * 0.33, 0.61), 0.0).r);
        let st = smoothstep(0.3, 0.45, abs(fract(ang * 58.0) - 0.5)) * step(0.35, textureSampleLevel(tNoise, sLin, vec2f(ang * 9.3, 0.37), 0.0).a);
        let letters = tb * win * st * (1.0 - blur);
        let ribs = (0.5 + 0.5 * sin(ang * 150.0)) * smoothstep(0.222, 0.226, r) * (1.0 - smoothstep(0.238, 0.242, r)) * (1.0 - blur) * sat(1.0 - fwidth(ang) * 150.0 * 0.4);
        let band2 = smoothstep(0.247, 0.249, r) * (1.0 - smoothstep(0.256, 0.258, r));
        s.albedo = in.col.rgb * vec3f(0.96, 1.0, 1.05) * 0.5 * (1.0 + 1.8 * letters + 0.8 * ring * (1.0 - blur) + 0.35 * ribs + 0.3 * band2); s.rough = 0.9 - 0.2 * letters; s.ao = 0.5 - 0.15 * ribs + 0.25 * letters; s.metal = 0.0;
      }
    }
    case 5u: {   // cerchio in acciaio BIANCO con coppetta centrale AZZURRO NAPOLI e 4 bulloni
      let r = length(lp.xy);
      let hubMask = 1.0 - smoothstep(0.056, 0.060, r);
      let rimCol = mix(WHITE_COL, PAINT_COL, hubMask);
      s.albedo = rimCol; s.metal = mix(0.14, 0.26, hubMask); s.rough = 0.28; s.coat = 0.72;
      if (pa > 0.5) {
        let cov = smoothstep(9.0, 34.0, O.p0.x);
        if (ign(in.pos.xy, F.misc.y) >= cov) { discard; }
        let ringd = 1.0 - smoothstep(0.014, 0.026, abs(r - 0.114));
        let rim = 1.0 - smoothstep(0.001, 0.003, abs(r - 0.156));
        let streak = 0.5 + 0.5 * sin(atan2(lp.y, lp.x) * 8.0);
        s.albedo = rimCol * (1.0 - 0.42 * ringd * (0.85 + 0.15 * streak) - 0.28 * rim);
        s.rough = 0.35; s.coat = 0.45; s.ao = 1.0 - 0.32 * ringd;
        return s;
      }
      // Scanalatura coppetta e 4 bulloni azzurri/scuri al centro
      let ringEdge = 1.0 - smoothstep(0.0012, 0.0028, abs(r - 0.058));
      let rimLine = 1.0 - smoothstep(0.0012, 0.003, abs(r - 0.148));
      let a4 = atan2(lp.y, lp.x) / 6.2831853 * 4.0;
      let da = (a4 - round(a4)) / 4.0 * 6.2831853 * r;
      let bolt = 1.0 - smoothstep(0.0055, 0.0085, length(vec2f(da, r - 0.036)));
      let centerCap = 1.0 - smoothstep(0.014, 0.017, r);
      s.albedo *= 1.0 - 0.35 * ringEdge - 0.25 * rimLine - 0.45 * bolt - 0.18 * centerCap;
      s.ao = 1.0 - 0.35 * bolt - 0.25 * ringEdge;
    }
    case 6u: { s.metal = 0.5; s.rough = select(0.45, 0.6, pa > 0.5); }
    case 7u: { s.metal = 1.0; s.rough = select(0.07, 0.26, pa > 0.5); if (pa > 1.5) { s.metal = 0.72; s.rough = 0.3; } }
    case 8u: {   // interni (sedili bianchi a coste)
      s.rough = 0.88;
      { let under = (1.0 - smoothstep(0.56, 0.62, lp.y)) * smoothstep(1.2, 1.3, abs(lp.x)); s.albedo = mix(s.albedo, vec3f(0.006), under); }
      if ((pa > 1.5 && pa < 2.5) || pa > 3.5) { let w = sin(lp.z * 900.0) * sin(lp.x * 900.0 + lp.y * 900.0); s.albedo = in.col.rgb * (1.0 + 0.06 * w); }
      if (pa > 3.5) {
        let k = (fract(lp.z / 0.048) - 0.5) * 0.048; let seam = 1.0 - smoothstep(0.002, 0.006, abs(k));
        s.albedo *= (1.0 - 0.22 * seam) * (0.92 + 0.08 * cos(k / 0.048 * 6.2831853)); s.ao = 1.0 - 0.22 * seam;
      }
      if (pa > 2.5 && pa < 3.5) { s.rough = 0.55; }
    }
    case 9u: {   // lenti (frecce arancioni e fanali posteriori)
      s.rough = 0.34; s.coat = 0.5;
      let rib = 0.86 + 0.14 * sin(lp.y * 6.2831853 / 0.0042);
      if (pa < 1.5) {
        let v = in.uv.y; let u = in.uv.x; let br = sat(O.p0.x);
        var c = mix(vec3f(0.17, 0.003, 0.002), vec3f(0.2, 0.004, 0.002), br); var e = mix(0.03, 0.66, br);
        if (v > 0.66) { c = vec3f(0.22, 0.06, 0.002); e = 0.008; }
        else if (v < 0.2 && u < 0.36) { c = mix(vec3f(0.1, 0.1, 0.098), vec3f(1.0, 1.0, 0.95), sat(O.p0.y)); e = 0.004 + sat(O.p0.y) * 0.5; }
        let fy = max(fwidth(v), 1e-4); let fu = max(fwidth(u), 1e-4);
        let dh = min(abs(v - 0.66), select(9.0, abs(v - 0.2), u < 0.36)); let dvv = select(9.0, abs(u - 0.36), v < 0.2);
        let vh = (0.5 - abs(v - 0.5)); let edge = max(sat(1.0 - vh / max(0.028, fy)), sat(1.0 - u / max(0.03, fu)));
        let k = sat(max(max(sat(1.0 - dh / max(0.02, fy)), sat(1.0 - dvv / max(0.014, fu))), edge));
        let cell = vec2f(lp.z, lp.y) / 0.0045; var pc = fract(cell) - 0.5; pc.x = 0.0;
        let fade = sat(1.0 - fwidth(cell.y) * 1.4);
        let rightW = normalize((O.model * vec4f(0.0, 0.0, 1.0, 0.0)).xyz); let upW = normalize((O.model * vec4f(0.0, 1.0, 0.0, 0.0)).xyz);
        s.normal = normalize(s.normal + (rightW * pc.x + upW * pc.y) * 0.45 * fade * (1.0 - k));
        let prism = mix(1.0, 0.62 + 0.76 * (1.0 - 2.0 * max(abs(pc.x), abs(pc.y))), fade);
        let depth = 0.8 + 0.2 * sin(u * 7.0 + v * 2.5);
        s.albedo = mix(c * prism * depth, vec3f(0.006), k); s.emissive = e * (1.0 - k) * mix(1.0, 0.8 + 0.4 * (1.0 - 2.0 * max(abs(pc.x), abs(pc.y))), fade);
        s.rough = mix(0.62, 0.8, k);
      } else {
        let fl2 = 0.5 + 0.5 * sin(in.uv.x * 6.2831853 / 0.0075); let fadeP = sat(1.0 - fwidth(in.uv.x) / 0.0075 * 2.0);
        s.albedo = in.col.rgb * mix(1.0, 0.78 + 0.35 * fl2, fadeP) * (0.9 + 0.1 * rib); s.rough = 0.28; s.coat = 0.75; s.emissive = 0.06;
      }
    }
    case 10u: { s.metal = 0.55; s.rough = 0.5; }
    case 11u: { s.rough = 0.8; }
    case 12u: {   // targhe e badge dall'atlas
      let t = textureSample(tAtlas, sLin, in.uv);
      if (pa > 0.5 && t.a < 0.5) { discard; }
      s.albedo = t.rgb * select(0.82, 1.0, pa > 0.5); s.rough = select(0.45, 0.28, pa > 0.5); s.metal = select(0.0, 0.35, pa > 0.5); s.coat = select(0.15, 0.6, pa > 0.5);
    }
    case 13u: { s.rough = 1.0; s.ao = 0.3; s.metal = 0.9; }
    case 14u: {   // parabola faro
      let u = in.uv.x; let v = in.uv.y;
      let rightW = normalize((O.model * vec4f(0.0, 0.0, 1.0, 0.0)).xyz);
      let fz = sin(lp.z * 6.2831853 / 0.013); let ffade = sat(1.0 - fwidth(lp.z) / 0.013 * 2.5);
      s.normal = normalize(s.normal + rightW * fz * 0.12 * ffade);
      let rr = length(vec2f(u * 0.85, v));
      let grad = mix(1.0, 0.36, smoothstep(0.1, 1.05, rr)) * mix(0.72, 1.0, smoothstep(-1.0, 0.3, v));
      let facet = mix(1.0, 0.86 + 0.14 * fz, ffade);
      s.albedo = vec3f(0.74, 0.75, 0.77) * grad * facet; s.metal = 0.25; s.rough = 0.32; s.ao = 1.0;
      s.emissive = 0.11 * grad;
      if (pa > 0.5) {
        s.normal = normalize(in.nrm);
        if (pa > 1.5) { s.metal = 0.3; s.albedo = vec3f(0.5, 0.5, 0.51); s.rough = 0.35; s.emissive = 0.06; }
        else { s.metal = 0.2; s.albedo = vec3f(0.8, 0.79, 0.74); s.rough = 0.25; s.emissive = 0.09 + O.p0.z * 0.14; }
      }
    }
    case 15u: {   // specchietto retrovisore
      let g = sat((lp.y - 0.965) / 0.082);
      let ground = vec3f(0.03, 0.03, 0.035); let sea = vec3f(0.02, 0.08, 0.18); let sky = mix(vec3f(0.24, 0.32, 0.44), vec3f(0.12, 0.20, 0.34), sat((g - 0.52) / 0.48));
      var c = mix(ground, sea, smoothstep(0.36, 0.42, g)); c = mix(c, sky, smoothstep(0.5, 0.56, g));
      s.albedo = c; s.metal = 0.0; s.rough = 0.45; s.coat = 0.3; s.emissive = 0.045;
    }
    case 16u: {
      let k = fract(lp.y / select(0.0105, 0.0175, pa > 0.5));
      s.albedo = in.col.rgb * mix(0.1, 1.0, smoothstep(0.25, 0.5, k)); s.rough = 0.92; s.metal = 0.3; s.ao = mix(0.2, 0.7, smoothstep(0.25, 0.5, k));
    }
    case 17u: { s.metal = 0.04; s.rough = select(0.24, 0.28, pa > 0.5); s.coat = select(0.75, 0.35, pa > 0.5); }   // paraurti bianchi, specchietti bianchi, casco
    default: {}
  }
  return s;
}
