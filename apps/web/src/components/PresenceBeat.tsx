import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { sendPing } from '@/lib/friends';

/** De quanto em quanto tempo o app aberto avisa que a pessoa está online. */
export const PING_MS = 45_000;

/**
 * Não aparece nada: enquanto a conta está com o app aberto e visível, avisa o servidor a cada
 * ~45 s (e ao voltar para a aba). É disso que vem o "online" e o "visto por último" dos amigos.
 */
export function PresenceBeat() {
  const user = useAuth((s) => s.user);
  const id = user?.id;
  useEffect(() => {
    if (!id) return;
    const ping = () => {
      if (document.visibilityState === 'visible') void sendPing().catch(() => undefined);
    };
    ping();
    const timer = window.setInterval(ping, PING_MS);
    document.addEventListener('visibilitychange', ping);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', ping);
    };
  }, [id]);
  return null;
}
