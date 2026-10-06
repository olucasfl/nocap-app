import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/router';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { flushQueuedMatches } from '@/games/color/submit';
import { installGlobalSounds } from '@/lib/sfx';
import { installTheme } from '@/lib/theme';
import '@/styles/tokens.css';
import '@/styles/global.css';

installTheme();
installGlobalSounds();
const queryClient = new QueryClient();

// Partidas guardadas sem conexão saem ao abrir o app e sempre que a rede voltar.
void flushQueuedMatches().catch(() => undefined);
window.addEventListener('online', () => void flushQueuedMatches().catch(() => undefined));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </QueryClientProvider>
  </StrictMode>,
);
