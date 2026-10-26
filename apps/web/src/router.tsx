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
import { parseRankingsSearch, type RankingsSearch } from '@/lib/ranking';
import { GuestWelcome } from '@/components/GuestWelcome';
import { InviteBanner } from '@/components/InviteBanner';
import { PresenceBeat } from '@/components/PresenceBeat';
import { ProgressSync } from '@/components/ProgressSync';
import type { Mode } from '@/games/color/types';
import type { Mode as TimeMode } from '@/games/time/types';
import type { Mode as EcoMode } from '@/games/eco/types';
import { Friends } from '@/screens/Friends';
import { FriendProfile } from '@/screens/FriendProfile';
import { Hub } from '@/screens/Hub';
import { Login } from '@/screens/Login';
import { Profile } from '@/screens/Profile';
import { Rankings } from '@/screens/Rankings';
import { Register } from '@/screens/Register';

const rootRoute = createRootRoute({
  component: () => (
    <>
      <NetworkStatus />
      <Outlet />
      <InviteBanner />
      <PresenceBeat />
      <ProgressSync />
      <GuestWelcome />
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
const rankingsRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: '/ranking',
  validateSearch: (search: Record<string, unknown>): RankingsSearch => parseRankingsSearch(search),
  component: Rankings,
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
  validateSearch: (
    search: Record<string, unknown>,
  ): { jogo?: 'color' | 'time' | 'impostor' | 'eco' | 'atravessa' | 'desmorona' } =>
    search.jogo === 'color' ||
    search.jogo === 'time' ||
    search.jogo === 'impostor' ||
    search.jogo === 'eco' ||
    search.jogo === 'atravessa' ||
    search.jogo === 'desmorona'
      ? { jogo: search.jogo }
      : {},
  component: lazyRouteComponent(() => import('@/screens/Room'), 'RoomEntryPage'),
});
const roomCodeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sala/$code',
  component: lazyRouteComponent(() => import('@/screens/Room'), 'RoomCodePage'),
});

/** `/cor?aba=friends&modo=survival`: abre o jogo direto numa aba. O ranking tem a própria página (`/ranking`). */
interface GameSearch<M> {
  modo?: M;
  aba?: GameTab;
}
const TABS: GameTab[] = ['modes', 'friends'];

function gameSearch<M extends string>(search: Record<string, unknown>, modes: M[]): GameSearch<M> {
  const out: GameSearch<M> = {};
  const modo = modes.find((m) => m === search.modo);
  const aba = TABS.find((t) => t === search.aba);
  if (modo) out.modo = modo;
  if (aba) out.aba = aba;
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

const ECO_MODES: EcoMode[] = ['classic', 'escalada', 'velocidade', 'reverso', 'batida', 'daily'];

const ecoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/eco',
  validateSearch: (search: Record<string, unknown>): GameSearch<EcoMode> =>
    gameSearch(search, ECO_MODES),
  component: lazyRouteComponent(() => import('@/games/eco/EcoPage'), 'EcoPage'),
});

const atravessaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/atravessa',
  component: lazyRouteComponent(() => import('@/games/atravessa/AtravessaPage'), 'AtravessaPage'),
});

const foxCapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fox-cap',
  component: lazyRouteComponent(() => import('@/games/desmorona/FoxCapPage'), 'FoxCapPage'),
});

const desmoronaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fox-cap/desmorona',
  component: lazyRouteComponent(() => import('@/games/desmorona/DesmoronaPage'), 'DesmoronaPage'),
});

const apertaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/arcade/aperta',
  component: lazyRouteComponent(() => import('@/games/aperta/ApertaPage'), 'ApertaPage'),
});

const blocksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blocks',
  validateSearch: (search: Record<string, unknown>): GameSearch<'classic'> =>
    gameSearch(search, ['classic']),
  component: lazyRouteComponent(() => import('@/games/blocks/BlocksPage'), 'BlocksPage'),
});

const timeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tempo',
  validateSearch: (search: Record<string, unknown>): GameSearch<TimeMode> =>
    gameSearch(search, TIME_MODES),
  component: lazyRouteComponent(() => import('@/games/time/TimePage'), 'TimePage'),
});

const wordsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/words',
  component: lazyRouteComponent(() => import('@/games/words/WordsPage'), 'WordsPage'),
});
const wordsClassicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/words/classic',
  component: lazyRouteComponent(() => import('@/games/words/ClassicPage'), 'ClassicPage'),
});
const wordsClassicPlayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/words/classic/jogar',
  validateSearch: (
    search: Record<string, unknown>,
  ): { tipo?: 'daily' | 'solo'; modo?: 'classic' | 'dueto' | 'quarteto' } => ({
    ...(search.tipo === 'daily' || search.tipo === 'solo' ? { tipo: search.tipo } : {}),
    ...(search.modo === 'classic' || search.modo === 'dueto' || search.modo === 'quarteto'
      ? { modo: search.modo }
      : {}),
  }),
  component: lazyRouteComponent(() => import('@/games/words/ClassicPlayPage'), 'ClassicPlayPage'),
});

const wordsClassicCatalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/words/classic/fases/$modo',
  component: lazyRouteComponent(() => import('@/games/words/ClassicCatalog'), 'ClassicCatalog'),
});
const wordsClassicLevelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/words/classic/fase/$modo/$n',
  component: lazyRouteComponent(() => import('@/games/words/ClassicLevelPlay'), 'ClassicLevelPlay'),
});

const wordsBeeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/words/bee',
  component: lazyRouteComponent(() => import('@/games/words/bee/BeeCatalog'), 'BeeCatalog'),
});
const wordsBeeLevelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/words/bee/fase/$n',
  component: lazyRouteComponent(() => import('@/games/words/bee/BeePlay'), 'BeePlay'),
});
const wordsConnectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/words/connect',
  component: lazyRouteComponent(
    () => import('@/games/words/connect/ConnectCatalog'),
    'ConnectCatalog',
  ),
});
const wordsConnectLevelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/words/connect/fase/$n',
  component: lazyRouteComponent(() => import('@/games/words/connect/ConnectPlay'), 'ConnectPlay'),
});

const routeTree = rootRoute.addChildren([
  tabsRoute.addChildren([hubRoute, rankingsRoute, friendsRoute, friendProfileRoute, profileRoute]),
  colorRoute,
  timeRoute,
  ecoRoute,
  atravessaRoute,
  foxCapRoute,
  desmoronaRoute,
  apertaRoute,
  blocksRoute,
  wordsRoute,
  wordsClassicRoute,
  wordsClassicPlayRoute,
  wordsClassicCatalogRoute,
  wordsClassicLevelRoute,
  wordsBeeRoute,
  wordsBeeLevelRoute,
  wordsConnectRoute,
  wordsConnectLevelRoute,
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
