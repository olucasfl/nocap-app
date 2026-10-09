import { useEffect, useRef, useState } from 'react';
import { restoreSession } from '@/lib/auth';
import { sfx } from '@/lib/sfx';
import { useOnline } from '@/lib/network';
import { WifiOff } from './icons';
import './network.css';

/**
 * Pílula no topo: "Sem conexão" enquanto não há rede e "De volta online" por alguns
 * segundos quando volta. Ao voltar, confere a sessão de novo (offline ela fica como estava).
 */
export function NetworkStatus() {
  const online = useOnline();
  const [back, setBack] = useState(false);
  const wasOffline = useRef(!navigator.onLine);

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
        <span>De volta online</span>
      ) : (
        <>
          <WifiOff size={14} />
          <span>Sem conexão</span>
        </>
      )}
    </div>
  );
}
