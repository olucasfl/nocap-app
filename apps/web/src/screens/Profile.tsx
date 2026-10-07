import { Loader } from '@/components/Loader';
import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Choice } from '@/components/RankingList';
import { Records } from '@/components/Records';
import { logout, useAuth } from '@/lib/auth';
import { fetchStats, streakLabel } from '@/lib/stats';
import './profile.css';

type Tab = 'profile' | 'records';
const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Perfil' },
  { id: 'records', label: 'Recordes' },
];

function VisitStreak() {
  const q = useQuery({ queryKey: ['stats'], queryFn: fetchStats });
  const visit = q.data?.visit;
  return (
    <section className="pf-streak" aria-label="Dias seguidos no NoCap">
      <div className="mono pf-streak-label">DIAS SEGUIDOS NO NOCAP</div>
      <div className="pf-streak-value">{visit ? streakLabel(visit.current) : '...'}</div>
      <div className="mono pf-streak-sub">
        {visit ? `MELHOR SEQUÊNCIA ${streakLabel(visit.best).toUpperCase()}` : 'CARREGANDO'}
      </div>
    </section>
  );
}

export function Profile() {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('profile');
  const [confirming, setConfirming] = useState(false);

  const signOut = async () => {
    await logout();
    queryClient.removeQueries({ queryKey: ['history'] });
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

  return (
    <main className="pf">
      <h1>Perfil</h1>
      <Choice label="Seção" value={tab} options={TABS} onChange={setTab} />
      {tab === 'profile' ? (
        <>
          <section className="pf-card">
            <div className="pf-avatar" aria-hidden="true">
              {user.name.trim().charAt(0).toUpperCase() || '?'}
            </div>
            <div className="pf-id">
              <div className="pf-name">{user.name}</div>
              {user.username && <div className="pf-user">@{user.username}</div>}
              <div className="mono pf-email">{user.email}</div>
            </div>
          </section>
          <VisitStreak />
          <div className="pf-actions">
            <button
              type="button"
              className="btn ghost"
              data-sfx="select"
              onClick={() => setConfirming(true)}
            >
              Sair
            </button>
          </div>
        </>
      ) : (
        <Records />
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
