import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { FS_DEFAULTS, useFsSettings, type FsSettings } from '@/games/foxshot/fs-settings';
import { isMuted, setMutedSilently, useMutedStore } from '@/lib/sfx';

/**
 * Preferências na conta (spec 058): as opções do Counter Fox que valem em qualquer aparelho e o som.
 * Desempenho (qualidade, FPS) e tela cheia ficam só no aparelho. Ao entrar, o que está na conta vale; conta nova
 * (nada salvo) sobe o que o aparelho já tinha. Depois, cada mudança sobe sozinha (a última gravação vale).
 */
export interface SyncedPrefs {
  fs?: Partial<Pick<FsSettings, 'sens' | 'adsSens' | 'fov' | 'invertY' | 'crossColor' | 'crossSize' | 'crossCustom' | 'crossThick' | 'crossGap' | 'crossDot' | 'crossDynamic' | 'showMinimap' | 'minimapSize' | 'binds'>>;
  mute?: boolean;
}

export const SYNCED_FS_KEYS = ['sens', 'adsSens', 'fov', 'invertY', 'crossColor', 'crossSize', 'crossCustom', 'crossThick', 'crossGap', 'crossDot', 'crossDynamic', 'showMinimap', 'minimapSize', 'binds'] as const;

export function collectPrefs(): Required<SyncedPrefs> {
  const s = useFsSettings.getState();
  const fs: Record<string, unknown> = {};
  for (const k of SYNCED_FS_KEYS) fs[k] = s[k];
  return { fs: fs as Required<SyncedPrefs>['fs'], mute: isMuted() };
}

/** Junta o que veio da conta com o que o aparelho tem (valores desconhecidos ou fora do padrão são ignorados). */
export function applyPrefs(p: SyncedPrefs): void {
  if (p.fs) {
    const patch: Record<string, unknown> = {};
    for (const k of SYNCED_FS_KEYS) {
      const v = (p.fs as Record<string, unknown>)[k];
      if (v === undefined) continue;
      if (k === 'binds') patch.binds = { ...useFsSettings.getState().binds, ...(v as object) };
      else if (typeof v === typeof FS_DEFAULTS[k]) patch[k] = v;
    }
    applying = true;
    useFsSettings.getState().set(patch as Partial<FsSettings>);
    applying = false;
  }
  if (typeof p.mute === 'boolean') setMutedSilently(p.mute);
}

let applying = false;
let timer: number | undefined;
let loadedFor: string | null = null;

const push = () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (useAuth.getState().user) void apiClient.put('/me/prefs', collectPrefs()).catch(() => undefined);
  }, 1500);
};

async function sync(userId: string) {
  if (loadedFor === userId) return;
  loadedFor = userId;
  try {
    const remote = await apiClient.get<SyncedPrefs>('/me/prefs');
    if (remote && (remote.fs || typeof remote.mute === 'boolean')) applyPrefs(remote);
    else await apiClient.put('/me/prefs', collectPrefs());
  } catch {
    loadedFor = null; // sem rede: tenta de novo na próxima vez
  }
}

export function startPrefsSync(): void {
  const check = () => {
    const u = useAuth.getState().user;
    if (u) void sync(u.id);
    else loadedFor = null;
  };
  useAuth.subscribe(check);
  check();
  useFsSettings.subscribe(() => {
    if (!applying) push();
  });
  useMutedStore(push);
}
