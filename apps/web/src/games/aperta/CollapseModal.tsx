import { SEAL_DUST_PER_TOUCH, formatNumber, type SaveState } from '@nocap/games';
import { useEffect, useRef, useState } from 'react';
import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';
import { RequirementBars } from './Requirements';
import { collapseCards, collapseView, modalGuarded, type VaultCardView } from './game-logic';
import { useDialog } from './useDialog';
import './collapse.css';

interface Props {
  state: SaveState;
  onCancel: () => void;
  /** `null` = Selo Estelar (todos os proibidos já estão no nível 5). */
  onConfirm: (choice: string | null) => void;
}

const levelText = (c: VaultCardView) => (c.level === 0 ? `novo, nível ${c.nextLevel}` : `nível ${c.level} para ${c.nextLevel}`);

/**
 * Colapso em 2 passos (spec 040, seção 3). Passo 1: escolher um de até 3 proibidos do Cofre (ou receber o Selo
 * Estelar, se não sobra nenhum). Passo 2: ver o que fica, o que sai e as Cintilas, e confirmar.
 */
export function CollapseModal({ state, onCancel, onConfirm }: Props) {
  const root = useRef<HTMLDivElement>(null);
  useDialog(root, onCancel);
  const openedAt = useRef(performance.now());
  const [step, setStep] = useState<1 | 2>(1);
  const cards = collapseCards(state);
  const seal = cards.length === 0;
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => {
    apertaSfx.flip();
  }, []);
  const goStep = (to: 1 | 2) => {
    apertaSfx.page();
    setStep(to);
  };

  const view = collapseView(state);
  const chosen = cards.find((c) => c.id === choice);
  const canContinue = seal || choice !== null;
  // Spec 4.7: o dedo que abriu o modal ainda pode estar descendo.
  const guarded = () => modalGuarded(openedAt.current, performance.now());

  return (
    <div className="ap-modal-game">
      <div
        ref={root}
        className="ap-mcard-game ap-collapse"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-collapse-title"
        tabIndex={-1}
      >
        <h2 id="ap-collapse-title">{step === 1 ? `A estrela está pronta (colapso ${view.next})` : 'Colapsar a estrela?'}</h2>
        <p className="ap-collapse-step" aria-live="polite">
          Passo {step} de 2
        </p>

        {step === 1 ? (
          <>
            <RequirementBars view={view} />
            {seal ? (
              <p className="ap-sub">
                Todos os proibidos do Cofre estão no nível 5. Este colapso dá um Selo Estelar: +{SEAL_DUST_PER_TOUCH} de poeira em cada toque, para sempre.
              </p>
            ) : (
              <>
                <p className="ap-sub">
                  {state.collapses === 0
                    ? 'Este é o Cofre dos Proibidos: a cada colapso você guarda um grimório proibido, que vale em todas as vidas. Cada um dá um bônus enorme e cobra um preço. Escolha um dos três.'
                    : 'Escolha um proibido para o Cofre. Um que você já tem sobe 1 nível; no nível 5 ganha um selo.'}
                </p>
                <ul className="ap-cc-list" aria-label="Proibidos do Cofre">
                  {cards.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`ap-cc ap-cc-vault${choice === c.id ? ' is-selected' : ''}`}
                        aria-pressed={choice === c.id}
                        onClick={() => {
                          if (guarded()) return;
                          apertaSfx.clack(3);
                          apertaVibrate(8);
                          setChoice(c.id);
                        }}
                      >
                        <span className="ap-cc-txt">
                          <b>{c.name}</b>
                          <small className="ap-cc-lv">{levelText(c)}</small>
                          <span className="ap-cc-fx">{c.bonus}</span>
                          <span className="ap-cc-price">{c.price}</span>
                          {c.seal && <span className="ap-cc-seal">Selo: {c.seal}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="ap-cc-actions">
              <button type="button" className="ap-hbtn ap-hbtn-ghost" onClick={onCancel}>
                Agora não
              </button>
              <button type="button" className="ap-hbtn" disabled={!canContinue} onClick={() => !guarded() && goStep(2)}>
                Continuar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="ap-cc-gain">
              <b>+{view.sparks}</b> {view.sparks === 1 ? 'Cintila' : 'Cintilas'}
            </p>
            <p className="ap-sub">
              {seal ? (
                <>
                  Selo Estelar: <b>+{SEAL_DUST_PER_TOUCH} de poeira por toque</b>.
                </>
              ) : (
                <>
                  Cofre: <b>{chosen?.name ?? ''}</b>, {chosen ? levelText(chosen) : ''}.
                </>
              )}
            </p>
            <div className="ap-cc-cols">
              <section aria-labelledby="ap-cc-keep">
                <h3 id="ap-cc-keep">Fica</h3>
                <ul>
                  <li>Álbum de grimórios</li>
                  <li>Conquistas</li>
                  <li>Cofre dos Proibidos</li>
                  <li>Árvore de Habilidades e Cintilas</li>
                </ul>
              </section>
              <section aria-labelledby="ap-cc-lose">
                <h3 id="ap-cc-lose">Sai</h3>
                <ul>
                  <li>Poeira ({formatNumber(state.run.dust)})</li>
                  <li>Melhorias</li>
                  <li>Grimórios ativos da vida</li>
                  <li>Energia e combo</li>
                </ul>
              </section>
            </div>
            <div className="ap-cc-actions">
              <button type="button" className="ap-hbtn ap-hbtn-ghost" onClick={() => goStep(1)}>
                Voltar
              </button>
              <button
                type="button"
                className="ap-hbtn ap-hbtn-go"
                onClick={() => {
                  if (!guarded() && canContinue) onConfirm(seal ? null : choice);
                }}
              >
                Colapsar a estrela
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
