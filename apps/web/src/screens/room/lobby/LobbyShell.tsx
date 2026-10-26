import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { RoomSnapshot } from '@/lib/rooms';
import { useRoom } from '@/lib/rooms';
import { MIN_PLAYERS, rulesSummary } from './rules';
import './lobby.css';

export type LobbyTab = 'members' | 'rules' | 'invite';

/** Uma linha só com o que falta para começar. */
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

/**
 * A moldura do lobby (spec 045, segunda versão): uma barra com o código e o estado, três abas (Jogadores, Regras,
 * Convidar), cada uma só com o seu assunto, e uma barra de ação fixa embaixo com UMA ação principal. No computador a
 * aba Jogadores fica sempre à esquerda e Regras e Convidar dividem o painel da direita.
 */
export function LobbyShell({
  snapshot,
  me,
  members,
  rules,
  invite,
  footer,
}: {
  snapshot: RoomSnapshot;
  me: string | undefined;
  members: (goInvite: () => void) => ReactNode;
  rules: ReactNode;
  invite: ReactNode;
  footer: ReactNode;
}) {
  const message = useRoom((s) => s.message);
  const [tab, setTab] = useState<LobbyTab>('members');
  const uid = useId();
  const hint = startHint(snapshot);
  const meIsLeader = snapshot.hostId === me;
  const tabs: { id: LobbyTab; label: string; count?: string }[] = [
    {
      id: 'members',
      label: 'Jogadores',
      count: `${snapshot.members.length}/${snapshot.maxPlayers}`,
    },
    { id: 'rules', label: 'Regras' },
    { id: 'invite', label: 'Convidar' },
  ];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === tab);
    const next =
      e.key === 'ArrowRight'
        ? tabs[(i + 1) % tabs.length]
        : e.key === 'ArrowLeft'
          ? tabs[(i + tabs.length - 1) % tabs.length]
          : null;
    if (!next) return;
    e.preventDefault();
    setTab(next.id);
    document.getElementById(`${uid}-tab-${next.id}`)?.focus();
  };

  return (
    <section className="screen rm lb3" data-tab={tab}>
      <header className="lb3-bar">
        <div className="lb3-bar-code">
          <span className="mono">SALA</span>
          <b>{snapshot.code}</b>
        </div>
        <div className="lb3-bar-info">
          <span className="lb3-bar-rules mono">{rulesSummary(snapshot)}</span>
          <span className={`lb3-bar-hint mono${hint.ok ? ' ok' : ''}`}>{hint.text}</span>
        </div>
        <span className="lb3-role mono">{meIsLeader ? 'Você é o líder' : 'Convidado'}</span>
      </header>

      <div className="lb3-tabs" role="tablist" aria-label="Seções da sala" onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${uid}-tab-${t.id}`}
            type="button"
            role="tab"
            data-sfx="tab"
            data-tab={t.id}
            aria-selected={tab === t.id || (tab === 'members' && t.id === 'rules' && false)}
            aria-controls={`${uid}-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count && <small className="mono">{t.count}</small>}
          </button>
        ))}
      </div>

      <div className="lb3-body">
        <div
          id={`${uid}-panel-members`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-members`}
          className={`lb3-pane pane-members${tab === 'members' ? ' on' : ''}`}
        >
          {members(() => setTab('invite'))}
        </div>
        <div className="lb3-side">
          <div
            id={`${uid}-panel-rules`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-rules`}
            className={`lb3-pane pane-rules${tab === 'rules' ? ' on' : ''}`}
          >
            <h2 className="lb3-h">Regras</h2>
            {rules}
          </div>
          <div
            id={`${uid}-panel-invite`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-invite`}
            className={`lb3-pane pane-invite${tab === 'invite' ? ' on' : ''}`}
          >
            <h2 className="lb3-h">Convidar</h2>
            {invite}
          </div>
        </div>
      </div>

      {message && (
        <p className="acc-failure mono" role="alert">
          {message}
        </p>
      )}

      <div className="lb3-foot">{footer}</div>
    </section>
  );
}
