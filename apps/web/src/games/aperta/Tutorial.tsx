import { useEffect, useRef, useState } from 'react';
import { arrowSide, arrowX, padRect, type CoachView, type Rect } from './tutorial-logic';
import './tutorial.css';

/** Folga entre o alvo e o anel. */
const PAD = 6;
/** Metade da largura da etiqueta da seta, para ela não sair da tela. */
const ARROW_HALF = 110;
const MEASURE_MS = 150;

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
  view: CoachView;
  /** "Entendi" dos cartões do jogo livre. */
  onDismiss: () => void;
  onSkip: () => void;
  /** Mostra "Pular tutorial" no cartão (o botão do topo cobre o resto do tempo). */
  skipInCard: boolean;
}

/**
 * Dica do tutorial (spec 038, 4.6): um anel dourado em volta do alvo, que pulsa só em `opacity`, uma etiqueta com
 * seta e, quando há o que explicar, um cartão pequeno. Nada escurece a tela nem trava toque: o jogador age no
 * próprio alvo e o tutorial reage. O botão do cartão é discreto de propósito, para nunca pesar mais que o alvo.
 */
export function TutorialCoach({ view, onDismiss, onSkip, skipInCard }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo>({ hole: null, w: 0, h: 0, topBlock: 0, bottomBlock: 0 });
  const selector = view.target ? `[data-tut="${view.target}"]` : null;

  useEffect(() => {
    const measure = () => {
      const el = root.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const target = selector ? document.querySelector<HTMLElement>(selector) : null;
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
  }, [selector, view.key]);

  const { hole, w, h, topBlock, bottomBlock } = geo;
  const showArrow = view.label !== null && hole !== null;
  const aSide = hole ? arrowSide(hole, h, topBlock, bottomBlock) : 'above';
  const hasCard = view.title !== null;

  return (
    <div ref={root} className="ap-tut" data-target={view.target ?? 'none'}>
      {hole && (
        <div key={`ring-${view.key}`} className="ap-tut-ring" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} aria-hidden="true">
          <i className="ap-tut-glow" />
        </div>
      )}
      {showArrow && hole && (
        <div
          key={`arrow-${view.key}`}
          className={`ap-tut-arrowpos is-${aSide}`}
          style={{ left: arrowX(hole, w, ARROW_HALF), top: aSide === 'above' ? hole.y - 4 : hole.y + hole.h + 4 }}
          // Sem cartão, a etiqueta é a única explicação: o leitor de tela a lê.
          {...(hasCard ? { 'aria-hidden': true } : { role: 'status' })}
        >
          <div className="ap-tut-arrow">
            <b>{view.label}</b>
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path d={aSide === 'above' ? 'M12 20 3 8h18z' : 'M12 4 3 16h18z'} />
            </svg>
          </div>
        </div>
      )}
      {hasCard && !view.inline && (
        <section key={view.key} className={`ap-tut-card is-${view.place}`} aria-label="Dica do tutorial">
          <CoachBody view={view} onDismiss={onDismiss} onSkip={onSkip} showSkip={skipInCard} />
        </section>
      )}
    </div>
  );
}

function CoachBody({ view, onDismiss, onSkip, showSkip }: { view: CoachView; onDismiss: () => void; onSkip: () => void; showSkip: boolean }) {
  return (
    <>
      <div aria-live="polite">
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
