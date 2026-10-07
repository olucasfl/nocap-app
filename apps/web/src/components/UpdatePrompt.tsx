import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './update-prompt.css';

/** De quanto em quanto tempo o app procura versão nova enquanto está aberto. */
const CHECK_EVERY_MS = 60_000;

/**
 * Versão nova: a tela fica travada por cima do app até a pessoa tocar em ATUALIZAR. Jogar com a
 * versão velha misturava regras (notas, modos) com as do servidor, então não há como fechar o
 * aviso. Também procura versão nova a cada minuto e ao voltar para o app.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => undefined);
      };
      window.setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
  const [updating, setUpdating] = useState(false);

  if (!needRefresh) return null;

  return (
    <div className="update-gate" role="alertdialog" aria-modal="true" aria-labelledby="up-title">
      <div className="update-card">
        <div className="mono update-tag">VERSÃO NOVA</div>
        <h2 id="up-title">Atualize para continuar</h2>
        <p className="mono">
          Saiu uma versão nova do NoCap. Toque em atualizar para voltar a jogar.
        </p>
        <button
          type="button"
          className="btn alt"
          data-sfx="start"
          disabled={updating}
          onClick={() => {
            setUpdating(true);
            void updateServiceWorker(true);
          }}
        >
          {updating ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>
    </div>
  );
}
