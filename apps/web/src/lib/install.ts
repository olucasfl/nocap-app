import { useSyncExternalStore } from 'react';

/** O evento que o Chrome/Edge/Android dão quando o app pode ser instalado. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Chamar uma vez na abertura: guarda o convite de instalação para usar num botão nosso. */
export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

/** Já está rodando como app instalado (janela própria)? */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** iPhone/iPad (Safari não tem botão de instalar: o jeito é "Adicionar à Tela de Início"). */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

export type InstallState = 'installed' | 'available' | 'ios' | 'none';

export function installState(): InstallState {
  if (isStandalone()) return 'installed';
  if (deferred) return 'available';
  if (isIos()) return 'ios';
  return 'none';
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    installState,
    () => 'none',
  );
}

/** Abre o diálogo de instalação do navegador. `true` se a pessoa aceitou. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  notify();
  return outcome === 'accepted';
}
