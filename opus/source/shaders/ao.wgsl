// ---------------------------------------------------------------------------
// ao.wgsl — GTAO em meia resolução + filtro bilateral
// ---------------------------------------------------------------------------
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<uniform> G: Globals;
@group(0) @binding(2) var gDepth: texture_depth_2d;
@group(0) @binding(3) var gNrm: texture_2d<f32>;
@group(0) @binding(4) var aoOut: texture_storage_2d<rgba16float, write>;

// posição no espaço de vista direto da profundidade linear (sem passar por coordenadas de mundo:
// evita o erro de arredondamento que virava ruído/manchas)
fn viewPos(px: vec2i) -> vec3f {
  let d = max(textureLoad(gDepth, px, 0), 1e-7);
  let uv = (vec2f(px) + 0.5) * V.res.zw;
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let z = V.camPos.w / d;                       // distância ao longo do eixo (positiva)
  let f = 1.0 / tan(0.5 * V.params.w);
  let aspect = V.res.x / V.res.y;
  return vec3f(ndc.x * z * aspect / f, ndc.y * z / f, -z);
}
@compute @workgroup_size(8, 8)
fn csAO(@builtin(global_invocation_id) gid: vec3u) {
  let hd = textureDimensions(aoOut);
  if (gid.x >= hd.x || gid.y >= hd.y) { return; }
  let fp = vec2i(gid.xy) * 2;
  let d0 = textureLoad(gDepth, fp, 0);
  if (d0 <= 0.0) { textureStore(aoOut, gid.xy, vec4f(1.0, 0.0, 0.0, 0.0)); return; }
  let P = viewPos(fp);
  let nw = octDecode(textureLoad(gNrm, fp, 0).xy);
  let N = normalize((V.view * vec4f(nw, 0.0)).xyz);
  let Vv = normalize(-P);
  let frame = G.time.z;
  // ruído estruturado 4x4 (cancelado pelo filtro 5x5) + leve rotação temporal
  let bay = array<f32, 16>(0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  let bi = (gid.x & 3u) + (gid.y & 3u) * 4u;
  let noise = fract(bay[bi] / 16.0 + fract(frame * 0.618) * 0.25);
  let noise2 = fract(bay[(bi + 5u) & 15u] / 16.0 + 0.5 / 16.0);
  let radiusW = 1.3;
  let projScale = V.res.y * 0.5 / tan(0.5 * V.params.w);
  var rPx = radiusW * projScale / max(-P.z, 0.1);
  rPx = clamp(rPx, 3.0, 110.0);
  let SL = 2; let ST = 7;
  var vis = 0.0;
  for (var s = 0; s < SL; s++) {
    let phi = (f32(s) + noise) * PI / f32(SL);
    let dir = vec2f(cos(phi), sin(phi));
    let dirV = vec3f(dir.x, -dir.y, 0.0);
    let ortho = dirV - dot(dirV, Vv) * Vv;
    let axis = normalize(cross(dirV, Vv));
    let np = N - axis * dot(N, axis);
    let npl = max(length(np), 1e-4);
    let cosN = clamp(dot(np / npl, Vv), -1.0, 1.0);
    let nAng = sign(dot(np, ortho)) * acos(cosN);
    var hc0 = -1.0; var hc1 = -1.0;
    for (var k = 0; k < ST; k++) {
      let t = (f32(k) + noise2) / f32(ST);
      let off = dir * max(t * t * rPx, 1.0 + f32(k));
      for (var side = 0; side < 2; side++) {
        let sgn = select(-1.0, 1.0, side == 1);
        let sp = fp + vec2i(off * sgn);
        if (any(sp < vec2i(0)) || f32(sp.x) >= V.res.x || f32(sp.y) >= V.res.y) { continue; }
        let S = viewPos(sp);
        let hv = S - P; let hl = length(hv);
        if (hl < 0.004 * (-P.z) + 0.01) { continue; }
        let c = dot(hv / hl, Vv);
        let fall = 1.0 - smoothstep(radiusW * 0.6, radiusW * 1.4, hl);
        let cc = mix(-1.0, c, fall);
        if (side == 1) { hc1 = max(hc1, cc); } else { hc0 = max(hc0, cc); }
      }
    }
    let h0 = nAng + max(-acos(clamp(hc0, -1.0, 1.0)) - nAng, -PI * 0.5);
    let h1 = nAng + min(acos(clamp(hc1, -1.0, 1.0)) - nAng, PI * 0.5);
    let sn = sin(nAng); let cn = cos(nAng);
    let v0 = -cos(2.0 * h0 - nAng) + cn + 2.0 * h0 * sn;
    let v1 = -cos(2.0 * h1 - nAng) + cn + 2.0 * h1 * sn;
    vis += npl * 0.25 * (v0 + v1);
  }
  let ao = clamp(vis / f32(SL) * 1.22, 0.0, 1.0);
  textureStore(aoOut, gid.xy, vec4f(pow(ao, 1.8), -P.z, 0.0, 0.0));
}

// filtro bilateral 5x5 (meia resolução)
@group(0) @binding(5) var aoIn: texture_2d<f32>;
@group(0) @binding(6) var aoBlurOut: texture_storage_2d<rgba16float, write>;
@compute @workgroup_size(8, 8)
fn csAOBlur(@builtin(global_invocation_id) gid: vec3u) {
  let hd = textureDimensions(aoBlurOut);
  if (gid.x >= hd.x || gid.y >= hd.y) { return; }
  let c = textureLoad(aoIn, vec2i(gid.xy), 0);
  var s = 0.0; var w = 0.0;
  for (var y = -2; y <= 1; y++) { for (var x = -2; x <= 1; x++) {
    let p = clamp(vec2i(gid.xy) + vec2i(x, y), vec2i(0), vec2i(hd) - 1);
    let t = textureLoad(aoIn, p, 0);
    let wd = exp(-abs(t.y - c.y) / max(c.y * 0.04, 0.02));
    s += t.x * wd; w += wd;
  } }
  textureStore(aoBlurOut, gid.xy, vec4f(s / max(w, 1e-4), c.y, 0.0, 0.0));
}
