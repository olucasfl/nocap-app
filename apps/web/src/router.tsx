import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { Hub } from '@/screens/Hub';

const rootRoute = createRootRoute({
  component: () => (
    <div className="app-shell">
      <Outlet />
    </div>
  ),
});

const hubRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Hub });

// Rotas dos jogos (/cor, /tempo), /historico, /amigos e /perfil entram aqui.
const routeTree = rootRoute.addChildren([hubRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
