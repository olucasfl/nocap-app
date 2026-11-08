// Planta texturizada do mapa vista de cima (para o radar e o mapa grande): renderiza o GLB com câmera ortográfica no Chromium.
// Uso (de apps/web): node ../../tools/art/render_plan.mjs <mapa.glb> <dados.ts> <saida.png> [pixels por metro]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
// o playwright mora em apps/web: resolve a partir da pasta onde o comando roda
const { chromium } = createRequire(path.resolve('package.json'))('playwright');

const [glb, dataTs, out, ppmArg] = process.argv.slice(2);
const ppm = Number(ppmArg ?? 12);
const text = fs.readFileSync(dataTs, 'utf8');
const d = JSON.parse(text.slice(text.indexOf('{', text.indexOf('=')), text.lastIndexOf('}') + 1));
const w = d.cols * d.cell, h = d.rows * d.cell;
const threeDir = path.resolve('node_modules/three');
const html = `<!doctype html><body style="margin:0"><canvas id=c></canvas><script type=module>
import * as THREE from '/three/build/three.module.js';
import { GLTFLoader } from '/three/examples/jsm/loaders/GLTFLoader.js';
const W=${Math.round(w * ppm)}, H=${Math.round(h * ppm)};
const cv=document.getElementById('c'); cv.width=W; cv.height=H;
const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true}); r.setSize(W,H,false); r.setClearColor(0x0e1530,1);
const s=new THREE.Scene();
const cam=new THREE.OrthographicCamera(${d.x0},${d.x0 + w},${-d.z0},${-(d.z0 + h)},0.1,200);
// z cresce para baixo na tela: câmera olhando para -y com o "cima" da imagem apontando para -z
cam.position.set(0,100,0); cam.up.set(0,0,-1); cam.lookAt(0,0,0);
const g=await new GLTFLoader().loadAsync('/glb');
g.scene.traverse(o=>{ if(o.isMesh){ const m=o.material; o.material=new THREE.MeshBasicMaterial({map:m.map||null,color:m.color||0xffffff,side:THREE.DoubleSide}); if(m.map){ m.map.minFilter=THREE.NearestFilter; m.map.magFilter=THREE.NearestFilter; m.map.anisotropy=1; } } });
s.add(g.scene);
r.render(s,cam);
window.__png=cv.toDataURL('image/png'); window.__done=true;
</script>`;
const srv = http.createServer((q, res) => {
  if (q.url === '/') { res.setHeader('content-type', 'text/html'); res.end(html); return; }
  if (q.url === '/glb') { res.end(fs.readFileSync(glb)); return; }
  if (q.url.startsWith('/three/')) {
    const f = path.join(threeDir, q.url.slice(7));
    res.setHeader('content-type', 'text/javascript');
    res.end(fs.readFileSync(f).toString().replace(/from 'three'/g, "from '/three/build/three.module.js'")); return;
  }
  res.statusCode = 404; res.end();
}).listen(0);
const port = srv.address().port;
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('console', m.text()));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction('window.__done === true', null, { timeout: 120000 });
const png = await page.evaluate('window.__png');
fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
await browser.close(); srv.close();
console.log('planta', out, Math.round(w * ppm), 'x', Math.round(h * ppm), 'px');
