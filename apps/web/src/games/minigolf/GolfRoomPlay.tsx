import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  GOLF_BALL_DEFAULT,
  GOLF_DT,
  GOLF_SCORE_LABEL,
  GOLF_STROKE_LIMIT,
  GOLF_TIER_LABEL,
  golfHit,
  golfNewBall,
  golfParOf,
  golfScoreName,
  golfStep,
  golfTierOf,
  parseGolfBall,
  type GolfBall,
  type GolfBallLook,
  type GolfScoreName,
} from '@nocap/games';
import { at, leaveRoom, sendRoom, sendRoomQuiet, serverNow, subscribeRoom, useMeId, type RoomSnapshot } from '@/lib/rooms';
import { golfSfx } from '@/lib/minigolf-audio';
import { useTouchGuard } from '../foxgp/touch-guard';
import { GolfScene } from './GolfScene';
import { loadLevel } from './level-loader';
import './minigolf.css';

type V3 = [number, number, number];
interface Sample {
  at: number;
  pos: V3;
  vel: V3;
  st: number;
}
/** Os quadros chegam a ~31 por segundo; desenhamos um pouco no passado para mover sem trancos. */
const DELAY_MS = 90;
/** Teto da previsão da minha tacada (ela termina quando a bola para). */
const PRED_MAX_MS = 9000;
/** Só depois disto um quadro do servidor dizendo "parada" vale mais que a previsão (antes ele pode ser de antes da tacada). */
const PRED_TRUST_MS = 1200;
/** No PC a câmera gira com o botão direito do mouse; no celular, pelas setas da tela. */
const HINT =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches
    ? 'Puxe a bola para tacar · Arraste em outro lugar para girar a câmera · Botão direito cancela · TAB mostra o placar'
    : 'Puxe a bola para tacar · Arraste a tela para girar a câmera · Outro dedo cancela · Placar mostra a tabela';
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const nameOf = (id: string, username: string) => (id.startsWith('guest:') ? username : at(username));
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const nameClass = (n: GolfScoreName) => (n === 'ace' ? 'mg-ace' : n === 'albatross' || n === 'eagle' ? 'mg-eagle' : n === 'birdie' ? 'mg-ok' : n === 'par' ? '' : 'mg-calm');


/**
 * O Mini Golf em sala (spec 082). O servidor simula todas as bolas; aqui desenhamos: as bolas dos quadros do servidor
 * (interpoladas), a minha tacada prevista na hora pela mesma física (para não esperar a rede) e o placar.
 */
export function GolfRoomPlay({ snapshot }: { snapshot: RoomSnapshot }) {
  useTouchGuard();
  const navigate = useNavigate();
  const me = useMeId() ?? '';
  const info = snapshot.golf!;
  const infoRef = useRef(info);
  infoRef.current = info;
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const namesRef = useRef<HTMLDivElement>(null);
  const keys = useRef({ l: false, r: false });
  const [power, setPower] = useState<number | null>(null);
  const [board, setBoard] = useState(false);
  const [held, setHeld] = useState(false);
  const [, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  // a cena "ACERTOU" da minha bola (alguns segundos) e quem estou assistindo depois dela
  const [cele, setCele] = useState<{ kind: 'holed' | 'failed'; name: GolfScoreName | null; strokes: number } | null>(null);
  const [watch, setWatch] = useState<string | null>(null);
  const watchRef = useRef<string | null>(null);
  const celeRef = useRef(false);
  celeRef.current = cele !== null;

  useEffect(() => {
    const i = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(i);
  }, []);

  // TAB mostra o placar enquanto estiver apertado
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setHeld(true);
      }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.current.l = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.current.r = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Tab') setHeld(false);
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.current.l = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.current.r = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // o resultado do buraco: soa uma vez quando a pausa começa
  const lastStage = useRef<string | null>(null);
  useEffect(() => {
    if (info.stage === 'cleared' && lastStage.current !== 'cleared') {
      const n = info.names[me];
      // quem encaçapou já ouviu o resultado na cena "Acertou"
      if (n && info.status[me] !== 2) golfSfx.score(n);
    }
    lastStage.current = info.stage;
  }, [info.stage, info.names, me]);

  // minha bola entrou (ou acabaram as tacadas): cena de resultado e depois vira espectador. Só dispara na virada de estado
  // durante o jogo, não ao abrir a tela já com a bola no buraco.
  const prevMine = useRef<{ hole: number; st: number } | null>(null);
  useEffect(() => {
    const st = info.status[me] ?? 0;
    const prev = prevMine.current;
    prevMine.current = { hole: info.hole, st };
    if (info.stage !== 'play') {
      setCele(null);
      return;
    }
    if (!prev || prev.hole !== info.hole) {
      setCele(null);
      return;
    }
    if (prev.st < 2 && st >= 2) {
      const strokes = info.strokes[me] ?? 0;
      const name = st === 2 && info.par ? golfScoreName(strokes, info.par, true) : null;
      if (name) golfSfx.score(name);
      setCele({ kind: st === 2 ? 'holed' : 'failed', name, strokes });
      const t = window.setTimeout(() => setCele(null), 3000);
      return () => window.clearTimeout(t);
    }
  }, [info.status, info.stage, info.hole, info.strokes, info.par, me]);

  const level = info.level;
  const hole = info.hole;
  useEffect(() => {
    if (level === null) return;
    let alive = true;
    let raf = 0;
    let scene: GolfScene | null = null;
    let ro: ResizeObserver | null = null;
    const offs: (() => void)[] = [];
    setLoading(true);
    setPower(null);

    void loadLevel(level).then((lv) => {
      if (!alive || !canvasRef.current || !boxRef.current) return;
      const box = boxRef.current;
      const cv = canvasRef.current;
      const mine = infoRef.current.looks[me];
      scene = new GolfScene(cv, lv, mine ? parseGolfBall(mine) : GOLF_BALL_DEFAULT);
      scene.useOnline();
      const sc = scene;
      const fit = () => {
        const r = box.getBoundingClientRect();
        sc.resize(r.width, r.height);
      };
      ro = new ResizeObserver(fit);
      ro.observe(box);
      fit();
      setLoading(false);

      const samples = new Map<number, Sample[]>();
      let holeClock: { t: number; at: number } | null = null;
      let pred: { ball: GolfBall; until: number; t: number; acc: number } | null = null;
      let blend: { from: V3; start: number } | null = null;
      let lastShot = 0;
      const start = lv.data.ballStart;
      const startPos: V3 = [start[0], start[1] + 0.12, start[2]];

      offs.push(
        subscribeRoom('gb', (m) => {
          const f = m as { t: number; balls: number[][] };
          const now = performance.now();
          holeClock = { t: f.t, at: now };
          for (const b of f.balls) {
            const arr = samples.get(b[0]!) ?? [];
            arr.push({ at: now, pos: [b[1]!, b[2]!, b[3]!], vel: [b[4]!, b[5]!, b[6]!], st: b[7]! });
            if (arr.length > 8) arr.shift();
            samples.set(b[0]!, arr);
          }
        }),
      );
      offs.push(
        subscribeRoom('ge', (m) => {
          const slots = infoRef.current.slots;
          const mySlot = slots[me];
          for (const e of m as { type: string; slot: number; v?: number }[]) {
            const own = e.slot === mySlot;
            const v = e.v ?? 0;
            if (e.type === 'clack') golfSfx.bounce(Math.min(8, v * 3));
            else if (own) {
              if (e.type === 'bounce') golfSfx.bounce(v);
              else if (e.type === 'rim') golfSfx.rim();
              else if (e.type === 'drop') golfSfx.drop();
              else if (e.type === 'plop') golfSfx.plop();
              else if (e.type === 'splash' || e.type === 'reset') golfSfx.splash();
            } else if (e.type === 'hit') golfSfx.hit(v * 0.4);
            else if (e.type === 'plop') golfSfx.plop();
          }
        }),
      );

      const sampleAt = (slot: number, t: number): Sample | null => {
        const arr = samples.get(slot);
        if (!arr || arr.length === 0) return null;
        const last = arr[arr.length - 1]!;
        if (t >= last.at) {
          const dt = Math.min(0.1, (t - last.at) / 1000);
          return { ...last, pos: [last.pos[0] + last.vel[0] * dt, last.pos[1], last.pos[2] + last.vel[2] * dt] };
        }
        for (let i = arr.length - 1; i > 0; i--) {
          const a = arr[i - 1]!, b = arr[i]!;
          if (t >= a.at) {
            const k = (t - a.at) / Math.max(1, b.at - a.at);
            return { at: t, st: b.st, vel: b.vel, pos: [a.pos[0] + (b.pos[0] - a.pos[0]) * k, a.pos[1] + (b.pos[1] - a.pos[1]) * k, a.pos[2] + (b.pos[2] - a.pos[2]) * k] };
          }
        }
        return arr[0]!;
      };

      // ---- mira (arrastar para trás e soltar) ----
      let drag: { x: number; y: number; id: number } | null = null;
      let right = false;
      let myPos: V3 = startPos;
      let aim: { dir: [number, number]; power: number } | null = null;
      // o estado da minha bola vem do quadro mais recente (chega ~31 vezes por segundo); o da sala só serve antes do primeiro quadro
      const myStatus = () => {
        const arr = samples.get(infoRef.current.slots[me] ?? -1);
        return arr && arr.length > 0 ? arr[arr.length - 1]!.st : (infoRef.current.status[me] ?? 0);
      };
      const canAim = () => infoRef.current.stage === 'play' && !pred && myStatus() === 0 && performance.now() - lastShot > 400;
      // botão direito no meio da puxada cancela a tacada (sem bater e sem girar a câmera)
      const cancelAim = () => {
        if (!drag || right) return false;
        drag = null;
        aim = null;
        setPower(null);
        return true;
      };
      // esquerdo em cima da bola puxa a tacada; esquerdo em qualquer outro lugar gira a câmera; direito só cancela a tacada
      // pinça com dois dedos (celular): aproxima e afasta a câmera
      const touches = new Map<number, { x: number; y: number }>();
      let pinch: number | null = null;
      const touchDist = () => {
        const [a, b] = [...touches.values()];
        return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        sc.zoomBy(Math.exp(e.deltaY * 0.0012));
      };
      const onDown = (e: PointerEvent) => {
        if (e.button === 2 || (e.pointerType === 'mouse' && e.button !== 0)) {
          cancelAim();
          return;
        }
        if (e.pointerType === 'touch') {
          touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (touches.size === 2 && drag && right) {
            drag = null;
            right = false;
            pinch = touchDist();
            return;
          }
          if (touches.size === 2 && !drag) {
            pinch = touchDist();
            return;
          }
        }
        // um segundo toque (ou clique) com a puxada em andamento cancela a tacada
        if (drag) {
          if (e.pointerId !== drag.id) cancelAim();
          return;
        }
        const r = cv.getBoundingClientRect();
        const onBall = canAim() && sc.ballHit(myPos, e.clientX - r.left, e.clientY - r.top);
        right = !onBall;
        drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
        cv.setPointerCapture?.(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
          touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pinch !== null && touches.size === 2) {
            const d = touchDist();
            if (d > 0 && pinch > 0) sc.zoomBy(pinch / d);
            pinch = d;
            return;
          }
        }
        if (!drag || e.pointerId !== drag.id) return;
        if (e.buttons & 2 && cancelAim()) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (right) {
          sc.yaw -= dx * 0.006;
          drag.x = e.clientX;
          return;
        }
        const r = box.getBoundingClientRect();
        const len = Math.hypot(dx, dy);
        const p = Math.min(1, len / (Math.min(r.width, r.height) * 0.4));
        if (len < 6) {
          aim = null;
          setPower(null);
          return;
        }
        const fx = Math.sin(sc.yaw), fz = Math.cos(sc.yaw), rx = -Math.cos(sc.yaw), rz = Math.sin(sc.yaw);
        const wx = rx * -dx + fx * dy, wz = rz * -dx + fz * dy;
        const l = Math.hypot(wx, wz) || 1;
        aim = { dir: [wx / l, wz / l], power: p };
        setPower(p);
      };
      const onUp = (e: PointerEvent) => {
        touches.delete(e.pointerId);
        if (touches.size < 2) pinch = null;
        if (!drag || e.pointerId !== drag.id) return;
        const wasRight = right;
        drag = null;
        right = false;
        if (wasRight) return;
        const a = aim;
        aim = null;
        setPower(null);
        if (!a || a.power < 0.07 || !canAim()) return;
        const arr = samples.get(infoRef.current.slots[me] ?? -1);
        const from = arr?.[arr.length - 1]?.pos ?? startPos;
        sendRoomQuiet('gshot', { x: a.dir[0], z: a.dir[1], p: a.power });
        golfSfx.hit(a.power);
        lastShot = performance.now();
        // prevê a minha tacada pela mesma física, até o servidor responder
        const ball = golfNewBall(lv.data);
        ball.pos = [...from];
        golfHit(ball, a.dir, a.power);
        pred = { ball, until: performance.now() + PRED_MAX_MS, t: holeClock ? holeClock.t + (performance.now() - holeClock.at) / 1000 : 0, acc: 0 };
        blend = null;
      };
      const noMenu = (e: Event) => {
        e.preventDefault();
        cancelAim();
      };
      cv.addEventListener('wheel', onWheel, { passive: false });
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
      cv.addEventListener('pointercancel', onUp);
      cv.addEventListener('contextmenu', noMenu);
      offs.push(() => {
        cv.removeEventListener('wheel', onWheel);
        cv.removeEventListener('pointerdown', onDown);
        cv.removeEventListener('pointermove', onMove);
        cv.removeEventListener('pointerup', onUp);
        cv.removeEventListener('pointercancel', onUp);
        cv.removeEventListener('contextmenu', noMenu);
      });

      const holePos = lv.data.holes[0]!.p;
      let last = performance.now();
      const labels = new Map<number, HTMLDivElement>();
      const loop = (nowMs: number) => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (nowMs - last) / 1000);
        last = nowMs;
        if (keys.current.l) sc.yaw -= dt * 1.8;
        if (keys.current.r) sc.yaw += dt * 1.8;
        const inf = infoRef.current;
        const holeT = holeClock ? holeClock.t + (nowMs - holeClock.at) / 1000 : 0;
        const balls: { slot: number; look: GolfBallLook; pos: V3; vel: V3; hidden?: boolean }[] = [];
        let focus: V3 = startPos;
        const mySlot = inf.slots[me];
        for (const [id, slot] of Object.entries(inf.slots)) {
          const sm = sampleAt(slot, nowMs - DELAY_MS);
          if (!sm) continue;
          let pos = sm.pos;
          let vel = sm.vel;
          if (slot === mySlot) {
            if (pred) {
              // avança a minha bola prevista em passos fixos
              pred.acc += dt;
              while (pred.acc >= GOLF_DT) {
                pred.acc -= GOLF_DT;
                pred.t += GOLF_DT;
                golfStep(lv, pred.ball, pred.t);
              }
              pos = pred.ball.pos;
              vel = pred.ball.vel;
              // a minha bola prevista vale até parar (o servidor chega ~RTT atrasado: trocar antes puxava a bola de volta);
              // se o servidor já diz que ela não rola (tacada recusada, buraco ou volta ao ponto), segue o servidor
              const srv = samples.get(mySlot ?? -1);
              const srvIdle = !!srv && srv.length > 0 && srv[srv.length - 1]!.st !== 1 && nowMs - lastShot > PRED_TRUST_MS;
              if (!pred.ball.moving || srvIdle || nowMs >= pred.until) {
                blend = { from: [...pred.ball.pos] as V3, start: nowMs };
                pred = null;
              }
            } else if (blend) {
              const k = Math.min(1, (nowMs - blend.start) / 160);
              pos = [blend.from[0] + (sm.pos[0] - blend.from[0]) * k, blend.from[1] + (sm.pos[1] - blend.from[1]) * k, blend.from[2] + (sm.pos[2] - blend.from[2]) * k];
              if (k >= 1) blend = null;
            }
            focus = pos;
            // câmera de perto no copo quando a minha bola cai nele
            sc.focusHole = Math.hypot(pos[0] - holePos[0], pos[2] - holePos[2]) < 0.45 && pos[1] < holePos[1] + 0.05;
          }
          balls.push({ slot, look: parseGolfBall(inf.looks[id]), pos, vel });
        }
        // espectador: depois da cena do resultado, a câmera acompanha quem ainda joga
        const spec = watchRef.current ? inf.slots[watchRef.current] : undefined;
        if ((inf.status[me] ?? 0) >= 2 && !celeRef.current && spec !== undefined) {
          const wb = balls.find((b) => b.slot === spec);
          if (wb) {
            focus = wb.pos;
            sc.focusHole = false;
          }
        }
        myPos = focus;
        sc.setAim({ pos: focus } as GolfBall, canAim() ? aim : null);
        sc.readyHint = canAim();
        sc.renderOnline(balls, focus, holeT, dt);
        // o nome de cada pessoa em cima da bola (também para quem está assistindo)
        const box = namesRef.current;
        if (box) {
          const slotUser = new Map(Object.entries(inf.slots).map(([uid, sl]) => [sl, uid]));
          const seenSlots = new Set<number>();
          for (const b of balls) {
            const uid = slotUser.get(b.slot);
            const m = uid ? snapRef.current.members.find((x) => x.id === uid) : undefined;
            if (!m || b.hidden) continue;
            seenSlots.add(b.slot);
            let el = labels.get(b.slot);
            if (!el) {
              el = document.createElement('div');
              el.className = 'mg-name';
              el.textContent = nameOf(m.id, m.username);
              box.appendChild(el);
              labels.set(b.slot, el);
            }
            const p = sc.project([b.pos[0], b.pos[1] + 0.32, b.pos[2]]);
            el.style.opacity = p.ok ? '1' : '0';
            el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
            el.classList.toggle('me', m.id === me);
          }
          for (const [sl, el] of labels) {
            if (seenSlots.has(sl)) continue;
            el.remove();
            labels.delete(sl);
          }
        }
      };
      raf = requestAnimationFrame(loop);
    });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      offs.forEach((f) => f());
      ro?.disconnect();
      scene?.dispose();
    };
  }, [level, hole, me]);

  const left = info.stageEndsAt ? info.stageEndsAt - serverNow() : 0;
  const myStatus = info.status[me] ?? 0;
  const stage = info.stage;
  const lvTier = info.level ? GOLF_TIER_LABEL[golfTierOf(info.level)] : '';
  const members = snapshot.members;
  const showBoard = board || held;
  const ranked = [...members].sort((a, b) => (info.totals[a.id] ?? 0) - (info.totals[b.id] ?? 0));
  const last = info.results[info.results.length - 1];
  const myName = info.names[me] as GolfScoreName | undefined;
  const live = members.filter((m) => m.id !== me && (info.status[m.id] ?? 0) < 2);
  const watching = live.find((m) => m.id === watch) ?? live[0] ?? null;
  watchRef.current = watching?.id ?? null;
  const spectating = stage === 'play' && myStatus >= 2 && !cele;
  const cycle = (d: number) => {
    if (live.length < 2) return;
    const i = Math.max(0, live.findIndex((m) => m.id === watching?.id));
    setWatch(live[(i + d + live.length) % live.length]!.id);
  };
  const lastHole = hole + 1 >= info.levels.length;
  const closing = stage === 'cleared' && !lastHole && left < 900;
  const sheet = (
    <div className="mg-sheet" data-testid="golf-sheet">
      <table>
        <thead>
          <tr>
            <th className="mg-sheet-name">Buraco</th>
            {info.levels.map((lv, k) => (
              <th key={k} className={k === hole ? 'now' : ''}>{k + 1}</th>
            ))}
            <th className="mg-sheet-total">Total</th>
          </tr>
          <tr className="mg-sheet-par">
            <th className="mg-sheet-name">Par</th>
            {info.levels.map((lv, k) => (
              <th key={k} className={k === hole ? 'now' : ''}>{info.results[k]?.par ?? golfParOf(lv)}</th>
            ))}
            <th className="mg-sheet-total">{info.levels.reduce((n, lv, k) => n + (info.results[k]?.par ?? golfParOf(lv)), 0)}</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((m, i) => (
            <tr key={m.id} className={m.id === me ? 'me' : ''}>
              <td className="mg-sheet-name">
                <span className="mg-num">{i + 1}</span>
                <span className="mg-lobby-ball" style={{ background: hex(info.looks[m.id]?.color ?? 0xffc83d) }} aria-hidden="true" />
                <span className="mg-lobby-name">{nameOf(m.id, m.username)}</span>
              </td>
              {info.levels.map((lv, k) => {
                const r = info.results[k];
                const row = r?.rows[m.id];
                if (row) {
                  const n = golfScoreName(row.s, r!.par, row.h);
                  return <td key={k} className={`mg-cell ${nameClass(n)}`}>{row.h ? row.s : 'X'}</td>;
                }
                // o buraco em andamento mostra as tacadas de agora, apagadas, até fechar
                const live = k === hole && !r && info.stage === 'play' ? info.strokes[m.id] : 0;
                return <td key={k} className="mg-cell mg-mut">{live ? live : ''}</td>;
              })}
              <td className="mg-sheet-total">{info.totals[m.id] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const leave = () => void navigate({ to: '/minigolf' }).then(() => leaveRoom());

  return (
    <div className="mg" ref={boxRef} data-testid="golf-play">
      <canvas ref={canvasRef} />
      <div className="mg-names" ref={namesRef} aria-hidden="true" />
      {loading && <div className="mg-load">Carregando a fase</div>}
      <div className="mg-top">
        <div className="mg-hud" style={{ position: 'static', display: 'flex', gap: 14 }}>
          <div>
            <div className="mg-kick">Buraco</div>
            <div className="n">{hole + 1}<small>/{info.levels.length}</small></div>
          </div>
          <div>
            <div className="mg-kick">Par</div>
            <div className="n">{info.par ?? ''}</div>
          </div>
        </div>
        <div className="sp" />
        {stage === 'play' && (
          <div className="mg-hud" style={{ position: 'static', textAlign: 'center' }} data-testid="golf-time">
            <div className="mg-kick">Tempo</div>
            <div className="n">{clock(left)}</div>
          </div>
        )}
        <div className="mg-hud" style={{ position: 'static', textAlign: 'center' }} data-testid="golf-strokes">
          <div className="mg-kick">Tacadas</div>
          <div className="n">{info.strokes[me] ?? 0}<small>/{GOLF_STROKE_LIMIT}</small></div>
        </div>
        <button type="button" className="mg-pill ghost" onClick={() => setBoard((b) => !b)} data-testid="golf-board-btn">Placar</button>
      </div>

      <div className="mg-players" aria-label="Jogadores">
        {members.map((m) => {
          const st = info.status[m.id] ?? 0;
          return (
            <div key={m.id} className={`mg-pl${m.id === me ? ' me' : ''}`}>
              <span className="mg-lobby-ball" style={{ background: hex(info.looks[m.id]?.color ?? 0xffc83d) }} aria-hidden="true" />
              <span className="mg-pl-name">{nameOf(m.id, m.username)}</span>
              <span className={`mg-pl-st${st === 2 ? ' mg-ace' : st === 3 ? ' mg-calm' : ''}`}>{st === 2 ? 'No buraco' : st === 3 ? 'Fim das tacadas' : info.strokes[m.id] ?? 0}</span>
            </div>
          );
        })}
      </div>

      {stage === 'play' && power === null && myStatus === 0 && !loading && <div className="mg-hint">{HINT}</div>}
      {cele && (
        <div className="mg-score mg-cele" data-testid="golf-holed" role="status">
          <span className="mg-tag">{cele.kind === 'holed' ? `${cele.strokes} ${cele.strokes === 1 ? 'tacada' : 'tacadas'} · Par ${info.par ?? ''}` : 'Limite de tacadas'}</span>
          <h1 className={`mg-disp ${cele.kind === 'holed' ? (cele.name ? nameClass(cele.name) : 'mg-ok') : 'mg-calm'}`}>{cele.kind === 'holed' ? 'Acertou!' : 'Acabou!'}</h1>
          <div className="sub">{cele.kind === 'holed' ? (cele.name ? GOLF_SCORE_LABEL[cele.name] : '') : 'Sem tacadas neste buraco'}</div>
        </div>
      )}
      {spectating && (
        <div className="mg-spec" data-testid="golf-spectate">
          {watching ? (
            <>
              <button type="button" className="mg-pill ghost" onClick={() => cycle(-1)} disabled={live.length < 2} aria-label="Jogador anterior">‹</button>
              <div className="mg-spec-who">
                <span className="mg-kick">{myStatus === 2 ? 'No buraco! Assistindo' : 'Assistindo'}</span>
                <b>{nameOf(watching.id, watching.username)}</b>
              </div>
              <button type="button" className="mg-pill ghost" onClick={() => cycle(1)} disabled={live.length < 2} aria-label="Próximo jogador">›</button>
            </>
          ) : (
            <div className="mg-spec-who"><span className="mg-kick">Esperando o buraco fechar</span></div>
          )}
        </div>
      )}
      {power !== null && (
        <div className="mg-power" aria-hidden="true">
          <div className="mg-kick" style={{ textAlign: 'center' }}>Força {Math.round(power * 100)}%</div>
          <div className="bar"><i style={{ transform: `scaleX(${power})` }} /></div>
        </div>
      )}

      {stage === 'intro' && (
        <div className="mg-score" data-testid="golf-intro">
          <span className="mg-kick" style={{ fontSize: 18 }}>Partida de {info.levels.length} buracos</span>
          <h1 className="mg-disp" style={{ color: 'var(--mg-lime)' }}>Buraco {hole + 1}</h1>
          <div className="sub">{lvTier} · Par {info.par}</div>
          <div className="mg-disp mg-count">{Math.max(1, Math.ceil(left / 1000))}</div>
        </div>
      )}

      {stage === 'cleared' && last && (
        <div className="mg-score mg-cleared" data-testid="golf-cleared">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span className="mg-tag">Buraco {hole + 1} · Par {last.par}</span>
            {last.rows[me] && <span className="mg-tag">{last.rows[me]!.h ? `${last.rows[me]!.s} ${last.rows[me]!.s === 1 ? 'tacada' : 'tacadas'}` : `Conta ${last.rows[me]!.s}`}</span>}
          </div>
          {myName && <h1 className={`mg-disp ${nameClass(myName)}`}>{GOLF_SCORE_LABEL[myName]}</h1>}
          <div className="mg-cleared-sheet" data-testid="golf-cleared-sheet">{sheet}</div>
          <div className="sub">{lastHole ? 'Fim da partida: o ranking vem já' : 'Próximo buraco já já...'}</div>
        </div>
      )}
      {closing && <div className="mg-wipe in" aria-hidden="true" />}
      {stage === 'intro' && hole > 0 && <div key={hole} className="mg-wipe out" aria-hidden="true" />}

      {showBoard && (
        <div className="mg-board" data-testid="golf-board">
          <div className="mg-board-card">
            <div className="mg-board-head">
              <div className="mg-board-title">
                <div className="mg-kick">Placar · buraco {hole + 1} de {info.levels.length}</div>
                <h2 className="mg-disp">Quem manda no campo</h2>
              </div>
              <button type="button" className="mg-pill" onClick={() => setBoard(false)}>Fechar</button>
            </div>
            {sheet}
            <div className="mg-board-foot">
              <span className="mg-tag">Verde: abaixo do par · X: acabaram as tacadas</span>
              <span className="mg-board-gap" />
              {snapshot.hostId === me && <button type="button" className="mg-pill ghost" onClick={() => sendRoom('gend')} data-testid="golf-end">Encerrar partida</button>}
              <button type="button" className="mg-pill ghost" onClick={leave}>Sair da partida</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
