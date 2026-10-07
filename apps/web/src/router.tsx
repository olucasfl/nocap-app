import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';
import { BottomNav } from '@/components/BottomNav';
import { InviteBanner } from '@/components/InviteBanner';
import type { Mode } from '@/games/color/types';
import type { Mode as TimeMode } from '@/games/time/types';
import { History } from '@/screens/History';
import { Friends } from '@/screens/Friends';
import { Hub } from '@/screens/Hub';
import { Login } from '@/screens/Login';
import { Daily } from '@/screens/Daily';
import { ColorRankingPage, TimeRankingPage } from '@/screens/GameRanking';
import { Profile } from '@/screens/Profile';
import { Register } from '@/screens/Register';

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <InviteBanner />
    </>
  ),
});

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

const dailyRoute = createRoute({ getParentRoute: () => tabsRoute, path: '/daily', component: Daily });
const colorRankingRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: '/cor/ranking',
  component: ColorRankingPage,
});
const timeRankingRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: '/tempo/ranking',
  component: TimeRankingPage,
});

const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sala',
  validateSearch: (search: Record<string, unknown>): { jogo?: 'color' | 'time' } =>
    search.jogo === 'color' || search.jogo === 'time' ? { jogo: search.jogo } : {},
  component: lazyRouteComponent(() => import('@/screens/Room'), 'RoomEntryPage'),
});
const roomCodeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sala/$code',
  component: lazyRouteComponent(() => import('@/screens/Room'), 'RoomCodePage'),
});

const MODES: Mode[] = ['classic', 'flash', 'quick', 'daily'];
const TIME_MODES: TimeMode[] = ['classic', 'quick', 'strict', 'daily'];

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

const timeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tempo',
  validateSearch: (search: Record<string, unknown>): { modo?: TimeMode } => {
    const modo = TIME_MODES.find((m) => m === search.modo);
    return modo ? { modo } : {};
  },
  component: lazyRouteComponent(() => import('@/games/time/TimePage'), 'TimePage'),
});

const routeTree = rootRoute.addChildren([
  tabsRoute.addChildren([
    hubRoute,
    historyRoute,
    friendsRoute,
    profileRoute,
    dailyRoute,
    colorRankingRoute,
    timeRankingRoute,
  ]),
  colorRoute,
  timeRoute,
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
