import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { loadGarage, parseGarage, saveGarage } from './garage';
import { GP_CHANGED } from './gp-bus';
import { loadAllBest, loadPhysics, loadVehicle, replaceBest, savePhysics, saveVehicle } from './gp-best';
import { gpApplyBinds, gpBinds, useGpShake } from './gp-settings';

/**
 * O Fox GP na conta (14/11/2026): garagem (pelo e pinturas), comandos, melhor volta de cada pista e opções ficam salvos no
 * banco e valem em qualquer aparelho. Ao entrar, o que está na conta vale (a melhor volta é a da conta, que manda); conta sem
 * nada salvo recebe o que o aparelho já tinha. Depois, cada mudança sobe sozinha (a última gravação vale).
 */
interface GpSaved {
  garage?: Record<string, unknown>;
  binds?: Record<string, string[]>;
  best?: Record<string, number>;
  shake?: boolean;
  physics?: 'arcade' | 'real';
  vehicle?: 'kart' | 'f1';
}

export function collectGp(): Required<GpSaved> {
  return {
    garage: loadGarage() as unknown as Record<string, unknown>,
    binds: gpBinds() as unknown as Record<string, string[]>,
    best: loadAllBest(),
    shake: useGpShake.getState().on,
    physics: loadPhysics(),
    vehicle: loadVehicle(),
  };
}

let applying = false;
let timer: number | undefined;
let loadedFor: string | null = null;

export function applyGp(r: GpSaved): void {
  applying = true;
  try {
    if (r.garage) saveGarage(parseGarage(r.garage));
    if (r.binds) gpApplyBinds(r.binds);
    replaceBest(r.best);
    if (typeof r.shake === 'boolean') useGpShake.getState().set(r.shake);
    if (r.physics === 'arcade' || r.physics === 'real') savePhysics(r.physics);
    if (r.vehicle === 'kart' || r.vehicle === 'f1') saveVehicle(r.vehicle);
  } finally {
    applying = false;
  }
}

const push = () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (useAuth.getState().user) void apiClient.put('/me/prefs/gp', collectGp()).catch(() => undefined);
  }, 1500);
};

async function sync(userId: string) {
  if (loadedFor === userId) return;
  loadedFor = userId;
  try {
    const { gp } = await apiClient.get<{ gp: GpSaved | null }>('/me/prefs/gp');
    if (gp && Object.keys(gp).length) {
      applyGp(gp);
    } else await apiClient.put('/me/prefs/gp', collectGp());
  } catch {
    loadedFor = null; // sem rede: tenta de novo na próxima vez
  }
}

export function startGpSync(): void {
  const check = () => {
    const u = useAuth.getState().user;
    if (u) void sync(u.id);
    else loadedFor = null;
  };
  useAuth.subscribe(check);
  check();
  window.addEventListener(GP_CHANGED, () => {
    if (!applying) push();
  });
}
