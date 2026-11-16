import { useEffect, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { activityFor } from '@/lib/activity';
import { useAuth } from '@/lib/auth';
import { sendPing } from '@/lib/friends';

/** De quanto em quanto tempo o app aberto avisa que a pessoa está online (e o que está fazendo). */
export const PING_MS = 20_000;
/** Ao trocar de tela espera um pouco antes de avisar (navegar rápido não vira rajada de avisos). */
const CHANGE_MS = 800;

/**
 * Não aparece nada: enquanto a conta está com o app aberto e visível, avisa o servidor a cada ~20 s, ao voltar para a
 * aba e logo depois de trocar de tela, dizendo onde está (num jogo, numa sala ou no menu). É disso que vem o "online" e o
 * "jogando X" dos amigos.
 */
export function PresenceBeat() {
  const user = useAuth((s) => s.user);
  const id = user?.id;
  const where = useRouterState({
    select: (s) => {
      const jogo = (s.location.search as { jogo?: string } | undefined)?.jogo ?? null;
      const a = activityFor(s.location.pathname, jogo);
      return `${a.state}|${a.game ?? ''}`;
    },
  });
  const current = useRef(where);
  current.current = where;
  const ping = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!id) return;
    ping.current = () => {
      if (document.visibilityState !== 'visible') return;
      const [state, game] = current.current.split('|');
      const a =
        state === 'game' && game
          ? ({ state: 'game', game } as const)
          : state === 'room'
            ? ({ state: 'room', game: null } as const)
            : ({ state: 'menu', game: null } as const);
      void sendPing(a).catch(() => undefined);
    };
    const now = () => ping.current();
    now();
    const timer = window.setInterval(now, PING_MS);
    document.addEventListener('visibilitychange', now);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', now);
    };
  }, [id]);

  // trocou de tela: avisa na hora (com uma pequena espera)
  useEffect(() => {
    if (!id) return;
    const t = window.setTimeout(() => ping.current(), CHANGE_MS);
    return () => window.clearTimeout(t);
  }, [id, where]);
  return null;
}
