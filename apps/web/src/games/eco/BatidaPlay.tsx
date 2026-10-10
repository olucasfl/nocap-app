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
  type BatidaNote,
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
import { HIT, HORIZON, S_FAR, project } from './batida-view';
import { PADS } from './pads';
import './batida.css';

/** Quanto antes de chegar ao molde a nota aparece lá no fundo da pista (ms). */
const TRAVEL_MS = 2300;
const NOTE_H = 46;
const SVG_NS = 'http://www.w3.org/2000/svg';

const JUDGE_TEXT = {
  perfect: 'PERFEITO',
  good: 'BOM',
  miss: 'ERROU',
  held: 'SEGUROU!',
  broke: 'SOLTOU CEDO',
} as const;

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
  /** A partida acabou: os toques feitos (apertar e soltar) e o resultado que o jogo contou. */
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
  // Em 100% de altura a pista já passou dos moldes: continua a mesma reta.
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
          opacity="0.14"
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
          strokeOpacity="0.3"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

const keyOf = (n: BatidaNote) => `${n.bar}:${n.step}:${n.lane}`;

/**
 * A partida do Eco Hero: cinco pistas em perspectiva, as notas vêm do fundo e encaixam nos moldes
 * translúcidos de cada cor. Notas juntas (acordes) pedem dedos ao mesmo tempo; notas longas pedem
 * segurar até o fim. O relógio de tudo é o do áudio, e a conta é a mesma `BatidaSim` que o
 * servidor usa para refazer a partida. Pausar congela o relógio; para voltar, 3, 2, 1.
 */
export function BatidaPlay({ seed, song, onEnd, onQuit }: Props) {
  const [hud, setHud] = useState<Hud>({ tenths: 0, combo: 0, mult: 1, energy: 70 });
  const [over, setOver] = useState(false);
  const [pause, setPause] = useState<Pause>({ kind: 'none' });
  const [keys, setKeys] = useState<string[]>(() => getBatidaKeys());
  const field = useRef<HTMLDivElement>(null);
  const holdsSvg = useRef<SVGSVGElement>(null);
  const judgeEl = useRef<HTMLDivElement>(null);
  const countEl = useRef<HTMLDivElement>(null);
  const slotEls = useRef<(HTMLButtonElement | null)[]>([]);
  /** Os botões e os controles da pausa chamam o que o laço da partida registra aqui. */
  const ctl = useRef<{
    press: (lane: number) => void;
    release: (lane: number) => void;
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
    /** O toque que está apertado agora em cada pista (ainda sem soltar). */
    const open = new Map<number, BatidaTap>();
    const lastTap = new Array<number>(BATIDA_LANES).fill(-Infinity);
    const nodes = new Map<string, HTMLElement>();
    const bodies = new Map<string, SVGPolygonElement>();
    const latency = getBatidaLatency();
    let raf = 0;
    let finished = false;
    let paused = false;
    let countTimer = 0;
    let size = { w: field.current?.clientWidth ?? 360, h: field.current?.clientHeight ?? 400 };
    const fit = () => {
      size = { w: field.current?.clientWidth ?? size.w, h: field.current?.clientHeight ?? size.h };
      holdsSvg.current?.setAttribute('viewBox', `0 0 ${size.w} ${size.h}`);
    };
    const ro = new ResizeObserver(fit);
    if (field.current) ro.observe(field.current);
    fit();

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

    const say = (kind: keyof typeof JUDGE_TEXT) => {
      const el = judgeEl.current;
      if (!el) return;
      el.className = 'bt-judge';
      void el.offsetWidth; // reinicia a animação
      el.textContent = JUDGE_TEXT[kind];
      const tone = kind === 'held' ? 'perfect' : kind === 'broke' ? 'miss' : kind;
      el.className = `bt-judge on ${tone}`;
    };

    const flash = (lane: number, kind: 'hit' | 'bad') => {
      const el = slotEls.current[lane];
      if (!el) return;
      el.classList.remove('hit', 'bad');
      void el.offsetWidth;
      el.classList.add(kind);
    };

    const drop = (note: BatidaNote) => {
      const key = keyOf(note);
      nodes.get(key)?.remove();
      nodes.delete(key);
      bodies.get(key)?.remove();
      bodies.delete(key);
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      // Dedos ainda na tela: o toque termina agora.
      const t = Math.round(clock());
      for (const tap of open.values()) tap.up = Math.max(tap.t + 1, t);
      open.clear();
      audio?.over();
      buzz(120);
      setOver(true);
      window.setTimeout(() => onEndRef.current(taps, sim.run), 1100);
    };

    const handle = (events: SimEvent[]) => {
      for (const e of events) {
        if (e.kind === 'hit') {
          audio?.hit(e.note.lane, e.note.bar, e.judgement === 'perfect');
          if (e.note.endT !== undefined) audio?.holdStart(e.note.lane, e.note.bar);
          else drop(e.note);
          flash(e.note.lane, 'hit');
          say(e.judgement);
          if (e.judgement === 'perfect') buzz(10);
        } else if (e.kind === 'miss') {
          audio?.missed();
          say('miss');
        } else if (e.kind === 'stray') {
          audio?.wrong();
          flash(e.lane, 'bad');
          say('miss');
          buzz(25);
        } else if (e.kind === 'holdDone') {
          audio?.holdEnd(e.lane);
          audio?.hit(e.note.lane, e.note.bar, true);
          drop(e.note);
          flash(e.lane, 'hit');
          say('held');
          buzz(15);
        } else {
          audio?.holdEnd(e.lane);
          audio?.missed();
          drop(e.note);
          flash(e.lane, 'bad');
          say('broke');
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
      if (finished || paused || open.has(lane)) return;
      const t = Math.round(clock());
      // Antes da primeira nota ainda é a contagem: toque aí não vale.
      if (t < barStart(song, LEAD_IN_BARS) - 400) return;
      // Um toque que dispara duas vezes não pode virar rajada impossível.
      if (t - lastTap[lane]! < BATIDA_MIN_TAP_GAP_MS) return;
      lastTap[lane] = t;
      const tap: BatidaTap = { lane, t, up: t + 1 };
      taps.push(tap);
      open.set(lane, tap);
      slotEls.current[lane]?.classList.add('down');
      handle(sim.tap(lane, t));
    };

    const releaseLane = (lane: number) => {
      const tap = open.get(lane);
      slotEls.current[lane]?.classList.remove('down');
      if (!tap) return;
      open.delete(lane);
      tap.up = Math.max(tap.t + 1, Math.round(clock()));
      if (!finished) handle(sim.release(lane, tap.up));
    };

    /** Congela o relógio do áudio e a música; o jogo para onde está. */
    const doPause = () => {
      if (finished || paused) return;
      // Pausar com o dedo numa nota longa conta como soltar.
      for (const lane of [...open.keys()]) releaseLane(lane);
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
    ctl.current = { press, release: releaseLane, pause: doPause, resume: doResume };

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
    const onKeyUp = (e: KeyboardEvent) => {
      const lane = laneOfKey(keysRef.current, e.key);
      if (lane !== undefined) releaseLane(lane);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
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

      // Notas na tela: as que vêm do fundo, as que acabaram de passar e as longas ainda em curso.
      const want = new Set<string>();
      const { w, h } = size;
      const visible: BatidaNote[] = [];
      for (const n of notesBetween(seed, song, now - 4500, now + TRAVEL_MS)) {
        const alive = n.endT !== undefined ? n.endT >= now - 250 : n.t >= now - GOOD_MS - 250;
        if (alive) visible.push(n);
      }
      for (let lane = 0; lane < BATIDA_LANES; lane++) {
        const held = sim.holdingNote(lane);
        if (held && !visible.some((n) => keyOf(n) === keyOf(held))) visible.push(held);
      }
      const half = (w / BATIDA_LANES) * 0.36;
      for (const n of visible) {
        const key = keyOf(n);
        want.add(key);
        const holding =
          sim.holdingNote(n.lane)?.t === n.t && sim.holdingNote(n.lane)?.lane === n.lane;
        let el = nodes.get(key);
        if (!el) {
          el = document.createElement('div');
          el.className = n.endT !== undefined ? 'bt-note long' : 'bt-note';
          el.innerHTML = `<span style="background:${PADS[n.lane]!.color};color:${PADS[n.lane]!.ink}"><svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true"><use href="#bt-sym-${n.lane}"/></svg></span>`;
          field.current?.appendChild(el);
          nodes.set(key, el);
        }
        // Segurando, a cabeça da nota fica no molde enquanto a barra "queima" até acabar.
        const z = (n.t - now) / TRAVEL_MS;
        const p = project(holding ? Math.max(0, z) : z, n.lane, w, h);
        el.style.transform = `translate(${p.x - w / (2 * BATIDA_LANES)}px, ${p.y - NOTE_H / 2}px) scale(${p.scale})`;
        el.style.opacity = String(p.opacity);
        el.classList.toggle('holding', holding);

        if (n.endT !== undefined && holdsSvg.current) {
          let body = bodies.get(key);
          if (!body) {
            body = document.createElementNS(SVG_NS, 'polygon');
            body.setAttribute('fill', PADS[n.lane]!.color);
            body.setAttribute('stroke', 'currentColor');
            body.setAttribute('stroke-width', '2');
            holdsSvg.current.appendChild(body);
            bodies.set(key, body);
          }
          const head = project(holding ? Math.max(0, z) : z, n.lane, w, h);
          const tail = project((n.endT - now) / TRAVEL_MS, n.lane, w, h);
          const hs = half * head.scale;
          const ts = half * tail.scale;
          body.setAttribute(
            'points',
            `${tail.x - ts},${tail.y} ${tail.x + ts},${tail.y} ${head.x + hs},${head.y} ${head.x - hs},${head.y}`,
          );
          body.setAttribute(
            'opacity',
            String(holding ? 0.95 : 0.55 * Math.min(1, tail.opacity + 0.2)),
          );
        }
      }
      for (const [key, el] of nodes) {
        if (!want.has(key)) {
          el.remove();
          nodes.delete(key);
        }
      }
      for (const [key, body] of bodies) {
        if (!want.has(key)) {
          body.remove();
          bodies.delete(key);
        }
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(countTimer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', doPause);
      ctl.current = null;
      holdAudio(false);
      ro.disconnect();
      audio?.stop();
      for (const el of nodes.values()) el.remove();
      for (const el of bodies.values()) el.remove();
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
        <svg ref={holdsSvg} className="bt-holds" aria-hidden="true" />
        <div className="bt-count" ref={countEl} aria-hidden="true" />
        <div className="bt-judge" ref={judgeEl} role="status" />
        {/* Os moldes: cada cor, translúcida, no lugar onde a nota tem que encaixar. Tocar aqui é tocar na pista. */}
        <div className="bt-slots" role="group" aria-label="Moldes das cinco pistas">
          {Array.from({ length: BATIDA_LANES }, (_, i) => {
            const p = PADS[i]!;
            return (
              <button
                key={i}
                type="button"
                ref={(el) => {
                  slotEls.current[i] = el;
                }}
                className="bt-slot"
                style={{ left: `${i * 20}%`, ['--lane' as string]: p.color }}
                aria-label={`Pista ${i + 1}, ${p.name}, tecla ${keyLabel(keys[i]!)}`}
                disabled={over || paused}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  ctl.current?.press(i);
                }}
                onPointerUp={() => ctl.current?.release(i)}
                onPointerCancel={() => ctl.current?.release(i)}
                onLostPointerCapture={() => ctl.current?.release(i)}
                onAnimationEnd={(e) => e.currentTarget.classList.remove('hit', 'bad')}
              >
                <span className="bt-mold">
                  <svg
                    viewBox="0 0 48 48"
                    width="28"
                    height="28"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    {p.symbol}
                  </svg>
                </span>
                <kbd className="bt-kbd">{keyLabel(keys[i]!)}</kbd>
              </button>
            );
          })}
        </div>
        {over && <div className="bt-over">SEM ENERGIA</div>}
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
