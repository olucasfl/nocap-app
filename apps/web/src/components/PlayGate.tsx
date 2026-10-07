import { Loader } from './Loader';
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import './game-ui.css';

/**
 * Só quem tem conta joga. O convidado pode entrar, ver as telas e o ranking, mas no lugar do
 * botão de jogar vê o convite para entrar ou criar conta. (O servidor também recusa: este
 * bloqueio é só a parte visível.)
 */
export function PlayGate({ children, what = 'jogar' }: { children: ReactNode; what?: string }) {
  const { user, status } = useAuth();
  if (status === 'loading') return <Loader inline />;
  if (user) return <>{children}</>;
  return (
    <section className="pg" aria-label={`Entre para ${what}`}>
      <div className="pg-title">Entre para {what}</div>
      <p className="pg-text">
        Você pode explorar o app, mas só quem tem conta joga. Assim seus recordes e seu lugar no
        ranking ficam guardados.
      </p>
      <div className="pg-actions">
        <Link to="/criar-conta" className="btn alt">
          Criar conta
        </Link>
        <Link to="/entrar" className="btn ghost">
          Entrar
        </Link>
      </div>
    </section>
  );
}
