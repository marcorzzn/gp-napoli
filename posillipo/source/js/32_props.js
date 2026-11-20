// Scenografia Storica & Moderna del Circuito di Posillipo (5.13 km — 1937 · 1955 · 2026)
// Architettura condivisa: mura di tufo giallo napoletano (1.95 m), siepi di alloro, ville Liberty,
// balaustre neoclassiche sul golfo, viale dei pini di Viale Virgilio, Castello e pontile di Nisida.
// Allestimenti per epoca:
//   - 1937: Torretta Razionalista bianca, balle di paglia, staccionate bianche, tribune in legno grezzo.
//   - 1955: Box in legno a cielo aperto con fusti Shell/Agip, 72+ spettatori anni '50, striscioni storici.
//   - 2026: Barriere TecPro, reti detriti, pannelli LED FIA, Hospitality Paddock vetro/carbonio, maxischermi e yacht.
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
  const C = (r, m) => `rgb(${r | 0},${m === 1 ? 255 : 0},${m === 2 ? 255 : 0})`;
  const grad = (x0, y0, x1, y1, r0, r1, m) => { const q = g.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, C(r0, m)); q.addColorStop(1, C(r1, m)); return q; };
  const u = (kind ? 35 : 31) * (0.93 + rnd() * 0.14);
  const cx = ox + W / 2 + (rnd() - 0.5) * 6, ty = oy + (kind ? 12 : 18) + rnd() * 6;
  const hx = cx, hy = ty + u * 0.5, rx = u * 0.36, ry = u * 0.48;
  const sy = ty + u * 1.15, shw = u * 0.96, hipY = sy + u * 2.05;
  if (kind) {
    const footY = oy + H - 8;
    g.fillStyle = grad(0, hipY, 0, footY, 150, 75, 2);
    g.fillRect(cx - shw * 0.65, hipY, shw * 0.52, footY - hipY);
    g.fillRect(cx + shw * 0.13, hipY, shw * 0.52, footY - hipY);
  } else {
    g.fillStyle = grad(0, hipY - 4, 0, oy + H - 6, 165, 88, 2);
    g.fillRect(cx - shw * 0.78, hipY - 4, shw * 1.56, oy + H - hipY);
  }
  g.fillStyle = grad(0, sy, 0, hipY, 232, 132, 1);
  g.beginPath(); g.roundRect(cx - shw, sy, shw * 2, hipY - sy + 4, 10); g.fill();
  g.fillStyle = C(218, 0);
  g.beginPath(); g.ellipse(hx, hy, rx, ry, 0, 0, TAU); g.fill();
  // Cappello anni '30/'50 o cap sportivo 2026
  g.fillStyle = C(110, 2);
  g.beginPath(); g.ellipse(hx, hy - ry * 0.65, rx * 1.25, ry * 0.36, 0, 0, TAU); g.fill();
}

function personStrip(n, kind, seed, pw, ph) {
  const W = n * pw * 2, H = ph * 2, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cm = mk(), gm = cm.getContext('2d'); gm.scale(2, 2);
  const rnd = mkRng(seed);
  for (let i = 0; i < n; i++) {
    gm.save(); gm.beginPath(); gm.rect(i * pw + 2, 2, pw - 4, ph - 4); gm.clip();
    personSprite(gm, i * pw, 0, pw, ph, kind, rnd); gm.restore();
  }
  const cc = mk(), gc = cc.getContext('2d');
  for (const r of [8, 4]) for (let a = 0; a < 8; a++) gc.drawImage(cm, Math.cos(a * PI / 4) * r, Math.sin(a * PI / 4) * r);
  gc.drawImage(cm, 0, 0);
  const col = gc.getImageData(0, 0, W, H).data, msk = gm.getImageData(0, 0, W, H).data, out = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { out[i * 4] = col[i * 4]; out[i * 4 + 1] = col[i * 4 + 1]; out[i * 4 + 2] = col[i * 4 + 2]; out[i * 4 + 3] = msk[i * 4 + 3]; }
  return { data: out, w: W, h: H };
}

function atlasBuild() {
  const cv = document.createElement('canvas'); cv.width = 4096; cv.height = 2048;
  const g = cv.getContext('2d'); g.scale(2, 2);
  g.fillStyle = '#888'; g.fillRect(0, 0, 2048, 1024);
  const REG = PROPS.regions, reg = (name, x, y, w, h) => { REG[name] = [x / 2048, y / 1024, (x + w) / 2048, (y + h) / 1024]; };
  const centered = (txt, x, y, w, h, th, color, weight, skew) => strokeText(g, txt, x + (w - textW(txt, th)) / 2, y + (h - th) / 2, th, color, weight, skew);

  // Portale Start / Finish per epoca
  if (ERA.id === '1937') {
    g.fillStyle = '#efeadd'; g.fillRect(0, 0, 1024, 128);
    g.fillStyle = '#1d1d1c'; g.fillRect(0, 0, 1024, 10); g.fillRect(0, 118, 1024, 10);
    centered('COPPA PRINCIPESSA DI PIEMONTE', 0, 10, 1024, 70, 38, '#141414', 1.85, 0);
    centered('CIRCUITO INTERNAZIONALE DI NAPOLI - 1937', 0, 74, 1024, 42, 21, '#343432', 1.45, 0);
  } else if (ERA.id === '1955') {
    g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 1024, 128);
    g.fillStyle = '#1b5e36'; g.fillRect(0, 0, 1024, 12); g.fillStyle = '#b91e22'; g.fillRect(0, 116, 1024, 12);
    centered('VII GRAN PREMIO DI NAPOLI', 0, 10, 1024, 70, 44, '#162844', 1.9, 0.04);
    centered('CIRCUITO DI POSILLIPO - 8 MAGGIO 1955', 0, 74, 1024, 42, 21, '#b91e22', 1.45, 0);
  } else {
    g.fillStyle = '#0e131c'; g.fillRect(0, 0, 1024, 128);
    g.fillStyle = '#009246'; g.fillRect(0, 0, 342, 12); g.fillStyle = '#ffffff'; g.fillRect(342, 0, 340, 12); g.fillStyle = '#ce2b37'; g.fillRect(682, 0, 342, 12);
    g.fillStyle = '#e62429'; g.fillRect(0, 118, 1024, 10);
    centered('GRAN PREMIO DI POSILLIPO 2026', 0, 12, 1024, 70, 40, '#ffffff', 1.85, 0.09);
    centered('NAPOLI STREET CIRCUIT - FIA GRADE 1', 0, 76, 1024, 40, 21, '#6ec5ff', 1.45, 0);
  }
  reg('name', 0, 0, 1024, 128);

  // Chevron curve
  g.fillStyle = ERA.id === '2026' ? '#12161e' : '#f2efe6'; g.fillRect(1024, 0, 512, 128);
  g.fillStyle = ERA.id === '1937' ? '#181818' : '#d01c1c';
  for (let i = 0; i < 5; i++) {
    const x = 1034 + i * 102;
    g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 48, 8); g.lineTo(x + 92, 64); g.lineTo(x + 48, 120); g.lineTo(x, 120); g.lineTo(x + 44, 64); g.closePath(); g.fill();
  }
  reg('chev', 1024, 0, 512, 128);

  // Striscione secondario
  g.fillStyle = ERA.id === '1937' ? '#20201f' : ERA.id === '1955' ? '#103b7a' : '#c81c22';
  g.fillRect(1536, 0, 512, 128);
  centered(ERA.id === '1937' ? 'PIRELLI' : ERA.id === '1955' ? 'SUPERCORTEMAGGIORE' : 'SCUDERIA POSILLIPO 2026', 1536, 0, 512, 128, ERA.id === '1937' ? 48 : 30, '#ffffff', 1.8, 0.05);
  reg('arch2', 1536, 0, 512, 128);

  // Sponsor storici / moderni per epoca
  const brands = ERA.id === '1937' ? [
    ['PIRELLI MILANO', '#ece8dc', '#181818'],
    ['ALFA ROMEO', '#1e1e1d', '#ece8dc'],
    ['OLIO SHELL', '#d8d4c8', '#1c1c1c'],
    ['REALE A C I NAPOLI', '#262624', '#f0ece0'],
    ['POSILLIPO 1937', '#e5e0d4', '#1a1a1a'],
    ['SCUDERIA FERRARI', '#1a1a1a', '#ede9dd'],
  ] : ERA.id === '1955' ? [
    ['SUPERCORTEMAGGIORE', '#f4c820', '#121212'],
    ['PIRELLI STELVIO', '#f5f1e4', '#163872'],
    ['SHELL X-100', '#e02620', '#ffd624'],
    ['MAGNETI MARELLI', '#123e84', '#ffffff'],
    ['OLIO FIAT', '#c81c22', '#f8f4e8'],
    ['LANCIA CORSE', '#103064', '#f5f2e8'],
  ] : [
    ['PIRELLI P-ZERO', '#11141c', '#ffd624'],
    ['FERRARI SF-26', '#d61c22', '#ffffff'],
    ['HP HYPER-TECH', '#0096d6', '#ffffff'],
    ['POSILLIPO GP 2026', '#101828', '#5ec2ff'],
    ['ACTIVE AERO X-MODE', '#009246', '#ffffff'],
    ['COMUNE DI NAPOLI', '#1054a4', '#ffffff'],
  ];
  brands.forEach((b, i) => {
    const x = (i % 4) * 512, y = 128 + Math.floor(i / 4) * 128;
    g.fillStyle = b[1]; g.fillRect(x, y, 512, 128);
    const th = Math.min(50, 440 / textW(b[0], 1));
    centered(b[0], x + 16, y, 480, 128, th, b[2], 1.75, ERA.id === '2026' ? 0.08 : 0.02);
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

  // Maxischermo / Tabellone cronometraggio [0..476, 512..792]
  g.fillStyle = ERA.id === '2026' ? '#09111d' : '#181b1e';
  g.fillRect(0, 512, 476, 280);
  g.fillStyle = ERA.id === '2026' ? '#d61c22' : ERA.id === '1955' ? '#103b7a' : '#2a2a28';
  g.fillRect(0, 512, 476, 54);
  centered(ERA.id === '1937' ? 'CRONOMETRAGGIO 1937' : ERA.id === '1955' ? 'ORDINE DI PASSAGGIO' : 'POSILLIPO GP LIVE', 0, 518, 476, 42, 22, '#ffffff', 1.65, 0);
  centered(ERA.id === '1937' ? '32 NUVOLARI ALFA' : ERA.id === '1955' ? '6 ASCARI LANCIA D50' : '16 FERRARI SF-26', 0, 594, 476, 46, 26, ERA.id === '1937' ? '#ece8dc' : '#ffd624', 1.7, 0);
  centered('VIALE VIRGILIO - 5.13 KM', 0, 666, 476, 38, 20, '#d8e6f6', 1.4, 0);
  centered(ERA.id === '2026' ? 'ACTIVE AERO Z / X MODE' : 'COROGLIO - MANZONI - PETRARCA', 0, 728, 476, 36, 17, '#8ec6ff', 1.35, 0);
  reg('led', 4, 516, 468, 272);

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
  const o5 = new Float64Array(5);
  const sI = s => (((Math.round(s / ds)) % N) + N) % N;
  const P = (s, d) => { trackPos(s, d, o5); const y = Math.abs(d) < hw + 2.4 ? o5[1] : hfAt(o5[0], o5[2]); return [o5[0], y, o5[2], o5[3], o5[4]]; };
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
  const rng = mkRng(ERA.year);

  const pal1937 = [[0.42, 0.40, 0.36], [0.24, 0.24, 0.24], [0.66, 0.64, 0.58], [0.34, 0.32, 0.29]];
  const pal1955 = [[0.76, 0.72, 0.62], [0.22, 0.30, 0.42], [0.58, 0.32, 0.24], [0.30, 0.36, 0.28], [0.84, 0.78, 0.66]];
  const pal2026 = [[0.78, 0.08, 0.08], [0.12, 0.34, 0.72], [0.88, 0.88, 0.90], [0.18, 0.20, 0.24], [0.92, 0.72, 0.14]];
  const cPal = ERA.id === '1937' ? pal1937 : ERA.id === '1955' ? pal1955 : pal2026;
  const person = (px, py, pz, kind, w, h, shirt) => {
    const r = REG[(kind ? 's' : 'p') + Math.floor(rng() * (kind ? 3 : 16))];
    mp.mat(1, 0, 0, 0); mp.color(shirt[0], shirt[1], shirt[2], 1);
    mp.quad(px - w / 2, py, pz, px + w / 2, py, pz, px + w / 2, py + h, pz, px - w / 2, py + h, pz, r[0], r[3], r[2], r[1]);
  };

  // ================= 1. BARRIERE LATERALI PER EPOCA + MURA DI TUFO GIALLO NAPOLETANO =================
  // Lungo tutto il circuito di Posillipo (~5.13 km) a passo 14 m per tenere il budget di triangoli ideale su APU 2014
  {
    const step = QUAL.id === 'molto-bassa' ? 18 : 14;
    let i0 = mb.ni, segCount = 0;
    for (let s = 0; s < TRK.L; s += step) {
      const i = sI(s), iNext = sI(s + step);
      const isVirgilio = s < 560 || s > TRK.L - 180;
      const isCliff = s >= 560 && s < 2250; // Parco Virgiliano & Discesa Coroglio sul Golfo/Nisida
      const isTuffSection = s >= 2250 && s < TRK.L - 180; // Via Boccaccio, Via Manzoni, Via Petrarca

      for (const side of [-1, 1]) {
        const bar = side < 0 ? TRK.barL[i] : TRK.barR[i];
        const barN = side < 0 ? TRK.barL[iNext] : TRK.barR[iNext];
        const p0 = P(s, side * bar), p1 = P(s + step, side * barN);
        const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
        const len = Math.hypot(dx, dz);
        if (len < 1.0) continue;
        const tx = dx / len, tz = dz / len, rx = -tz, rz = tx;
        const mF = m4basis(m4(), tx, 0, tz, 0, 1, 0, rx, 0, rz, (p0[0] + p1[0]) * 0.5, (p0[1] + p1[1]) * 0.5, (p0[2] + p1[2]) * 0.5);
        mb.push(mF);

        if (ERA.id === '2026') {
          // Barriere TecPro bicolore rosso/bianco + rete detriti FIA
          const redBlock = (Math.floor(s / step) & 1) === 0;
          mb.mat(2, 110, 0);
          col(mb, redBlock ? 0.78 : 0.90, redBlock ? 0.08 : 0.90, redBlock ? 0.08 : 0.92);
          Bx(mb, -len * 0.5, len * 0.5, -0.2, 1.08, -0.34, 0.34);
          // Rete metallica di contenimento detriti
          mb.mat(1, 0, 0, 75); col(mb, 0.65, 0.68, 0.72);
          Bx(mb, -len * 0.48, -len * 0.48 + 0.09, 1.05, 3.1, -0.05, 0.05);
          Bx(mb, -len * 0.5, len * 0.5, 2.95, 3.05, -0.04, 0.04);
        } else if (isTuffSection) {
          // Muro storico in TUFO GIALLO NAPOLETANO (1.95 m) + copertina in piperno scuro + siepe di alloro
          mb.mat(3); col(mb, 0.76, 0.63, 0.36);
          Bx(mb, -len * 0.52, len * 0.52, -0.8, 1.95, -0.26, 0.26);
          col(mb, 0.36, 0.35, 0.34);
          Bx(mb, -len * 0.52, len * 0.52, 1.95, 2.12, -0.31, 0.31);
          // Siepe mediterranea di alloro che sporge sopra il muro di tufo
          mb.mat(2, 220, 0); col(mb, 0.14, 0.27, 0.11);
          Bx(mb, -len * 0.48, len * 0.48, 2.08, 2.68, side * 0.12, side * 0.68);
        } else if (isCliff && side > 0) {
          // Balaustra neoclassica bianca a strapiombo su Nisida e Coroglio!
          mb.mat(3); col(mb, 0.88, 0.86, 0.80);
          Bx(mb, -len * 0.52, len * 0.52, -0.5, 0.28, -0.22, 0.22);
          Bx(mb, -len * 0.52, len * 0.52, 0.96, 1.12, -0.24, 0.24);
          for (let u = -len * 0.42; u <= len * 0.42; u += 2.2) Bx(mb, u - 0.11, u + 0.11, 0.26, 0.98, -0.14, 0.14);
        } else if (ERA.id === '1937') {
          // Staccionata bianca in legno 1937 + balle di paglia dorate in curva
          mb.mat(2, 180, 0); col(mb, 0.90, 0.88, 0.82);
          Bx(mb, -len * 0.5, len * 0.5, 0.72, 0.88, -0.06, 0.06);
          Bx(mb, -len * 0.5, len * 0.5, 0.34, 0.46, -0.06, 0.06);
          Bx(mb, -len * 0.45, -len * 0.45 + 0.12, -0.2, 1.02, -0.07, 0.07);
          if (Math.abs(TRK.curv[i]) > 0.008) {
            mb.mat(10); col(mb, 0.76, 0.62, 0.28);
            Bx(mb, -len * 0.42, len * 0.42, 0.0, 0.88, -side * 0.46, -side * 0.04);
          }
        } else {
          // 1955: Cordolo in basalto vulcanico + balle di paglia nei tratti veloci
          mb.mat(3); col(mb, 0.44, 0.44, 0.46);
          Bx(mb, -len * 0.52, len * 0.52, -0.2, 0.46, -0.22, 0.22);
          if (Math.abs(TRK.curv[i]) > 0.007 || isVirgilio) {
            mb.mat(10); col(mb, 0.74, 0.58, 0.26);
            Bx(mb, -len * 0.35, len * 0.35, 0.0, 0.84, -side * 0.44, -side * 0.06);
          }
        }
        mb.pop();
      }
      if (++segCount >= 18) { S1.add(mb, i0, 7, 1100); i0 = mb.ni; segCount = 0; }
    }
    if (segCount) S1.add(mb, i0, 7, 1100);
  }

  // ================= 2. PORTALE DI PARTENZA, TORRETTA RAZIONALISTA (1937) / BOX (1955) / PADDOCK (2026) =================
  {
    const i0 = mb.ni, k0 = md.ni;
    const span = hw + 2.8;
    // Portale Start / Finish (s = 0)
    at(mb, 0, 0, 0, m => {
      if (ERA.id === '1937') {
        m.mat(2, 170, 0); col(m, 0.86, 0.84, 0.78);
        Bx(m, -0.45, 0.45, -0.4, 6.2, -span - 0.6, -span + 0.4);
        Bx(m, -0.45, 0.45, -0.4, 6.2, span - 0.4, span + 0.6);
        Bx(m, -0.22, 0.22, 5.2, 6.4, -span, span);
      } else if (ERA.id === '1955') {
        m.mat(1); col(m, 0.64, 0.66, 0.68);
        Bx(m, -0.35, 0.35, -0.4, 6.4, -span - 0.5, -span + 0.35);
        Bx(m, -0.35, 0.35, -0.4, 6.4, span - 0.35, span + 0.5);
        m.mat(2, 140, 0); col(m, 0.92, 0.90, 0.84);
        Bx(m, -0.28, 0.28, 5.1, 6.5, -span, span);
      } else {
        // Portale FIA moderno in carbonio scuro con 5 semafori rossi
        m.mat(17); col(m, 0.14, 0.16, 0.20);
        Bx(m, -0.55, 0.55, -0.4, 7.2, -span - 0.8, -span + 0.4);
        Bx(m, -0.55, 0.55, -0.4, 7.2, span - 0.4, span + 0.8);
        Bx(m, -0.50, 0.50, 5.5, 7.1, -span - 0.4, span + 0.4);
        for (let l = -2; l <= 2; l++) {
          m.mat(2, 120, 0); col(m, 0.06, 0.06, 0.07);
          Bx(m, -0.62, -0.50, 4.95, 5.45, l * 1.15 - 0.22, l * 1.15 + 0.22);
          m.mat(18, 220, 0); col(m, 0.96, 0.06, 0.03);
          Bx(m, -0.65, -0.61, 5.06, 5.34, l * 1.15 - 0.12, l * 1.15 + 0.12);
        }
      }
    });
    at(md, 0, 0, 0, m => {
      sign(m, -0.54, 5.3, -span + 0.6, 0, 0, (span - 0.6) * 2, 1.35, 'name', 0);
      sign(m, 0.54, 5.3, span - 0.6, 0, 0, -(span - 0.6) * 2, 1.35, 'name', 0);
    });

    // EDIFICIO ICONICO DI VIALE VIRGILIO (lato sinistro d = -(hw + 8.5), s = 10..110)
    if (ERA.id === '1937') {
      // TORRETTA RAZIONALISTA BIANCA A DUE PIANI (foto storica partenza 1937!)
      at(mb, 18, -(hw + 8.0), 0, m => {
        m.mat(3); col(m, 0.93, 0.92, 0.88);
        Bx(m, -6.5, 6.5, -1.0, 9.8, -4.5, 4.5); // corpo principale bianco
        Bx(m, -7.2, 7.2, 4.4, 5.0, -5.0, 5.0);  // balconata razionalista aggettante
        Bx(m, -4.0, 4.0, 9.8, 12.2, -3.2, 3.2); // torretta cronometristi superiore
        // Finestre a nastro scure
        m.mat(5); col(m, 0.25, 0.28, 0.32);
        m.quad(-6.0, 5.6, 4.56, 6.0, 5.6, 4.56, 6.0, 8.4, 4.56, -6.0, 8.4, 4.56, 0, 0, 12, 2.8);
        m.quad(-3.5, 10.2, 3.26, 3.5, 10.2, 3.26, 3.5, 11.6, 3.26, -3.5, 11.6, 3.26, 0, 0, 7, 1.4);
        // Pennone bandiera sulla torretta
        m.mat(1); col(m, 0.82, 0.82, 0.84);
        Bx(m, -0.08, 0.08, 12.2, 18.5, -0.08, 0.08);
        m.mat(10); col(m, 0.78, 0.78, 0.76);
        Bx(m, 0.08, 2.8, 16.5, 18.2, -0.04, 0.04);
      });
    } else if (ERA.id === '1955') {
      // BOX IN LEGNO A CIELO APERTO CON TETTOIA E FUSTI SHELL / AGIP (1955)
      at(mb, 52, -(hw + 7.2), 0, m => {
        m.mat(2, 195, 0); col(m, 0.56, 0.42, 0.26); // legno grezzo
        Bx(m, -44, 44, -0.5, 3.2, -3.6, -3.2);      // parete di fondo box
        m.mat(9); col(m, 0.68, 0.66, 0.62);         // tettoia in lamiera ondulata
        Bx(m, -45, 45, 3.1, 3.4, -4.0, 2.4);
        m.mat(2, 180, 0); col(m, 0.48, 0.36, 0.22);
        for (let x = -42; x <= 42; x += 7) Bx(m, x - 0.14, x + 0.14, -0.4, 3.2, 1.9, 2.18);
        // Muretto dei cronometristi e fusti benzina Shell (giallo) / Agip (rosso)
        m.mat(3); col(m, 0.82, 0.80, 0.74);
        Bx(m, -44, 44, -0.2, 1.05, 2.1, 2.45);
        for (let x = -38; x <= 38; x += 11) {
          m.mat(2, 95, 60); col(m, (x & 1) ? 0.88 : 0.82, (x & 1) ? 0.72 : 0.12, (x & 1) ? 0.10 : 0.10);
          m.cyl(x, 0.0, 0.9, 0.32, 0.96, 0.32, 10, true, true);
        }
      });
    } else {
      // HOSPITALITY PADDOCK & PIT BUILDING 2026 (carbonio + facciata continua a specchio + LED rossi)
      at(mb, 56, -(hw + 9.5), 0, m => {
        m.mat(17); col(m, 0.12, 0.14, 0.18);
        Bx(m, -52, 52, -0.8, 10.6, -5.8, 5.2);
        // Facciata vetrata riflettente 2 piani
        m.mat(5); col(m, 1, 1, 1);
        m.quad(-50, 3.8, 5.28, 50, 3.8, 5.28, 50, 9.8, 5.28, -50, 9.8, 5.28, 0, 0, 100, 6.0);
        // Mensola rossa Ferrari / FIA e luci LED
        m.mat(2, 80, 40); col(m, 0.82, 0.06, 0.05);
        Bx(m, -53, 53, 3.4, 3.85, 4.8, 6.4);
        Bx(m, -53, 53, 10.2, 10.8, -6.0, 6.6);
        m.mat(6, 200); col(m, 0.95, 0.98, 1.0);
        Bx(m, -50, 50, 3.3, 3.42, 5.6, 6.1);
      });
    }
    S1.add(mb, i0, 7, 1600);
    S2.add(md, k0, 7, 1600);
  }

  // ================= 3. TRIBUNA PRINCIPALE VIALE VIRGILIO + 72+ SPETTATORI =================
  {
    const i0 = mb.ni, p0 = mp.ni;
    const standS = ERA.id === '1937' ? 115 : 155;
    at(mb, standS, -(hw + 8.8), 0, m => {
      const len = 56, rows = 6;
      // Struttura gradinata (legno grezzo 1937/1955 vs acciaio/carbonio 2026)
      m.mat(ERA.id === '2026' ? 17 : 2, 180, 0);
      col(m, ERA.id === '2026' ? 0.16 : 0.54, ERA.id === '2026' ? 0.18 : 0.42, ERA.id === '2026' ? 0.22 : 0.28);
      for (let r = 0; r < rows; r++) {
        Bx(m, -len * 0.5, len * 0.5, -0.5, 0.7 + r * 0.62, -r * 0.95 - 0.9, -r * 0.95);
      }
      // Copertura tendone ecrù (1937/1955) o pensilina moderna (2026)
      m.mat(ERA.id === '2026' ? 9 : 10);
      col(m, ERA.id === '2026' ? 0.86 : 0.90, ERA.id === '2026' ? 0.88 : 0.86, ERA.id === '2026' ? 0.92 : 0.76);
      Bx(m, -len * 0.52, len * 0.52, 6.2, 6.5, -rows * 0.98 - 0.8, 1.2);
      m.mat(1); col(m, 0.65, 0.65, 0.68);
      for (let x = -len * 0.48; x <= len * 0.48; x += 8) Bx(m, x - 0.12, x + 0.12, 0, 6.3, -rows * 0.95 - 0.4, -rows * 0.95 - 0.2);
    });
    // Popolamento 84 spettatori seduti sulle gradinate + lungo il bordo pista
    mp.push(frame(standS, -(hw + 8.8)));
    for (let r = 0; r < 5; r++) {
      for (let x = -25; x <= 25; x += 2.9) {
        if (rng() < 0.14) continue;
        person(x + (rng() - 0.5) * 0.6, 0.85 + r * 0.62, -r * 0.95 - 0.45, 0, 0.68, 1.15, cPal[Math.floor(rng() * cPal.length)]);
      }
    }
    mp.pop();
    // Spettatori in piedi / commissari al belvedere e alle curve storiche
    for (const [s, d] of [[280, -(hw + 4.5)], [420, hw + 4.5], [760, -(hw + 4.5)], [1680, -(hw + 4.5)], [2860, hw + 4.5], [3950, -(hw + 4.5)]]) {
      mp.push(frame(s, d));
      for (let k = -2; k <= 2; k++) {
        person(k * 1.4, 0.05, 0, 1, 0.62, 1.65, ERA.id === '2026' && k === 0 ? [0.95, 0.42, 0.05] : cPal[Math.floor(rng() * cPal.length)]);
      }
      mp.pop();
    }
    S1.add(mb, i0, 7, 1400);
    SP.add(mp, p0, 1, 460);
  }

  // ================= 4. MAXISCHERMI / TABELLONI, STRISCIONI EPOCA E PANNELLI LED FIA (2026) =================
  {
    const i0 = mb.ni, k0 = md.ni;
    // Tabellone / Maxischermo su Viale Virgilio e al Parco Virgiliano
    for (const [s, d, yaw] of [[85, hw + 5.6, -0.35], [580, -(hw + 6.5), 0.32]]) {
      at(mb, s, d, yaw, m => {
        m.mat(1); col(m, 0.25, 0.26, 0.28);
        Bx(m, -4.6, -4.1, -0.5, 6.2, -0.3, 0.3);
        Bx(m, 4.1, 4.6, -0.5, 6.2, -0.3, 0.3);
        Bx(m, -4.8, 4.8, 2.2, 6.5, -0.22, 0.22);
      });
      at(md, s, d, yaw, m => {
        sign(m, -4.5, 2.4, 0.26, 9.0, 0, 0, 3.9, 'led', 0);
        sign(m, 4.5, 2.4, -0.26, -9.0, 0, 0, 3.9, 'led', 0);
      });
    }
    // Striscioni pubblicitari / storici distribuiti sul circuito (passo 180 m)
    let bi = 0;
    for (let s = 220; s < TRK.L - 120; s += 190) {
      const side = (bi & 1) ? 1 : -1;
      const i = sI(s), bar = side < 0 ? TRK.barL[i] : TRK.barR[i];
      at(mb, s, side * (bar + 0.9), 0, m => {
        m.mat(2, 160, 0); col(m, 0.28, 0.28, 0.28);
        Bx(m, -3.2, -3.05, -0.3, 2.3, -0.08, 0.08);
        Bx(m, 3.05, 3.2, -0.3, 2.3, -0.08, 0.08);
      });
      at(md, s, side * (bar + 0.9), 0, m => {
        const nm = 'b' + (bi % PROPS.nBrands);
        if (side < 0) sign(m, -3.1, 0.95, 0.10, 6.2, 0, 0, 1.32, nm, 110);
        else sign(m, 3.1, 0.95, -0.10, -6.2, 0, 0, 1.32, nm, 110);
      });
      // Pannelli luminosi LED marshal (solo 2026)
      if (ERA.id === '2026') {
        at(mb, s + 40, -side * (bar + 0.7), 0, m => {
          m.mat(1); col(m, 0.16, 0.18, 0.20); Bx(m, -0.1, 0.1, -0.2, 2.5, -0.1, 0.1);
          m.mat(6, 220); col(m, 0.08, 0.92, 0.36); Bx(m, -0.55, 0.55, 1.8, 2.45, -0.14, 0.14);
        });
      }
      bi++;
    }
    // Chevron alle curve principali di Posillipo
    for (const c of TRK.corners) {
      for (let s = c.s0 + 18; s < c.s1 - 12; s += 26) {
        const side = c.dir > 0 ? -1 : 1;
        const i = sI(s), bar = side < 0 ? TRK.barL[i] : TRK.barR[i];
        at(md, s, side * (bar + 0.6), 0, m => {
          if (side < 0) sign(m, -2.4, 0.9, 0.1, 4.8, 0, 0, 1.15, 'chev', 95);
          else sign(m, 2.4, 0.9, -0.1, -4.8, 0, 0, 1.15, 'chev', 95);
        });
      }
    }
    S1.add(mb, i0, 7, 1100);
    S2.add(md, k0, 7, 1100);
  }

  // ================= 5. PINI MARITTIMI DI VIALE VIRGILIO (PINUS PINEA) & VILLE LIBERTY DI POSILLIPO =================
  {
    const i0 = mb.ni;
    // Filare monumentale di pini domestici su Viale Virgilio (foto 1955 rettilineo)
    for (let s = 40; s < 540; s += 26) {
      for (const side of [-1, 1]) {
        if (side < 0 && s < 210) continue; // lascia libera l'area Torretta / Box / Tribuna
        at(mb, s, side * (hw + 5.8), 0, m => {
          const h = 11.5 + (s % 5) * 0.9;
          m.mat(2, 230, 0); col(m, 0.36, 0.25, 0.18);
          m.cyl(0, -0.6, 0, 0.42, h, 0.24, 8, false, false);
          // Chioma ad ombrello mediterranea
          m.mat(2, 235, 0); col(m, 0.14, 0.26, 0.12);
          m.cyl(0, h - 1.4, 0, 3.8, h + 1.4, 5.2, 10, true, true);
          m.cyl(0, h + 1.2, 0, 4.8, h + 2.8, 2.2, 10, false, true);
        });
      }
    }
    S1.add(mb, i0, 7, 1400);

    // Ville storiche napoletane / Liberty di Posillipo lungo Via Manzoni, Via Petrarca e Via Boccaccio
    const v0 = mb.ni;
    const villaCols = [[0.86, 0.78, 0.62], [0.80, 0.56, 0.42], [0.90, 0.87, 0.80], [0.84, 0.72, 0.48]];
    for (let s = 2350; s < TRK.L - 220; s += 115) {
      const side = ((Math.floor(s / 115)) & 1) ? 1 : -1;
      const p = P(s, side * (hw + 22));
      if (p[1] < 40) continue;
      const c = villaCols[Math.floor(rng() * villaCols.length)];
      const w = 16 + rng() * 10, d = 14 + rng() * 8, h = 11 + rng() * 9;
      mb.push(m4translate(m4(), p[0], p[1] - 2.5, p[2]));
      mb.mat(3); col(mb, c[0], c[1], c[2]);
      Bx(mb, -w * 0.5, w * 0.5, 0, h, -d * 0.5, d * 0.5);
      // Tetto a padiglione in tegole terracotta
      mb.mat(2, 200, 0); col(mb, 0.56, 0.26, 0.16);
      Bx(mb, -w * 0.52, w * 0.52, h, h + 1.4, -d * 0.52, d * 0.52);
      mb.pop();
    }
    S1.add(mb, v0, 7, 2200);
  }

  // ================= 6. ISOLA DI NISIDA (CASTELLO & PONTILE BORBONICO) + YACHT NEL GOLFO (2026) =================
  {
    const i0 = mb.ni;
    // Fortezza / Castello sull'Isola di Nisida (x = 1140, z = 440, quota ~102 m)
    const nx = 1140, nz = 440, ny = hfAt(nx, nz) - 2.0;
    mb.push(m4translate(m4(), nx, ny, nz));
    mb.mat(3); col(mb, 0.78, 0.70, 0.52);
    Bx(mb, -28, 28, -4, 16, -24, 24);
    Bx(mb, -18, 18, 16, 26, -16, 16);
    mb.mat(2, 190, 0); col(mb, 0.52, 0.26, 0.16);
    Bx(mb, -19, 19, 26, 28.5, -17, 17);
    mb.pop();
    // Pontile borbonico in pietra tra Coroglio e Nisida (z ≈ 415, x = 830..1010)
    mb.mat(3); col(mb, 0.58, 0.56, 0.50);
    Bx(mb, 830, 1015, -2.0, 4.2, 408, 424);

    // Yacht moderni ormeggiati nella baia di Nisida / Coroglio (solo 2026!)
    if (ERA.id === '2026') {
      for (const [yx, yz, yaw, len] of [[890, 620, 0.4, 34], [960, 700, -0.3, 42], [790, 740, 0.8, 28], [1080, 760, 0.15, 38]]) {
        mb.push(m4mul(m4(), m4translate(m4(), yx, 0.2, yz), m4rotY(m4(), yaw)));
        mb.mat(2, 60, 10); col(mb, 0.94, 0.95, 0.97);
        Bx(mb, -len * 0.5, len * 0.5, 0, 2.8, -4.0, 4.0);
        Bx(mb, -len * 0.34, len * 0.22, 2.8, 6.2, -3.1, 3.1);
        mb.mat(5); col(mb, 0.12, 0.20, 0.32);
        Bx(mb, -len * 0.30, len * 0.18, 3.4, 5.4, -3.2, 3.2);
        mb.pop();
      }
    }
    S1.add(mb, i0, 7, 4200);
  }

  // ================= 7. 14 TELECAMERE TV PANORAMICHE SU POSILLIPO =================
  {
    WORLD.tvCams.length = 0;
    const tvSpots = [
      [0, -1, 6.2], [240, 1, 5.4], [540, -1, 9.5], [880, 1, 8.2],
      [1260, -1, 6.5], [1640, 1, 8.5], [2020, -1, 7.2], [2440, 1, 6.0],
      [2880, -1, 6.8], [3320, 1, 6.2], [3760, -1, 6.5], [4200, 1, 6.4],
      [4620, -1, 5.8], [TRK.L - 120, -1, 5.5],
    ];
    for (const [s, side, h] of tvSpots) {
      const i = sI(s), bar = side < 0 ? TRK.barL[i] : TRK.barR[i];
      const p = P(s, side * (bar + 3.2));
      WORLD.tvCams.push({ x: p[0], y: p[1] + h, z: p[2], s, side });
    }
  }

  WORLD.stats.tris.props = mb.ni / 3; WORLD.stats.tris.propsDS = md.ni / 3;
  WORLD.stats.ranges.props = S1.r.length; WORLD.stats.ranges.propsDS = S2.r.length;
  S1.upload(mb); S2.upload(md); SP.upload(mp);
  R.drawables.push(S1, S2, SP); PROPS.sets = [S1, S2, SP];
  WORLD.stats.tris.gente = mp.ni / 3;
}
if (WORLD.active) queueMicrotask(() => BUILD.push(async () => { propsBuild(); }));
