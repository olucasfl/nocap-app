import { CHOICE_LOCK_SEC, GRIMOIRES, GRIMOIRE_RARITIES, rarityRank, type GrimoireRarity, type PendingChoice } from '@nocap/games';
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
  /** Maior raridade que a vida já tem de cada grimório (0 comum a 3 lendário): a carta mais rara evolui o grimório. */
  buildRarity?: Record<string, number>;
  paused: boolean;
  onSelect: (id: string) => void;
  onConfirm: (id: string) => void;
  /** Betelgeuse e Sonda Voyager: troca uma carta por outra. */
  onReroll?: (id: string) => void;
  /** Trocas que ainda restam (da oferta, a grátis da árvore e a cota da vida). Sem isto vale `pending.rerollsLeft`. */
  rerollsAvailable?: number;
  /** Segunda chance (árvore): descartes que restam e a ação de descartar a oferta inteira. */
  discardsLeft?: number;
  onDiscard?: () => void;
  /** Escolha sugerida (nó da Automação): a carta destacada, e `gainPct` quando o nó "Sugestão com motivo" existe. */
  suggestion?: { id: string; gainPct: number | null } | null;
  /** Pity de lendário (árvore): ofertas que faltam para o lendário garantido; `null` sem o nó. */
  pityLeft?: number | null;
  /** O efeito de cada carta com os números da vida (id -> texto). */
  gain?: Record<string, string>;
  /** Dica do tutorial na 1ª escolha: fica acima das cartas, dentro do modal. */
  coach?: ReactNode;
}

/**
 * Escolha de 1 entre 3 grimórios (spec 038, 3.6 e 4.7), versão provisória da etapa 4: cartas
 * simples. Cartas bloqueadas por 1,6 s e escolha em dois passos (marcar, depois confirmar).
 */
/** "Sinal forte: x2 -> x3" vira o nome do ganho e dois valores com seta; vários ganhos vêm separados por " · ". */
function GainLine({ label, text }: { label: string; text: string }) {
  return (
    <span className="ap-pick-gain">
      <small>{label}</small>
      {text.split(' · ').map((part) => {
        const m = /^(.*?): (.+?) -> (.+)$/.exec(part);
        if (!m) return <span key={part}>{part}</span>;
        return (
          <span key={part} className="ap-gain-row">
            <span className="ap-gain-name">{m[1]}</span>
            <span className="ap-gain-vals">
              <i>{m[2]}</i>
              <svg viewBox="0 0 24 12" width="18" height="9" aria-hidden="true">
                <path d="M1 6h19M15 1l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <b>{m[3]}</b>
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function ChoiceModal({ pending, lockRemaining, build, buildRarity = {}, paused, onSelect, onConfirm, onReroll, rerollsAvailable, discardsLeft = 0, onDiscard, pityLeft = null, suggestion = null, gain, coach }: Props) {
  const rerolls = rerollsAvailable ?? pending.rerollsLeft;
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
        {pityLeft !== null && (
          <p className="ap-pity" role="status">
            {pityLeft === 0 ? 'Esta oferta traz um lendário garantido.' : `Lendário garantido em ${pityLeft} ${pityLeft === 1 ? 'oferta' : 'ofertas'}.`}
          </p>
        )}
        <div className={`ap-picks${pending.offers.length > 3 ? ' is-four' : ''}`}>
          {pending.offers.map((id) => {
            const def = GRIMOIRES.find((g) => g.id === id);
            if (!def) return null;
            const offered: GrimoireRarity = pending.rarities?.[id] ?? 'common';
            const rarity = artRarity(offered);
            const have = build[id] ?? 0;
            // Raridade maior que a do livro: o grimório evolui (ex.: Raro -> Lendário).
            const fromRank = buildRarity[id] ?? 0;
            const evolves = have > 0 && rarityRank(offered) > fromRank;
            const fromRarity = artRarity(GRIMOIRE_RARITIES[fromRank] ?? 'common');
            const isSelected = selected === id;
            return (
              <div key={id} className="ap-pickcell">
              <button
                type="button"
                className={`ap-pick${isSelected ? ' is-selected' : ''}${rarity === 'proibido' ? ' is-forbidden' : ''}${suggestion?.id === id ? ' is-suggested' : ''}`}
                aria-pressed={isSelected}
                disabled={locked}
                onClick={() => {
                  if (!guarded()) onSelect(id);
                }}
              >
                <span className="ap-pick-rar" data-rar={rarity}>
                  {RARITY_LABEL[rarity]}
                </span>
                <span className="ap-pick-seals">
                {evolves && (
                  <span className="ap-pick-evo" data-from={fromRarity} data-to={rarity} aria-label={`Evolui de ${RARITY_LABEL[fromRarity]} para ${RARITY_LABEL[rarity]}`}>
                    <b>{RARITY_LABEL[fromRarity]}</b>
                    <svg viewBox="0 0 24 12" width="22" height="11" aria-hidden="true">
                      <path d="M1 6h19M15 1l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <b className="is-next">{RARITY_LABEL[rarity]}</b>
                  </span>
                )}
                <span className="ap-pick-lvl" aria-label={have > 0 ? `Nível ${have} para o nível ${have + 1}` : 'Grimório novo, nível 1'}>
                  {have > 0 ? (
                    <>
                      <b>NVL {have}</b>
                      <svg viewBox="0 0 24 12" width="22" height="11" aria-hidden="true">
                        <path d="M1 6h19M15 1l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <b className="is-next">NVL {have + 1}</b>
                    </>
                  ) : (
                    <b className="is-next">NOVO · NVL 1</b>
                  )}
                </span>
                </span>
                <span className="ap-pick-art">
                  <GrimoireBook rarity={rarity} astro={astroFor(id, def.family)} name={def.name} size="sm" still />
                </span>
                {suggestion?.id === id && (
                  <span className="ap-pick-sug">
                    Sugerida{suggestion.gainPct !== null ? `: +${Math.max(1, Math.round(suggestion.gainPct))}% de ganho` : ''}
                  </span>
                )}
                <span className="ap-pick-name">{def.name}</span>
                <CategoryTag category={def.category} compact />
                <span className="ap-pick-info" data-cat={def.category}>
                  <span className="ap-pick-fx">{def.text}</span>
                  {gain?.[id] ? (
                    <GainLine label={evolves ? 'Vai evoluir' : have > 0 ? 'Vai subir' : 'Você ganha'} text={gain[id]!} />
                  ) : (
                    have > 0 && <GainLine label={evolves ? 'Vai evoluir' : 'Vai subir'} text="O efeito fica mais forte neste nível" />
                  )}
                </span>
              </button>
              {onReroll && rerolls > 0 && (
                <button type="button" className="ap-reroll" disabled={locked} onClick={() => !guarded() && onReroll(id)}>
                  Trocar esta carta
                </button>
              )}
              </div>
            );
          })}
        </div>
        {rerolls > 0 && <p className="ap-sub">Trocas disponíveis: {rerolls}.</p>}
        {onDiscard && discardsLeft > 0 && (
          <button type="button" className="ap-reroll ap-discard" disabled={locked} onClick={() => !guarded() && onDiscard()}>
            Descartar a oferta ({discardsLeft})
          </button>
        )}
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
