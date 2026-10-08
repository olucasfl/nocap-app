import { useEffect, useState, type ReactNode } from 'react';
import './party.css';

interface Layer {
  key: string;
  node: ReactNode;
  leaving: boolean;
}

/**
 * O palco do NoCap!: todas as trocas de estado acontecem aqui, na mesma tela. Quando a chave muda,
 * a camada antiga sai (fade e deslize) enquanto a nova entra por cima. Só `transform` e
 * `opacity`; sem animação para quem prefere menos movimento (ver party.css).
 */
export function Stage({ stageKey, children }: { stageKey: string; children: ReactNode }) {
  const [layers, setLayers] = useState<Layer[]>([
    { key: stageKey, node: children, leaving: false },
  ]);

  useEffect(() => {
    setLayers((ls) => {
      const last = ls[ls.length - 1];
      if (last && last.key === stageKey) {
        // Mesma tela: só atualiza o conteúdo (o estado interno dela continua).
        return ls.map((l, i) => (i === ls.length - 1 ? { ...l, node: children } : l));
      }
      return [
        ...ls.map((l) => ({ ...l, leaving: true })),
        { key: stageKey, node: children, leaving: false },
      ];
    });
  }, [stageKey, children]);

  useEffect(() => {
    if (!layers.some((l) => l.leaving)) return;
    const id = window.setTimeout(() => setLayers((ls) => ls.filter((l) => !l.leaving)), 260);
    return () => window.clearTimeout(id);
  }, [layers]);

  return (
    <div className="pstage">
      {layers.map((l) => (
        <div key={l.key} className={`pstage-layer${l.leaving ? ' out' : ''}`}>
          {l.node}
        </div>
      ))}
    </div>
  );
}
