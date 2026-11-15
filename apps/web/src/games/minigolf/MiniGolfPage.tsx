import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  GOLF_DT,
  GOLF_LEVELS,
  GOLF_SCORE_LABEL,
  GOLF_TIERS,
  GOLF_TIER_LABEL,
  GOLF_STROKE_LIMIT,
  golfCountedStrokes,
  golfHit,
  golfNewBall,
  golfNextLevel,
  golfParOf,
  golfTierOf,
  golfScoreName,
  golfStep,
  type GolfBall,
  type GolfScoreName,
  type GolfTier,
} from '@nocap/games';
import { golfSfx } from '@/lib/minigolf-audio';
import { useTouchGuard } from '../foxgp/touch-guard';
import { GolfScene } from './GolfScene';
import { loadLevel } from './level-loader';
import { loadBest, loadLook, saveBest, setProgress } from './golf-save';
import './minigolf.css';

/** No PC a câmera gira com o botão direito do mouse; no celular, pelas setas da tela. */
const HINT =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches
    ? 'Puxe a bola para tacar · Arraste em outro lugar para girar a câmera · Botão direito cancela'
    : 'Puxe a bola para tacar · Arraste a tela para girar a câmera · Outro dedo cancela';

const clampLevel = (n: number | undefined) => Math.max(1, Math.min(GOLF_LEVELS, Math.trunc(n ?? 1) || 1));
const nameClass = (n: GolfScoreName) => (n === 'ace' ? 'mg-ace' : n === 'albatross' || n === 'eagle' ? 'mg-eagle' : n === 'birdie' ? 'mg-ok' : n === 'par' ? '' : 'mg-calm');
const SUBTITLE: Record<GolfScoreName, string> = {
  ace: 'Direto no buraco!',
  albatross: '3 abaixo do par',
  eagle: '2 abaixo do par',
  birdie: '1 abaixo do par',
  par: 'No par',
  bogey: '1 acima do par',
  double: '2 acima do par',
  triple: '3 ou mais acima do par',
  fail: 'Acabaram as tacadas deste buraco',
};

type Phase = 'aim' | 'roll' | 'sink' | 'result';
interface Result {
  name: GolfScoreName;
  strokes: number;
  holed: boolean;
  best: number | null;
  record: boolean;
}


/** Mini Golf offline (spec 082): 20 fases abertas, em três dificuldades; cai no buraco e escolhe próxima, repetir, escolher fase ou menu. */
export function MiniGolfPage() {
  useTouchGuard();
  const navigate = useNavigate();
  const wanted = useSearch({ strict: false }) as { fase?: number };
  const [fase, setFase] = useState(clampLevel(wanted.fase));
  const [round, setRound] = useState(0);
  const [loading, setLoading] = useState(true);
  const [strokes, setStrokes] = useState(0);
  const [phase, setPhase] = useState<Phase>('aim');
  const [power, setPower] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [bests, setBests] = useState(loadBest());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const keys = useRef({ l: false, r: false });

  useEffect(() => {
    let alive = true;
    let raf = 0;
    let scene: GolfScene | null = null;
    let ro: ResizeObserver | null = null;
    setLoading(true);
    setResult(null);
    setStrokes(0);
    setPhase('aim');
    setPower(null);

    setProgress(fase);
    void loadLevel(fase).then((level) => {
      if (!alive || !canvasRef.current || !boxRef.current) return;
      const box = boxRef.current;
      scene = new GolfScene(canvasRef.current, level, loadLook());
      const sc = scene;
      if (import.meta.env.DEV) (window as unknown as { __mgScene?: unknown; __mgBall?: unknown }).__mgScene = sc;
      const ball: GolfBall = golfNewBall(level.data);
      if (import.meta.env.DEV) (window as unknown as { __mgBall?: unknown }).__mgBall = ball;
      const st = {
        phase: 'aim' as Phase,
        strokes: 0,
        t: 0,
        acc: 0,
        start: [...ball.pos] as [number, number, number],
        stoppedFor: 0,
        inWaterFor: 0,
        lastRim: false,
        lastBounce: 0,
        drag: null as null | { x: number; y: number; id: number },
        aim: null as null | { dir: [number, number]; power: number },
        right: false,
      };
      const fit = () => {
        const r = box.getBoundingClientRect();
        sc.resize(r.width, r.height);
      };
      ro = new ResizeObserver(fit);
      ro.observe(box);
      fit();
      setLoading(false);

      const finish = (holed: boolean) => {
        st.phase = 'result';
        setPhase('result');
        setProgress(null);
        const name = golfScoreName(st.strokes, golfParOf(fase), holed);
        const counted = golfCountedStrokes(st.strokes, holed);
        const prev = loadBest()[fase] ?? null;
        const record = holed && (prev === null || counted < prev);
        if (record) setBests(saveBest(fase, counted));
        golfSfx.score(name);
        setResult({ name, strokes: st.strokes, holed, best: record ? counted : prev, record });
      };

      // gancho só de desenvolvimento (some do build): mostra o resultado sem precisar jogar até o buraco
      if (import.meta.env.DEV) (window as unknown as { __mgFinish?: (h: boolean, n: number) => void }).__mgFinish = (h, n) => { st.strokes = n; setStrokes(n); finish(h); };

      const toAim = () => {
        st.phase = 'aim';
        setPhase('aim');
        st.start = [...ball.pos] as [number, number, number];
        ball.vel = [0, 0, 0];
        ball.inWater = false;
      };

      // botão direito no meio da puxada cancela a tacada (sem bater e sem girar a câmera)
      const cancelAim = () => {
        if (!st.drag || st.right) return false;
        st.drag = null;
        st.aim = null;
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
          // segundo dedo com a câmera girando (não com uma puxada): vira pinça
          if (touches.size === 2 && st.drag && st.right) {
            st.drag = null;
            st.right = false;
            pinch = touchDist();
            return;
          }
          if (touches.size === 2 && !st.drag) {
            pinch = touchDist();
            return;
          }
        }
        // um segundo toque (ou clique) com a puxada em andamento cancela a tacada
        if (st.drag) {
          if (e.pointerId !== st.drag.id) cancelAim();
          return;
        }
        const r = canvasRef.current!.getBoundingClientRect();
        const onBall = st.phase === 'aim' && sc.ballHit(ball.pos, e.clientX - r.left, e.clientY - r.top);
        st.right = !onBall;
        st.drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
        (e.target as Element).setPointerCapture?.(e.pointerId);
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
        if (!st.drag || e.pointerId !== st.drag.id) return;
        if (e.buttons & 2 && cancelAim()) return;
        const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y;
        if (st.right) {
          sc.yaw -= dx * 0.006;
          st.drag.x = e.clientX;
          return;
        }
        // puxa para trás: arrastar para baixo manda para frente; força pelo tamanho do arrasto
        const r = box.getBoundingClientRect();
        const len = Math.hypot(dx, dy);
        const p = Math.min(1, len / (Math.min(r.width, r.height) * 0.4));
        if (len < 6) {
          st.aim = null;
          setPower(null);
          return;
        }
        const fx = Math.sin(sc.yaw), fz = Math.cos(sc.yaw);
        const rx = -Math.cos(sc.yaw), rz = Math.sin(sc.yaw);
        const wx = rx * -dx + fx * dy, wz = rz * -dx + fz * dy;
        const l = Math.hypot(wx, wz) || 1;
        st.aim = { dir: [wx / l, wz / l], power: p };
        setPower(p);
      };
      const onUp = (e: PointerEvent) => {
        touches.delete(e.pointerId);
        if (touches.size < 2) pinch = null;
        if (!st.drag || e.pointerId !== st.drag.id) return;
        const wasRight = st.right;
        st.drag = null;
        st.right = false;
        if (wasRight) return;
        const aim = st.aim;
        st.aim = null;
        setPower(null);
        if (!aim || aim.power < 0.07 || st.phase !== 'aim') return;
        golfHit(ball, aim.dir, aim.power);
        golfSfx.hit(aim.power);
        st.strokes++;
        setStrokes(st.strokes);
        st.stoppedFor = 0;
        st.phase = 'roll';
        setPhase('roll');
      };
      const onKey = (e: KeyboardEvent, down: boolean) => {
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.current.l = down;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.current.r = down;
      };
      const kd = (e: KeyboardEvent) => onKey(e, true);
      const ku = (e: KeyboardEvent) => onKey(e, false);
      const noMenu = (e: Event) => {
        e.preventDefault();
        cancelAim();
      };
      const cv = canvasRef.current;
      cv.addEventListener('wheel', onWheel, { passive: false });
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
      cv.addEventListener('pointercancel', onUp);
      cv.addEventListener('contextmenu', noMenu);
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);

      let last = performance.now();
      const loop = (now: number) => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (keys.current.l) sc.yaw -= dt * 1.8;
        if (keys.current.r) sc.yaw += dt * 1.8;
        st.acc += dt;
        while (st.acc >= GOLF_DT) {
          st.acc -= GOLF_DT;
          st.t += GOLF_DT;
          if (st.phase === 'result') continue;
          if (st.phase === 'aim' && !ball.moving) {
            // parada: a gravidade assenta a bola, sem andar
            golfStep(level, ball, st.t);
            if (ball.moving) st.phase = 'roll';
            continue;
          }
          golfStep(level, ball, st.t);
          // sons: quique, aro e a queda no copo
          if (ball.impact > 1 && st.t - st.lastBounce > 0.08) {
            st.lastBounce = st.t;
            if (ball.inHole) golfSfx.plop();
            else golfSfx.bounce(ball.impact);
          }
          if (ball.rim && !st.lastRim) golfSfx.rim();
          st.lastRim = ball.rim;
          if (ball.inHole && st.phase === 'roll') {
            st.phase = 'sink';
            sc.focusHole = true;
            golfSfx.drop();
          }
          if (ball.holed) {
            finish(true);
            continue;
          }
          if (ball.inWater) {
            st.inWaterFor += GOLF_DT;
            if (st.inWaterFor > 0.1 && st.inWaterFor < 0.12) golfSfx.splash();
          } else st.inWaterFor = 0;
          if (ball.outOfBounds || st.inWaterFor > 2.5) {
            // fora do campo ou preso na água: volta para onde deu a tacada
            ball.pos = [...st.start];
            ball.outOfBounds = false;
            st.inWaterFor = 0;
            golfSfx.splash();
            toAim();
            continue;
          }
          if (st.phase === 'roll' && !ball.moving) {
            st.stoppedFor += GOLF_DT;
            if (st.stoppedFor > 0.15) {
              if (st.strokes >= GOLF_STROKE_LIMIT) finish(false);
              else toAim();
            }
          }
        }
        sc.setAim(ball, st.phase === 'aim' ? st.aim : null);
        sc.render(ball, st.t, dt);
      };
      raf = requestAnimationFrame(loop);
      // limpeza guardada para o retorno do efeito
      (loop as unknown as { off: () => void }).off = () => {
        cv.removeEventListener('wheel', onWheel);
        cv.removeEventListener('pointerdown', onDown);
        cv.removeEventListener('pointermove', onMove);
        cv.removeEventListener('pointerup', onUp);
        cv.removeEventListener('pointercancel', onUp);
        cv.removeEventListener('contextmenu', noMenu);
        window.removeEventListener('keydown', kd);
        window.removeEventListener('keyup', ku);
      };
      cleanups.push((loop as unknown as { off: () => void }).off);
    });

    const cleanups: (() => void)[] = [];
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      cleanups.forEach((f) => f());
      ro?.disconnect();
      scene?.dispose();
    };
  }, [fase, round]);

  const par = golfParOf(fase);
  const go = (n: number) => {
    setFase(clampLevel(n));
    setRound((r) => r + 1);
  };

  return (
    <div className="mg" ref={boxRef} data-testid="minigolf">
      <canvas ref={canvasRef} />
      {loading && <div className="mg-load">Carregando a fase</div>}
      <div className="mg-top">
        <div className="mg-hud" style={{ position: 'static', display: 'flex', gap: 14 }}>
          <div>
            <div className="mg-kick">Fase</div>
            <div className="n">{fase}<small>/{GOLF_LEVELS}</small></div>
          </div>
          <div>
            <div className="mg-kick">Par</div>
            <div className="n">{par}</div>
          </div>
        </div>
        <div className="sp" />
        <div className="mg-hud" style={{ position: 'static', textAlign: 'center' }} data-testid="mg-strokes">
          <div className="mg-kick">Tacadas</div>
          <div className="n">{strokes}<small>/{GOLF_STROKE_LIMIT}</small></div>
        </div>
        <button type="button" className="mg-pill ghost" onClick={() => void navigate({ to: '/minigolf/fases' })} data-testid="mg-levels">Fases</button>
        <button type="button" className="mg-pill ghost" onClick={() => void navigate({ to: '/minigolf' })} data-testid="mg-menu">Menu</button>
      </div>

      {phase === 'aim' && power === null && !loading && (
        <div className="mg-hint">{HINT}</div>
      )}
      {power !== null && (
        <div className="mg-power" aria-hidden="true">
          <div className="mg-kick" style={{ textAlign: 'center' }}>Força {Math.round(power * 100)}%</div>
          <div className="bar"><i style={{ transform: `scaleX(${power})` }} /></div>
        </div>
      )}

      {result && (
        <div className="mg-score" data-testid="mg-result">
          <div style={{ display: 'flex', gap: 10 }}>
            <span className="mg-tag">Fase {fase} · {GOLF_TIER_LABEL[golfTierOf(fase)]} · Par {par}</span>
            <span className="mg-tag">{result.holed ? `${result.strokes} ${result.strokes === 1 ? 'tacada' : 'tacadas'}` : `Conta ${golfCountedStrokes(result.strokes, false)}`}</span>
            {result.record && <span className="mg-tag mg-ace">Novo recorde</span>}
          </div>
          <h1 className={`mg-disp ${nameClass(result.name)}`}>{GOLF_SCORE_LABEL[result.name]}</h1>
          <div className="sub">{SUBTITLE[result.name]}</div>
          <div className="row">
            {golfNextLevel(fase) !== null && <button type="button" className="mg-pill pri" onClick={() => go(golfNextLevel(fase)!)} data-testid="mg-next">Próxima fase</button>}
            <button type="button" className="mg-pill" onClick={() => go(fase)} data-testid="mg-retry">Repetir</button>
            <button type="button" className="mg-pill" onClick={() => void navigate({ to: '/minigolf/fases' })}>Escolher fase</button>
            <button type="button" className="mg-pill ghost" onClick={() => void navigate({ to: '/minigolf' })}>Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
