// Scenografia Gran Premio di Napoli — Lungomare Caracciolo & Rotonda Diaz:
// Barriere New Jersey in cemento, blocchi rosso-bianchi e tricolori, rotoballe di paglia alle 7 chicane,
// portale bianco/rosso Start/Finish + Maxischermo LED, 2° arco rosso Via Caracciolo, Tribuna Principale A/B con tifosi azzurri,
// Event Village & Race HQ, balaustra e lampioni del Lungomare, scogliere calcaree bianche, Castel dell'Ovo e palazzi napoletani.
const PROPS = { sets: [], regions: {} };

const GLY = {
  A: 'M0,0L2,6L4,0M.8,2L3.2,2', B: 'M0,0L0,6L2.2,6C4.2,6 4.2,3.2 2.2,3.2L0,3.2M2.2,3.2C4.7,3.2 4.7,0 2.2,0L0,0', C: 'M4,4.6C3.4,6.4 0,6.6 0,3C0,-.6 3.4,-.4 4,1.4',
  D: 'M0,0L0,6L1.6,6C5,6 5,0 1.6,0L0,0', E: 'M4,6L0,6L0,0L4,0M0,3.1L3.2,3.1', F: 'M4,6L0,6L0,0M0,3.1L3.2,3.1', G: 'M4,4.6C3.4,6.4 0,6.6 0,3C0,-.6 3.6,-.5 4,1.2L4,2.8L2.2,2.8',
  H: 'M0,0L0,6M4,0L4,6M0,3.1L4,3.1', I: 'M1.1,0L1.1,6M0,0L2.2,0M0,6L2.2,6', J: 'M3.6,6L3.6,1.8C3.6,-.6 .2,-.6 .2,1.6', K: 'M0,0L0,6M4,6L0,2.4M1.5,3.7L4,0', L: 'M0,6L0,0L3.8,0',
  M: 'M0,0L0,6L2.35,2.2L4.7,6L4.7,0', N: 'M0,0L0,6L4,0L4,6', O: 'M2,6C-.7,6 -.7,0 2,0C4.7,0 4.7,6 2,6Z', P: 'M0,0L0,6L2.2,6C4.6,6 4.6,2.8 2.2,2.8L0,2.8',
  Q: 'M2,6C-.7,6 -.7,0 2,0C4.7,0 4.7,6 2,6ZM2.6,1.4L4.2,-.4', R: 'M0,0L0,6L2.2,6C4.6,6 4.6,2.8 2.2,2.8L0,2.8M2.2,2.8L4,0', S: 'M3.8,4.8C3.4,6.4 .2,6.5 .2,4.5C.2,2.6 3.9,3.5 3.9,1.5C3.9,-.6 .4,-.4 0,1.3',
  T: 'M0,6L4,6M2,6L2,0', U: 'M0,6L0,2C0,-.7 4,-.7 4,2L4,6', V: 'M0,6L2,0L4,6', W: 'M0,6L1.25,0L2.5,4.2L3.75,0L5,6', X: 'M0,0L4,6M0,6L4,0', Y: 'M0,6L2,3L4,6M2,3L2,0', Z: 'M0,6L4,6L0,0L4,0',
  0: 'M2,6C-.4,6 -.4,0 2,0C4.4,0 4.4,6 2,6Z', 1: 'M.1,4.6L1.5,6L1.5,0M.1,0L2.9,0', 2: 'M.2,4.6C.4,6.6 3.9,6.5 3.9,4.4C3.9,2.8 .2,1.6 .1,0L4,0',
  3: 'M.2,5C.8,6.5 3.8,6.5 3.8,4.6C3.8,3.3 2.6,3.2 1.6,3.2C2.8,3.2 4,3 4,1.6C4,-.5 .6,-.5 0,1.2', 4: 'M3,0L3,6L0,1.8L4.2,1.8', 5: 'M3.8,6L.5,6L.3,3.4C1.6,4.2 4,3.9 4,1.8C4,-.5 .6,-.5 0,1.1',
  6: 'M3.6,5.4C2.6,6.6 .1,6.2 .1,2.8C.1,-.7 4,-.6 4,1.9C4,4.2 .6,4.2 .1,2.4', 7: 'M0,6L4,6L1.4,0', 8: 'M2,3.2C-.2,3.2 -.2,6 2,6C4.2,6 4.2,3.2 2,3.2C-.6,3.2 -.6,0 2,0C4.6,0 4.6,3.2 2,3.2Z',
  9: 'M.4,.6C1.4,-.6 3.9,-.2 3.9,3.2C3.9,6.7 0,6.6 0,4.1C0,1.8 3.4,1.8 3.9,3.6', '-': 'M.2,2.8L2.6,2.8', '.': 'M.55,.05L.65,.05',
};
const GWID = { I: 2.2, 1: 3.0, ' ': 1.9, '-': 2.8, '.': 1.2, J: 3.7, L: 3.8, M: 4.7, W: 5.0, E: 3.9, F: 3.8, T: 4.0, C: 4.0, S: 3.95 };
const gAdv = ch => (GWID[ch] === undefined ? 4.1 : GWID[ch]) + 1.05;
function textW(txt, h) { let w = 0; for (const ch of txt) w += gAdv(ch); return (w - 1.05) * h / 6; }
function strokeText(g, txt, x, y, h, color, weight, skew) {
  const u = h / 6; g.save(); g.translate(x, y + h); if (skew) g.transform(1, 0, -skew, 1, 0, 0);
  g.strokeStyle = color; g.lineWidth = u * (weight || 1.0); g.lineCap = 'round'; g.lineJoin = 'round';
  let cx = 0;
  for (const ch of txt) {
    const gl = GLY[ch];
    if (gl) {
      g.beginPath();
      for (const m of gl.matchAll(/([MLCZ])([^MLCZ]*)/g)) {
        const n = m[2].trim().split(/[ ,]+/).filter(t => t.length).map(Number), X = k => cx + n[k] * u, Y = k => -n[k] * u;
        if (m[1] === 'M') g.moveTo(X(0), Y(1)); else if (m[1] === 'L') g.lineTo(X(0), Y(1)); else if (m[1] === 'C') g.bezierCurveTo(X(0), Y(1), X(2), Y(3), X(4), Y(5)); else g.closePath();
      }
      g.stroke();
    }
    cx += u * gAdv(ch);
  }
  g.restore();
}
function personSprite(g, ox, oy, W, H, kind, rnd) {
  const C = (r, m) => `rgb(${r | 0},${m === 1 ? 255 : 0},${m === 2 ? 255 : 0})`, CA = (r, m, a) => `rgba(${r | 0},${m === 1 ? 255 : 0},${m === 2 ? 255 : 0},${a})`;
  const grad = (x0, y0, x1, y1, r0, r1, m) => { const q = g.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, C(r0, m)); q.addColorStop(1, C(r1, m)); return q; };
  g.lineCap = 'round'; g.lineJoin = 'round'; g.globalCompositeOperation = 'source-over';
  const fem = rnd() < 0.42, u = (kind ? 35 : 31) * (0.93 + rnd() * 0.14), big = 0.9 + rnd() * 0.26;
  const cx = ox + W / 2 + (rnd() - 0.5) * 6, lean = (rnd() - 0.5) * (kind ? 3 : 9), look = (rnd() - 0.5) * 0.9;
  const ty = oy + (kind ? 10 : 16) + rnd() * 8, hx = cx + lean, hy = ty + u * 0.5, rx = u * 0.36, ry = u * 0.5;
  const sy = ty + u * 1.2, shw = u * (fem ? 0.84 : 1.0) * big, wy = sy + u * 1.7, ww = shw * (fem ? 0.74 : 0.9), hipY = wy + u * 0.38, hipW = shw * (fem ? 0.98 : 0.92);
  const sx = cx + lean * 0.45;
  const sleeve = rnd() < 0.45 ? 0 : 1, pose = rnd();
  if (kind) {
    const footY = oy + H - 8, kneeY = hipY + (footY - hipY) * 0.5;
    for (const sd of [-1, 1]) {
      const lx = sx + sd * hipW * 0.5, fx = lx + sd * (2 + rnd() * 3);
      g.fillStyle = grad(0, hipY, 0, footY, 150, 78, 2); g.beginPath(); g.moveTo(lx - hipW * 0.5, hipY - 4); g.bezierCurveTo(lx - hipW * 0.5, kneeY, fx - u * 0.2, kneeY, fx - u * 0.17, footY - 6);
      g.lineTo(fx + u * 0.17, footY - 6); g.bezierCurveTo(fx + u * 0.22, kneeY, lx + hipW * 0.5, kneeY, lx + hipW * 0.5, hipY - 4); g.closePath(); g.fill();
      g.fillStyle = C(38, 2); g.beginPath(); g.ellipse(fx + sd * 2, footY - 3, u * 0.24, 6, 0, 0, TAU); g.fill();
    }
    g.strokeStyle = CA(60, 2, 0.5); g.lineWidth = 2; g.beginPath(); g.moveTo(sx, hipY + 6); g.lineTo(sx, hipY + u * 1.6); g.stroke();
  } else {
    const kY = Math.min(oy + H - 6, hipY + u * 0.95);
    for (const sd of [-1, 1]) {
      const kx = sx + sd * hipW * 0.62;
      g.fillStyle = grad(0, hipY - 6, 0, kY, 165, 88, 2); g.beginPath(); g.moveTo(sx - sd * 2, hipY - 8); g.lineTo(sx + sd * hipW * 1.02, hipY - 8);
      g.bezierCurveTo(sx + sd * hipW * 1.1, hipY + u * 0.5, kx + sd * u * 0.32, kY, kx, kY); g.bezierCurveTo(kx - sd * u * 0.34, kY, sx - sd * 3, hipY + u * 0.5, sx - sd * 2, hipY - 8); g.closePath(); g.fill();
      const kg = g.createRadialGradient(kx, kY - u * 0.3, 1, kx, kY - u * 0.3, u * 0.36); kg.addColorStop(0, CA(205, 2, 0.75)); kg.addColorStop(1, CA(205, 2, 0)); g.fillStyle = kg; g.beginPath(); g.arc(kx, kY - u * 0.3, u * 0.36, 0, TAU); g.fill();
    }
  }
  const torso = () => { g.beginPath(); g.moveTo(sx - u * 0.2, sy - u * 0.12); g.bezierCurveTo(sx - shw * 0.55, sy - u * 0.08, sx - shw * 0.95, sy + u * 0.02, sx - shw, sy + u * 0.24);
    g.bezierCurveTo(sx - shw * 1.02, sy + u * 0.9, sx - ww, wy - u * 0.3, sx - ww, wy); g.bezierCurveTo(sx - ww, wy + u * 0.2, sx - hipW, hipY - u * 0.1, sx - hipW, hipY);
    g.lineTo(sx + hipW, hipY); g.bezierCurveTo(sx + hipW, hipY - u * 0.1, sx + ww, wy + u * 0.2, sx + ww, wy); g.bezierCurveTo(sx + ww, wy - u * 0.3, sx + shw * 1.02, sy + u * 0.9, sx + shw, sy + u * 0.24);
    g.bezierCurveTo(sx + shw * 0.95, sy + u * 0.02, sx + shw * 0.55, sy - u * 0.08, sx + u * 0.2, sy - u * 0.12); g.closePath(); };
  g.fillStyle = grad(0, sy - u * 0.1, 0, hipY, 238, 138, 1); torso(); g.fill();
  g.save(); torso(); g.clip();
  for (const sd of [-1, 1]) { const q = g.createLinearGradient(sx + sd * shw * 1.02, 0, sx + sd * shw * 0.35, 0); q.addColorStop(0, CA(70, 1, 0.6)); q.addColorStop(1, CA(70, 1, 0)); g.fillStyle = q; g.fillRect(sx + (sd < 0 ? -shw * 1.1 : shw * 0.3), sy - u * 0.2, shw * 0.8, hipY - sy + u * 0.3); }
  { const q = g.createLinearGradient(0, wy - u * 0.5, 0, hipY); q.addColorStop(0, CA(80, 1, 0)); q.addColorStop(1, CA(80, 1, 0.45)); g.fillStyle = q; g.fillRect(sx - shw * 1.1, wy - u * 0.5, shw * 2.2, hipY - wy + u * 0.5); }
  g.lineWidth = 2.2; for (let k = 0; k < 5; k++) { const fy = sy + u * (0.5 + rnd() * 1.4), fx = sx + (rnd() - 0.5) * shw * 1.3, fl = u * (0.25 + rnd() * 0.35), sg = rnd() < 0.5 ? -1 : 1;
    g.strokeStyle = CA(95, 1, 0.3); g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo(fx + sg * fl * 0.5, fy + fl * 0.5, fx + sg * fl, fy + fl * 0.25); g.stroke();
    g.strokeStyle = CA(250, 1, 0.22); g.beginPath(); g.moveTo(fx, fy - 2.5); g.quadraticCurveTo(fx + sg * fl * 0.5, fy + fl * 0.5 - 2.5, fx + sg * fl, fy + fl * 0.25 - 2.5); g.stroke(); }
  g.restore();
  const neckT = rnd();
  g.fillStyle = C(178, 0); g.beginPath(); if (neckT < 0.45) { g.moveTo(sx - u * 0.19, sy - u * 0.13); g.lineTo(sx, sy + u * (0.12 + rnd() * 0.2)); g.lineTo(sx + u * 0.19, sy - u * 0.13); } else g.ellipse(sx, sy - u * 0.1, u * 0.2, u * 0.12, 0, 0, PI); g.fill();
  const limb = (x0, y0, x1, y1, w0, w1, r0, r1, m) => { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    g.fillStyle = grad(x0, y0, x1, y1, r0, r1, m); g.beginPath(); g.moveTo(x0 + nx * w0, y0 + ny * w0); g.lineTo(x1 + nx * w1, y1 + ny * w1); g.arc(x1, y1, w1, Math.atan2(ny, nx), Math.atan2(-ny, -nx), dx * ny - dy * nx > 0);
    g.lineTo(x0 - nx * w0, y0 - ny * w0); g.arc(x0, y0, w0, Math.atan2(-ny, -nx), Math.atan2(ny, nx), dx * ny - dy * nx > 0); g.closePath(); g.fill(); };
  const aw = u * (fem ? 0.14 : 0.17) * big, raise = !kind && pose > 0.80 ? (rnd() < 0.5 ? -1 : 1) : 0, crossed = pose < 0.2, hips = kind && pose > 0.55 && pose < 0.75;
  for (const sd of [-1, 1]) {
    const ax = sx + sd * (shw - aw * 0.7), ay = sy + u * 0.3; let ex, ey, fx, fy;
    if (raise === sd) { ex = ax + sd * u * 0.42; ey = ay - u * 0.55; fx = ex + sd * u * 0.1; fy = ey - u * 0.85; }
    else if (crossed) { ex = ax + sd * u * 0.08; ey = ay + u * 0.95; fx = sx - sd * shw * 0.35; fy = ey - u * 0.12 + sd * 3; }
    else if (hips) { ex = ax + sd * u * 0.42; ey = ay + u * 0.8; fx = sx + sd * ww * 0.95; fy = wy + u * 0.15; }
    else if (kind) { ex = ax + sd * u * 0.1; ey = ay + u * 0.98; fx = ex - sd * u * 0.02; fy = ey + u * 0.88; }
    else if (pose > 0.6) { ex = ax + sd * u * 0.12; ey = ay + u * 0.92; fx = sx + sd * u * 0.12; fy = sy + u * (0.9 + rnd() * 0.3); }
    else { ex = ax + sd * u * 0.1; ey = ay + u * 0.95; fx = sx + sd * hipW * (0.35 + rnd() * 0.3); fy = hipY + u * (0.25 + rnd() * 0.2); }
    const mx = sleeve ? ex : ax + (ex - ax) * 0.55, my = sleeve ? ey : ay + (ey - ay) * 0.55;
    limb(ax, ay, mx, my, aw * 1.12, aw, 225, 150, 1);
    if (!sleeve) limb(mx, my, ex, ey, aw * 0.86, aw * 0.8, 215, 170, 0);
    limb(ex, ey, fx, fy, aw * (sleeve ? 0.95 : 0.78), aw * (sleeve ? 0.8 : 0.66), sleeve ? 205 : 210, sleeve ? 150 : 172, sleeve ? 1 : 0);
    g.fillStyle = C(205, 0); g.beginPath(); g.ellipse(fx + (fx - ex) * 0.12, fy + (fy - ey) * 0.12, aw * 0.78, aw * 0.95, Math.atan2(fy - ey, fx - ex) + PI / 2, 0, TAU); g.fill();
  }
  g.fillStyle = grad(0, hy + ry * 0.5, 0, sy, 150, 190, 0); g.beginPath(); g.moveTo(hx - u * 0.17, hy + ry * 0.55); g.lineTo(sx - u * 0.19, sy - u * 0.08); g.lineTo(sx + u * 0.19, sy - u * 0.08); g.lineTo(hx + u * 0.17, hy + ry * 0.55); g.closePath(); g.fill();
  g.fillStyle = C(185, 0); for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(hx + sd * rx * 0.98 - look * 2, hy + ry * 0.08, rx * 0.16, ry * 0.2, 0, 0, TAU); g.fill(); }
  const hg = g.createRadialGradient(hx - rx * 0.3 + look * 3, hy - ry * 0.35, 1, hx, hy, ry * 1.25); hg.addColorStop(0, C(246, 0)); hg.addColorStop(0.65, C(205, 0)); hg.addColorStop(1, C(150, 0));
  const skull = () => { g.beginPath(); g.moveTo(hx, hy - ry); g.bezierCurveTo(hx + rx * 1.1, hy - ry, hx + rx * 1.12, hy + ry * 0.1, hx + rx * 0.82, hy + ry * 0.55); g.bezierCurveTo(hx + rx * 0.55, hy + ry * 1.0, hx - rx * 0.55, hy + ry * 1.0, hx - rx * 0.82, hy + ry * 0.55);
    g.bezierCurveTo(hx - rx * 1.12, hy + ry * 0.1, hx - rx * 1.1, hy - ry, hx, hy - ry); g.closePath(); };
  g.fillStyle = hg; skull(); g.fill();
  const hs = rnd(), hairTop = (lowY) => { g.beginPath(); g.moveTo(hx - rx * 1.08, lowY); g.bezierCurveTo(hx - rx * 1.25, hy - ry * 1.0, hx - rx * 0.6, hy - ry * 1.22, hx, hy - ry * 1.18);
    g.bezierCurveTo(hx + rx * 0.6, hy - ry * 1.22, hx + rx * 1.25, hy - ry * 1.0, hx + rx * 1.08, lowY); };
  const fr = hy - ry * (0.48 + rnd() * 0.2);
  if (fem && hs < 0.7) {
    const len = hs < 0.45 ? sy + u * (0.2 + rnd() * 0.5) : hy + ry * 0.7;
    g.fillStyle = grad(0, hy - ry, 0, len, 215, 110, 2); hairTop(hy); g.bezierCurveTo(hx + rx * 1.35, hy + ry, hx + rx * 1.2, len, hx + rx * 0.75, len); g.lineTo(hx + rx * 0.72, hy + ry * 0.2);
    g.bezierCurveTo(hx + rx * 0.7, fr, hx - rx * 0.3, fr - 4, hx - rx * 0.72, hy + ry * 0.2); g.lineTo(hx - rx * 0.75, len); g.bezierCurveTo(hx - rx * 1.2, len, hx - rx * 1.35, hy + ry, hx - rx * 1.08, hy); g.closePath(); g.fill();
  } else if (hs < 0.68) {
    g.fillStyle = grad(0, hy - ry * 1.2, 0, hy, 205, 120, 2); const sideY = hy + ry * (rnd() * 0.25 - 0.05); hairTop(sideY);
    g.bezierCurveTo(hx + rx * 0.9, hy - ry * 0.3, hx + rx * 0.5, fr, hx, fr + 2); g.bezierCurveTo(hx - rx * 0.5, fr - 2, hx - rx * 0.9, hy - ry * 0.3, hx - rx * 1.08, sideY); g.closePath(); g.fill();
  } else {
    const m = rnd() < 0.65 ? 1 : 2; g.fillStyle = grad(0, hy - ry * 1.2, 0, hy - ry * 0.3, 235, 150, m); hairTop(hy - ry * 0.38); g.closePath(); g.fill();
    g.fillStyle = C(120, m); g.beginPath(); g.ellipse(hx, hy - ry * 0.36, rx * 1.25, ry * 0.13, 0, 0, TAU); g.fill();
  }
}
function personStrip(n, kind, seed, pw, ph) {
  const W = n * pw * 2, H = ph * 2, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cm = mk(), gm = cm.getContext('2d'); gm.scale(2, 2);
  const rnd = mkRng(seed); for (let i = 0; i < n; i++) { gm.save(); gm.beginPath(); gm.rect(i * pw + 2, 2, pw - 4, ph - 4); gm.clip(); personSprite(gm, i * pw, 0, pw, ph, kind, rnd); gm.restore(); }
  const cc = mk(), gc = cc.getContext('2d');
  for (const r of [10, 6, 3]) for (let a = 0; a < 8; a++) gc.drawImage(cm, Math.cos(a * PI / 4) * r, Math.sin(a * PI / 4) * r);
  gc.drawImage(cm, 0, 0);
  const col = gc.getImageData(0, 0, W, H).data, msk = gm.getImageData(0, 0, W, H).data, out = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { out[i * 4] = col[i * 4]; out[i * 4 + 1] = col[i * 4 + 1]; out[i * 4 + 2] = col[i * 4 + 2]; out[i * 4 + 3] = msk[i * 4 + 3]; }
  return { data: out, w: W, h: H };
}

function atlasBuild() {
  const cv = document.createElement('canvas'); cv.width = 4096; cv.height = 2048; const g = cv.getContext('2d'); g.scale(2, 2);
  g.fillStyle = '#888'; g.fillRect(0, 0, 2048, 1024);
  const REG = PROPS.regions, reg = (name, x, y, w, h) => { REG[name] = [x / 2048, y / 1024, (x + w) / 2048, (y + h) / 1024]; };
  const centered = (txt, x, y, w, h, th, color, weight, skew) => strokeText(g, txt, x + (w - textW(txt, th)) / 2, y + (h - th) / 2, th, color, weight, skew);

  // Portale principale Start/Finish bianco con banda azzurra e rossa (come foto Gran Premio di Napoli)
  g.fillStyle = '#f3f5f8'; g.fillRect(0, 0, 1024, 128);
  g.fillStyle = '#0e62b8'; g.fillRect(0, 0, 1024, 12);
  g.fillStyle = '#c81c22'; g.fillRect(0, 116, 1024, 12);
  centered('GRAN PREMIO DI NAPOLI', 0, 10, 1024, 72, 46, '#0c2648', 1.85, 0.08);
  centered('COMUNE DI NAPOLI - LUNGOMARE CARACCIOLO', 0, 74, 1024, 42, 21, '#c81c22', 1.5, 0);
  reg('name', 0, 0, 1024, 128);

  // Frecce curve / chicane (chevron rosso-bianco, identiche a image_89486885.png)
  g.fillStyle = '#f2f0ea'; g.fillRect(1024, 0, 512, 128); g.fillStyle = '#c91b18';
  for (let i = 0; i < 5; i++) { const x = 1034 + i * 102; g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 48, 8); g.lineTo(x + 92, 64); g.lineTo(x + 48, 120); g.lineTo(x, 120); g.lineTo(x + 44, 64); g.closePath(); g.fill(); }
  reg('chev', 1024, 0, 512, 128);

  // Secondo arco rosso su Via Caracciolo ("NAPOLI RACING SHOW", come image_2f330de5.png)
  g.fillStyle = '#b91b22'; g.fillRect(1536, 0, 512, 128);
  g.fillStyle = '#ffffff'; g.fillRect(1536, 0, 512, 9); g.fillRect(1536, 119, 512, 9);
  centered('NAPOLI RACING SHOW', 1536, 0, 512, 128, 36, '#ffffff', 1.8, 0.08);
  reg('arch2', 1536, 0, 512, 128);

  // Pannelli sponsor e cartellonistica napoletana
  const brands = [
    ['COMUNE DI NAPOLI', '#0e62b8', '#ffffff', 3],
    ['VESUVIO MOTORSPORT', '#c81c22', '#fff6e0', 4],
    ['CAFFE PARTENOPE', '#3b2416', '#f4e2c2', 2],
    ['SCUDERIA AZZURRA 1926', '#1054a4', '#f8fbff', 3],
    ['ROTONDA DIAZ ARENA', '#f2f3f6', '#0e4c92', 0],
    ['LUNGOMARE CARACCIOLO', '#0c7c40', '#ffffff', 6],
    ['GOMME TIRRENO', '#161a20', '#f4c820', 0],
    ['TRICOLORE RACING', '#c81c22', '#ffffff', 1],
    ['PIZZA E MOTORI 1926', '#f4c820', '#16181c', 2],
    ['FORZA NAPOLI 3', '#1576d4', '#ffffff', 3],
    ['GOLFO MOTORI', '#18365c', '#ffd440', 4],
    ['EVENT VILLAGE NAPOLI', '#f0f2f5', '#c81c22', 1],
  ];
  brands.forEach((b, i) => {
    const x = (i % 4) * 512, y = 128 + Math.floor(i / 4) * 128; g.fillStyle = b[1]; g.fillRect(x, y, 512, 128);
    g.fillStyle = b[2]; g.strokeStyle = b[2]; g.lineWidth = 7;
    const ic = b[3], ix = x + 62, iy = y + 64;
    if (ic === 0) { g.beginPath(); g.arc(ix, iy, 36, 0, TAU); g.stroke(); g.beginPath(); g.arc(ix, iy, 14, 0, TAU); g.fill(); }
    else if (ic === 1) { g.beginPath(); g.moveTo(ix - 34, iy + 32); g.lineTo(ix + 4, iy - 36); g.lineTo(ix + 2, iy - 2); g.lineTo(ix + 34, iy - 32); g.lineTo(ix - 2, iy + 36); g.lineTo(ix, iy + 4); g.closePath(); g.fill(); }
    else if (ic === 2) { g.beginPath(); g.ellipse(ix, iy, 26, 38, 0.5, 0, TAU); g.fill(); g.strokeStyle = b[1]; g.lineWidth = 5; g.beginPath(); g.moveTo(ix - 12, iy + 30); g.quadraticCurveTo(ix + 10, iy, ix + 8, iy - 34); g.stroke(); }
    else if (ic === 3) { g.beginPath(); g.moveTo(ix, iy - 40); g.lineTo(ix + 36, iy - 22); g.lineTo(ix + 30, iy + 18); g.lineTo(ix, iy + 40); g.lineTo(ix - 30, iy + 18); g.lineTo(ix - 36, iy - 22); g.closePath(); g.stroke(); }
    else if (ic === 4) { g.beginPath(); g.moveTo(ix - 36, iy + 34); g.lineTo(ix, iy - 38); g.lineTo(ix + 36, iy + 34); g.closePath(); g.fill(); }
    else { for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(ix - 40 + k * 18, iy + 38); g.lineTo(ix - 22 + k * 18, iy - 38); g.lineTo(ix - 12 + k * 18, iy - 38); g.lineTo(ix - 30 + k * 18, iy + 38); g.closePath(); g.fill(); } }
    const th = Math.min(54, 376 / textW(b[0], 1)); centered(b[0], x + 116, y, 388, 128, th, b[2], 1.75, 0.08);
    reg('b' + i, x, y, 512, 128);
  });
  PROPS.nBrands = brands.length;

  // Cartelli distanza 150 / 100 / 50
  ['150', '100', '50'].forEach((t, i) => {
    const x = 960 + i * 256, y = 512;
    g.fillStyle = '#f3f2ec'; g.fillRect(x, y, 256, 208);
    g.strokeStyle = '#141414'; g.lineWidth = 9; g.strokeRect(x + 10, y + 10, 236, 188);
    centered(t, x, y, 256, 208, t.length > 2 ? 78 : 104, '#141414', 1.75, 0);
    reg('d' + t, x, y, 256, 208);
  });

  // Maxischermo LED sul Lungomare [0..476, 512..792] (come in image_89486885.png)
  g.fillStyle = '#09111d'; g.fillRect(0, 512, 476, 280);
  g.fillStyle = '#0e62b8'; g.fillRect(0, 512, 476, 52);
  centered('GRAN PREMIO DI NAPOLI', 0, 518, 476, 40, 24, '#ffffff', 1.7, 0);
  // Scudetto tricolore stilizzato al centro del maxischermo
  g.fillStyle = '#179b44'; g.fillRect(194, 584, 30, 82);
  g.fillStyle = '#f4f6f9'; g.fillRect(224, 584, 30, 82);
  g.fillStyle = '#d41b24'; g.fillRect(254, 584, 30, 82);
  g.strokeStyle = '#f0c419'; g.lineWidth = 5; g.strokeRect(194, 584, 90, 82);
  centered('3', 194, 594, 90, 62, 52, '#101218', 2.0, 0);
  centered('FIAT 127 - NAPOLI 1926', 0, 682, 476, 44, 24, '#6ec5ff', 1.6, 0);
  g.fillStyle = '#c81c22'; g.fillRect(22, 738, 432, 36);
  centered('LIVE - ROTONDA DIAZ 1275 M', 22, 742, 432, 28, 17, '#ffffff', 1.45, 0);
  reg('led', 4, 516, 468, 272);

  // Numeri postazioni / gazebo
  for (let i = 0; i < 10; i++) {
    const x = 480 + (i % 5) * 96, y = 640 + Math.floor(i / 5) * 64;
    g.fillStyle = '#0d2342'; g.fillRect(x, y, 96, 64);
    centered((i < 9 ? '0' : '') + (i + 1), x, y, 96, 64, 40, '#f4c820', 1.4, 0);
    reg('g' + i, x, y, 96, 64);
  }
  // Strisce rosso-bianche diagonali
  g.fillStyle = '#f0eee8'; g.fillRect(480, 512, 256, 128); g.fillStyle = '#c81c22';
  for (let k = -2; k < 8; k++) { g.beginPath(); g.moveTo(480 + k * 48, 640); g.lineTo(504 + k * 48, 640); g.lineTo(552 + k * 48, 512); g.lineTo(528 + k * 48, 512); g.closePath(); g.fill(); }
  reg('stripe', 484, 516, 248, 120);

  const tex = mkTex(4096, 2048, 'rgba8unorm-srgb', TU.RT | TU.TB | TU.CD, { mipLevelCount: 12 });
  G.dev.queue.copyExternalImageToTexture({ source: cv }, { texture: tex }, [4096, 2048]);
  const sit = personStrip(16, 0, 31, 128, 224), std = personStrip(3, 1, 57, 104, 288);
  G.dev.queue.writeTexture({ texture: tex, origin: [0, 1600] }, sit.data, { bytesPerRow: sit.w * 4 }, [sit.w, sit.h]);
  G.dev.queue.writeTexture({ texture: tex, origin: [3456, 1024] }, std.data, { bytesPerRow: std.w * 4 }, [std.w, std.h]);
  for (let i = 0; i < 16; i++) reg('p' + i, i * 128 + 3, 803, 122, 218);
  for (let i = 0; i < 3; i++) reg('s' + i, 1728 + i * 104 + 3, 515, 98, 282);
  genMips(tex, 'rgba8unorm-srgb');
  return tex;
}

function propsBuild() {
  const hw = TRK.hw, N = TRK.N, ds = TRK.ds, REG = PROPS.regions;
  const atlas = atlasBuild();
  const fam = mkFamily('props', { src: 'mat_props' }), famDS = mkFamily('propsDS', { src: 'mat_props', cull: 'none' });
  const bg3 = G.dev.createBindGroup({ layout: fam.bgl3, entries: [{ binding: 0, resource: atlas.createView() }] });
  const S1 = new RangeSet(fam, bg3), S2 = new RangeSet(famDS, bg3);
  const mb = new MeshBuilder(1 << 18), md = new MeshBuilder(1 << 17);
  const famP = mkFamily('crowd', { src: 'world_crowd', cull: 'none', noShadow: true });
  const SP = new RangeSet(famP, G.dev.createBindGroup({ layout: famP.bgl3, entries: [{ binding: 0, resource: atlas.createView() }] })), mp = new MeshBuilder(1 << 15);
  const fenceMB = new MeshBuilder(1 << 12), fenceR = [];
  const o5 = new Float64Array(5), mt = m4();
  const sI = s => (((Math.round(s / ds)) % N) + N) % N;
  const P = (s, d) => { trackPos(s, d, o5); const y = Math.abs(d) < hw + 2.0 ? o5[1] : Math.max(2.35, hfAt(o5[0], o5[2])); return [o5[0], y, o5[2], o5[3], o5[4]]; };
  const frame = (s, d, yaw, yOff) => {
    const p = P(s, d); let tx = p[3], tz = p[4];
    if (yaw) { const c = Math.cos(yaw), sn = Math.sin(yaw), a = tx * c - tz * sn, b = tx * sn + tz * c; tx = a; tz = b; }
    return m4basis(m4(), tx, 0, tz, 0, 1, 0, -tz, 0, tx, p[0], p[1] + (yOff || 0), p[2]);
  };
  const col = (m, r, g, b, a) => m.color(r, g, b, a === undefined ? 1 : a);
  const sign = (m, px, py, pz, rx, ry, rz, h, name, fade) => {
    const r = REG[name]; m.mat(7, 0, 0, fade || 0); col(m, 1, 1, 1);
    m.quad(px, py, pz, px + rx, py + ry, pz + rz, px + rx, py + ry + h, pz + rz, px, py + h, pz, r[0], r[3], r[2], r[1]);
  };
  const Bx = (m, u0, u1, y0, y1, v0, v1) => m.box((u0 + u1) / 2, (y0 + y1) / 2, (v0 + v1) / 2, Math.abs(u1 - u0), Math.abs(y1 - y0), Math.abs(v1 - v0));
  const at = (m, s, d, yaw, fn, yOff) => { m.push(frame(s, d, yaw, yOff)); fn(m); m.pop(); };
  const rng = mkRng(1926);
  const pick = a => a[Math.floor(rng() * a.length) % a.length];

  // ================= 1. BARRIERE NEW JERSEY IN CEMENTO LUNGO IL TRACCIATO =================
  const railD = (side, i) => (side < 0 ? -TRK.barL[i] : TRK.barR[i]);
  PROPS.railD = railD;
  // Profilo New Jersey stradale autentico (base larga 54 cm, spalla inclinata, cresta 16 cm, altezza 92 cm)
  const njProf = [[-0.27, -0.06], [0.27, -0.06], [0.27, 0.14], [0.14, 0.34], [0.085, 0.92], [-0.085, 0.92], [-0.14, 0.34], [-0.27, 0.14]];
  for (const side of [-1, 1]) {
    const fl = side < 0 ? TRK.tyreL : TRK.tyreR;
    let path = [];
    const flush = () => {
      if (path.length > 1) {
        const i0 = mb.ni;
        mb.mat(3); col(mb, 0.54, 0.53, 0.50);
        mb.sweep(path.map(p => [p[0], p[1], p[2]]), njProf, { closedProfile: true, hard: true });
        S1.add(mb, i0, 3, 750);
      }
      path = [];
    };
    for (let i = 0; i <= N; i += 2) {
      const q = i % N;
      // Nelle curve con barriere morbide rosso-bianche (Rotonda Diaz / tornanti) usa i blocchi colorati al posto del New Jersey grigio
      if (fl[q] > 0.5) { flush(); continue; }
      const d = railD(side, q);
      path.push(P(q * ds, d));
      if (path.length >= 28) { const last = path[path.length - 1]; flush(); path.push(last); }
    }
    flush();
  }

  // ================= 2. BARRIERE ROSSO-BIANCHE & TRICOLORI (ROTONDA DIAZ + TORNANTI + RETTILINEO) =================
  {
    const blockCol = (idx, tricolor) => {
      if (tricolor) {
        const k = idx % 3;
        return k === 0 ? [0.08, 0.42, 0.14] : k === 1 ? [0.84, 0.85, 0.86] : [0.76, 0.08, 0.07];
      }
      return (idx & 1) ? [0.78, 0.08, 0.07] : [0.85, 0.86, 0.87];
    };
    for (const side of [-1, 1]) {
      const fl = side < 0 ? TRK.tyreL : TRK.tyreR, bar = side < 0 ? TRK.barL : TRK.barR;
      let acc = 0, run = 0, n = 0, i0 = mb.ni;
      const flushB = () => { if (n) S1.add(mb, i0, 3, 950); i0 = mb.ni; n = 0; };
      for (let i = 0; i < N; i++) {
        if (fl[i] < 0.5) { flushB(); run = 0; acc = 0; continue; }
        acc += ds;
        while (acc >= 1.45) {
          acc -= 1.45;
          const s = i * ds - acc, d = side * (trkAt(bar, i, 0) - 0.15);
          const c = blockCol(run, false);
          at(mb, s, d, 0, m => {
            m.mat(2, 130, 0); col(m, c[0], c[1], c[2]);
            m.rbox(0, 0.44, 0, 1.38, 0.88, 0.44, 0.06, 2);
          });
          run++; n++;
          if (n >= 22) flushB();
        }
      }
      flushB();
    }
    // Cordone protettivo tricolore verde-bianco-rosso lungo la corsia di partenza (dettaglio iconico di image_89486885.png!)
    const i0 = mb.ni;
    for (let k = 0; k < 28; k++) {
      const s = -32 + k * 1.35;
      const c = blockCol(Math.floor(k / 2), true);
      at(mb, s, -(hw + 1.55), 0, m => {
        m.mat(10); col(m, c[0], c[1], c[2]);
        m.rbox(0, 0.34, 0, 1.28, 0.68, 0.42, 0.14, 2);
      });
    }
    S1.add(mb, i0, 3, 600);
  }

  // ================= 3. ROTOBALLE DI PAGLIA CILINDRICHE ALLE 7 CHICANE & ROTONDA DIAZ =================
  {
    const bale = (m, x, z, hasChev, chevSide) => {
      // Cilindro dorato di paglia avvolto in rete (90x120 cm come da specifica della mappa!)
      m.mat(10); col(m, 0.62, 0.48, 0.22);
      m.cyl(x, 0, z, 0.62, 1.18, 0.60, 14, true, true);
      // Rete protettiva sottile (fascia centrale)
      m.mat(2, 190, 0); col(m, 0.48, 0.40, 0.24);
      m.cyl(x, 0.16, z, 0.635, 1.02, 0.625, 14, false, false);
      if (hasChev) {
        const sgn = chevSide || -1;
        sign(md, x - 0.52, 0.56, z + sgn * 0.66, 1.04, 0, 0, 0.36, 'chev', 95);
      }
    };
    // Posiziona coppie di rotoballe + freccia chevron all'interno e all'esterno di ciascuna delle 7 chicane
    for (const ch of TRK.chicanes) {
      const sMid = (ch.s0 + ch.s1) * 0.5, sideIn = ch.k > 0 ? 1 : -1;
      const i0 = mb.ni, k0 = md.ni;
      for (const [dsOff, side] of [[-7.5, -sideIn], [0, sideIn], [7.5, -sideIn]]) {
        const s = sMid + dsOff, d = side * (hw + 0.95);
        mb.push(frame(s, d)); md.push(frame(s, d));
        bale(mb, -0.65, 0, true, -side);
        bale(mb, 0.65, 0, false, -side);
        mb.pop(); md.pop();
      }
      S1.add(mb, i0, 3, 550); S2.add(md, k0, 3, 550);
    }
    // Rotoballe di protezione ingresso/uscita Rotonda Diaz e davanti allo Start (come image_89486885.png!)
    const i0 = mb.ni, k0 = md.ni;
    for (const [s, d] of [[24, hw + 1.15], [27, hw + 1.15], [31, -(hw + 1.1)], [112, hw + 1.15], [116, -(hw + 1.1)]]) {
      mb.push(frame(s, d)); md.push(frame(s, d));
      bale(mb, 0, 0, true, d > 0 ? -1 : 1);
      mb.pop(); md.pop();
    }
    S1.add(mb, i0, 3, 550); S2.add(md, k0, 3, 550);
  }

  // ================= 4. FIGURE UMANE & TIFOSI AZZURRO NAPOLI =================
  const TIFOSI = [
    [0.03, 0.30, 0.78], [0.05, 0.38, 0.86], [0.04, 0.24, 0.66], [0.08, 0.44, 0.88],
    [0.86, 0.88, 0.90], [0.80, 0.82, 0.85], [0.03, 0.32, 0.80], [0.06, 0.36, 0.82],
    [0.14, 0.16, 0.22], [0.36, 0.34, 0.30], [0.58, 0.10, 0.08], [0.74, 0.58, 0.10],
  ];
  const figure = (x, y, z, reg, hgt, shirt, ao) => {
    const r = REG[reg], hwid = hgt * (r[2] - r[0]) * 2048 / ((r[3] - r[1]) * 1024) * 0.5, flip = rng() < 0.5, ua = flip ? r[2] : r[0], ub = flip ? r[0] : r[2], k = 0.85 + rng() * 0.26;
    mp.mat(16, Math.floor(rng() * 255), Math.floor(rng() * 255)); col(mp, shirt[0] * k, shirt[1] * k, shirt[2] * k, ao);
    const raw = (ox, oy, u, v) => { const i = mp.v(x, y, z, 0, 1, 0, u, v), q = i * 18 + 6; mp.i16[q] = Math.round(ox * 32767); mp.i16[q + 1] = Math.round(oy * 0.5 * 32767); mp.i16[q + 2] = 0; return i; };
    const a = raw(-hwid, 0, ua, r[3]), b = raw(hwid, 0, ub, r[3]), c = raw(hwid, hgt, ub, r[1]), d = raw(-hwid, hgt, ua, r[1]);
    mp.quadI(a, b, c, d);
  };
  const sitter = (x, y, z, ao) => figure(x + (rng() - 0.5) * 0.24, y - 0.08, z + 0.18, 'p' + (Math.floor(rng() * 16) % 16), 0.98 * (0.85 + rng() * 0.25), pick(TIFOSI), ao);
  const stander = (x, y, z, shirt, ao) => figure(x, y - 0.02, z, 's' + (Math.floor(rng() * 3) % 3), 1.72 * (0.9 + rng() * 0.18), shirt, ao);

  // ================= 5. PORTALE START/FINISH BIANCO/ROSSO + MAXISCHERMO LED + 2° ARCO ROSSO =================
  const napoliArch = (s, dL, dR, bannerReg, pillarCol, lights) => {
    const i0 = mb.ni, k0 = md.ni, yB = 5.4, yT = 7.0;
    mb.push(frame(s, 0)); md.push(frame(s, 0));
    // Piloni gonfiabili/strutturali bianchi e rossi (come image_89486885.png)
    for (const d of [dL, dR]) {
      mb.mat(2, 120, 0); col(mb, pillarCol[0], pillarCol[1], pillarCol[2]);
      mb.rbox(0, yT * 0.5, d, 1.25, yT, 1.35, 0.12, 3);
      // Fasce rosse/azzurre sui piloni
      col(mb, 0.78, 0.09, 0.08);
      for (const yy of [1.2, 2.7, 4.2]) Bx(mb, -0.64, 0.64, yy, yy + 0.55, d - 0.69, d + 0.69);
      mb.mat(3); col(mb, 0.35, 0.35, 0.34); Bx(mb, -0.82, 0.82, -0.35, 0.28, d - 0.85, d + 0.85);
    }
    // Trave superiore
    mb.mat(2, 110, 40); col(mb, pillarCol[0], pillarCol[1], pillarCol[2]);
    Bx(mb, -0.52, 0.52, yB, yT, dL, dR);
    // Banner fronte/retro
    const r = REG[bannerReg]; md.mat(7); col(md, 1, 1, 1);
    md.quad(-0.56, yB + 0.05, dL + 0.55, -0.56, yB + 0.05, dR - 0.55, -0.56, yT - 0.05, dR - 0.55, -0.56, yT - 0.05, dL + 0.55, r[0], r[3], r[2], r[1]);
    md.quad(0.56, yB + 0.05, dR - 0.55, 0.56, yB + 0.05, dL + 0.55, 0.56, yT - 0.05, dL + 0.55, 0.56, yT - 0.05, dR - 0.55, r[0], r[3], r[2], r[1]);
    if (lights) {
      // Semaforo partenza 5 luci
      mb.mat(2, 150, 50); col(mb, 0.03, 0.03, 0.035); Bx(mb, -0.86, -0.55, 4.55, 5.28, -2.4, 2.4);
      for (let k = 0; k < 5; k++) for (const y of [4.75, 5.08]) {
        mb.push(m4mul(m4(), m4translate(mt, -0.87, y, -1.8 + k * 0.9), m4rotZ(m4(), PI / 2)));
        mb.mat(18, 90, 0); col(mb, 0.95, 0.02, 0.006); mb.cyl(0, 0, 0, 0.13, 0.04, 0.11, 12, false, true);
        mb.pop();
      }
    }
    mb.pop(); md.pop();
    S1.add(mb, i0, 7, 1400); S2.add(md, k0, 5, 1600);
  };
  // Portale bianco Start/Finish A
  napoliArch(0, -(hw + 2.5), hw + 2.5, 'name', [0.88, 0.89, 0.91], true);
  // Secondo arco rosso lungo Via Caracciolo verso Castel dell'Ovo (come image_2f330de5.png!)
  napoliArch(195, -(hw + 2.4), hw + 2.4, 'arch2', [0.76, 0.09, 0.10], false);

  // Maxischermo LED su traliccio metallico lato mare vicino allo Start (come image_89486885.png!)
  {
    const i0 = mb.ni, k0 = md.ni;
    const bx = 13.5, bz = 11.8, by = 2.4;
    mb.push(m4mul(m4(), m4translate(mt, bx, by, bz), m4rotY(m4(), -0.45)));
    md.push(m4mul(m4(), m4translate(mt, bx, by, bz), m4rotY(m4(), -0.45)));
    // Struttura traliccio acciaio
    mb.mat(1); col(mb, 0.72, 0.74, 0.76);
    for (const [x, z] of [[-4.4, -1.1], [4.4, -1.1], [4.4, 1.1], [-4.4, 1.1]]) mb.cyl(x, -0.2, z, 0.11, 9.2, 0.11, 8, false, true);
    for (let y = 0.8; y <= 8.8; y += 1.6) {
      mb.tube([[-4.4, y, -1.1], [4.4, y, -1.1]], 0.06, 5);
      mb.tube([[-4.4, y, 1.1], [4.4, y, 1.1]], 0.06, 5);
      mb.tube([[-4.4, y, -1.1], [-4.4, y, 1.1]], 0.055, 5);
      mb.tube([[4.4, y, -1.1], [4.4, y, 1.1]], 0.055, 5);
    }
    // Podio base e cornice nera schermo LED
    mb.mat(2, 160, 20); col(mb, 0.05, 0.05, 0.06);
    Bx(mb, -4.2, 4.2, 0, 2.2, -1.0, 1.0);
    Bx(mb, -4.1, 4.1, 2.5, 7.6, -0.45, 0.45);
    // Faccia LED luminosa (fronte e retro)
    sign(md, -3.9, 2.7, -0.48, 7.8, 0, 0, 4.7, 'led');
    sign(md, 3.9, 2.7, 0.48, -7.8, 0, 0, 4.7, 'led');
    mb.pop(); md.pop();
    S1.add(mb, i0, 7, 1400); S2.add(md, k0, 5, 1400);
  }

  // ================= 6. TRIBUNA PRINCIPALE A & B + EVENT VILLAGE GAZEBI + RACE HQ (LATO NORD VILLA COMUNALE) =================
  {
    const st = TRK.stand, u0 = st.s0, u1 = st.s1, vF = st.d0, baseY = 2.4;
    const nRow = 12, run = 0.85, rise = 0.40, yF = baseY + 0.9, vB = vF - 0.9 - nRow * run, yB = yF + nRow * rise;
    const nSec = 4, aisle = 2.4, secW = (u1 - u0 - (nSec + 1) * aisle) / nSec;
    const seatCols = [[0.04, 0.28, 0.72], [0.84, 0.86, 0.88]];
    for (let sec = 0; sec < nSec; sec++) {
      const a = u0 + aisle + sec * (secW + aisle), c = a + secW, i0 = mb.ni, k0 = md.ni, pi0 = mp.ni;
      for (let r = 0; r < nRow; r++) {
        const v = vF - 0.9 - r * run, y = yF + r * rise, ao = 1.0 - 0.32 * (r / nRow);
        mb.mat(3); col(mb, 0.46, 0.47, 0.48, ao);
        mb.quad(a, y, v, c, y, v, c, y + rise, v, a, y + rise, v);
        mb.quad(a, y + rise, v, c, y + rise, v, c, y + rise, v - run, a, y + rise, v - run);
        const pc = seatCols[(r + sec) & 1];
        md.mat(8); col(md, pc[0], pc[1], pc[2], ao);
        md.quad(a, y + rise + 0.38, v - 0.46, c, y + rise + 0.38, v - 0.46, c, y + rise + 0.38, v - 0.82, a, y + rise + 0.38, v - 0.82, 0, 0, c - a, 0.36);
        // Tifosi napoletani festanti in tribuna
        const occ = 0.78 * (0.65 + 0.35 * Math.sin((r + 1) / (nRow + 1) * PI));
        for (let x = a + 0.4; x < c - 0.4; x += 0.56) {
          if (rng() < occ) {
            if (rng() < 0.14) stander(x, y + rise + 0.02, v - 0.58, pick(TIFOSI), ao);
            else sitter(x, y + rise + 0.38, v - 0.80, ao);
          }
        }
      }
      // Muretta frontale azzurra con sponsor Napoli + struttura tubolare + tettoia leggera
      const ea = sec === 0 ? u0 : a - aisle * 0.5, ec = sec === nSec - 1 ? u1 : c + aisle * 0.5;
      mb.mat(2, 130, 0); col(mb, 0.05, 0.28, 0.68); Bx(mb, ea, ec, baseY - 0.3, yF + 0.7, vF - 0.9, vF - 0.6);
      const nm = ['b0', 'name', 'b9', 'b3'][sec];
      sign(md, ea + 1.5, baseY + 0.25, vF - 0.56, ec - ea - 3, 0, 0, 1.3, nm);
      // Pilastri e tettoia tribuna
      mb.mat(1); col(mb, 0.65, 0.68, 0.70);
      for (const x of [ea + 0.4, (ea + ec) * 0.5, ec - 0.4]) {
        mb.cyl(x, baseY, vB - 0.2, 0.14, yB + 4.4, 0.14, 8, false, true);
        mb.tube([[x, yB + 4.3, vB - 0.2], [x, yB + 2.8, vF - 0.4]], 0.11, 6);
      }
      md.mat(10); col(md, 0.90, 0.91, 0.93);
      md.quad(ec, yB + 4.4, vB - 0.5, ea, yB + 4.4, vB - 0.5, ea, yB + 2.85, vF - 0.2, ec, yB + 2.85, vF - 0.2, 0, 0, ec - ea, 12);
      S1.add(mb, i0, 7, 1600); S2.add(md, k0, 7, 1600); SP.add(mp, pi0, 1, 650);
    }

    // Event Village: 6 Gazebi bianchi (Gazebi A1-A6) e Race HQ subito dietro la Tribuna Principale (come mappa!)
    const i0 = mb.ni, k0 = md.ni;
    const gazebo = (gx, gz, c) => {
      const gy = 2.42;
      mb.mat(1); col(mb, 0.75, 0.77, 0.80);
      for (const [dx, dz] of [[-3.2, -3.2], [3.2, -3.2], [3.2, 3.2], [-3.2, 3.2]]) mb.cyl(gx + dx, gy, gz + dz, 0.05, gy + 2.9, 0.05, 6, false, false);
      md.mat(10); col(md, c[0], c[1], c[2]);
      const ap = [gx, gy + 4.3, gz], cs = [[gx - 3.4, gy + 2.9, gz - 3.4], [gx + 3.4, gy + 2.9, gz - 3.4], [gx + 3.4, gy + 2.9, gz + 3.4], [gx - 3.4, gy + 2.9, gz + 3.4]];
      for (let k = 0; k < 4; k++) {
        const a = cs[k], b = cs[(k + 1) % 4];
        const i1 = md.v(a[0], a[1], a[2], 0, 1, 0, 0, 0), i2 = md.v(b[0], b[1], b[2], 0, 1, 0, 1, 0), i3 = md.v(ap[0], ap[1], ap[2], 0, 1, 0, 0.5, 1);
        md.tri(i1, i2, i3);
        md.quad(b[0], gy + 2.45, b[2], a[0], gy + 2.45, a[2], a[0], gy + 2.9, a[2], b[0], gy + 2.9, b[2]);
      }
    };
    for (let q = 0; q < 6; q++) gazebo(-58 + q * 22, -62, q % 3 === 1 ? [0.06, 0.34, 0.78] : [0.90, 0.91, 0.93]);
    // Race HQ + Paddock hospitality (Ovest della Tribuna, come sulla mappa)
    mb.mat(3); col(mb, 0.86, 0.84, 0.80); Bx(mb, -118, -90, 2.2, 7.6, -64, -50);
    mb.mat(5); col(mb, 1, 1, 1); mb.quad(-90, 3.6, -49.95, -118, 3.6, -49.95, -118, 6.6, -49.95, -90, 6.6, -49.95, 0, 0, 28, 3);
    sign(md, -115, 7.7, -49.9, 22, 0, 0, 1.5, 'b11');
    S1.add(mb, i0, 7, 1400); S2.add(md, k0, 7, 1400);
  }

  // ================= 7. BALAUSTRA & LAMPIONI STORICI DEL LUNGOMARE CARACCIOLO =================
  {
    const i0 = mb.ni;
    for (let x = -220; x <= 380; x += 26) {
      const zCoast = napoliCoastZ(x) - 1.4;
      const yBase = Math.max(2.35, hfAt(x, zCoast));
      // Lampione storico in ghisa scura con doppio globo bianco caldo
      mb.mat(2, 140, 110, 95); col(mb, 0.08, 0.11, 0.10);
      mb.cyl(x, yBase, zCoast, 0.14, yBase + 0.9, 0.10, 7, false, true);
      mb.cyl(x, yBase + 0.9, zCoast, 0.08, yBase + 5.2, 0.055, 7, false, true);
      Bx(mb, x - 0.72, x + 0.72, yBase + 4.95, yBase + 5.06, zCoast - 0.05, zCoast + 0.05);
      // Due globi luminosi opali
      mb.mat(6, 95, 0); col(mb, 1.0, 0.94, 0.78);
      for (const dx of [-0.66, 0.66]) mb.rbox(x + dx, yBase + 5.28, zCoast, 0.34, 0.38, 0.34, 0.14, 3);
    }
    // Muretto + ringhiera lungo Rotonda Diaz e Lungomare (lato mare)
    for (let x = -220; x < 380; x += 12) {
      const z0 = napoliCoastZ(x) - 0.8, z1 = napoliCoastZ(x + 12) - 0.8;
      const y0 = Math.max(2.35, hfAt(x, z0)), y1 = Math.max(2.35, hfAt(x + 12, z1));
      mb.mat(3); col(mb, 0.56, 0.54, 0.50);
      mb.tube([[x, y0 + 0.32, z0], [x + 12, y1 + 0.32, z1]], 0.24, 5);
      mb.mat(2, 130, 120, 85); col(mb, 0.07, 0.09, 0.09);
      mb.tube([[x, y0 + 1.08, z0], [x + 12, y1 + 1.08, z1]], 0.045, 5);
    }
    S1.add(mb, i0, 3, 900);
  }

  // ================= 8. SCOGLIERE CALCAREE BIANCHE (FRANGIFLUTTI DI VIA CARACCIOLO & MAPPATELLA) =================
  {
    const rockRng = mkRng(404);
    const boulderCluster = (x0, x1, zFn, count) => {
      const i0 = mb.ni;
      mb.mat(3);
      for (let k = 0; k < count; k++) {
        const t = k / Math.max(1, count - 1);
        const x = lerp(x0, x1, t) + (rockRng() - 0.5) * 4.5;
        const z = zFn(t, x) + (rockRng() - 0.5) * 9.0;
        const y = Math.max(0.1, naturalH(x, z) - 0.5);
        const rx = 2.2 + rockRng() * 3.4, ry = 1.4 + rockRng() * 1.9, rz = 2.0 + rockRng() * 3.2;
        const shade = 0.72 + rockRng() * 0.16;
        col(mb, shade, shade * 0.99, shade * 0.95);
        mb.push(m4mul(m4(), m4translate(mt, x, y + ry * 0.35, z), m4rotY(m4(), rockRng() * TAU)));
        mb.rbox(0, 0, 0, rx, ry, rz, Math.min(rx, ry, rz) * 0.32, 2);
        mb.pop();
      }
      S1.add(mb, i0, 7, 1600);
    };
    // Scogliera Ovest
    boulderCluster(-260, 26, () => 22, 62);
    // Scogliera curva frangiflutti di Mappatella / Rotonda Diaz (identica a image_2f330de5.png & image_89486885.png!)
    boulderCluster(118, 365, t => 78 - 22 * Math.sin(t * PI * 0.72) + (t > 0.75 ? (t - 0.75) * 45 : 0), 74);
    // Scogliera Est lungomare
    boulderCluster(220, 410, () => 15.5, 42);
  }

  // ================= 9. CASTEL DELL'OVO SULL'ISOLOTTO DI MEGARIDE (x=760, z=115) =================
  {
    const i0 = mb.ni;
    const cx = 760, cz = 115, y0 = 1.5;
    mb.push(m4mul(m4(), m4translate(mt, cx, y0, cz), m4rotY(m4(), -0.18)));
    // Basamento in tufo giallo napoletano e scogliera
    mb.mat(3); col(mb, 0.56, 0.48, 0.35);
    Bx(mb, -52, 52, -1.5, 11.5, -28, 28);
    // Corpo centrale fortificato con mura a scarpa color tufo dorato (visibilissimo dal rettilineo Start!)
    col(mb, 0.68, 0.58, 0.42);
    Bx(mb, -44, 42, 11.5, 24.5, -22, 22);
    // Terrazza dei Cannoni (bastione occidentale che guarda il Lungomare)
    col(mb, 0.64, 0.54, 0.39);
    Bx(mb, -58, -40, 8.0, 17.5, -18, 18);
    // Torre Maestra e Torre Normandia (profilo inconfondibile di Castel dell'Ovo!)
    col(mb, 0.72, 0.61, 0.44);
    Bx(mb, -24, 16, 24.5, 34.0, -14, 15);
    Bx(mb, 18, 38, 24.5, 31.5, -16, 12);
    // Merlature, archi e finestroni scuri
    mb.mat(2, 190, 0); col(mb, 0.14, 0.12, 0.10);
    for (let u = -36; u <= 34; u += 10) {
      Bx(mb, u - 2.0, u + 2.0, 15.5, 21.0, -22.4, -21.8);
      Bx(mb, u - 2.0, u + 2.0, 15.5, 21.0, 21.8, 22.4);
    }
    for (let v = -14; v <= 14; v += 9) Bx(mb, -44.5, -43.8, 16.0, 22.0, v - 1.8, v + 1.8);
    // Pontile di Borgo Marinari verso Santa Lucia
    mb.mat(3); col(mb, 0.58, 0.54, 0.46);
    Bx(mb, -12, 6, -1.5, 3.6, -140, -24);
    mb.pop();
    S1.add(mb, i0, 7, 3600);
  }

  // ================= 10. PALAZZI NAPOLETANI (RIVIERA DI CHIAIA, MERGELLINA & SANTA LUCIA) =================
  {
    const prng = mkRng(1987);
    // Tavolozza calda dei palazzi storici di Napoli (ocra, crema, terracotta pastello, tufo rosato, bianco caldo)
    const palCols = [
      [0.82, 0.72, 0.54], [0.88, 0.84, 0.76], [0.76, 0.48, 0.34],
      [0.85, 0.68, 0.42], [0.78, 0.74, 0.66], [0.72, 0.42, 0.30],
    ];
    const buildPalazzo = (x, z, w, d, h, c) => {
      const y = Math.max(2.4, naturalH(x, z)) - 1.5;
      mb.mat(3); col(mb, c[0], c[1], c[2]);
      Bx(mb, x - w * 0.5, x + w * 0.5, y, y + h, z - d * 0.5, z + d * 0.5);
      // Cornicione chiaro in sommità e basamento in piperno grigio
      col(mb, 0.86, 0.84, 0.80); Bx(mb, x - w * 0.5 - 0.3, x + w * 0.5 + 0.3, y + h - 0.6, y + h + 0.3, z - d * 0.5 - 0.3, z + d * 0.5 + 0.3);
      col(mb, 0.38, 0.37, 0.36); Bx(mb, x - w * 0.5 - 0.1, x + w * 0.5 + 0.1, y, y + 3.2, z - d * 0.5 - 0.1, z + d * 0.5 + 0.1);
      // Finestre facciata Sud (rivolta verso il Lungomare e la pista!)
      mb.mat(5); col(mb, 1, 1, 1);
      const zF = z + d * 0.5 + 0.08;
      mb.quad(x - w * 0.44, y + 4.0, zF, x + w * 0.44, y + 4.0, zF, x + w * 0.44, y + h - 1.6, zF, x - w * 0.44, y + h - 1.6, zF, 0, 0, w * 0.88, h - 5.6);
      // Tetto in tegole terracotta napoletane
      mb.mat(2, 180, 0); col(mb, 0.52, 0.24, 0.15);
      Bx(mb, x - w * 0.48, x + w * 0.48, y + h + 0.3, y + h + 1.6, z - d * 0.48, z + d * 0.48);
    };
    // Prima cortina Riviera di Chiaia dietro Villa Comunale (z ≈ -146..-175)
    let i0 = mb.ni, cnt = 0;
    for (let x = -340; x <= 620; x += 28) {
      const w = 22 + prng() * 8, d = 18 + prng() * 8, h = 16 + prng() * 14;
      const zOff = x > 380 ? (x - 380) * -0.18 : 0;
      buildPalazzo(x, -150 + zOff - prng() * 16, w, d, h, palCols[Math.floor(prng() * palCols.length)]);
      if (++cnt >= 8) { S1.add(mb, i0, 7, 3200); i0 = mb.ni; cnt = 0; }
    }
    if (cnt) S1.add(mb, i0, 7, 3200);
    // Seconda cortina collinare Vomero / Corso Vittorio Emanuele (più in alto e indietro, z ≈ -235..-340)
    i0 = mb.ni; cnt = 0;
    for (let x = -380; x <= 560; x += 38) {
      const w = 26 + prng() * 12, d = 20 + prng() * 10, h = 18 + prng() * 18;
      buildPalazzo(x + (prng() - 0.5) * 10, -255 - prng() * 85, w, d, h, palCols[Math.floor(prng() * palCols.length)]);
      if (++cnt >= 8) { S1.add(mb, i0, 7, 3600); i0 = mb.ni; cnt = 0; }
    }
    if (cnt) S1.add(mb, i0, 7, 3600);
  }

  // ================= 11. CARTELLI DISTANZA, PANNELLI PUBBLICITARI & COMMISSARI =================
  {
    // Pannelli sponsor lungo i rettilinei principali e le curve
    let bi = 0;
    const row = (s0, s1, side, step, w, h, y0, chev) => {
      for (let s = s0; s < s1 - w * 0.5; s += step) {
        const i = sI(s), bar = side < 0 ? TRK.barL[i] : TRK.barR[i], d = side * (bar + 0.7), i0 = mb.ni, k0 = md.ni;
        at(mb, s, d, 0, m => {
          m.mat(2, 128, 128, 105); col(m, 0.2, 0.21, 0.23);
          for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) Bx(m, x - 0.06, x + 0.06, -0.2, y0 + h, side * 0.05, side * 0.16);
        });
        at(md, s, d, 0, m => {
          if (side < 0) sign(m, -w / 2, y0, 0, w, 0, 0, h, chev ? 'chev' : 'b' + (bi++ % PROPS.nBrands), 105);
          else sign(m, w / 2, y0, 0, -w, 0, 0, h, chev ? 'chev' : 'b' + (bi++ % PROPS.nBrands), 105);
        });
        S1.add(mb, i0, 3, 550); S2.add(md, k0, 7, 550);
      }
    };
    row(145, 290, -1, 14, 5.5, 1.35, 0.95, false);
    row(540, 820, 1, 18, 5.5, 1.35, 0.95, false);
    // Chevron ai due tornanti 180°
    for (const c of TRK.corners) if (c.kind === 'hairpin') {
      row(c.s0 + 6, c.s1 - 6, 1, 6.2, 4.4, 1.15, 0.98, true);
    }
    // Commissari di percorso con gilet ad alta visibilità arancione (come image_89486885.png!)
    const q0 = mp.ni;
    for (const [s, d] of [[-10, -(hw + 2.8)], [24, -(hw + 2.8)], [65, hw + 3.2], [200, -(hw + 2.8)], [420, hw + 3.0], [720, -(hw + 3.0)], [1020, hw + 3.0]]) {
      mp.push(frame(s, d));
      stander(0, 0.02, 0, [0.92, 0.36, 0.03], 0.95);
      mp.pop();
    }
    SP.add(mp, q0, 1, 320);
  }

  // ================= 12. TELECAMERE TV PANORAMICHE (LUNGOMARE, ROTONDA DIAZ, VESUVIO & CASTEL DELL'OVO) =================
  {
    WORLD.tvCams.length = 0;
    // Cam 0: Sopra Start/Finish — inquadra la Fiat 127 lanciarsi verso Rotonda Diaz, Castel dell'Ovo e Vesuvio!
    { const p = P(-18, -3.5); WORLD.tvCams.push({ x: p[0], y: p[1] + 5.8, z: p[2], s: 0, side: -1 }); }
    // Cam 1: Aerea su Rotonda Diaz (stile inquadratura TV "NAPOLI KART" di image_2f330de5.png!)
    { const p = P(68, 22); WORLD.tvCams.push({ x: p[0] - 42, y: p[1] + 22.0, z: p[2] + 18, s: 72, side: 1 }); }
    // Cam 2: Rettilineo Lungomare Est (verso Castel dell'Ovo e Vesuvio)
    { const p = P(245, -9); WORLD.tvCams.push({ x: p[0], y: p[1] + 5.2, z: p[2], s: 245, side: -1 }); }
    // Cam 3: Tornante Est Castel dell'Ovo
    { const p = P(392, 10); WORLD.tvCams.push({ x: p[0], y: p[1] + 6.5, z: p[2], s: 392, side: 1 }); }
    // Cam 4: Tribuna Principale A/B & Villa Comunale
    { const p = P(680, -14); WORLD.tvCams.push({ x: p[0], y: p[1] + 9.0, z: p[2], s: 680, side: -1 }); }
    // Cam 5: Tornante Ovest Mergellina
    { const p = P(980, 10); WORLD.tvCams.push({ x: p[0], y: p[1] + 6.2, z: p[2], s: 980, side: 1 }); }
    // Cam 6: Ritorno verso Start/Finish (inquadratura bassa da image_89486885.png)
    { const p = P(TRK.L - 65, -7); WORLD.tvCams.push({ x: p[0], y: p[1] + 3.6, z: p[2], s: TRK.L - 65, side: -1 }); }
  }

  WORLD.stats.tris.props = mb.ni / 3; WORLD.stats.tris.propsDS = md.ni / 3;
  WORLD.stats.ranges.props = S1.r.length; WORLD.stats.ranges.propsDS = S2.r.length;
  S1.upload(mb); S2.upload(md); SP.upload(mp);
  R.drawables.push(S1, S2, SP); PROPS.sets = [S1, S2, SP];
  WORLD.stats.tris.gente = mp.ni / 3;
}
if (WORLD.active) queueMicrotask(() => BUILD.push(async () => { propsBuild(); }));
