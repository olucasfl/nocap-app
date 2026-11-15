import * as THREE from 'three';
import type { GpCar, GpItemSystem } from '@nocap/games';
import { animateItem, buildItem, type GpItemId as GpModelId } from './item-models';

/** O item é pequeno perto do kart (que mede 3,6 m de largura): em cena ele é ampliado para ler de longe. */
const S = 2.1;
const ORBIT_R = 3.6;

interface Slot {
  g: THREE.Group;
}

/**
 * Desenha os itens do Arcade com poderes na cena: caixas na pista, cascas, bombas e tiros em jogo, os itens girando
 * em volta de cada kart e o brilho do Superfox. Os modelos vêm de `item-models.ts`; aqui só se posiciona (spec 085).
 */
export class GpItemsLayer {
  readonly group = new THREE.Group();
  private boxes: THREE.Group[] = [];
  private shots = new Map<number, Slot>();
  private traps = new Map<number, Slot>();
  private orbits = new Map<string, { id: string; n: number; g: THREE.Group }>();
  private halos = new Map<string, THREE.Mesh>();
  private t = 0;

  constructor(
    scene: THREE.Scene,
    private sys: GpItemSystem,
  ) {
    scene.add(this.group);
    for (const b of sys.boxes) {
      const m = buildItem('box');
      m.scale.setScalar(S);
      m.position.set(b.x, 0, b.z);
      this.group.add(m);
      this.boxes.push(m);
    }
  }

  private spawn(id: GpModelId, scale = S): THREE.Group {
    const g = buildItem(id);
    g.scale.setScalar(scale);
    this.group.add(g);
    return g;
  }

  update(
    dt: number,
    cars: readonly GpCar[],
    pose: (c: GpCar) => { x: number; z: number; h: number },
  ) {
    this.t += dt;
    const t = this.t;
    this.sys.boxes.forEach((b, i) => {
      const m = this.boxes[i]!;
      m.visible = b.cd <= 0;
      animateItem(m, 'box', t + i * 0.4);
      m.position.set(b.x, m.position.y, b.z);
    });

    const seen = new Set<number>();
    for (const sh of this.sys.shots) {
      seen.add(sh.uid);
      let s = this.shots.get(sh.uid);
      if (!s) {
        s = { g: this.spawn(sh.kind as GpModelId) };
        this.shots.set(sh.uid, s);
      }
      s.g.position.set(sh.x, 0.4, sh.z);
      s.g.rotation.y = -sh.h;
      if (sh.kind === 'ball') s.g.rotation.x = t * 12;
    }
    for (const [uid, s] of this.shots)
      if (!seen.has(uid)) {
        this.group.remove(s.g);
        this.shots.delete(uid);
      }

    const seenT = new Set<number>();
    for (const tp of this.sys.traps) {
      seenT.add(tp.uid);
      let s = this.traps.get(tp.uid);
      if (!s) {
        s = { g: this.spawn(tp.kind) };
        this.traps.set(tp.uid, s);
      }
      s.g.position.set(tp.x, 0, tp.z);
      animateItem(s.g, tp.kind, t);
      s.g.position.set(tp.x, s.g.position.y, tp.z);
      // pavio da bomba: pisca mais rápido perto de explodir
      if (tp.kind === 'bomb')
        s.g.scale.setScalar(S * (1 + Math.abs(Math.sin(t * (6 + (3 - tp.fuse) * 4))) * 0.08));
    }
    for (const [uid, s] of this.traps)
      if (!seenT.has(uid)) {
        this.group.remove(s.g);
        this.traps.delete(uid);
      }

    for (const c of cars) {
      const st = this.sys.cars.get(c.id);
      const p = pose(c);
      // itens em volta do kart
      const want = st && st.id && !c.gone ? st : null;
      let o = this.orbits.get(c.id);
      if (o && (!want || o.id !== want.id || o.n !== want.left)) {
        this.group.remove(o.g);
        this.orbits.delete(c.id);
        o = undefined;
      }
      if (want && !o) {
        const kind = want.id!.replace('3', '') as GpModelId;
        const g = new THREE.Group();
        for (let i = 0; i < want.left; i++) {
          const it = buildItem(kind);
          it.scale.setScalar(0.75);
          const a = (i / want.left) * Math.PI * 2;
          it.userData.a = a;
          g.add(it);
        }
        this.group.add(g);
        o = { id: want.id!, n: want.left, g };
        this.orbits.set(c.id, o);
      }
      if (o) {
        o.g.position.set(p.x, 1.2, p.z);
        o.g.children.forEach((ch, i) => {
          const a = (ch.userData.a as number) + t * 2.2;
          ch.position.set(Math.cos(a) * ORBIT_R, Math.sin(t * 3 + i) * 0.15, Math.sin(a) * ORBIT_R);
        });
      }
      // Superfox: aro dourado pulsando em volta do kart
      let halo = this.halos.get(c.id);
      const star = !!st && st.star > 0 && !c.gone;
      if (star && !halo) {
        halo = new THREE.Mesh(
          new THREE.TorusGeometry(3.4, 0.14, 8, 40),
          new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.8 }),
        );
        halo.rotation.x = Math.PI / 2;
        this.group.add(halo);
        this.halos.set(c.id, halo);
      }
      if (halo) {
        halo.visible = star;
        halo.position.set(p.x, 0.7, p.z);
        halo.scale.setScalar(1 + Math.sin(t * 8) * 0.06);
      }
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
  }
}
