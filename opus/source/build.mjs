// build.mjs — monta ../index.html a partir de source/
import fs from 'fs'; import path from 'path'; import vm from 'vm';
const here = path.dirname(new URL(import.meta.url).pathname);
const JS = ['util.js', 'track.js', 'terrain.js', 'mesh.js', 'car_model.js', 'cargfx.js', 'world.js', 'vegetation.js', 'physics.js', 'ai.js', 'lap.js', 'fx.js', 'renderer.js', 'som.js', 'painel.js', 'game.js'];
// JS: tira as linhas só de comentário, as linhas vazias e a indentação — nunca dentro de template literal
// (o varredor acompanha strings, comentários e templates com ${} aninhado)
function enxuga(src) {
  const tpl = new Set(); let line = 1, st = 0; const depth = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\n') line++;
    if (st === 0) {
      if (c === '/' && src[i + 1] === '/') { const j = src.indexOf('\n', i); i = (j < 0 ? src.length : j) - 1; }
      else if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); for (let k = i; k < j; k++) if (src[k] === '\n') line++; i = j + 1; }
      else if (c === "'" || c === '"') { i++; while (src[i] !== c) { if (src[i] === '\\') i++; i++; } }
      else if (c === '`') st = 1;
      else if (depth.length && c === '{') depth[depth.length - 1]++;
      else if (depth.length && c === '}') { if (depth[depth.length - 1] === 0) { depth.pop(); st = 1; } else depth[depth.length - 1]--; }
    } else {
      tpl.add(line);
      if (c === '\\') i++;
      else if (c === '`') st = 0;
      else if (c === '$' && src[i + 1] === '{') { depth.push(0); st = 0; i++; }
    }
  }
  const out = [];
  src.split('\n').forEach((l, k) => {
    if (tpl.has(k + 1) || tpl.has(k)) { out.push(l); return; }       // linha de template (ou a que o fecha): intacta
    const t = l.trim();
    if (t && !t.startsWith('//')) out.push(t);
  });
  return out.join('\n');
}
let js = '';
for (const f of JS) { const p = path.join(here, 'js', f); if (fs.existsSync(p)) js += enxuga(fs.readFileSync(p, 'utf8')) + '\n'; }
// shaders: remove comentários e espaços redundantes
const sh = {};
for (const f of fs.readdirSync(path.join(here, 'shaders')).sort()) {
  if (!f.endsWith('.wgsl')) continue;
  let s = fs.readFileSync(path.join(here, 'shaders', f), 'utf8');
  s = s.replace(/\/\/[^\n]*/g, '').split('\n').map(l => l.trim()).filter(l => l).join('\n');
  sh[f.replace('.wgsl', '')] = s;
}
let lap = '';
const lapf = path.join(here, 'data', 'lap.txt');
if (fs.existsSync(lapf)) lap = fs.readFileSync(lapf, 'utf8').trim();
const bundle = `'use strict';\nconst SHADERS = ${JSON.stringify(sh)};\nconst LAP_DATA = ${JSON.stringify(lap)};\n` + js.replace(/^'use strict';$/mg, '');
new vm.Script(bundle);   // confere a sintaxe do pacote antes de gravar
const tpl = fs.readFileSync(path.join(here, 'index.template.html'), 'utf8');
const out = tpl.replace('/*__BUNDLE__*/', () => bundle);
const dst = path.join(here, '..', 'index.html');
fs.writeFileSync(dst, out);
console.log('index.html', (out.length / 1024).toFixed(1), 'KB');
