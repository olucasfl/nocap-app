import { apertaSfx } from '@/lib/aperta-audio';
import { useEffect, useRef, useState } from 'react';
import { localRect } from './ap-geometry';
import {
  arrowBox,
  arrowPlacement,
  arrowX,
  inflate,
  padRect,
  placeCard,
  type CoachView,
  type Rect,
} from './tutorial-logic';
import './tutorial.css';

/** Folga entre o alvo e o anel. */
const PAD = 6;
/** Metade da largura da etiqueta da seta, para ela não sair da tela. */
const ARROW_HALF = 110;
const MEASURE_MS = 100;

interface Geo {
  /** O alvo que o jogador toca: só ele e os `pass` ficam livres do bloqueio. */
  hole: Rect | null;
  /** Algo só para olhar (contador de poeira, barra de energia). */
  glow: Rect | null;
  /** Botões que nunca ficam bloqueados (Sair, Pular tutorial). */
  pass: Rect[];
  /** Onde o jogo não deve ser coberto pelo cartão (botão central, dock). */
  keep: Rect[];
  w: number;
  h: number;
  card: { x: number; y: number; w: number; h: number } | null;
}

const EMPTY: Geo = { hole: null, glow: null, pass: [], keep: [], w: 0, h: 0, card: null };

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h);
const sameRects = (a: Rect[], b: Rect[]) =>
  a.length === b.length && a.every((r, i) => sameRect(r, b[i]!));
const sameGeo = (a: Geo, b: Geo) =>
  a.w === b.w &&
  a.h === b.h &&
  sameRect(a.hole, b.hole) &&
  sameRect(a.glow, b.glow) &&
  sameRects(a.pass, b.pass) &&
  sameRects(a.keep, b.keep) &&
  sameRect(a.card, b.card);

const ARROW_PATH = {
  above: 'M12 20 3 8h18z',
  below: 'M12 4 3 16h18z',
  left: 'M20 12 8 3v18z',
  right: 'M4 12 16 3v18z',
} as const;

function arrowStyle(r: Rect, side: 'above' | 'below' | 'left' | 'right', w: number) {
  if (side === 'left') return { left: r.x - 4, top: r.y + r.h / 2 };
  if (side === 'right') return { left: r.x + r.w + 4, top: r.y + r.h / 2 };
  return { left: arrowX(r, w, ARROW_HALF), top: side === 'above' ? r.y - 4 : r.y + r.h + 4 };
}

/** Retângulo com cantos redondos como trecho de caminho SVG. */
function roundedPath(r: Rect, radius: number): string {
  const rad = Math.min(radius, r.w / 2, r.h / 2);
  const { x, y, w, h } = r;
  return `M${x + rad} ${y}H${x + w - rad}Q${x + w} ${y} ${x + w} ${y + rad}V${y + h - rad}Q${x + w} ${y + h} ${x + w - rad} ${y + h}H${x + rad}Q${x} ${y + h} ${x} ${y + h - rad}V${y + rad}Q${x} ${y} ${x + rad} ${y}Z`;
}

interface Props {
  view: CoachView;
  /** "Entendi" dos cartões do jogo livre. */
  onDismiss: () => void;
  onSkip: () => void;
  /** Mostra "Pular tutorial" no cartão (o botão do topo cobre o resto do tempo). */
  skipInCard: boolean;
}

/**
 * Dica do tutorial (spec 038, 4.6; versão premium na spec 042, adendo): a tela escurece com um buraco iluminado no
 * alvo, e só ele (mais Sair e Pular) responde ao toque; tocar fora balança o anel e toca um aviso. Tem anel com ondas,
 * mão que toca, seta, cartão com o passo e o texto. Falha aberta: se o alvo não aparece (ou ainda não foi medido),
 * nada escurece nem bloqueia. Só `transform` e `opacity` animam; posições são recalculadas, nunca animadas.
 */
export function TutorialCoach({ view, onDismiss, onSkip, skipInCard }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo>(EMPTY);
  const [nudge, setNudge] = useState(0);
  const selector = view.target ? `[data-tut="${view.target}"]` : null;
  const glowSelector = view.glow ? `[data-tut="${view.glow}"]` : null;

  // Um som curto quando a dica muda (não ao montar): o jogador percebe que apareceu algo novo.
  const lastKey = useRef(view.key);
  useEffect(() => {
    if (lastKey.current !== view.key) {
      lastKey.current = view.key;
      apertaSfx.flip();
    }
  }, [view.key]);

  useEffect(() => {
    const measure = () => {
      const el = root.current;
      if (!el) return;
      const box = localRect(el);
      const rel = (e: Element): Rect | null => {
        const r = localRect(e);
        return r.width > 0 && r.height > 0
          ? { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height }
          : null;
      };
      const bounds = { w: box.width, h: box.height };
      const find = (sel: string | null, pad: number): Rect | null => {
        const t = sel ? document.querySelector(sel) : null;
        const r = t ? rel(t) : null;
        return r ? padRect(r, pad, bounds) : null;
      };
      const hole = find(selector, PAD);
      const glow = find(glowSelector, PAD);
      const pass = [...document.querySelectorAll('[data-tut-pass]')].flatMap((e) => {
        const r = rel(e);
        return r ? [padRect(r, 2, bounds)] : [];
      });
      const keep = [
        ...document.querySelectorAll('[data-tut="press"], [data-tut^="dock-"]'),
      ].flatMap((e) => {
        const r = rel(e);
        return r ? [r] : [];
      });
      const cardEl = el.querySelector<HTMLElement>('.ap-tut-card');
      let card: Geo['card'] = null;
      if (cardEl) {
        // Medido sem o deslocamento: o cartão tem o tamanho do conteúdo, a posição é calculada aqui.
        const cw = cardEl.offsetWidth;
        const ch = cardEl.offsetHeight;
        const arrowTarget = view.arrowOn === 'glow' ? glow : hole;
        const avoid: Rect[] = [];
        for (const r of [hole, glow]) if (r) avoid.push(inflate(r, 8));
        for (const r of keep) avoid.push(r);
        for (const r of pass) avoid.push(r);
        if (arrowTarget && view.label)
          avoid.push(
            inflate(arrowBox(arrowTarget, bounds, arrowPlacement(arrowTarget, bounds)), 8),
          );
        // O cartão também não cobre a linha da lista onde está o alvo (página de Melhorias).
        const row = selector ? document.querySelector(selector)?.closest('li, article') : null;
        const rowRect = row ? rel(row) : null;
        if (rowRect) avoid.push(rowRect);
        const lowTarget = !!hole && hole.y + hole.h / 2 > bounds.h * 0.5;
        const anchor = {
          x: (bounds.w - cw) / 2,
          y: lowTarget ? Math.min(96, bounds.h * 0.28) : bounds.h - ch - 10,
        };
        const pos = placeCard({ w: cw, h: ch }, bounds, avoid, anchor, 14, 8);
        card = { x: pos.x, y: pos.y, w: cw, h: ch };
      }
      const next: Geo = { hole, glow, pass, keep, w: box.width, h: box.height, card };
      setGeo((prev) => (sameGeo(prev, next) ? prev : next));
    };
    measure();
    const id = window.setInterval(measure, MEASURE_MS);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
    };
  }, [selector, glowSelector, view.key, view.arrowOn, view.label, view.target]);

  const { hole, glow, pass, w, h, card } = geo;
  const lit = [hole, glow, ...pass].filter((r): r is Rect => r !== null);
  // Escurecer e bloquear só vale com o alvo medido (falha aberta) e com o toque no alvo como saída.
  const blocking = view.target !== null && hole !== null && w > 0;
  const dimmed = (blocking || (glow !== null && w > 0)) && w > 0;
  const arrowRect = view.arrowOn === 'glow' ? glow : hole;
  const showArrow = view.label !== null && arrowRect !== null;
  const aSide = arrowRect ? arrowPlacement(arrowRect, { w, h }) : 'above';
  const hasCard = view.title !== null;
  const blockPath = blocking
    ? `path(evenodd, "M0 0H${w}V${h}H0Z ${[hole!, ...pass].map((r) => `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`).join(' ')}")`
    : undefined;

  return (
    <div
      ref={root}
      className="ap-tut"
      data-target={view.target ?? 'none'}
      data-blocking={blocking ? 'true' : 'false'}
    >
      {dimmed && (
        <svg key={`dim-${view.key}`} className="ap-tut-dim" width={w} height={h} aria-hidden="true">
          <path
            fillRule="evenodd"
            d={`M0 0H${w}V${h}H0Z ${lit.map((r) => roundedPath(r, 16)).join(' ')}`}
          />
        </svg>
      )}
      {blocking && (
        <div
          className="ap-tut-block"
          style={{ clipPath: blockPath }}
          onPointerDown={(e) => {
            e.preventDefault();
            setNudge((n) => n + 1);
            apertaSfx.boing();
          }}
          aria-hidden="true"
        />
      )}
      {glow && (
        <div
          key={`glow-${view.key}`}
          className="ap-tut-ring is-glow"
          style={{ left: glow.x, top: glow.y, width: glow.w, height: glow.h }}
          aria-hidden="true"
        >
          <i className="ap-tut-glow" />
        </div>
      )}
      {hole && (
        <div
          key={`ring-${view.key}-${nudge}`}
          className={`ap-tut-ring${nudge > 0 ? ' is-nudge' : ''}`}
          style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }}
          aria-hidden="true"
        >
          <i className="ap-tut-glow" />
          <i className="ap-tut-ripple" />
          <i className="ap-tut-ripple is-late" />
        </div>
      )}
      {hole && (
        <div
          key={`hand-${view.key}`}
          className="ap-tut-hand"
          style={{
            left: hole.x + hole.w * (hole.w > 140 ? 0.62 : 0.8),
            top: hole.y + hole.h * (hole.h > 140 ? 0.64 : 0.62),
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 40 44" focusable="false">
            <path
              d="M14 4c2 0 4 1.6 4 4v14l2-1c2-1 4 0 4.6 1.6l1.4-.6c2-.8 4 .2 4.6 2l.4 1c2-.6 4 .6 4.4 2.6.8 4 .4 8-1.4 11.6L32 40c-.8 1.6-2.4 2.6-4.2 2.6H20c-2 0-3.6-1-4.6-2.6L8 28.6c-1-1.8-.4-3.8 1.2-4.8 1-.6 2.2-.6 3.2-.2L12 24V8c0-2.4 .8-4 2-4Z"
              fill="#fff"
              stroke="#02030a"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
      {showArrow && arrowRect && (
        <div
          key={`arrow-${view.key}-${nudge}`}
          className={`ap-tut-arrowpos is-${aSide}`}
          style={arrowStyle(arrowRect, aSide, w)}
          // Sem cartão, a etiqueta é a única explicação: o leitor de tela a lê.
          {...(hasCard ? { 'aria-hidden': true } : { role: 'status' })}
        >
          <div className="ap-tut-arrow">
            <b>{view.label}</b>
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path d={ARROW_PATH[aSide]} />
            </svg>
          </div>
        </div>
      )}
      {hasCard && !view.inline && (
        <section
          key={view.key}
          className={`ap-tut-card${card ? '' : ' is-measuring'}`}
          style={card ? { left: card.x, top: card.y } : undefined}
          aria-label="Dica do tutorial"
        >
          <CoachBody view={view} onDismiss={onDismiss} onSkip={onSkip} showSkip={skipInCard} />
        </section>
      )}
    </div>
  );
}

function CoachBody({
  view,
  onDismiss,
  onSkip,
  showSkip,
}: {
  view: CoachView;
  onDismiss: () => void;
  onSkip: () => void;
  showSkip: boolean;
}) {
  return (
    <>
      <div aria-live="polite">
        {view.step && <span className="ap-tut-step">{view.step}</span>}
        <h2>{view.title}</h2>
        <p>{view.text}</p>
      </div>
      {(view.dismiss || showSkip) && (
        <div className="ap-tut-actions">
          {showSkip && (
            <button type="button" className="ap-tut-skip" onClick={onSkip}>
              Pular tutorial
            </button>
          )}
          {view.dismiss && (
            <button type="button" className="ap-tut-ok" onClick={onDismiss}>
              Entendi
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** A dica da escolha do 1º grimório: vai dentro do modal, acima das cartas, para não cobrir nenhuma. */
export function TutorialInline({ view, onSkip }: { view: CoachView; onSkip: () => void }) {
  return (
    <section className="ap-tut-inline" aria-label="Dica do tutorial">
      <CoachBody view={view} onDismiss={() => {}} onSkip={onSkip} showSkip />
    </section>
  );
}
