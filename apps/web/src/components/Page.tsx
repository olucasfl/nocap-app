import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

/**
 * A moldura de toda tela fora do jogo (spec 045): no celular é a tela cheia de sempre; em tablet e computador ganha o
 * menu lateral (o mesmo do Hub) e uma coluna de conteúdo centralizada. `rail={false}` nas telas de partida, que usam
 * a tela inteira.
 */
export function Page({
  rail = true,
  className = '',
  children,
}: {
  rail?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`app${rail ? ' has-rail' : ''}${className ? ` ${className}` : ''}`}>
      {children}
      {rail && <BottomNav railOnly />}
    </div>
  );
}
