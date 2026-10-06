import { Link } from '@tanstack/react-router';
import { Friends, Grid, History, User } from './icons';
import './bottom-nav.css';

const tabs = [
  { to: '/', label: 'Jogos', Icon: Grid },
  { to: '/historico', label: 'Histórico', Icon: History },
  { to: '/amigos', label: 'Amigos', Icon: Friends },
  { to: '/perfil', label: 'Perfil', Icon: User },
] as const;

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {tabs.map(({ to, label, Icon }) => (
        <Link
          key={to}
          to={to}
          className="tab"
          activeProps={{ className: 'tab on', 'aria-current': 'page' }}
          activeOptions={{ exact: true }}
        >
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
