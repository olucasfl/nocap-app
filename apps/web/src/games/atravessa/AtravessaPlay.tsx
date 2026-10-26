import { useEffect, useRef, useState } from 'react';
import { GameMenu, GearButton, Keycap } from '@/components/GameMenu';
import { GameTips, type TipRow } from '@/components/GameTips';
import { Loader } from '@/components/Loader';
import { IcRestart } from '@/games/bola/BolaIcons';
import {
  ATR_DT,
  ATR_STEP_TICKS,
  AtravessaSim,
  atravessaMilestone,
  laneBiome,
  laneItems,
  trainState,
  type AtravessaEnd,
  type AtravessaInput,
  type AtravessaResult,
  type Dir,
} from '@nocap/games';
import { createAtravessaAudio } from '@/lib/atravessa-audio';
import { buzz, holdAudio } from '@/lib/sfx';
import { attachControls } from './input';
import { AtravessaScene } from './scene';
import './atravessa.css';

type Pause = { kind: 'none' } | { kind: 'paused' } | { kind: 'count'; n: number };

interface Props {
  seed: string;
  /** O recorde de quem joga (em linhas); 0 = ainda não tem. A faixa dourada aparece nessa linha. */
  record: number;
  onEnd: (result: AtravessaResult, steps: AtravessaInput[]) => void;
  onQuit: () => void;
  onRestart: () => void;
  /** Partida offline: "Convidar" leva para criar uma sala com amigos. */
  onOfflineInvite?: () => void;
}

const OVER_TEXT: Record<AtravessaEnd, string> = {
  veiculo: 'ATROPELADO',
  trem: 'O TREM PASSOU',
  agua: 'CAIU NA ÁGUA',
  arrastado: 'A TORA TE LEVOU',
  afundou: 'AFUNDOU',
  mordido: 'O CROCODILO MORDEU',
  atingido: 'FOI VARRIDO',
  parado: 'PAROU DEMAIS',
};

/** Depois de morrer, a tela espera um pouco para o fim da partida ser visto. */
const END_DELAY_MS = 1500;
const TOAST_MS = 1700;
const TIPS_KEY = 'nocap-atr-tips';

/** Os controles do Atravessa!: a primeira partida e o item "Controles" do menu mostram estes. */
export const atravessaTipRows = (touch: boolean): TipRow[] =>
  touch
    ? [
        { keys: <b className="gm-tag">Toque</b>, text: 'Toque na tela para pular para a frente' },
        { keys: <b className="gm-tag">Deslize</b>, text: 'Deslize para os lados para desviar' },
        {
          keys: <b className="gm-tag">Corra</b>,
          text: 'Parar demais derruba você: continue avançando',
        },
      ]
    : [
        {
          keys: (
            <>
              <Keycap k="W" touchHide={false} />
              <Keycap k="A" touchHide={false} />
              <Keycap k="S" touchHide={false} />
              <Keycap k="D" touchHide={false} />
            </>
          ),
          text: 'Pular para a frente, para os lados e para trás',
        },
        { keys: <b className="gm-tag">Setas</b>, text: 'Fazem o mesmo que W A S D' },
        { keys: <Keycap k="Esc" touchHide={false} />, text: 'Pausa e abre o menu (P também)' },
      ];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * A partida do Atravessa!: a cena Three.js em tela cheia, toque ou W A S D, pausa com 3-2-1 e o fim.
 * O relógio é de passo fixo (60 por segundo), o mesmo que o servidor usa para refazer a partida a
 * partir dos passos gravados aqui.
 */
export function AtravessaPlay({ seed, record, onEnd, onQuit, onRestart, onOfflineInvite }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pause, setPause] = useState<Pause>({ kind: 'none' });
  const [score, setScore] = useState(0);
  const [over, setOver] = useState<{ end: AtravessaEnd; score: number } | null>(null);
  const [hint, setHint] = useState(true);
  const [failed, setFailed] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: 'record' | 'marco'; n: number } | null>(
    null,
  );
  const ctl = useRef<{ pause: () => void; resume: () => void } | null>(null);
  // o recorde pode chegar do servidor depois da partida começar: ele não refaz a cena
  const recordRef = useRef(record);
  recordRef.current = record;
  const sceneRef = useRef<AtravessaScene | null>(null);
  // a cena (Three.js) leva um instante para desenhar o primeiro quadro: até lá aparece o Carregando, nunca uma tela preta
  const [ready, setReady] = useState(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    const el = wrap.current!;
    const cv = canvas.current!;
    let scene: AtravessaScene;
    try {
      scene = new AtravessaScene(cv, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    scene.setRecord(recordRef.current);
    const sim = new AtravessaSim(seed);
    const audio = createAtravessaAudio();
    // só em desenvolvimento: deixa mexer no herói pelo console para ver os biomas sem jogar até lá
    if (import.meta.env.DEV) {
      const w = window as unknown as { __atr?: AtravessaSim; __atrScene?: AtravessaScene };
      w.__atr = sim;
      w.__atrScene = scene;
    }
    const steps: AtravessaInput[] = [];
    const pending: Dir[] = [];
    const onDir = (d: Dir) => {
      if (paused || finished) return;
      pending.push(d);
      setHint(false);
    };
    const controls = attachControls(el, onDir);

    const resize = () => scene.resize(el.clientWidth || 360, el.clientHeight || 640);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let paused = false;
    let finished = false;
    let countTimer = 0;
    let endTimer = 0;
    let toastTimer = 0;
    let toastN = 0;
    let deathAt = 0;
    let shownScore = 0;
    let passedRecord = false;
    // o que já foi "ouvido": o instante do último pulo e do último pouso e quantos passos foram recusados
    let hopTick = -1;
    let landTick = -1;
    let bumps = 0;
    let sweepId = -1;
    let sweepHit = false;
    let nextBeep = 0;
    let frameN = 0;
    let warning = false;
    let siren = 0;
    // de que lado da coluna do herói cada veículo estava no quadro anterior (para o som de passagem)
    let sides = new Map<string, number>();
    let revved = new Set<string>();

    const showToast = (text: string, kind: 'record' | 'marco') => {
      window.clearTimeout(toastTimer);
      setToast({ text, kind, n: ++toastN });
      toastTimer = window.setTimeout(() => setToast(null), TOAST_MS);
    };

    const doPause = () => {
      if (finished || paused) return;
      paused = true;
      pending.length = 0;
      window.clearTimeout(countTimer);
      holdAudio(true);
      audio?.pause();
      setPause({ kind: 'paused' });
    };
    const doResume = () => {
      if (!paused) return;
      window.clearTimeout(countTimer);
      let n = 3;
      setPause({ kind: 'count', n });
      const step = () => {
        n--;
        if (n > 0) {
          setPause({ kind: 'count', n });
          countTimer = window.setTimeout(step, 1000);
          return;
        }
        holdAudio(false);
        audio?.resume();
        paused = false;
        last = performance.now();
        acc = 0;
        setPause({ kind: 'none' });
      };
      countTimer = window.setTimeout(step, 1000);
    };
    ctl.current = { pause: doPause, resume: doResume };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (paused) doResume();
        else doPause();
      }
    };
    window.addEventListener('keydown', onKey);
    const onHide = () => document.visibilityState === 'hidden' && doPause();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', doPause);

    let shown = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!paused && !finished) acc += dt;
      let n = 0;
      while (acc >= ATR_DT && sim.alive && n < 8) {
        // cada passo pedido entra no registro com o instante em que o servidor vai aplicá-lo
        for (const d of pending) {
          steps.push({ t: sim.tick + 1, d });
          sim.input(d);
        }
        pending.length = 0;
        sim.step();
        acc -= ATR_DT;
        n++;
      }
      if (n === 8) acc = 0;

      const v = sim.view();
      if (!paused) {
        if (v.step) {
          const started = sim.tick - Math.round(v.step.progress * ATR_STEP_TICKS);
          if (started !== hopTick) {
            hopTick = started;
            audio?.hop(v.step.dir === 0);
          }
        }
        if (v.landed) {
          const at = sim.tick - v.landed.age;
          if (at !== landTick) {
            landTick = at;
            if (sim.alive) audio?.land(sim.world.lane(sim.row).kind);
          }
        }
        if (v.bumps !== bumps) {
          bumps = v.bumps;
          audio?.bump();
        }
        const info = sim.world.biomeAt(v.y);
        audio?.setBiome(laneBiome(info));

        // o que avisa por som: o trem, a ambulância, os veículos que passam e a varrida
        // (a varredura das faixas é leve, mas não precisa ser a cada quadro)
        if (frameN++ % 2 === 0) {
          warning = false;
          siren = 0;
          const next = new Map<string, number>();
          const nextRev = new Set<string>();
          const from = Math.floor(v.y) - 6;
          const to = Math.floor(v.y) + 8;
          for (let r = Math.max(0, from); r <= to; r++) {
            const lane = sim.world.lane(r);
            if (lane.kind === 'trilho' && !warning) warning = trainState(lane, sim.tick).warning;
            if (lane.kind !== 'estrada' || !lane.flow) continue;
            const rowDist = Math.abs(r - v.y);
            for (const it of laneItems(lane, sim.tick)) {
              if (it.kind === 'ambulancia') {
                const near = clamp01(1 - Math.abs(it.x) / 17) ** 0.7 * clamp01(1 - rowDist / 9);
                siren = Math.max(siren, near);
              }
              // o carro de corrida avisa com o motor antes de aparecer
              if (it.kind === 'esportivo' && rowDist <= 5) {
                const rk = r + ':' + it.id;
                nextRev.add(rk);
                if (!revved.has(rk) && Math.abs(it.x) > 5) audio?.rev();
              }
              // o som de passagem: só das faixas bem perto, no instante em que cruza a coluna do herói
              if (rowDist <= 3.2 && it.kind !== 'ambulancia') {
                const key = r + ':' + it.id;
                const side = it.x < v.x ? -1 : 1;
                next.set(key, side);
                const was = sides.get(key);
                if (was !== undefined && was !== side)
                  audio?.pass(it.speed, it.len, clamp01(1 - rowDist / 3.4));
              }
            }
          }
          sides = next;
          revved = nextRev;
        }
        if (!finished) audio?.frame(warning, siren);

        const sw = v.sweep;
        if (sw && sw.id !== sweepId) {
          sweepId = sw.id;
          sweepHit = false;
          nextBeep = 0;
        }
        if (sw && sw.phase === 'warn' && now / 1000 >= nextBeep) {
          audio?.sweepWarn();
          buzz(8);
          nextBeep = now / 1000 + 0.34 - 0.22 * sw.warn;
        }
        if (sw && sw.phase === 'hit' && !sweepHit) {
          sweepHit = true;
          audio?.sweepHit();
        }
      }

      if (sim.score !== shownScore) {
        const prev = shownScore;
        shownScore = sim.score;
        setScore(shownScore);
        buzz(6);
        const record = recordRef.current;
        if (record > 0 && !passedRecord && prev <= record && shownScore > record) {
          passedRecord = true;
          audio?.record();
          showToast('NOVO RECORDE', 'record');
          buzz(40);
        } else if (atravessaMilestone(shownScore)) {
          audio?.milestone();
          showToast(`${shownScore} LINHAS`, 'marco');
        }
      }
      if (!sim.alive && !finished) {
        finished = true;
        deathAt = now;
        buzz(90);
        audio?.death(sim.end!);
        setOver({ end: sim.end!, score: sim.score });
        endTimer = window.setTimeout(() => {
          onEndRef.current({ score: sim.score, ticks: sim.tick, end: sim.end }, steps);
        }, END_DELAY_MS);
      }
      scene.render(
        sim,
        paused ? 0 : dt,
        now / 1000,
        finished ? { end: sim.end!, age: (now - deathAt) / 1000 } : null,
      );
      if (!shown) {
        shown = true;
        setReady(true);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(countTimer);
      window.clearTimeout(endTimer);
      window.clearTimeout(toastTimer);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', doPause);
      ctl.current = null;
      sceneRef.current = null;
      holdAudio(false);
      ro.disconnect();
      controls.dispose();
      scene.dispose();
      audio?.stop();
    };
  }, [seed]);

  useEffect(() => {
    sceneRef.current?.setRecord(record);
  }, [record]);

  const paused = pause.kind !== 'none';
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  return (
    <div className="at-play" ref={wrap} role="application" aria-label="Partida do Atravessa!">
      <canvas ref={canvas} className="at-canvas" />
      {!ready && !failed && (
        <div className="at-boot">
          <Loader />
        </div>
      )}
      <div className="at-score" aria-live="off">
        <b>{score}</b>
        {record > 0 && <small className="mono">REC {record}</small>}
      </div>
      {!over && (
        <div className="at-tools">
          <GearButton onClick={() => ctl.current?.pause()} testId="atr-menu-btn" />
        </div>
      )}
      {toast && !over && (
        <div key={toast.n} className={`at-toast ${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}
      {!over && !failed && ready && (
        <GameTips storageKey={TIPS_KEY} rows={atravessaTipRows(touch)} testId="atr-tips" />
      )}
      {hint && !over && !failed && (
        <p className="at-hint mono">
          {touch ? (
            'TOQUE PARA PULAR · DESLIZE PARA IR PARA O LADO'
          ) : (
            <>
              <Keycap k="W" touchHide={false} />
              <Keycap k="A" touchHide={false} />
              <Keycap k="S" touchHide={false} />
              <Keycap k="D" touchHide={false} /> OU AS SETAS · <Keycap k="Esc" touchHide={false} />{' '}
              MENU
            </>
          )}
        </p>
      )}
      {failed && (
        <div className="at-over" role="alert">
          <b>SEU APARELHO NÃO ABRIU O 3D</b>
          <button type="button" className="btn ghost" onClick={onQuit}>
            Voltar
          </button>
        </div>
      )}
      {over && (
        <div className="at-over" role="status">
          <b>{OVER_TEXT[over.end]}</b>
          <span className="mono">{over.score}</span>
        </div>
      )}
      {paused && (
        <div className="at-pause" role="dialog" aria-modal="true" aria-label="Jogo pausado">
          {pause.kind === 'count' ? (
            <div className="at-pause-count" aria-live="assertive">
              {pause.n}
            </div>
          ) : (
            <GameMenu
              title="Pausado"
              testPrefix="atr-menu"
              continueLabel="Voltar ao jogo"
              tipsKey={TIPS_KEY}
              tips={atravessaTipRows(touch)}
              online={false}
              escCloses={false}
              onClose={() => ctl.current?.resume()}
              onExit={onQuit}
              onOfflineInvite={onOfflineInvite}
              actions={[
                {
                  id: 'restart',
                  icon: <IcRestart size={20} />,
                  label: 'Reiniciar partida',
                  armed: 'Toque de novo para reiniciar',
                  onClick: onRestart,
                  testId: 'atr-menu-restart',
                },
              ]}
            />
          )}
        </div>
      )}
    </div>
  );
}
