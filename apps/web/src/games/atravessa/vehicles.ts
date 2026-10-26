import * as THREE from 'three';
import type { AtravessaBiome, VehicleKind } from '@nocap/games';
import { box, model } from './models';

/**
 * Os veículos do Atravessa! (spec 029): cada tipo tem o seu desenho de blocos e todos olham para +X.
 * `userData.lights` (ambulância) e `userData.props` (drone) guardam as peças que a cena anima.
 */

const COLORS: Record<AtravessaBiome, number[]> = {
  horta: [0xe5484d, 0x3e82f7, 0xf2b01e, 0x62b84a, 0x8a5cff],
  deserto: [0xd96b3b, 0xf0c05a, 0xb85042, 0x6aa5a0, 0xe8e0c8],
  neon: [0xff2fb3, 0x19d3ff, 0x8a5cff, 0xffd23f, 0x35e08f],
};

const pickColor = (biome: AtravessaBiome, variant: number) => {
  const list = COLORS[biome];
  return list[Math.floor(variant * list.length) % list.length]!;
};

const TIRE = 0x15161c;
const GLASS = 0x1b2230;

/**
 * Um veículo pronto e juntado em poucas malhas. A cor vem de 5 faixas de `variant`, então cada
 * (tipo, bioma, cor) é montado uma vez e todas as cópias dividem a geometria.
 */
export function buildVehicle(
  kind: VehicleKind,
  biome: AtravessaBiome,
  variant: number,
): THREE.Group {
  const bucket = Math.min(4, Math.floor(variant * 5));
  const animated = kind === 'ambulancia' || kind === 'drone';
  return model(animated ? null : `veh|${kind}|${biome}|${bucket}`, () =>
    rawVehicle(kind, biome, (bucket + 0.5) / 5),
  );
}

function rawVehicle(kind: VehicleKind, biome: AtravessaBiome, variant: number): THREE.Group {
  const g = new THREE.Group();
  const color = pickColor(biome, variant);
  const wheel = (x: number, z: number, s = 0.26) => g.add(box(s, s, 0.14, TIRE, x, s / 2, z));
  const wheels4 = (dx: number, s = 0.26, dz = 0.36) => {
    for (const x of [-dx, dx]) for (const z of [-dz, dz]) wheel(x, z, s);
  };

  switch (kind) {
    case 'carro':
      g.add(box(1.4, 0.38, 0.72, color, 0, 0.3, 0));
      g.add(box(0.74, 0.32, 0.62, 0xf4f4ef, -0.08, 0.64, 0));
      g.add(box(0.76, 0.14, 0.64, GLASS, -0.08, 0.66, 0, { cast: false }));
      wheels4(0.45);
      break;
    case 'esportivo': {
      // baixo, comprido e largo, com faixa e aerofólio: tem cara de rápido
      const c = biome === 'horta' ? 0xe5303a : color;
      g.add(box(1.5, 0.26, 0.76, c, 0, 0.24, 0));
      g.add(box(0.62, 0.2, 0.62, c, -0.12, 0.46, 0));
      g.add(box(0.5, 0.12, 0.56, GLASS, 0.0, 0.48, 0, { cast: false }));
      g.add(box(1.52, 0.03, 0.16, 0xf4f4ef, 0, 0.375, 0, { cast: false }));
      g.add(box(0.12, 0.1, 0.8, 0x15161c, -0.68, 0.5, 0));
      g.add(box(0.08, 0.14, 0.1, 0x15161c, -0.68, 0.4, -0.3));
      g.add(box(0.08, 0.14, 0.1, 0x15161c, -0.68, 0.4, 0.3));
      wheels4(0.48, 0.24, 0.39);
      break;
    }
    case 'taxi':
      g.add(box(1.4, 0.38, 0.72, 0xffc928, 0, 0.3, 0));
      g.add(box(0.74, 0.32, 0.62, 0xffd75a, -0.08, 0.64, 0));
      g.add(box(0.76, 0.14, 0.64, GLASS, -0.08, 0.66, 0, { cast: false }));
      g.add(box(0.26, 0.1, 0.16, 0xf4f4ef, -0.08, 0.86, 0, { emissive: 0.5 }));
      g.add(box(1.42, 0.05, 0.74, 0x15161c, 0, 0.32, 0, { cast: false }));
      wheels4(0.45);
      break;
    case 'perua':
      g.add(box(1.7, 0.38, 0.74, color, 0, 0.3, 0));
      g.add(box(1.16, 0.34, 0.64, color, -0.2, 0.66, 0));
      g.add(box(1.18, 0.16, 0.66, GLASS, -0.2, 0.68, 0, { cast: false }));
      g.add(box(1.16, 0.04, 0.7, 0xf4f4ef, -0.2, 0.86, 0, { cast: false }));
      wheels4(0.55);
      break;
    case 'picape':
      g.add(box(1.7, 0.34, 0.76, color, 0, 0.3, 0));
      g.add(box(0.66, 0.36, 0.66, color, 0.45, 0.64, 0));
      g.add(box(0.5, 0.16, 0.68, GLASS, 0.5, 0.67, 0, { cast: false }));
      g.add(box(0.8, 0.14, 0.06, 0x2a2a30, -0.42, 0.55, 0.36));
      g.add(box(0.8, 0.14, 0.06, 0x2a2a30, -0.42, 0.55, -0.36));
      g.add(box(0.06, 0.14, 0.7, 0x2a2a30, -0.82, 0.55, 0));
      wheels4(0.55, 0.28);
      break;
    case 'trator':
      g.add(box(1.1, 0.4, 0.62, 0x62b84a, 0.3, 0.38, 0));
      g.add(box(0.62, 0.5, 0.6, 0xf2b01e, -0.45, 0.78, 0));
      g.add(box(0.5, 0.5, 0.2, TIRE, -0.6, 0.38, 0.4));
      g.add(box(0.5, 0.5, 0.2, TIRE, -0.6, 0.38, -0.4));
      g.add(box(0.28, 0.28, 0.14, TIRE, 0.7, 0.14, 0.34));
      g.add(box(0.28, 0.28, 0.14, TIRE, 0.7, 0.14, -0.34));
      break;
    case 'caminhao':
      g.add(box(1.8, 0.85, 0.82, 0xf4f4ef, -0.45, 0.62, 0));
      g.add(box(0.92, 0.62, 0.8, color, 0.9, 0.5, 0));
      g.add(box(0.1, 0.28, 0.66, GLASS, 1.38, 0.62, 0, { cast: false }));
      for (const x of [-1.0, -0.2, 1.0]) for (const z of [-0.4, 0.4]) wheel(x, z, 0.3);
      break;
    case 'betoneira': {
      g.add(box(0.9, 0.55, 0.8, color, 0.85, 0.45, 0));
      g.add(box(0.1, 0.24, 0.62, GLASS, 1.32, 0.58, 0, { cast: false }));
      g.add(box(1.6, 0.2, 0.7, 0x2a2a30, -0.35, 0.4, 0));
      // o tambor: caixas inclinadas com listras
      const drum = new THREE.Group();
      drum.position.set(-0.4, 0.95, 0);
      drum.rotation.z = 0.28;
      drum.add(box(1.3, 0.78, 0.78, 0xe8a317, 0, 0, 0));
      drum.add(box(1.34, 0.12, 0.8, 0xf4f4ef, 0, 0.18, 0, { cast: false }));
      drum.add(box(1.34, 0.12, 0.8, 0xf4f4ef, 0, -0.18, 0, { cast: false }));
      g.add(drum);
      for (const x of [-1.0, -0.2, 0.85]) for (const z of [-0.4, 0.4]) wheel(x, z, 0.3);
      break;
    }
    case 'onibus': {
      const c = biome === 'neon' ? 0x8a5cff : biome === 'deserto' ? 0xf0c05a : 0xf2b01e;
      g.add(box(3.1, 0.82, 0.82, c, 0, 0.62, 0));
      g.add(box(2.9, 0.26, 0.84, GLASS, -0.05, 0.84, 0, { cast: false }));
      g.add(box(3.12, 0.06, 0.84, 0xf4f4ef, 0, 0.42, 0, { cast: false }));
      g.add(box(0.1, 0.5, 0.6, GLASS, 1.56, 0.72, 0, { cast: false }));
      for (const x of [-1.0, 1.0]) for (const z of [-0.4, 0.4]) wheel(x, z, 0.3);
      break;
    }
    case 'moto':
      g.add(box(0.9, 0.22, 0.3, 0x14151f, 0, 0.32, 0));
      g.add(box(0.26, 0.4, 0.3, color, 0.1, 0.55, 0));
      g.add(box(0.3, 0.06, 0.34, color, 0, 0.45, 0, { emissive: 0.9 }));
      g.add(box(0.28, 0.28, 0.1, 0x0a0a10, -0.34, 0.14, 0));
      g.add(box(0.28, 0.28, 0.1, 0x0a0a10, 0.34, 0.14, 0));
      g.add(box(0.2, 0.3, 0.22, 0xf4f4ef, -0.1, 0.75, 0)); // o piloto
      g.add(box(0.16, 0.16, 0.2, color, -0.1, 0.98, 0));
      break;
    case 'scooter':
      g.add(box(0.7, 0.18, 0.28, color, 0, 0.26, 0));
      g.add(box(0.1, 0.6, 0.3, color, 0.3, 0.55, 0));
      g.add(box(0.1, 0.1, 0.4, 0x15161c, 0.3, 0.88, 0));
      g.add(box(0.22, 0.26, 0.22, 0xf4f4ef, -0.1, 0.55, 0));
      g.add(box(0.2, 0.2, 0.2, 0xffd9b0, -0.1, 0.8, 0));
      g.add(box(0.2, 0.2, 0.1, 0x0a0a10, 0.28, 0.1, 0));
      g.add(box(0.2, 0.2, 0.1, 0x0a0a10, -0.28, 0.1, 0));
      break;
    case 'drone': {
      g.add(box(0.6, 0.18, 0.5, GLASS, 0, 0.7, 0));
      g.add(box(0.3, 0.1, 0.3, color, 0, 0.82, 0, { emissive: 1 }));
      const props: THREE.Object3D[] = [];
      for (const x of [-0.38, 0.38]) {
        for (const z of [-0.3, 0.3]) {
          const p = box(0.3, 0.04, 0.08, 0x8fa3d1, x, 0.78, z, { cast: false });
          p.userData.keep = true;
          g.add(p);
          props.push(p);
        }
      }
      g.userData.props = props;
      break;
    }
    case 'ambulancia': {
      g.add(box(1.9, 0.78, 0.8, 0xf4f4ef, -0.1, 0.62, 0));
      g.add(box(0.5, 0.52, 0.78, 0xf4f4ef, 0.85, 0.5, 0));
      g.add(box(0.1, 0.24, 0.62, GLASS, 1.12, 0.6, 0, { cast: false }));
      g.add(box(1.94, 0.12, 0.82, 0xe5303a, -0.1, 0.55, 0, { cast: false }));
      // a cruz vermelha dos dois lados
      for (const z of [-0.41, 0.41]) {
        g.add(box(0.36, 0.1, 0.02, 0xe5303a, -0.5, 0.8, z, { cast: false }));
        g.add(box(0.1, 0.36, 0.02, 0xe5303a, -0.5, 0.8, z, { cast: false }));
      }
      const a = box(0.18, 0.12, 0.3, 0xff2a2a, 0.3, 1.06, -0.2, { cast: false, emissive: 1 });
      const b = box(0.18, 0.12, 0.3, 0x2a6aff, 0.3, 1.06, 0.2, { cast: false, emissive: 1 });
      a.userData.keep = true;
      b.userData.keep = true;
      g.add(a, b);
      g.userData.lights = [a, b];
      for (const x of [-0.8, 0.0, 0.85]) for (const z of [-0.4, 0.4]) wheel(x, z, 0.28);
      break;
    }
  }
  return g;
}
