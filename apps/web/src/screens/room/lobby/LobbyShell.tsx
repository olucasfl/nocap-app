import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Crown, Lock } from '@/components/icons';
import type { RoomSnapshot } from '@/lib/rooms';
import { useRoom } from '@/lib/rooms';
import { MIN_PLAYERS, rulesSummary } from './rules';
import './lobby.css';

export type LobbyTab = 'members' | 'rules' | 'invite';

const TABS: { id: LobbyTab; label: string }[] = [
  { id: 'members', label: 'Membros' },
  { id: 'rules', label: 'Regras' },
  { id: 'invite', label: 'Convidar' },
];

/** Vagas e o que falta para começar: fica no topo, em todas as abas. */
function Status({ snapshot }: { snapshot: RoomSnapshot }) {
  const free = snapshot.maxPlayers - snapshot.members.length;
  const connected = snapshot.members.filter((m) => m.connected);
  const needed = MIN_PLAYERS[snapshot.game];
  const waiting = connected.filter((m) => !m.isHost && !m.ready && !m.committed).length;
  const missing =
    connected.length < needed
      ? `FALTAM ${needed - connected.length} PESSOA${needed - connected.length > 1 ? 'S' : ''}`
      : waiting > 0
        ? `FALTAM ${waiting} MARCAR PRONTO`
        : 'TUDO PRONTO PARA COMEÇAR';
  return (
    <div className="lb-stat mono">
      <b>
        {snapshot.members.length}/{snapshot.maxPlayers} NA SALA
      </b>
      <span>{free > 0 ? `${free} ${free === 1 ? 'VAGA' : 'VAGAS'}` : 'SALA CHEIA'}</span>
      <span className={missing.startsWith('TUDO') ? 'ok' : ''}>{missing}</span>
    </div>
  );
}

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
        <Status snapshot={snapshot} />
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
  panels: Record<LobbyTab, ReactNode>;
  footer: ReactNode;
}) {
  const message = useRoom((s) => s.message);
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
        {panels[tab]}
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
