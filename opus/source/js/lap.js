// ---------------------------------------------------------------------------
// lap.js — volta roteirizada: teclas gravadas por quadro de 1/60 s (RLE base36)
// bits: 1 W, 2 S, 4 A, 8 D, 16 Espaço
// ---------------------------------------------------------------------------
'use strict';

const LAP = (() => {
  const L = { keys: null, meta: null };
  if (typeof LAP_DATA !== 'undefined' && LAP_DATA) {
    const [m, runs] = LAP_DATA.split('|');
    L.meta = JSON.parse(m);
    const keys = new Uint8Array(L.meta.frames);
    let p = 0;
    for (const r of runs.split(',')) {
      const v = parseInt(r[0], 36), n = parseInt(r.slice(1), 36);
      for (let i = 0; i < n; i++) keys[p++] = v;
    }
    L.keys = keys;
  }
  return L;
})();
