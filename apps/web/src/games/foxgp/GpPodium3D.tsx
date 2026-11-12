import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { GpKartPaint, GpPaint } from '@nocap/games';
import { buildCar } from './car-model';
import { buildKart, kartReady } from './kart-model';

/** O pódio em 3D: três degraus (1º no meio, mais alto), o carro e a raposa de cada um e o troféu do campeão. */
export function GpPodium3D({
  top,
  kart = false,
}: {
  top: { name: string; fur: number; paint: GpPaint | null; kart?: GpKartPaint | null }[];
  /** Arcade: os karts no pódio (o arquivo já foi baixado na partida). */
  kart?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(top);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(-6, 10, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun, new THREE.HemisphereLight(0xdfe4ef, 0x141a2b, 1.2));
    const steps = [
      { place: 1, x: 0, h: 1.8, color: 0xffd23a },
      { place: 2, x: -3.4, h: 1.2, color: 0xd4d8e2 },
      { place: 3, x: 3.4, h: 0.8, color: 0xe08a4a },
    ];
    const disposers: (() => void)[] = [];
    const group = new THREE.Group();
    scene.add(group);
    for (const st of steps) {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, st.h, 4.2),
        new THREE.MeshStandardMaterial({ color: st.color, roughness: 0.45, metalness: 0.2 }),
      );
      block.position.set(st.x, st.h / 2, 0);
      block.castShadow = true;
      block.receiveShadow = true;
      group.add(block);
      const who = top[st.place - 1];
      if (!who) continue;
      const car =
        kart && kartReady()
          ? buildKart({ fur: who.fur, paint: who.paint, kart: who.kart })
          : buildCar({ fur: who.fur, paint: who.paint });
      car.group.position.set(st.x, st.h, 0);
      car.group.rotation.y = Math.PI * 0.85;
      car.group.scale.setScalar(0.8);
      group.add(car.group);
      disposers.push(() => car.dispose());
    }
    // o troféu em cima do carro campeão
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd23a, metalness: 0.35, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
    const cup = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.2, 0.6, 16), gold);
    bowl.position.y = 0.55;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), gold);
    stem.position.y = 0.15;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), gold);
    cup.add(bowl, stem, base);
    cup.position.set(0, 1.8 + 1.7, 0);
    if (top[0]) group.add(cup);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshStandardMaterial({ color: 0x141a2b, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    let raf = 0;
    let t = 0;
    let last = performance.now();
    const size = () => {
      const r = cv.getBoundingClientRect();
      renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
      camera.aspect = r.width / Math.max(1, r.height);
      camera.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(cv);
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      // entrada: o pódio sobe do chão; depois a câmera gira devagar
      const rise = reduced ? 1 : Math.min(1, t / 0.9);
      const e = 1 - (1 - rise) ** 3;
      group.position.y = -3 * (1 - e);
      cup.rotation.y = t * 1.4;
      const a = reduced ? 0.4 : 0.4 + Math.sin(t * 0.25) * 0.35;
      camera.position.set(Math.sin(a) * 15, 6.5, Math.cos(a) * 15);
      camera.lookAt(0, 1.6, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      for (const d of disposers) d();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | undefined;
        mat?.dispose?.();
      });
      renderer.dispose();
    };
  }, [key]);
  return <canvas ref={ref} className="gpf-canvas" role="img" aria-label="Pódio com os carros dos três primeiros" />;
}
