// ---------------------------------------------------------------------------
// physics.js — dinâmica do Uno (tração dianteira), determinística, sem alocação
// Local: a = frente, b = direita. Ângulo ψ: frente = (cos ψ, sin ψ) em (x, z)
// ---------------------------------------------------------------------------
'use strict';

const PHYS = {
  DT: 1 / 120, SUB: 4,
  mass: 845, Iz: 1150, g: 9.81,
  cgA: 0.944,                 // CG -> eixo dianteiro
  cgB: 1.416,                 // CG -> eixo traseiro
  cgH: 0.50,
  R: 0.292, Iw: 0.9,
  gears: [3.909, 2.157, 1.480, 1.121, 0.902], final: 4.071, revGear: 3.818,
  idle: 900, redline: 6300,
  brakeF: 1000, brakeR: 360, handbrake: 1700,
  maxSteer: 0.62,             // rad nas rodas (batente)
  dragK: 0.40, roll: 0.013,
};

// torque do motor (Nm) por rpm — Mille preparado (~70 cv)
function engineTorque(rpm) {
  const r = rpm / 1000;
  if (r < 1) return 70;
  if (r < 3.5) return 85 + (r - 1) * 15;
  if (r < 5.0) return 122;
  if (r < 6.3) return 122 - (r - 5) * 20;
  return 45;
}

class Car {
  constructor() {
    // estado
    this.x = 0; this.z = 0; this.y = 0; this.psi = 0;
    this.u = 0; this.v = 0; this.r = 0;       // velocidades locais e guinada
    this.w = new Float64Array(4);             // vel. angular das rodas (DE, DD, TE, TD)
    this.spin = new Float64Array(4);
    this.steer = 0; this.thr = 0; this.brk = 0; this.hb = 0; this.steerIn = 0;
    this.gear = 1; this.rpm = 900; this.reverse = false; this.shiftT = 0;
    this.ax = 0; this.ay = 0;
    this.roll = 0; this.rollV = 0; this.pitch = 0; this.pitchV = 0; this.heave = 0; this.heaveV = 0;
    this.pitchG = 0; this.rollG = 0;
    this.hint = -1; this.s = 0; this.u_lat = 0;
    this.slip = new Float64Array(4);          // velocidade de escorregamento (m/s)
    this.sn = new Float64Array(4);            // escorregamento normalizado (1 = pico de aderência) — só leitura (som)
    this.load = new Float64Array(4);
    this.surf = new Uint8Array(4);            // 0 asfalto, 1 zebra, 2 grama, 3 brita
    this.wetW = new Float64Array(4);
    this.wx = new Float64Array(4); this.wz = new Float64Array(4); this.wy = new Float64Array(4);
    this.onAsphalt = true; this.offTrackWheels = 0;
    this.wallHit = 0; this.time = 0;
    this._p = new Float64Array(3); this._ts = new Float64Array(6);
    this.fx = new Float64Array(4); this.fy = new Float64Array(4);
  }
  speed() { return Math.hypot(this.u, this.v); }
  placeOnTrack(s, uOff) {
    const T = TRACK, o = this._p;
    const ts = this._ts;
    T.sampleS(s, ts);
    this.psi = Math.atan2(ts[4], ts[3]);
    const rx = -ts[4], rz = ts[3];
    this.x = ts[0] + rx * uOff; this.z = ts[2] + rz * uOff;
    this.u = this.v = this.r = 0; this.w.fill(0); this.spin.fill(0); this.slip.fill(0); this.sn.fill(0);
    this.steer = 0; this.steerIn = 0; this.thr = this.brk = this.hb = 0; this.gear = 1; this.reverse = false;
    this.rpm = PHYS.idle; this.shiftT = 0; this.ax = 0; this.ay = 0;
    this.roll = this.rollV = this.pitch = this.pitchV = this.heave = this.heaveV = 0;
    this.fx.fill(0); this.fy.fill(0); this.wallHit = 0; this.time = 0;
    this.hint = -1;
    this.updateGround();
  }
  // altura e tipo de superfície num ponto do mundo
  groundAt(x, z, k) {
    const T = TRACK, o = this._p;
    T.project(x, z, this.hint, o);
    const s = o[0], u = o[1];
    const hw = T.lerpArr(T.hw, s);
    const au = Math.abs(u);
    const kw = u > 0 ? T.lerpArr(T.kerbR, s) : T.lerpArr(T.kerbL, s);
    let y, surf = 0;
    if (au <= hw + 0.3) { y = T.surfaceY(s, u); surf = 0; }
    else if (kw > 0 && au < hw + 0.3 + kw) { y = T.surfaceY(s, u); surf = 1; }
    else {
      y = TERRAIN.heightAt(x, z);
      const gw = u > 0 ? T.lerpArr(T.gravR, s) : T.lerpArr(T.gravL, s);
      const g0 = hw + kw + 1.6;
      surf = (gw > 1.5 && au > g0 && au < g0 + gw) ? 3 : 2;
    }
    if (k >= 0) { this.surf[k] = surf; this.wetW[k] = surf === 0 ? T.lerpArr(T.wet, s) : 0; }
    return y;
  }
  updateGround() {
    const c = Math.cos(this.psi), sn = Math.sin(this.psi);
    const T = TRACK, o = this._p;
    T.project(this.x, this.z, this.hint, o);
    this.hint = o[2]; this.s = o[0]; this.u_lat = o[1];
    let off = 0;
    for (let k = 0; k < 4; k++) {
      const a = k < 2 ? 1.18 : -1.18, b = (k & 1 ? 1 : -1) * (k < 2 ? 0.67 : 0.655);
      const x = this.x + c * a - sn * b, z = this.z + sn * a + c * b;
      this.wx[k] = x; this.wz[k] = z;
      this.wy[k] = this.groundAt(x, z, k);
      T.project(x, z, this.hint, o);
      if (Math.abs(o[1]) > T.lerpArr(T.hw, o[0]) + 0.3) off++;
    }
    this.offTrackWheels = off;
    this.onAsphalt = off === 0;
    // plano pelas 4 rodas
    const yf = (this.wy[0] + this.wy[1]) * 0.5, yr = (this.wy[2] + this.wy[3]) * 0.5;
    const yl = (this.wy[0] + this.wy[2]) * 0.5, yrr = (this.wy[1] + this.wy[3]) * 0.5;
    this.pitchG = Math.atan2(yf - yr, 2.36);
    this.rollG = Math.atan2(yl - yrr, 1.33);
    this.y = (yf + yr) * 0.5;
  }
  // entrada digital: up, down, left, right, hand (booleanos)
  // entrada analógica (jogo): inp.analog + inp.a = [direção -1..1, acelerador 0..1, freio/ré 0..1]; inp.stick = direção vem do analógico
  // (com valores 0/1 e stick falso, o caminho analógico dá exatamente os mesmos números do digital)
  step(inp, dt) {
    const P = PHYS;
    const spd = this.u;
    const an = inp.analog === true, A = inp.a;
    // ---- filtros de entrada
    const steerTarget = an ? A[0] : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const rate = an && inp.stick ? 9.0 : steerTarget === 0 ? 4.0 : (Math.sign(steerTarget) !== Math.sign(this.steerIn) && this.steerIn !== 0 ? 6.0 : 2.6);
    this.steerIn += clamp(steerTarget - this.steerIn, -rate * dt, rate * dt);
    // trava reduzida com a velocidade (ajuda no teclado)
    const lock = P.maxSteer / (1 + Math.abs(spd) * 0.045);
    this.steer = this.steerIn * lock;
    let wantThr = 0, wantBrk = 0;
    const aU = an ? A[1] : (inp.up ? 1 : 0), aD = an ? A[2] : (inp.down ? 1 : 0);
    if (aU > 0) { if (this.reverse && spd < -0.5) wantBrk = aU; else { wantThr = aU; if (Math.abs(spd) < 0.6) this.reverse = false; } }
    if (aD > 0) {
      if (!this.reverse && spd > 0.6) wantBrk = aD;
      else { this.reverse = true; wantThr = aD; }
    }
    if (!(aU > 0) && !(aD > 0) && this.reverse && spd > 0.2) this.reverse = false;
    this.thr += clamp(wantThr - this.thr, -8 * dt, 6 * dt);
    this.brk += clamp(wantBrk - this.brk, -10 * dt, 7 * dt);
    this.hb += clamp((inp.hand ? 1 : 0) - this.hb, -10 * dt, 12 * dt);
    // ---- câmbio automático
    // rpm pela roda motriz, mas trocas pela velocidade do carro (roda travada não reduz marcha)
    const wheelRpmF = Math.abs((this.w[0] + this.w[1]) * 0.5) * 60 / TAU;
    const carRpmW = Math.abs(this.u) / P.R * 60 / TAU;
    this.shiftT = Math.max(0, this.shiftT - dt);
    if (!this.reverse && this.shiftT === 0) {
      const rUp = carRpmW * P.gears[this.gear - 1] * P.final;
      if (rUp > 6000 && this.gear < 5) { this.gear++; this.shiftT = 0.22; }
      else if (this.gear > 1 && carRpmW * P.gears[this.gear - 2] * P.final < 4300 && rUp < 2700) { this.gear--; this.shiftT = 0.18; }
    }
    const ratio = this.reverse ? P.revGear : P.gears[this.gear - 1];
    this.rpm = Math.max(P.idle, Math.max(wheelRpmF, carRpmW * 0.98) * ratio * P.final);
    if (this.reverse) this.gear = 1;
    const cutting = this.shiftT > 0.12;
    let engT = engineTorque(Math.min(this.rpm, P.redline)) * this.thr * (cutting ? 0.1 : 1);
    if (this.rpm >= P.redline) engT *= 0.2;
    const driveT = engT * ratio * P.final * 0.9 * (this.reverse ? -1 : 1);
    // ---- cargas (transferência com acelerações do passo anterior)
    const L = P.cgA + P.cgB, m = P.mass, g = P.g;
    const fzF = m * g * P.cgB / L - m * this.ax * P.cgH / L;
    const fzR = m * g * P.cgA / L + m * this.ax * P.cgH / L;
    const latF = m * this.ay * P.cgH / 1.34 * 0.6, latR = m * this.ay * P.cgH / 1.31 * 0.4;
    this.load[0] = Math.max(50, fzF * 0.5 + latF); this.load[1] = Math.max(50, fzF * 0.5 - latF);
    this.load[2] = Math.max(50, fzR * 0.5 + latR); this.load[3] = Math.max(50, fzR * 0.5 - latR);
    // ---- forças dos pneus (subpassos para a rotação das rodas)
    const subDt = dt / P.SUB;
    let Fx = 0, Fy = 0, Mz = 0;
    for (let k = 0; k < 4; k++) { this.fx[k] = 0; this.fy[k] = 0; }
    for (let ss = 0; ss < P.SUB; ss++) {
      for (let k = 0; k < 4; k++) {
        const front = k < 2;
        const a = front ? P.cgA : -P.cgB;
        const b = (k & 1 ? 1 : -1) * (front ? 0.67 : 0.655);
        const vxl = this.u - this.r * b, vyl = this.v + this.r * a;
        const d = front ? this.steer * (1 + (k & 1 ? -1 : 1) * this.steer * 0.12) : 0;
        const cd = Math.cos(d), sd = Math.sin(d);
        const vl = vxl * cd + vyl * sd, vt = -vxl * sd + vyl * cd;
        // atrito por superfície
        const sf = this.surf[k];
        let mu = sf === 0 ? 1.0 - this.wetW[k] * 0.22 : sf === 1 ? 0.9 : sf === 2 ? 0.6 : 0.52;
        const Fz = this.load[k];
        const wR = this.w[k] * P.R;
        const den = Math.max(Math.abs(vl), 1.0);
        const kappa = (wR - vl) / den;
        const alpha = Math.atan2(vt, Math.max(Math.abs(vl), 0.8));
        const sx = kappa / 0.11, sy = Math.tan(alpha) / 0.13;
        const sMag = Math.hypot(sx, sy);
        let F = 0;
        if (sMag > 1e-6) {
          // curva mágica normalizada (pico em s=1, cai para ~0.8 deslizando)
          const B = 1.35, C = 1.65, E = 0.2;
          const bs = B * sMag;
          const peak = Math.sin(C * Math.atan(B - E * (B - Math.atan(B))));
          F = mu * Fz * Math.sin(C * Math.atan(bs - E * (bs - Math.atan(bs)))) / peak;
        }
        let fl = sMag > 1e-6 ? F * sx / sMag : 0;
        let ft = sMag > 1e-6 ? -F * sy / sMag : 0;
        // amortecimento em baixa velocidade (evita tremor parado)
        const lowS = clamp(1 - Math.abs(vl) / 1.5, 0, 1);
        ft = lerp(ft, -vt * Fz * 0.35, lowS * 0.7);
        // resistência de rolagem + grama/brita
        const rr = (sf >= 2 ? (sf === 3 ? 0.11 : 0.045) : P.roll) * Fz * Math.sign(vl) * Math.min(Math.abs(vl), 1);
        // rotação da roda
        let T = 0;
        if (front) T += driveT * 0.5;
        const bT = (front ? P.brakeF : P.brakeR) * this.brk + (front ? 0 : P.handbrake * this.hb);
        const wNew = this.w[k] + (T - fl * P.R) / P.Iw * subDt;
        // freio: torque oposto à rotação, sem inverter o sentido
        const bw = bT / P.Iw * subDt;
        if (Math.abs(wNew) <= bw) this.w[k] = 0; else this.w[k] = wNew - Math.sign(wNew) * bw;
        // forças no carro (frame local)
        const fxl = (fl - rr) * cd - ft * sd, fyl = (fl - rr) * sd + ft * cd;
        this.fx[k] += fxl / P.SUB; this.fy[k] += fyl / P.SUB;
        this.slip[k] = Math.hypot(wR - vl, vt);
        this.sn[k] = sMag;
      }
    }
    for (let k = 0; k < 4; k++) {
      const front = k < 2;
      const a = front ? P.cgA : -P.cgB, b = (k & 1 ? 1 : -1) * (front ? 0.67 : 0.655);
      Fx += this.fx[k]; Fy += this.fy[k];
      Mz += a * this.fy[k] - b * this.fx[k];
    }
    // arrasto + gravidade na rampa
    const sp = Math.hypot(this.u, this.v);
    Fx -= P.dragK * this.u * sp; Fy -= P.dragK * this.v * sp * 1.5;
    Fx -= m * g * Math.sin(this.pitchG);
    Fy += m * g * Math.sin(this.rollG) * 0.0;
    // ---- integração (frame local girando)
    const axl = Fx / m, ayl = Fy / m;
    this.u += (axl + this.r * this.v) * dt;
    this.v += (ayl - this.r * this.u) * dt;
    this.r += Mz / P.Iz * dt;
    this.ax = lerp(this.ax, axl, 0.25); this.ay = lerp(this.ay, ayl + this.r * this.u * 0, 0.25);
    this.ay = lerp(this.ay, ayl, 0.0);
    const c = Math.cos(this.psi), sn = Math.sin(this.psi);
    this.x += (c * this.u - sn * this.v) * dt;
    this.z += (sn * this.u + c * this.v) * dt;
    this.psi += this.r * dt;
    for (let k = 0; k < 4; k++) this.spin[k] = (this.spin[k] + this.w[k] * dt) % TAU;
    this.updateGround();
    this.collide();
    // ---- suspensão visual (rolagem/arfagem/vertical)
    const ayT = ayl, axT = axl;
    const rollT = -ayT * 0.0125, pitchT = axT * 0.0058;
    this.rollV += ((rollT - this.roll) * 90 - this.rollV * 11) * dt; this.roll += this.rollV * dt;
    this.pitchV += ((pitchT - this.pitch) * 110 - this.pitchV * 13) * dt; this.pitch += this.pitchV * dt;
    this.heaveV += ((0 - this.heave) * 160 - this.heaveV * 16) * dt; this.heave += this.heaveV * dt;
    this.time += dt;
  }
  // barreiras: cantos do carro contra a distância lateral da parede
  collide() {
    const T = TRACK, o = this._p;
    const c = Math.cos(this.psi), sn = Math.sin(this.psi);
    this.wallHit = 0;
    for (let k = 0; k < 4; k++) {
      const a = k < 2 ? 1.85 : -1.83, b = (k & 1 ? 1 : -1) * 0.78;
      const x = this.x + c * a - sn * b, z = this.z + sn * a + c * b;
      T.project(x, z, this.hint, o);
      const s = o[0], u = o[1];
      const wall = (u > 0 ? T.lerpArr(T.wallR, s) : T.lerpArr(T.wallL, s)) - 0.35;
      const pen = Math.abs(u) - wall;
      if (pen > 0) {
        // normal da parede (para dentro da pista)
        const i = o[2] | 0;
        const rx = -T.tz[i], rz = T.tx[i];
        const nx = -Math.sign(u) * rx, nz = -Math.sign(u) * rz;
        this.x += nx * pen; this.z += nz * pen;
        // velocidade do ponto (mundo)
        const vxw = c * this.u - sn * this.v, vzw = sn * this.u + c * this.v;
        const rxp = x - this.x, rzp = z - this.z;
        // ω × r em 2D (ψ positivo gira frente -> direita; no plano x,z: ω·(-rz, rx))
        const pvx = vxw - this.r * rzp, pvz = vzw + this.r * rxp;
        const vn = pvx * nx + pvz * nz;
        if (vn < 0) {
          const rn = rxp * nz - rzp * nx;
          const j = -(1.25) * vn / (1 / PHYS.mass + rn * rn / PHYS.Iz);
          let ix = j * nx, iz = j * nz;
          // atrito tangencial
          const tx = -nz, tz = nx, vt = pvx * tx + pvz * tz;
          const jt = clamp(-vt / (1 / PHYS.mass + 1 / PHYS.Iz), -0.4 * j, 0.4 * j);
          ix += jt * tx; iz += jt * tz;
          const dvx = ix / PHYS.mass, dvz = iz / PHYS.mass;
          // volta para local
          this.u += c * dvx + sn * dvz;
          this.v += -sn * dvx + c * dvz;
          this.r += (rxp * iz - rzp * ix) / PHYS.Iz;
          this.wallHit = Math.max(this.wallHit, -vn);
        }
      }
    }
  }
}
