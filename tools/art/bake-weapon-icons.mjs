/**
 * Gera os ícones 2D das armas do Counter Fox a partir dos MESMOS modelos 3D do jogo (spec 057): vista lateral ortográfica,
 * silhueta branca com os detalhes (vincos, carregador, mira) em transparência mais baixa. O resultado vai para
 * apps/web/public/icons/foxshot/<arma>.png e o HUD e a loja pintam com `mask-image`, então a cor continua vindo do CSS.
 *
 * Como rodar (precisa do site em desenvolvimento e do Playwright):
 *   pnpm --filter web exec vite --port 5181 --strictPort &
 *   BAKE_URL=http://localhost:5181 node tools/art/bake-weapon-icons.mjs
 * Ferramenta de trabalho: não entra no package.json.
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, '../../apps/web');
const require = createRequire(resolve(web, 'package.json'));
const { chromium } = require('playwright');
const base = process.env.BAKE_URL ?? 'http://localhost:5181';
const out = resolve(web, 'public/icons/foxshot');
mkdirSync(out, { recursive: true });

const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#222"><canvas id="c"></canvas>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { makeKnife } from '/src/games/foxshot/FsHands.ts';
const W = 1800, H = 700;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
const loader = new GLTFLoader();
window.bake = async (id, file, opts = {}) => {
  let obj;
  if (id === 'knife') obj = makeKnife();
  else obj = (await loader.loadAsync(file)).scene;
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const ctr = box.getCenter(new THREE.Vector3());
  const ext = [size.x, size.y, size.z];
  // o eixo mais comprido vira a horizontal; o mais fino é a direção de olhar; o do meio é a altura
  const order = [0, 1, 2].sort((a, b) => ext[b] - ext[a]);
  let long = order[0], mid = order[1], thin = order[2];
  const ix = { x: 0, y: 1, z: 2 };
  if (opts.look) {
    // eixos forçados (granadas em pé, faca de lado): olha por \`look\`, a altura é \`up\` e o resto é a horizontal
    thin = ix[opts.look]; mid = ix[opts.up]; long = 3 - thin - mid;
  }
  const axis = (i) => new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
  const right = axis(long).multiplyScalar(opts.flipX ? -1 : 1);
  const up = axis(mid).multiplyScalar(opts.flipY ? -1 : 1);
  const look = new THREE.Vector3().crossVectors(up, right); // de onde se olha
  const sc = new THREE.Scene();
  sc.add(obj);
  obj.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }); });
  const half = Math.max(ext[long] / 2, (ext[mid] / 2) * (W / H)) * 1.04;
  const cam = new THREE.OrthographicCamera(-half, half, half * (H / W), -half * (H / W), 0.01, 100);
  cam.position.copy(ctr).addScaledVector(look, 5);
  cam.up.copy(up);
  cam.lookAt(ctr);
  renderer.render(sc, cam);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(renderer.domElement, 0, 0);
  const src = g.getImageData(0, 0, W, H);
  const d = src.data;
  const res = g.createImageData(W, H);
  const r = res.data;
  const at = (x, y) => (y * W + x) * 4;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = at(x, y);
    const a = d[i + 3];
    if (a < 8) continue;
    // vinco: diferença de normal entre vizinhos (só entre pixels do corpo)
    let e = 0;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const j = at(x + dx, y + dy);
      if (d[j + 3] < 200) continue;
      e = Math.max(e, (Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2])) / 765);
    }
    const line = Math.min(1, e * 5.5);
    r[i] = r[i + 1] = r[i + 2] = 255;
    r[i + 3] = Math.round(a * (1 - 0.62 * line));
    if (a > 100) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  g.putImageData(res, 0, 0);
  const pad = 6;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const outc = document.createElement('canvas');
  const k = Math.min(1, 720 / w);
  outc.width = Math.round(w * k); outc.height = Math.round(h * k);
  const og = outc.getContext('2d');
  og.imageSmoothingQuality = 'high';
  og.drawImage(cv, x0, y0, w, h, 0, 0, outc.width, outc.height);
  return { url: outc.toDataURL('image/png'), w: outc.width, h: outc.height, ext, long, mid, thin };
};
window.ready = true;
</script>`;

const WEAPONS = {
  ak: 'ref/ak.glb', pistol: 'ref/pistol.glb', sniper: 'ref/sniper.glb', smg: 'ref/smg.glb', shotgun: 'ref/shotgun.glb',
  m4: 'ref/m4.glb', usp: 'ref/usp.glb', frag: 'ref/frag.glb', flash: 'ref/flash.glb', knife: '',
};
// só o que sai do automático: granadas em pé e a faca vista de lado (BAKE_FLIPS troca na hora de ajustar)
const FLIPS = { frag: { look: 'z', up: 'y' }, flash: { look: 'x', up: 'y' }, knife: { look: 'y', up: 'x', flipX: true }, ...JSON.parse(process.env.BAKE_FLIPS ?? '{}') };

const tmp = resolve(web, 'icon-bake.html');
writeFileSync(tmp, html);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'], executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(`${base}/icon-bake.html`);
  await page.waitForFunction(() => window.ready, undefined, { timeout: 60000 });
  const sizes = {};
  for (const [id, file] of Object.entries(WEAPONS)) {
    const r = await page.evaluate(([i, f, o]) => window.bake(i, f ? `/models/foxshot/${f}` : '', o), [id, file, FLIPS[id] ?? {}]);
    writeFileSync(resolve(out, `${id}.png`), Buffer.from(r.url.split(',')[1], 'base64'));
    sizes[id] = [r.w, r.h];
    console.log(id, r.w, r.h, r.ext.map((v) => v.toFixed(2)).join(' '), 'axes', r.long, r.mid, r.thin);
  }
  writeFileSync(resolve(out, 'sizes.json'), JSON.stringify(sizes, null, 1));
} finally {
  await browser.close();
  rmSync(tmp, { force: true });
}
