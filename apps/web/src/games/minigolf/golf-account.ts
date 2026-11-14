import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { GOLF_CHANGED, loadBest, loadLook, mergeBest, saveLook } from './golf-save';
import { parseGolfBall } from '@nocap/games';

/**
 * O Mini Golf na conta (spec 082): a bola e a melhor marca de cada fase valem em qualquer aparelho. Ao entrar, o que está
 * na conta vale (a menor marca de cada fase vence); conta sem nada recebe o que o aparelho tinha. Depois, cada mudança
 * sobe sozinha. Mesmo caminho do Fox GP (`gp-account.ts`).
 */
interface GolfSaved {
  ball?: Record<string, unknown>;
  best?: Record<string, number>;
}

const collect = (): { ball: ReturnType<typeof loadLook>; best: Record<string, number> } => ({
  ball: loadLook(),
  best: Object.fromEntries(Object.entries(loadBest()).map(([k, v]) => [k, v])),
});

let applying = false;
let timer: number | undefined;
let loadedFor: string | null = null;

const push = () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (useAuth.getState().user) void apiClient.put('/me/prefs/golf', collect()).catch(() => undefined);
  }, 1500);
};

async function sync(userId: string) {
  if (loadedFor === userId) return;
  loadedFor = userId;
  try {
    const { golf } = await apiClient.get<{ golf: GolfSaved | null }>('/me/prefs/golf');
    if (golf && Object.keys(golf).length) {
      applying = true;
      try {
        if (golf.ball) saveLook(parseGolfBall(golf.ball));
        if (golf.best) mergeBest(golf.best);
      } finally {
        applying = false;
      }
      push();
    } else await apiClient.put('/me/prefs/golf', collect());
  } catch {
    loadedFor = null;
  }
}

export function startGolfSync(): void {
  const check = () => {
    const u = useAuth.getState().user;
    if (u) void sync(u.id);
    else loadedFor = null;
  };
  useAuth.subscribe(check);
  check();
  window.addEventListener(GOLF_CHANGED, () => {
    if (!applying) push();
  });
}
