import { useEffect, useState } from 'react';

/**
 * A transição do Fox GP (spec 079, 4.1): faixas inclinadas do tema (azul, laranja, branca e a quadriculada) varrem a tela
 * com o nome da etapa e saem, sem tela preta e sem parar o jogo (só transform e opacity, ~700 ms, ease-in-out).
 * Com `prefers-reduced-motion`, vira um aviso curto que só aparece e some.
 */
export function GpWipe({ text }: { text: string }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setGone(true), 1300);
    return () => window.clearTimeout(t);
  }, []);
  if (gone) return null;
  return (
    <div className="gpw" aria-hidden="true" data-testid="gp-wipe">
      <i className="gpw-band b1" />
      <i className="gpw-band b2" />
      <i className="gpw-band b3" />
      <i className="gpw-band b4 gp-checker" />
      <b className="gpw-text">{text}</b>
    </div>
  );
}
