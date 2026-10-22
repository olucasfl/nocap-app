import { CHOICE_LOCK_SEC, TUTORIAL, pendingHint, type SaveState, type TutorialHint } from '@nocap/games';
import type { PageName } from './game-logic';

/** O que o tutorial destaca; cada alvo é um `data-tut` na tela de jogo. */
export type TutorialTarget = 'press' | 'dock-upgrades' | 'buy-first' | 'page-close' | 'dock-grimoires' | 'dock-achievements' | 'tree' | 'first-object';

export interface CoachView {
  /** Muda a cada dica nova: refaz o cartão e roda a animação de entrada. */
  key: string;
  target: TutorialTarget | null;
  /** Etiqueta da seta ("Toque aqui..."); `null` sem seta. */
  label: string | null;
  title: string | null;
  text: string | null;
  /** Cartão do jogo livre: "Entendi" marca este cartão como visto. */
  dismiss: TutorialHint | null;
  /** Vai dentro do modal de escolha em vez de flutuar sobre a tela. */
  inline: boolean;
  /** Onde o cartão fica quando flutua: páginas pedem o pé da tela (o alvo está no meio ou no alto). */
  place: 'top' | 'bottom';
}

/** A página que cada cartão do jogo livre apresenta: abri-la já conta como visto. */
export const HINT_PAGE: Partial<Record<TutorialHint, PageName>> = { achievements: 'achievements', tree: 'tree' };

const NONE = { label: null, title: null, text: null, dismiss: null, inline: false, place: 'top' } as const;

/**
 * Dica do momento (spec 038, 4.6), ou `null` se o tutorial acabou ou o momento não é para ela (página de outro
 * assunto aberta, janela por cima). Só lê o save e a página aberta: a tela não guarda estado do tutorial.
 * `busy`: há uma janela por cima (colapso, regiões) e nada flutua.
 */
export function coachView(state: SaveState, page: PageName | null, busy = false): CoachView | null {
  const step = state.tutorial;
  if (step === 'done' || busy) return null;
  const pending = state.run.pending !== null;
  switch (step) {
    case TUTORIAL.TOUCH:
      return page ? null : { ...NONE, key: 'touch', target: 'press', label: 'Toque aqui para ganhar poeira' };
    case TUTORIAL.UPGRADE:
      if (page === 'upgrades') {
        return {
          ...NONE,
          key: 'upgrade-buy',
          target: 'buy-first',
          title: 'Sua primeira melhoria',
          text: 'Melhorias fazem a poeira render mais. Toque no preço para comprar.',
          place: 'bottom',
        };
      }
      return page
        ? null
        : {
            ...NONE,
            key: 'upgrade-open',
            target: 'dock-upgrades',
            label: 'Toque aqui',
            title: 'Parabéns!',
            text: 'Você já pode comprar sua primeira melhoria.',
          };
    case TUTORIAL.BACK:
      return page === 'upgrades'
        ? { ...NONE, key: 'back', target: 'page-close', title: 'Comprado!', text: 'Feche a página e volte a tocar no botão.', place: 'bottom' }
        : null;
    case TUTORIAL.FILL:
      return page
        ? null
        : {
            ...NONE,
            key: 'fill',
            target: 'press',
            label: 'Continue tocando',
            title: 'Encha a barra de energia',
            text: 'A cada toque a barra sobe. Quando encher, você ganha um grimório.',
          };
    case TUTORIAL.CHOOSE:
      return pending
        ? {
            ...NONE,
            key: 'choose',
            target: null,
            title: 'Você ganhou seu primeiro grimório!',
            text: `Escolha um: toque numa carta para marcá-la (ela destrava em ${String(CHOICE_LOCK_SEC).replace('.', ',')} s) e depois toque em Escolher.`,
            inline: true,
          }
        : null;
    case TUTORIAL.GRIMOIRES:
      return page || pending
        ? null
        : {
            ...NONE,
            key: 'grimoires',
            target: 'dock-grimoires',
            label: 'Toque aqui',
            title: 'Seus grimórios',
            text: 'Os que você escolher ficam guardados nesta página, junto com os que ainda faltam descobrir.',
          };
    default: {
      if (page || pending) return null;
      const hint = pendingHint(state);
      if (!hint) return null;
      return HINTS[hint];
    }
  }
}

const HINTS: Record<TutorialHint, CoachView> = {
  achievements: {
    ...NONE,
    key: 'hint-achievements',
    target: 'dock-achievements',
    label: 'Conquistas',
    title: 'Sua primeira conquista!',
    text: 'Conquistas são metas do jogo. Elas contam desde o seu primeiro toque; veja todas neste botão.',
    dismiss: 'achievements',
  },
  objects: {
    ...NONE,
    key: 'hint-objects',
    target: 'first-object',
    label: 'Pegue aqui',
    title: 'Objetos no espaço',
    text: 'Cometas, estrelas cadentes e satélites passam pela tela. Este fica parado: toque nele para ganhar poeira ou energia.',
    // Sem "Entendi": o cartão sai quando a pessoa pega o objeto (o controlador marca como visto).
  },
  tree: {
    ...NONE,
    key: 'hint-tree',
    target: 'tree',
    label: 'Árvore',
    title: 'Árvore de Habilidades',
    text: 'Conquistas, grimórios novos e colapsos dão Cintilas. É nesta árvore que elas viram melhorias permanentes. Os ramos abrem depois do seu primeiro colapso.',
    dismiss: 'tree',
  },
};

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
