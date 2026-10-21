import { TUTORIAL_STEPS } from '@nocap/games';
import type { PageName } from './game-logic';

/** O que o tutorial destaca; cada alvo é um `data-tut` na tela de jogo. */
export type TutorialTarget = 'press' | 'ok' | 'dock-upgrades' | 'buy-pulse' | 'dock-grimoires' | 'grimoires-page';

export interface TutorialView {
  /** Passo mostrado no cartão (1 a 5). */
  step: number;
  total: number;
  target: TutorialTarget;
  title: string;
  text: string;
  /** Mostra a seta "Toque aqui" (a página inteira não precisa de seta). */
  arrow: boolean;
  /** Passo 5 com a página aberta: o cartão ganha "Começar a jogar". */
  finish: boolean;
}

/** O passo 3 vira 4 assim que a página de Melhorias abre; a tela mostra o 4 sem esperar o save. */
export function displayStep(step: number, page: PageName | null): number {
  return step === 3 && page === 'upgrades' ? 4 : step;
}

/** Textos, alvo e seta de cada passo (spec 038, 4.6). Os passos 4 e 5 voltam ao botão da dock se a página não está aberta. */
export function tutorialView(step: number, page: PageName | null): TutorialView {
  const shown = displayStep(step, page);
  const base = { step: shown, total: TUTORIAL_STEPS, arrow: true, finish: false };
  switch (shown) {
    case 1:
      return { ...base, target: 'press', title: 'Aperte o botão', text: 'Cada toque rende poeira estelar e enche a barra de energia. Toque no botão grande.' };
    case 2:
      return { ...base, target: 'ok', title: 'Seu primeiro grimório', text: 'Quando a energia enche, você ganha um grimório. Leia este e toque em Entendi.' };
    case 3:
      return { ...base, target: 'dock-upgrades', title: 'Hora de melhorar', text: 'Toque em Melhorias para gastar a poeira que você juntou.' };
    case 4:
      return page === 'upgrades'
        ? { ...base, target: 'buy-pulse', title: 'Compre sua primeira melhoria', text: 'O Pulso Solar faz cada toque render mais poeira. Toque no preço para comprar.' }
        : { ...base, target: 'dock-upgrades', title: 'Hora de melhorar', text: 'Toque em Melhorias para gastar a poeira que você juntou.' };
    default:
      return page === 'grimoires'
        ? {
            ...base,
            step: 5,
            target: 'grimoires-page',
            arrow: false,
            finish: true,
            title: 'Sua coleção',
            text: 'Aqui ficam os grimórios que você tem, os que ainda estão trancados e o Atlas. Veja com calma e comece a jogar.',
          }
        : { ...base, step: 5, target: 'dock-grimoires', title: 'Agora os grimórios', text: 'Toque no ícone do livro para ver a sua coleção.' };
  }
}

/** Qual página o passo deixa abrir (atalhos de teclado e a dock respeitam isto). */
export function tutorialPageAllowed(step: number, page: PageName): boolean {
  if (step === 3 || step === 4) return page === 'upgrades';
  if (step === 5) return page === 'grimoires';
  return false;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function padRect(r: Rect, pad: number, bounds: { w: number; h: number }): Rect {
  const x = Math.max(0, r.x - pad);
  const y = Math.max(0, r.y - pad);
  return { x, y, w: Math.min(bounds.w, r.x + r.w + pad) - x, h: Math.min(bounds.h, r.y + r.h + pad) - y };
}

/** Quatro faixas ao redor do buraco: juntas cobrem tudo menos o alvo, que continua tocável. */
export function veilPieces(hole: Rect | null, bounds: { w: number; h: number }): Rect[] {
  if (!hole) return [{ x: 0, y: 0, w: bounds.w, h: bounds.h }];
  const right = hole.x + hole.w;
  const bottom = hole.y + hole.h;
  return [
    { x: 0, y: 0, w: bounds.w, h: hole.y },
    { x: 0, y: bottom, w: bounds.w, h: Math.max(0, bounds.h - bottom) },
    { x: 0, y: hole.y, w: hole.x, h: hole.h },
    { x: right, y: hole.y, w: Math.max(0, bounds.w - right), h: hole.h },
  ].filter((p) => p.w > 0 && p.h > 0);
}

/** O cartão fica no topo, a não ser que o alvo esteja na metade de cima (aí vai para baixo e não cobre o alvo). */
export function cardSide(hole: Rect | null, viewH: number): 'top' | 'bottom' {
  if (!hole) return 'top';
  return hole.y + hole.h / 2 < viewH * 0.45 ? 'bottom' : 'top';
}

/** Altura que a seta (etiqueta + ponta) precisa para caber sem encostar no alvo. */
export const ARROW_SPACE = 56;

/**
 * A seta fica do lado do alvo que tem espaço livre: o cartão cobre `topBlock` px no alto e `bottomBlock` embaixo.
 * Com espaço nos dois lados, vai acima quando o alvo está na metade de baixo.
 */
export function arrowSide(hole: Rect, viewH: number, topBlock = 0, bottomBlock = 0): 'above' | 'below' {
  const above = hole.y - topBlock;
  const below = viewH - (hole.y + hole.h) - bottomBlock;
  if (above < ARROW_SPACE) return 'below';
  if (below < ARROW_SPACE) return 'above';
  return hole.y + hole.h / 2 > viewH * 0.5 ? 'above' : 'below';
}

/** Centro horizontal da seta, mantido dentro da tela. */
export function arrowX(hole: Rect, viewW: number, halfWidth: number): number {
  return Math.min(viewW - halfWidth - 8, Math.max(halfWidth + 8, hole.x + hole.w / 2));
}
