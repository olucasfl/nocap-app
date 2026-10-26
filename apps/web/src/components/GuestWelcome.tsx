import { useEffect, useRef, useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { usePopupSlot } from '@/lib/popups';
import './guest-welcome.css';

/** O que quem não tem conta perde (tudo isto só vale com conta). */
const PERKS = [
  'Salvar seus recordes e o histórico de cada partida',
  'Entrar no ranking de hoje, da semana e de sempre',
  'Jogar o Daily e manter a sua sequência de dias',
  'Adicionar amigos e ver o ranking só entre vocês',
  'Ter perfil e o seu @ nas salas, em qualquer aparelho',
];

/**
 * Só vale para esta abertura do app: fechar e abrir, ou recarregar, mostra de novo. Por isso a
 * decisão fica numa variável do módulo (nada vai para o armazenamento).
 */
let decided = false;

/** Telas em que o aviso atrapalharia: a pessoa já está entrando, criando conta ou numa sala. */
const isQuietRoute = (path: string) =>
  path === '/entrar' || path === '/criar-conta' || path === '/sala' || path.startsWith('/sala/');

/**
 * "Você ainda não tem conta": aparece uma vez por abertura do app, para quem não está logado,
 * depois de conferida a sessão. Entra na fila de popups, então nunca aparece junto de outro.
 */
export function GuestWelcome() {
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (decided || status !== 'ready') return;
    decided = true;
    if (!user && !isQuietRoute(pathname)) setOpen(true);
  }, [status, user, pathname]);

  const myTurn = usePopupSlot('guest-welcome', open, 10);
  const primary = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!myTurn) return;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [myTurn]);

  if (!open || !myTurn) return null;
  const close = () => setOpen(false);
  return (
    <div className="gw" role="dialog" aria-modal="true" aria-labelledby="gw-title">
      <div className="gw-card">
        <div className="mono gw-tag">SEM CONTA</div>
        <h2 id="gw-title">Você ainda não tem conta</h2>
        <p className="mono gw-lead">Crie uma conta para:</p>
        <ul className="gw-list">
          {PERKS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mono gw-note">Sem conta você joga tudo, mas nenhuma partida fica salva.</p>
        <div className="stack">
          <Link
            ref={primary}
            to="/criar-conta"
            className="btn alt"
            data-sfx="select"
            onClick={close}
          >
            Criar conta
          </Link>
          <Link to="/entrar" className="btn" data-sfx="select" onClick={close}>
            Entrar
          </Link>
          <button type="button" className="btn ghost" data-sfx="back" onClick={close}>
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
