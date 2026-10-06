import { useRegisterSW } from 'virtual:pwa-register/react';
import './update-prompt.css';

/** Avisa quando há versão nova e deixa o jogador escolher o momento de atualizar (nunca no meio da partida). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;

  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <div className="update-prompt" role="status">
      <span>{needRefresh ? 'VERSÃO NOVA DISPONÍVEL' : 'PRONTO PARA JOGAR OFFLINE'}</span>
      <div className="update-prompt-actions">
        {needRefresh && (
          <button
            type="button"
            className="update-prompt-btn"
            onClick={() => updateServiceWorker(true)}
          >
            ATUALIZAR
          </button>
        )}
        <button type="button" className="update-prompt-btn ghost" onClick={close}>
          FECHAR
        </button>
      </div>
    </div>
  );
}
