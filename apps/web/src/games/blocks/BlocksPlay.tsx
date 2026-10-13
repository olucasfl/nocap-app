import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  BlocksGame,
  Coach,
  HINTS_PER_GAME,
  SIZE,
  analyze,
  hintFor,
  put,
  shapeOf,
  sweep,
  type BlockColor,
  type BlocksResult,
  type Move,
} from '@nocap/games';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MuteButton } from '@/components/MuteButton';
import { createBlocksAudio, type BlocksAudio } from '@/lib/blocks-audio';
import { buzz } from '@/lib/sfx';
import { aimAt } from './aim';
import { BLOCK_HEX, BlockDefs, Bulb, Cell, HintSeal, PerfectStamp, PieceArt, ThumbSeal } from './art';
import './blocks.css';

/** O que a partida entrega ao acabar: o resultado e as jogadas (que o servidor vai refazer). */
export interface BlocksEnd {
  result: BlocksResult;
  moves: number[];
  thumbs: number;
  perfects: number;
  hintsUsed: number;
}

interface Props {
  seed: string;
  /** O recorde do aparelho, para a linha "recorde" do placar. */
  best: number;
  onEnd: (end: BlocksEnd) => void;
  onQuit: () => void;
}

type Cells = (BlockColor | null)[];

interface Ui {
  cells: Cells;
  slots: (number | null)[];
  score: number;
  streak: number;
  sets: number;
  over: boolean;
  hints: number;
}

interface Drag {
  slot: number;
  touch: boolean;
  target: { row: number; col: number } | null;
}

interface Burst {
  key: number;
  cells: { idx: number; color: BlockColor; delay: number }[];
  /** As linhas e colunas inteiras que sumiram: ganham a faixa de luz que varre. */
  rows: number[];
  cols: number[];
  big: boolean;
}
interface Banner {
  key: number;
  title: string;
  sub: string | null;
}

/** A palavra de cada limpeza: quanto mais linhas de uma vez, maior o elogio. */
const CLEAR_WORDS = ['', '', 'DUPLO!', 'TRIPLO!', 'QUÁDRUPLO!', 'MEGA!'];
interface Pop {
  key: number;
  text: string;
  big: boolean;
  /** Posição no tabuleiro, em % da largura. */
  x: number;
  y: number;
}

const idx = (row: number, col: number) => row * SIZE + col;
const reduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** O número que sobe devagar até o valor novo: o placar "conta" os pontos. */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduced()) {
      setShown(target);
      from.current = target;
      return;
    }
    const start = from.current;
    if (start === target) return;
    const t0 = performance.now();
    const dur = Math.min(900, 250 + Math.abs(target - start) * 6);
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const v = Math.round(start + (target - start) * (1 - (1 - p) * (1 - p)));
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

/**
 * A partida do Block Classic (spec 021): o tabuleiro 8x8, a bandeja com as 3 peças, o arrastar,
 * os efeitos de limpeza, o joinha e o PERFECT, e as 3 dicas. A lógica inteira é a de `BlocksGame`
 * (a mesma que o servidor usa para conferir a partida); aqui só se desenha e se anima.
 */
export function BlocksPlay({ seed, best, onEnd, onQuit }: Props) {
  const gameRef = useRef<BlocksGame | null>(null);
  if (!gameRef.current) gameRef.current = new BlocksGame(seed);
  const g = gameRef.current;

  const svgRef = useRef<SVGSVGElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<BlocksAudio | null>(null);
  const coachRef = useRef<Coach | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const ptr = useRef({ x: 0, y: 0 });
  const cellsRef = useRef<Cells>(new Array<BlockColor | null>(SIZE * SIZE).fill(null));
  const stats = useRef({ thumbs: 0, perfects: 0, hintsUsed: 0 });
  const keyN = useRef(0);
  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const [ui, setUi] = useState<Ui>(() => ({
    cells: cellsRef.current.slice(),
    slots: g.slots.slice(),
    score: 0,
    streak: 0,
    sets: g.sets,
    over: false,
    hints: HINTS_PER_GAME,
  }));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [kb, setKb] = useState<{ slot: number; row: number; col: number } | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [fresh, setFresh] = useState<number[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [praise, setPraise] = useState<{ kind: 'thumb' | 'perfect'; key: number } | null>(null);
  const [returning, setReturning] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    audioRef.current = createBlocksAudio();
  }, []);

  const shown = useCountUp(ui.score);

  /** A análise da rodada atual: roda uma vez por rodada e alimenta o joinha, o PERFECT e a dica. */
  const ensureCoach = useCallback((): Coach => {
    if (!coachRef.current) coachRef.current = new Coach(analyze(g.rows, g.slots, g.streak, g.drought));
    return coachRef.current;
  }, [g]);

  // Adianta a análise da rodada logo depois que as peças chegam (sem travar o desenho).
  useEffect(() => {
    if (ui.over) return;
    const t = window.setTimeout(() => ensureCoach(), 350);
    return () => window.clearTimeout(t);
  }, [ui.sets, ui.over, ensureCoach]);

  const shake = useCallback((lines: number) => {
    const el = boardRef.current;
    if (!el || reduced() || typeof el.animate !== 'function') return;
    const a = Math.min(3 + lines * 2.2, 14);
    el.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${-a}px,${a * 0.4}px)` },
        { transform: `translate(${a * 0.8}px,${-a * 0.3}px)` },
        { transform: `translate(${-a * 0.5}px,${a * 0.2}px)` },
        { transform: 'translate(0,0)' },
      ],
      { duration: 280 + lines * 40, easing: 'ease-out' },
    );
  }, []);

  /** Coloca a peça de verdade: pontua, anima, elogia e entrega as peças novas. */
  const commit = useCallback(
    (slot: number, row: number, col: number) => {
      if (endedRef.current) return;
      const id = g.slots[slot];
      if (id === null || id === undefined) return;
      const shape = shapeOf(id);
      const coach = ensureCoach();
      const move: Move = { slot, row, col };
      const res = g.play(slot, row, col);
      if (!res) {
        audioRef.current?.bad();
        return;
      }
      const praised = coach.step(move);
      const perfect = coach.played === 3 && coach.perfectSoFar;
      if (res.newSet) coachRef.current = null;

      // As cores: a peça entra, e o que foi limpo vira estilhaço.
      const cells = cellsRef.current.slice();
      const placed: number[] = [];
      for (const [r, c] of shape.cells) {
        cells[idx(row + r, col + c)] = shape.color;
        placed.push(idx(row + r, col + c));
      }
      const gone: { idx: number; color: BlockColor; delay: number }[] = [];
      // O estouro começa na peça que acabou de cair e se espalha pela linha.
      const pr = row + (shape.h - 1) / 2;
      const pc = col + (shape.w - 1) / 2;
      const clearIdx = new Set<number>();
      for (const r of res.clearedRows) for (let c = 0; c < SIZE; c++) clearIdx.add(idx(r, c));
      for (const c of res.clearedCols) for (let r = 0; r < SIZE; r++) clearIdx.add(idx(r, c));
      for (const i of clearIdx) {
        const color = cells[i];
        if (color) {
          const d = Math.hypot(Math.floor(i / SIZE) - pr, (i % SIZE) - pc);
          gone.push({ idx: i, color, delay: Math.round(d * 42) });
        }
        cells[i] = null;
      }
      cellsRef.current = cells;

      const key = ++keyN.current;
      const audio = audioRef.current;
      audio?.drop(shape.size);
      buzz(res.lines > 0 ? 18 + res.lines * 8 : 8);
      setFresh(res.lines > 0 ? [] : placed);
      window.setTimeout(() => setFresh((f) => (f === placed ? [] : f)), 420);

      // Onde mostrar os pontos: no meio do que foi limpo, ou no meio da peça.
      const mid = (list: number[]) => {
        const rows = list.map((i) => Math.floor(i / SIZE));
        const colsL = list.map((i) => i % SIZE);
        const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
        return { x: ((avg(colsL) + 0.5) / SIZE) * 100, y: ((avg(rows) + 0.5) / SIZE) * 100 };
      };
      const where = mid(gone.length ? gone.map((x) => x.idx) : placed);
      setPops((p) => [
        ...p.slice(-3),
        { key, text: `+${res.points}`, big: res.lines > 0, ...where },
      ]);
      window.setTimeout(() => setPops((p) => p.filter((x) => x.key !== key)), 1100);

      if (gone.length) {
        const big = res.lines >= 3 || res.boardClear;
        setBursts((b) => [...b, { key, cells: gone, rows: res.clearedRows, cols: res.clearedCols, big }]);
        window.setTimeout(() => setBursts((b) => b.filter((x) => x.key !== key)), 1300);
        const word = res.boardClear ? 'TABULEIRO LIMPO!' : (CLEAR_WORDS[Math.min(res.lines, 5)] ?? '');
        const sub = res.streak >= 2 ? `COMBO x${Math.min(res.streak, 6)}` : null;
        if (word || sub) {
          setBanner({ key, title: word || 'COMBO!', sub: word ? sub : null });
          window.setTimeout(() => setBanner((x) => (x?.key === key ? null : x)), 1100);
        }
        if (res.boardClear) window.setTimeout(() => audio?.perfect(), 120);
        audio?.clear(res.lines, res.streak);
        shake(res.lines + (res.boardClear ? 3 : 0));
      }

      if (perfect) {
        stats.current.perfects++;
        setPraise({ kind: 'perfect', key });
        window.setTimeout(() => audio?.perfect(), gone.length ? 220 : 0);
        buzz(60);
        window.setTimeout(() => setPraise((p) => (p?.key === key ? null : p)), 1900);
      } else if (praised) {
        stats.current.thumbs++;
        setPraise({ kind: 'thumb', key });
        window.setTimeout(() => audio?.thumb(), gone.length ? 220 : 0);
        window.setTimeout(() => setPraise((p) => (p?.key === key ? null : p)), 1300);
      }

      setHint(null);
      setKb(null);
      setUi((u) => ({
        ...u,
        cells,
        slots: g.slots.slice(),
        score: g.score,
        streak: g.streak,
        sets: g.sets,
        over: g.over,
      }));

      if (g.over) {
        endedRef.current = true;
        window.setTimeout(() => audio?.over(), 450);
        window.setTimeout(
          () =>
            onEndRef.current({
              result: g.result,
              moves: g.moves.slice(),
              thumbs: stats.current.thumbs,
              perfects: stats.current.perfects,
              hintsUsed: stats.current.hintsUsed,
            }),
          1900,
        );
      }
    },
    [g, ensureCoach, shake],
  );

  // --- Arrastar -----------------------------------------------------------------------------
  const aimFor = useCallback(
    (d: Drag, x: number, y: number) => {
      const svg = svgRef.current;
      const id = g.slots[d.slot];
      if (!svg || id === null || id === undefined) return null;
      const r = svg.getBoundingClientRect();
      return aimAt(x, y, { left: r.left, top: r.top, width: r.width }, shapeOf(id), d.touch, (row, col) =>
        g.canPlace(d.slot, row, col),
      );
    },
    [g],
  );

  const moveFloat = useCallback(
    (d: Drag) => {
      const a = aimFor(d, ptr.current.x, ptr.current.y);
      if (!a) return null;
      const el = floatRef.current;
      if (el) el.style.transform = `translate3d(${a.left}px, ${a.top}px, 0)`;
      return a;
    },
    [aimFor],
  );

  const startDrag = (e: ReactPointerEvent, slot: number) => {
    if (endedRef.current || g.slots[slot] === null || e.button > 0) return;
    e.preventDefault();
    const d: Drag = { slot, touch: e.pointerType !== 'mouse', target: null };
    dragRef.current = d;
    ptr.current = { x: e.clientX, y: e.clientY };
    setKb(null);
    setDrag(d);
    audioRef.current?.pick();

    const onMove = (ev: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur) return;
      ptr.current = { x: ev.clientX, y: ev.clientY };
      const a = moveFloat(cur);
      const t = a?.target ?? null;
      if (t?.row !== cur.target?.row || t?.col !== cur.target?.col) {
        const next = { ...cur, target: t };
        dragRef.current = next;
        setDrag(next);
      }
    };
    const end = (ev: PointerEvent, cancelled: boolean) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      const cur = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!cur) return;
      ptr.current = { x: ev.clientX, y: ev.clientY };
      const a = cancelled ? null : aimFor(cur, ev.clientX, ev.clientY);
      if (a?.target) {
        commit(cur.slot, a.target.row, a.target.col);
      } else {
        if (!cancelled) audioRef.current?.bad();
        setReturning(cur.slot);
        window.setTimeout(() => setReturning((r) => (r === cur.slot ? null : r)), 320);
      }
    };
    const onUp = (ev: PointerEvent) => end(ev, false);
    const onCancel = (ev: PointerEvent) => end(ev, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  // A peça flutuante nasce já debaixo do dedo.
  useLayoutEffect(() => {
    if (drag) moveFloat(drag);
  }, [drag?.slot]);

  // --- Dica ---------------------------------------------------------------------------------
  const askHint = useCallback(() => {
    if (endedRef.current || ui.hints <= 0) return;
    const coach = ensureCoach();
    const m =
      hintFor(coach, g.rows, g.slots, g.streak, g.drought) ??
      g.legalMoves()[0] ??
      null;
    if (!m) return;
    stats.current.hintsUsed++;
    audioRef.current?.hint();
    setHint(m);
    setUi((u) => ({ ...u, hints: u.hints - 1 }));
  }, [ui.hints, g, ensureCoach]);

  // --- Teclado ------------------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (asking || endedRef.current) return;
      if (e.key === 'Escape') {
        if (kb) setKb(null);
        else setAsking(true);
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        askHint();
        return;
      }
      if (e.key >= '1' && e.key <= '3') {
        const slot = Number(e.key) - 1;
        if (g.slots[slot] !== null) {
          setKb((k) => ({ slot, row: k?.row ?? 3, col: k?.col ?? 3 }));
          audioRef.current?.pick();
        }
        return;
      }
      if (!kb) return;
      const dir: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      const d = dir[e.key];
      if (d) {
        e.preventDefault();
        setKb({ ...kb, row: Math.max(0, Math.min(SIZE - 1, kb.row + d[0])), col: Math.max(0, Math.min(SIZE - 1, kb.col + d[1])) });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (g.canPlace(kb.slot, kb.row, kb.col)) commit(kb.slot, kb.row, kb.col);
        else audioRef.current?.bad();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kb, asking, g, commit, askHint]);

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 1800);
    return () => window.clearTimeout(t);
  }, [note]);

  // --- Pré-visualização: onde a peça cai e quais linhas somem -------------------------------
  const active = drag ?? (kb ? { slot: kb.slot, touch: false, target: g.canPlace(kb.slot, kb.row, kb.col) ? { row: kb.row, col: kb.col } : null } : null);
  const preview = useMemo(() => {
    if (!active?.target) return null;
    const id = ui.slots[active.slot];
    if (id === null || id === undefined) return null;
    const shape = shapeOf(id);
    const { row, col } = active.target;
    const s = sweep(put(g.rows, shape, row, col));
    const hot = new Set<number>();
    for (const r of s.clearedRows) for (let c = 0; c < SIZE; c++) hot.add(idx(r, c));
    for (const c of s.clearedCols) for (let r = 0; r < SIZE; r++) hot.add(idx(r, c));
    return { shape, row, col, hot };
    // g.rows muda a cada jogada, junto com `ui`.
  }, [active?.slot, active?.target?.row, active?.target?.col, ui, g]);

  const hintShape = hint && ui.slots[hint.slot] != null ? shapeOf(ui.slots[hint.slot]!) : null;
  const floatShape = drag && ui.slots[drag.slot] != null ? shapeOf(ui.slots[drag.slot]!) : null;
  const cellPx = svgRef.current ? svgRef.current.getBoundingClientRect().width / SIZE : 40;

  return (
    <div className="bk-play" role="application" aria-label="Partida do Block Classic">
      <BlockDefs />
      <header className="bk-top">
        <button type="button" className="bk-iconbtn" aria-label="Sair da partida" data-sfx="back" onClick={() => setAsking(true)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <span className="mono bk-mode">BLOCK CLASSIC</span>
        <MuteButton />
      </header>

      <section className="bk-hud" aria-label="Placar">
        <div className="bk-score">
          <span className="mono bk-label">PONTOS</span>
          <b key={ui.score} className={ui.score > 0 ? 'bump' : undefined} aria-live="off">
            {shown}
          </b>
        </div>
        <div className="bk-side">
          {ui.streak >= 2 && (
            <span key={ui.streak} className="bk-combo mono">
              COMBO x{Math.min(ui.streak, 6)}
            </span>
          )}
          <span className="mono bk-label">RECORDE</span>
          <b className="bk-best">{Math.max(best, ui.score)}</b>
        </div>
      </section>

      <div className="bk-boardwrap">
        <div className={`bk-board${ui.over ? ' over' : ''}`} ref={boardRef}>
          <svg className="bk-grid" viewBox={`0 0 ${SIZE} ${SIZE}`} ref={svgRef} role="img" aria-label="Tabuleiro 8 por 8">
            {Array.from({ length: SIZE * SIZE }, (_, i) => (
              <rect
                key={i}
                className={`bk-empty${(Math.floor(i / SIZE) + (i % SIZE)) % 2 ? ' alt' : ''}`}
                x={(i % SIZE) + 0.06}
                y={Math.floor(i / SIZE) + 0.06}
                width="0.88"
                height="0.88"
                rx="0.14"
              />
            ))}
            {ui.cells.map((color, i) =>
              color ? (
                <g
                  key={i}
                  className={ui.over ? 'bk-fall' : fresh.includes(i) ? 'bk-pop' : undefined}
                  style={ui.over ? { animationDelay: `${(Math.floor(i / SIZE) + (i % SIZE)) * 45}ms` } : undefined}
                >
                  <Cell color={color} row={Math.floor(i / SIZE)} col={i % SIZE} />
                </g>
              ) : null,
            )}
            {fresh.map((i) => (
              <rect
                key={`l${i}`}
                className="bk-land"
                x={(i % SIZE) + 0.05}
                y={Math.floor(i / SIZE) + 0.05}
                width="0.9"
                height="0.9"
                rx="0.17"
                fill="#ffffff"
              />
            ))}
            {preview &&
              [...preview.hot].map((i) => (
                <rect
                  key={`h${i}`}
                  className="bk-hot"
                  x={(i % SIZE) + 0.06}
                  y={Math.floor(i / SIZE) + 0.06}
                  width="0.88"
                  height="0.88"
                  rx="0.14"
                  fill={BLOCK_HEX[preview.shape.color]}
                />
              ))}
            {preview && (
              <g className="bk-ghost" key={`${preview.row}-${preview.col}`}>
                {preview.shape.cells.map(([r, c]) => (
                  <Cell key={`${r}-${c}`} color={preview.shape.color} row={preview.row + r} col={preview.col + c} />
                ))}
              </g>
            )}
            {hint && hintShape && (
              <g className="bk-hint">
                {hintShape.cells.map(([r, c]) => (
                  <rect
                    key={`${r}-${c}`}
                    x={hint.col + c + 0.1}
                    y={hint.row + r + 0.1}
                    width="0.8"
                    height="0.8"
                    rx="0.16"
                    fill={BLOCK_HEX[hintShape.color]}
                    stroke="#111111"
                    strokeWidth="0.09"
                    strokeDasharray="0.22 0.16"
                  />
                ))}
              </g>
            )}
          </svg>
          <div className="bk-fx" aria-hidden="true">
            {bursts.map((b) => [
              ...b.rows.map((r) => (
                <i key={`${b.key}-r${r}`} className="bk-sweep row" style={{ top: `${r * (100 / SIZE)}%` }} />
              )),
              ...b.cols.map((c) => (
                <i key={`${b.key}-c${c}`} className="bk-sweep col" style={{ left: `${c * (100 / SIZE)}%` }} />
              )),
              ...(b.big ? [<i key={`${b.key}-f`} className="bk-flashfx" />] : []),
              ...b.cells.map((cell) => (
                <i
                  key={`${b.key}-${cell.idx}`}
                  className="bk-burst"
                  style={
                    {
                      left: `${(cell.idx % SIZE) * (100 / SIZE)}%`,
                      top: `${Math.floor(cell.idx / SIZE) * (100 / SIZE)}%`,
                      '--c': BLOCK_HEX[cell.color],
                      '--d': `${cell.delay}ms`,
                      '--a': `${((cell.idx * 53) % 70) - 35}px`,
                      '--b': `${((cell.idx * 29) % 60) - 40}px`,
                      '--r': `${((cell.idx * 41) % 160) - 80}deg`,
                    } as CSSProperties
                  }
                >
                  <u />
                  <s />
                  <s />
                  <s />
                </i>
              )),
            ])}
            {pops.map((p) => (
              <span key={p.key} className={`bk-pts mono${p.big ? ' big' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                {p.text}
              </span>
            ))}
          </div>
          {ui.over && (
            <div className="bk-over" role="status">
              <b>SEM ESPAÇO</b>
              <span className="mono">{ui.score} PONTOS</span>
            </div>
          )}
        </div>
        {banner && (
          <div key={banner.key} className="bk-banner" role="status">
            <b>{banner.title}</b>
            {banner.sub && <span className="mono">{banner.sub}</span>}
          </div>
        )}
        {praise && (
          <div key={praise.key} className={`bk-praise ${praise.kind}`} role="status" aria-label={praise.kind === 'perfect' ? 'Perfeito' : 'Joinha'}>
            {praise.kind === 'perfect' ? <PerfectStamp width={300} /> : <ThumbSeal size={104} />}
          </div>
        )}
        {note && (
          <div className="bk-note mono" role="status">
            {note}
          </div>
        )}
      </div>

      <section className="bk-tray" aria-label="Peças">
        {ui.slots.map((id, slot) => {
          const shape = id === null ? null : shapeOf(id);
          const dragging = drag?.slot === slot;
          const picked = kb?.slot === slot;
          const hinted = hint?.slot === slot;
          return (
            <div
              key={`${ui.sets}-${slot}`}
              className={`bk-slot${shape ? '' : ' empty'}${dragging ? ' lifted' : ''}${picked ? ' picked' : ''}${hinted ? ' hinted' : ''}${returning === slot ? ' back' : ''}`}
              style={{ '--i': slot } as CSSProperties}
              role="button"
              tabIndex={shape ? 0 : -1}
              aria-label={shape ? `Peça ${slot + 1}` : `Peça ${slot + 1} já usada`}
              onPointerDown={(e) => startDrag(e, slot)}
            >
              {shape && <PieceArt shape={shape} unit={Math.max(12, Math.min(26, cellPx * 0.52))} />}
            </div>
          );
        })}
      </section>

      <footer className="bk-foot">
        <button
          type="button"
          className="bk-hintbtn"
          disabled={ui.hints <= 0 || ui.over}
          data-sfx="select"
          onClick={askHint}
          aria-label={`Dica, ${ui.hints} restantes`}
        >
          <Bulb />
          <span>DICA</span>
          <span className="bk-seals" aria-hidden="true">
            {Array.from({ length: HINTS_PER_GAME }, (_, n) => (
              <HintSeal key={n} full={n < ui.hints} size={20} />
            ))}
          </span>
        </button>
        <p className="mono bk-tip">ARRASTE AS PEÇAS PARA O TABULEIRO</p>
      </footer>

      {drag && floatShape && (
        <div className="bk-float" ref={floatRef} aria-hidden="true">
          <div className={`bk-float-in${drag.target ? '' : ' off'}`}>
            <PieceArt shape={floatShape} unit={cellPx} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={asking}
        title="Sair da partida?"
        text="A partida em andamento não vale para o ranking nem para o histórico."
        confirmLabel="Sair"
        confirmSfx="back"
        cancelLabel="Continuar jogando"
        onConfirm={() => {
          setAsking(false);
          endedRef.current = true;
          onQuit();
        }}
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}
