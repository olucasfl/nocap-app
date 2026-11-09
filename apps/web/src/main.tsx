import { startPrefsSync } from '@/lib/prefs-sync';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { ApiError } from '@/lib/api-client';
import { router } from '@/router';
import { UpdateBeforeEnter } from '@/components/UpdateBeforeEnter';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { flushQueuedMatches } from '@/games/color/submit';
import { installGlobalSounds } from '@/lib/sfx';
import { restoreSession } from '@/lib/auth';
import { MY_ROOM_KEY } from '@/lib/my-room';
import { setOnRoomGone } from '@/lib/rooms';
import { listenForInstall } from '@/lib/install';
import { installTheme } from '@/lib/theme';
import '@/styles/tokens.css';
import '@/styles/global.css';
import '@/styles/responsive.css';

installTheme();
listenForInstall();
void restoreSession();
installGlobalSounds();
startPrefsSync();
// Sem rede a consulta falha logo (em vez de ficar esperando) e cada tela mostra o aviso próprio.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',
      retry: (count, error) => !(error instanceof ApiError) && count < 1,
      refetchOnReconnect: true,
    },
  },
});

// Saiu da sala: o aviso "Você está na sala" some na hora e só volta a perguntar ao servidor depois que ele confirmou a saída.
setOnRoomGone((settled) => {
  if (settled) void queryClient.invalidateQueries({ queryKey: MY_ROOM_KEY });
  else queryClient.setQueryData(MY_ROOM_KEY, null);
});

// Partidas guardadas sem conexão saem ao abrir o app e sempre que a rede voltar.
void flushQueuedMatches().catch(() => undefined);
window.addEventListener('online', () => void flushQueuedMatches().catch(() => undefined));
// Se o servidor estava com problema (e não só sem rede), a partida guardada também sai sozinha:
// de tempos em tempos e quando a pessoa volta para a aba.
window.setInterval(() => void flushQueuedMatches().catch(() => undefined), 45_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void flushQueuedMatches().catch(() => undefined);
});

/** Some o splash do PWA (se houver) depois de um mínimo de tempo, para não piscar. */
function hideSplash() {
  const el = document.getElementById('splash');
  if (!el) return;
  const shown = (window as unknown as { __splashAt?: number }).__splashAt ?? Date.now();
  // A animação do splash dura ~2,3 s: ela toca inteira, no mínimo, antes de sair.
  const wait = Math.max(0, 2300 - (Date.now() - shown));
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 400);
  }, wait);
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <UpdatePrompt />
      <UpdateBeforeEnter />
    </QueryClientProvider>
  </StrictMode>,
);

// iOS ignora user-scalable=no: bloqueia o gesto de pinça e o zoom por toque duplo em todo o app.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault());
}
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);

requestAnimationFrame(hideSplash);
