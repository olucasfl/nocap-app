import { Lock } from '@/components/icons';
import { sendRoom, type RoomSnapshot } from '@/lib/rooms';
import { modeOf, rulesFor, type RuleValue } from './rules';

function Options({
  label,
  values,
  current,
  format,
  onPick,
}: {
  label: string;
  values: RuleValue[];
  current: RuleValue;
  format: (v: RuleValue) => string;
  onPick: (v: RuleValue) => void;
}) {
  return (
    <div className="rm-opt">
      <div className="mono rm-label">{label}</div>
      <div className="rm-seg" role="radiogroup" aria-label={label}>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={current === v}
            onClick={() => onPick(v)}
          >
            {format(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** O que o modo escolhido faz, em uma frase (vale para o líder e para os membros). */
function ModeNote({ snapshot }: { snapshot: RoomSnapshot }) {
  const mode = modeOf(snapshot);
  if (!mode) return null;
  return (
    <p className="lb-modenote">
      <b>{mode.label}</b>
      <span>{mode.note}</span>
    </p>
  );
}

/** Visão do líder: tudo editável, e as mudanças valem na hora para todos. */
export function RulesEditor({ snapshot }: { snapshot: RoomSnapshot }) {
  return (
    <div className="lb-rules">
      <p className="lb-hint mono">
        Só você altera as regras. Quem está na sala vê a mudança na hora.
      </p>
      <ModeNote snapshot={snapshot} />
      {rulesFor(snapshot).map((r) => (
        <div key={r.id}>
          <Options
            label={r.label}
            values={r.values}
            current={r.current}
            format={r.format}
            onPick={(v) => sendRoom('configure', r.patch(v))}
          />
          {r.note && <p className="mono rm-mode-note">{r.note}</p>}
        </div>
      ))}
    </div>
  );
}

/** Visão do membro: as mesmas regras, só para ler. Nada aqui é clicável. */
export function RulesReadOnly({
  snapshot,
  leaderName,
}: {
  snapshot: RoomSnapshot;
  leaderName: string;
}) {
  return (
    <div className="lb-rules">
      <p className="lb-locked">
        <Lock size={18} />
        <span>
          Só o líder (<b>@{leaderName}</b>) pode mudar as regras. Elas mudam aqui sozinhas.
        </span>
      </p>
      <ModeNote snapshot={snapshot} />
      <dl className="lb-readonly">
        {rulesFor(snapshot).map((r) => (
          <div key={r.id}>
            <dt className="mono">{r.label}</dt>
            <dd>{r.format(r.current)}</dd>
            {r.note && <p className="mono rm-mode-note">{r.note}</p>}
          </div>
        ))}
      </dl>
    </div>
  );
}
