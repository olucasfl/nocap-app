import { useSyncExternalStore } from 'react';
import { ApiError } from './api-client';

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

/** Há conexão agora? (O navegador avisa quando a rede cai e volta.) */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Falha de rede (sem resposta do servidor), em vez de uma resposta de erro da API. */
export function isNetworkError(e: unknown): boolean {
  return !(e instanceof ApiError) && (!navigator.onLine || e instanceof TypeError);
}
