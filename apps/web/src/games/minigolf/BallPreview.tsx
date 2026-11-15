import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { GolfBallLook } from '@nocap/games';
import { applyBallLook, buildBallMesh } from './ball-mesh';
import { BallTrail } from './trail';

/** Prévia 3D da bola: gira devagar e vai e volta num gramado pequeno, para mostrar o acabamento e o rastro. */
export function BallPreview({ look, size }: { look: GolfBallLook; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lookRef = useRef(look);
  const apply = useRef<((l: GolfBallLook) => void) | null>(null);

  useEffect(() => {
    lookRef.current = look;
    apply.current?.(look);
  }, [look]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 1, 0.05, 20);
    cam.position.set(0, 0.5, 1.6);
    cam.lookAt(0, 0.08, 0);
    scene.add(new THREE.HemisphereLight(0xdff3ff, 0x2a5a36, 1.3));
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.4);
    sun.position.set(1.5, 3, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.MeshStandardMaterial({ color: 0x2f9650, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.12;
    ground.receiveShadow = true;
    scene.add(ground);
    const ball = buildBallMesh(lookRef.current);
    ball.scale.setScalar(1.7);
    scene.add(ball);
    const trail = new BallTrail();
    trail.setKind(lookRef.current.trail, lookRef.current.color);
    scene.add(trail.points);
    apply.current = (l) => {
      applyBallLook(ball, l);
      trail.setKind(l.trail, l.color);
    };
    const fit = () => {
      const w = cv.clientWidth || 300, h = cv.clientHeight || 300;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    let raf = 0, t = 0, last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      // vai e volta em x; a rotação acompanha o movimento
      const x = Math.sin(t * 1.1) * 0.4, vx = Math.cos(t * 1.1) * 0.4 * 1.1;
      ball.position.set(x, 0.09, 0);
      ball.rotation.z -= (vx * dt) / (0.12 * 1.7);
      ball.rotation.y += dt * 0.3;
      trail.update(dt, [x - Math.sign(vx) * 0.05, 0.09, 0], Math.abs(vx) * 6);
      renderer.render(scene, cam);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      apply.current = null;
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
    };
  }, []);

  return <canvas ref={canvasRef} className="mgh-prev" style={size ? { width: size, height: size } : undefined} aria-label="Prévia da bola" />;
}
