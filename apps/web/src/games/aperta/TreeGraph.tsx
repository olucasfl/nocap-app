import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { LOW_END } from './perf';
import { computeTreeLayout, neighbor } from './tree-layout';
import type { TreeNodeRow } from './tree-logic';

/** Os dois níveis de zoom: visão geral e de perto (spec 040, 6.1). */
export const ZOOM_LEVELS = [0.55, 1.1] as const;
export const NODE_R = 15;
/** Quanto o dedo ou o mouse anda antes de a gente tratar como arrastar (e não como toque no nó). */
const DRAG_PX = 6;

interface View {
  x: number;
  y: number;
  level: 0 | 1;
}

interface Props {
  rows: Map<string, TreeNodeRow>;
  selected: string | null;
  onSelect: (id: string) => void;
  /** Ramo em destaque ("all" = todos): os outros ficam esmaecidos em `opacity`. */
  filter: string;
  /** Chamado na primeira vez que a pessoa arrasta (some a dica "arraste para explorar"). */
  onFirstDrag?: () => void;
}

const STATUS_LABEL: Record<TreeNodeRow['status'], string> = {
  owned: 'comprado',
  buyable: 'dá para comprar',
  short: 'falta Cintila',
  blocked: 'bloqueado',
  closed: 'fechado até o 1º colapso',
  soon: 'chega em breve',
};

export function nodeAriaLabel(n: TreeNodeRow): string {
  const lv = n.maxLevel > 1 ? `, nível ${n.level} de ${n.maxLevel}` : '';
  const why =
    n.status === 'blocked'
      ? `. Compre antes: ${n.needs.join(', ')}`
      : n.status === 'short'
        ? `. Falta ${n.missing} ${n.missing === 1 ? 'Cintila' : 'Cintilas'}`
        : n.status === 'soon'
          ? `. ${n.soonHint ?? 'Chega em breve'}`
          : n.status === 'buyable'
            ? `. Custa ${n.cost} ${n.cost === 1 ? 'Cintila' : 'Cintilas'}`
            : '';
  return `${n.name}, ${n.branchName}, tier ${n.tier}${lv}, ${STATUS_LABEL[n.status]}${why}`;
}

/**
 * O grafo da árvore em SVG: raiz no centro, 5 ramos, nós como estrelas ligadas por linhas. Mover e dar zoom é só
 * `transform` no grupo do conteúdo (arrasto por pointer events, direto no DOM enquanto o dedo anda). Cada nó é um botão
 * (role="button", foco por setas). Tudo que muda de cor ou some é `opacity`.
 */
export function TreeGraph({ rows, selected, onSelect, filter, onFirstDrag }: Props) {
  const layout = useMemo(() => computeTreeLayout(), []);
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<SVGGElement>(null);
  const [size, setSize] = useState({ w: 360, h: 420 });
  const [view, setView] = useState<View>({ x: 0, y: 0, level: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [active, setActive] = useState<string>(() => selected ?? 'root');
  const nodeEls = useRef(new Map<string, SVGGElement>());
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const k = ZOOM_LEVELS[view.level];
  const css = (v: View): string => `translate(${size.w / 2 + v.x}px, ${size.h / 2 + v.y}px) scale(${ZOOM_LEVELS[v.level]})`;

  const zoom = useCallback((level: 0 | 1) => {
    setView((v) => {
      if (v.level === level) return v;
      const ratio = ZOOM_LEVELS[level] / ZOOM_LEVELS[v.level];
      return { level, x: v.x * ratio, y: v.y * ratio };
    });
  }, []);

  const centerOn = useCallback((id: string | null) => {
    setView((v) => {
      const n = id && id !== 'root' ? layout.nodes[id] : null;
      const kk = ZOOM_LEVELS[v.level];
      return { level: v.level, x: n ? -n.x * kk : 0, y: n ? -n.y * kk : 0 };
    });
  }, [layout]);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: viewRef.current.x, oy: viewRef.current.y, moved: false };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_PX) return;
      d.moved = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* aparelho sem captura: o arrasto segue só dentro da área */
      }
      onFirstDrag?.();
    }
    const next = { ...viewRef.current, x: d.ox + dx, y: d.oy + dy };
    // Direto no DOM enquanto o dedo anda: nada de renderizar 120 nós a cada movimento.
    if (content.current) content.current.style.transform = css(next);
    viewRef.current = next;
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.moved) {
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      setView({ ...viewRef.current });
    }
  };

  const pick = (id: string) => {
    if (suppressClick.current) return;
    setActive(id);
    onSelect(id);
  };

  const focusNode = (id: string) => {
    setActive(id);
    nodeEls.current.get(id)?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key] as 'up' | 'down' | 'left' | 'right' | undefined;
    if (dir) {
      e.preventDefault();
      const next = neighbor(layout, active, dir);
      if (next) {
        focusNode(next);
        // Mantém o nó focado perto do centro: o teclado nunca perde o nó fora da área.
        centerOn(next);
      }
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoom(1);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoom(0);
    } else if (e.key === '0' || e.key === 'Home') {
      e.preventDefault();
      centerOn(null);
    }
  };

  const dim = (branch: string): boolean => filter !== 'all' && branch !== filter;
  const edgeState = (from: string, to: string): string => {
    const a = (rows.get(from)?.owned ?? from === 'root') ? 1 : 0;
    const b = rows.get(to)?.owned ? 1 : 0;
    return a && b ? 'is-lit' : a ? 'is-open' : '';
  };

  const roots = [...rows.values()].filter((n) => n.parents.length === 0);

  return (
    <div className={`ap-tg${LOW_END ? ' is-lite' : ''}`}>
      <div
        ref={box}
        className="ap-tg-stage"
        role="group"
        aria-label="Árvore de Habilidades. Arraste para mover; setas andam entre os nós; mais e menos dão zoom."
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <svg className="ap-tg-svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden={false} focusable="false">
          <g ref={content} className="ap-tg-content" style={{ transform: css(view) }}>
            <g className="ap-tg-edges" aria-hidden="true">
              {roots.map((n) => {
                const to = layout.nodes[n.id]!;
                return (
                  <line
                    key={`root-${n.id}`}
                    className={`ap-tg-edge ${edgeState('root', n.id)}${dim(n.branch) ? ' is-dim' : ''}`}
                    x1={0}
                    y1={0}
                    x2={to.x}
                    y2={to.y}
                  />
                );
              })}
              {layout.edges.map((e) => {
                const a = layout.nodes[e.from]!;
                const b = layout.nodes[e.to]!;
                const row = rows.get(e.to)!;
                return (
                  <line
                    key={`${e.from}-${e.to}`}
                    className={`ap-tg-edge ${edgeState(e.from, e.to)}${e.cross ? ' is-cross' : ''}${dim(row.branch) && dim(rows.get(e.from)!.branch) ? ' is-dim' : ''}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                  />
                );
              })}
            </g>
            <g className="ap-tg-root" aria-hidden="true">
              <circle r={26} />
              <circle r={9} className="ap-tg-root-core" />
            </g>
            {[...rows.values()].map((n) => {
              const p = layout.nodes[n.id]!;
              const isSel = selected === n.id;
              return (
                <g
                  key={n.id}
                  ref={(el) => {
                    if (el) nodeEls.current.set(n.id, el);
                    else nodeEls.current.delete(n.id);
                  }}
                  className={`ap-tg-node is-${n.status}${n.owned ? ' has-level' : ''}${isSel ? ' is-selected' : ''}${dim(n.branch) ? ' is-dim' : ''}`}
                  transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
                  role="button"
                  tabIndex={active === n.id ? 0 : -1}
                  aria-label={nodeAriaLabel(n)}
                  aria-pressed={isSel}
                  onFocus={() => setActive(n.id)}
                  onClick={() => pick(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      pick(n.id);
                    }
                  }}
                >
                  <circle className="ap-tg-hit" r={NODE_R + 9} />
                  <circle className="ap-tg-halo" r={NODE_R + 4} />
                  <circle className="ap-tg-core" r={NODE_R} />
                  {n.status === 'soon' || n.status === 'closed' ? (
                    <path className="ap-tg-lock" d="M-4 -1v-3a4 4 0 0 1 8 0v3M-6 -1h12v8h-12z" />
                  ) : n.maxLevel > 1 ? (
                    <text className="ap-tg-pips" y={4} textAnchor="middle">
                      {n.level}/{n.maxLevel}
                    </text>
                  ) : (
                    <circle className="ap-tg-dot" r={4} />
                  )}
                  {isSel && (
                    <text className="ap-tg-name" y={NODE_R + 18} textAnchor="middle">
                      {n.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        <div className="ap-tg-tools" role="group" aria-label="Zoom e centralizar">
          <button type="button" className="ap-tg-btn" aria-label="Aproximar" disabled={view.level === 1} onClick={() => zoom(1)}>
            +
          </button>
          <button type="button" className="ap-tg-btn" aria-label="Afastar" disabled={view.level === 0} onClick={() => zoom(0)}>
            −
          </button>
          <button type="button" className="ap-tg-btn ap-tg-center" onClick={() => centerOn(selected)}>
            Centralizar
          </button>
        </div>
      </div>
      <span className="ap-tg-zoomlabel" aria-live="polite">
        Zoom {k < 1 ? 'visão geral' : 'de perto'}
      </span>
    </div>
  );
}
