import { useEffect } from 'react';
import { stopSync, syncNow, wireStores } from '@/games/words/levels/progress-sync';
import { useAuth } from '@/lib/auth';

/**
 * Não aparece nada: com a conta ligada, mantém o progresso das fases do Word's igual no aparelho e na conta.
 * Sincroniza ao entrar, ao voltar para o app e quando a internet volta; o que o aparelho já tinha sobe junto.
 */
export function ProgressSync() {
  const id = useAuth((s) => s.user?.id);
  useEffect(() => {
    if (!id) {
      stopSync();
      return;
    }
    wireStores();
    const run = () => void syncNow(id).catch(() => undefined);
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    run();
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id]);
  return null;
}
