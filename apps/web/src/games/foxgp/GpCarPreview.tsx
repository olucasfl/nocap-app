import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { GpPaint } from '@nocap/games';
import { buildCar, type CarModel } from './car-model';
import { buildKart, kartReady, preloadKart, type KartModel } from './kart-model';

/**
 * Prévia 3D do carro em tempo real (garagem, tela inicial e lobby): luz de estúdio com reflexo na pintura, chão, o carro
 * com a pintura de agora e a cauda balançando. Arrastar com o mouse ou o dedo gira o carro; ao soltar ele segue com
 * inércia e, uns 3 s depois, volta a girar sozinho devagar (spec 080, Fase 7).
 */
export function GpCarPreview({
  fur,
  paint,
  className,
  label = 'Prévia do carro',
  interactive = true,
  vehicle = 'f1',
}: {
  fur: number;
  paint: GpPaint;
  className?: string;
  label?: string;
  interactive?: boolean;
  /** Qual veículo mostrar (o kart baixa na hora, se preciso). */
  vehicle?: 'f1' | 'kart';
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef<{ setCar: (fur: number, paint: GpPaint, vehicle: 'f1' | 'kart') => void } | null>(null);
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
    // reflexo de estúdio na pintura com verniz
    const pm = new THREE.PMREMGenerator(renderer);
    const envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    scene.environment = envTex;
    scene.environmentIntensity = 0.45;
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
    let car: CarModel | KartModel | null = null;
    let want = 0;
    const setCar = (f: number, p: GpPaint, v: 'f1' | 'kart') => {
      const n = ++want;
      const put = () => {
        if (n !== want) return;
        if (car) {
          scene.remove(car.group);
          car.dispose();
        }
        car = v === 'kart' && kartReady() ? buildKart({ fur: f, paint: p }) : buildCar({ fur: f, paint: p });
        scene.add(car.group);
      };
      if (v === 'kart' && !kartReady()) void preloadKart().then(put, put);
      else put();
    };
    setCar(fur, paint, vehicle);
    live.current = { setCar };
    let yaw = 0.7;
    let pitch = 0.32;
    let dragging: { x: number; y: number; t: number } | null = null;
    let idle = 99;
    /** Giro que sobra ao soltar (rad/s): some aos poucos. */
    let spin = 0;
    const down = (e: PointerEvent) => {
      if (!interactive) return;
      e.preventDefault();
      dragging = { x: e.clientX, y: e.clientY, t: performance.now() };
      spin = 0;
      cv.setPointerCapture(e.pointerId);
      cv.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dx = (e.clientX - dragging.x) * 0.01;
      yaw -= dx;
      const dts = Math.max(0.008, (now - dragging.t) / 1000);
      spin = spin * 0.6 + (-dx / dts) * 0.4;
      pitch = Math.max(0.05, Math.min(1.1, pitch + (e.clientY - dragging.y) * 0.006));
      dragging = { x: e.clientX, y: e.clientY, t: now };
      idle = 0;
    };
    const up = () => {
      if (!dragging) return;
      dragging = null;
      idle = 0;
      cv.style.cursor = interactive ? 'grab' : '';
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
      if (!dragging) {
        // inércia ao soltar; depois de ~3 s parado, volta a girar sozinho devagar
        yaw += spin * dt;
        spin *= Math.exp(-dt * 2.5);
        if (idle > 3 && !reduced) yaw += dt * 0.35;
      }
      if (car && 'kart' in car)
        (car as KartModel).update(dt, { steer: reduced ? 0 : Math.sin(t * 0.8) * 0.5, throttle: 0, brake: 0, speed: 0, boost: 0 });
      else if (car) car.tail.rotation.y = reduced ? 0 : Math.sin(t * 5) * 0.25;
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
      envTex.dispose();
      renderer.dispose();
      live.current = null;
    };
    // o carro muda pelo efeito de baixo, sem recriar a cena
  }, [interactive]);
  useEffect(() => {
    live.current?.setCar(fur, paint, vehicle);
  }, [fur, paint, vehicle]);
  return (
    <canvas
      ref={ref}
      className={className}
      role="img"
      aria-label={label}
      data-testid="gp-car-preview"
      style={{ touchAction: 'none', cursor: interactive ? 'grab' : undefined }}
    />
  );
}
