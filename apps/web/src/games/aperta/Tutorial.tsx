import { GRIMOIRES } from '@nocap/games';
import { useEffect, useRef, useState } from 'react';
import { GrimoireBook } from './GrimoireBook';
import { artRarity, astroFor, modalGuarded } from './game-logic';
import { RARITY_LABEL } from './rarity';
import {
  arrowSide,
  arrowX,
  cardSide,
  padRect,
  veilPieces,
  type Rect,
  type TutorialView,
} from './tutorial-logic';
import './tutorial.css';

/** Folga entre o alvo e a borda do spotlight. */
const PAD = 6;
/** Metade da largura da etiqueta "Toque aqui", para a seta não sair da tela. */
const ARROW_HALF = 56;
const MEASURE_MS = 120;

interface Geo {
  hole: Rect | null;
  w: number;
  h: number;
  /** Quanto do alto e do pé da tela o cartão cobre (a seta se afasta dele). */
  topBlock: number;
  bottomBlock: number;
}

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h);

interface Props {
  view: TutorialView;
  onSkip: () => void;
  onFinish: () => void;
}

/**
 * Tutorial guiado (spec 038, 4.6): véu escuro com um buraco no alvo, anel que pulsa em `opacity`,
 * seta "Toque aqui" e o cartão de coach. O véu é feito de quatro faixas ao redor do buraco: tudo fora do
 * alvo recebe o toque e não faz nada. Cliques e Enter/Espaço em botões de fora também são barrados.
 */
export function TutorialOverlay({ view, onSkip, onFinish }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo>({ hole: null, w: 0, h: 0, topBlock: 0, bottomBlock: 0 });
  const selector = `[data-tut="${view.target}"]`;

  useEffect(() => {
    const measure = () => {
      const el = root.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const target = document.querySelector<HTMLElement>(selector);
      let hole: Rect | null = null;
      if (target) {
        const r = target.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          hole = padRect({ x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height }, PAD, { w: box.width, h: box.height });
        }
      }
      const cardBox = el.querySelector('.ap-tut-card')?.getBoundingClientRect();
      const onTop = !cardBox || cardBox.top - box.top < box.height / 2;
      const topBlock = cardBox && onTop ? Math.round(cardBox.bottom - box.top) : 0;
      const bottomBlock = cardBox && !onTop ? Math.round(box.bottom - cardBox.top) : 0;
      setGeo((prev) =>
        prev.w === box.width && prev.h === box.height && prev.topBlock === topBlock && prev.bottomBlock === bottomBlock && sameRect(prev.hole, hole)
          ? prev
          : { hole, w: box.width, h: box.height, topBlock, bottomBlock },
      );
    };
    measure();
    const id = window.setInterval(measure, MEASURE_MS);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
    };
  }, [selector]);

  // Foco no alvo quando ele é um botão: quem usa teclado ou leitor de tela cai no lugar certo.
  useEffect(() => {
    const target = document.querySelector<HTMLElement>(selector);
    if (target && target.matches('button')) target.focus({ preventScroll: true });
  }, [selector]);

  useEffect(() => {
    const allowed = (t: EventTarget | null) => t instanceof Element && (!!t.closest(selector) || !!t.closest('.ap-tut-card'));
    const stop = (e: Event) => {
      if (allowed(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const t = e.target;
      if (t instanceof Element && t.closest('button, a, [role="button"]') && !allowed(t)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('click', stop, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('click', stop, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [selector]);

  const { hole, w, h, topBlock, bottomBlock } = geo;
  const side = cardSide(hole, h);
  const showArrow = view.arrow && hole !== null;
  const aSide = hole ? arrowSide(hole, h, topBlock, bottomBlock) : 'above';

  return (
    <div ref={root} className="ap-tut" data-target={view.target}>
      {veilPieces(hole, { w, h }).map((p, i) => (
        <div key={i} className="ap-tut-veil" style={{ left: p.x, top: p.y, width: p.w, height: p.h }} />
      ))}
      {hole && (
        <div className="ap-tut-ring" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} aria-hidden="true">
          <i className="ap-tut-glow" />
        </div>
      )}
      {showArrow && hole && (
        <div
          className={`ap-tut-arrowpos is-${aSide}`}
          style={{ left: arrowX(hole, w, ARROW_HALF), top: aSide === 'above' ? hole.y - 4 : hole.y + hole.h + 4 }}
          aria-hidden="true"
        >
          <div className="ap-tut-arrow">
            <b>Toque aqui</b>
            <svg viewBox="0 0 24 24" focusable="false">
              <path d={aSide === 'above' ? 'M12 20 3 8h18z' : 'M12 4 3 16h18z'} />
            </svg>
          </div>
        </div>
      )}
      <section className={`ap-tut-card is-${side}`} aria-label="Tutorial">
        <p className="ap-tut-count">
          Tutorial · passo {view.step} de {view.total}
        </p>
        <div aria-live="polite">
          <h2>{view.title}</h2>
          <p>{view.text}</p>
        </div>
        <div className="ap-tut-actions">
          {view.finish && (
            <button type="button" className="ap-btn ap-tut-go" onClick={onFinish}>
              Começar a jogar
            </button>
          )}
          <button type="button" className="ap-tut-skip" onClick={onSkip}>
            Pular tutorial
          </button>
        </div>
      </section>
    </div>
  );
}

const MOON = GRIMOIRES.find((g) => g.id === 'moon');

/** Passo 2: o livro da Lua com a explicação e "Entendi" (o toque acidental dos primeiros 300 ms não conta). */
export function FirstGrimoireModal({ onDone }: { onDone: () => void }) {
  const openedAt = useRef(performance.now());
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    okRef.current?.focus({ preventScroll: true });
  }, []);
  if (!MOON) return null;
  const rarity = artRarity(MOON.rarity);
  return (
    <div className="ap-modal-game">
      <div className="ap-mcard-game ap-first" role="dialog" aria-labelledby="ap-first-title" tabIndex={-1}>
        <h2 id="ap-first-title">Primeiro grimório</h2>
        <div className="ap-first-book">
          <GrimoireBook rarity={rarity} astro={astroFor(MOON.id, MOON.family)} name={MOON.name} size="md" />
        </div>
        <p className="ap-first-name">
          <b>{MOON.name}</b>
          <small>{RARITY_LABEL[rarity]}</small>
        </p>
        <p className="ap-sub">{MOON.text}</p>
        <p className="ap-sub">Grimórios dão poderes enquanto a vida durar. A cada vez que a energia enche, você escolhe um novo.</p>
        <button
          ref={okRef}
          type="button"
          className="ap-btn"
          data-tut="ok"
          onClick={() => {
            if (!modalGuarded(openedAt.current, performance.now())) onDone();
          }}
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
