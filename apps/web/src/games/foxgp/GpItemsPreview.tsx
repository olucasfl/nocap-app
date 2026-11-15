import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GP_ITEMS, animateItem, buildItem, type GpItemId } from './item-models';
import './theme.css';
import './gp-items.css';

/**
 * Vitrine dos itens do Arcade com poderes (spec 085): cada cartão mostra o modelo 3D girando. Uma única tela de desenho
 * serve a todos (um recorte por cartão), então não pesa no celular.
 */
export function GpItemsPreview() {
  const cv = useRef<HTMLCanvasElement>(null);
  const cells = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    const canvas = cv.current;
    if (!canvas) return undefined;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setScissorTest(true);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 1.0;
    renderer.toneMappingExposure = 1.05;
    pm.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(-3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    key.shadow.camera.left = key.shadow.camera.bottom = -2;
    key.shadow.camera.right = key.shadow.camera.top = 2;
    scene.add(
      key,
      new THREE.DirectionalLight(0x9db4ff, 1.2).translateX(4).translateY(3).translateZ(-4),
    );
    scene.add(new THREE.HemisphereLight(0xdfe4ef, 0x2a3350, 1.6));
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 40),
      new THREE.ShadowMaterial({ opacity: 0.4 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.1, 0.06, 40),
      new THREE.MeshStandardMaterial({ color: 0x2a3350, roughness: 0.6 }),
    );
    pad.position.y = -0.04;
    scene.add(floor, pad);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 1.5, 4.1);
    camera.lookAt(0, 0.62, 0);

    const items = GP_ITEMS.map((info) => {
      const g = buildItem(info.id);
      g.visible = false;
      scene.add(g);
      return { info, g };
    });

    let raf = 0;
    const t0 = performance.now();
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr))
        renderer.setSize(w, h, false);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      renderer.setScissor(0, 0, w, h);
      renderer.setViewport(0, 0, w, h);
      renderer.clear();
      const base = canvas.getBoundingClientRect();
      const t = reduced ? 0.6 : (performance.now() - t0) / 1000;
      for (const { info, g } of items) {
        const el = cells.current[info.id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom < base.top || r.top > base.bottom) continue;
        const x = r.left - base.left;
        const y = base.bottom - r.bottom;
        renderer.setViewport(x, y, r.width, r.height);
        renderer.setScissor(x, y, r.width, r.height);
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
        g.visible = true;
        animateItem(g, info.id as GpItemId, t);
        renderer.render(scene, camera);
        g.visible = false;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
    };
  }, []);

  return (
    <div className="gpi" data-testid="gp-items">
      <canvas ref={cv} className="gpi-cv" aria-hidden="true" />
      <header className="gpi-head">
        <h1>Fox GP: poderes do Arcade</h1>
        <p>
          Os 12 itens do modo Arcade com poderes (spec 085). A corrida normal continua sem eles.
        </p>
      </header>
      <ul className="gpi-grid">
        {GP_ITEMS.map((it) => (
          <li
            key={it.id}
            className="gpi-card"
            style={{ ['--tone' as string]: `#${it.tone.toString(16).padStart(6, '0')}` }}
          >
            <div
              className="gpi-view"
              ref={(el) => {
                cells.current[it.id] = el;
              }}
              data-testid={`gp-item-${it.id}`}
            />
            <b>{it.name}</b>
            <span>{it.blurb}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
