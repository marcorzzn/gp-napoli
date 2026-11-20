// Inizializzazione motore WebGPU Posillipo (1937 · 1955 · 2026), auto-probe .glb offline e loop principale.
const msgEl = document.getElementById('msg');
const setMsg = t => { if (msgEl) msgEl.textContent = t; };

function buildTestGround() {
  const fam = R.families.test || mkFamily('test', { src: 'mat_test' });
  const set = new MeshSet(fam); R.drawables.push(set);
  const mb = new MeshBuilder(); mb.mat(4).color(0.2, 0.2, 0.2); mb.quad(-300, 0, 300, 300, 0, 300, 300, 0, -300, -300, 0, -300);
  set.add(mb.upload(), 0, 7); return set;
}

function startFallback2D(err) {
  GAME.fallback2D = true;
  document.body.dataset.state = 'running-fallback';
  setMsg('');
  const hint = document.getElementById('hint');
  if (hint) {
    hint.textContent = 'Modalità Compatibilità Posillipo · W accelera · S frena/retro · A/D sterza · M audio';
    hint.style.opacity = 0.9;
  }
  let canvas = document.getElementById('c');
  if (!canvas) return;
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch (e) {}
  if (!ctx) {
    const parent = canvas.parentNode;
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'c';
    newCanvas.style.cssText = canvas.style.cssText;
    if (parent) parent.replaceChild(newCanvas, canvas);
    canvas = newCanvas;
    ctx = canvas.getContext('2d');
  }
  if (!ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  try { trackBuild(); } catch (e) {}
  try { heightFieldBuild(); } catch (e) {}
  try { worldMapBuild(); } catch (e) {}
  try { aiBuild(); } catch (e) {}
  if (typeof vehicleReset === 'function') vehicleReset();
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);
  if (GAME.ui && typeof uiInit === 'function') {
    try { uiInit(); } catch (e) {}
  }
  GAME.ready = true;

  let lastT = performance.now();
  function loop2D(now) {
    let dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    RT[2] = dt;
    RT[1] = dt;
    RT[0] += dt;
    if (typeof vehicleStep === 'function') {
      vehicleStep(typeof GS !== 'undefined' ? GS.held : 0);
    }
    if (typeof sndFrame === 'function') {
      try { sndFrame(); } catch (e) {}
    }

    const w = canvas.width = window.innerWidth;
    const h = canvas.height = window.innerHeight;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a1d33');
    grad.addColorStop(0.5, '#193352');
    grad.addColorStop(0.5, '#122617');
    grad.addColorStop(1, '#08110a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (TRK && TRK.x && TRK.N) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      const zoom = Math.min(w, h) / 1300;
      ctx.scale(zoom, zoom);

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(110, 197, 255, 0.45)';
      ctx.lineWidth = (TRK.hw || 4.7) * 2;
      for (let i = 0; i < TRK.N; i += 4) {
        const px = TRK.x[i] - VEH.x, pz = TRK.z[i] - VEH.z;
        if (i === 0) ctx.moveTo(px, pz); else ctx.lineTo(px, pz);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < TRK.N; i += 6) {
        const px = TRK.x[i] - VEH.x, pz = TRK.z[i] - VEH.z;
        if (i === 0) ctx.moveTo(px, pz); else ctx.lineTo(px, pz);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.save();
      ctx.rotate(-VEH.yaw || 0);
      ctx.fillStyle = ERA.id === '1937' ? '#cccccc' : ERA.id === '1955' ? '#d62828' : '#e60000';
      ctx.fillRect(-2.0, -0.85, 4.0, 1.7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.4, -0.75, 1.6, 1.5);
      ctx.fillStyle = '#111111';
      ctx.fillRect(-1.7, -1.0, 0.8, 0.35);
      ctx.fillRect(-1.7, 0.65, 0.8, 0.35);
      ctx.fillRect(1.0, -1.0, 0.8, 0.35);
      ctx.fillRect(1.0, 0.65, 0.8, 0.35);
      ctx.restore();

      ctx.restore();
    }

    const spd = Math.round((VEH.speed || 0) * 3.6);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`${spd} km/h`, 32, 54);

    ctx.fillStyle = '#7ebdff';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Epoca: ${ERA.year} · ${ERA.carName} · Quota: ${Math.round(VEH.y || 145)} m s.l.m. (Compatibilità)`, 32, 82);

    requestAnimationFrame(loop2D);
  }
  requestAnimationFrame(loop2D);
}

async function main() {
  try {
    await gpuInit();
    setMsg('Generazione Circuito di Posillipo ' + ERA.year + ' (5,13 km · ' + QUAL.label + ')…'); await new Promise(r => setTimeout(r));
    trackBuild(); heightFieldBuild(); worldMapBuild(); aiBuild();
    rendererInit();
    setMsg('Generazione cielo e Golfo di Napoli (' + ERA.year + ')…'); await skyInit();
    setMsg('Costruzione scenario Posillipo & ' + ERA.carName + '…'); await new Promise(r => setTimeout(r));
    for (const b of BUILD) await b();
    if (R.pending && R.pending.length) await Promise.all(R.pending);
    if (G.lastErr) throw new Error(G.lastErr);
    // Rilevamento automatico modello 3D fotogrammetrico offline (.glb) se presente su disco
    await tryAutoLoadPosillipoGlb();
    perfInit();
    renderStaticShadow();
    if (GAME.init) GAME.init();
    else { setCamera(6, 2.2, 7, 0, 0.6, 0, 0.9); R.cube.pos.set([0, 1.2, 0]); }
    // Cuoce tutte le 6 facce del cubemap ambientale una volta all'avvio anche sui preset statici (Molto Bassa / Bassa)
    for (let k = 0; k < 2; k++) { for (let i = 0; i < 6; i++) renderFrame(true); await computeSH(); }
    if (GAME.prewarm) {
      const worst = await GAME.prewarm(); await computeSH();
      GAME.gpuWorstMs = worst; GAME.minFrameMs = Q.get('hz') === '120' ? 0 : (Q.get('hz') === '60' || worst > 6.2) ? 14.6 : 0;
    }
    for (let i = 0; i < 4; i++) renderFrame();
    R.cam.first = true;
    setMsg(''); const hint = document.getElementById('hint'); if (hint) setTimeout(() => { hint.style.opacity = 0; }, 9000);
    if (GAME.ui) uiInit();
    GAME.ready = true;
    if (!GAME.capture) requestAnimationFrame(rafLoop);
  } catch (e) {
    console.warn('Avvio WebGPU non riuscito, passaggio a simulatore compatibilità universale:', e);
    GAME.error = e.message;
    startFallback2D(e);
  }
}

let _lastT = 0;
function rafLoop(t) {
  if (GAME.minFrameMs > 0 && _lastT && t - _lastT < GAME.minFrameMs) { requestAnimationFrame(rafLoop); return; }
  if (GAME.ui && uiFrame()) { _lastT = 0; requestAnimationFrame(rafLoop); return; }
  let dt = _lastT ? (t - _lastT) / 1000 : 1 / 60; RT[3] = dt * 1000; if (dt > 0.05) dt = 0.05; _lastT = t;
  if (PERF.rec) perfFrameTimes(t);
  RT[2] = dt;
  if (GAME.tick) GAME.tick(false); else { RT[1] = dt; RT[0] += dt; }
  renderFrame();
  if (GAME.ui) uiAfter();
  if (PERF.rec) perfJsTime();
  requestAnimationFrame(rafLoop);
}

let _cap2d = null;
window.__cap = {
  ready: () => GAME.ready, error: () => GAME.error || G.lastErr || null,
  cam(ex, ey, ez, tx, ty, tz, fov) { if (typeof GS !== 'undefined') { GS.freeCam = true; GS.cut = true; } setCamera(ex, ey, ez, tx, ty, tz, fov); },
  frames(n, dt) {
    dt = dt || 1 / 60; RT[2] = dt;
    for (let i = 0; i < n; i++) {
      if (GAME.ui && uiFrame()) continue;
      RT[3] = dt * 1000; if (GAME.tick) GAME.tick(true); else { RT[1] = dt; RT[0] += dt; } if (!this.noRender) renderFrame();
      if (GAME.ui) uiAfter();
    }
    if (this.noRender) return;
    if (!_cap2d) { _cap2d = document.createElement('canvas'); _cap2d.width = G.W; _cap2d.height = G.H; }
    _cap2d.getContext('2d').drawImage(G.canvas, 0, 0);
  },
  shot(type, q) { return _cap2d.toDataURL(type || 'image/png', q); },
  pose(i) { poseApply(i); if (!_cap2d) { _cap2d = document.createElement('canvas'); _cap2d.width = G.W; _cap2d.height = G.H; } _cap2d.getContext('2d').drawImage(G.canvas, 0, 0); return POSES[i].nome; },
  poses() { return POSES.map(p => p.nome); },
  restart() { gameRestart(); },
  state() { const V = VEH; return { era: ERA.id, qual: QUAL.id, aeroX: V.aeroX, glb: GLB_STATE.loaded, rpm: V.rpm, speed: Math.hypot(V.vx, V.vy), gear: V.gear, s: V.s, d: V.d, y: V.y, laps: V.laps }; },
  R, G, GAME, TRK, GS, VEH, ERA, QUAL, GLB_STATE,
};
main();
