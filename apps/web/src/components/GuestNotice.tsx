import { Link } from '@tanstack/react-router';
import { SAVE_TEXT, type SaveState } from '@/games/color/useSaveMatch';
import './guest-notice.css';

/** O aviso grande do fim da partida de quem não tem conta: nada desta partida fica guardado. */
export function GuestNotice() {
  return (
    <section className="gn" role="status" aria-label="Partida não salva">
      <div className="mono gn-tag">SEM CONTA</div>
      <h2 className="gn-title">Esta partida não foi salva</h2>
      <p className="gn-text">
        Como você não tem conta, esta pontuação não vai para o ranking, nem para o histórico, nem
        para os seus recordes. Crie uma conta para a próxima partida valer.
      </p>
      <div className="gn-actions">
        <Link to="/criar-conta" className="btn alt" data-sfx="select">
          Criar conta
        </Link>
        <Link to="/entrar" className="btn ghost" data-sfx="select">
          Entrar
        </Link>
      </div>
    </section>
  );
}

/** A linha do fim da partida que diz como foi o salvamento (ou o aviso grande, sem conta). */
export function SaveNote({ save, className }: { save: SaveState; className?: string }) {
  if (save === 'guest') return <GuestNotice />;
  return (
    <p className={className} role="status">
      {SAVE_TEXT[save]}
    </p>
  );
}
