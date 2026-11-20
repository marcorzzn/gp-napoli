// Fisica del veicolo per il Circuito di Posillipo (trazione posteriore RWD, deportanza e Active Aero Z/X-Mode per SF-26).
// Passo fisso 1/120 s. Zero allocazioni nel loop di simulazione.
const PHYS_DT = 1 / 120;
const K_W = 1, K_S = 2, K_A = 4, K_D = 8, K_SPACE = 16, K_C = 32, K_R = 64, K_V = 128, K_PAD = 256, K_PADS = 512;
const VIN = new Float64Array(3);

const VP_ERAS = {
  '1937': {
    // Alfa Romeo 12C-36: V12 4.1L compressore 370 CV, 820 kg, pneumatici stretti mu ~ 0.86, > 290 km/h
    m: 820, Izz: 1380, L: 2.80, a: 1.38, b: 1.42, tw: 1.41, h: 0.44, R: 0.365,
    mu: 0.86, B: 8.6, C: 1.35,
    gears: [2.78, 1.84, 1.32, 1.00], final: 3.12, rev: 3.1, eff: 0.89,
    rpmIdle: 850, rpmMax: 6500, rpmUp: 5900, rpmDn: 4200,
    tqBase: 320, tqPeak: 245, tqPeakK: 4.5,
    cdA: 0.56, cdAX: 0.56, dfCoef: 0.04, crr: 0.015, brakeF: 0.54, brakeG: 0.92,
    halfW: 0.80, front: 2.12, rear: 1.92,
  },
  '1955': {
    // Lancia D50 Ascari: V8 90° 2.5L 260 CV, 620 kg, serbatoi laterali a baricentro basso, mu ~ 0.96, ~250 km/h
    m: 620, Izz: 920, L: 2.28, a: 1.12, b: 1.16, tw: 1.32, h: 0.38, R: 0.345,
    mu: 0.96, B: 9.8, C: 1.42,
    gears: [2.95, 2.08, 1.54, 1.21, 1.00], final: 3.92, rev: 3.2, eff: 0.91,
    rpmIdle: 1100, rpmMax: 8500, rpmUp: 7950, rpmDn: 5800,
    tqBase: 175, tqPeak: 145, tqPeakK: 6.4,
    cdA: 0.52, cdAX: 0.52, dfCoef: 0.06, crr: 0.013, brakeF: 0.58, brakeG: 1.08,
    halfW: 0.78, front: 1.88, rear: 1.68,
  },
  '2026': {
    // Ferrari SF-26: V6 Turbo Hybrid 1020 CV, 798 kg, slick Pirelli mu ~ 2.08, ~360 km/h, Active Aero Z/X-Mode
    m: 798, Izz: 1520, L: 3.40, a: 1.88, b: 1.52, tw: 1.67, h: 0.30, R: 0.360,
    mu: 2.08, B: 13.0, C: 1.58,
    gears: [3.20, 2.52, 2.02, 1.66, 1.39, 1.19, 1.03, 0.90], final: 3.15, rev: 3.4, eff: 0.94,
    rpmIdle: 3200, rpmMax: 14200, rpmUp: 13200, rpmDn: 10100,
    tqBase: 420, tqPeak: 320, tqPeakK: 10.6,
    cdA: 0.96, cdAX: 0.62, dfCoef: 2.65, crr: 0.012, brakeF: 0.62, brakeG: 2.75,
    halfW: 0.99, front: 2.58, rear: 2.16,
  },
};

const VP = VP_ERAS[ERA.id] || VP_ERAS['1955'];

const VEH = {
  x: 0, z: 0, yaw: 0, vx: 0, vy: 0, r: 0,
  steer: 0, rpm: VP.rpmIdle, gear: 1, throttle: 0, brake: 0, hand: 0,
  aeroX: false,
  ax: 0, ay: 0,
  roll: 0, rollV: 0, pitch: 0, pitchV: 0, heave: 0, heaveV: 0,
  y: 0, gPitch: 0, gRoll: 0,
  spin: new Float32Array(4), omega: new Float32Array(4), susp: new Float32Array(4),
  slip: new Float32Array(4),
  wx: new Float32Array(4), wy: new Float32Array(4), wz: new Float32Array(4), wzone: new Uint8Array(4), whint: new Int32Array(4).fill(-1),
  fz: new Float32Array(4), hint: -1, s: 0, d: 0, zone: 0, lapS: 0, lastS: 0, laps: 0, maxOff: 0, offCount: 0, hits: 0, time: 0, steps: 0,
  ctl: new Float32Array(2),
  px: 0, pz: 0, pyaw: 0, py: 0, proll: 0, ppitch: 0, pheave: 0, pgPitch: 0, pgRoll: 0, psteer: 0, pspin: new Float32Array(4), psusp: new Float32Array(4),
};
const _vl = new Float64Array(4), _vp = new Float64Array(5);
const WLX = [VP.a, VP.a, -VP.b, -VP.b], WLZ = [-VP.tw / 2, VP.tw / 2, -VP.tw / 2, VP.tw / 2];

function engineTorque(rpm) {
  const x = rpm / 1000;
  const k = clamp((x - VP.rpmIdle / 1000) / Math.max(1.5, VP.tqPeakK), 0, 1);
  const t = VP.tqBase + VP.tqPeak * Math.sin(k * PI) - Math.max(0, x - VP.rpmMax * 0.92 / 1000) * 180;
  return Math.max(0, t);
}

const _gq = new Float64Array(12);
function groundQ(wi) {
  const q = _gq, V = VEH;
  trackLocateQ(wi >= 0 ? V.whint[wi] : V.hint, q);
  if (q[3] > 90 || q[3] < -90) trackLocateQ(-1, q);
  const i0 = q[4] | 0, f = q[5], d = q[3], ad = d < 0 ? -d : d, i1 = (i0 + 1) % TRK.N;
  if (wi >= 0) V.whint[wi] = i0; else { V.hint = i0; V.s = q[2]; V.d = d; }
  const zone = zoneAtQ(q), lim = TRK.hw + APRON;
  const ty = TRK.y[i0] + (TRK.y[i1] - TRK.y[i0]) * f - (d < -lim ? -lim : d > lim ? lim : d) * (TRK.bank[i0] + (TRK.bank[i1] - TRK.bank[i0]) * f);
  let y = ty;
  if (ad <= lim - 0.4) {
    if (zone === ZONE.KERB) {
      const kx = ad - TRK.hw;
      if (kx > 0 && kx < KERB_W) y += 0.012 + 0.045 * Math.sin(Math.min(1, kx / (KERB_W * 0.82)) * PI * 0.5) * (kx > KERB_W * 0.82 ? (KERB_W - kx) / (KERB_W * 0.18) : 1) + 0.010 * Math.sin(q[2] * 5.2);
    }
  } else {
    hfAtQ(q); let e = (ad - (lim - 0.4)) / 1.2; e = e < 0 ? 0 : e > 1 ? 1 : e; y = ty + (q[6] - ty) * e;
    if (zone === ZONE.GRAVEL) y -= 0.03;
  }
  q[8] = y; return zone;
}
function groundAt(x, z, wi) { _gq[0] = x; _gq[1] = z; _vl[3] = groundQ(wi); return _gq[8]; }
const ZMU = [1.0, 0.96, 0.56, 0.5, 0.5, 0.95, 0.95], ZDRAG = [0, 0.005, 0.07, 0.24, 0.12, 0, 0];

function vehicleReset(s, d, heading) {
  const V = VEH; trackPos(s, d, _vp);
  V.x = _vp[0]; V.z = _vp[2]; V.yaw = Math.atan2(_vp[4], _vp[3]) + (heading || 0);
  V.vx = V.vy = V.r = 0; V.steer = 0; V.rpm = VP.rpmIdle; V.gear = 1; V.aeroX = false;
  V.ax = V.ay = 0; V.roll = V.rollV = V.pitch = V.pitchV = V.heave = V.heaveV = 0;
  V.hint = -1; V.whint.fill(-1); V.omega.fill(0); V.slip.fill(0);
  _gq[0] = V.x; _gq[1] = V.z; groundQ(-1); V.y = _gq[8]; V.gPitch = 0; V.gRoll = 0; V.lastS = V.s;
  for (let k = 0; k < 6; k++) vehicleGround(1);
  vehicleSavePrev();
}
function vehicleSavePrev() {
  const V = VEH; V.px = V.x; V.pz = V.z; V.pyaw = V.yaw; V.py = V.y; V.proll = V.roll; V.ppitch = V.pitch; V.pheave = V.heave; V.pgPitch = V.gPitch; V.pgRoll = V.gRoll; V.psteer = V.steer;
  V.pspin.set(V.spin); V.psusp.set(V.susp);
}
function vehicleGround(k) {
  const V = VEH, c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  for (let i = 0; i < 4; i++) {
    const wx = V.x + c * WLX[i] - s * WLZ[i], wz = V.z + s * WLX[i] + c * WLZ[i];
    V.wx[i] = wx; V.wz[i] = wz; _gq[0] = wx; _gq[1] = wz; V.wzone[i] = groundQ(i); V.wy[i] = _gq[8];
  }
  const yF = (V.wy[0] + V.wy[1]) / 2, yR = (V.wy[2] + V.wy[3]) / 2, yL = (V.wy[0] + V.wy[2]) / 2, yRt = (V.wy[1] + V.wy[3]) / 2;
  const gy = (yF * VP.b + yR * VP.a) / VP.L, gp = Math.atan2(yF - yR, VP.L), gr = Math.atan2(yRt - yL, VP.tw);
  V.y += (gy - V.y) * k; V.gPitch += (gp - V.gPitch) * k; V.gRoll += (gr - V.gRoll) * k;
  _gq[0] = V.x; _gq[1] = V.z; V.zone = groundQ(-1);
}

function vehicleStep(keys) {
  const V = VEH, P = VP, dt = PHYS_DT, g = 9.81;
  vehicleSavePrev();
  if (!(keys & K_PAD)) { VIN[0] = (keys & K_W) ? 1 : 0; VIN[1] = (keys & K_S) ? 1 : 0; }
  const thr = VIN[0], brk = VIN[1];
  const hand = (!ERA.hasActiveAero && (keys & K_SPACE)) ? 1 : 0;
  if (ERA.hasActiveAero && brk > 0.25 && V.aeroX) V.aeroX = false;

  const speed = Math.sqrt(V.vx * V.vx + V.vy * V.vy);
  if (!(keys & K_PADS)) VIN[2] = ((keys & K_D) ? 1 : 0) - ((keys & K_A) ? 1 : 0);
  const sIn = VIN[2];
  const latRef = ERA.id === '2026' ? 24.0 : ERA.id === '1955' ? 10.5 : 9.0;
  const sMax = Math.min(0.56, Math.max(0.045, Math.atan(P.L * latRef / Math.max(speed * speed, 1)) * 1.25));
  const sTgt = sIn * sMax;
  const sRate = ((keys & K_PADS) ? 2.6 + 5.2 * sMax : sIn !== 0 && Math.sign(sTgt - V.steer) === sIn ? 1.25 + 1.3 * sMax : 2.8 * Math.max(0.25, sMax)) * dt;
  V.steer += Math.min(sRate, Math.max(-sRate, sTgt - V.steer));

  let reverse = false, throttle = thr, brake = brk;
  if (V.gear === 0) {
    reverse = true; throttle = brk; brake = thr;
    if (thr && V.vx > -0.5) { V.gear = 1; reverse = false; throttle = thr; brake = brk; }
  } else if (brk && !thr && V.vx < 0.6) { V.gear = 0; reverse = true; throttle = brk; brake = 0; }

  const wheelSpd = (V.omega[2] + V.omega[3]) * 0.5;
  const nGears = P.gears.length;
  let ratio = reverse ? -P.rev * P.final : P.gears[V.gear - 1] * P.final;
  let rpm = Math.abs(wheelSpd * ratio) * 9.5493;
  if (!reverse) {
    if (rpm > P.rpmUp && V.gear < nGears) V.gear++;
    else if (V.gear > 1 && Math.abs(wheelSpd * P.gears[V.gear - 2] * P.final) * 9.5493 < P.rpmDn) V.gear--;
    ratio = P.gears[V.gear - 1] * P.final;
    rpm = Math.abs(wheelSpd * ratio) * 9.5493;
  }
  const rpmE = Math.min(P.rpmMax, Math.max(P.rpmIdle, Math.max(rpm, P.rpmIdle + 400 + throttle * (P.rpmUp * 0.32) * Math.min(1, Math.max(0, 1 - speed / 10)))));
  V.rpm += (rpmE - V.rpm) * 0.28;
  const eT = engineTorque(rpmE);
  let Tdrive = throttle * eT * ratio * P.eff;
  if (rpm > P.rpmMax * 0.985) Tdrive = 0;
  if (reverse && V.vx < -14) Tdrive = 0;
  Tdrive -= (1 - throttle) * 0.010 * rpmE * Math.sign(wheelSpd) * Math.abs(ratio) * 0.1;

  const W = P.m * g;
  const aeroScale = V.aeroX ? 0.55 : 1.0;
  const df = P.dfCoef * aeroScale * speed * speed;
  const dFx = P.m * V.ax * P.h / P.L, dFy = P.m * V.ay * P.h / P.tw;
  const cosg = Math.cos(V.gPitch);
  V.fz[0] = Math.max(80, (W * P.b / P.L * cosg - dFx + df * 0.44) * 0.5 + dFy * 0.52);
  V.fz[1] = Math.max(80, (W * P.b / P.L * cosg - dFx + df * 0.44) * 0.5 - dFy * 0.52);
  V.fz[2] = Math.max(80, (W * P.a / P.L * cosg + dFx + df * 0.56) * 0.5 + dFy * 0.48);
  V.fz[3] = Math.max(80, (W * P.a / P.L * cosg + dFx + df * 0.56) * 0.5 - dFy * 0.48);

  let Fx = 0, Fy = 0, Mz = 0;
  const cs = Math.cos(V.steer), sn = Math.sin(V.steer);
  const lw0 = Math.min(1, Math.max(0, (speed - 0.4) / 1.8));
  const lowW = lw0 * lw0 * (3 - 2 * lw0);
  for (let i = 0; i < 4; i++) {
    const front = i < 2, zone = V.wzone[i], mu = P.mu * ZMU[zone], cap = mu * V.fz[i];
    const vxw = V.vx - V.r * WLZ[i], vyw = V.vy + V.r * WLX[i];
    const vl = front ? vxw * cs + vyw * sn : vxw, vt = front ? -vxw * sn + vyw * cs : vyw;
    let fxd = 0, locked = false, spinning = false;
    if (!front) fxd += Tdrive * 0.5 / P.R;
    const bdem = brake * P.m * g * P.brakeG * (front ? P.brakeF : 1 - P.brakeF) * 0.5;
    const dirL = Math.abs(vl) > 0.25 ? Math.sign(vl) : (Math.abs(fxd) > 1 ? 0 : Math.sign(vl) * Math.abs(vl) / 0.25);
    fxd -= bdem * dirL;
    if (!front && hand) { fxd = -cap * 0.92 * dirL; locked = Math.abs(vl) > 0.3; }
    fxd -= (P.crr + ZDRAG[zone]) * V.fz[i] * dirL;
    let fx = fxd, latCap;
    if (locked) { latCap = cap * 0.36; }
    else if (Math.abs(fxd) > cap * 0.985) {
      if (!front && Math.abs(Tdrive) * 0.5 / P.R > bdem && throttle) { fx = Math.sign(fxd) * cap * 0.91; spinning = true; latCap = cap * 0.52; }
      else { fx = Math.sign(fxd) * cap * 0.97; latCap = cap * 0.30; }
    } else latCap = Math.sqrt(cap * cap - fx * fx);

    const alpha = Math.atan2(vt, Math.max(Math.abs(vl), 1.2));
    let fy = -cap * Math.sin(P.C * Math.atan(P.B * alpha));
    fy = fy * lowW + (1 - lowW) * (-vt * P.m * 0.25 / 0.07);
    fy = Math.min(latCap, Math.max(-latCap, fy));

    const sl = Math.max(
      spinning ? 0.55 + 0.45 * Math.min(1, Math.max(0, 1 - Math.abs(vl) / 18)) : 0,
      locked ? Math.min(1, Math.max(0, Math.abs(vl) / 4)) : 0,
      Math.min(1, Math.max(0, (Math.abs(alpha) - 0.12) / 0.16)) * Math.min(1, Math.max(0, speed / 6)),
      (brake && Math.abs(fxd) > cap * 0.985) ? 0.35 * Math.min(1, Math.max(0, speed / 8)) : 0
    );
    V.slip[i] += (((zone === ZONE.ASPHALT || zone === ZONE.KERB || zone === ZONE.PIT) ? sl : sl * 0.6 + Math.min(1, Math.max(0, speed / 10)) * 0.5) - V.slip[i]) * 0.3;

    let wT = vl / P.R;
    if (spinning) wT = Math.max(wT, Math.min(rpmE / 9.5493 / Math.abs(ratio), wT + 38)) * Math.sign(ratio);
    if (locked) wT = 0;
    V.omega[i] += (wT - V.omega[i]) * (locked ? 0.5 : 0.35);
    V.spin[i] += V.omega[i] * dt;

    const fbx = front ? fx * cs - fy * sn : fx, fby = front ? fx * sn + fy * cs : fy;
    Fx += fbx; Fy += fby; Mz += WLX[i] * fby - WLZ[i] * fbx;
  }

  const cdA = V.aeroX ? P.cdAX : P.cdA;
  Fx -= 0.5 * 1.2 * cdA * V.vx * Math.abs(V.vx);
  Fx -= P.m * g * Math.sin(V.gPitch);
  Fy -= P.m * g * Math.sin(V.gRoll);

  const axb = Fx / P.m, ayb = Fy / P.m;
  V.vx += (axb + V.r * V.vy) * dt;
  V.vy += (ayb - V.r * V.vx) * dt;
  V.r += Mz / P.Izz * dt;
  if (speed < 0.25 && !throttle && Math.abs(Tdrive) < 30) { V.vx *= 0.9; V.vy *= 0.8; V.r *= 0.8; }
  V.ax += (axb - V.ax) * 0.18; V.ay += (ayb - V.ay) * 0.18;
  const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  V.x += (V.vx * c - V.vy * s) * dt; V.z += (V.vx * s + V.vy * c) * dt; V.yaw += V.r * dt;

  vehicleGround(0.35);
  vehicleCollide();

  const kR = ERA.id === '2026' ? 165 : 88, cR = ERA.id === '2026' ? 16 : 10;
  const rollGain = ERA.id === '2026' ? 0.0014 : 0.0046;
  const pitchGain = ERA.id === '2026' ? 0.0010 : 0.0028;
  const rollT = clamp(V.ay * rollGain, -0.055, 0.055);
  const pitchT = clamp(-V.ax * pitchGain, -0.028, 0.028);
  V.rollV += ((rollT - V.roll) * kR - V.rollV * cR) * dt; V.roll += V.rollV * dt;
  V.pitchV += ((pitchT - V.pitch) * kR * 1.15 - V.pitchV * cR) * dt; V.pitch += V.pitchV * dt;

  let rough = 0; for (let i = 0; i < 4; i++) rough += V.wzone[i] === ZONE.KERB ? 0.5 : (V.wzone[i] === ZONE.GRAVEL || V.wzone[i] === ZONE.ROUGH || V.wzone[i] === ZONE.GRASS) ? 1 : 0;
  const hT = rough > 0 ? Math.sin(V.time * 61) * 0.004 * rough * Math.min(1, Math.max(0, speed / 8)) : 0;
  V.heaveV += ((hT - V.heave) * 220 - V.heaveV * 14) * dt; V.heave += V.heaveV * dt;

  V.ctl[0] = throttle; V.ctl[1] = brake;
  V.time += dt; V.steps++;
  let ds = V.s - V.lastS; if (ds < -TRK.L / 2) { ds += TRK.L; V.laps++; } else if (ds > TRK.L / 2) { ds -= TRK.L; V.laps--; }
  V.lapS += ds; V.lastS = V.s;
  let off = 0; for (let i = 0; i < 4; i++) if (V.wzone[i] !== ZONE.ASPHALT && V.wzone[i] !== ZONE.KERB && V.wzone[i] !== ZONE.PIT) off++;
  if (off > 0) V.offCount++;
}

function vehicleCollide() {
  const V = VEH, P = VP, c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  for (let k = 0; k < 4; k++) {
    const lx = k < 2 ? P.front : -P.rear, lz = (k & 1) ? P.halfW : -P.halfW;
    const cx = V.x + c * lx - s * lz, cz = V.z + s * lx + c * lz;
    _gq[0] = cx; _gq[1] = cz; trackLocateQ(V.hint, _gq);
    const d = _gq[3], i0 = _gq[4] | 0, f = _gq[5], i1 = (i0 + 1) % TRK.N, bar = d < 0 ? TRK.barL : TRK.barR, lim = bar[i0] + (bar[i1] - bar[i0]) * f - 0.25, pen = (d < 0 ? -d : d) - lim;
    if (pen > 0 && pen < 6) {
      const tx = TRK.tx[i0] + (TRK.tx[i1] - TRK.tx[i0]) * f, tz = TRK.tz[i0] + (TRK.tz[i1] - TRK.tz[i0]) * f, sg = d < 0 ? 1 : -1, nx = -tz * sg, nz = tx * sg;
      V.x += nx * pen; V.z += nz * pen;
      let wvx = V.vx * c - V.vy * s, wvz = V.vx * s + V.vy * c; const vn = wvx * nx + wvz * nz;
      if (vn < 0) {
        wvx -= nx * vn * 1.25; wvz -= nz * vn * 1.25; const tgx = -nz, tgz = nx, vt = wvx * tgx + wvz * tgz; wvx -= tgx * vt * 0.12; wvz -= tgz * vt * 0.12;
        V.vx = wvx * c + wvz * s; V.vy = -wvx * s + wvz * c;
        const rx = c * lx - s * lz, rz = s * lx + c * lz; V.r += (rx * nz - rz * nx) * (-vn) * 0.35; V.r *= 0.85; V.hits++;
      }
    }
  }
}
