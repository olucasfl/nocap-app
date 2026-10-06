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
import { Hub } from '@/screens/Hub';
import { Soon } from '@/screens/Soon';

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
  component: () => <Soon title="Amigos" />,
});
const profileRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: '/perfil',
  component: () => <Soon title="Perfil" />,
});

const MODES: Mode[] = ['classic', 'flash', 'daily'];

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
  tabsRoute.addChildren([hubRoute, historyRoute, friendsRoute, profileRoute]),
  colorRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
