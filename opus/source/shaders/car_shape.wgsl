// car_shape.wgsl — perfis 2D e janelas do Uno (compartilhado entre SDF e materiais)
fn smin(a: f32, b: f32, k: f32) -> f32 { let h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
fn smax(a: f32, b: f32, k: f32) -> f32 { return -smin(-a, -b, k); }

fn sdPoly(p: vec2f, v: ptr<function, array<vec2f, 24>>, n: i32) -> f32 {
  var d = dot(p - (*v)[0], p - (*v)[0]);
  var s = 1.0;
  var j = n - 1;
  for (var i = 0; i < n; i++) {
    let vi = (*v)[i]; let vj = (*v)[j];
    let e = vj - vi; let w = p - vi;
    let b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    let c1 = p.y >= vi.y; let c2 = p.y < vj.y; let c3 = e.x * w.y > e.y * w.x;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) { s = -s; }
    j = i;
  }
  return s * sqrt(d);
}

// perfil lateral (x, y)
fn sdSide(p: vec2f) -> f32 {
  var v = array<vec2f, 24>();
  v[0] = vec2f(1.80, 0.26); v[1] = vec2f(1.832, 0.50); v[2] = vec2f(1.840, 0.715); v[3] = vec2f(1.828, 0.758);
  v[4] = vec2f(1.79, 0.775); v[5] = vec2f(1.55, 0.808); v[6] = vec2f(1.25, 0.846); v[7] = vec2f(0.98, 0.874);
  v[8] = vec2f(0.84, 0.885); v[9] = vec2f(0.79, 0.895); v[10] = vec2f(0.15, 1.392); v[11] = vec2f(0.04, 1.414);
  v[12] = vec2f(-0.55, 1.426); v[13] = vec2f(-1.30, 1.418); v[14] = vec2f(-1.47, 1.405); v[15] = vec2f(-1.545, 1.375);
  v[16] = vec2f(-1.715, 0.99); v[17] = vec2f(-1.765, 0.80); v[18] = vec2f(-1.78, 0.53); v[19] = vec2f(-1.765, 0.27);
  v[20] = vec2f(-1.70, 0.245); v[21] = vec2f(1.70, 0.245);
  return sdPoly(p, &v, 22);
}
// planta (x, |z|)
fn sdPlan(p: vec2f) -> f32 {
  var v = array<vec2f, 24>();
  v[0] = vec2f(1.86, -0.2); v[1] = vec2f(1.858, 0.45); v[2] = vec2f(1.845, 0.62); v[3] = vec2f(1.81, 0.70);
  v[4] = vec2f(1.74, 0.748); v[5] = vec2f(1.58, 0.770); v[6] = vec2f(1.20, 0.776); v[7] = vec2f(-1.40, 0.776);
  v[8] = vec2f(-1.66, 0.768); v[9] = vec2f(-1.755, 0.735); v[10] = vec2f(-1.79, 0.66); v[11] = vec2f(-1.80, 0.40);
  v[12] = vec2f(-1.80, -0.2);
  return sdPoly(p, &v, 13);
}
// seção frontal (|z|, y)
fn sdFront(p: vec2f) -> f32 {
  var v = array<vec2f, 24>();
  v[0] = vec2f(-0.2, 0.235); v[1] = vec2f(0.69, 0.235); v[2] = vec2f(0.742, 0.29); v[3] = vec2f(0.766, 0.44);
  v[4] = vec2f(0.777, 0.615); v[5] = vec2f(0.772, 0.64); v[6] = vec2f(0.769, 0.80); v[7] = vec2f(0.762, 0.955);
  v[8] = vec2f(0.748, 0.99); v[9] = vec2f(0.722, 1.05); v[10] = vec2f(0.672, 1.28); v[11] = vec2f(0.645, 1.365);
  v[12] = vec2f(0.60, 1.415); v[13] = vec2f(0.50, 1.438); v[14] = vec2f(0.0, 1.452); v[15] = vec2f(-0.2, 1.452);
  return sdPoly(p, &v, 16);
}
fn sdWinDoor(p: vec2f) -> f32 {
  var v = array<vec2f, 24>();
  v[0] = vec2f(0.585, 0.995); v[1] = vec2f(0.135, 1.350); v[2] = vec2f(0.06, 1.368); v[3] = vec2f(-0.505, 1.372); v[4] = vec2f(-0.505, 0.995);
  return sdPoly(p, &v, 5);
}
fn sdWinQuarter(p: vec2f) -> f32 {
  var v = array<vec2f, 24>();
  v[0] = vec2f(-0.595, 0.995); v[1] = vec2f(-0.595, 1.372); v[2] = vec2f(-1.05, 1.370); v[3] = vec2f(-1.13, 1.35);
  v[4] = vec2f(-1.355, 1.04); v[5] = vec2f(-1.335, 0.995);
  return sdPoly(p, &v, 6);
}

fn windows(p: vec3f) -> f32 {
  let az = abs(p.z);
  // laterais
  let wd = min(sdWinDoor(p.xy), sdWinQuarter(p.xy));
  let side = max(wd, 0.45 - az);
  // para-brisa: dentro da seção frontal recuada, faixa de altura, metade dianteira
  let df = sdFront(vec2f(az, p.y));
  let ws = max(max(df + 0.078, max(0.935 - p.y, p.y - 1.37)), max(-p.x - 0.1, p.x - 1.0));
  // vidro traseiro
  let rw = max(max(df + 0.09, max(1.005 - p.y, p.y - 1.348)), max(p.x + 1.30, -p.x - 2.0));
  return min(side, min(ws, rw));
}
