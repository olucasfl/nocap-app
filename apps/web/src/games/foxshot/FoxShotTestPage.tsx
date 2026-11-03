import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import * as THREE from 'three';
import {
  FS_ARENA,
  FS_MOVE,
  FS_SPAWN,
  FS_TARGETS,
  FS_WEAPONS,
  FsLoadout,
  fsDir,
  fsNewMover,
  fsSpreadDeg,
  fsStepMover,
  fsTrace,
  type FsBody,
  type FsWeaponId,
} from '@nocap/games';
import { fsAudio } from '@/lib/foxshot-audio';
import { FoxShotScene, type Quality } from './FoxShotScene';
import { FsControls } from './fs-controls';
import './foxshot.css';

const STEP = 1 / 120;
const BASE_FOV = 75;
const REVIVE_S = 3;
const WEAPON_ORDER: FsWeaponId[] = ['ak', 'pistol', 'sniper'];

interface TargetState {
  hp: number;
  armor: number;
  alive: boolean;
  reviveAt: number;
}

interface Hud {
  hp: number;
  armor: number;
  ammo: number;
  mag: number;
  weapon: string;
  weaponId: FsWeaponId;
  reloading: boolean;
  locked: boolean;
  scoped: boolean;
  spreadPx: number;
  fps: number;
  tris: number;
  calls: number;
  level: Quality;
  dpr: number;
  ref: string;
}

interface Marker {
  key: number;
  kind: 'body' | 'head' | 'kill' | 'armor';
  text: string;
}

/**
 * Fox Shot!, fase 0 (spec 056): arena de teste para sentir o visual, o tiro, o recuo de cada arma e o dano estilo CS contra
 * alvos parados (sem colete, com colete, com colete e capacete) a várias distâncias. Sem bots que jogam, sem sala e sem pontuação.
 */
export function FoxShotTestPage() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stickEl = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [portrait, setPortrait] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [marker, setMarker] = useState<Marker | null>(null);
  const [showPerf, setShowPerf] = useState(true);
  const ctl = useRef<FsControls | null>(null);
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    const onResize = () => setPortrait(touch && window.innerHeight > window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [touch]);

  useEffect(() => {
    const el = root.current!;
    const cv = canvas.current!;
    let raf = 0;
    let dead = false;
    const controls = new FsControls();
    ctl.current = controls;
    controls.attach(
      el,
      (s) => {
        const d = stickEl.current;
        if (!d) return;
        if (!s) {
          d.style.opacity = '0';
          return;
        }
        d.style.opacity = '1';
        d.style.transform = `translate(${s.ox - 56}px, ${s.oy - 56}px)`;
        const k = d.firstElementChild as HTMLElement | null;
        if (k) {
          const dx = Math.max(-40, Math.min(40, s.x - s.ox));
          const dy = Math.max(-40, Math.min(40, s.y - s.oy));
          k.style.transform = `translate(${dx}px, ${dy}px)`;
        }
      },
      (locked) => setHud((h) => (h ? { ...h, locked } : h)),
    );

    const scene = new FoxShotScene(cv);
    const resize = () => scene.resize(el.clientWidth, el.clientHeight);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    scene.setQuality(touch ? 'mid' : 'high');

    // ---- estado do jogo
    const mover = fsNewMover(FS_SPAWN.x, FS_SPAWN.z);
    const view = { yaw: (FS_SPAWN.yaw * 180) / Math.PI - 180, pitch: 0, rYaw: 0, rPitch: 0 };
    view.yaw = 0;
    const me = { hp: 100, armor: 100, helmet: true };
    const loadout = new FsLoadout(WEAPON_ORDER);
    const targets = new Map<string, TargetState>(
      FS_TARGETS.map((t) => [t.id, { hp: 100, armor: t.armor, alive: true, reviveAt: 0 }]),
    );
    let markerKey = 0;
    let magInPlayed = false;
    let stepT = 0;
    let frames = 0;
    let acc = 0;
    let slowT = 0;
    let fastT = 0;
    let hudT = 0;
    let boltAt = -1;
    let clock = 0;
    let last = performance.now();
    let fps = 60;
    const cap = (touch ? 'mid' : 'high') as Quality;

    const bodies = (): FsBody[] =>
      FS_TARGETS.map((t) => {
        const s = targets.get(t.id)!;
        return { id: t.id, pos: [t.x, 0, t.z], alive: s.alive, armor: s.armor, helmet: t.helmet };
      });

    const showMarker = (kind: Marker['kind'], text: string) =>
      setMarker({ key: ++markerKey, kind, text });

    const fire = (
      id: FsWeaponId,
      shot: { kickPitch: number; kickYaw: number; devYaw: number; devPitch: number },
    ) => {
      const w = FS_WEAPONS[id];
      const eye: [number, number, number] = [mover.x, mover.y + FS_MOVE.eye, mover.z];
      const dir = fsDir(
        view.yaw + view.rYaw + shot.devYaw,
        view.pitch + view.rPitch + shot.devPitch,
      );
      const tr = fsTrace(w, eye, dir, FS_ARENA, bodies());
      const from = scene.muzzleWorld();
      const to = new THREE.Vector3(tr.point[0], tr.point[1], tr.point[2]);
      scene.tracer(from, to);
      scene.fireFx(id === 'sniper' ? 2.4 : id === 'pistol' ? 0.5 : 1);
      fsAudio.shot(id);
      if (tr.kind === 'world') {
        scene.puff(to, 0xd8c8a8, 0.3, 0.4);
        fsAudio.impact();
      } else if (tr.kind === 'player' && tr.targetId && tr.damage) {
        const st = targets.get(tr.targetId)!;
        const d = tr.damage;
        st.hp -= d.hp;
        st.armor = Math.max(0, st.armor - d.armorLoss);
        scene.puff(to, tr.zone === 'head' ? 0xffd45a : 0xff9a4a, 0.4, 0.3);
        if (st.hp <= 0) {
          st.alive = false;
          st.reviveAt = clock + REVIVE_S;
          scene.killTarget(tr.targetId);
          fsAudio.hit('kill');
          showMarker('kill', tr.zone === 'head' ? 'CABEÇA' : 'ABATE');
        } else {
          scene.hitTarget(tr.targetId);
          const kind = tr.zone === 'head' ? 'head' : d.protectedByArmor ? 'armor' : 'body';
          fsAudio.hit(kind);
          showMarker(kind, `-${d.hp}`);
        }
      }
      // o recuo da arma: a mira sobe e vai de lado pelo padrão da arma
      view.rPitch += shot.kickPitch;
      view.rYaw += shot.kickYaw;
    };

    const handle = (events: ReturnType<FsLoadout['update']>) => {
      for (const e of events) {
        if (e.type === 'fire') fire(e.weapon.id, e.shot);
        else if (e.type === 'dry') fsAudio.dry();
        else if (e.type === 'reload') {
          fsAudio.magOut();
          scene.startReload();
          magInPlayed = false;
        } else if (e.type === 'reloaded') {
          scene.endReload();
          if (e.weapon.id === 'sniper') fsAudio.bolt();
        } else if (e.type === 'draw') fsAudio.draw();
        else if (e.type === 'bolt') boltAt = clock + 0.45;
      }
    };

    const switchTo = (i: number) => {
      const ev = loadout.switchTo(i);
      if (!ev.length) return;
      scene.selectWeapon(loadout.weapon.id);
      handle(ev);
    };

    const frame = (now: number) => {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      frames++;
      fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
      const inp = controls.read();
      const w = loadout.weapon;
      const adsScale = Math.min(1, (w.adsFov || 62) / BASE_FOV) * (inp.ads ? 1 : 1);
      const look = controls.takeLook(inp.ads ? adsScale : 1);
      view.yaw += look.yaw;
      view.pitch = Math.max(-88, Math.min(88, view.pitch + look.pitch));
      if (inp.pick >= 0) switchTo(inp.pick);
      else if (inp.cycle) switchTo((loadout.current + 1) % loadout.slots.length);

      // movimento em passo fixo
      const speed0 = Math.hypot(mover.vx, mover.vz);
      const adsOn = inp.ads && !loadout.reloading;
      const mul = loadout.weapon.moveMul * (adsOn ? 0.65 : 1);
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        fsStepMover(
          mover,
          { fwd: inp.fwd, strafe: inp.strafe, jump: inp.jump, yaw: view.yaw, speedMul: mul },
          STEP,
          FS_ARENA,
        );
        inp.jump = false;
      }
      const speed = Math.hypot(mover.vx, mover.vz);
      if (mover.onGround && speed > 1.5) {
        stepT -= dt * (speed / 3.4);
        if (stepT <= 0) {
          fsAudio.step();
          stepT = 0.5;
        }
      }
      if (speed0 < 0.5 && speed >= 0.5) stepT = 0.05;

      // arma
      const mv = { moving: speed > 0.8, airborne: !mover.onGround, ads: adsOn };
      handle(loadout.update(dt, { trigger: inp.trigger, reload: inp.reload }, mv, 'me'));
      if (loadout.reloading) {
        const p = 1 - loadout.reloadT / loadout.weapon.reload;
        scene.setReloadProgress(p);
        if (p > 0.55 && !magInPlayed) {
          magInPlayed = true;
          fsAudio.magIn();
        }
      }
      if (boltAt > 0 && clock >= boltAt) {
        boltAt = -1;
        fsAudio.bolt();
      }
      // o recuo volta devagar enquanto não atira
      const since = loadout.slot.gun.since;
      if (since > 0.08) {
        const rec = loadout.weapon.recoilRecover * dt;
        const dec = (v: number) => (Math.abs(v) <= rec ? 0 : v - Math.sign(v) * rec);
        view.rPitch = dec(view.rPitch);
        view.rYaw = dec(view.rYaw);
      }
      // alvos revivem
      for (const t of FS_TARGETS) {
        const s = targets.get(t.id)!;
        if (!s.alive && clock >= s.reviveAt) {
          s.alive = true;
          s.hp = 100;
          s.armor = t.armor;
          scene.reviveTarget(t.id);
        }
      }

      const scoped = adsOn && loadout.weapon.adsFov > 0;
      const adsTarget = adsOn ? 1 : 0;
      const fov = BASE_FOV + ((loadout.weapon.adsFov || 62) - BASE_FOV) * (adsOn ? 1 : 0);
      scene.setView(
        mover.x,
        mover.y + FS_MOVE.eye,
        mover.z,
        view.yaw + view.rYaw,
        view.pitch + view.rPitch,
        THREE.MathUtils.lerp(scene.fovNow ?? BASE_FOV, fov, Math.min(1, dt * 12)),
      );
      scene.update(dt, { speed, adsTarget, airborne: !mover.onGround });
      scene.render();

      // qualidade automática pelo fps
      if (dt > 1 / 42) {
        slowT += dt;
        fastT = 0;
      } else if (dt < 1 / 56) {
        fastT += dt;
        slowT = Math.max(0, slowT - dt);
      }
      if (slowT > 1.6 && scene.level !== 'low') {
        scene.setQuality(scene.level === 'high' ? 'mid' : 'low');
        slowT = 0;
      } else if (
        fastT > 8 &&
        ((scene.level === 'low' && cap !== ('low' as Quality)) ||
          (scene.level === 'mid' && cap === 'high'))
      ) {
        scene.setQuality(scene.level === 'low' ? 'mid' : 'high');
        fastT = 0;
      }

      hudT += dt;
      if (hudT > 0.1) {
        hudT = 0;
        const st = scene.stats();
        const spread = fsSpreadDeg(loadout.weapon, mv, loadout.slot.gun);
        setHud({
          hp: me.hp,
          armor: me.armor,
          ammo: loadout.slot.ammo,
          mag: loadout.weapon.mag,
          weapon: loadout.weapon.name,
          weaponId: loadout.weapon.id,
          reloading: loadout.reloading,
          locked: controls.locked || touch,
          scoped,
          spreadPx: Math.min(90, 6 + spread * 7),
          fps: Math.round(fps),
          tris: st.tris,
          calls: st.calls,
          level: scene.level,
          dpr: Math.round(scene.renderer.getPixelRatio() * 100) / 100,
          ref: (['ak', 'pistol', 'sniper'] as FsWeaponId[])
            .filter((k) => scene.usingRef[k])
            .join(','),
        });
      }
    };

    scene
      .load()
      .then(() => {
        if (dead) return;
        setStatus('ready');
        last = performance.now();
        raf = requestAnimationFrame(frame);
      })
      .catch(() => setStatus('error'));

    // ganchos de teste (só em desenvolvimento): apontar para um alvo e atirar
    if (import.meta.env.DEV) {
      (window as unknown as { __fs?: unknown }).__fs = {
        aimAt(id: string, zone: 'head' | 'chest' | 'legs' = 'chest') {
          const t = FS_TARGETS.find((x) => x.id === id)!;
          const y = zone === 'head' ? 1.17 : zone === 'chest' ? 0.9 : 0.3;
          const dx = t.x - mover.x,
            dz = t.z - mover.z,
            dy = y - (mover.y + FS_MOVE.eye);
          view.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
          view.pitch = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
          view.rPitch = view.rYaw = 0;
        },
        teleport(x: number, z: number) {
          mover.x = x;
          mover.z = z;
        },
        shoot(count = 1) {
          const out: { kind: string; zone?: string; hp?: number; killed: boolean }[] = [];
          for (let i = 0; i < count; i++) {
            loadout.slot.gun.since = 99;
            loadout.drawT = 0;
            loadout.cooldown = 0;
            loadout.slot.ammo = Math.max(loadout.slot.ammo, 1);
            const before = [...targets.values()].map((s) => s.hp).join();
            handle(
              loadout.update(
                0.001,
                { trigger: i % 2 === 0, reload: false },
                { moving: false, airborne: false, ads: true },
                'me',
              ),
            );
            out.push({
              kind: 'shot',
              killed: [...targets.values()].some((s) => !s.alive),
              hp: undefined,
              zone: before,
            });
          }
          return out;
        },
        weapon(i: number) {
          switchTo(i);
          loadout.drawT = 0;
        },
        target(id: string) {
          return { ...targets.get(id)! };
        },
        loadout,
        view,
      };
    }

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.detach();
      scene.dispose();
    };
  }, [touch]);

  const press = useCallback(
    (name: 'fire' | 'ads' | 'jump' | 'reload' | 'cycle', down: boolean) =>
      ctl.current?.setTouch(name, down),
    [],
  );

  return (
    <div className="fs" ref={root} data-testid="fs-root">
      <canvas ref={canvas} className="fs-canvas" data-testid="fs-canvas" />
      {status === 'loading' && <div className="fs-load mono">CARREGANDO A ARENA...</div>}
      {status === 'error' && (
        <div className="fs-load mono">Não deu para carregar os modelos. Atualize a página.</div>
      )}

      {hud && status === 'ready' && (
        <>
          {hud.scoped && (
            <div className="fs-scope" aria-hidden="true">
              <i />
              <b />
            </div>
          )}
          {!hud.scoped && (
            <div
              className="fs-cross"
              style={{ ['--g' as string]: `${hud.spreadPx}px` }}
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          {marker && (
            <div
              key={marker.key}
              className={`fs-marker ${marker.kind}`}
              aria-hidden="true"
              data-testid="fs-marker"
            >
              <span className="fs-x" />
              <b>{marker.text}</b>
            </div>
          )}
          <div className="fs-bars" data-testid="fs-bars">
            <div className="fs-bar hp">
              <span>VIDA</span>
              <b>{hud.hp}</b>
              <i style={{ transform: `scaleX(${hud.hp / 100})` }} />
            </div>
            <div className="fs-bar ar">
              <span>COLETE</span>
              <b>{hud.armor}</b>
              <i style={{ transform: `scaleX(${hud.armor / 100})` }} />
            </div>
          </div>
          <div className="fs-ammo" data-testid="fs-ammo">
            <small className="mono">{hud.weapon}</small>
            <b>{hud.reloading ? '...' : hud.ammo}</b>
            <span className="mono">/ {hud.mag}</span>
            <div className="fs-slots mono">
              {WEAPON_ORDER.map((id, i) => (
                <i key={id} className={id === hud.weaponId ? 'on' : ''}>
                  {i + 1}
                </i>
              ))}
            </div>
          </div>
          {showPerf && (
            <div className="fs-perf mono" data-testid="fs-perf" aria-label="Desempenho">
              <b>{hud.fps} FPS</b>
              <span>
                {Math.round(hud.tris / 1000)} mil triângulos · {hud.calls} desenhos
              </span>
              <span>
                qualidade {hud.level === 'high' ? 'alta' : hud.level === 'mid' ? 'média' : 'baixa'}{' '}
                · resolução {hud.dpr}x
              </span>
              {hud.ref && <span>modelos de referência: {hud.ref}</span>}
            </div>
          )}
          <div className="fs-top">
            <Link to="/fox-cap" className="fs-back" data-sfx="back">
              Voltar
            </Link>
            <button type="button" className="fs-tool" onClick={() => setShowPerf((v) => !v)}>
              Desempenho
            </button>
          </div>
          {!hud.locked && !touch && (
            <div className="fs-pause" data-testid="fs-pause">
              <div className="fs-card">
                <h2>Fox Shot! (teste)</h2>
                <p className="mono">Clique para jogar. Esc solta o mouse.</p>
                <ul className="mono">
                  <li>WASD: andar · Espaço: pular</li>
                  <li>Mouse: mirar · botão esquerdo: atirar · direito: mira</li>
                  <li>R: recarregar · 1, 2, 3 ou roda: trocar de arma</li>
                  <li>Alvos: sem colete, colete, colete e capacete</li>
                </ul>
                <button type="button" className="btn" onClick={() => ctl.current?.requestLock()}>
                  Jogar
                </button>
              </div>
            </div>
          )}
          {touch && (
            <>
              <div className="fs-stick" ref={stickEl} aria-hidden="true">
                <i />
              </div>
              <div className="fs-tbtns">
                <button
                  type="button"
                  className="fs-tb fire"
                  onPointerDown={() => press('fire', true)}
                  onPointerUp={() => press('fire', false)}
                  onPointerCancel={() => press('fire', false)}
                  aria-label="Atirar"
                >
                  ATIRAR
                </button>
                <button
                  type="button"
                  className="fs-tb ads"
                  onPointerDown={() => press('ads', true)}
                  onPointerUp={() => press('ads', false)}
                  onPointerCancel={() => press('ads', false)}
                  aria-label="Mirar"
                >
                  MIRAR
                </button>
                <button
                  type="button"
                  className="fs-tb"
                  onPointerDown={() => press('jump', true)}
                  aria-label="Pular"
                >
                  PULAR
                </button>
                <button
                  type="button"
                  className="fs-tb"
                  onPointerDown={() => press('reload', true)}
                  aria-label="Recarregar"
                >
                  RECARGA
                </button>
                <button
                  type="button"
                  className="fs-tb"
                  onPointerDown={() => press('cycle', true)}
                  aria-label="Trocar de arma"
                >
                  TROCAR
                </button>
              </div>
            </>
          )}
        </>
      )}
      {portrait && (
        <div className="fs-rotate" role="alert" data-testid="fs-rotate">
          <div className="fs-card">
            <h2>Gire o aparelho</h2>
            <p className="mono">O Fox Shot! só joga com o celular deitado.</p>
            <Link to="/fox-cap" className="btn ghost">
              Voltar
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
