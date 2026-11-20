// Pose fisse per l'ispezione della livrea Fiat 127 Napoli 1926 e del circuito del Lungomare di Napoli (tasti 1–6).
// tipo 'carro': vettura ferma in (s, d, direzione), camera libera in coordinate vettura [x avanti, y alto, z destra].
// tipo 'volta': pilota automatico live fino all'istante t (s) con la telecamera cam.
const POSES = [
  { nome: 'fiat127-anteriore-34', tipo: 'carro', s: 15, d: 0.0, yaw: 0.52, olho: [4.7, 1.32, -3.1], alvo: [0.1, 0.72, 0], fov: 0.5 },
  { nome: 'fiat127-posteriore-34', tipo: 'carro', s: 15, d: 0.0, yaw: -0.45, olho: [-4.8, 1.65, 3.2], alvo: [-0.1, 0.78, 0], fov: 0.5 },
  { nome: 'fiat127-laterale-livrea', tipo: 'carro', s: 15, d: 0.0, yaw: 0.0, olho: [0.7, 0.72, -5.0], alvo: [0.05, 0.78, 0], fov: 0.58 },
  { nome: 'rotonda-diaz-inseguimento', tipo: 'volta', t: 7.5, cam: 0 },
  { nome: 'tv-lungomare-vesuvio', tipo: 'volta', t: 14.5, cam: 2 },
  { nome: 'cofano-scudetto-3', tipo: 'volta', t: 22.0, cam: 1 },
];
function poseApply(i) {
  const P = POSES[i];
  GS.fxOn = true;
  if (P.tipo === 'carro') {
    gameRestart(); vehicleReset(P.s, P.d, P.yaw); GS.frozen = true; GS.freeCam = true; GS.alpha = 1; gamePose();
    const B = GS.body, o = P.olho, a = P.alvo, q = CAMQ;
    q[0] = B[0] * o[0] + B[4] * o[1] + B[8] * o[2] + B[12]; q[1] = B[1] * o[0] + B[5] * o[1] + B[9] * o[2] + B[13]; q[2] = B[2] * o[0] + B[6] * o[1] + B[10] * o[2] + B[14];
    q[3] = B[0] * a[0] + B[4] * a[1] + B[8] * a[2] + B[12]; q[4] = B[1] * a[0] + B[5] * a[1] + B[9] * a[2] + B[13]; q[5] = B[2] * a[0] + B[6] * a[1] + B[10] * a[2] + B[14];
    q[6] = P.fov; q[7] = 0; setCameraQ(); GS.cut = true; R.casc.focusOn = false;
    RT[2] = 1 / 60; for (let k = 0; k < 60; k++) { gameTick(true); renderFrame(); }
  } else {
    GS.frozen = false; GS.freeCam = false; const was = GS.replayOn; GS.replayOn = true; gameRestart(); GS.cam = P.cam; GS.cut = true;
    const n = Math.round(P.t * 60), warm = 45; RT[2] = 1 / 60;
    for (let k = 0; k < n; k++) { gameTick(true); GS.cam = P.cam; if (k >= n - warm) renderFrame(); }
    GS.replayOn = was;
  }
}
