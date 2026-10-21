import { Link } from '@tanstack/react-router';
import { toggleMute, useMuted } from '@/lib/sfx';
import { TitleArt } from './art';
import type { ApertaAccess } from './saves-flow';

interface Props {
  access: ApertaAccess;
  onPlay: () => void;
}

/** Tela de título (spec 038, 3.1). Sem conta, no lugar de Jogar entra o convite. */
export function TitleScreen({ access, onPlay }: Props) {
  const muted = useMuted();
  return (
    <section className="ap-title ap-screen-in" aria-label="Aperta!">
      <TitleArt />
      <div className="ap-titlebox">
        <p className="ap-tag">Um clicker no espaço</p>
        <h1 className="ap-logo" aria-label="Aperta!">
          <span aria-hidden="true">Aperta</span>
          <b aria-hidden="true">!</b>
        </h1>
        <nav className="ap-menu" aria-label="Menu">
          {access === 'guest' ? (
            <div className="ap-invite">
              <h2>Entre para jogar</h2>
              <p>O Aperta! guarda seu progresso na conta. Crie uma ou entre na sua para começar.</p>
              <div className="ap-invite-actions">
                <Link to="/entrar" className="ap-btn small" data-sfx="start">
                  Entrar
                </Link>
                <Link to="/criar-conta" className="ap-btn ghost small" data-sfx="select">
                  Criar conta
                </Link>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="ap-btn"
              data-sfx="start"
              disabled={access === 'checking'}
              onClick={onPlay}
            >
              Jogar
            </button>
          )}
          <button
            type="button"
            className="ap-btn ghost"
            aria-pressed={!muted}
            onClick={toggleMute}
          >
            Som: {muted ? 'desligado' : 'ligado'}
          </button>
          <Link to="/" className="ap-btn red" data-sfx="cancel">
            Voltar ao Arcade
          </Link>
        </nav>
      </div>
    </section>
  );
}
