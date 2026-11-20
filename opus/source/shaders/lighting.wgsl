// ---------------------------------------------------------------------------
// lighting.wgsl — resolução do G-buffer (compute) -> HDR
// ---------------------------------------------------------------------------
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<uniform> G: Globals;
@group(0) @binding(2) var gAlb: texture_2d<f32>;
@group(0) @binding(3) var gNrm: texture_2d<f32>;
@group(0) @binding(4) var gMisc: texture_2d<f32>;
@group(0) @binding(5) var gVel: texture_2d<f32>;
@group(0) @binding(6) var gDepth: texture_depth_2d;
@group(0) @binding(7) var aoTex: texture_2d<f32>;
@group(0) @binding(8) var shadowTex: texture_depth_2d_array;
@group(0) @binding(9) var shadowCmp: sampler_comparison;
@group(0) @binding(10) var skyHiTex: texture_2d<f32>;
@group(0) @binding(11) var skyLoTex: texture_2d<f32>;
@group(0) @binding(12) var cubeTex: texture_cube<f32>;
@group(0) @binding(13) var volTex: texture_2d<f32>;
@group(0) @binding(14) var prevTex: texture_2d<f32>;
@group(0) @binding(15) var linClamp: sampler;
@group(0) @binding(16) var outTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(17) var linRep: sampler;

fn worldFromDepth(px: vec2f, d: f32) -> vec3f {
  let uv = (px + 0.5) * V.res.zw;
  let ndc = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, d, 1.0);
  let w = V.invViewProj * ndc;
  return w.xyz / w.w;
}
fn sampleSkyHi(rd: vec3f) -> vec3f {
  let elev = asin(clamp(rd.y, -1.0, 1.0));
  let rot = G.misc.x;
  let u = fract(atan2(rd.z, rd.x) / TAU + 0.5 + rot);
  if (elev < -0.012) { return textureSampleLevel(skyLoTex, linClamp, dirToPano(rd), 0.0).rgb; }
  let v = sqrt(clamp((elev + 0.012) / (PI * 0.5), 0.0, 1.0));
  // filtro bicúbico (B-spline) leve para nitidez sem blocos
  let dim = vec2f(textureDimensions(skyHiTex));
  let st = vec2f(u, v) * dim - 0.5;
  let i = floor(st); let f = fract(st);
  let w0 = f * f * f / 6.0; let w1 = (1.0 + 3.0 * f + 3.0 * f * f - 3.0 * f * f * f) / 6.0;
  let w2 = (4.0 - 6.0 * f * f + 3.0 * f * f * f) / 6.0; let w3 = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0;
  let g0 = w3 + w2; let g1 = w1 + w0;
  let h0 = (w2 / g0) - 1.0 + i + 0.5; let h1 = (w0 / g1) + 1.0 + i + 0.5;
  let a = textureSampleLevel(skyHiTex, linRep, vec2f(h0.x, h0.y) / dim, 0.0).rgb;
  let b = textureSampleLevel(skyHiTex, linRep, vec2f(h1.x, h0.y) / dim, 0.0).rgb;
  let c = textureSampleLevel(skyHiTex, linRep, vec2f(h0.x, h1.y) / dim, 0.0).rgb;
  let d = textureSampleLevel(skyHiTex, linRep, vec2f(h1.x, h1.y) / dim, 0.0).rgb;
  return mix(mix(a, b, g1.x), mix(c, d, g1.x), g1.y);
}
fn skyLo(d: vec3f, lod: f32) -> vec3f { return textureSampleLevel(skyLoTex, linClamp, dirToPano(d), lod).rgb; }

// disco de Poisson (16)
const PD = array<vec2f, 16>(
  vec2f(-0.9420, -0.3991), vec2f(0.9456, -0.7689), vec2f(-0.0942, -0.9294), vec2f(0.3450, 0.2939),
  vec2f(-0.9159, 0.4577), vec2f(-0.8154, -0.8791), vec2f(-0.3828, 0.2768), vec2f(0.9748, 0.7565),
  vec2f(0.4432, -0.9751), vec2f(0.5374, -0.4737), vec2f(-0.2650, -0.4189), vec2f(0.7920, 0.1909),
  vec2f(-0.2419, 0.9971), vec2f(-0.8141, 0.9144), vec2f(0.1998, 0.7864), vec2f(0.1438, -0.1410));

fn cascadeFor(viewZ: f32, noise: f32) -> i32 {
  var c = 3;
  for (var k = 2; k >= 0; k--) {
    let sp = G.cascadeSplits[k];
    // faixa de transição com dither
    if (viewZ < sp * mix(0.88, 1.0, noise)) { c = k; }
  }
  return c;
}
fn shadowPCSS(wp: vec3f, n: vec3f, viewZ: f32, noise: f32, rot: f32) -> f32 {
  let c = cascadeFor(viewZ, noise);
  if (viewZ > G.cascadeSplits.w) { return 1.0; }
  let texel = G.shadowTexel[c];
  let L = G.sunDir.xyz;
  let NoL = dot(n, L);
  let off = n * texel * (1.5 + 2.0 * (1.0 - abs(NoL)));
  let sp = G.shadowVP[c] * vec4f(wp + off, 1.0);
  let uv = sp.xy * vec2f(0.5, -0.5) + 0.5;
  if (any(uv < vec2f(0.002)) || any(uv > vec2f(0.998))) { return 1.0; }
  let dimS = f32(textureDimensions(shadowTex).x);
  let zr = sp.z;
  let cs = cos(rot); let sn = sin(rot);
  // profundidade ortográfica: 1 no near, 0 no far; alcance em metros
  let depthRange = 600.0;
  // busca de bloqueadores
  var bsum = 0.0; var bn = 0.0;
  let searchR = select(10.0, 5.0, c >= 2) / dimS;
  for (var k = 0; k < 8; k++) {
    let o = PD[k * 2];
    let q = vec2f(o.x * cs - o.y * sn, o.x * sn + o.y * cs) * searchR;
    let dz = textureLoad(shadowTex, vec2i((uv + q) * dimS), c, 0);
    if (dz > zr + 0.00002) { bsum += dz; bn += 1.0; }
  }
  if (bn < 0.5) { return 1.0; }
  let blockerDist = max((bsum / bn - zr) * depthRange, 0.0);
  // penumbra: diâmetro angular do sol (~0.53°) + mínimo por texel
  let pen = blockerDist * 0.0093 * 1.6;
  let radTex = clamp(pen / texel, select(1.0, 2.5, c >= 2), select(14.0, 6.0, c >= 2));
  var sum = 0.0;
  let nT = select(16, 8, c >= 2);
  for (var k = 0; k < nT; k++) {
    let o = PD[k * (16 / nT)];
    let q = vec2f(o.x * cs - o.y * sn, o.x * sn + o.y * cs) * radTex / dimS;
    sum += textureSampleCompareLevel(shadowTex, shadowCmp, uv + q, c, zr + 0.00001);
  }
  return sum / f32(nT);
}

fn fogFactor(rd: vec3f, dist: f32, camY: f32) -> f32 {
  let dens = G.fog.x; let hf = G.fog.y;
  let h0 = camY - G.fog.z;
  let k = max(rd.y * hf, 1e-5) * select(1.0, -1.0, rd.y < 0.0);
  let a = min(dist, G.fog.w);
  // integra de a (fim do volumétrico) até dist
  var od: f32;
  if (abs(rd.y * hf) < 1e-5) { od = dens * exp(-h0 * hf) * (dist - a); }
  else { let kk = rd.y * hf; od = dens * exp(-h0 * hf) * (exp(-a * kk) - exp(-dist * kk)) / kk; }
  return 1.0 - exp(-max(od, 0.0));
}
fn fogColor(rd: vec3f) -> vec3f {
  let fc = skyLo(normalize(vec3f(rd.x, max(rd.y, 0.035), rd.z)), 3.5);
  let sunAmt = pow(max(dot(rd, G.sunDir.xyz), 0.0), 6.0);
  return fc * 1.05 + G.sunColor.rgb * sunAmt * 0.035;
}

// SSR para asfalto molhado
fn ssr(wp: vec3f, R: vec3f, noise: f32) -> vec4f {
  var t = 0.15 + noise * 0.25;
  var hit = vec4f(0.0);
  var lastT = 0.0;
  for (var i = 0; i < 26; i++) {
    let p = wp + R * t;
    let cp = V.viewProj * vec4f(p, 1.0);
    if (cp.w <= 0.01) { break; }
    let ndc = cp.xyz / cp.w;
    let uv = vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
    if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { break; }
    let sd = textureLoad(gDepth, vec2i(uv * V.res.xy), 0);
    // profundidades lineares (reverse-Z): z = near/d
    let near = V.camPos.w;
    let rayZ = near / max(ndc.z, 1e-7);
    let sceneZ = near / max(sd, 1e-7);
    let thick = 0.35 + t * 0.06;
    if (rayZ > sceneZ && rayZ < sceneZ + thick) {
      // refino binário
      var a = lastT; var b = t;
      for (var k = 0; k < 5; k++) {
        let m = (a + b) * 0.5;
        let pm = wp + R * m;
        let cm = V.viewProj * vec4f(pm, 1.0);
        let nm = cm.xyz / cm.w;
        let um = vec2f(nm.x * 0.5 + 0.5, 0.5 - nm.y * 0.5);
        let sdm = textureLoad(gDepth, vec2i(um * V.res.xy), 0);
        if (near / max(nm.z, 1e-7) > near / max(sdm, 1e-7)) { b = m; } else { a = m; }
      }
      let pf = wp + R * b;
      let cf = V.viewProj * vec4f(pf, 1.0);
      let nf = cf.xyz / cf.w;
      let uf = vec2f(nf.x * 0.5 + 0.5, 0.5 - nf.y * 0.5);
      let vel = textureLoad(gVel, vec2i(uf * V.res.xy), 0).xy;
      let puv = uf - vel;
      let col = textureSampleLevel(prevTex, linClamp, puv, 0.0).rgb;
      let edge = smoothstep(0.0, 0.08, min(min(uf.x, 1.0 - uf.x), min(uf.y, 1.0 - uf.y)));
      let fade = edge * (1.0 - smoothstep(40.0, 70.0, b));
      hit = vec4f(col, fade);
      break;
    }
    lastT = t;
    t = t * 1.22 + 0.15;
  }
  return hit;
}

@compute @workgroup_size(8, 8)
fn csLight(@builtin(global_invocation_id) gid: vec3u) {
  let px = vec2i(gid.xy);
  if (f32(px.x) >= V.res.x || f32(px.y) >= V.res.y) { return; }
  let d = textureLoad(gDepth, px, 0);
  let wp = worldFromDepth(vec2f(px), max(d, 1e-7));
  let cam = V.camPos.xyz;
  let toP = wp - cam;
  let dist = length(toP);
  let rd = toP / dist;
  let uv = (vec2f(px) + 0.5) * V.res.zw;
  let vol = textureSampleLevel(volTex, linClamp, uv, 0.0);
  let frame = G.time.z;
  let noise = ign(vec2f(px), frame);

  if (d <= 0.0) {
    var c = sampleSkyHi(rd);
    // disco solar com escurecimento de borda
    let cs = dot(rd, G.sunDir.xyz);
    let ang = acos(clamp(cs, -1.0, 1.0));
    let rS = G.sunColor.w;
    if (ang < rS) {
      let mu = sqrt(max(1.0 - (ang / rS) * (ang / rS), 0.0));
      c += G.sunColor.rgb * 900.0 * (0.4 + 0.6 * mu);
    }
    c += G.sunColor.rgb * 0.25 * pow(max(cs, 0.0), 900.0);
    c = c * vol.a + vol.rgb;
    textureStore(outTex, px, vec4f(c, 1.0));
    return;
  }

  let a0 = textureLoad(gAlb, px, 0);
  let n0 = textureLoad(gNrm, px, 0);
  let m0 = textureLoad(gMisc, px, 0);
  let albedo = a0.rgb;
  let cls = u32(a0.a * 255.0 + 0.5);
  let n = octDecode(n0.xy);
  let rough = max(n0.z, 0.03);
  let metal = n0.w;
  var ssao = textureSampleLevel(aoTex, linClamp, uv, 0.0).r;
  if (G.misc.z == 1.0) { ssao = 1.0; }
  var ao = m0.x * select(ssao, mix(1.0, ssao, 0.6), cls == 2u || cls == 4u);
  var contact = 0.0;
  // oclusão de contato sob o carro (caixa suave no chão)
  if (G.carNow.w > 0.5) {
    let dxz = wp.xz - G.carNow.xz;
    let fwd = vec2f(G.hud2.y, G.hud2.z);
    let la = dot(dxz, fwd); let lb = dot(dxz, vec2f(-fwd.y, fwd.x));
    let hy = G.carNow.y - 0.75;
    if (wp.y < hy + 0.25 && abs(la) < 2.6 && abs(lb) < 1.5) {
      let bx = (1.0 - smoothstep(1.45, 2.35, abs(la))) * (1.0 - smoothstep(0.5, 1.08, abs(lb)));
      ao *= 1.0 - 0.9 * bx * (1.0 - smoothstep(0.0, 0.3, wp.y - hy));
      contact = bx * (1.0 - smoothstep(0.0, 0.3, wp.y - hy));
    }
  }
  let clear = m0.y; let wet = m0.z; let emis = m0.w * m0.w * 64.0;
  let Vd = -rd;
  let NoV = max(dot(n, Vd), 1e-3);
  let L = G.sunDir.xyz;
  let NoL = dot(n, L);
  let viewZ = dot(toP, V.camFwd.xyz);
  let rot = noise * TAU;
  var sh = 1.0;
  if (NoL > 0.0 || cls == 1u) { sh = shadowPCSS(wp, n, viewZ, noise, rot); }
  sh *= 1.0 - 0.85 * contact;
  let a = rough * rough;
  let H = normalize(Vd + L);
  let NoH = max(dot(n, H), 0.0); let VoH = max(dot(Vd, H), 0.0);
  let f0 = mix(vec3f(0.04), albedo, metal);
  let diffC = albedo * (1.0 - metal);
  let sunC = G.sunColor.rgb;
  var col = vec3f(0.0);
  let nl = max(NoL, 0.0);
  // sol direto
  let F = F_Schlick(f0, VoH);
  var spec = D_GGX(NoH, a) * V_SmithGGX(NoV, nl, a) * F;
  // grama/terra muito ásperas: sem o lóbulo rasante do GGX (micro-sombreamento das folhas)
  spec *= mix(1.0, 0.15, smoothstep(0.89, 0.92, rough) * (1.0 - metal));
  col += (diffC * (1.0 - F) / PI + spec) * sunC * nl * sh;
  // translucidez da folhagem (contraluz do sol baixo)
  if (cls == 1u) {
    let back = pow(clamp(dot(rd, L), 0.0, 1.0), 3.0) * 0.8 + 0.2;
    let tr = max(-NoL, 0.0) * 0.5 + 0.35;
    col += diffC * vec3f(1.0, 1.08, 0.55) * sunC * tr * back * sh * 0.8;
  }
  // ambiente difuso (SH) com oclusão; leve rebatimento do chão
  let irr = shIrradiance(n, G.sh) * 1.6;
  let bounce = vec3f(0.05, 0.055, 0.035) * sunC.g * 0.08 * max(-n.y, 0.0);
  col += diffC * (irr + bounce) * ao;
  // reflexo especular de ambiente
  let R = reflect(rd, n);
  let useCube = G.carPos.w > 0.5 && G.carNow.w > 0.5 && length(wp - G.carNow.xyz) < 4.0;
  var env: vec3f;
  let lod = sqrt(rough) * 6.0;
  if (useCube) { env = textureSampleLevel(cubeTex, linClamp, R, sqrt(rough) * 5.0).rgb; }
  else { env = skyLo(R, lod) * mix(0.5, 1.0, sh * 0.5 + 0.5); }
  // horizonte: reflexos abaixo do horizonte escurecem (sem cubo)
  if (!useCube) { env *= mix(0.25, 1.0, smoothstep(-0.25, 0.05, R.y)); }
  let specOcc = clamp(pow(NoV + ao, exp2(-16.0 * a - 1.0)) - 1.0 + ao, 0.0, 1.0);
  var envW = envBRDF(f0, rough, NoV) * specOcc;
  // micro-sombreamento: superfícies muito ásperas (grama, terra, brita) quase não refletem o céu em ângulo rasante
  envW *= mix(1.0, 0.18, smoothstep(0.7, 0.92, rough) * (1.0 - metal));
  // SSR no molhado
  if (cls == 3u && wet > 0.02) {
    let s = ssr(wp + n * 0.02, R, noise);
    env = mix(env * 0.55, s.rgb, s.a);
    envW = envBRDF(vec3f(0.02), rough, NoV) * 0.8;
  }
  if (cls == 2u) { envW *= mix(1.0, 0.45, (1.0 - NoV) * (1.0 - NoV)) * mix(0.5, 1.0, smoothstep(1.0, 3.0, dist)); }
  col += env * envW;
  // verniz da pintura (camada transparente)
  if (clear > 0.01) {
    let ac = 0.05 * 0.05;
    let Fc = min(F_Schlick1(0.06, NoV), 0.42) * clear * mix(0.45, 1.0, smoothstep(1.0, 3.0, dist));
    let Fcs = F_Schlick1(0.04, VoH) * clear;
    let specC = D_GGX(NoH, max(ac, 0.002)) * V_SmithGGX(NoV, nl, max(ac, 0.002)) * Fcs;
    col = col * (1.0 - Fc) + specC * sunC * nl * sh;
    var envC: vec3f;
    if (useCube) { envC = textureSampleLevel(cubeTex, linClamp, R, 1.0 + 1.6 * (1.0 - smoothstep(1.5, 4.5, dist))).rgb * 1.6; } else { envC = skyLo(R, 0.0); }
    if (G.misc.z == 3.0) { envC = vec3f(0.0); }
    col += envC * Fc * specOcc;
    // flocos metálicos (brilho pontual)
    let fl = emis;
    col += sunC * sh * nl * fl * pow(NoH, 40.0) * 0.5 * (1.0 - Fc) * (1.0 - smoothstep(4.0, 12.0, dist));
  } else {
    col += albedo * emis;
  }
  // névoa analítica + volumétrica
  let ff = fogFactor(rd, dist, cam.y);
  col = mix(col, fogColor(rd), ff);
  col = col * vol.a + vol.rgb;
  if (G.misc.z == 2.0) { col = vec3f(ssao); }
  if (G.misc.z == 4.0) { col = albedo * 2.0; }
  if (G.misc.z == 6.0 && (cls == 2u || cls == 4u)) { col = textureSampleLevel(cubeTex, linClamp, R, 0.0).rgb; }
  if (G.misc.z == 5.0) { col = n * 0.5 + 0.5; }
  textureStore(outTex, px, vec4f(col, 1.0));
}
