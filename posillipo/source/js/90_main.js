// Inizializzazione motore WebGPU Posillipo (1937 · 1955 · 2026), auto-probe .glb offline e loop principale.
const msgEl = document.getElementById('msg');
const setMsg = t => { if (msgEl) msgEl.textContent = t; };

function buildTestGround() {
  const fam = R.families.test || mkFamily('test', { src: 'mat_test' });
  const set = new MeshSet(fam); R.drawables.push(set);
  const mb = new MeshBuilder(); mb.mat(4).color(0.2, 0.2, 0.2); mb.quad(-300, 0, 300, 300, 0, 300, 300, 0, -300, -300, 0, -300);
  set.add(mb.upload(), 0, 7); return set;
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
    await Promise.all(R.pending);
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
    document.body.dataset.state = 'webgpu-unavailable';
    const hint = document.getElementById('hint');
    if (hint) hint.style.display = 'none';
    if (msgEl) {
      const safeMsg = String(e && e.message ? e.message : e).replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]));
      msgEl.innerHTML =
        '<div class="err-card">' +
        '<p class="err-eyebrow">Circuito di Posillipo · ' + ERA.year + ' · ' + ERA.carName + ' (' + QUAL.label + ')</p>' +
        '<h1 class="err-title">WebGPU richiesto per il circuito 3D</h1>' +
        '<p class="err-body">Questo simulatore usa il motore WebGPU nativo con preset ' + QUAL.label + ' (' + safeMsg + '). Apri la pagina in Chrome, Edge o Safari 18+ con accelerazione hardware GPU attiva per guidare a Posillipo.</p>' +
        '<div class="err-actions"><a class="err-link" href="/">← Torna alla panoramica</a></div>' +
        '</div>';
    }
    console.error(e); GAME.error = e.message;
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
  state() { const V = VEH; return { era: ERA.id, qual: QUAL.id, aeroX: V.aeroX, glb: GLB.loaded, rpm: V.rpm, speed: Math.hypot(V.vx, V.vy), gear: V.gear, s: V.s, d: V.d, y: V.y, laps: V.laps }; },
  R, G, GAME, TRK, GS, VEH, ERA, QUAL, GLB,
};
main();
