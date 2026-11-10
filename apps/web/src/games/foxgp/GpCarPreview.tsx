import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { GpPaint } from '@nocap/games';
import { buildCar, type CarModel } from './car-model';

/**
 * Prévia 3D do carro em tempo real (garagem e tela inicial): luz de estúdio, chão, o carro com a pintura de agora e a
 * cauda balançando. Arraste para girar (órbita); parado, ele gira sozinho devagar.
 */
export function GpCarPreview({
  fur,
  paint,
  className,
  label = 'Prévia do carro',
  interactive = true,
}: {
  fur: number;
  paint: GpPaint;
  className?: string;
  label?: string;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef<{ setCar: (fur: number, paint: GpPaint) => void } | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(-5, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const rim = new THREE.DirectionalLight(0x9db4ff, 1.4);
    rim.position.set(6, 4, -6);
    scene.add(key, rim, new THREE.HemisphereLight(0xdfe4ef, 0x141a2b, 1.1));
    // só a sombra no chão: o fundo da tela aparece por trás (sem um retângulo escuro em volta do carro)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.ShadowMaterial({ opacity: 0.45 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    let car: CarModel | null = null;
    const setCar = (f: number, p: GpPaint) => {
      if (car) {
        scene.remove(car.group);
        car.dispose();
      }
      car = buildCar({ fur: f, paint: p });
      scene.add(car.group);
    };
    setCar(fur, paint);
    live.current = { setCar };
    let yaw = 0.7;
    let pitch = 0.32;
    let dragging: { x: number; y: number } | null = null;
    let idle = 0;
    const down = (e: PointerEvent) => {
      if (!interactive) return;
      dragging = { x: e.clientX, y: e.clientY };
      cv.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      yaw -= (e.clientX - dragging.x) * 0.01;
      pitch = Math.max(0.05, Math.min(1.1, pitch + (e.clientY - dragging.y) * 0.006));
      dragging = { x: e.clientX, y: e.clientY };
      idle = 0;
    };
    const up = () => {
      dragging = null;
    };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    const size = () => {
      const r = cv.getBoundingClientRect();
      renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
      camera.aspect = r.width / Math.max(1, r.height);
      camera.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(cv);
    let raf = 0;
    let last = performance.now();
    let t = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      idle += dt;
      if (!dragging && idle > 1.5 && !reduced) yaw += dt * 0.35;
      if (car) car.tail.rotation.y = reduced ? 0 : Math.sin(t * 5) * 0.25;
      const dist = 9;
      camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, 0.8 + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
      camera.lookAt(0, 0.55, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
      (car as CarModel | null)?.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
      renderer.dispose();
      live.current = null;
    };
    // o carro muda pelo efeito de baixo, sem recriar a cena
  }, [interactive]);
  useEffect(() => {
    live.current?.setCar(fur, paint);
  }, [fur, paint]);
  return <canvas ref={ref} className={className} role="img" aria-label={label} style={{ touchAction: 'none' }} />;
}
