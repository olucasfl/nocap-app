import { useRegisterSW } from 'virtual:pwa-register/react';
import './update-prompt.css';

/** Avisa quando há versão nova e deixa o jogador escolher o momento de atualizar (nunca no meio da partida). */
export function UpdatePrompt() {
  // O aviso "pronto para jogar offline" do primeiro acesso foi retirado: só avisamos de versão nova.
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  const close = () => setNeedRefresh(false);

  return (
    <div className="update-prompt" role="status">
      <span>VERSÃO NOVA DISPONÍVEL</span>
      <div className="update-prompt-actions">
        <button
          type="button"
          className="update-prompt-btn"
          onClick={() => updateServiceWorker(true)}
        >
          ATUALIZAR
        </button>
        <button type="button" className="update-prompt-btn ghost" onClick={close}>
          FECHAR
        </button>
      </div>
    </div>
  );
}
