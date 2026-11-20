// 6 pose fisse di ispezione per il Circuito di Posillipo (tasti 1–6)
const POSES = [
  { nome: 'Partenza Viale Virgilio', s: 18, d: 0.0, cam: [-11.5, 2.3, -4.4], aim: [26, 1.3, 0.2], fov: 0.62 },
  { nome: 'Belvedere Parco Virgiliano & Nisida', s: 560, d: -1.0, cam: [-15.0, 4.4, -7.2], aim: [45, -2.5, 16.0], fov: 0.68 },
  { nome: 'Discesa Coroglio sul Golfo', s: 1240, d: 0.8, cam: [-12.0, 3.2, -5.5], aim: [38, -2.0, 5.0], fov: 0.65 },
  { nome: 'Mura di Tufo Via Boccaccio', s: 2560, d: -0.5, cam: [-10.0, 2.1, 3.8], aim: [24, 1.6, -1.5], fov: 0.62 },
  { nome: 'Crinale Via Manzoni', s: 3680, d: 0.4, cam: [-13.5, 3.0, -5.0], aim: [32, 1.2, 1.0], fov: 0.64 },
  { nome: 'Tre quarti · Monoposto ' + ERA.carName, s: 24, d: -0.5, cam: [4.2, 1.35, -3.8], aim: [0.0, 0.55, 0.0], fov: 0.46 },
];

function poseApply(i) {
  const p = POSES[clamp(i | 0, 0, POSES.length - 1)];
  GS.frozen = true; GS.freeCam = true;
  vehicleReset(p.s, p.d, 0);
  GS.alpha = 1; gamePose();
  const c = Math.cos(GS.yaw), s = Math.sin(GS.yaw);
  const wx = o => GS.cx + c * o[0] - s * o[2], wz = o => GS.cz + s * o[0] + c * o[2];
  const ex = wx(p.cam), ez = wz(p.cam), ey = Math.max(GS.cy + p.cam[1], hfAt(ex, ez) + 0.45);
  setCamera(ex, ey, ez, wx(p.aim), GS.cy + p.aim[1], wz(p.aim), p.fov);
  R.cam.first = true;
  renderFrame(true);
}
