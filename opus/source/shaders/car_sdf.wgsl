// ---------------------------------------------------------------------------
// car_sdf.wgsl — carroceria do Uno Mille EP (2 portas) como SDF
// Local: +X frente, +Y cima, +Z direita; origem no chão entre os eixos.
// mat: 0 pintura, 1 forração interna, 2 borracha de vedação, 3 preto (caixa de roda/assoalho), 4 para-choque
// ---------------------------------------------------------------------------
struct SdfParams { origin: vec4f, cell: vec4f, dims: vec4u };
@group(0) @binding(0) var<uniform> SP: SdfParams;
@group(0) @binding(1) var<storage, read_write> gridOut: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> ptsIO: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> nrmOut: array<vec4f>;

fn bodyOuter(p0: vec3f) -> f32 {
  // curvaturas sutis por deformação de domínio: coroamento de capô/teto e laterais abauladas
  var p = p0;
  let zc = clamp(abs(p0.z) / 0.74, 0.0, 1.0);
  let crownHood = 0.004 * (1.0 - zc * zc) * smoothstep(0.62, 0.8, p0.y) * smoothstep(0.75, 1.0, p0.x);
  let crownRoof = 0.013 * (1.0 - zc * zc) * smoothstep(1.3, 1.4, p0.y);
  p.y = p0.y - crownHood - crownRoof;
  let xb = clamp(p0.x / 1.85, -1.0, 1.0);
  p.z = p0.z / (1.0 + 0.011 * (1.0 - xb * xb));
  let az = abs(p.z);
  let ds = sdSide(p.xy);
  let dp = sdPlan(vec2f(p.x, az));
  let df = sdFront(vec2f(az, p.y));
  var d = smax(ds, dp, 0.075);
  d = smax(d, df, 0.04);
  // vinco do capô / teto levemente abaulado já nos perfis
  // caixas de roda
  let ax = select(-1.18, 1.18, p.x > 0.0);
  let arch = length(vec2f(p.x - ax, (p.y - 0.295) * 1.04)) - 0.348;
  let archCut = max(arch, 0.47 - az);
  d = smax(d, -archCut, 0.03);
  return d;
}
fn bumper(p: vec3f) -> f32 {
  let az = abs(p.z);
  // dianteiro
  let fq = vec2f(p.x - 1.70, az);
  var plan = sdPlan(vec2f(p.x - 0.04, az * 0.992)) ;
  var bf = max(max(plan + 0.012, abs(p.y - 0.36) - 0.133), 1.52 - p.x) - 0.012;
  // face levemente arredondada
  bf = smax(bf, -(length(vec2f(p.x - 1.18, (p.y - 0.295) * 1.04)) - 0.355), 0.01);
  // traseiro
  var plan2 = sdPlan(vec2f(p.x + 0.06, az * 0.992));
  var br = max(max(plan2 + 0.012, abs(p.y - 0.375) - 0.133), p.x + 1.50) - 0.012;
  br = smax(br, -(length(vec2f(p.x + 1.18, (p.y - 0.295) * 1.04)) - 0.355), 0.01);
  let b = min(bf, br);
  // arredonda arestas
  return b;
}
struct SD { d: f32, m: f32 };
fn carSDF(p: vec3f) -> SD {
  let o = bodyOuter(p);
  let t = 0.036;
  // cavidade só na cabine (carroceria maciça nas pontas e caixas de roda)
  let az = abs(p.z);
  let cab = max(max(p.x - 0.84, -p.x - 1.66), max(0.31 - p.y, az - 0.80));
  let rwh = max(length(vec2f(p.x + 1.18, p.y - 0.30)) - 0.41, 0.40 - az);
  var cav = max(o + t, cab);
  cav = max(cav, -rwh);
  var shell = max(o, -cav);
  let w = windows(p);
  shell = smax(shell, -w, 0.016);
  var m = 0.0;
  if (cav > -0.004 && o < -0.004) { m = 1.0; }
  // interior próximo às caixas de roda / assoalho = preto
  if (m == 1.0 && (p.y < 0.42)) { m = 3.0; }
  if (o > -0.004 && p.y < 0.262) { m = 3.0; }
  let b = bumper(p);
  let dd = smin(shell, b, 0.02);
  if (b < shell) { return SD(dd, 4.0); }
  return SD(dd, m);
}

@compute @workgroup_size(4, 4, 4)
fn csGrid(@builtin(global_invocation_id) id: vec3u) {
  if (any(id >= SP.dims.xyz)) { return; }
  let p = SP.origin.xyz + vec3f(id) * SP.cell.x;
  let s = carSDF(p);
  gridOut[(id.z * SP.dims.y + id.y) * SP.dims.x + id.x] = vec2f(s.d, s.m);
}
// projeta pontos na superfície e calcula normais exatas
@compute @workgroup_size(64)
fn csRefine(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= SP.dims.w) { return; }
  var p = ptsIO[i].xyz;
  let e = 0.0006;
  for (var k = 0; k < 4; k++) {
    let d = carSDF(p).d;
    let g = vec3f(carSDF(p + vec3f(e, 0, 0)).d - carSDF(p - vec3f(e, 0, 0)).d, carSDF(p + vec3f(0, e, 0)).d - carSDF(p - vec3f(0, e, 0)).d, carSDF(p + vec3f(0, 0, e)).d - carSDF(p - vec3f(0, 0, e)).d) / (2.0 * e);
    let gl = max(length(g), 1e-4);
    let step = clamp(d / gl, -0.006, 0.006);
    p -= g / gl * step;
  }
  let e2 = 0.0012;
  let g = vec3f(carSDF(p + vec3f(e2, 0, 0)).d - carSDF(p - vec3f(e2, 0, 0)).d, carSDF(p + vec3f(0, e2, 0)).d - carSDF(p - vec3f(0, e2, 0)).d, carSDF(p + vec3f(0, 0, e2)).d - carSDF(p - vec3f(0, 0, e2)).d);
  ptsIO[i] = vec4f(p, carSDF(p).m);
  nrmOut[i] = vec4f(normalize(g), 0.0);
}
// raios contra a superfície externa (vidros): pts = origem (xyz), nrm = direção -> saída: ponto, normal
@compute @workgroup_size(64)
fn csRay(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= SP.dims.w) { return; }
  let ro = ptsIO[i].xyz; let rd = nrmOut[i].xyz;
  var t = 0.0; var hit = 0.0;
  for (var k = 0; k < 160; k++) {
    let d = bodyOuter(ro + rd * t);
    if (d < 0.0002) { hit = 1.0; break; }
    t += max(d * 0.8, 0.0005);
    if (t > 3.0) { break; }
  }
  let p = ro + rd * t;
  let e = 0.001;
  let g = vec3f(bodyOuter(p + vec3f(e, 0, 0)) - bodyOuter(p - vec3f(e, 0, 0)), bodyOuter(p + vec3f(0, e, 0)) - bodyOuter(p - vec3f(0, e, 0)), bodyOuter(p + vec3f(0, 0, e)) - bodyOuter(p - vec3f(0, 0, e)));
  ptsIO[i] = vec4f(p, hit);
  nrmOut[i] = vec4f(normalize(g), 0.0);
}
