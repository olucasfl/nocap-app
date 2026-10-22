import { FORBIDDEN_MAX_LEVEL, SEAL_DUST_PER_TOUCH, type SaveState } from '@nocap/games';
import { RequirementBars } from './Requirements';
import { collapseView, vaultSlots } from './game-logic';
import './collapse.css';

interface Props {
  state: SaveState;
  /** Abre o modal de colapso (só com a estrela pronta). */
  onCollapse: () => void;
}

/** Cofre dos Proibidos (spec 040, seção 3): 10 casas com o nível de cada um, os selos e o botão de colapsar. */
export function VaultPage({ state, onCollapse }: Props) {
  const slots = vaultSlots(state);
  const collapse = collapseView(state);
  const owned = slots.filter((s) => s.owned).length;
  return (
    <div className="ap-vault">
      <p className="ap-sub">
        {owned} de {slots.length} proibidos no Cofre. Cada colapso guarda um, ou sobe o nível de um que você já tem, até o 5.
        {state.seals > 0 ? ` Selos Estelares: ${state.seals} (+${state.seals * SEAL_DUST_PER_TOUCH} de poeira por toque).` : ''}
      </p>
      <ul className="ap-vault-slots" aria-label="Proibidos do Cofre">
        {slots.map((s) => (
          <li key={s.id} className={s.owned ? 'is-full' : 'is-empty'}>
            <b>{s.owned ? s.name : '???'}</b>
            {s.owned ? (
              <>
                <span className="ap-vault-dots" role="img" aria-label={`Nível ${s.level} de ${FORBIDDEN_MAX_LEVEL}`}>
                  {Array.from({ length: FORBIDDEN_MAX_LEVEL }, (_, i) => (
                    <i key={i} className={i < s.level ? 'on' : undefined} />
                  ))}
                </span>
                <span className="ap-vault-fx">{s.text}</span>
                <span className="ap-vault-price">{s.price}</span>
                {s.seal && <span className="ap-vault-seal">Selo: {s.seal}</span>}
              </>
            ) : (
              <small>Ainda no escuro. Aparece numa oferta de colapso.</small>
            )}
          </li>
        ))}
      </ul>

      <div className="ap-collapse-box">
        <h4 className="ap-vault-sub">Colapsar a estrela (colapso {collapse.next})</h4>
        <RequirementBars view={collapse} />
        {collapse.ready ? (
          <p className="ap-sub">A estrela está pronta. Ao colapsar você {collapse.sparks > 0 ? `ganha ${collapse.sparks} ${collapse.sparks === 1 ? 'Cintila' : 'Cintilas'} e ` : ''}guarda um proibido no Cofre e começa uma vida nova.</p>
        ) : (
          <p className="ap-sub">{collapse.hint}</p>
        )}
        <button type="button" className="ap-hbtn ap-hbtn-go" disabled={!collapse.ready} onClick={onCollapse}>
          {collapse.ready ? 'Colapsar a estrela' : 'Estrela ainda não está pronta'}
        </button>
      </div>
    </div>
  );
}
