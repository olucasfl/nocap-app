import { useSyncExternalStore } from 'react';
import { getSyncStatus, subscribeSyncStatus } from '@/games/words/levels/progress-sync';
import { useAuth } from '@/lib/auth';

/** No Perfil: mostra se o progresso das fases do Word's está salvo na conta (a sincronização é automática). */
export function ProgressSyncStatus() {
  const id = useAuth((s) => s.user?.id);
  const s = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  if (!id) return null;
  const text =
    s.phase === 'syncing'
      ? 'Sincronizando...'
      : s.phase === 'ok'
        ? `${s.levels} fase${s.levels === 1 ? '' : 's'} salva${s.levels === 1 ? '' : 's'} na conta${s.waiting > 0 ? ` · ${s.waiting} esperando` : ''}`
        : s.phase === 'error'
          ? `Não deu para sincronizar (${s.error ?? 'sem conexão'}). O progresso continua salvo neste aparelho.`
          : 'Ainda não sincronizado.';
  return (
    <section className="pf-sync" aria-label="Progresso das fases na conta" data-testid="sync-status" data-phase={s.phase}>
      <div className="mono pf-sync-label">PROGRESSO DAS FASES DO WORD&apos;S</div>
      <div className="pf-sync-text">{text}</div>
    </section>
  );
}
