import { formatNumber, type SaveState } from '@nocap/games';
import { useEffect, useRef, useState } from 'react';
import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';
import { AstroMedal } from './AstroMedal';
import { RequirementBars } from './Requirements';
import { atlasView, collapseCandidates, collapseView, modalGuarded, needsReplacement } from './game-logic';
import { useDialog } from './useDialog';
import './collapse.css';

interface Props {
  state: SaveState;
  onCancel: () => void;
  onConfirm: (pageId: string, replaceIndex?: number) => void;
}

/**
 * Colapso em 2 passos (spec 038, 8.1). Passo 1: escolher o grimório que vira página do Atlas (e, com o
 * Atlas cheio, qual página sai). Passo 2: ver o que fica, o que sai e os Fragmentos, e confirmar.
 */
export function CollapseModal({ state, onCancel, onConfirm }: Props) {
  const root = useRef<HTMLDivElement>(null);
  useDialog(root, onCancel);
  const openedAt = useRef(performance.now());
  const [step, setStep] = useState<1 | 2>(1);
  const [pageId, setPageId] = useState<string | null>(null);
  const [replace, setReplace] = useState<number | null>(null);
  // Abrir o modal soa como virar a página do Atlas; o passo 2 repete, mais baixo, ao mudar de passo.
  useEffect(() => {
    apertaSfx.flip();
  }, []);
  const goStep = (to: 1 | 2) => {
    apertaSfx.page();
    setStep(to);
  };

  const candidates = collapseCandidates(state);
  const view = collapseView(state);
  const atlas = atlasView(state);
  const full = needsReplacement(state, pageId);
  const chosen = candidates.find((c) => c.id === pageId);
  const canContinue = pageId !== null && (!full || replace !== null);
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
            <p className="ap-sub">
              Escolha um grimório desta vida para guardar como página no Atlas Eterno. Ele fica a 60% do poder em todas as vidas.
            </p>
            <ul className="ap-cc-list" aria-label="Grimórios desta vida">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`ap-cc${pageId === c.id ? ' is-selected' : ''}`}
                    aria-pressed={pageId === c.id}
                    onClick={() => {
                      if (guarded()) return;
                      apertaSfx.clack(3);
                      apertaVibrate(8);
                      setPageId(c.id);
                      setReplace(null);
                    }}
                  >
                    <span className="ap-cc-medal">
                      <AstroMedal astro={c.astro} />
                    </span>
                    <span className="ap-cc-txt">
                      <b>{c.name}</b>
                      <small>
                        {c.familyName} · nível {c.level}
                        {c.inAtlas ? ' · já está no Atlas' : ''}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {full && (
              <div className="ap-cc-replace">
                <p className="ap-sub">O Atlas está cheio. Escolha a página que sai para dar lugar a esta.</p>
                <ul className="ap-cc-pages" aria-label="Página que sai do Atlas">
                  {atlas.pages.map((p, i) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`ap-cc-page${replace === i ? ' is-selected' : ''}`}
                        aria-pressed={replace === i}
                        onClick={() => {
                          if (guarded()) return;
                          apertaSfx.clack(1);
                          setReplace(i);
                        }}
                      >
                        <b>{p.name}</b>
                        <small>nível {p.level}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
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
              <b>+{view.fragments}</b> Fragmentos
            </p>
            <p className="ap-sub">
              Página guardada: <b>{chosen?.name ?? ''}</b>
              {full && replace !== null && atlas.pages[replace] ? `, no lugar de ${atlas.pages[replace].name}` : ''}.
            </p>
            <div className="ap-cc-cols">
              <section aria-labelledby="ap-cc-keep">
                <h3 id="ap-cc-keep">Fica</h3>
                <ul>
                  <li>Álbum de grimórios</li>
                  <li>Conquistas</li>
                  <li>Atlas Eterno ({atlas.slots} espaços)</li>
                  <li>Árvore de Habilidades e Fragmentos</li>
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
                  if (!guarded() && pageId) onConfirm(pageId, full && replace !== null ? replace : undefined);
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
