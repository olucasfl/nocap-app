import { promptInstall, useInstallState } from '@/lib/install';
import './install-app.css';

/**
 * Convite para instalar o NoCap (computador, Android) ou a dica de como fazer no iPhone. Some
 * quando o app já está instalado ou o navegador não oferece instalação. `compact` é a versão
 * pequena do menu lateral.
 */
export function InstallApp({ compact = false }: { compact?: boolean }) {
  const state = useInstallState();
  if (state === 'installed' || state === 'none') return null;

  if (state === 'ios') {
    return (
      <p className={`ia-ios mono${compact ? ' compact' : ''}`}>
        {compact
          ? 'Instale: Compartilhar > Adicionar à Tela de Início'
          : 'Para instalar no iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".'}
      </p>
    );
  }

  return (
    <button
      type="button"
      className={`ia btn alt${compact ? ' compact' : ''}`}
      data-sfx="start"
      onClick={() => void promptInstall()}
    >
      {compact ? 'Instalar' : 'Instalar o NoCap'}
    </button>
  );
}
