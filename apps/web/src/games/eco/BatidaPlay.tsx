import { useEffect, useRef, useState } from 'react';
import {
  BATIDA_LANES,
  BATIDA_MIN_TAP_GAP_MS,
  BatidaSim,
  ENERGY_MAX,
  GOOD_MS,
  LEAD_IN_BARS,
  barMs,
  barStart,
  notesBetween,
  type BatidaRun,
  type BatidaTap,
  type SimEvent,
  type Song,
} from '@nocap/games';
import { createBatidaAudio, type BatidaAudio } from '@/lib/batida-audio';
import { getBatidaKeys, keyLabel, laneOfKey } from '@/lib/batida-keys';
import { getBatidaLatency } from '@/lib/batida-latency';
import { buzz, holdAudio } from '@/lib/sfx';
import { BatidaKeys } from './BatidaKeys';
import { PADS } from './pads';
import './batida.css';

/** Quanto antes de chegar à linha a nota aparece lá no fundo da pista (ms). */
const TRAVEL_MS = 2300;
const NOTE_H = 46;

/**
 * Perspectiva: a pista vai de um horizonte (alto, estreito) até a linha de acerto (perto, larga).
 * `K` é a força da perspectiva; `HORIZON` e `HIT` são a altura do horizonte e da linha, em fração
 * do campo. Tudo vira `transform` (posição e escala), nada de layout por quadro.
 */
const K = 2.6;
const HORIZON = 0.05;
const HIT = 0.9;
const S_FAR = 1 / (1 + K);

/** Onde uma nota está na tela: `z` = 1 no fundo, 0 na linha de acerto, negativo depois dela. */
export function project(z: number, lane: number, w: number, h: number) {
  const s = 1 / (1 + K * Math.max(-0.2, z));
  const u = (s - S_FAR) / (1 - S_FAR);
  return {
    scale: s,
    x: w / 2 + (lane - (BATIDA_LANES - 1) / 2) * (w / BATIDA_LANES) * s,
    y: h * (HORIZON + (HIT - HORIZON) * u),
    /** Surge devagar no fundo e some depois de passar da linha. */
    opacity: z > 0 ? Math.min(1, u / 0.14) : Math.max(0, 1 + z / 0.2),
  };
}

const JUDGE_TEXT = { perfect: 'PERFEITO', good: 'BOM', miss: 'ERROU' } as const;

interface Hud {
  tenths: number;
  combo: number;
  mult: number;
  energy: number;
}

/** A pausa: jogando, pausado (menu) ou voltando (3, 2, 1). */
type Pause = { kind: 'none' } | { kind: 'paused' } | { kind: 'count'; n: number };

interface Props {
  seed: string;
  song: Song;
  /** A partida acabou: os toques feitos e o resultado que o jogo contou. */
  onEnd: (taps: BatidaTap[], run: BatidaRun) => void;
  /** Saiu pelo menu de pausa. */
  onQuit: () => void;
}

/** Símbolos das 5 pistas, definidos uma vez e reusados pelas notas (que são criadas à mão a cada quadro). */
function SymbolDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" className="bt-defs">
      <defs>
        {PADS.slice(0, BATIDA_LANES).map((p, i) => (
          <symbol key={i} id={`bt-sym-${i}`} viewBox="0 0 48 48">
            {p.symbol}
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

/** A pista em perspectiva: faixas coloridas que se juntam no horizonte. */
function Road() {
  const top = (i: number) => 50 + (i - BATIDA_LANES / 2) * (100 / BATIDA_LANES) * S_FAR;
  // Em 100% de altura a pista já passou da linha de acerto: continua a mesma reta.
  const sBottom = S_FAR + ((1 - HORIZON) / (HIT - HORIZON)) * (1 - S_FAR);
  const bottom = (i: number) => 50 + (i - BATIDA_LANES / 2) * (100 / BATIDA_LANES) * sBottom;
  const horizon = HORIZON * 100;
  return (
    <svg className="bt-road" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: BATIDA_LANES }, (_, i) => (
        <polygon
          key={i}
          points={`${top(i)},${horizon} ${top(i + 1)},${horizon} ${bottom(i + 1)},100 ${bottom(i)},100`}
          fill={PADS[i]!.color}
          opacity="0.22"
        />
      ))}
      {Array.from({ length: BATIDA_LANES + 1 }, (_, i) => (
        <line
          key={i}
          x1={top(i)}
          y1={horizon}
          x2={bottom(i)}
          y2="100"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/**
 * A partida do Eco Hero: cinco pistas em perspectiva, as notas vêm do fundo e a música toca por
 * baixo. O relógio de tudo é o do áudio (não `setTimeout`), e a conta de acertos é a mesma
 * `BatidaSim` que o servidor usa para refazer a partida. Pausar congela o relógio do áudio; para
 * voltar, 3, 2, 1.
 */
export function BatidaPlay({ seed, song, onEnd, onQuit }: Props) {
  const [hud, setHud] = useState<Hud>({ tenths: 0, combo: 0, mult: 1, energy: 70 });
  const [over, setOver] = useState(false);
  const [pause, setPause] = useState<Pause>({ kind: 'none' });
  const [keys, setKeys] = useState<string[]>(() => getBatidaKeys());
  const field = useRef<HTMLDivElement>(null);
  const judgeEl = useRef<HTMLDivElement>(null);
  const countEl = useRef<HTMLDivElement>(null);
  const padEls = useRef<(HTMLButtonElement | null)[]>([]);
  /** O toque de cada botão e os controles da pausa chamam o que o laço da partida registra aqui. */
  const ctl = useRef<{
    press: (lane: number) => void;
    pause: () => void;
    resume: () => void;
  } | null>(null);
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    const sim = new BatidaSim(seed, song);
    const audio: BatidaAudio | null = createBatidaAudio(song);
    const taps: BatidaTap[] = [];
    const lastTap = new Array<number>(BATIDA_LANES).fill(-Infinity);
    const nodes = new Map<string, HTMLElement>();
    const latency = getBatidaLatency();
    let raf = 0;
    let finished = false;
    let paused = false;
    let countTimer = 0;
    let size = { w: field.current?.clientWidth ?? 360, h: field.current?.clientHeight ?? 400 };
    const ro = new ResizeObserver(() => {
      size = { w: field.current?.clientWidth ?? size.w, h: field.current?.clientHeight ?? size.h };
    });
    if (field.current) ro.observe(field.current);

    // Sem Web Audio o jogo ainda roda: um relógio simples faz as vezes do relógio da música.
    let fallbackBase = performance.now() + 250;
    let fallbackPausedAt = 0;
    audio?.start();
    const clock = () =>
      (audio ? audio.now() : (paused ? fallbackPausedAt : performance.now()) - fallbackBase) -
      latency;

    const showHud = () =>
      setHud({
        tenths: sim.currentTenths,
        combo: sim.currentCombo,
        mult: sim.currentMultiplier,
        energy: sim.currentEnergy,
      });

    const say = (kind: 'perfect' | 'good' | 'miss') => {
      const el = judgeEl.current;
      if (!el) return;
      el.className = 'bt-judge';
      void el.offsetWidth; // reinicia a animação
      el.textContent = JUDGE_TEXT[kind];
      el.className = `bt-judge on ${kind}`;
    };

    const flash = (lane: number, kind: 'hit' | 'bad') => {
      const el = padEls.current[lane];
      if (!el) return;
      el.classList.remove('hit', 'bad');
      void el.offsetWidth;
      el.classList.add(kind);
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      audio?.over();
      buzz(120);
      setOver(true);
      window.setTimeout(() => onEndRef.current(taps, sim.run), 1100);
    };

    const handle = (events: SimEvent[]) => {
      for (const e of events) {
        if (e.kind === 'hit') {
          audio?.hit(e.note.lane, e.note.bar, e.judgement === 'perfect');
          flash(e.note.lane, 'hit');
          say(e.judgement);
          const key = `${e.note.bar}:${e.note.step}:${e.note.lane}`;
          nodes.get(key)?.remove();
          nodes.delete(key);
          if (e.judgement === 'perfect') buzz(10);
        } else if (e.kind === 'miss') {
          audio?.missed();
          say('miss');
        } else {
          audio?.wrong();
          flash(e.lane, 'bad');
          say('miss');
          buzz(25);
        }
      }
      if (events.length > 0) {
        audio?.setLevel(sim.currentMultiplier);
        showHud();
      }
      if (sim.dead) finish();
    };

    const press = (lane: number) => {
      if (finished || paused) return;
      const t = Math.round(clock());
      // Antes da primeira nota ainda é a contagem: toque aí não vale.
      if (t < barStart(song, LEAD_IN_BARS) - 400) return;
      // Um toque que dispara duas vezes não pode virar rajada impossível.
      if (t - lastTap[lane]! < BATIDA_MIN_TAP_GAP_MS) return;
      lastTap[lane] = t;
      taps.push({ lane, t });
      handle(sim.tap(lane, t));
    };

    /** Congela o relógio do áudio e a música; o jogo para onde está. */
    const doPause = () => {
      if (finished || paused) return;
      paused = true;
      window.clearTimeout(countTimer);
      fallbackPausedAt = performance.now();
      holdAudio(true);
      audio?.pause();
      setPause({ kind: 'paused' });
    };

    /** Volta com 3, 2, 1 (cada um dura um segundo) e só então o relógio volta a andar. */
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
        fallbackBase += performance.now() - fallbackPausedAt;
        holdAudio(false);
        audio?.resume();
        paused = false;
        setPause({ kind: 'none' });
      };
      countTimer = window.setTimeout(step, 1000);
    };
    ctl.current = { press, pause: doPause, resume: doResume };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const lane = laneOfKey(keysRef.current, e.key);
      // Esc sempre pausa; o P também, a menos que a pessoa tenha posto o P numa pista.
      if (e.key === 'Escape' || (lane === undefined && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        if (paused) doResume();
        else doPause();
        return;
      }
      if (lane !== undefined) {
        e.preventDefault();
        press(lane);
      }
    };
    window.addEventListener('keydown', onKey);
    // Saiu da aba ou do app: pausa sozinho, para não perder a partida sem ver.
    const onHide = () => document.visibilityState === 'hidden' && doPause();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', doPause);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = clock();
      if (!finished && !paused) handle(sim.advance(now));

      // Contagem inicial: 4, 3, 2, 1 nas batidas do compasso 0.
      const count = countEl.current;
      if (count) {
        if (now < barStart(song, LEAD_IN_BARS)) {
          const beat = Math.min(3, Math.max(0, Math.floor(now / (barMs(song, 0) / 4))));
          count.textContent = now < 0 ? '' : String(4 - beat);
          count.style.opacity = '1';
        } else {
          count.style.opacity = '0';
        }
      }

      // Notas na tela: as que vêm do fundo e as que acabaram de passar da linha.
      const want = new Set<string>();
      const { w, h } = size;
      for (const n of notesBetween(seed, song, now - GOOD_MS - 250, now + TRAVEL_MS)) {
        const key = `${n.bar}:${n.step}:${n.lane}`;
        want.add(key);
        let el = nodes.get(key);
        if (!el) {
          el = document.createElement('div');
          el.className = 'bt-note';
          el.innerHTML = `<span style="background:${PADS[n.lane]!.color};color:${PADS[n.lane]!.ink}"><svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true"><use href="#bt-sym-${n.lane}"/></svg></span>`;
          field.current?.appendChild(el);
          nodes.set(key, el);
        }
        const p = project((n.t - now) / TRAVEL_MS, n.lane, w, h);
        el.style.transform = `translate(${p.x - w / (2 * BATIDA_LANES)}px, ${p.y - NOTE_H / 2}px) scale(${p.scale})`;
        el.style.opacity = String(p.opacity);
      }
      for (const [key, el] of nodes) {
        if (!want.has(key)) {
          el.remove();
          nodes.delete(key);
        }
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(countTimer);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', doPause);
      ctl.current = null;
      holdAudio(false);
      ro.disconnect();
      audio?.stop();
      for (const el of nodes.values()) el.remove();
    };
  }, [seed, song]);

  const paused = pause.kind !== 'none';

  return (
    <section className="screen bt" aria-label="Partida do Eco Hero">
      <SymbolDefs />
      <div className="bt-hud">
        <div className="bt-score">
          <span className="mono">PONTOS</span>
          <b>{Math.floor(hud.tenths / 10)}</b>
        </div>
        <div className={`bt-mult m${hud.mult}`} aria-label={`Multiplicador ${hud.mult}`}>
          x{hud.mult}
        </div>
        <div className="bt-combo">
          <span className="mono">COMBO</span>
          <b>{hud.combo}</b>
        </div>
        <button
          type="button"
          className="bt-pausebtn"
          aria-label="Pausar"
          data-sfx="select"
          disabled={over}
          onClick={() => ctl.current?.pause()}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        </button>
      </div>
      <div
        className="bt-energy"
        role="meter"
        aria-label="Energia"
        aria-valuemin={0}
        aria-valuemax={ENERGY_MAX}
        aria-valuenow={Math.round(hud.energy)}
      >
        <i
          className={hud.energy < 30 ? 'low' : ''}
          style={{ transform: `scaleX(${hud.energy / ENERGY_MAX})` }}
        />
      </div>
      <div className="bt-field" ref={field}>
        <Road />
        <div className="bt-line" aria-hidden="true" />
        <div className="bt-count" ref={countEl} aria-hidden="true" />
        <div className="bt-judge" ref={judgeEl} role="status" />
        {over && <div className="bt-over">SEM ENERGIA</div>}
      </div>
      <div className="bt-pads" role="group" aria-label="Botões das cinco pistas">
        {Array.from({ length: BATIDA_LANES }, (_, i) => {
          const p = PADS[i]!;
          return (
            <button
              key={i}
              type="button"
              ref={(el) => {
                padEls.current[i] = el;
              }}
              className="bt-pad"
              style={{ background: p.color, color: p.ink }}
              aria-label={`Pista ${i + 1}, ${p.name}, tecla ${keyLabel(keys[i]!)}`}
              disabled={over || paused}
              onPointerDown={(e) => {
                e.preventDefault();
                ctl.current?.press(i);
              }}
              onAnimationEnd={(e) => e.currentTarget.classList.remove('hit', 'bad')}
            >
              <svg
                viewBox="0 0 48 48"
                width="40"
                height="40"
                fill="currentColor"
                aria-hidden="true"
              >
                {p.symbol}
              </svg>
              <kbd className="bt-kbd">{keyLabel(keys[i]!)}</kbd>
            </button>
          );
        })}
      </div>

      {paused && (
        <div className="bt-pause" role="dialog" aria-modal="true" aria-label="Jogo pausado">
          {pause.kind === 'count' ? (
            <div className="bt-pause-count" aria-live="assertive">
              {pause.n}
            </div>
          ) : (
            <div className="bt-pause-card">
              <h2>Pausado</h2>
              <p className="mono bt-pause-song">{song.name}</p>
              <BatidaKeys onChange={setKeys} />
              <div className="stack">
                <button
                  type="button"
                  className="btn alt"
                  data-sfx="start"
                  onClick={() => ctl.current?.resume()}
                >
                  Voltar ao jogo
                </button>
                <button type="button" className="btn ghost" data-sfx="back" onClick={onQuit}>
                  Sair da partida
                </button>
              </div>
              <p className="mono bt-pause-hint">Esc ou P também pausam e voltam.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
