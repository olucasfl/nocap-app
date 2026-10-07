import { useEffect, useRef, useState } from 'react';
import { restoreSession } from '@/lib/auth';
import { sfx } from '@/lib/sfx';
import { useOnline } from '@/lib/network';
import { WifiOff } from './icons';
import './network.css';

/**
 * Faixa no topo: "Você está offline" enquanto não há rede e "Conexão restabelecida" por alguns
 * segundos quando volta. Ao voltar, confere a sessão de novo (offline ela fica como estava).
 */
export function NetworkStatus() {
  const online = useOnline();
  const [back, setBack] = useState(false);
  const wasOffline = useRef(!navigator.onLine);

  // As telas abrem espaço para a faixa não cobrir o topo (botão Voltar, título).
  useEffect(() => {
    document.documentElement.dataset.net = online ? 'on' : 'off';
    return () => {
      delete document.documentElement.dataset.net;
    };
  }, [online]);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setBack(false);
      sfx.offline();
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setBack(true);
    sfx.online();
    void restoreSession();
    const t = window.setTimeout(() => setBack(false), 3500);
    return () => window.clearTimeout(t);
  }, [online]);

  if (online && !back) return null;
  return (
    <div className={`ns ${online ? 'on' : 'off'}`} role="status" aria-live="polite">
      {online ? (
        <b>Conexão restabelecida</b>
      ) : (
        <>
          <WifiOff size={18} />
          <span>
            <b>Você está offline</b>
            <small>
              A Cor guarda suas partidas e envia quando a conexão voltar. O Tempo não salva offline.
            </small>
          </span>
        </>
      )}
    </div>
  );
}
