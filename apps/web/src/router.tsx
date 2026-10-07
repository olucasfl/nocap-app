import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';
import { BottomNav } from '@/components/BottomNav';
import type { Mode } from '@/games/color/types';
import { History } from '@/screens/History';
import { Friends } from '@/screens/Friends';
import { Hub } from '@/screens/Hub';
import { Login } from '@/screens/Login';
import { Profile } from '@/screens/Profile';
import { Ranking } from '@/screens/Ranking';
import { Register } from '@/screens/Register';

const rootRoute = createRootRoute({ component: Outlet });

// Telas com a barra de navegação inferior. O jogo fica fora dela (tela cheia).
const tabsRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'tabs',
  component: () => (
    <div className="app">
      <Outlet />
      <BottomNav />
    </div>
  ),
});

const hubRoute = createRoute({ getParentRoute: () => tabsRoute, path: '/', component: Hub });
const historyRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: '/historico',
  component: History,
});
const friendsRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: '/amigos',
  component: Friends,
});
const profileRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: '/perfil',
  component: Profile,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/entrar',
  component: Login,
});
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/criar-conta',
  component: Register,
});

const rankingRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: '/ranking',
  component: Ranking,
});

const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sala',
  component: lazyRouteComponent(() => import('@/screens/Room'), 'RoomPage'),
});
const roomCodeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sala/$code',
  component: lazyRouteComponent(() => import('@/screens/Room'), 'RoomCodePage'),
});

const MODES: Mode[] = ['classic', 'flash', 'quick', 'daily'];

const colorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cor',
  validateSearch: (search: Record<string, unknown>): { modo?: Mode } => {
    const modo = MODES.find((m) => m === search.modo);
    return modo ? { modo } : {};
  },
  // Cada jogo é carregado sob demanda (meta: JS inicial leve).
  component: lazyRouteComponent(() => import('@/games/color/ColorPage'), 'ColorPage'),
});

const routeTree = rootRoute.addChildren([
  tabsRoute.addChildren([hubRoute, historyRoute, friendsRoute, profileRoute, rankingRoute]),
  colorRoute,
  loginRoute,
  registerRoute,
  roomRoute,
  roomCodeRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
