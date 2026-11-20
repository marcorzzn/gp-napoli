// ---------------------------------------------------------------------------
// som.js — todo o som é sintetizado na hora com Web Audio (nenhuma amostra):
// motor 4 cilindros, pneus, vento/rodagem, ambiente (mata, pássaros, público).
// O modelo (M) avança no passo da física, determinístico; o mesmo grafo roda em
// tempo real (AudioContext) e fora do tempo real (OfflineAudioContext).
// ---------------------------------------------------------------------------
'use strict';

const SND = (() => {
  const S = {};
  // ---- modelo: 0 giro do som (rpm), 1 carga, 2 pneu diant., 3 pneu tras., 4 pan diant., 5 pan tras., 6 |v| m/s,
  // 7 fora do asfalto, 8 zebra, 9 público, 10 pan do público, 11 marcha anterior, 12 estalo da troca (envelope), 13 batida (envelope), 14 vel. de escorregamento (m/s)
  const M = new Float64Array(16);
  S.M = M;
  S.reset = () => { M.fill(0); M[0] = PHYS.idle; M[1] = 0.28; M[11] = 1; };
  S.reset();
  S.simStep = (car, dt) => {
    const P = PHYS;
    // giro: o da física (preso às rodas) mais a patinagem de embreagem na saída em 1ª/ré
    let tg = car.rpm;
    if (car.gear === 1 || car.reverse) { const sl = P.idle + car.thr * 1900; if (sl > tg) tg = sl; }
    if (tg > 6700) tg = 6700;
    M[0] += (tg - M[0]) * (tg > M[0] ? 0.15 : 0.11);
    // carga: acelerador, corte na troca de marcha e corte de giro
    let ld = car.thr * (car.shiftT > 0.12 ? 0.1 : 1);
    if (car.rpm >= P.redline && ((car.time * 21) % 1) < 0.45) ld *= 0.2;
    const il = 0.28 * (1 - clamp((M[0] - 1000) / 900, 0, 1));
    if (ld < il) ld = il;
    M[1] += (ld - M[1]) * 0.25;
    // pneus: só no asfalto/zebra, além do pico de aderência, na proporção da velocidade de escorregamento
    let aF = 0, aR = 0, pF = 0, pR = 0, off = 0, kerb = 0, sv = 0;
    for (let k = 0; k < 4; k++) {
      const sf = car.surf[k];
      if (sf > 1) { off += 0.25; continue; }
      if (sf === 1) kerb += 0.5;
      const sl = car.slip[k];
      const q = clamp((car.sn[k] - 0.9) / 0.9, 0, 1) * clamp((sl - 0.8) / 2.5, 0, 1) * (0.25 + 0.75 * clamp(sl / 26, 0, 1)) * clamp(car.load[k] / 2100, 0.25, 1.2) * (1 - car.wetW[k] * 0.6);
      const sd = k & 1 ? 1 : -1;
      if (k < 2) { if (q > aF) aF = q; pF += sd * q; } else { if (q > aR) aR = q; pR += sd * q; }
      if (q > 0 && sl > sv) sv = sl;
    }
    M[2] = aF > 1 ? 1 : aF; M[3] = aR > 1 ? 1 : aR; M[4] = clamp(pF * 0.6, -0.6, 0.6); M[5] = clamp(pR * 0.6, -0.6, 0.6);
    M[6] = Math.hypot(car.u, car.v); M[7] = off; M[8] = kerb > 1 ? 1 : kerb; M[14] = sv;
    // público: distância ao lance da arquibancada (x de -150 a -15, z ≈ 20) e lado em relação ao carro
    const nx = clamp(car.x, -150, -15), dx = nx - car.x, dz = 20 - car.z, d2 = dx * dx + dz * dz;
    M[9] = 1 / (1 + d2 / 1100);
    M[10] = (-Math.sin(car.psi) * dx + Math.cos(car.psi) * dz) / (Math.sqrt(d2) + 1) * 0.7;
    const g = car.reverse ? -1 : car.gear;
    // envelopes dos eventos (troca de marcha, batida) no passo da simulação: nada é agendado durante o jogo
    M[12] *= 0.72; M[13] *= 0.9;
    if (g !== M[11]) { M[11] = g; M[12] = 1; }
    const wh = car.wallHit > 14 ? 1.6 : car.wallHit / 9;
    if (wh > M[13]) M[13] = wh;
  };

  // ---- construção do grafo (uma vez por contexto)
  const gain = (ac, v) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const biq = (ac, type, f, q, db) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (db) b.gain.value = db; return b; };
  const loop = (ac, buf, rate, off) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(0, off); return s; };
  const chain = (...n) => { for (let i = 1; i < n.length; i++) n[i - 1].connect(n[i]); return n[n.length - 1]; };
  const pan = (ac, p) => { const n = ac.createStereoPanner(); n.pan.value = p; return n; };
  function noiseBuf(ac) {
    const n = ac.sampleRate * 4, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0), r = makeRng(1996);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    return b;
  }
  // onda de um ciclo do motor (720°): harmônico k = ordem k/2; as explosões são k = 4, 8, 12…
  // tipo 0 = aliviado (macio), 1 = em carga (áspero, mais meias-ordens)
  function wave(ac, kind) {
    const K = 1024, re = new Float32Array(K + 1), im = new Float32Array(K + 1), r = makeRng(40 + kind);
    for (let k = 1; k <= K; k++) {
      const m = k / 4, fire = (k & 3) === 0;
      let a = Math.pow(m, kind ? -1.0 : -1.35) * Math.exp(-m / (kind ? 80 : 40));
      if (!fire) a *= (k & 1 ? (kind ? 0.2 : 0.08) : (kind ? 0.3 : 0.13)) * (0.4 + 1.2 * r()) * (m < 1 ? m : 1);
      const ph = fire ? (r() - 0.5) * 0.6 : r() * TAU;
      im[k] = a * Math.cos(ph); re[k] = a * Math.sin(ph);
    }
    return ac.createPeriodicWave(re, im);
  }
  // trem de pulsos (um por explosão), entre 0 e 1 depois de somado a `base`: modula o ruído de combustão
  function pulseWave(ac, out) {
    const A = new Float64Array(13); let pk = 0, mn = 0;
    for (let m = 1; m <= 12; m++) { A[m] = Math.exp(-m * m / 30); pk += A[m]; }
    for (let i = 0; i < 256; i++) { let v = 0; for (let m = 1; m <= 12; m++) v += A[m] * Math.cos(m * i / 256 * TAU); if (v < mn) mn = v; }
    const re = new Float32Array(49), im = new Float32Array(49);
    for (let m = 1; m <= 12; m++) re[m * 4] = A[m] / (pk - mn);
    out.base = -mn / (pk - mn);
    return ac.createPeriodicWave(re, im, { disableNormalization: true });
  }
  function curve(fn) { const c = new Float32Array(2049); for (let i = 0; i < 2049; i++) c[i] = fn(i / 1024 - 1); return c; }
  const SOFT = (x) => { const a = Math.abs(x); return a <= 0.5 ? x : Math.sign(x) * (0.5 + 0.45 * Math.tanh((a - 0.5) / 0.45)); };

  // pássaros: frases assobiadas escritas num buffer em laço (sem agendamento durante o jogo)
  function birdBuf(ac, seed, secs) {
    const sr = ac.sampleRate, n = (sr * secs) | 0, b = ac.createBuffer(1, n, sr), d = b.getChannelData(0), r = makeRng(seed);
    const note = (t0, dur, f0, f1, a) => {
      const i0 = (t0 * sr) | 0, m = (dur * sr) | 0; let ph = 0;
      for (let i = 0; i < m && i0 + i < n; i++) {
        const x = i / m, e = Math.min(1, x * dur / 0.012, (1 - x) * dur / 0.022);
        ph += TAU * f0 * Math.pow(f1 / f0, x) / sr;
        d[i0 + i] += (Math.sin(ph) + 0.18 * Math.sin(2 * ph)) * e * e * a;
      }
    };
    let x = 0.5 + r() * 1.5;
    while (x < secs - 2.2) {
      const k = (r() * 3) | 0, lv = 0.4 + r() * 0.6;
      if (k === 0) {            // frase aflautada: 3 a 5 notas com glissando
        const c = 3 + ((r() * 3) | 0);
        for (let i = 0; i < c; i++) { const dn = 0.11 + r() * 0.1, f0 = 1900 + r() * 1300; note(x, dn, f0, f0 * (0.8 + r() * 0.45), lv); x += dn + 0.05 + r() * 0.07; }
      } else if (k === 1) {     // trinado descendente
        const c = 7 + ((r() * 8) | 0), f0 = 4300 + r() * 1200;
        for (let i = 0; i < c; i++) { note(x, 0.036, f0 * (1 - i * 0.012), f0 * (0.84 - i * 0.012), lv * 0.7); x += 0.062; }
      } else {                  // três notas: média, aguda, longa caindo
        note(x, 0.1, 2350, 2500, lv); note(x + 0.16, 0.09, 2850, 3000, lv); note(x + 0.31, 0.3, 3500, 2950, lv); x += 0.61;
      }
      x += 1.1 + r() * 3.4;
    }
    return b;
  }

  // opt: { mudo, solo }  solo ∈ motor | pneus | vento | piso | ambiente | publico (trilha isolada, para medição)
  const NC = 24;
  // volume geral (depois do limitador, vale para tudo) e nível da camada de ambiente (mata, pássaros, público) antes dele
  const GERAL = 0.4, AMBIENTE = 0.75;
  function build(ac, opt) {
    const V = { ac, c: [], last: new Int32Array(NC).fill(-1 << 30) };
    const nz = noiseBuf(ac), solo = opt && opt.solo;
    const out = gain(ac, 1), clip = ac.createWaveShaper(), mute = gain(ac, opt && opt.mudo ? 0 : 1), nil = gain(ac, 0);
    clip.curve = curve(SOFT);
    chain(out, clip, gain(ac, GERAL), mute, ac.destination); nil.connect(out);
    const car = gain(ac, 0), amb = gain(ac, AMBIENTE);
    car.connect(out); amb.connect(out);
    const to = (node, name, bus) => node.connect(!solo || solo === name ? bus : nil);
    V.mute = mute.gain; V.out = mute;
    const lfo = (rate, off) => loop(ac, nz, rate / ac.sampleRate, off);   // ruído lento: `rate` valores por segundo, interpolados
    // controle: valor inteiro escrito por quadro (sem alocar) → escala → passa-baixas (suaviza os degraus) → parâmetros
    const ctl = (i, scale, fc, ...dst) => {
      const s = ac.createConstantSource(), f = biq(ac, 'lowpass', fc, 0.5);
      s.offset.value = 0; s.start(0); chain(s, gain(ac, scale), f);
      for (const d of dst) f.connect(d);
      V.c[i] = s.offset; return f;
    };
    const zg = () => gain(ac, 0);

    // ---------------- motor
    const jit = lfo(34, 0.3), jc = gain(ac, 11);       // irregularidade de ciclo (± cents)
    jit.connect(jc);
    const cyc = ctl(0, 1 / 120, 13);                   // giro → Hz do ciclo (720°)
    const osc = (w) => { const o = ac.createOscillator(); o.setPeriodicWave(w); o.frequency.value = 0; cyc.connect(o.frequency); jc.connect(o.detune); o.start(0); return o; };
    const gOn = zg(), gOff = zg(), pre = zg(), sh = ac.createWaveShaper();
    sh.curve = curve((x) => Math.tanh(1.7 * x + 0.4 * x * x)); sh.oversample = '2x';
    osc(wave(ac, 1)).connect(gOn); osc(wave(ac, 0)).connect(gOff);
    gOn.connect(pre); gOff.connect(pre);
    const pw = {}, pwv = pulseWave(ac, pw), nAm = gain(ac, pw.base), nG = zg();
    osc(pwv).connect(nAm.gain);
    chain(loop(ac, nz, 1, 0.7), biq(ac, 'bandpass', 1700, 0.55), nAm, nG);
    // ressonâncias fixas (escape, coletor, carroceria); o passa-baixas abre com a carga e o giro
    const f1 = biq(ac, 'peaking', 96, 1.0, 5), lp = biq(ac, 'lowpass', 0, 0.6), am = gain(ac, 1), eG = zg();
    chain(pre, sh, f1, biq(ac, 'peaking', 320, 1.5, 6), biq(ac, 'peaking', 800, 2.0, 4), biq(ac, 'peaking', 1950, 2.4, 5), lp, biq(ac, 'highpass', 36, 0.7), am, eG);
    nG.connect(f1);
    chain(jit, gain(ac, 0.09), am.gain);
    to(eG, 'motor', car);
    ctl(1, 1 / 4096, 5, gOn.gain); ctl(2, 1 / 4096, 5, gOff.gain); ctl(3, 1 / 4096, 5, pre.gain); ctl(4, 1 / 4096, 5, nG.gain); ctl(5, 1, 5, lp.frequency); ctl(6, 1 / 4096, 5, eG.gain);
    // estalo da troca de marcha e pancada de batida
    const ev = (i, f, q, type) => { const g = zg(); to(chain(loop(ac, nz, 1, 1.9), biq(ac, type, f, q), g), 'motor', car); ctl(i, 1 / 4096, 25, g.gain); };
    ev(22, 340, 1.6, 'bandpass'); ev(23, 190, 0.7, 'lowpass');

    // ---------------- pneus: canto por eixo (tom estreito + ruído) e atrito de banda larga
    const wob = lfo(11, 1.1), wc = gain(ac, 38);
    wob.connect(wc);
    const tire = (i, f0, off) => {
      const o = ac.createOscillator(), nb = biq(ac, 'bandpass', f0, 24), bp = biq(ac, 'bandpass', f0 * 1.02, 4.5), g = zg(), p = pan(ac, 0);
      o.type = 'sawtooth'; o.frequency.value = f0; o.start(0);
      const pc = ctl(11 + i, 1, 3, o.detune, nb.detune, bp.detune);
      for (const d of [o.detune, nb.detune, bp.detune]) wc.connect(d);
      chain(o, gain(ac, 0.22), bp); chain(loop(ac, nz, 1, off), nb, gain(ac, 3.6), bp);
      to(chain(bp, g, p), 'pneus', car);
      ctl(7 + i, 1 / 4096, 5, g.gain); ctl(9 + i, 1 / 1024, 3, p.pan);
    };
    tire(0, 840, 2.3); tire(1, 655, 3.1);
    const scr = zg();
    to(chain(loop(ac, nz, 1, 1.3), biq(ac, 'bandpass', 1500, 0.8), scr), 'pneus', car);
    ctl(13, 1 / 4096, 5, scr.gain);

    // ---------------- vento e rodagem
    const wl = biq(ac, 'lowpass', 0, 0.5), wr = biq(ac, 'lowpass', 0, 0.5), wg = zg(), wg2 = zg(), mg = ac.createChannelMerger(2);
    chain(loop(ac, nz, 0.93, 0.2), wl, wg).connect(mg, 0, 0); chain(loop(ac, nz, 1.06, 2.6), wr, wg2).connect(mg, 0, 1);
    to(mg, 'vento', car);
    chain(ctl(14, 1, 2, wl.frequency), gain(ac, 1.07), wr.frequency); ctl(15, 1 / 4096, 2, wg.gain, wg2.gain);
    const rg = zg(), og = zg(), oam = gain(ac, 0.6), ko = ac.createOscillator();
    to(chain(loop(ac, nz, 0.5, 3.3), biq(ac, 'lowpass', 150, 0.8), rg), 'vento', car);
    ko.frequency.value = 0; ko.start(0); chain(ko, gain(ac, 0.35), oam.gain);
    chain(lfo(22, 2.2), gain(ac, 0.4), oam.gain);
    to(chain(loop(ac, nz, 0.7, 0.5), biq(ac, 'lowpass', 420, 0.6), oam, og), 'piso', car);
    ctl(16, 1 / 4096, 2, rg.gain); ctl(17, 1 / 4096, 4, og.gain); ctl(18, 1 / 16, 4, ko.frequency);

    // ---------------- ambiente: mata (folhagem, cigarras), pássaros, público
    for (const s of [-1, 1]) {
      const g = gain(ac, 0.02);
      chain(lfo(0.7, 1 + s), gain(ac, 0.012), g.gain);
      to(chain(loop(ac, nz, 1 + s * 0.04, 2 + s), biq(ac, 'bandpass', 2600, 0.45), g, pan(ac, s * 0.75)), 'ambiente', amb);
    }
    const cg = gain(ac, 0.5), cs = gain(ac, 0.011), co = ac.createOscillator();
    co.type = 'sawtooth'; co.frequency.value = 47; co.start(0); chain(co, gain(ac, 0.5), cg.gain);
    chain(lfo(0.35, 3.6), gain(ac, 0.009), cs.gain);
    to(chain(loop(ac, nz, 1, 3.7), biq(ac, 'bandpass', 5300, 22), cg, cs, pan(ac, 0.45)), 'ambiente', amb);
    const dl = ac.createDelay(0.5), el = biq(ac, 'lowpass', 2400, 0.5), bb = gain(ac, 1), bo = gain(ac, 1);   // eco curto da mata
    dl.delayTime.value = 0.21; chain(bb, dl, el, gain(ac, 0.3), dl); chain(el, gain(ac, 0.5), bo); bb.connect(bo);
    to(bo, 'ambiente', amb);
    for (const [seed, secs, p] of [[11, 17, -0.6], [23, 23, 0.5]]) { const s = ac.createBufferSource(); s.buffer = birdBuf(ac, seed, secs); s.loop = true; s.start(0); chain(s, gain(ac, 0.04), pan(ac, p), bb); }
    const pg = zg(), pp = pan(ac, 0);
    for (const [f, q, lv, rt] of [[430, 0.9, 1.0, 2.6], [980, 1.1, 0.8, 4.1], [2050, 1.4, 0.45, 5.3], [3100, 2.2, 0.2, 7.0]]) {
      const g = gain(ac, lv * 0.55);
      chain(lfo(rt, f / 1000), gain(ac, lv * 0.5), g.gain);
      chain(loop(ac, nz, 0.8 + f / 9000, f / 900), biq(ac, 'bandpass', f, q), g, pg);
    }
    to(chain(pg, pp), 'publico', amb);
    ctl(19, 1 / 4096, 1.5, pg.gain); ctl(20, 1 / 1024, 1.5, pp.pan); ctl(21, 1 / 4096, 2, car.gain);
    return V;
  }

  // ---- valores de controle (inteiros) a partir do modelo — chamado por quadro, sem alocação
  const T = new Int32Array(NC);
  function targets(quiet) {
    const rpm = M[0], L = M[1], rn = clamp((rpm - 900) / 5400, 0, 1), v = M[6], vn = v > 50 ? 50 / 45 : v / 45, K = 4096;
    T[0] = rpm;
    T[1] = K * Math.pow(L, 0.7) * (0.6 + 0.4 * rn);                 // onda em carga
    T[2] = K * (0.15 + 0.8 * Math.pow(1 - L, 1.5));                 // onda aliviada
    T[3] = K * (0.45 + 0.75 * L);                                   // saturação
    T[4] = K * (0.06 + 0.5 * L * (0.3 + 0.7 * rn) + 0.14 * rn);     // ruído de combustão
    T[5] = 900 + 1900 * rn + L * (1900 + 1900 * rn);                // passa-baixas (Hz)
    T[6] = K * 0.16 * (0.3 + 0.4 * L + 0.3 * rn * (0.4 + 0.6 * L));     // volume do motor
    const sv = clamp(M[14] / 22, 0, 1);
    T[7] = K * M[2] * 1.15; T[8] = K * M[3] * 1.15; T[9] = 1024 * M[4]; T[10] = 1024 * M[5];
    T[11] = -160 + 420 * sv + 140 * M[2]; T[12] = -160 + 420 * sv + 140 * M[3];   // tom do canto (cents)
    T[13] = K * (M[2] + M[3]) * 0.15 * (0.4 + 0.6 * sv);
    T[14] = 260 + 1500 * vn; T[15] = K * 0.5 * vn * vn;            // vento
    T[16] = K * 0.5 * Math.pow(vn, 0.8);                            // rodagem
    T[17] = K * (M[7] * 0.55 + M[8] * 0.3) * clamp(v / 14, 0, 1);   // fora da pista / zebra
    T[18] = 16 * (M[8] > 0 ? 4 + v / 0.9 : 0);
    T[19] = K * clamp((M[9] - 0.03) * 0.42, 0, 1); T[20] = 1024 * M[10];   // público
    T[21] = quiet ? 0 : K;
    T[22] = K * 0.9 * M[12]; T[23] = K * 1.2 * M[13];                 // estalo da troca, batida
  }
  // t < 0: tempo real (vale já, só escreve o que mudou); t ≥ 0: agendado (fora do tempo real)
  function apply(V, t, quiet) {
    targets(quiet);
    const c = V.c, last = V.last;
    for (let i = 0; i < NC; i++) {
      const v = T[i];
      if (v !== last[i]) { last[i] = v; if (t < 0) c[i].value = v; else c[i].setValueAtTime(v, t); }
    }
  }

  // ---------------- tempo real
  let RT = null, on = false;
  S.muted = false; S.ctx = null;
  S.start = () => {
    if (RT) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC({ latencyHint: 'interactive' });
    RT = build(ac, null); S.ctx = ac; S.voz = RT;
    RT.mute.setValueAtTime(0, ac.currentTime); RT.mute.linearRampToValueAtTime(S.muted ? 0 : 1, ac.currentTime + 0.5);
  };
  S.run = (v) => { on = v; if (S.ctx) { if (v) S.ctx.resume(); else S.ctx.suspend(); } };
  // se o navegador segurou o contexto (início sem gesto válido, p. ex. pelo controle), o próximo gesto o solta
  S.kick = () => { if (on && S.ctx && S.ctx.state === 'suspended') S.ctx.resume(); };
  S.setMute = (m) => {
    S.muted = m;
    if (!RT) return;
    const t = S.ctx.currentTime, p = RT.mute;
    p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(m ? 0 : 1, t + 0.04);
  };
  S.frame = (quiet) => { if (RT && on) apply(RT, -1, quiet); };

  // ---------------- fora do tempo real: a volta roteirizada, da mesma simulação determinística (ferramentas; aloca)
  // opt: { mudo, solo, quadros, parado }  →  { taxa, canais: [Float32Array, Float32Array], reg: {…por quadro…} }   (parado: carro em marcha lenta no grid)
  S.renderLap = async (opt) => {
    opt = opt || {};
    const n = opt.quadros || 3600, sr = 48000, G = window.__game, car = G.car;
    const oc = new OfflineAudioContext(2, Math.round(n / 60 * sr), sr);
    G.startScripted(); S.reset();
    if (opt.parado) G.mode = 'play';
    const V = build(oc, opt);
    const reg = {}; for (const k of ['rpm', 'rpmSom', 'marcha', 'carga', 'acel', 'kmh', 'pneuD', 'pneuT', 'snD', 'snT', 'escD', 'escT', 'publico', 'x', 'z']) reg[k] = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      G.simFrame(1 / 60);
      reg.rpm[i] = car.rpm; reg.rpmSom[i] = M[0]; reg.marcha[i] = car.gear; reg.carga[i] = M[1]; reg.acel[i] = car.thr; reg.kmh[i] = car.u * 3.6;
      reg.pneuD[i] = M[2]; reg.pneuT[i] = M[3]; reg.snD[i] = Math.max(car.sn[0], car.sn[1]); reg.snT[i] = Math.max(car.sn[2], car.sn[3]);
      reg.escD[i] = Math.max(car.slip[0], car.slip[1]); reg.escT[i] = Math.max(car.slip[2], car.slip[3]); reg.publico[i] = M[9]; reg.x[i] = car.x; reg.z[i] = car.z;
      apply(V, i / 60, false);
    }
    const buf = await oc.startRendering();
    return { taxa: sr, canais: [buf.getChannelData(0), buf.getChannelData(1)], reg };
  };
  return S;
})();
