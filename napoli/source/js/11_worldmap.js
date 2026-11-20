// Mappe del mondo GPU per il Circuito del Lungomare di Napoli: altezza (r32float) e zone (rgba8).
// R = distanza dal bordo asfalto | G = 0 (circuito cittadino senza ghiaia) | B = parco/vegetazione | A = pavimentazione lungomare/piazza/paddock
const WM = { height: null, zone: null, x0: 0, z0: 0, sx: 1, sz: 1, zw: 0, zh: 0, zdata: null };
function worldMapBuild() {
  const dev = G.dev;
  WM.x0 = HF.x0; WM.z0 = HF.z0; WM.sx = HF.w - 1; WM.sz = HF.h - 1;
  WM.height = mkTex(HF.w, HF.h, 'r32float', TU.TB | TU.CD);
  dev.queue.writeTexture({ texture: WM.height }, HF.d, { bytesPerRow: HF.w * 4 }, [HF.w, HF.h]);
  const zw = WM.zw = (HF.w - 1) * 2 + 1, zh = WM.zh = (HF.h - 1) * 2 + 1, z = WM.zdata = new Uint8Array(zw * zh * 4), loc = new Float64Array(4);
  const enc = (v, lo, hi) => Math.round(sat((v - lo) / (hi - lo)) * 255);
  for (let j = 0; j < zh; j++) for (let i = 0; i < zw; i++) {
    const x = WM.x0 + i * 0.5, zz = WM.z0 + j * 0.5, o = (j * zw + i) * 4;
    const cz = napoliCoastZ(x);
    // Zona pavimentata lungomare: Via Caracciolo, spartitraffico centrale, piazza Rotonda Diaz, Tribuna A/B ed Event Village
    let pave = -8;
    const inCorridor = (x > TRK.bx0 - 30 && x < TRK.bx1 + 30 && zz > -40 && zz < cz - 0.5);
    const inVillage = (x > -104 && x < 104 && zz > -74 && zz <= -38);
    if (inCorridor || inVillage) {
      const distCoast = cz - zz;
      const distNorth = inVillage ? (zz - (-74)) : (zz - (-40));
      pave = Math.min(distCoast, distNorth, x - (TRK.bx0 - 30), (TRK.bx1 + 30) - x);
    }
    if (trackFarDist(x, zz) > 70) {
      z[o] = 255; z[o + 1] = 0; z[o + 2] = 255; z[o + 3] = enc(pave, -8, 8);
      continue;
    }
    trackLocate(x, zz, -1, loc); const d = loc[1], ad = Math.abs(d), hw = TRK.hw;
    z[o] = enc(ad - hw, -8, 24);
    z[o + 1] = 0; // nessuna trappola di ghiaia
    z[o + 2] = enc(-zz - 40, -2.0, 10.0); // erba/parco solo in Villa Comunale (z < -40)
    z[o + 3] = enc(Math.max(pave, hw + 10 - ad), -8, 8);
  }
  WM.zone = mkTex(zw, zh, 'rgba8unorm', TU.TB | TU.CD);
  dev.queue.writeTexture({ texture: WM.zone }, z, { bytesPerRow: zw * 4 }, [zw, zh]);
}
