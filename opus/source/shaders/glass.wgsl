// ---------------------------------------------------------------------------
// glass.wgsl — vidros do carro (forward, fonte dupla: reflexo somado + transmissão)
// precisa de "enable dual_source_blending;" no topo do módulo
// ---------------------------------------------------------------------------
@group(2) @binding(0) var cubeTexG: texture_cube<f32>;

struct GlassOut {
  @location(0) @blend_src(0) color: vec4f,
  @location(0) @blend_src(1) trans: vec4f,
};
@fragment
fn fsGlass(i: VOut) -> GlassOut {
  var n = normalize(i.nrm);
  let Vd = normalize(V.camPos.xyz - i.wpos);
  if (dot(n, Vd) < 0.0) { n = -n; }
  let NoV = clamp(dot(n, Vd), 0.0, 1.0);
  let rear = i.attr.y == 1u;
  // ondulação mínima do vidro (distorção sutil do reflexo)
  let w = vec3f(vnoise2(i.lpos.xy * 9.0) - 0.5, vnoise2(i.lpos.yz * 9.0 + 3.0) - 0.5, 0.0) * 0.012;
  let nn = normalize(n + w);
  let R = reflect(-Vd, nn);
  let F = 0.06 + 0.94 * pow(1.0 - NoV, 4.0);
  let env = textureSampleLevel(cubeTexG, sampClamp, R, 0.0).rgb;
  // sol especular
  let L = G.sunDir.xyz; let H = normalize(L + Vd);
  let NoL = max(dot(nn, L), 0.0);
  let spec = D_GGX(max(dot(nn, H), 0.0), 0.0009) * V_SmithGGX(NoV, NoL, 0.0009) * F_Schlick1(0.04, max(dot(Vd, H), 0.0)) * NoL;
  let sh = shadowSimple(i.wpos, 0);
  // poeira/sujeira leve (difusa)
  let dust = 0.03 + 0.05 * smoothstep(0.4, 0.9, vnoise2(i.lpos.zy * 6.0)) + select(0.0, 0.04, rear);
  let amb = shIrradiance(n, G.sh);
  var col = env * F + G.sunColor.rgb * spec * sh + amb * dust * 0.25 + G.sunColor.rgb * dust * 0.04 * NoL * sh;
  var tint = vec3f(0.62, 0.80, 0.74);
  if (rear) {
    // linhas do desembaçador
    let l = 1.0 - smoothstep(0.0, 0.0012, abs(fract(i.lpos.y / 0.026) - 0.5) * 0.026);
    tint *= 1.0 - l * 0.5 * step(abs(i.lpos.z), 0.52);
    tint *= 0.85;
  }
  // faixa degradê no topo do para-brisa
  if (i.lpos.x > 0.0 && i.lpos.y > 1.30) { tint *= mix(1.0, 0.45, smoothstep(1.30, 1.36, i.lpos.y)); }
  col = fogApply(col, i.wpos, V.camPos.xyz);
  var o: GlassOut;
  o.color = vec4f(col, 0.0);
  o.trans = vec4f(tint * (1.0 - F) * (1.0 - dust), 1.0);
  return o;
}
