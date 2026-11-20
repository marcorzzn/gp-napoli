// Vetture storiche e moderne del Circuito di Posillipo (1937 Alfa Romeo 12C-36, 1955 Lancia D50 Ascari, 2026 Ferrari SF-26)
// Costruzione procedurale pura su MeshBuilder + atlante livrea Canvas 2D (zero dipendenze esterne).

const CAR_SPECS = {
  '1937': {
    wheelbase: 2.80, trackF: 1.42, trackR: 1.40, wheelR: 0.365, tireW: 0.165,
    front: 2.12, rear: 1.92, halfW: 0.80,
    steerPos: [-0.08, 0.74, 0], steerTilt: 0.48,
    camEyeX: -0.34, camEyeY: 1.08, camChaseDist: 5.4, camChaseH: 1.56,
  },
  '1955': {
    wheelbase: 2.28, trackF: 1.32, trackR: 1.32, wheelR: 0.345, tireW: 0.185,
    front: 1.88, rear: 1.68, halfW: 0.78,
    steerPos: [-0.05, 0.68, 0], steerTilt: 0.45,
    camEyeX: -0.30, camEyeY: 1.00, camChaseDist: 5.0, camChaseH: 1.48,
  },
  '2026': {
    wheelbase: 3.40, trackF: 1.68, trackR: 1.66, wheelR: 0.360, tireW: 0.345,
    front: 2.58, rear: 2.16, halfW: 0.99,
    steerPos: [0.18, 0.56, 0], steerTilt: 0.32,
    camEyeX: -0.14, camEyeY: 0.94, camChaseDist: 5.9, camChaseH: 1.52,
  },
};

const CAR_SPEC = CAR_SPECS[ERA.id] || CAR_SPECS['1955'];

function _carMatY(mb, x0, y0, z0, x1, y1, z1, r, seg) {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return;
  mb.tube([[x0, y0, z0], [x1, y1, z1]], r, seg || 8, { up: Math.abs(dy / len) > 0.9 ? [1, 0, 0] : [0, 1, 0] });
}

// Fusoliera liscia a sezione ellittica variabile lungo X: segs = [[x, yc, rxZ, ryY], ...]
function _carLoft(mb, segs, nRing) {
  const base = mb.nv, n = segs.length;
  for (let j = 0; j < n; j++) {
    const s = segs[j], pa = segs[Math.max(0, j - 1)], pb = segs[Math.min(n - 1, j + 1)];
    const dx = (pb[0] - pa[0]) || 1e-4;
    const drZ = (pb[2] - pa[2]) / dx, drY = (pb[3] - pa[3]) / dx, dyC = (pb[1] - pa[1]) / dx;
    for (let i = 0; i <= nRing; i++) {
      const a = (i / nRing) * TAU, c = Math.cos(a), sn = Math.sin(a);
      const px = s[0], py = s[1] + sn * s[3], pz = c * s[2];
      // Normale analitica approssimata dell'ellisse variabile
      const nz = c / Math.max(s[2], 0.02), ny = sn / Math.max(s[3], 0.02);
      const nx = -(ny * (dyC + sn * drY) + nz * (c * drZ));
      mb.v(px, py, pz, nx, ny, nz, j / (n - 1), i / nRing);
    }
  }
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < nRing; i++) {
      const a = base + j * (nRing + 1) + i;
      mb.quadI(a, a + nRing + 1, a + nRing + 2, a + 1);
    }
  }
}

function _carAddDriver(mb, gl, cx, cy, era) {
  const is2026 = era === '2026';
  const is1955 = era === '1955';
  // Sedile
  mb.mat(8, 0).color(is2026 ? 0.08 : is1955 ? 0.56 : 0.34, is2026 ? 0.08 : is1955 ? 0.28 : 0.16, is2026 ? 0.09 : is1955 ? 0.14 : 0.08);
  mb.rbox(cx - 0.14, cy + 0.14, 0, 0.18, 0.38, 0.36, 0.05, 2);
  mb.rbox(cx + 0.05, cy - 0.02, 0, 0.36, 0.12, 0.36, 0.04, 2);
  // Tuta / busto pilota
  if (is2026) mb.mat(8, 1).color(0.76, 0.04, 0.03);
  else if (is1955) mb.mat(8, 1).color(0.18, 0.36, 0.62); // polo celeste portafortuna Ascari
  else mb.mat(8, 1).color(0.68, 0.64, 0.56);             // tuta chiara anni '30
  mb.rbox(cx - 0.03, cy + 0.22, 0, 0.24, 0.32, 0.34, 0.08, 3);
  // Braccia verso il volante
  _carMatY(mb, cx + 0.02, cy + 0.29, -0.15, cx + 0.34, cy + 0.28, -0.12, 0.048, 8);
  _carMatY(mb, cx + 0.02, cy + 0.29, 0.15, cx + 0.34, cy + 0.28, 0.12, 0.048, 8);
  // Casco
  if (is2026) mb.mat(17, 0).color(0.78, 0.05, 0.04);
  else if (is1955) mb.mat(17, 0).color(0.14, 0.44, 0.80); // casco azzurro Ascari
  else mb.mat(8, 0).color(0.28, 0.17, 0.10);              // casco in cuoio Nuvolari
  mb.rbox(cx - 0.05, cy + 0.48, 0, 0.24, 0.23, 0.21, 0.095, 4);
  // Visiera / occhialoni
  mb.mat(2, 1).color(0.06, 0.07, 0.09);
  mb.rbox(cx + 0.06, cy + 0.49, 0, 0.05, 0.075, 0.17, 0.02, 2);
  if (!is2026) {
    // Parabrezza trasparente d'epoca
    gl.mat(1, 0).color(0.82, 0.88, 0.92, 0.42);
    const wx = cx + 0.34, wy = cy + 0.35;
    gl.quad(wx, wy, -0.22, wx + 0.08, wy, -0.18, wx + 0.02, wy + 0.16, -0.16, wx - 0.06, wy + 0.16, -0.20, 0, 0, 1, 1);
    gl.quad(wx + 0.08, wy, -0.18, wx + 0.11, wy, 0.0, wx + 0.05, wy + 0.16, 0.0, wx + 0.02, wy + 0.16, -0.16, 0, 0, 1, 1);
    gl.quad(wx + 0.11, wy, 0.0, wx + 0.08, wy, 0.18, wx + 0.02, wy + 0.16, 0.16, wx + 0.05, wy + 0.16, 0.0, 0, 0, 1, 1);
    gl.quad(wx + 0.08, wy, 0.18, wx, wy, 0.22, wx - 0.06, wy + 0.16, 0.20, wx + 0.02, wy + 0.16, 0.16, 0, 0, 1, 1);
  } else {
    // Visiera fumé casco F1
    gl.mat(1, 0).color(0.18, 0.22, 0.26, 0.55);
    gl.quad(cx + 0.08, cy + 0.46, -0.08, cx + 0.08, cy + 0.46, 0.08, cx + 0.06, cy + 0.53, 0.08, cx + 0.06, cy + 0.53, -0.08, 0, 0, 1, 1);
  }
}

// =========================================================================
// EPOCA 1: 1937 ALFA ROMEO 12C-36 (#32 — Tazio Nuvolari / Nino Farina)
// =========================================================================
function _buildAlfa1937(mb, gl) {
  const red = [0.46, 0.028, 0.024]; // Rosso Alfa Scuderia Ferrari 1937
  // Fusoliera a sigaro lunga e affusolata
  mb.mat(1, 0).color(red[0], red[1], red[2]);
  _carLoft(mb, [
    [-1.92, 0.58, 0.05, 0.05],
    [-1.78, 0.58, 0.18, 0.18],
    [-1.42, 0.57, 0.30, 0.30],
    [-0.90, 0.56, 0.38, 0.36],
    [-0.30, 0.54, 0.42, 0.34],
    [0.35, 0.54, 0.40, 0.35],
    [1.05, 0.53, 0.35, 0.34],
    [1.62, 0.52, 0.29, 0.32],
    [1.94, 0.51, 0.22, 0.29],
    [2.02, 0.51, 0.06, 0.22],
  ], 24);
  // Cofano superiore con nervatura centrale e vasca abitacolo scura
  mb.mat(2, 0).color(0.06, 0.06, 0.06);
  mb.rbox(-0.34, 0.72, 0, 0.78, 0.14, 0.48, 0.04, 2);
  // Sottoscocca e telaio longheroni
  mb.mat(13, 0).color(0.08, 0.08, 0.09);
  mb.box(0.05, 0.26, 0, 3.35, 0.10, 0.52);

  // Scudetto radiatore verticale cromato Alfa Romeo al muso
  mb.mat(7, 0).color(0.92, 0.93, 0.95);
  mb.rbox(2.01, 0.51, 0, 0.07, 0.54, 0.36, 0.03, 3);
  mb.mat(16, 0).color(0.18, 0.18, 0.20);
  mb.box(2.04, 0.51, 0, 0.03, 0.46, 0.28);
  // Cornice scudetto triangolare cromata
  mb.mat(7, 0).color(0.94, 0.94, 0.96);
  mb.box(2.055, 0.52, 0, 0.015, 0.46, 0.025);

  // Feritoie sfogo aria lungo il lungo cofano V12
  mb.mat(2, 0).color(0.04, 0.04, 0.04);
  for (let i = 0; i < 12; i++) {
    const x = 0.45 + i * 0.105;
    mb.box(x, 0.62, -0.37, 0.022, 0.16, 0.02);
    mb.box(x, 0.62, 0.37, 0.022, 0.16, 0.02);
  }
  // Cinghia in cuoio ferma-cofano
  mb.mat(8, 0).color(0.28, 0.15, 0.07);
  mb.rbox(0.88, 0.56, 0, 0.05, 0.71, 0.74, 0.015, 2);

  // Doppio tubo di scarico esterno cromato sul lato sinistro (icona 12C-36)
  mb.mat(7, 1).color(0.76, 0.72, 0.66);
  mb.tube([[1.48, 0.52, -0.34], [1.10, 0.48, -0.44], [0.20, 0.42, -0.46], [-0.95, 0.40, -0.44], [-1.72, 0.44, -0.26]], 0.036, 10);
  mb.tube([[1.32, 0.44, -0.34], [0.96, 0.41, -0.44], [0.15, 0.36, -0.46], [-0.95, 0.35, -0.44], [-1.66, 0.39, -0.28]], 0.032, 10);

  // Sospensioni scoperte (bracci oscillanti + balestre + tamburi freno)
  mb.mat(6, 0).color(0.28, 0.29, 0.31);
  for (const s of [-1, 1]) {
    _carMatY(mb, 1.40, 0.36, s * 0.24, 1.40, 0.36, s * 0.66, 0.024, 8);
    _carMatY(mb, 1.24, 0.44, s * 0.24, 1.40, 0.42, s * 0.64, 0.018, 8);
    _carMatY(mb, 1.56, 0.32, s * 0.22, 1.40, 0.32, s * 0.64, 0.018, 8);
    _carMatY(mb, -1.40, 0.36, s * 0.24, -1.40, 0.36, s * 0.65, 0.026, 8);
    _carMatY(mb, -1.20, 0.42, s * 0.26, -1.40, 0.40, s * 0.64, 0.020, 8);
  }
  // Carenatura poggiatesta
  mb.mat(1, 0).color(red[0], red[1], red[2]);
  mb.rbox(-0.96, 0.80, 0, 0.68, 0.22, 0.24, 0.09, 3);

  // Pilota & Parabrezza
  _carAddDriver(mb, gl, -0.44, 0.48, '1937');

  // Decalcomanie #32 su muso e fianchi coda (u: 0..0.5 numero, 0.5..1 scudetto)
  mb.mat(12, 1).color(1, 1, 1);
  // Numero superiore sul cofano
  mb.quad(1.10, 0.885, -0.20, 1.56, 0.885, -0.20, 1.56, 0.885, 0.20, 1.10, 0.885, 0.20, 0.02, 0.02, 0.48, 0.98);
  // Numero fiancata sinistra (-Z, normale -Z)
  mb.quad(-0.90, 0.42, -0.395, -1.42, 0.42, -0.395, -1.42, 0.72, -0.395, -0.90, 0.72, -0.395, 0.02, 0.98, 0.48, 0.02);
  // Numero fiancata destra (+Z, normale +Z)
  mb.quad(-1.42, 0.42, 0.395, -0.90, 0.42, 0.395, -0.90, 0.72, 0.395, -1.42, 0.72, 0.395, 0.02, 0.98, 0.48, 0.02);
  // Stemma Alfa su cofano anteriore
  mb.quad(1.66, 0.865, -0.12, 1.88, 0.865, -0.12, 1.88, 0.865, 0.12, 1.66, 0.865, 0.12, 0.52, 0.02, 0.98, 0.98);
}

// =========================================================================
// EPOCA 2: 1955 LANCIA D50 (#6 — Alberto Ascari, Serbatoi a Siluro)
// =========================================================================
function _buildLancia1955(mb, gl) {
  const red = [0.68, 0.048, 0.026]; // Rosso Corsa Lancia 1955
  // Fusoliera centrale compatta e muscolosa
  mb.mat(1, 0).color(red[0], red[1], red[2]);
  _carLoft(mb, [
    [-1.66, 0.54, 0.08, 0.08],
    [-1.50, 0.55, 0.24, 0.24],
    [-1.12, 0.55, 0.35, 0.32],
    [-0.55, 0.54, 0.40, 0.34],
    [0.05, 0.54, 0.41, 0.34],
    [0.72, 0.53, 0.37, 0.32],
    [1.35, 0.50, 0.31, 0.28],
    [1.72, 0.46, 0.24, 0.22],
    [1.84, 0.44, 0.12, 0.15],
  ], 24);
  // Presa d'aria ovale anteriore con rete cromata
  mb.mat(16, 0).color(0.45, 0.45, 0.46);
  mb.rbox(1.81, 0.42, 0, 0.06, 0.22, 0.40, 0.06, 3);
  mb.mat(7, 0).color(0.92, 0.92, 0.94);
  mb.rbox(1.83, 0.42, 0, 0.02, 0.24, 0.42, 0.06, 2);
  // Presa d'aria dinamica NACA sul cofano
  mb.mat(2, 0).color(0.05, 0.05, 0.05);
  mb.box(1.12, 0.82, 0, 0.18, 0.04, 0.18);

  // SERBATOI LATERALI A SILURO (icona progettuale Vittorio Jano della Lancia D50!)
  mb.mat(1, 0).color(red[0], red[1], red[2]);
  for (const s of [-1, 1]) {
    const zc = s * 0.57;
    mb.push(m4translate(m4(), 0, 0, zc));
    _carLoft(mb, [
      [-0.86, 0.36, 0.07, 0.08],
      [-0.72, 0.38, 0.145, 0.155],
      [-0.25, 0.40, 0.155, 0.165],
      [0.35, 0.40, 0.155, 0.165],
      [0.74, 0.38, 0.135, 0.145],
      [0.86, 0.36, 0.06, 0.08],
    ], 18);
    mb.pop();
    // Puntoni aerodinamici di fissaggio serbatoio-fusoliera
    mb.mat(7, 1).color(0.74, 0.75, 0.78);
    _carMatY(mb, 0.56, 0.46, s * 0.34, 0.56, 0.46, s * 0.46, 0.018, 8);
    _carMatY(mb, -0.52, 0.46, s * 0.34, -0.52, 0.46, s * 0.46, 0.018, 8);
    // Scarichi corti laterali V8 (4 collettori per lato che confluiscono sopra il siluro)
    mb.mat(7, 1).color(0.72, 0.68, 0.62);
    mb.tube([[0.76, 0.58, s * 0.36], [0.46, 0.56, s * 0.45], [-0.36, 0.55, s * 0.46], [-0.82, 0.55, s * 0.42]], 0.032, 10);
    mb.mat(1, 0).color(red[0], red[1], red[2]);
  }

  // Sottoscocca e sospensioni a quadrilatero
  mb.mat(13, 0).color(0.08, 0.08, 0.09);
  mb.box(0.05, 0.24, 0, 2.90, 0.09, 0.54);
  mb.mat(7, 1).color(0.75, 0.76, 0.78);
  for (const s of [-1, 1]) {
    _carMatY(mb, 1.14, 0.42, s * 0.24, 1.14, 0.42, s * 0.60, 0.018, 8);
    _carMatY(mb, 1.14, 0.27, s * 0.24, 1.14, 0.27, s * 0.60, 0.018, 8);
    _carMatY(mb, 1.32, 0.34, s * 0.22, 1.14, 0.34, s * 0.59, 0.014, 8);
    _carMatY(mb, -1.14, 0.35, s * 0.26, -1.14, 0.35, s * 0.60, 0.022, 8);
    _carMatY(mb, -0.96, 0.28, s * 0.26, -1.14, 0.28, s * 0.59, 0.016, 8);
  }
  // Carenatura poggiatesta & vasca abitacolo
  mb.mat(2, 0).color(0.06, 0.06, 0.06);
  mb.rbox(-0.28, 0.68, 0, 0.74, 0.14, 0.48, 0.04, 2);
  mb.mat(1, 0).color(red[0], red[1], red[2]);
  mb.rbox(-0.96, 0.78, 0, 0.62, 0.24, 0.26, 0.10, 3);

  // Pilota Alberto Ascari (#6) + parabrezza avvolgente
  _carAddDriver(mb, gl, -0.38, 0.44, '1955');

  // Decalcomanie #6 su muso e fianchi dei serbatoi a siluro + stemma Lancia
  mb.mat(12, 1).color(1, 1, 1);
  mb.quad(0.62, 0.875, -0.20, 1.06, 0.875, -0.20, 1.06, 0.875, 0.20, 0.62, 0.875, 0.20, 0.02, 0.02, 0.48, 0.98);
  // Fiancate siluro sinistro (-Z) e destro (+Z)
  mb.quad(0.28, 0.28, -0.735, -0.22, 0.28, -0.735, -0.22, 0.53, -0.735, 0.28, 0.53, -0.735, 0.02, 0.98, 0.48, 0.02);
  mb.quad(-0.22, 0.28, 0.735, 0.28, 0.28, 0.735, 0.28, 0.53, 0.735, -0.22, 0.53, 0.735, 0.02, 0.98, 0.48, 0.02);
  // Stemma Lancia sul muso
  mb.quad(1.42, 0.775, -0.10, 1.62, 0.775, -0.10, 1.62, 0.775, 0.10, 1.42, 0.775, 0.10, 0.52, 0.02, 0.98, 0.98);
}

// =========================================================================
// EPOCA 3: 2026 FERRARI SF-26 (#16 — Hyper-Tech F1, Halo, Active Aero)
// =========================================================================
function _buildFerrari2026(mb, gl) {
  const red = [0.78, 0.026, 0.020];    // Rosso Scuderia 2026
  const white = [0.94, 0.94, 0.96];    // Cofano motore bianco livrea SF-26
  const carbon = [0.07, 0.075, 0.085]; // Fibra di carbonio

  // Fondo Venturi in fibra di carbonio + diffusore posteriore
  mb.mat(2, 2).color(carbon[0], carbon[1], carbon[2]);
  mb.box(-0.22, 0.10, 0, 3.15, 0.045, 1.56);
  mb.box(-1.82, 0.18, 0, 0.52, 0.14, 1.06); // estrattore posteriore

  // Monoscocca e muso affilato Rosso Scuderia
  mb.mat(1, 0).color(red[0], red[1], red[2]);
  _carLoft(mb, [
    [-1.92, 0.34, 0.14, 0.16],
    [-1.45, 0.44, 0.28, 0.26],
    [-0.65, 0.46, 0.34, 0.28],
    [0.15, 0.45, 0.34, 0.27],
    [0.95, 0.42, 0.26, 0.22],
    [1.68, 0.34, 0.19, 0.15],
    [2.36, 0.22, 0.11, 0.08],
    [2.54, 0.19, 0.04, 0.05],
  ], 20);

  // Pance (Sidepods) scolpite con undercut aerodinamico
  for (const s of [-1, 1]) {
    mb.mat(1, 0).color(red[0], red[1], red[2]);
    mb.rbox(-0.34, 0.39, s * 0.56, 1.62, 0.34, 0.42, 0.09, 3);
    // Bocca radiatore scura
    mb.mat(2, 2).color(0.03, 0.03, 0.035);
    mb.box(0.46, 0.43, s * 0.56, 0.06, 0.16, 0.32);
    // Specchietto aerodinamico
    mb.mat(1, 0).color(red[0], red[1], red[2]);
    mb.rbox(0.38, 0.66, s * 0.56, 0.10, 0.06, 0.15, 0.02, 2);
    mb.mat(2, 2).color(carbon[0], carbon[1], carbon[2]);
    _carMatY(mb, 0.38, 0.55, s * 0.42, 0.38, 0.64, s * 0.54, 0.012, 6);
  }

  // Cofano motore superiore BIANCO + pinna di squalo (identità visiva SF-26)
  mb.mat(1, 1).color(white[0], white[1], white[2]);
  mb.rbox(-0.78, 0.69, 0, 1.38, 0.30, 0.38, 0.10, 3);
  mb.box(-1.35, 0.78, 0, 0.88, 0.24, 0.04); // shark fin bianca
  // Airscope triangolare sopra la testa del pilota
  mb.mat(2, 2).color(0.04, 0.04, 0.05);
  mb.box(-0.10, 0.82, 0, 0.06, 0.14, 0.18);
  // Telecamera T-Cam sul roll hoop
  mb.mat(2, 2).color(carbon[0], carbon[1], carbon[2]);
  mb.box(-0.18, 0.94, 0, 0.08, 0.06, 0.04);
  mb.box(-0.18, 0.97, 0, 0.06, 0.03, 0.26);

  // HALO in titanio / carbonio a protezione dell'abitacolo
  mb.mat(7, 2).color(0.18, 0.19, 0.21);
  mb.tube([
    [-0.22, 0.74, -0.24],
    [0.08, 0.76, -0.26],
    [0.36, 0.74, -0.16],
    [0.50, 0.72, 0.0],
    [0.36, 0.74, 0.16],
    [0.08, 0.76, 0.26],
    [-0.22, 0.74, 0.24],
  ], 0.026, 10);
  // Pilone centrale anteriore Halo
  _carMatY(mb, 0.50, 0.72, 0.0, 0.56, 0.54, 0.0, 0.024, 8);

  // Ala anteriore multi-elemento (carbonio + paratie laterali rosse)
  mb.mat(2, 2).color(carbon[0], carbon[1], carbon[2]);
  mb.box(2.38, 0.12, 0, 0.34, 0.028, 1.88);
  mb.mat(1, 0).color(red[0], red[1], red[2]);
  mb.box(2.26, 0.165, 0, 0.18, 0.024, 1.82);
  mb.box(2.18, 0.21, 0, 0.12, 0.022, 1.72);
  // Paratie laterali (endplates) ala anteriore
  for (const s of [-1, 1]) {
    mb.mat(1, 0).color(red[0], red[1], red[2]);
    mb.rbox(2.28, 0.22, s * 0.93, 0.44, 0.22, 0.03, 0.01, 2);
  }

  // Ala posteriore con flap superiore Active Aero (Z-Mode / X-Mode)
  mb.mat(2, 2).color(carbon[0], carbon[1], carbon[2]);
  mb.box(-2.00, 0.74, 0, 0.30, 0.032, 1.06); // mainplane
  mb.box(-2.06, 0.87, 0, 0.22, 0.028, 1.04); // flap attivo superiore
  // Piloni a collo di cigno ala posteriore + luce pioggia LED centrale
  _carMatY(mb, -1.78, 0.44, -0.09, -1.96, 0.74, -0.09, 0.018, 6);
  _carMatY(mb, -1.78, 0.44, 0.09, -1.96, 0.74, 0.09, 0.018, 6);
  mb.mat(9, 0).color(0.95, 0.06, 0.02);
  mb.box(-2.12, 0.32, 0, 0.04, 0.11, 0.06);
  for (const s of [-1, 1]) {
    mb.mat(1, 0).color(red[0], red[1], red[2]);
    mb.rbox(-1.98, 0.64, s * 0.54, 0.46, 0.58, 0.03, 0.012, 2);
  }

  // Bracci sospensione F1 in carbonio (push-rod / pull-rod)
  mb.mat(2, 2).color(carbon[0], carbon[1], carbon[2]);
  for (const s of [-1, 1]) {
    _carMatY(mb, 1.72, 0.42, s * 0.20, 1.70, 0.40, s * 0.72, 0.016, 6);
    _carMatY(mb, 1.72, 0.22, s * 0.20, 1.70, 0.24, s * 0.72, 0.016, 6);
    _carMatY(mb, 1.50, 0.32, s * 0.22, 1.70, 0.38, s * 0.70, 0.014, 6);
    _carMatY(mb, -1.68, 0.42, s * 0.20, -1.70, 0.40, s * 0.70, 0.018, 6);
    _carMatY(mb, -1.68, 0.22, s * 0.20, -1.70, 0.24, s * 0.70, 0.018, 6);
    _carMatY(mb, -1.48, 0.34, s * 0.22, -1.70, 0.38, s * 0.68, 0.014, 6);
  }

  // Pilota F1
  _carAddDriver(mb, gl, -0.10, 0.36, '2026');

  // Decalcomanie #16 su muso + logo HP blu e scudetto Ferrari su cofano bianco & pance
  mb.mat(12, 1).color(1, 1, 1);
  // Numero 16 sul muso superiore
  mb.quad(1.38, 0.52, -0.15, 1.78, 0.46, -0.15, 1.78, 0.46, 0.15, 1.38, 0.52, 0.15, 0.02, 0.02, 0.48, 0.98);
  // Logo HP + scudetto sui fianchi del cofano bianco
  mb.quad(-0.40, 0.56, -0.205, -1.16, 0.56, -0.205, -1.16, 0.84, -0.205, -0.40, 0.84, -0.205, 0.52, 0.98, 0.98, 0.02);
  mb.quad(-1.16, 0.56, 0.205, -0.40, 0.56, 0.205, -0.40, 0.84, 0.205, -1.16, 0.84, 0.205, 0.52, 0.98, 0.98, 0.02);
  // Numero 16 sulle pance laterali
  mb.quad(0.05, 0.28, -0.785, -0.48, 0.28, -0.785, -0.48, 0.52, -0.785, 0.05, 0.52, -0.785, 0.02, 0.98, 0.48, 0.02);
  mb.quad(-0.48, 0.28, 0.785, 0.05, 0.28, 0.785, 0.05, 0.52, 0.785, -0.48, 0.52, 0.785, 0.02, 0.98, 0.48, 0.02);
}

function carBuildBody(mb, gl) {
  if (ERA.id === '1937') _buildAlfa1937(mb, gl);
  else if (ERA.id === '1955') _buildLancia1955(mb, gl);
  else _buildFerrari2026(mb, gl);
}

// Costruzione ruota (asse Z = asse ruota; +Z = lato esterno)
function carBuildWheel(w, wb) {
  const Rw = CAR_SPEC.wheelR;
  const W = CAR_SPEC.tireW;
  const hw = W * 0.5;
  const rimR = ERA.id === '2026' ? Rw * 0.64 : Rw * 0.62;
  const is2026 = ERA.id === '2026';

  // Profilo pneumatico via lathe attorno all'asse X, poi ruotato di +90° attorno a Y (così asse ruota = Z!)
  w.push(m4rotY(m4(), PI / 2));
  w.mat(4, 0).color(0.05, 0.05, 0.055); // battistrada
  w.lathe([
    [-hw * 0.84, Rw * 0.96],
    [-hw * 0.74, Rw],
    [0, Rw * 1.005],
    [hw * 0.74, Rw],
    [hw * 0.84, Rw * 0.96],
  ], 32);
  // Spalle pneumatico (pa = 1 → spalla con banda rossa Pirelli in 2026 o incisioni vintage in 1937/1955)
  w.mat(4, 1).color(0.05, 0.05, 0.055);
  w.lathe([
    [-hw, rimR * 0.98],
    [-hw * 0.98, (rimR + Rw) * 0.5],
    [-hw * 0.84, Rw * 0.96],
  ], 32);
  w.lathe([
    [hw * 0.84, Rw * 0.96],
    [hw * 0.98, (rimR + Rw) * 0.5],
    [hw, rimR * 0.98],
  ], 32);
  // Canale cerchio + disco interno
  w.mat(5, 0).color(is2026 ? 0.14 : 0.78, is2026 ? 0.14 : 0.79, is2026 ? 0.16 : 0.81);
  w.lathe([
    [-hw * 0.82, rimR],
    [hw * 0.82, rimR],
    [hw * 0.86, rimR * 0.91],
    [hw * 0.74, rimR * 0.86],
    [hw * 0.55, rimR * 0.25],
    [hw * 0.88, rimR * 0.18],
    [hw * 0.92, 0.01],
  ], 24);
  w.pop();

  // Raggi Borrani (1937 / 1955) oppure razze aero F1 (2026) sul lato esterno (+Z)
  if (!is2026) {
    w.mat(7, 0).color(0.86, 0.87, 0.89);
    const nSpokes = 16;
    for (let i = 0; i < nSpokes; i++) {
      const a = (i / nSpokes) * TAU;
      _carMatY(w, Math.cos(a) * 0.04, Math.sin(a) * 0.04, hw * 0.74, Math.cos(a + 0.18) * rimR * 0.88, Math.sin(a + 0.18) * rimR * 0.88, hw * 0.56, 0.0055, 5);
    }
    // Galletto centrale cromato (knock-off spinner)
    w.box(0, 0, hw * 0.92, 0.095, 0.022, 0.024);
  } else {
    // Copricerchio aero F1 + dado centrale rosso
    w.mat(2, 2).color(0.10, 0.105, 0.12);
    w.push(m4rotY(m4(), PI / 2));
    w.lathe([[hw * 0.72, rimR * 0.86], [hw * 0.82, rimR * 0.26], [hw * 0.84, 0.02]], 24);
    w.pop();
    w.mat(1, 0).color(0.85, 0.06, 0.04);
    w.push(m4rotX(m4(), PI / 2));
    w.cyl(0, hw * 0.75, 0, 0.045, hw * 0.90, 0.038, 12, false, true);
    w.pop();
  }

  // Disco di motion-blur (pa = 1) nel passe principale ad alta rotazione
  wb.push(m4rotY(m4(), PI / 2));
  wb.mat(5, 1).color(is2026 ? 0.16 : 0.76, is2026 ? 0.16 : 0.77, is2026 ? 0.18 : 0.79);
  wb.lathe([[hw * 0.85, rimR * 0.90], [hw * 0.86, 0.02]], 24);
  wb.pop();
}

// Volante (ruota attorno ad X locale)
function carBuildSteer(s) {
  if (ERA.id === '2026') {
    // Volante F1 rettangolare in carbonio con display LED
    s.mat(2, 2).color(0.08, 0.08, 0.09);
    s.rbox(0, 0, 0, 0.03, 0.15, 0.28, 0.02, 2);
    s.mat(9, 1).color(0.10, 0.75, 0.95);
    s.box(-0.018, 0.02, 0, 0.008, 0.06, 0.11);
  } else {
    // Volante d'epoca circolare in legno/alluminio a 4 razze
    const ring = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;
      ring.push([0, Math.sin(a) * 0.175, Math.cos(a) * 0.175]);
    }
    s.mat(8, 0).color(0.38, 0.21, 0.09);
    s.tube(ring, 0.014, 8, { closed: true, up: [1, 0, 0] });
    s.mat(7, 0).color(0.84, 0.85, 0.88);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + PI / 4;
      _carMatY(s, 0, 0, 0, 0, Math.sin(a) * 0.165, Math.cos(a) * 0.165, 0.009, 6);
    }
    s.box(0, 0, 0, 0.03, 0.055, 0.055);
  }
}

// Atlante 1024x512 delle livree e numeri gara (metà sinistra: numero; metà destra: scudetto/logo)
function carAtlas() {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);

  if (ERA.id === '1937') {
    // Numero bianco #32 stile verniciato a mano 1937
    g.fillStyle = 'rgba(245, 240, 228, 0.96)';
    g.font = 'bold 270px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('32', 256, 266);
    // Scudetto Alfa Romeo Milano stilizzato
    g.save(); g.translate(768, 256);
    g.fillStyle = '#d4af37'; g.beginPath(); g.arc(0, 0, 175, 0, TAU); g.fill();
    g.fillStyle = '#0e2c59'; g.beginPath(); g.arc(0, 0, 152, 0, TAU); g.fill();
    g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(0, 0, 114, 0, TAU); g.fill();
    g.fillStyle = '#c81d25'; g.fillRect(-105, -24, 105, 48); g.fillRect(-75, -105, 46, 210);
    g.fillStyle = '#1b7a3d'; g.beginPath(); g.moveTo(15, -80); g.quadraticCurveTo(85, -35, 30, 10); g.quadraticCurveTo(95, 55, 22, 96); g.lineWidth = 22; g.strokeStyle = '#1b7a3d'; g.stroke();
    g.restore();
  } else if (ERA.id === '1955') {
    // Numero bianco #6 Alberto Ascari su cerchio rosso leggermente profilato
    g.fillStyle = 'rgba(250, 246, 236, 0.98)';
    g.font = '900 310px "Arial Narrow", Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('6', 256, 268);
    // Scudetto Lancia blu/oro
    g.save(); g.translate(768, 256);
    g.fillStyle = '#d8d8dc';
    g.beginPath(); g.moveTo(0, -175); g.lineTo(155, -105); g.quadraticCurveTo(155, 85, 0, 185); g.quadraticCurveTo(-155, 85, -155, -105); g.closePath(); g.fill();
    g.fillStyle = '#123878';
    g.beginPath(); g.moveTo(0, -150); g.lineTo(132, -90); g.quadraticCurveTo(132, 72, 0, 158); g.quadraticCurveTo(-132, 72, -132, -90); g.closePath(); g.fill();
    g.fillStyle = '#f0f3f7'; g.font = 'bold 64px Georgia, serif'; g.fillText('LANCIA', 0, 12);
    g.restore();
  } else {
    // 2026 Ferrari SF-26: #16 bianco con contorno nero + logo HP blu e scudetto giallo Ferrari
    g.font = 'italic 900 280px "Arial Black", Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 18; g.strokeStyle = '#111318'; g.strokeText('16', 256, 268);
    g.fillStyle = '#ffffff'; g.fillText('16', 256, 268);
    // Metà destra: Logo HP blu su sfondo trasparente + scudetto giallo Scuderia
    g.save(); g.translate(680, 256);
    g.fillStyle = '#0096d6'; g.beginPath(); g.arc(0, 0, 130, 0, TAU); g.fill();
    g.fillStyle = '#ffffff'; g.font = 'italic 900 148px Arial, sans-serif'; g.fillText('hp', 0, 12);
    g.restore();
    // Scudetto giallo Ferrari accanto
    g.save(); g.translate(905, 256);
    g.fillStyle = '#ffd500';
    g.beginPath(); g.moveTo(-88, -120); g.lineTo(88, -120); g.lineTo(74, 48); g.quadraticCurveTo(0, 132, 0, 132); g.quadraticCurveTo(-74, 48, -88, -120); g.closePath(); g.fill();
    g.fillStyle = '#009246'; g.fillRect(-84, -120, 56, 20);
    g.fillStyle = '#ffffff'; g.fillRect(-28, -120, 56, 20);
    g.fillStyle = '#ce2b37'; g.fillRect(28, -120, 56, 20);
    g.fillStyle = '#111111'; g.font = '900 72px Georgia, serif'; g.fillText('SF', 0, 24);
    g.restore();
  }

  const tex = mkTex(W, H, 'rgba8unorm-srgb', TU.TB | TU.CD | TU.RT, { mipLevelCount: mipCount(W, H) });
  G.dev.queue.copyExternalImageToTexture({ source: cv }, { texture: tex }, [W, H]);
  genMips(tex, 'rgba8unorm-srgb');
  return tex;
}
