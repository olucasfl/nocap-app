import { useEffect, useState, type ReactNode } from 'react';
import { serverNow } from '@/lib/rooms';

/** O relógio do servidor, atualizado a cada `ms` (os desafios se guiam por ele). */
export function useServerNow(ms = 100): number {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/** O comando: sempre no mesmo lugar e no mesmo estilo (a pegadinha está em ler com pressa). */
export function CommandBar({ text }: { text: string }) {
  return (
    <div className="pcmd" role="status">
      <span className="mono">COMANDO</span>
      <b>{text}</b>
    </div>
  );
}

/** Tela grande com um recado (PREPARE, TRAVADO...). */
export function Big({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="pbig">
      <div>
        <b>{title}</b>
        {sub && <p className="mono">{sub}</p>}
      </div>
    </div>
  );
}
