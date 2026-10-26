import { Fragment } from 'react';
import { Link } from '@tanstack/react-router';
import { InstallApp } from './InstallApp';
import { useAuth } from '@/lib/auth';
import { useMyRoom } from '@/lib/my-room';
import { useRoom } from '@/lib/rooms';
import { Door, Friends, Grid, Trophy, User } from './icons';
import './bottom-nav.css';

const tabs = [
  { to: '/', label: 'Jogos', Icon: Grid, sfx: 'navGames' },
  { to: '/ranking', label: 'Ranking', Icon: Trophy, sfx: 'navFriends' },
  { to: '/amigos', label: 'Amigos', Icon: Friends, sfx: 'navFriends' },
  { to: '/perfil', label: 'Perfil', Icon: User, sfx: 'navFriends' },
] as const;

/**
 * O menu principal (barra de baixo no celular, menu lateral no computador). Quando a conta está numa sala aparece o
 * item "Sala" logo depois de "Jogos": um toque volta para a tela da sala (lobby ou partida), sem perder a sala ao
 * visitar Ranking, Amigos ou Perfil.
 */
export function BottomNav({ railOnly = false }: { railOnly?: boolean }) {
  const user = useAuth((s) => s.user);
  const room = useMyRoom();
  const unread = useRoom((s) => s.unread);
  const inRoom = !!user && !!room;
  const [first, ...others] = tabs;
  return (
    <nav
      className={`bottom-nav${railOnly ? ' rail-only' : ''}`}
      data-n={inRoom ? 5 : 4}
      aria-label="Navegação principal"
    >
      {/* Só aparece no menu lateral (tablet e computador). */}
      <div className="rail-logo" aria-hidden="true">
        no cap<span>!</span>
      </div>
      {[first, ...others].map(({ to, label, Icon, sfx }, i) => (
        <Fragment key={to}>
          {i === 1 && inRoom && room && (
            <Link
              to="/sala/$code"
              params={{ code: room.code }}
              className="tab room"
              data-sfx="roomJoin"
              data-state={
                room.reconnecting
                  ? 'wait'
                  : room.phase === 'lobby' || room.phase === 'final'
                    ? 'idle'
                    : 'live'
              }
              activeProps={{ className: 'tab room on', 'aria-current': 'page' }}
              aria-label={`Sala ${room.code}${unread > 0 ? `, ${unread} mensagens novas` : ''}`}
              title={`Voltar para a sala ${room.code}`}
            >
              <Door />
              Sala
              <i className="tab-dot" aria-hidden="true" />
              {unread > 0 && <b className="tab-badge">{unread > 9 ? '9+' : unread}</b>}
            </Link>
          )}
          <Link
            to={to}
            className="tab"
            data-sfx={sfx}
            activeProps={{ className: 'tab on', 'aria-current': 'page' }}
            activeOptions={{ exact: true }}
          >
            <Icon />
            {label}
          </Link>
        </Fragment>
      ))}
      <div className="rail-foot">
        <InstallApp compact />
      </div>
    </nav>
  );
}
