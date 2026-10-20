import { Loader } from '@/components/Loader';
import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { InstallApp } from '@/components/InstallApp';
import { HubTabs } from '@/components/GameHub';
import { Records } from '@/components/Records';
import { useMyWordsSummary } from '@/components/WordsProgress';
import { ProfileEdit, type EditStep } from '@/components/ProfileEdit';
import { logout, useAuth } from '@/lib/auth';
import { leaveRoom } from '@/lib/rooms';
import { fetchStats, streakLabel, type Stats } from '@/lib/stats';
import './profile.css';

type Tab = 'profile' | 'records';
const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Perfil' },
  { id: 'records', label: 'Recordes' },
];

const totalMatches = (stats: Stats | undefined): number | null =>
  stats ? stats.modes.reduce((n, m) => n + m.matches, 0) : null;

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Uma linha de ação das configurações: ícone, título, explicação e a seta. */
function Row({ icon, title, hint, onClick, tone }: { icon: string; title: string; hint: string; onClick: () => void; tone?: 'danger' }) {
  return (
    <button type="button" className={`pf2-row${tone ? ` ${tone}` : ''}`} data-sfx="select" onClick={onClick}>
      <span className="pf2-row-ico">
        <Icon d={icon} />
      </span>
      <span className="pf2-row-text">
        <b>{title}</b>
        <small className="mono">{hint}</small>
      </span>
      <span className="pf2-row-go" aria-hidden="true">
        <Icon d="M9 6l6 6-6 6" />
      </span>
    </button>
  );
}

export function Profile() {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('profile');
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState<EditStep>(null);
  const statsQuery = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const stats = statsQuery.data;
  const wordsSummary = useMyWordsSummary();

  const signOut = async () => {
    // A sala é da conta: sair da conta tira a pessoa dela (precisa ser antes, com a sessão valendo).
    await leaveRoom().catch(() => undefined);
    await logout();
    queryClient.removeQueries({ queryKey: ['my-room'] });
    queryClient.removeQueries({ queryKey: ['invites'] });
    queryClient.removeQueries({ queryKey: ['stats'] });
    setConfirming(false);
    await navigate({ to: '/' });
  };

  if (status === 'loading') {
    return (
      <main className="pf">
        <h1>Perfil</h1>
        <Loader inline />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="pf">
        <h1>Perfil</h1>
        <p className="lead">
          Convidado só olha o app. Crie uma conta para jogar, guardar seu histórico e entrar nos
          rankings.
        </p>
        <div className="pf-actions">
          <Link to="/criar-conta" className="btn alt">
            Criar conta
          </Link>
          <Link to="/entrar" className="btn ghost">
            Entrar
          </Link>
        </div>
      </main>
    );
  }

  const matches = totalMatches(stats);
  return (
    <main className="pf pf2">
      <section className="pf2-hero" data-testid="profile-hero">
        <div className="pf2-id">
          <div className="pf2-avatar" aria-hidden="true">
            {user.name.trim().charAt(0).toUpperCase() || '?'}
          </div>
          <div className="pf2-who">
            <h1>{user.name}</h1>
            {user.username && <span className="pf2-user">@{user.username}</span>}
            <span className="mono pf2-email">{user.email}</span>
          </div>
        </div>
        <dl className="pf2-stats">
          <div>
            <dt className="mono">Dias seguidos</dt>
            <dd>{stats ? streakLabel(stats.visit.current) : '...'}</dd>
          </div>
          <div>
            <dt className="mono">Melhor sequência</dt>
            <dd>{stats ? streakLabel(stats.visit.best) : '...'}</dd>
          </div>
          <div>
            <dt className="mono">Partidas</dt>
            <dd>{matches === null ? '...' : matches.toLocaleString('pt-BR')}</dd>
          </div>
        </dl>
      </section>

      <HubTabs value={tab} onChange={setTab} tabs={TABS} />

      {tab === 'profile' ? (
        <>
          <section className="pf2-group" aria-label="Conta">
            <h2 className="mono">Conta</h2>
            <Row icon="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" title="Editar perfil" hint="Nome e @usuário" onClick={() => setEditing('menu')} />
          </section>
          <ProfileEdit
            step={editing}
            name={user.name}
            username={user.username ?? ''}
            onStep={setEditing}
          />
          <section className="pf2-group" aria-label="Aplicativo">
            <InstallApp />
          </section>
          <section className="pf2-group" aria-label="Sessão">
            <Row icon="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10" title="Sair da conta" hint="Seu progresso e seus recordes ficam guardados" tone="danger" onClick={() => setConfirming(true)} />
          </section>
        </>
      ) : (
        <>
          <Records stats={stats} words={wordsSummary} />
        </>
      )}
      <ConfirmDialog
        open={confirming}
        title="Sair da conta?"
        text="Você precisará entrar de novo para jogar. Seu histórico e seus recordes ficam guardados."
        confirmLabel="Sair"
        confirmSfx="bye"
        onConfirm={() => void signOut()}
        onCancel={() => setConfirming(false)}
      />
    </main>
  );
}
