import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';
import { BottomNav } from '@/components/BottomNav';
import type { GameTab } from '@/components/GameTabs';
import { LoadFailed } from '@/components/LoadFailed';
import { PageLoader } from '@/components/Loader';
import { NetworkStatus } from '@/components/NetworkStatus';
import { PullToRefresh } from '@/components/PullToRefresh';
import type { Board } from '@/lib/ranking';
import { InviteBanner } from '@/components/InviteBanner';
import type { Mode } from '@/games/color/types';
import type { Mode as TimeMode } from '@/games/time/types';
import { History } from '@/screens/History';
import { Friends } from '@/screens/Friends';
import { FriendProfile } from '@/screens/FriendProfile';
import { Hub } from '@/screens/Hub';
import { Login } from '@/screens/Login';
import { Profile } from '@/screens/Profile';
import { Register } from '@/screens/Register';

const rootRoute = createRootRoute({
  component: () => (
    <>
      <NetworkStatus />
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
    <div className="app tabs-app">
      <PullToRefresh />
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
const friendProfileRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: '/amigos/$username',
  component: FriendProfile,
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

const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sala',
  validateSearch: (search: Record<string, unknown>): { jogo?: 'color' | 'time' | 'impostor' } =>
    search.jogo === 'color' || search.jogo === 'time' || search.jogo === 'impostor'
      ? { jogo: search.jogo }
      : {},
  component: lazyRouteComponent(() => import('@/screens/Room'), 'RoomEntryPage'),
});
const roomCodeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sala/$code',
  component: lazyRouteComponent(() => import('@/screens/Room'), 'RoomCodePage'),
});

/** `/cor?aba=ranking&quadro=daily`: abre o jogo direto numa aba (e num quadro do ranking). */
interface GameSearch<M> {
  modo?: M;
  aba?: GameTab;
  quadro?: Board;
}
const TABS: GameTab[] = ['modes', 'friends', 'ranking'];
const BOARDS: Board[] = ['classic', 'flash', 'quick', 'strict', 'daily'];

function gameSearch<M extends string>(search: Record<string, unknown>, modes: M[]): GameSearch<M> {
  const out: GameSearch<M> = {};
  const modo = modes.find((m) => m === search.modo);
  const aba = TABS.find((t) => t === search.aba);
  const quadro = BOARDS.find((b) => b === search.quadro);
  if (modo) out.modo = modo;
  if (aba) out.aba = aba;
  if (quadro) out.quadro = quadro;
  return out;
}

const MODES: Mode[] = ['classic', 'flash', 'quick', 'blind', 'survival', 'daily'];
const TIME_MODES: TimeMode[] = ['classic', 'quick', 'strict', 'sequence', 'survival', 'daily'];

const colorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cor',
  validateSearch: (search: Record<string, unknown>): GameSearch<Mode> => gameSearch(search, MODES),
  // Cada jogo é carregado sob demanda (meta: JS inicial leve).
  component: lazyRouteComponent(() => import('@/games/color/ColorPage'), 'ColorPage'),
});

const timeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tempo',
  validateSearch: (search: Record<string, unknown>): GameSearch<TimeMode> =>
    gameSearch(search, TIME_MODES),
  component: lazyRouteComponent(() => import('@/games/time/TimePage'), 'TimePage'),
});

const routeTree = rootRoute.addChildren([
  tabsRoute.addChildren([hubRoute, historyRoute, friendsRoute, friendProfileRoute, profileRoute]),
  colorRoute,
  timeRoute,
  loginRoute,
  registerRoute,
  roomRoute,
  roomCodeRoute,
]);

export const router = createRouter({
  routeTree,
  // Telas carregadas sob demanda (jogos, sala) mostram o carregador do NoCap enquanto chegam.
  defaultPendingComponent: () => <PageLoader />,
  defaultPendingMs: 150,
  // Tela que não carregou (ex.: o código dela não veio por falta de internet).
  defaultErrorComponent: ({ reset }) => (
    <div className="app">
      <main className="screen">
        <LoadFailed what="esta página" onRetry={() => (reset(), window.location.reload())} />
      </main>
    </div>
  ),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
