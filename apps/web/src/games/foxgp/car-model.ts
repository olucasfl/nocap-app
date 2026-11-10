import * as THREE from 'three';
import type { GpPaint } from '@nocap/games';
import { bluish } from './format';

/** Pintura padrão: o corpo segue o pelo e o detalhe é o azul do boné. */
export function defaultPaint(fur: number): GpPaint {
  return { body: fur, accent: bluish(fur) ? 0xff7d26 : 0x2f5bff, pattern: 'faixa', number: 7 };
}

export interface CarModel {
  group: THREE.Group;
  /** Corpo (balança nas batidas); a câmera de cockpit esconde ele. */
  body: THREE.Group;
  wheelsF: THREE.Object3D[];
  wheels: THREE.Object3D[];
  tail: THREE.Group;
  fox: THREE.Group;
  flame: THREE.Mesh;
  /** Materiais do carro (para o fantasma da classificação). */
  mats: THREE.Material[];
  dispose(): void;
}

const numberTextures = new Map<string, THREE.CanvasTexture>();
function numberTexture(n: number, fg: string, bg: string): THREE.CanvasTexture {
  const key = `${n}:${fg}:${bg}`;
  const hit = numberTextures.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext('2d');
  if (g) {
    g.fillStyle = bg;
    g.beginPath();
    g.arc(64, 64, 60, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = fg;
    g.font = 'italic 900 76px "Saira Condensed", Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), 64, 70);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  numberTextures.set(key, tex);
  return tex;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * O carro de F1 em voxel com a raposa no cockpit (spec 079): bico, asas, laterais, tampa do motor e asa de trás em
 * caixas; pintura de carroceria (verniz, metálica de leve) com o desenho escolhido na garagem (faixa, listras ou
 * chevron) e o número; a raposa de boné (boné laranja se o pelo for azulado) e a cauda, que balança. Olha para −Z.
 */
export function buildCar(opts: { fur: number; paint?: GpPaint | null; pbr?: boolean }): CarModel {
  const paint = opts.paint ?? defaultPaint(opts.fur);
  const pbr = opts.pbr ?? true;
  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mat = (color: number, o: { metal?: number; rough?: number; clear?: boolean; glow?: boolean } = {}) => {
    let m: THREE.Material;
    if (o.glow) m = new THREE.MeshBasicMaterial({ color });
    else if (!pbr) m = new THREE.MeshLambertMaterial({ color });
    else if (o.clear)
      m = new THREE.MeshPhysicalMaterial({
        color,
        metalness: o.metal ?? 0.25,
        roughness: o.rough ?? 0.32,
        clearcoat: 0.8,
        clearcoatRoughness: 0.15,
      });
    else m = new THREE.MeshStandardMaterial({ color, metalness: o.metal ?? 0, roughness: o.rough ?? 0.7 });
    mats.push(m);
    return m;
  };
  const add = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const g = new THREE.BoxGeometry(w, h, d);
    geos.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const body = mat(paint.body, { clear: true });
  const accent = mat(paint.accent, { clear: true });
  const carbon = mat(0x1b1535, { rough: 0.45, metal: 0.2 });
  const white = mat(0xfff3e2, { rough: 0.6 });
  const tyre = mat(0x15151a, { rough: 0.85 });
  const rim = mat(0xb9c0cf, { metal: 0.8, rough: 0.3 });
  const sock = mat(0x35211a);
  const blue = bluish(opts.fur);
  const cap = mat(blue ? 0xff7d26 : 0x2f5bff, { rough: 0.55 });
  const capDark = mat(blue ? 0xc95a12 : 0x2347c9, { rough: 0.55 });
  const fur = mat(opts.fur, { rough: 0.9 });

  const group = new THREE.Group();
  const car = new THREE.Group();
  group.add(car);
  // chassi e carroceria
  add(car, 1.0, 0.26, 2.9, body, 0, 0.36, 0.1);
  add(car, 0.46, 0.22, 1.1, body, 0, 0.4, -1.3); // bico
  add(car, 1.8, 0.08, 0.36, carbon, 0, 0.2, -1.78); // asa da frente
  add(car, 1.8, 0.04, 0.14, accent, 0, 0.26, -1.86); // flap da asa
  for (const x of [-0.88, 0.88]) add(car, 0.06, 0.24, 0.42, carbon, x, 0.26, -1.78);
  for (const x of [-0.62, 0.62]) add(car, 0.42, 0.32, 1.2, body, x, 0.42, 0.25); // laterais
  add(car, 0.74, 0.16, 0.86, carbon, 0, 0.56, -0.25); // cockpit
  add(car, 0.56, 0.42, 1.0, body, 0, 0.62, 0.75); // tampa do motor
  add(car, 0.1, 0.5, 0.12, carbon, 0, 0.98, 1.4);
  add(car, 1.5, 0.1, 0.36, carbon, 0, 1.24, 1.5); // asa de trás
  for (const x of [-0.75, 0.75]) add(car, 0.06, 0.42, 0.42, accent, x, 1.1, 1.5);
  // halo (a proteção do cockpit)
  add(car, 0.06, 0.06, 0.62, carbon, 0, 0.92, -0.42);
  for (const x of [-0.3, 0.3]) add(car, 0.06, 0.32, 0.06, carbon, x, 0.76, -0.06);
  add(car, 0.66, 0.06, 0.06, carbon, 0, 0.92, -0.08);
  // desenho da pintura
  if (paint.pattern === 'faixa') {
    add(car, 0.16, 0.23, 1.12, accent, 0, 0.41, -1.3);
    add(car, 0.18, 0.43, 1.02, accent, 0, 0.62, 0.75);
  } else if (paint.pattern === 'listras') {
    for (const x of [-0.62, 0.62]) add(car, 0.43, 0.08, 1.22, accent, x, 0.55, 0.25);
    for (const x of [-0.14, 0.14]) add(car, 0.06, 0.23, 1.12, white, x, 0.41, -1.3);
  } else if (paint.pattern === 'chevron') {
    for (const s of [-1, 1]) {
      const v = add(car, 0.08, 0.23, 0.7, accent, s * 0.12, 0.41, -1.15);
      v.rotation.y = s * 0.35;
    }
    for (const x of [-0.62, 0.62]) add(car, 0.43, 0.33, 0.24, accent, x, 0.42, -0.25);
  }
  // número na tampa do motor e no bico
  const tex = numberTexture(paint.number, hex(paint.body), '#fff3e2');
  const numMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  mats.push(numMat);
  for (const [w, x, y, z, rx] of [
    [0.4, 0, 0.84, 0.75, -Math.PI / 2],
    [0.3, 0, 0.52, -1.5, -Math.PI / 2],
  ] as const) {
    const g = new THREE.PlaneGeometry(w, w);
    geos.push(g);
    const m = new THREE.Mesh(g, numMat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    car.add(m);
  }
  // rodas com aro (as da frente viram com o volante)
  const wheels: THREE.Object3D[] = [];
  const wheelsF: THREE.Object3D[] = [];
  for (const [x, z, big] of [
    [-0.9, -1.0, false],
    [0.9, -1.0, false],
    [-0.9, 1.0, true],
    [0.9, 1.0, true],
  ] as const) {
    const w = new THREE.Group();
    w.position.set(x, big ? 0.3 : 0.27, z);
    const r = big ? 0.3 : 0.26;
    const g = new THREE.CylinderGeometry(r, r, big ? 0.42 : 0.36, 14);
    geos.push(g);
    const t = new THREE.Mesh(g, tyre);
    t.rotation.z = Math.PI / 2;
    t.castShadow = true;
    w.add(t);
    const rg = new THREE.CylinderGeometry(r * 0.55, r * 0.55, (big ? 0.42 : 0.36) + 0.02, 10);
    geos.push(rg);
    const rm = new THREE.Mesh(rg, rim);
    rm.rotation.z = Math.PI / 2;
    w.add(rm);
    group.add(w);
    wheels.push(w);
    if (!big) wheelsF.push(w);
  }
  // a raposa: cabeça, focinho, bochechas, olhos, boné e as orelhas saindo pelo boné
  const fox = new THREE.Group();
  fox.position.set(0, 0.6, -0.25);
  add(fox, 0.46, 0.36, 0.42, fur, 0, 0.26, 0);
  add(fox, 0.22, 0.13, 0.3, fur, 0, 0.18, -0.32);
  add(fox, 0.2, 0.06, 0.26, white, 0, 0.1, -0.32);
  add(fox, 0.09, 0.08, 0.06, sock, 0, 0.22, -0.48);
  for (const x of [-0.24, 0.24]) add(fox, 0.06, 0.13, 0.2, white, x, 0.2, -0.08);
  for (const x of [-0.15, 0.15]) add(fox, 0.08, 0.09, 0.04, mat(0x15100c, { glow: true }), x, 0.32, -0.21);
  add(fox, 0.5, 0.1, 0.46, cap, 0, 0.48, 0);
  add(fox, 0.4, 0.08, 0.36, cap, 0, 0.56, 0);
  add(fox, 0.52, 0.03, 0.48, white, 0, 0.48, 0);
  add(fox, 0.38, 0.04, 0.24, capDark, 0, 0.46, -0.3);
  for (const x of [-0.15, 0.15]) {
    add(fox, 0.16, 0.12, 0.1, fur, x, 0.64, 0.06);
    add(fox, 0.1, 0.09, 0.08, sock, x, 0.74, 0.06);
  }
  car.add(fox);
  // a cauda sai por trás do cockpit, por cima do motor, e balança (mais forte no vácuo)
  const tail = new THREE.Group();
  tail.position.set(0, 0.9, 0.35);
  add(tail, 0.24, 0.24, 0.36, fur, 0, 0.05, 0.18);
  add(tail, 0.3, 0.3, 0.32, fur, 0, 0.16, 0.48);
  add(tail, 0.32, 0.32, 0.3, fur, 0, 0.3, 0.76);
  add(tail, 0.28, 0.26, 0.26, white, 0, 0.42, 1.0);
  tail.rotation.x = 0.25;
  car.add(tail);
  // o fogo do turbo
  const fg = new THREE.BoxGeometry(0.34, 0.26, 0.8);
  geos.push(fg);
  const flame = new THREE.Mesh(
    fg,
    new THREE.MeshBasicMaterial({ color: 0xffa62b, transparent: true, opacity: 0.9, toneMapped: false }),
  );
  flame.position.set(0, 0.5, 1.95);
  flame.visible = false;
  car.add(flame);
  return {
    group,
    body: car,
    wheelsF,
    wheels,
    tail,
    fox,
    flame,
    mats,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      (flame.material as THREE.Material).dispose();
    },
  };
}
