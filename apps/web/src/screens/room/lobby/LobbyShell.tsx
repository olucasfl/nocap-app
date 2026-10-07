import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Crown, Lock } from '@/components/icons';
import type { RoomSnapshot } from '@/lib/rooms';
import { useRoom } from '@/lib/rooms';
import { ChatPanel } from '@/components/Chat';
import { rulesSummary } from './rules';
import './lobby.css';

export type LobbyTab = 'members' | 'rules' | 'invite' | 'chat';

const TABS: { id: LobbyTab; label: string }[] = [
  { id: 'members', label: 'Membros' },
  { id: 'rules', label: 'Regras' },
  { id: 'invite', label: 'Convidar' },
  { id: 'chat', label: 'Chat' },
];

/** O cabeçalho da sala: código, convite e quem manda aqui. */
function Head({
  snapshot,
  role,
  leaderName,
}: {
  snapshot: RoomSnapshot;
  role: 'leader' | 'member';
  leaderName?: string;
}) {
  return (
    <>
      <div className="lb-code">
        <div>
          <div className="mono rm-label">CÓDIGO DA SALA</div>
          <b>{snapshot.code}</b>
          <div className="mono lb-summary">{rulesSummary(snapshot)}</div>
        </div>
      </div>

      <div className={`lb-role ${role}`}>
        {role === 'leader' ? <Crown size={22} /> : <Lock size={22} />}
        <div>
          <b>{role === 'leader' ? 'Você é o líder da sala' : `Líder da sala: @${leaderName}`}</b>
          <span>
            {role === 'leader'
              ? 'Só você muda as regras e começa a partida.'
              : 'Só o líder muda as regras e começa a partida. Você marca quando estiver pronto.'}
          </span>
        </div>
      </div>
    </>
  );
}

/**
 * A moldura comum das duas visões do lobby (líder e membro): cabeçalho, abas e rodapé. O que
 * muda entre as visões vem de fora (painéis e ações).
 */
export function LobbyShell({
  snapshot,
  role,
  leaderName = '',
  initialTab,
  panels,
  footer,
}: {
  snapshot: RoomSnapshot;
  role: 'leader' | 'member';
  leaderName?: string;
  initialTab: LobbyTab;
  panels: Record<Exclude<LobbyTab, 'chat'>, ReactNode>;
  footer: ReactNode;
}) {
  const message = useRoom((s) => s.message);
  const unread = useRoom((s) => s.unread);
  const [tab, setTab] = useState<LobbyTab>(initialTab);
  const uid = useId();

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next =
      e.key === 'ArrowRight'
        ? TABS[(i + 1) % TABS.length]
        : e.key === 'ArrowLeft'
          ? TABS[(i + TABS.length - 1) % TABS.length]
          : null;
    if (!next) return;
    e.preventDefault();
    setTab(next.id);
    document.getElementById(`${uid}-tab-${next.id}`)?.focus();
  };

  return (
    <section className="screen rm lb">
      <Head snapshot={snapshot} role={role} leaderName={leaderName} />

      <div className="lb-tabs" role="tablist" aria-label="Seções da sala" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`${uid}-tab-${t.id}`}
            type="button"
            role="tab"
            data-sfx="tab"
            aria-selected={tab === t.id}
            aria-controls={`${uid}-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'chat' && unread > 0 && tab !== 'chat' && (
              <small>{unread > 9 ? '9+' : unread}</small>
            )}
            {t.id === 'members' && (
              <small>
                {snapshot.members.length}/{snapshot.maxPlayers}
              </small>
            )}
          </button>
        ))}
      </div>

      <div
        id={`${uid}-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${tab}`}
        className="lb-panel"
      >
        {tab === 'chat' ? <ChatPanel snapshot={snapshot} /> : panels[tab]}
      </div>

      {message && (
        <p className="acc-failure mono" role="alert">
          {message}
        </p>
      )}

      <div className="stack lb-foot">{footer}</div>
    </section>
  );
}
