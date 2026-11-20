// Mappe del mondo GPU per il Circuito di Posillipo: altezza (r32float, passo HF.step) e zone (rgba8).
// R = distanza dal bordo carreggiata | G = 0 | B = parco/macchia | A = pavimentazione marciapiedi porfido & area Viale Virgilio
const WM = { height: null, zone: null, x0: 0, z0: 0, sx: 1, sz: 1, zw: 0, zh: 0, zdata: null };
function worldMapBuild() {
  const dev = G.dev, st = HF.step || 1;
  WM.x0 = HF.x0; WM.z0 = HF.z0; WM.sx = (HF.w - 1) * st; WM.sz = (HF.h - 1) * st;
  WM.height = mkTex(HF.w, HF.h, 'r32float', TU.TB | TU.CD);
  dev.queue.writeTexture({ texture: WM.height }, HF.d, { bytesPerRow: HF.w * 4 }, [HF.w, HF.h]);
  // Risoluzione 1 m per la mappa zone (o 2 m su Molto Bassa per risparmiare RAM su PC 2014)
  const zStep = QUAL.id === 'molto-bassa' ? 2 : 1;
  const zw = WM.zw = Math.ceil(WM.sx / zStep) + 1, zh = WM.zh = Math.ceil(WM.sz / zStep) + 1;
  const z = WM.zdata = new Uint8Array(zw * zh * 4), loc = new Float64Array(4);
  const enc = (v, lo, hi) => Math.round(sat((v - lo) / (hi - lo)) * 255);
  for (let j = 0; j < zh; j++) for (let i = 0; i < zw; i++) {
    const x = WM.x0 + i * zStep, zz = WM.z0 + j * zStep, o = (j * zw + i) * 4;
    let pave = -8;
    // Piazzale partenza Viale Virgilio / Paddock / Tribuna
    if (x > -145 && x < 175 && zz > -40 && zz < 38) {
      pave = Math.min(x - (-145), 175 - x, zz - (-40), 38 - zz);
    }
    if (trackFarDist(x, zz) > 72) {
      z[o] = 255; z[o + 1] = 0; z[o + 2] = 255; z[o + 3] = enc(pave, -8, 8);
      continue;
    }
    trackLocate(x, zz, -1, loc); const d = loc[1], ad = Math.abs(d), hw = TRK.hw;
    z[o] = enc(ad - hw, -8, 24);
    z[o + 1] = 0;
    z[o + 2] = enc(ad - (hw + 6.5), -2.0, 12.0);
    z[o + 3] = enc(Math.max(pave, hw + 5.2 - ad), -8, 8);
  }
  WM.zone = mkTex(zw, zh, 'rgba8unorm', TU.TB | TU.CD);
  dev.queue.writeTexture({ texture: WM.zone }, z, { bytesPerRow: zw * 4 }, [zw, zh]);
}
