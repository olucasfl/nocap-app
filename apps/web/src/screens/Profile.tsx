import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { StatsPanel } from '@/components/StatsPanel';
import { logout, useAuth } from '@/lib/auth';
import './account.css';

export function Profile() {
  const { user, status } = useAuth();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await logout();
    // O histórico muda de "conta" para "só este aparelho".
    await queryClient.invalidateQueries({ queryKey: ['history'] });
    await queryClient.invalidateQueries({ queryKey: ['stats'] });
  };

  if (status === 'loading') {
    return (
      <main className="acc-profile">
        <h1>Perfil</h1>
        <p className="lead">Carregando...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="acc-profile">
        <h1>Perfil</h1>
        <p className="lead">
          Você está jogando como convidado. Crie uma conta para ter um @usuario, achar amigos e
          levar seu histórico para qualquer aparelho.
        </p>
        <StatsPanel />
        <div className="acc-actions">
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
    <main className="acc-profile">
      <h1>Perfil</h1>
      <section className="acc-card" aria-label="Sua conta">
        <div className="acc-name">{user.name}</div>
        {user.username && <div className="mono acc-user">@{user.username}</div>}
        <div className="mono acc-email">{user.email}</div>
      </section>
      <StatsPanel />
      <div className="acc-actions">
        <button type="button" className="btn ghost" onClick={() => void signOut()}>
          Sair
        </button>
      </div>
    </main>
  );
}
