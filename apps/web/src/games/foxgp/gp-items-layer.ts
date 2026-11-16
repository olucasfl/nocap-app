import * as THREE from 'three';
import type { GpCar, GpItemEvent, GpItemsReadable } from '@nocap/games';
import { animateItem, buildItem, glowTexture, type GpItemId as GpModelId } from './item-models';

/** O item é pequeno perto do kart (que mede 3,6 m de largura): em cena ele é ampliado para ler de longe. */
const S = 2.1;
const ORBIT_R = 3.6;

interface Slot {
  g: THREE.Group;
}

/** Uma partícula de brilho (sprite aditivo) que sobe, encolhe ou cresce e apaga. */
interface Spark {
  s: THREE.Sprite;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  g: number;
}
/** Anel de choque no chão que se expande e some. */
interface Wave {
  m: THREE.Mesh;
  life: number;
  max: number;
  r1: number;
}
const SPARK_POOL = 320;

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
  private sparks: Spark[] = [];
  private free: Spark[] = [];
  private waves: Wave[] = [];
  private trailAcc = new Map<number, number>();

  constructor(
    scene: THREE.Scene,
    private sys: GpItemsReadable,
  ) {
    scene.add(this.group);
    const tex = glowTexture();
    for (let i = 0; i < SPARK_POOL; i++) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      sp.visible = false;
      this.group.add(sp);
      this.free.push({ s: sp, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s0: 1, s1: 1, g: 0 });
    }
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

  /** Solta uma partícula (some quando a reserva acaba). */
  private emit(
    x: number,
    y: number,
    z: number,
    color: number,
    size: number,
    life: number,
    v: [number, number, number] = [0, 0, 0],
    grow = 0.2,
    grav = 0,
  ) {
    const p = this.free.pop();
    if (!p) return;
    p.s.visible = true;
    (p.s.material as THREE.SpriteMaterial).color.setHex(color);
    p.s.position.set(x, y, z);
    p.vx = v[0];
    p.vy = v[1];
    p.vz = v[2];
    p.life = p.max = life;
    p.s0 = size;
    p.s1 = size * grow;
    p.g = grav;
    this.sparks.push(p);
  }

  private wave(x: number, z: number, color: number, r1: number, life: number, y = 0.15) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 48),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    this.group.add(m);
    this.waves.push({ m, life, max: life, r1 });
  }

  private burst(
    x: number,
    y: number,
    z: number,
    colors: number[],
    n: number,
    speed: number,
    size: number,
    life: number,
    up = 0.5,
  ) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.3) * up * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.emit(
        x,
        y,
        z,
        colors[i % colors.length]!,
        size * (0.6 + Math.random() * 0.8),
        life * (0.6 + Math.random() * 0.6),
        [Math.cos(a) * sp, sp * (0.4 + e), Math.sin(a) * sp],
        0.15,
        9,
      );
    }
  }

  /** Efeitos dos eventos dos itens: pegar, usar, acertar, bloquear e explodir (só visual; o som fica no GpPlay). */
  event(e: GpItemEvent, car: GpCar | undefined) {
    if (e.type === 'boom') {
      this.burst(e.x, 1.2, e.z, [0xfff3a8, 0xffb02e, 0xff5a2a, 0xff3a1a], 46, 24, 2.6, 0.9, 0.9);
      this.burst(e.x, 1, e.z, [0x8a5cff, 0xc9a8ff], 22, 16, 1.8, 0.8, 0.8);
      this.emit(e.x, 1.6, e.z, 0xfff6c8, 15, 0.35, [0, 0, 0], 0.4);
      this.emit(e.x, 1.4, e.z, 0xff7a2a, 11, 0.7, [0, 0, 0], 0.5);
      this.wave(e.x, e.z, 0xffb02e, 15, 0.55);
      this.wave(e.x, e.z, 0x8a5cff, 10, 0.4);
      return;
    }
    if (!car) return;
    const x = car.x;
    const z = car.z;
    if (e.type === 'pickup') {
      this.burst(x, 1.8, z, [0xfff1d0, 0xff9a3d, 0xffd23a], 26, 9, 1.1, 0.8, 1.2);
      this.wave(x, z, 0xffa54a, 5, 0.5);
    } else if (e.type === 'hit') {
      this.burst(x, 1.6, z, [0xfff6c8, 0xffd23a, 0xff7d26], 30, 14, 1.4, 0.7, 1);
      this.wave(x, z, 0xfff1d0, 6, 0.4);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this.emit(
          x + Math.cos(a) * 1.4,
          3.2 + (i % 2) * 0.6,
          z + Math.sin(a) * 1.4,
          0xffd23a,
          1.5,
          1,
          [0, 1.2, 0],
          0.4,
        );
      }
    } else if (e.type === 'blocked') {
      this.wave(x, z, 0xffd23a, 5.5, 0.45, 0.9);
      this.burst(x, 1.5, z, [0xffd23a, 0xfff6c8], 14, 10, 1, 0.5, 0.4);
    } else if (e.type === 'use') {
      const k = e.item.replace('3', '');
      const fx = Math.sin(car.h);
      const fz = -Math.cos(car.h);
      if (k === 'nitro')
        this.burst(
          x - fx * 2.6,
          0.9,
          z - fz * 2.6,
          [0xfff6c8, 0xff7d26, 0x4f8bff],
          26,
          12,
          1.4,
          0.5,
          0.3,
        );
      else if (k === 'star') {
        this.burst(x, 1.4, z, [0xffd23a, 0xfff6c8, 0xffb02e], 36, 12, 1.4, 0.9, 1.2);
        this.wave(x, z, 0xffd23a, 8, 0.6);
      } else if (k === 'bolt') {
        this.burst(x + fx * 3, 1.4, z + fz * 3, [0x4fb3ff, 0xdff4ff], 22, 12, 1.2, 0.6, 0.6);
        this.wave(x, z, 0x4fb3ff, 7, 0.5);
      } else this.burst(x + fx * 3, 1.2, z + fz * 3, [0xfff6c8, 0xffffff], 10, 7, 0.9, 0.4, 0.4);
    }
  }

  private stepFx(dt: number) {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        p.s.visible = false;
        this.free.push(p);
        this.sparks.splice(i, 1);
        continue;
      }
      const k = 1 - p.life / p.max;
      p.vy -= p.g * dt;
      p.s.position.x += p.vx * dt;
      p.s.position.y = Math.max(0.1, p.s.position.y + p.vy * dt);
      p.s.position.z += p.vz * dt;
      p.s.scale.setScalar(p.s0 + (p.s1 - p.s0) * k);
      (p.s.material as THREE.SpriteMaterial).opacity = (1 - k) ** 1.4;
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]!;
      w.life -= dt;
      if (w.life <= 0) {
        this.group.remove(w.m);
        w.m.geometry.dispose();
        (w.m.material as THREE.Material).dispose();
        this.waves.splice(i, 1);
        continue;
      }
      const k = 1 - w.life / w.max;
      w.m.scale.setScalar(0.3 + w.r1 * (1 - (1 - k) ** 3));
      (w.m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
    }
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

    this.stepFx(dt);
    const seen = new Set<number>();
    for (const sh of this.sys.shots) {
      seen.add(sh.uid);
      let s = this.shots.get(sh.uid);
      if (!s) {
        s = { g: this.spawn(sh.kind as GpModelId) };
        this.shots.set(sh.uid, s);
      }
      s.g.position.set(sh.x, 0.25, sh.z);
      s.g.rotation.y = -sh.h;
      if (sh.kind === 'ball') {
        // rola em torno do próprio centro (o grupo fica no chão) e quica de leve
        const roll = s.g.getObjectByName('roll');
        if (roll) roll.rotation.x = t * 14;
        s.g.position.y = 0.25 + Math.abs(Math.sin(t * 9 + sh.uid)) * 0.35;
      }
      // rastro: cada tiro solta brilho atrás de si
      const acc = (this.trailAcc.get(sh.uid) ?? 0) + dt;
      if (acc > 0.025) {
        this.trailAcc.set(sh.uid, 0);
        const bx = sh.x - Math.sin(sh.h) * 1.4;
        const bz = sh.z + Math.cos(sh.h) * 1.4;
        const r = () => (Math.random() - 0.5) * 0.9;
        if (sh.kind === 'ball')
          this.emit(bx + r() * 0.4, 0.9, bz + r() * 0.4, 0x35ff8a, 1.5, 0.45, [0, 0.6, 0], 0.1);
        else if (sh.kind === 'seeker') {
          this.emit(bx + r() * 0.3, 1.1, bz + r() * 0.3, 0xffb02e, 2.1, 0.5, [r(), 0.8, r()], 0.15);
          this.emit(bx + r() * 0.5, 1.3, bz + r() * 0.5, 0xe8343c, 2.6, 0.7, [r(), 1.2, r()], 0.3);
        } else {
          this.emit(
            bx + r() * 0.3,
            1.2,
            bz + r() * 0.3,
            0x4fb3ff,
            2.3,
            0.6,
            [r() * 2, r() * 2 + 1, r() * 2],
            0.1,
          );
          this.emit(
            bx + r(),
            1.2 + Math.random(),
            bz + r(),
            0xdff4ff,
            1.1,
            0.35,
            [r() * 3, r() * 3, r() * 3],
            0.1,
          );
        }
      } else this.trailAcc.set(sh.uid, acc);
    }
    for (const [uid, s] of this.shots)
      if (!seen.has(uid)) {
        this.group.remove(s.g);
        this.shots.delete(uid);
        this.trailAcc.delete(uid);
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
      if (tp.kind === 'bomb') {
        s.g.scale.setScalar(S * (1 + Math.abs(Math.sin(t * (6 + (3 - tp.fuse) * 4))) * 0.08));
        if (Math.random() < 0.5)
          this.emit(
            tp.x + 0.6,
            2.7,
            tp.z,
            Math.random() < 0.5 ? 0xffd23a : 0xff7d26,
            0.9,
            0.35,
            [(Math.random() - 0.5) * 2, 2.5, (Math.random() - 0.5) * 2],
            0.2,
            6,
          );
        // anel de aviso no chão no tamanho da explosão: pisca mais rápido perto de estourar
        const warn = s.g.getObjectByName('warn') as THREE.Mesh | undefined;
        if (!warn) {
          const w = new THREE.Mesh(
            new THREE.RingGeometry(0.93, 1, 48),
            new THREE.MeshBasicMaterial({
              color: 0xff5a2a,
              transparent: true,
              opacity: 0.5,
              depthWrite: false,
              side: THREE.DoubleSide,
            }),
          );
          w.rotation.x = -Math.PI / 2;
          w.position.y = 0.06;
          w.scale.setScalar(14 / S);
          w.name = 'warn';
          s.g.add(w);
        } else
          (warn.material as THREE.MeshBasicMaterial).opacity =
            0.25 + 0.4 * Math.abs(Math.sin(t * (4 + (3 - tp.fuse) * 5)));
      } else if (Math.random() < 0.08)
        this.emit(
          tp.x + (Math.random() - 0.5) * 2,
          0.4,
          tp.z + (Math.random() - 0.5) * 2,
          0xffd9a0,
          0.6,
          0.6,
          [0, 1, 0],
          0.2,
        );
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
        const col = [0xffd23a, 0xfff6c8, 0xff7d26, 0x5fe3ff][Math.floor(t * 12) % 4]!;
        (halo.material as THREE.MeshBasicMaterial).color.setHex(col);
        if (Math.random() < 0.6) {
          const a = Math.random() * Math.PI * 2;
          this.emit(
            p.x + Math.cos(a) * 3,
            0.8 + Math.random() * 1.6,
            p.z + Math.sin(a) * 3,
            col,
            0.9,
            0.5,
            [0, 1.4, 0],
            0.2,
          );
        }
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
