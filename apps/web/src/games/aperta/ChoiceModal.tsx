import { CHOICE_LOCK_SEC, GRIMOIRES, type PendingChoice } from '@nocap/games';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { GrimoireBook } from './GrimoireBook';
import { artRarity, astroFor, modalGuarded } from './game-logic';
import { CategoryTag } from './CategoryTag';
import { RARITY_LABEL } from './rarity';
import { useDialog } from './useDialog';

interface Props {
  pending: PendingChoice;
  /** Segundos que faltam para as cartas destravarem (0 = livres). */
  lockRemaining: number;
  /** Nível atual de cada grimório da vida, para "sobe para o nível N". */
  build: Record<string, number>;
  paused: boolean;
  onSelect: (id: string) => void;
  onConfirm: (id: string) => void;
  /** Betelgeuse e Sonda Voyager: troca uma carta por outra. */
  onReroll?: (id: string) => void;
  /** Observatório Gaia: o efeito de cada carta com os números da vida (id -> texto). */
  gain?: Record<string, string>;
  /** Dica do tutorial na 1ª escolha: fica acima das cartas, dentro do modal. */
  coach?: ReactNode;
}

/**
 * Escolha de 1 entre 3 grimórios (spec 038, 3.6 e 4.7), versão provisória da etapa 4: cartas
 * simples. Cartas bloqueadas por 1,6 s e escolha em dois passos (marcar, depois confirmar).
 */
export function ChoiceModal({ pending, lockRemaining, build, paused, onSelect, onConfirm, onReroll, gain, coach }: Props) {
  const root = useRef<HTMLDivElement>(null);
  // Esc não fecha: a barra cheia obriga a escolher, e o toque acidental não pode escapar dela.
  useDialog(root, () => {});
  useEffect(() => {
    // Com as cartas travadas não há nada focável: o foco vai para o próprio diálogo.
    if (root.current && !root.current.contains(document.activeElement)) root.current.focus();
  }, []);

  // A barra continua de onde a contagem estava, mesmo se a tela for montada no meio do bloqueio.
  const elapsed = useRef(Math.max(0, CHOICE_LOCK_SEC - lockRemaining));
  const locked = lockRemaining > 0;
  const lockStyle: CSSProperties = {
    animationDuration: `${CHOICE_LOCK_SEC}s`,
    animationDelay: `-${elapsed.current.toFixed(2)}s`,
    animationPlayState: paused ? 'paused' : 'running',
  };

  // Spec 4.7: o dedo que abriu o modal ainda pode estar descendo, então os primeiros 300 ms não contam.
  const openedAt = useRef(performance.now());
  const guarded = () => modalGuarded(openedAt.current, performance.now());
  const selected = pending.selected;
  return (
    <div className="ap-modal-game">
      <div
        ref={root}
        className="ap-mcard-game"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-choice-title"
        tabIndex={-1}
      >
        <h2 id="ap-choice-title">A energia transbordou</h2>
        {coach}
        <p className="ap-sub ap-modal-intro">
          {pending.picksLeft > 1
            ? `Escolha ${pending.picksLeft} grimórios, um de cada vez. Toque para marcar e confirme em seguida.`
            : 'Escolha um grimório. Toque para marcar e confirme em seguida.'}
        </p>
        <div className="ap-lockrow" role="status">
          {locked ? (
            <>
              <small>Aguarde um instante...</small>
              <span className="ap-lockbar" aria-hidden="true">
                <i style={lockStyle} />
              </span>
            </>
          ) : (
            <small>Escolha uma carta</small>
          )}
        </div>
        <div className="ap-picks">
          {pending.offers.map((id) => {
            const def = GRIMOIRES.find((g) => g.id === id);
            if (!def) return null;
            const rarity = artRarity(def.rarity);
            const have = build[id] ?? 0;
            const isSelected = selected === id;
            return (
              <div key={id} className="ap-pickcell">
              <button
                type="button"
                className={`ap-pick${isSelected ? ' is-selected' : ''}${rarity === 'proibido' ? ' is-forbidden' : ''}`}
                aria-pressed={isSelected}
                disabled={locked}
                onClick={() => {
                  if (!guarded()) onSelect(id);
                }}
              >
                <GrimoireBook rarity={rarity} astro={astroFor(id, def.family)} name={def.name} size="sm" still />
                <span className="ap-pick-name">{def.name}</span>
                <span className="ap-pick-rar">{RARITY_LABEL[rarity]}</span>
                <CategoryTag category={def.category} />
                <span className="ap-pick-fx">{def.text}</span>
                {gain?.[id] && <span className="ap-pick-gain">{gain[id]}</span>}
                {have > 0 && <span className="ap-pick-lv">Você tem nível {have}: sobe para o {have + 1}</span>}
              </button>
              {onReroll && pending.rerollsLeft > 0 && (
                <button type="button" className="ap-reroll" disabled={locked} onClick={() => !guarded() && onReroll(id)}>
                  Trocar esta carta
                </button>
              )}
              </div>
            );
          })}
        </div>
        <p className="ap-sub">Pegar o mesmo de novo sobe o nível dele.</p>
        <button
          type="button"
          className="ap-btn"
          disabled={locked || selected === null}
          onClick={() => selected && !guarded() && onConfirm(selected)}
        >
          {pending.picksLeft > 1 ? `Escolher este grimório (faltam ${pending.picksLeft})` : 'Escolher este grimório'}
        </button>
      </div>
    </div>
  );
}
