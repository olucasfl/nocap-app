import { Link } from '@tanstack/react-router';
import { InstallApp } from './InstallApp';
import { Friends, Grid, History, User } from './icons';
import './bottom-nav.css';

const tabs = [
  { to: '/', label: 'Jogos', Icon: Grid, sfx: 'navGames' },
  { to: '/historico', label: 'Histórico', Icon: History, sfx: 'navFriends' },
  { to: '/amigos', label: 'Amigos', Icon: Friends, sfx: 'navFriends' },
  { to: '/perfil', label: 'Perfil', Icon: User, sfx: 'navFriends' },
] as const;

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {/* Só aparece no menu lateral (tablet e computador). */}
      <div className="rail-logo" aria-hidden="true">
        no cap<span>!</span>
      </div>
      {tabs.map(({ to, label, Icon, sfx }) => (
        <Link
          key={to}
          to={to}
          className="tab"
          data-sfx={sfx}
          activeProps={{ className: 'tab on', 'aria-current': 'page' }}
          activeOptions={{ exact: true }}
        >
          <Icon />
          {label}
        </Link>
      ))}
      <div className="rail-foot">
        <InstallApp compact />
      </div>
    </nav>
  );
}
