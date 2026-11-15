import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { NH_CHANGED, applyRemote, loadSave } from './save';

/**
 * O Night Hunt na conta (spec 083), no mesmo caminho do Mini Golf: ao entrar, vale o save de maior `rev` (a conta, se estiver
 * à frente; senão sobe o do aparelho). Depois, cada gravação sobe sozinha. Guarda em `user_prefs` (`/me/prefs/nighthunt`),
 * sem migração de banco.
 */
let timer: number | undefined;
let loadedFor: string | null = null;
let applying = false;

const push = () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (useAuth.getState().user)
      void apiClient.put('/me/prefs/nighthunt', loadSave()).catch(() => undefined);
  }, 1500);
};

async function sync(userId: string) {
  if (loadedFor === userId) return;
  loadedFor = userId;
  try {
    const { nighthunt } = await apiClient.get<{ nighthunt: ReturnType<typeof loadSave> | null }>(
      '/me/prefs/nighthunt',
    );
    const local = loadSave();
    if (nighthunt && nighthunt.rev >= local.rev) {
      applying = true;
      try {
        applyRemote(nighthunt);
      } finally {
        applying = false;
      }
    } else await apiClient.put('/me/prefs/nighthunt', local);
  } catch {
    loadedFor = null;
  }
}

export function startNhSync(): void {
  const check = () => {
    const u = useAuth.getState().user;
    if (u) void sync(u.id);
    else loadedFor = null;
  };
  useAuth.subscribe(check);
  check();
  window.addEventListener(NH_CHANGED, () => {
    if (!applying) push();
  });
}
