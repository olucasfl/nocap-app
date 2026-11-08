// FBX -> OBJ (posições já na pose final) + materials.json (material -> arquivo de textura), com o FBXLoader do three. Uso (de apps/web): node fbx2obj.mjs <arquivo.fbx> <saida.obj> <materials.json>
import fs from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
const fakeEl = () => ({ addEventListener() {}, removeEventListener() {}, set src(v) {}, style: {}, getContext() { return null; } });
globalThis.document = { createElementNS: fakeEl, createElement: fakeEl };
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.Image = class { addEventListener() {} set src(v) {} };
THREE.TextureLoader.prototype.load = function (url) { const t = new THREE.Texture(); t.name = String(url); t.userData.url = String(url); return t; };
const buf = fs.readFileSync(process.argv[2]);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const fbx = new FBXLoader().parse(ab, '');
fbx.updateMatrixWorld(true);
let out = ''; let vo = 0; let vto = 0;
const mats = new Map();
const stats = { meshes: 0, tris: 0 };
fbx.traverse((o) => {
  if (!o.isMesh) return;
  stats.meshes++;
  const g = o.geometry; const pos = g.attributes.position; const uv = g.attributes.uv;
  const m = o.matrixWorld;
  const flip = m.determinant() < 0;
  console.error('malha', o.name, 'det', m.determinant().toFixed(3), flip ? 'invertida' : '');
  out += `o ${o.name}\n`;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); out += `v ${v.x} ${v.y} ${v.z}\n`; }
  if (uv) for (let i = 0; i < uv.count; i++) out += `vt ${uv.getX(i)} ${uv.getY(i)}\n`;
  const matsArr = Array.isArray(o.material) ? o.material : [o.material];
  const idx = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i);
  const groups = g.groups.length ? g.groups : [{ start: 0, count: idx.length, materialIndex: 0 }];
  for (const gr of groups) {
    const mat = matsArr[gr.materialIndex] ?? matsArr[0];
    const name = (mat.name || 'mat') + '';
    mats.set(name, mat.map?.userData?.url || '');
    mats.set(name + '#col', mat.color ? mat.color.getHexString() : '');
    out += `usemtl ${name}\n`;
    for (let i = gr.start; i < gr.start + gr.count; i += 3) {
      const i1 = flip ? i + 2 : i + 1, i2 = flip ? i + 1 : i + 2;
      const a = idx[i] + 1 + vo, b = idx[i1] + 1 + vo, c = idx[i2] + 1 + vo;
      const ta = uv ? idx[i] + 1 + vto : '', tb = uv ? idx[i1] + 1 + vto : '', tc = uv ? idx[i2] + 1 + vto : '';
      out += uv ? `f ${a}/${ta} ${b}/${tb} ${c}/${tc}\n` : `f ${a} ${b} ${c}\n`;
      stats.tris++;
    }
  }
  vo += pos.count; if (uv) vto += uv.count;
});
fs.writeFileSync(process.argv[3], out);
fs.writeFileSync(process.argv[4], JSON.stringify(Object.fromEntries([...mats].filter(([k]) => !k.includes('#col')))));
console.log(JSON.stringify(stats), JSON.stringify([...mats]));
