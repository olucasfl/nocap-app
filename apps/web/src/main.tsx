import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { ApiError } from '@/lib/api-client';
import { router } from '@/router';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { flushQueuedMatches } from '@/games/color/submit';
import { installGlobalSounds } from '@/lib/sfx';
import { restoreSession } from '@/lib/auth';
import { installTheme } from '@/lib/theme';
import '@/styles/tokens.css';
import '@/styles/global.css';

installTheme();
void restoreSession();
installGlobalSounds();
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

// Partidas guardadas sem conexão saem ao abrir o app e sempre que a rede voltar.
void flushQueuedMatches().catch(() => undefined);
window.addEventListener('online', () => void flushQueuedMatches().catch(() => undefined));

/** Some o splash do PWA (se houver) depois de um mínimo de tempo, para não piscar. */
function hideSplash() {
  const el = document.getElementById('splash');
  if (!el) return;
  const shown = (window as unknown as { __splashAt?: number }).__splashAt ?? Date.now();
  const wait = Math.max(0, 1200 - (Date.now() - shown));
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, wait);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </QueryClientProvider>
  </StrictMode>,
);

requestAnimationFrame(hideSplash);
