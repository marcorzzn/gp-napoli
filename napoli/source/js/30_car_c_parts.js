// Fiat 127 — Livrea SSC Napoli 3° Scudetto 1926: paraurti bianchi, specchietti bianchi, sedili bianchi, cerchi bianchi con coppetta azzurra, livrea 2048x1024 (niente portapacchi/scala).
function carPath(pts) {
  const n = pts.length, cum = [0], dir = [];
  for (let i = 0; i < n - 1; i++) { const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy); cum.push(cum[i] + l); dir.push([dx / l, dy / l]); }
  const L = cum[n - 1];
  return {
    L, at(s, o) {
      s = clamp(s, 0, L); let k = 0; while (k < n - 2 && s > cum[k + 1]) k++;
      const t = s - cum[k]; let a = pts[k][0] + dir[k][0] * t, b = pts[k][1] + dir[k][1] * t, ta = dir[k][0], tb = dir[k][1];
      for (let i = 1; i < n - 1; i++) {
        const r = pts[i][2] || 0; if (!r) continue; const d = s - cum[i]; if (d <= -r || d >= r) continue;
        const g = d < 0 ? (r + d) * (r + d) / (4 * r) : (r - d) * (r - d) / (4 * r), h = d < 0 ? (r + d) / (2 * r) : -(r - d) / (2 * r);
        const ex = dir[i][0] - dir[i - 1][0], ey = dir[i][1] - dir[i - 1][1];
        a += ex * g; b += ey * g; ta += ex * h; tb += ey * h;
      }
      o[0] = a; o[1] = b; o[2] = ta; o[3] = tb; return o;
    }
  };
}
function carTopX(z, y, rear) {
  let a = rear ? -1.76 : 1.6, b = rear ? -1.35 : 1.95;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2, f = carYtop(m, z) - y; if ((f > 0) === !rear) a = m; else b = m; }
  return (a + b) / 2;
}
const _cp = new Float64Array(4), _cq = new Float64Array(4);
function carBumper(mb, path, prof, sign, field, nu, nv, sC, side, yTop, taper) {
  mb.patch((u, v, o) => {
    const sp = u * path.L; path.at(sp, _cp); prof.at(v * prof.L, _cq);
    const l = 1 / Math.hypot(_cp[2], _cp[3]), nx = _cp[3] * l * sign, nz = -_cp[2] * l * sign;
    const k = _cq[0] > 0 ? lerp(1, side, smooth(sC - 0.06, sC + 0.14, sp)) : 1;
    const hk = 1 - taper * smooth(sC + 0.05, path.L, sp);
    o[0] = _cp[0] + nx * _cq[0] * k; o[1] = yTop - (yTop - _cq[1]) * hk; o[2] = _cp[1] + nz * _cq[0] * k;
  }, 0, 1, 0, 1, { nu, nv, flip: sign < 0, field, rim: 0.02, uv: (u, v, P) => { _cuv[0] = P[2]; _cuv[1] = P[1]; return _cuv; } });
}
function carBuildParts(mb, gl) {
  const v0 = mb.nv, i0 = mb.ni, gv0 = gl.nv, gi0 = gl.ni;
  // ================= paraurti anteriori e posteriori BIANCHI lucidi (Fiat 127 Napoli) =================
  mb.mat(CM.GLOSS).color(0.86, 0.87, 0.88);
  const fPath = carPath([[1.869, 0], [1.862, 0.30, 0.15], [1.838, 0.56, 0.12], [1.822, 0.686, 0.07], [1.70, 0.702, 0.06], [1.49, 0.722, 0.1], [1.28, 0.742]]);
  const fProf = carPath([[-0.09, 0.578], [0.036, 0.576, 0.006], [0.044, 0.564, 0.006], [0.044, 0.456, 0.006], [0.034, 0.440, 0.008], [-0.07, 0.432]]);
  const fSC = 0.30 + 0.261 + 0.127;
  carBumper(mb, fPath, fProf, 1, (u, v, P) => -(carArchF(P) - 0.004), 140, 32, fSC, 0.32, 0.578, 0.18);
  // sottoparaurti anteriore azzurro Napoli (grembiulatura)
  mb.mat(CM.PAINT, 255).color(1, 1, 1);
  mb.quad(1.855, 0.31, 0.64, 1.855, 0.31, 0, 1.855, 0.445, 0, 1.855, 0.445, 0.64);
  // paraurti posteriore bianco lucido
  mb.mat(CM.GLOSS).color(0.86, 0.87, 0.88);
  const rPath = carPath([[-1.692, 0], [-1.688, 0.30, 0.15], [-1.674, 0.58, 0.1], [-1.657, 0.70, 0.07], [-1.60, 0.722, 0.05], [-1.49, 0.735, 0.1], [-1.28, 0.751]]);
  const rProf = carPath([[-0.09, 0.562], [0.032, 0.560, 0.006], [0.040, 0.548, 0.006], [0.040, 0.448, 0.006], [0.030, 0.432, 0.008], [-0.07, 0.422]]);
  carBumper(mb, rPath, rProf, -1, (u, v, P) => -(carArchF(P) - 0.004), 120, 30, 0.30 + 0.28 + 0.121, 0.36, 0.562, 0.18);
  // sottoparaurti posteriore azzurro
  mb.mat(CM.PAINT, 255).color(1, 1, 1);
  mb.quad(-1.678, 0.33, 0, -1.678, 0.33, 0.64, -1.678, 0.44, 0.64, -1.678, 0.44, 0);
  // ================= passaruota e fondo =================
  mb.mat(CM.UNDER).color(0.006, 0.006, 0.007);
  for (const ax of [CS.AXF, CS.AXR]) {
    const R0 = CS.ARCH_R + 0.006, N = 28, zo = carZL(ax, 0.55) - 0.012, zi = 0.33;
    for (let i = 0; i < N; i++) {
      const aS = ax > 0 ? 12 : -18, aE = ax > 0 ? 198 : 163;
      const a0 = (aS + (aE - aS) * i / N) * PI / 180, a1 = (aS + (aE - aS) * (i + 1) / N) * PI / 180;
      const x0 = ax + Math.cos(a0) * R0, y0 = CS.ARCH_Y + Math.sin(a0) * R0, x1 = ax + Math.cos(a1) * R0, y1 = CS.ARCH_Y + Math.sin(a1) * R0;
      const a = mb.v(x0, y0, zo, -Math.cos(a0), -Math.sin(a0), 0, 0, 0), b = mb.v(x0, y0, zi, -Math.cos(a0), -Math.sin(a0), 0, 0, 1), c = mb.v(x1, y1, zi, -Math.cos(a1), -Math.sin(a1), 0, 1, 1), d = mb.v(x1, y1, zo, -Math.cos(a1), -Math.sin(a1), 0, 1, 0);
      mb.quadI(a, d, c, b);
    }
    mb.quad(ax - 0.33, 0.25, zi, ax + 0.33, 0.25, zi, ax + 0.33, 0.66, zi, ax - 0.33, 0.66, zi);
  }
  mb.quad(1.56, 0.2, 0.56, 1.56, 0.2, 0, 1.56, 0.42, 0, 1.56, 0.42, 0.56);
  mb.quad(-1.33, 0.2, 0, -1.33, 0.2, 0.56, -1.33, 0.42, 0.56, -1.33, 0.42, 0);
  mb.quad(1.56, 0.42, 0, 1.86, 0.42, 0, 1.86, 0.42, 0.72, 1.56, 0.42, 0.72);
  mb.quad(-1.68, 0.42, 0, -1.33, 0.42, 0, -1.33, 0.42, 0.74, -1.68, 0.42, 0.74);
  mb.quad(-0.84, 0.2, 0, 0.84, 0.2, 0, 0.84, 0.2, 0.705, -0.84, 0.2, 0.705);
  mb.quad(0.84, 0.2, 0, 1.56, 0.2, 0, 1.56, 0.2, 0.5, 0.84, 0.2, 0.5);
  mb.quad(-1.33, 0.2, 0, -0.84, 0.2, 0, -0.84, 0.2, 0.5, -1.33, 0.2, 0.5);
  // ================= parabola faro anteriore =================
  {
    const z0 = CL.hlZ0 + 0.003, z1 = CL.hlZ1 - 0.003, y0 = CL.lY - CL.lH + 0.003, y1 = CL.lY + CL.lH - 0.003, D = 0.062;
    const zc = (z0 + z1) / 2, yc = (y0 + y1) / 2, hz = (z1 - z0) / 2, hy = (y1 - y0) / 2;
    const dep = (a, b) => 0.006 + D * Math.pow(Math.max(0, (1 - a * a * a * a) * (1 - b * b * b * b)), 0.6);
    mb.mat(CM.REFLECTOR).color(0.9, 0.9, 0.92);
    mb.patch((u, v, o) => { const z = zc + u * hz, y = yc + v * hy, d = dep(u, v), x = carTopX(z, y, false); o[0] = x - d * 0.97; o[1] = y - d * 0.2; o[2] = z; }, -1, 1, -1, 1, { nu: 22, nv: 12, flip: true, uv: (u, v, P) => { _cuv[0] = u; _cuv[1] = v; return _cuv; } });
    const xb = carTopX(zc, yc, false) - (dep(0, 0) - 0.012) * 0.97, ybb = yc - (dep(0, 0) - 0.012) * 0.2;
    mb.push(m4translate(m4(), xb, ybb, zc)); mb.push(m4rotZ(m4(), -PI / 2 + 0.2));
    mb.mat(CM.REFLECTOR, 1).color(1, 0.95, 0.8); mb.cyl(0, -0.012, 0, 0.0105, 0.024, 0.0095, 12, false, true);
    mb.mat(CM.REFLECTOR, 2).color(0.85, 0.85, 0.86); mb.cyl(0, -0.012, 0, 0.016, -0.007, 0.014, 14, false, true);
    mb.mat(CM.REFLECTOR, 2).color(0.6, 0.6, 0.6); mb.cyl(0, 0.022, 0, 0.0105, 0.029, 0.007, 12, false, true);
    mb.pop(); mb.pop();
  }
  // ================= specchietti retrovisori BIANCHI (come Fiat 127 Napoli) =================
  mb.mat(CM.GLOSS).color(0.86, 0.87, 0.88);
  mb.push(m4translate(m4(), 0.556, 1.004, 0.895)); mb.push(m4rotY(m4(), 0.14));
  mb.rbox(0, 0, 0, 0.072, 0.104, 0.165, 0.020, 5);
  mb.mat(CM.MIRROR).color(0.62, 0.64, 0.67);
  mb.quad(-0.0365, -0.038, -0.068, -0.0365, -0.038, 0.068, -0.0365, 0.038, 0.068, -0.0365, 0.038, -0.068);
  mb.pop(); mb.pop();
  mb.mat(CM.GLOSS).color(0.82, 0.84, 0.86);
  mb.push(m4translate(m4(), 0.566, 0.994, 0.742)); mb.push(m4rotY(m4(), -PI / 2));
  { const pr = []; for (let i = 0; i <= 10; i++) pr.push([i * 0.007, 0.022 - i * 0.0005]); mb.lathe(pr, 16); }
  mb.pop(); mb.pop();
  mb.mat(CM.PLASTIC).color(0.02, 0.02, 0.022);
  mb.rbox(0.586, 0.994, 0.742, 0.11, 0.072, 0.018, 0.008, 2);
  // ================= interni con sedili BIANCHI a coste (visibili dai finestrini) =================
  mb.mat(CM.INTERIOR).color(0.05, 0.05, 0.055);
  mb.quad(-0.86, 0.235, 0.72, 0.85, 0.235, 0.72, 0.85, 0.235, 0, -0.86, 0.235, 0);
  mb.quad(-1.33, 0.235, 0.5, -0.86, 0.235, 0.5, -0.86, 0.235, 0, -1.33, 0.235, 0);
  mb.quad(-1.63, 0.45, 0.72, -1.33, 0.45, 0.72, -1.33, 0.45, 0, -1.63, 0.45, 0);
  mb.quad(0.82, 0.2, 0, 0.82, 0.2, 0.72, 0.82, 0.93, 0.72, 0.82, 0.93, 0);
  mb.mat(CM.INTERIOR, 3).color(0.045, 0.045, 0.05);
  mb.rbox(0.60, 0.80, 0.34, 0.40, 0.22, 0.70, 0.05, 4);
  mb.rbox(0.45, 0.52, 0.05, 0.3, 0.34, 0.12, 0.03, 2);
  mb.mat(CM.INTERIOR, 3).color(0.075, 0.075, 0.082); mb.rbox(0.62, 0.915, 0.34, 0.34, 0.024, 0.69, 0.01, 2);
  mb.mat(CM.GRILLE).color(0.02, 0.02, 0.022);
  mb.box(0.397, 0.862, 0.615, 0.008, 0.045, 0.1); mb.box(0.397, 0.862, 0.09, 0.008, 0.045, 0.1);
  mb.mat(CM.INTERIOR, 3).color(0.03, 0.03, 0.034); mb.rbox(0.396, 0.775, 0.34, 0.012, 0.085, 0.3, 0.005, 2);
  // sedili anteriori BIANCHI a coste verticali/orizzontali (matching photo)
  const seat = (x, z, w, color) => {
    mb.mat(CM.INTERIOR, 4).color(color[0], color[1], color[2]);
    mb.rbox(x, 0.43, z, 0.5, 0.15, w, 0.055, 4);
    mb.push(m4translate(m4(), x - 0.26, 0.47, z)); mb.push(m4rotZ(m4(), 0.33)); mb.rbox(0, 0.3, 0, 0.13, 0.6, w - 0.02, 0.055, 4);
    mb.color(color[0] * 0.95, color[1] * 0.96, color[2] * 0.97); mb.rbox(0.058, 0.3, 0, 0.03, 0.46, w - 0.2, 0.012, 2); mb.pop(); mb.pop();
    mb.rbox(x + 0.02, 0.498, z, 0.36, 0.03, w - 0.2, 0.012, 2);
  };
  seat(-0.03, 0.345, 0.5, [0.78, 0.80, 0.82]);
  mb.push(m4translate(m4(), -0.29, 0.47, 0.345)); mb.push(m4rotZ(m4(), 0.33));
  mb.mat(CM.INTERIOR, 2).color(0.76, 0.78, 0.80); mb.rbox(0.005, 0.71, 0, 0.1, 0.17, 0.25, 0.04, 4);
  mb.mat(CM.STEEL).color(0.4, 0.4, 0.42); mb.cyl(0, 0.58, -0.06, 0.006, 0.64, 0.006, 6); mb.cyl(0, 0.58, 0.06, 0.006, 0.64, 0.006, 6);
  mb.pop(); mb.pop();
  // panca posteriore bianca
  mb.mat(CM.INTERIOR, 4).color(0.76, 0.78, 0.80);
  mb.rbox(-0.93, 0.45, 0.31, 0.46, 0.15, 0.62, 0.055, 4);
  mb.push(m4translate(m4(), -1.16, 0.5, 0.31)); mb.push(m4rotZ(m4(), 0.36)); mb.rbox(0, 0.25, 0, 0.12, 0.52, 0.62, 0.05, 4); mb.pop(); mb.pop();
  mb.mat(CM.INTERIOR).color(0.66, 0.68, 0.70); mb.box(-1.40, 0.925, 0.3, 0.28, 0.02, 0.6);
  mb.mirror(v0, i0, 2); gl.mirror(gv0, gi0, 2);
  // ======================= parti non simmetriche (senza portapacchi e senza scala) =======================
  carWipers(mb);
  // scarico posteriore sportivo
  mb.mat(CM.STEEL, 1).color(0.03, 0.03, 0.032);
  mb.push(m4translate(m4(), -1.43, 0.272, 0.0)); mb.push(m4rotX(m4(), PI / 2)); mb.cyl(0, 0, 0, 0.062, 0.34, 0.062, 20, true, true); mb.pop(); mb.pop();
  mb.mat(CM.CHROME, 1).color(0.55, 0.56, 0.58);
  mb.tube([[-1.44, 0.268, -0.2], [-1.56, 0.26, -0.2], [-1.715, 0.256, -0.2]], 0.021, 10);
  // piantone sterzo e strumentazione
  mb.mat(CM.INTERIOR, 3).color(0.04, 0.04, 0.045);
  mb.tube([[0.36, 0.875, -0.36], [0.56, 0.80, -0.36]], 0.03, 10);
  mb.rbox(0.47, 0.925, -0.36, 0.2, 0.07, 0.32, 0.03, 3);
  mb.rbox(0.23, 1.29, 0, 0.025, 0.055, 0.2, 0.012, 2); mb.tube([[0.24, 1.29, 0], [0.2, 1.35, 0]], 0.008, 6);
  mb.tube([[0.2, 0.42, 0.0], [0.17, 0.6, 0.0]], 0.01, 6); mb.rbox(0.168, 0.62, 0, 0.045, 0.045, 0.045, 0.02, 3);
  mb.rbox(-0.12, 0.40, 0, 0.3, 0.05, 0.04, 0.015, 2);
  // pilota con tuta azzurra Napoli e casco bianco
  {
    const zd = -0.345;
    mb.mat(CM.INTERIOR, 2).color(0.028, 0.24, 0.68);   // tuta azzurro Napoli
    mb.push(m4translate(m4(), -0.245, 0.50, zd)); mb.push(m4rotZ(m4(), 0.30));
    mb.rbox(0.085, 0.27, 0, 0.2, 0.54, 0.36, 0.08, 4);
    mb.rbox(0.085, 0.50, 0, 0.17, 0.1, 0.44, 0.045, 3);
    mb.pop(); mb.pop();
    mb.rbox(0.02, 0.535, zd, 0.44, 0.13, 0.34, 0.06, 3);
    for (const sg of [-1, 1]) mb.tube([[-0.26, 0.97, zd + sg * 0.2], [-0.02, 0.86, zd + sg * 0.215], [0.275, 0.93, -0.36 + sg * 0.165]], 0.043, 8);
    mb.mat(CM.INTERIOR, 3).color(0.02, 0.02, 0.022);
    for (const sg of [-1, 1]) mb.rbox(0.285, 0.935, -0.36 + sg * 0.17, 0.085, 0.07, 0.075, 0.03, 2);
    mb.rbox(-0.275, 1.035, zd, 0.1, 0.07, 0.11, 0.03, 2);
    mb.mat(CM.INTERIOR, 3).color(0.012, 0.012, 0.013);
    mb.sweep([[-0.262, 1.0, zd - 0.15], [-0.15, 0.82, zd - 0.02], [-0.085, 0.63, zd + 0.15]], [[-0.022, 0.004], [0.022, 0.004], [0.022, -0.004], [-0.022, -0.004]], { closedProfile: true, hard: true, up: [1, 0.3, 0] });
    mb.mat(CM.GLOSS).color(0.84, 0.86, 0.88);   // casco bianco
    mb.rbox(-0.262, 1.168, zd, 0.25, 0.25, 0.228, 0.112, 7);
    mb.rbox(-0.236, 1.092, zd, 0.186, 0.105, 0.206, 0.05, 5);
    mb.mat(CM.GLOSS, 1).color(0.01, 0.011, 0.014);
    mb.rbox(-0.2, 1.178, zd, 0.13, 0.08, 0.233, 0.034, 5);
  }
  // targhe e badge FIAT 127
  carDecals(mb);
}
function carWipers(mb) {
  const wip = (zp, z1, xe0, lift) => {
    const P = (z, xe) => { const zz = z / 0.72, x = xe + carBulge(xe) * (1 - zz * zz); return [x, carYtop(x, z) + 0.016, z]; };
    mb.mat(CM.RUBBER).color(0.015, 0.015, 0.015);
    const zm = (zp + z1) / 2, a = P(zp, 0.69), m = P(zm + (z1 - zp) * 0.1, xe0 - lift * 0.5);
    mb.rbox(a[0], a[1] - 0.004, a[2], 0.03, 0.022, 0.03, 0.008, 2);
    mb.sweep([a, [(a[0] + m[0]) / 2, (a[1] + m[1]) / 2 + 0.006, (a[2] + m[2]) / 2], m], [[-0.006, -0.003], [0.006, -0.003], [0.006, 0.003], [-0.006, 0.003]], { closedProfile: true, hard: true });
    const pts = []; for (let k = 0; k <= 8; k++) { const z = lerp(zp + (z1 - zp) * 0.12, z1, k / 8); pts.push(P(z, lerp(xe0, xe0 - lift, k / 8))); }
    mb.sweep(pts, [[-0.007, -0.008], [0.007, -0.008], [0.004, 0.006], [-0.004, 0.006]], { closedProfile: true, hard: true });
  };
  wip(0.30, -0.22, 0.655, 0.03); wip(-0.24, -0.66, 0.655, 0.05);
  mb.mat(CM.RUBBER).color(0.015, 0.015, 0.015);
  const PR = (z, y) => { const x = carTopX(z, y, true); return [x - 0.016, y + 0.006, z]; };
  const a = PR(0.02, 0.975), b = PR(-0.2, 1.01);
  mb.rbox(a[0], a[1], a[2], 0.03, 0.03, 0.03, 0.008, 2);
  mb.sweep([a, b], [[-0.005, -0.003], [0.005, -0.003], [0.005, 0.003], [-0.005, 0.003]], { closedProfile: true, hard: true });
  const pts = []; for (let k = 0; k <= 6; k++) pts.push(PR(lerp(0.0, -0.4, k / 6), 1.015 + 0.012 * k / 6));
  mb.sweep(pts, [[-0.006, -0.006], [0.006, -0.006], [0.003, 0.006], [-0.003, 0.006]], { closedProfile: true, hard: true });
}
// regioni dell'atlas 2048x1024 (u0, v0, u1, v1)
const CAT = {
  plate: [0.002, 0.002, 0.248, 0.164],
  fiat: [0.252, 0.002, 0.373, 0.164],
  model127: [0.377, 0.002, 0.498, 0.164],
};
function carDecals(mb) {
  const dq = (reg, zc, y0, w, h, rear, lift) => {
    const P = (z, y) => { const x = rear ? carTopX(z, y, true) - lift : lift; return [x, y, z]; };
    const s = rear ? 1 : -1, a = P(zc - s * w / 2, y0), b = P(zc + s * w / 2, y0), c = P(zc + s * w / 2, y0 + h), d = P(zc - s * w / 2, y0 + h);
    mb.quad(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2], reg[0], reg[3], reg[2], reg[1]);
  };
  mb.mat(CM.DECAL).color(1, 1, 1);
  // targa posteriore nera 1926S3-NA
  dq(CAT.plate, 0, 0.652, 0.38, 0.115, true, 0.006);
  // targa anteriore nera 1926S3-NA sospesa sotto il paraurti bianco (come foto)
  dq(CAT.plate, 0, 0.328, 0.34, 0.095, false, 1.872);
  mb.mat(CM.PLASTIC).color(0.015, 0.015, 0.018);
  mb.rbox(1.864, 0.376, 0, 0.014, 0.102, 0.352, 0.004, 2);
  // badge posteriori FIAT e 127
  mb.mat(CM.DECAL, 1).color(1, 1, 1);
  dq(CAT.fiat, -0.39, 0.922, 0.145, 0.048, true, 0.003);
  dq(CAT.model127, 0.37, 0.922, 0.155, 0.048, true, 0.003);
  mb.mat(CM.PLASTIC).color(0.02, 0.02, 0.02);
  const lk = [carTopX(0.33, 0.7, true) - 0.006, 0.7, 0.33];
  mb.rbox(lk[0], lk[1], lk[2], 0.014, 0.036, 0.11, 0.006, 2);
}
// ---------- atlas 2048x1024 della livrea Fiat 127 Napoli 3° Scudetto 1926 ----------
// Layout UV (W=2048, H=1024):
//   [0..512,     0..170]   : Targa nera italiana "1926S3·NA"
//   [512..768,   0..170]   : Badge classico FIAT
//   [768..1024,  0..170]   : Badge posteriore 127
//   [1024..2048, 0..512]   : Scudetto tricolore oro con "3" nero (per cofano bianco)
//   [0..1024,    512..1024]: Fiancata ("FORZA NAPOLI" + "UN GIORNO ALL'IMPROVVISO..." + "9" + prese d'aria)
//   [1024..1536, 512..1024]: Parafango anteriore (Maschera di Pulcinella nera + pennellata gialla)
//   [1536..2048, 512..1024]: Muso anteriore ("1926" bianco dipinto a mano)
function carAtlas() {
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  // 1) Targa nera italiana storica "1926S3·NA"
  g.fillStyle = '#0f1014'; g.fillRect(0, 0, 512, 170);
  g.strokeStyle = '#e5e7eb'; g.lineWidth = 5; g.strokeRect(10, 10, 492, 150);
  g.fillStyle = '#f2f4f8'; g.font = 'bold 82px "Arial Narrow","Helvetica Neue",Arial,sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('1926S3·NA', 256, 92);

  // 2) Badge FIAT classico (4 rombi blu con lettere argento)
  for (let i = 0; i < 4; i++) {
    const x = 524 + i * 58;
    g.fillStyle = '#12307a';
    g.beginPath(); g.moveTo(x + 12, 22); g.lineTo(x + 56, 22); g.lineTo(x + 44, 146); g.lineTo(x, 146); g.closePath(); g.fill();
    g.fillStyle = '#eef2f7'; g.font = 'bold 74px Arial,sans-serif';
    g.fillText('FIAT'[i], x + 28, 90);
  }

  // 3) Badge posteriore "127"
  g.fillStyle = '#111620'; g.fillRect(782, 28, 228, 114);
  g.strokeStyle = '#dce2ea'; g.lineWidth = 5; g.strokeRect(786, 32, 220, 106);
  g.fillStyle = '#f0f4fa'; g.font = 'italic bold 82px Arial,sans-serif';
  g.fillText('127', 896, 90);

  // 4) Scudetto tricolore del 3° Scudetto sul cofano [1024..2048, 0..512]
  //    In mat_car.wgsl: u va da destra (0.5) a sinistra (1.0), v va da dietro (0.0) a davanti (0.5)
  //    quindi la punta dello scudo guarda in BASSO (+v = davanti al muso, come nella foto!)
  g.save();
  g.translate(1536, 256);
  const shieldPath = (sx, sy) => {
    g.beginPath();
    g.moveTo(0, -198 * sy);
    g.bezierCurveTo(95 * sx, -198 * sy, 188 * sx, -214 * sy, 232 * sx, -192 * sy);
    g.bezierCurveTo(230 * sx, 25 * sy, 170 * sx, 140 * sy, 0, 212 * sy);
    g.bezierCurveTo(-170 * sx, 140 * sy, -230 * sx, 25 * sy, -232 * sx, -192 * sy);
    g.bezierCurveTo(-188 * sx, -214 * sy, -95 * sx, -198 * sy, 0, -198 * sy);
    g.closePath();
  };
  // Bordo oro/giallo esterno
  shieldPath(1.06, 1.05);
  g.fillStyle = '#e5b81a'; g.fill();
  g.lineWidth = 10; g.strokeStyle = '#cfa010'; g.stroke();
  // Interno tricolore (Verde a sinistra guardando da davanti -> lato +X qui perché u=0.5 è z=-0.46)
  // Verifichiamo l'orientamento dalla foto: guardando il cofano da davanti, VERDE è a destra dell'auto (z > 0), ROSSO è a sinistra (z < 0).
  // Con u = 0.5 + 0.5 * ((lp.z + 0.46) / 0.92), z < 0 -> x < 1536 (sinistra canvas = ROSSO), z > 0 -> x > 1536 (destra canvas = VERDE).
  // In più, nella foto guardando da davanti, il "3" è orientato per chi guarda il muso (testa del 3 verso il parabrezza, base verso il paraurti, apertura del 3 verso il verde!).
  g.save();
  shieldPath(0.95, 0.94);
  g.clip();
  g.fillStyle = '#d41b24'; g.fillRect(-260, -240, 174, 480);   // Rosso (lato guida, z < 0)
  g.fillStyle = '#f8f9fb'; g.fillRect(-86, -240, 172, 480);    // Bianco centro
  g.fillStyle = '#179b44'; g.fillRect(86, -240, 174, 480);     // Verde (lato passeggero, z > 0)
  g.restore();
  // Numero "3" nero spesso al centro dello Scudetto (specchiato orizzontalmente per risultare dritto guardando da davanti/dall'alto)
  g.save();
  g.scale(-1, 1);
  g.fillStyle = '#101216';
  g.strokeStyle = '#101216';
  g.lineWidth = 10;
  g.font = '900 310px "Impact","Arial Black",Arial,sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('3', 0, 14);
  g.strokeText('3', 0, 14);
  g.restore();
  g.restore();

  // 5) Livrea Fiancata [0..1024, 512..1024] — sfondo trasparente (compositing diretto sull'azzurro Napoli!)
  //    u: 0 = davanti (x = +0.78), 1 = dietro (x = -1.56) -> testo da sinistra a destra su ENTRAMBI i lati!
  //    v: 0 (y=512) = alto (lp.y = 0.92), 1 (y=1024) = basso (lp.y = 0.24)
  g.save();
  g.translate(0, 512);
  // "FORZA NAPOLI" scritto a mano in bianco grande lungo porta e fiancata posteriore
  g.fillStyle = '#f6f8fc';
  g.strokeStyle = '#f6f8fc';
  g.lineWidth = 4;
  g.lineJoin = 'round';
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  // Effetto pennellata a mano: lettere leggermente irregolari e strette, proprio come nella foto
  g.save();
  g.scale(0.84, 1.32);
  g.font = 'bold 148px "Marker Felt","Comic Sans MS","Trebuchet MS",Arial,sans-serif';
  g.fillText('FORZA NAPOLI', 36, 175);
  g.strokeText('FORZA NAPOLI', 36, 175);
  g.restore();
  // Piccolo "9" bianco sul passaruota/fiancata posteriore dietro NAPOLI
  g.save();
  g.scale(0.82, 1.25);
  g.font = 'bold 124px "Marker Felt","Comic Sans MS",Arial,sans-serif';
  g.fillText('9', 1110, 222);
  g.restore();
  // Griglietta di sfogo bianca sul montante C posteriore (come Fiat 127 nella foto)
  g.fillStyle = '#eef2f6';
  g.fillRect(892, 68, 72, 62);
  g.fillStyle = '#1b62b8';
  for (let i = 0; i < 6; i++) g.fillRect(898, 74 + i * 9.5, 60, 4);
  // Fascia inferiore: "UN GIORNO ALL'IMPROVVISO..." lungo la minigonna sotto il fascione bianco
  g.save();
  g.scale(0.92, 1.15);
  g.fillStyle = '#f3f6fb';
  g.font = 'bold 48px "Marker Felt","Comic Sans MS","Trebuchet MS",Arial,sans-serif';
  g.fillText("UN GIORNO ALL'IMPROVVISO...", 38, 372);
  g.restore();
  g.restore();

  // 6) Parafango anteriore [1024..1536, 512..1024]: Maschera di Pulcinella nera + pennellata gialla sopra
  //    u: 0 (x=1024) = davanti (lp.x = 1.76), 1 (x=1536) = dietro (lp.x = 1.06)
  //    v: 0 (y=512) = alto (lp.y = 0.92), 1 (y=1024) = basso (lp.y = 0.50)
  g.save();
  g.translate(1024, 512);
  // Pennellata gialla vibrante in alto (corona/cappello di Pulcinella sulla fascia bianca)
  g.save();
  g.translate(230, 142);
  g.rotate(-0.18);
  g.fillStyle = '#f5ca14';
  g.beginPath();
  g.moveTo(-148, -26);
  g.quadraticCurveTo(-20, -48, 152, -14);
  g.quadraticCurveTo(166, 18, 136, 38);
  g.quadraticCurveTo(10, 14, -142, 42);
  g.quadraticCurveTo(-168, 10, -148, -26);
  g.closePath();
  g.fill();
  // Tratti frastagliati pennello
  for (let i = -5; i <= 5; i++) {
    g.fillRect(i * 26 - 8, -32 + (i & 1) * 7, 18, 66);
  }
  g.restore();
  // Maschera nera di Pulcinella inclinata lungo il parafango
  g.save();
  g.translate(245, 290);
  g.rotate(-0.24);
  g.fillStyle = '#0e1014';
  g.beginPath();
  g.moveTo(-145, -18);
  g.bezierCurveTo(-132, -88, -38, -92, -6, -34);
  g.bezierCurveTo(28, -94, 134, -84, 152, -10);
  g.bezierCurveTo(164, 58, 92, 108, 34, 72);
  g.bezierCurveTo(8, 56, -8, 56, -32, 74);
  g.bezierCurveTo(-96, 114, -162, 62, -145, -18);
  g.closePath();
  g.fill();
  // Fori occhi della maschera (trasparenti così lascia vedere l'azzurro/bianco sotto!)
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.ellipse(-66, 2, 34, 24, -0.18, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(68, 4, 34, 24, 0.16, 0, TAU); g.fill();
  g.restore();
  g.restore();

  // 7) Muso anteriore "1926" bianco dipinto a mano [1536..2048, 512..1024]
  //    Guardando il muso da davanti: +z è a sinistra, -z è a destra -> disegniamo specchiato o invertiamo u in shader!
  g.save();
  g.translate(1536, 512);
  g.fillStyle = '#f5f8fc';
  g.strokeStyle = '#f5f8fc';
  g.lineWidth = 10;
  g.lineJoin = 'round';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.scale(0.95, 1.38);
  g.font = 'bold 205px "Marker Felt","Comic Sans MS","Trebuchet MS",Arial,sans-serif';
  g.fillText('1926', 270, 195);
  g.strokeText('1926', 270, 195);
  g.restore();

  const im = g.getImageData(0, 0, W, H);
  const tex = mkTex(W, H, 'rgba8unorm-srgb', TU.RT | TU.TB | TU.CD, { mipLevelCount: 7 });
  G.dev.queue.writeTexture({ texture: tex }, im.data, { bytesPerRow: W * 4 }, [W, H]);
  genMips(tex, 'rgba8unorm-srgb');
  return tex;
}
// ---------- ruote: cerchi in acciaio BIANCHI + coppetta centrale AZZURRO NAPOLI ----------
function carBuildWheel(mb, mbBlur) {
  mb.push(m4rotY(m4(), -PI / 2));
  mb.push(m4translate(m4(), -0.015, 0, 0));
  const R = CAR.wheelR, seg = 72;
  mb.mat(CM.TIRE, 255).color(0.02, 0.02, 0.021);
  mb.lathe([[-0.058, 0.168], [-0.066, 0.18], [-0.0735, 0.205], [-0.074, 0.228], [-0.071, 0.25], [-0.066, 0.264, 0.5, 1]], seg);
  mb.lathe([[0.066, 0.264, 0.5, -1], [0.071, 0.25], [0.074, 0.228], [0.0735, 0.205], [0.066, 0.18], [0.058, 0.168]], seg);
  mb.mat(CM.TIRE, 0);
  const tread = [[-0.066, 0.264, 0.5, 1], [-0.061, 0.2745], [-0.052, 0.2795]];
  const groove = (x) => { tread.push([x - 0.0045, R], [x - 0.0036, R - 0.0065], [x + 0.0036, R - 0.0065], [x + 0.0045, R]); };
  tread.push([-0.041, R]); groove(-0.033); groove(-0.011); groove(0.011); groove(0.033); tread.push([0.041, R]);
  tread.push([0.052, 0.2795], [0.061, 0.2745], [0.066, 0.264, 0.5, -1]);
  mb.lathe(tread, seg);
  // bordo del cerchio verniciato bianco
  mb.mat(CM.GLOSS).color(0.84, 0.86, 0.88);
  mb.lathe([[0.058, 0.168], [0.062, 0.171], [0.064, 0.168], [0.062, 0.164], [0.04, 0.16], [0.03, 0.13], [0.03, 0.0]], 40);
  mb.mat(CM.STEEL, 1).color(0.035, 0.035, 0.038);
  mb.lathe([[-0.02, 0.0], [-0.02, 0.1], [-0.05, 0.158], [-0.06, 0.166], [-0.058, 0.168]], 32);
  // disco cerchio BIANCO con 8 fori tondi classici Fiat 127 e coppetta azzurra al centro (in mat_car.wgsl)
  mb.mat(CM.HUBCAP).color(0.86, 0.87, 0.89);
  const NS = 8, prof = r => { const t = r / 0.166; return 0.066 - 0.024 * t * t + 0.016 * (1 - smooth(0.048, 0.062, r)) + 0.008 * smooth(0.135, 0.165, r); };
  mb.patch((u, v, o) => { const a = u * TAU, r = v * 0.1665; o[0] = prof(r); o[1] = r * Math.cos(a); o[2] = r * Math.sin(a); }, 0, 1.003, 0.0, 1, {
    nu: 180, nv: 28, flip: true, rim: 0.016, rimMat: m => m.mat(CM.STEEL, 1).color(0.03, 0.03, 0.03),
    uv: (u, v, P) => { _cuv[0] = u; _cuv[1] = v; return _cuv; },
    field: (u, v, P) => { const r = v * 0.1665, da = (u * NS - Math.round(u * NS)) / NS * TAU, t = r * Math.sin(da), q = r - 0.114; return -(Math.hypot(t, q) - 0.0115); }
  });
  const bm = mbBlur || mb; if (mbBlur) { bm.push(m4rotY(m4(), -PI / 2)); bm.push(m4translate(m4(), -0.015, 0, 0)); }
  bm.mat(CM.HUBCAP, 1).color(0.86, 0.87, 0.89);
  bm.patch((u, v, o) => { const a = u * TAU, r = 0.036 + v * 0.127; o[0] = prof(r) + 0.002; o[1] = r * Math.cos(a); o[2] = r * Math.sin(a); }, 0, 1, 0, 1, { nu: 56, nv: 8, flip: true, uv: (u, v, P) => { _cuv[0] = u; _cuv[1] = v; return _cuv; } });
  if (mbBlur) { bm.pop(); bm.pop(); }
  mb.pop(); mb.pop();
}
// ---------- volante sportivo ----------
function carBuildSteer(mb) {
  mb.mat(CM.INTERIOR, 3).color(0.035, 0.035, 0.038);
  const ring = []; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; ring.push([0, 0.185 * Math.cos(a), 0.185 * Math.sin(a)]); }
  mb.tube(ring, 0.0135, 10, { closed: true, up: [1, 0, 0] });
  mb.rbox(-0.035, -0.01, 0, 0.05, 0.1, 0.16, 0.025, 3);
  mb.rbox(-0.02, 0.0, 0.1, 0.022, 0.03, 0.17, 0.008, 1); mb.rbox(-0.02, 0.0, -0.1, 0.022, 0.03, 0.17, 0.008, 1); mb.rbox(-0.02, -0.1, 0, 0.022, 0.17, 0.035, 0.008, 1);
  m4translate(CAR._t, 0.345, 0.885, -0.36); m4rotZ(CAR._t2, 158 * PI / 180); m4mul(CAR.steerMat, CAR._t, CAR._t2);
}
