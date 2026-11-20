// Parser glTF 2.0 binario (.glb) zero-dipendenze per il caricamento offline del modello 3D di Posillipo
// (esportato da Metodo 1 Bake 3D Tiles oppure da Metodo 2 LingBot-Map Colab in /assets/posillipo_bundle/models/posillipo_3d_reconstruction.glb).
const GLB_STATE = { loaded: false, source: '', meshCount: 0, triCount: 0, set: null, slot: 0 };

function parseGlbBinary(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 20) throw new Error('File .glb non valido o troppo piccolo.');
  const dv = new DataView(arrayBuffer);
  const magic = dv.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error('Intestazione glTF binaria (.glb) non riconosciuta.');
  const version = dv.getUint32(4, true);
  if (version !== 2) throw new Error('Versione glTF non supportata: ' + version);

  let off = 12, json = null, bin = null;
  while (off + 8 <= arrayBuffer.byteLength) {
    const chunkLen = dv.getUint32(off, true);
    const chunkType = dv.getUint32(off + 4, true);
    off += 8;
    if (off + chunkLen > arrayBuffer.byteLength) break;
    if (chunkType === 0x4e4f534a) {
      const bytes = new Uint8Array(arrayBuffer, off, chunkLen);
      json = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    } else if (chunkType === 0x004e4942) {
      bin = new Uint8Array(arrayBuffer, off, chunkLen);
    }
    off += chunkLen;
  }
  if (!json) throw new Error('Chunk JSON mancante nel file .glb.');
  if (!bin) bin = new Uint8Array(0);

  const compBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const typeCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const readAccessor = (accIdx) => {
    if (accIdx === undefined || !json.accessors || !json.accessors[accIdx]) return null;
    const acc = json.accessors[accIdx];
    const bv = json.bufferViews[acc.bufferView];
    const baseOff = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const nc = typeCount[acc.type] || 1;
    const cb = compBytes[acc.componentType] || 4;
    const stride = bv.byteStride || (nc * cb);
    const count = acc.count;
    const out = acc.componentType === 5125 ? new Uint32Array(count * nc) : (acc.componentType === 5123 ? new Uint16Array(count * nc) : new Float32Array(count * nc));
    const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    for (let i = 0; i < count; i++) {
      const p = baseOff + i * stride;
      for (let c = 0; c < nc; c++) {
        const q = p + c * cb;
        let v = 0;
        if (acc.componentType === 5126) v = view.getFloat32(q, true);
        else if (acc.componentType === 5125) v = view.getUint32(q, true);
        else if (acc.componentType === 5123) v = view.getUint16(q, true);
        else if (acc.componentType === 5121) v = view.getUint8(q) / (acc.normalized ? 255 : 1);
        else if (acc.componentType === 5122) v = view.getInt16(q, true) / (acc.normalized ? 32767 : 1);
        else if (acc.componentType === 5120) v = view.getInt8(q) / (acc.normalized ? 127 : 1);
        out[i * nc + c] = v;
      }
    }
    return { data: out, count, nc };
  };

  const primitives = [];
  const meshes = json.meshes || [];
  const mats = json.materials || [];
  const nodes = json.nodes || [];

  const mul4 = (a, b) => {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  };
  const nodeLocalMat = (nd) => {
    if (nd.matrix && nd.matrix.length === 16) return new Float32Array(nd.matrix);
    const t = nd.translation || [0, 0, 0];
    const q = nd.rotation || [0, 0, 0, 1];
    const s = nd.scale || [1, 1, 1];
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    return new Float32Array([
      (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
      (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
      (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
      t[0], t[1], t[2], 1,
    ]);
  };
  const pushMesh = (mi, mat) => {
    const mesh = meshes[mi];
    if (!mesh) return;
    for (const prim of (mesh.primitives || [])) {
      if (prim.mode !== undefined && prim.mode !== 4) continue; // solo TRIANGLES
      const pos = readAccessor(prim.attributes && prim.attributes.POSITION);
      if (!pos || pos.count < 3) continue;
      const nrm = readAccessor(prim.attributes.NORMAL);
      const uv = readAccessor(prim.attributes.TEXCOORD_0);
      const col = readAccessor(prim.attributes.COLOR_0);
      const idx = readAccessor(prim.indices);
      let baseColor = [0.62, 0.58, 0.50];
      if (prim.material !== undefined && mats[prim.material] && mats[prim.material].pbrMetallicRoughness && mats[prim.material].pbrMetallicRoughness.baseColorFactor) {
        const bc = mats[prim.material].pbrMetallicRoughness.baseColorFactor;
        baseColor = [bc[0], bc[1], bc[2]];
      }
      primitives.push({ pos, nrm, uv, col, idx, baseColor, mat });
    }
  };

  const ident = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  if (nodes.length) {
    const sceneIdx = json.scene || 0;
    const roots = (json.scenes && json.scenes[sceneIdx] && json.scenes[sceneIdx].nodes) || nodes.map((_, i) => i);
    const visit = (ni, parentMat) => {
      const nd = nodes[ni];
      if (!nd) return;
      const worldMat = mul4(parentMat, nodeLocalMat(nd));
      if (nd.mesh !== undefined) pushMesh(nd.mesh, worldMat);
      if (nd.children) for (const ch of nd.children) visit(ch, worldMat);
    };
    for (const r of roots) visit(r, ident);
  } else {
    for (let mi = 0; mi < meshes.length; mi++) pushMesh(mi, ident);
  }
  return { primitives, json };
}

function mountGlbPrimitives(parsed, label) {
  if (!parsed || !parsed.primitives.length || typeof MeshBuilder === 'undefined' || !G.dev) return 0;
  const mb = new MeshBuilder(1 << 18);
  let tris = 0;
  for (const pr of parsed.primitives) {
    const base = mb.nv;
    const p = pr.pos.data, n = pr.nrm ? pr.nrm.data : null, u = pr.uv ? pr.uv.data : null, c = pr.col ? pr.col.data : null;
    const bc = pr.baseColor, M = pr.mat;
    mb.mat(5); // materiale roccia/tufo/architettura
    for (let i = 0; i < pr.pos.count; i++) {
      const cr = c ? c[i * pr.col.nc] : bc[0];
      const cg = c ? c[i * pr.col.nc + 1] : bc[1];
      const cb = c ? c[i * pr.col.nc + 2] : bc[2];
      mb.color(cr, cg, cb, 1);
      const px0 = p[i * 3], py0 = p[i * 3 + 1], pz0 = p[i * 3 + 2];
      const px = M[0] * px0 + M[4] * py0 + M[8] * pz0 + M[12];
      const py = M[1] * px0 + M[5] * py0 + M[9] * pz0 + M[13];
      const pz = M[2] * px0 + M[6] * py0 + M[10] * pz0 + M[14];
      const nx0 = n ? n[i * 3] : 0, ny0 = n ? n[i * 3 + 1] : 1, nz0 = n ? n[i * 3 + 2] : 0;
      let nx = M[0] * nx0 + M[4] * ny0 + M[8] * nz0;
      let ny = M[1] * nx0 + M[5] * ny0 + M[9] * nz0;
      let nz = M[2] * nx0 + M[6] * ny0 + M[10] * nz0;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const u0 = u ? u[i * 2] : px * 0.05, v0 = u ? u[i * 2 + 1] : pz * 0.05;
      mb.v(px, py, pz, nx, ny, nz, u0, v0);
    }
    if (pr.idx) {
      const id = pr.idx.data;
      for (let i = 0; i + 2 < id.length; i += 3) { mb.tri(base + id[i], base + id[i + 1], base + id[i + 2]); tris++; }
    } else {
      for (let i = 0; i + 2 < pr.pos.count; i += 3) { mb.tri(base + i, base + i + 1, base + i + 2); tris++; }
    }
  }
  if (!tris) return 0;
  const fam = R.families.glb || mkFamily('glb', { src: 'mat_test', cull: 'none' });
  if (!GLB_STATE.set) {
    GLB_STATE.set = new MeshSet(fam);
    GLB_STATE.slot = objSlot();
    m4ident(objModel(GLB_STATE.slot));
    R.drawables.push(GLB_STATE.set);
  }
  GLB_STATE.set.items.length = 0;
  GLB_STATE.set.add(mb.upload(), GLB_STATE.slot, QUAL.shadows > 0 ? 7 : 5, 3200);
  GLB_STATE.loaded = true;
  GLB_STATE.source = label || 'posillipo_3d_reconstruction.glb';
  GLB_STATE.meshCount = parsed.primitives.length;
  GLB_STATE.triCount = tris;
  return tris;
}

async function tryAutoLoadPosillipoGlb() {
  const url = '/assets/posillipo_bundle/models/posillipo_3d_reconstruction.glb';
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return false;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html')) return false;
    const buf = await res.arrayBuffer();
    const parsed = parseGlbBinary(buf);
    const tris = mountGlbPrimitives(parsed, 'posillipo_3d_reconstruction.glb');
    return tris > 0;
  } catch (e) {
    return false;
  }
}

async function loadLocalGlbFile(file) {
  if (!file) return 0;
  const buf = await file.arrayBuffer();
  const parsed = parseGlbBinary(buf);
  return mountGlbPrimitives(parsed, file.name);
}
