import { useState, type ReactNode } from 'react';
import { Crown, Lock } from '@/components/icons';
import type { RoomSnapshot } from '@/lib/rooms';
import { useRoom, at } from '@/lib/rooms';
import { InvitePanel } from './InvitePanel';
import { MIN_PLAYERS, rulesSummary } from './rules';
import './lobby.css';

/** Uma linha só com o que falta para começar (antes eram cinco avisos espalhados). */
export function startHint(snapshot: RoomSnapshot): { text: string; ok: boolean } {
  const connected = snapshot.members.filter((m) => m.connected);
  const needed = MIN_PLAYERS[snapshot.game];
  if (connected.length < needed) {
    const n = needed - connected.length;
    return {
      text: `Falta${n > 1 ? 'm' : ''} ${n} pessoa${n > 1 ? 's' : ''} para começar`,
      ok: false,
    };
  }
  const waiting = connected.filter((m) => !m.isHost && !m.ready && !m.committed).length;
  if (waiting > 0)
    return { text: `Falta${waiting > 1 ? 'm' : ''} ${waiting} marcar "pronto"`, ok: false };
  return { text: 'Todo mundo pronto', ok: true };
}

/** O cabeçalho da sala: o código grande, convidar com um toque e quem manda aqui. */
function Head({
  snapshot,
  role,
  leaderName,
}: {
  snapshot: RoomSnapshot;
  role: 'leader' | 'member';
  leaderName?: string;
}) {
  const hint = startHint(snapshot);
  return (
    <div className="lb-code">
      <div className="lb-code-main">
        <div className="mono rm-label">CÓDIGO DA SALA</div>
        <b>{snapshot.code}</b>
        <div className="mono lb-summary">{rulesSummary(snapshot)}</div>
        <div className="mono lb-stat2">
          <span>
            {snapshot.members.length}/{snapshot.maxPlayers} na sala
          </span>
          <span className={hint.ok ? 'ok' : ''}>{hint.text}</span>
        </div>
        <div className={`lb-role-chip ${role}`}>
          {role === 'leader' ? <Crown size={16} /> : <Lock size={16} />}
          <span>{role === 'leader' ? 'Você é o líder' : `Líder: ${at(leaderName)}`}</span>
        </div>
      </div>
      <InvitePanel snapshot={snapshot} section="quick" />
    </div>
  );
}

/** Um bloco que abre e fecha: o resumo fica sempre à vista e o detalhe só quando a pessoa quer. */
function Fold({
  title,
  summary,
  action,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: string;
  action: [string, string];
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`lb-fold${open ? ' open' : ''}`}>
      <div className="lb-fold-head">
        <div>
          <div className="mono rm-label">{title}</div>
          {summary && <div className="lb-fold-sum">{summary}</div>}
        </div>
        <button
          type="button"
          className="fr-btn"
          data-sfx="tab"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? action[1] : action[0]}
        </button>
      </div>
      {open && <div className="lb-fold-body">{children}</div>}
    </section>
  );
}

/**
 * A moldura comum das duas visões do lobby (líder e membro) (spec 045): código e convite no topo, jogadores num bloco,
 * regras e "mais formas de convidar" recolhidas, e a ação principal no rodapé. Sem abas: no desktop vira duas colunas.
 */
export function LobbyShell({
  snapshot,
  role,
  leaderName = '',
  members,
  rules,
  footer,
}: {
  snapshot: RoomSnapshot;
  role: 'leader' | 'member';
  leaderName?: string;
  members: ReactNode;
  rules: ReactNode;
  footer: ReactNode;
}) {
  const message = useRoom((s) => s.message);
  const alone = snapshot.members.length < 2;
  return (
    <section className="screen rm lb">
      <Head snapshot={snapshot} role={role} leaderName={leaderName} />

      <div className="lb-cols">
        <div className="lb-col">
          <section className="lb-card" aria-label="Jogadores">
            {members}
          </section>
        </div>
        <div className="lb-col">
          <Fold
            title="REGRAS"
            summary={rulesSummary(snapshot)}
            action={[role === 'leader' ? 'Mudar' : 'Ver', 'Fechar']}
          >
            {rules}
          </Fold>
          <Fold
            title="MAIS FORMAS DE CONVIDAR"
            summary="Procurar pessoa ou chamar amigos do NoCap"
            action={['Abrir', 'Fechar']}
            defaultOpen={alone && role === 'leader'}
          >
            <InvitePanel snapshot={snapshot} section="more" />
          </Fold>

          {message && (
            <p className="acc-failure mono" role="alert">
              {message}
            </p>
          )}

          <div className="stack lb-foot">{footer}</div>
        </div>
      </div>
    </section>
  );
}
