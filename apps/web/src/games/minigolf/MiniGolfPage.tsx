import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  GOLF_DT,
  GOLF_LEVELS,
  GOLF_SCORE_LABEL,
  GOLF_TIERS,
  GOLF_TIER_LABEL,
  GOLF_STROKE_LIMIT,
  GolfLevel,
  golfCountedStrokes,
  golfHit,
  golfNewBall,
  golfNextLevel,
  golfParOf,
  golfTierOf,
  golfScoreName,
  golfStep,
  type GolfBall,
  type GolfLevelData,
  type GolfScoreName,
  type GolfTier,
} from '@nocap/games';
import { golfSfx } from '@/lib/minigolf-audio';
import { useTouchGuard } from '../foxgp/touch-guard';
import { GolfScene } from './GolfScene';
import { loadBall, loadBest, saveBest } from './golf-save';
import './minigolf.css';

// as fases convertidas moram no pacote de jogos; cada uma baixa só quando é jogada
const LOADERS = import.meta.glob('../../../../../packages/games/src/minigolf/levels/*.json');
async function loadLevel(n: number): Promise<GolfLevel> {
  const key = Object.keys(LOADERS).find((k) => k.endsWith(`/level-${n}.json`));
  if (!key) throw new Error(`fase ${n} não existe`);
  const mod = (await LOADERS[key]!()) as { default: GolfLevelData };
  return new GolfLevel(mod.default);
}

const clampLevel = (n: number | undefined) => Math.max(1, Math.min(GOLF_LEVELS, Math.trunc(n ?? 1) || 1));
const nameClass = (n: GolfScoreName) => (n === 'ace' ? 'mg-ace' : n === 'albatross' || n === 'eagle' ? 'mg-eagle' : n === 'birdie' ? 'mg-ok' : n === 'par' ? '' : 'mg-bad');
const SUBTITLE: Record<GolfScoreName, string> = {
  ace: 'Direto no buraco!',
  albatross: '3 abaixo do par',
  eagle: '2 abaixo do par',
  birdie: '1 abaixo do par',
  par: 'No par',
  bogey: '1 acima do par',
  double: '2 acima do par',
  triple: 'Muitas tacadas',
  fail: 'Passou do limite de tacadas',
};

type Phase = 'aim' | 'roll' | 'sink' | 'result';
interface Result {
  name: GolfScoreName;
  strokes: number;
  holed: boolean;
  best: number | null;
  record: boolean;
}

const Chevron = ({ dir }: { dir: 'l' | 'r' }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'l' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
);

/** Mini Golf offline (spec 082): 30 fases abertas, em três dificuldades; cai no buraco e escolhe próxima, repetir, escolher fase ou menu. */
export function MiniGolfPage() {
  useTouchGuard();
  const navigate = useNavigate();
  const wanted = useSearch({ strict: false }) as { fase?: number };
  const [fase, setFase] = useState(clampLevel(wanted.fase));
  const [round, setRound] = useState(0);
  const [picking, setPicking] = useState(false);
  const [tier, setTier] = useState<GolfTier>(golfTierOf(clampLevel(wanted.fase)));
  const [loading, setLoading] = useState(true);
  const [strokes, setStrokes] = useState(0);
  const [phase, setPhase] = useState<Phase>('aim');
  const [power, setPower] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [bests, setBests] = useState(loadBest());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const keys = useRef({ l: false, r: false });
  const api = useRef<{ rotate: (d: number) => void }>({ rotate: () => {} });

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

    void loadLevel(fase).then((level) => {
      if (!alive || !canvasRef.current || !boxRef.current) return;
      const box = boxRef.current;
      scene = new GolfScene(canvasRef.current, level, loadBall());
      const sc = scene;
      const ball: GolfBall = golfNewBall(level.data);
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

      const onDown = (e: PointerEvent) => {
        if (e.button === 2 || e.pointerType === 'mouse' && e.button !== 0) {
          st.right = true;
          st.drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
          return;
        }
        if (st.phase !== 'aim' || st.drag) return;
        st.drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
        (e.target as Element).setPointerCapture?.(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (!st.drag || e.pointerId !== st.drag.id) return;
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
      const noMenu = (e: Event) => e.preventDefault();
      const cv = canvasRef.current;
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
      cv.addEventListener('pointercancel', onUp);
      cv.addEventListener('contextmenu', noMenu);
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      api.current.rotate = (d) => (sc.yaw += d);

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
    setPicking(false);
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
        <button type="button" className="mg-pill ghost" onClick={() => { setTier(golfTierOf(fase)); setPicking(true); }} data-testid="mg-levels">Fases</button>
        <button type="button" className="mg-pill ghost" onClick={() => void navigate({ to: '/' })} data-testid="mg-menu">Menu</button>
      </div>

      {phase === 'aim' && power === null && !loading && (
        <div className="mg-hint">Arraste para trás e solte para tacar · A e D giram a câmera</div>
      )}
      {power !== null && (
        <div className="mg-power" aria-hidden="true">
          <div className="mg-kick" style={{ textAlign: 'center' }}>Força {Math.round(power * 100)}%</div>
          <div className="bar"><i style={{ transform: `scaleX(${power})` }} /></div>
        </div>
      )}
      <div className="mg-rot l"><button type="button" aria-label="Girar a câmera para a esquerda" onPointerDown={() => api.current.rotate(-0.35)}><Chevron dir="l" /></button></div>
      <div className="mg-rot r"><button type="button" aria-label="Girar a câmera para a direita" onPointerDown={() => api.current.rotate(0.35)}><Chevron dir="r" /></button></div>

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
            <button type="button" className="mg-pill" onClick={() => { setTier(golfTierOf(fase)); setPicking(true); }}>Escolher fase</button>
            <button type="button" className="mg-pill ghost" onClick={() => void navigate({ to: '/' })}>Menu</button>
          </div>
        </div>
      )}

      {picking && (
        <div className="mg-pick" data-testid="mg-pick">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 880, margin: '0 auto' }}>
            <div style={{ flex: 1 }}>
              <div className="mg-kick">Offline</div>
              <h2 className="mg-disp" style={{ fontSize: 44 }}>{GOLF_LEVELS} fases</h2>
            </div>
            <button type="button" className="mg-pill" onClick={() => setPicking(false)}>Fechar</button>
          </div>
          <div className="mg-tabs" role="tablist" aria-label="Dificuldade">
            {(Object.keys(GOLF_TIERS) as GolfTier[]).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tier === t} className={`mg-tab${tier === t ? ' on' : ''}`} onClick={() => setTier(t)} data-testid={`mg-tier-${t}`}>
                {GOLF_TIER_LABEL[t]}
                <small>{GOLF_TIERS[t].filter((n) => bests[n]).length}/{GOLF_TIERS[t].length}</small>
              </button>
            ))}
          </div>
          <div className="mg-pick-grid">
            {GOLF_TIERS[tier].map((n) => (
              <button key={n} type="button" className={`mg-lv${n === fase ? ' on' : ''}${bests[n] ? ' done' : ''}`} onClick={() => go(n)}>
                <b>{n}</b>
                <span>Par {golfParOf(n)}</span>
                <span>{bests[n] ? `Melhor ${bests[n]}` : 'Nova'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
