import { effectiveStats, skillView, skillsAvailable, type ButtonSkillId, type SaveState } from '@nocap/games';

interface Props {
  state: SaveState;
  now: number;
  onUse: (id: ButtonSkillId) => void;
  onAutoBuy: (patch: { on?: boolean; limit?: number }) => void;
}

/** Ícones de traço (kit do Aperta!, sem emoji), 24x24. */
const ICON: Record<ButtonSkillId, string> = {
  autoclick: 'M6 3l12 8-5.5 1.2L10 18z',
  autopilot: 'M12 3l8 16-8-4-8 4zM12 9v5',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  supernova: 'M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3',
  'time-warp': 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2',
  lens: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l5 5',
  magnet: 'M5 4v7a7 7 0 0 0 14 0V4h-4v7a3 3 0 0 1-6 0V4z',
};

const AUTOBUY_STEP = 10;

/**
 * Barra de habilidades (spec 040, etapa 19): só aparece depois do 1º nó que dá botão. Cada botão tem 44 px ou mais, nome
 * para o leitor de tela, a recarga como uma barra que encolhe por `transform` e um anel que pulsa em `opacity` enquanto
 * a habilidade está ligada. A Compra automática (liga/desliga e limite) fica ao lado, quando o nó existe.
 */
export function SkillBar({ state, now, onUse, onAutoBuy }: Props) {
  const skills = skillsAvailable(state);
  const sk = effectiveStats(state).skills;
  if (skills.length === 0 && !sk.autoBuy.on) return null;
  const used = state.stats.skillUses > 0;
  const ab = state.run.autoBuy;
  return (
    <div className="ap-skillbar" role="group" aria-label="Habilidades">
      {!used && skills.length > 0 && (
        <p className="ap-skill-hint" role="note">
          Nova habilidade: toque no botão para usar
        </p>
      )}
      {skills.map((def) => {
        const v = skillView(state, def.id, now);
        if (!v) return null;
        const label = `${def.name}. ${def.text} ${
          v.activeLeft > 0 ? 'Ligada agora.' : v.ready ? (v.maxCharges > 1 ? `${v.charges} de ${v.maxCharges} cargas.` : 'Pronta.') : `Recarregando, volta em ${Math.ceil(v.cooldownLeft)} segundos.`
        }`;
        return (
          <button
            key={def.id}
            type="button"
            className={`ap-skill${v.ready ? ' is-ready' : ''}${v.activeLeft > 0 ? ' is-active' : ''}`}
            aria-label={label}
            aria-disabled={!v.ready}
            data-skill={def.id}
            onClick={() => v.ready && onUse(def.id)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d={ICON[def.id]} />
            </svg>
            {v.maxCharges > 1 && <b className="ap-skill-n">{v.charges}</b>}
            <i className="ap-skill-cd" aria-hidden="true" style={{ transform: `scaleX(${(1 - v.recharge).toFixed(3)})` }} />
          </button>
        );
      })}
      {sk.autoBuy.on && (
        <div className={`ap-autobuy${ab.on ? ' is-on' : ''}`} role="group" aria-label="Compra automática">
          <button type="button" className="ap-skill ap-autobuy-toggle" aria-pressed={ab.on} aria-label={`Compra automática: ${ab.on ? 'ligada' : 'desligada'}`} onClick={() => onAutoBuy({ on: !ab.on })}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 6h3l2 9h9l2-6H8M10 19h.01M17 19h.01" />
            </svg>
          </button>
          <button type="button" className="ap-autobuy-step" aria-label="Diminuir o limite de preço" onClick={() => onAutoBuy({ limit: ab.limit - AUTOBUY_STEP })}>
            −
          </button>
          <span className="ap-autobuy-limit" aria-label={`Limite: ${ab.limit}% da poeira por compra`}>
            {ab.limit}%
          </span>
          <button type="button" className="ap-autobuy-step" aria-label="Aumentar o limite de preço" onClick={() => onAutoBuy({ limit: ab.limit + AUTOBUY_STEP })}>
            +
          </button>
        </div>
      )}
    </div>
  );
}
