import { CHOICE_LOCK_SEC, TUTORIAL, TUTORIAL_STEPS, pendingHint, type SaveState, type TutorialHint } from '@nocap/games';
import { collapseView, type PageName } from './game-logic';

/** O que o tutorial destaca; cada alvo é um `data-tut` na tela de jogo. */
export type TutorialTarget = 'press' | 'dock-upgrades' | 'buy-first' | 'page-close' | 'dock-grimoires' | 'dock-achievements' | 'tree' | 'first-object' | 'goal' | 'dust' | 'energy';

export interface CoachView {
  /** Muda a cada dica nova: refaz o cartão e roda a animação de entrada. */
  key: string;
  /** O que o jogador deve tocar: só ele fica livre; o resto da tela escurece e não responde (ver `Tutorial.tsx`). */
  target: TutorialTarget | null;
  /** Algo para olhar, sem tocar: fica iluminado, mas não responde ao toque. */
  glow: TutorialTarget | null;
  /** A seta aponta para o alvo ou para o que só ilumina. */
  arrowOn: 'target' | 'glow';
  /** "Passo 2 de 6" nos passos guiados, "Dica" nos cartões do jogo livre. */
  step: string | null;
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
export const HINT_PAGE: Partial<Record<TutorialHint, PageName>> = { achievements: 'achievements', tree: 'tree', generators: 'upgrades' };

const NONE = { glow: null, arrowOn: 'target', step: null, label: null, title: null, text: null, dismiss: null, inline: false, place: 'top' } as const;

const stepName = (n: number) => `Passo ${n} de ${TUTORIAL_STEPS}`;

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
      if (page) return null;
      if (state.run.clicks < 3) {
        return {
          ...NONE,
          key: 'touch',
          step: stepName(1),
          target: 'press',
          label: 'Toque aqui para ganhar poeira',
          title: 'Bem-vindo à Perigeu',
          text: 'Cada toque no botão rende poeira estelar. Comece por ele.',
        };
      }
      // A poeira é o dinheiro do jogo: o contador acende uma vez, logo nos primeiros toques.
      if (state.run.clicks < 6) {
        return {
          ...NONE,
          key: 'touch-dust',
          step: stepName(1),
          target: 'press',
          glow: 'dust',
          arrowOn: 'glow',
          label: 'Sua poeira',
          title: 'Esta é a sua poeira',
          text: 'É o dinheiro do jogo: com ela você compra melhorias. Continue tocando.',
        };
      }
      return { ...NONE, key: 'touch-more', step: stepName(1), target: 'press', label: 'Continue tocando', title: 'Junte poeira', text: 'Quando juntar o bastante, a primeira melhoria é liberada.' };
    case TUTORIAL.UPGRADE:
      if (page === 'upgrades') {
        return {
          ...NONE,
          key: 'upgrade-buy',
          step: stepName(2),
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
            step: stepName(2),
            target: 'dock-upgrades',
            label: 'Toque aqui',
            title: 'Parabéns!',
            text: 'Você já pode comprar sua primeira melhoria.',
          };
    case TUTORIAL.BACK:
      return page === 'upgrades'
        ? { ...NONE, key: 'back', step: stepName(3), target: 'page-close', title: 'Comprado!', text: 'Feche a página e volte a tocar no botão.', place: 'bottom' }
        : null;
    case TUTORIAL.FILL:
      return page
        ? null
        : {
            ...NONE,
            key: 'fill',
            step: stepName(4),
            target: 'press',
            glow: 'energy',
            // Sem etiqueta: ao lado da barra não cabe nenhuma sem cobrir o botão; o brilho e o cartão bastam.
            title: 'Encha a barra de energia',
            text: 'A cada toque a barra sobe. Quando encher, você ganha um grimório: um poder permanente.',
          };
    case TUTORIAL.CHOOSE:
      return pending
        ? {
            ...NONE,
            key: 'choose',
            step: stepName(5),
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
            step: stepName(6),
            target: 'dock-grimoires',
            label: 'Toque aqui',
            title: 'Seus grimórios',
            text: 'Os que você escolher ficam guardados aqui. Cada um existe em 4 raridades: pegar o mesmo de novo sobe o nível e, mais para a frente, evolui para uma raridade maior.',
          };
    default: {
      if (page || pending) return null;
      const hint = pendingHint(state);
      if (!hint) return null;
      return hint === 'collapse' ? collapseHint(state) : HINTS[hint];
    }
  }
}

/** O cartão do colapso: explica o que é e já diz a meta do próximo (poeira e escolhas). */
function collapseHint(state: SaveState): CoachView {
  const view = collapseView(state);
  const dust = view.requirements[0]!;
  const picks = view.requirements[1]!;
  return {
    ...NONE,
    key: 'hint-collapse',
    step: 'Dica',
    target: 'goal',
    label: 'Sua meta',
    title: 'O colapso da estrela',
    text: `Quando a meta for cumprida, o botão de colapso se libera e só colapsa quando você tocar nele: você guarda um grimório proibido, ganha Cintilas e recomeça mais forte. A sua meta: ${dust.text.split(' de ')[1]} de poeira, ${picks.text.split(' de ')[1]} escolhas de grimório e um marco da vida. Toque no botão Meta, no canto de cima, para ver.`,
    dismiss: 'collapse',
  };
}

const HINTS: Record<Exclude<TutorialHint, 'collapse'>, CoachView> = {
  generators: {
    ...NONE,
    key: 'hint-generators',
    step: 'Dica',
    target: 'dock-upgrades',
    label: 'Geradores',
    title: 'Poeira sem tocar',
    text: 'Geradores ganham poeira por você, o tempo todo, até com o jogo parado. Abra Melhorias e escolha a aba Geradores.',
    dismiss: 'generators',
  },
  achievements: {
    ...NONE,
    key: 'hint-achievements',
    step: 'Dica',
    target: 'dock-achievements',
    label: 'Conquistas',
    title: 'Sua primeira conquista!',
    text: 'Conquistas são metas do jogo. Elas contam desde o seu primeiro toque; veja todas neste botão.',
    dismiss: 'achievements',
  },
  objects: {
    ...NONE,
    key: 'hint-objects',
    step: 'Dica',
    target: 'first-object',
    label: 'Pegue aqui',
    title: 'Objetos no espaço',
    text: 'Cometas, estrelas cadentes e satélites passam pela tela. Este fica parado: toque nele para ganhar poeira ou energia.',
    // Sem "Entendi": o cartão sai quando a pessoa pega o objeto (o controlador marca como visto).
  },
  tree: {
    ...NONE,
    key: 'hint-tree',
    step: 'Dica',
    target: 'tree',
    label: 'Árvore',
    title: 'Você ganhou sua primeira Cintila!',
    text: 'Abra a Árvore de Habilidades: é lá que as Cintilas viram melhorias permanentes. Os ramos abrem depois do seu primeiro colapso.',
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

const overlap = (a: Rect, b: Rect): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

export const inflate = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 });

/**
 * Onde pôr o cartão: varre a tela em passos e fica com o ponto que não cobre nada de `avoid` (alvo, seta, botão do
 * jogo) mais perto de `anchor`; se nenhum escapa, o que cobre menos. Serve igual para celular deitado, em pé e PC.
 */
export function placeCard(card: { w: number; h: number }, bounds: { w: number; h: number }, avoid: Rect[], anchor: { x: number; y: number }, margin = 8, step = 8): { x: number; y: number } {
  const maxX = Math.max(margin, bounds.w - card.w - margin);
  const maxY = Math.max(margin, bounds.h - card.h - margin);
  let best = { x: Math.min(maxX, Math.max(margin, anchor.x)), y: Math.min(maxY, Math.max(margin, anchor.y)) };
  let bestScore = Infinity;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = margin; x <= maxX; x += step) xs.push(x);
  for (let y = margin; y <= maxY; y += step) ys.push(y);
  if (xs[xs.length - 1] !== maxX) xs.push(maxX);
  if (ys[ys.length - 1] !== maxY) ys.push(maxY);
  // A âncora exata também é candidata: o passo da grade não a deve arredondar quando está livre.
  if (!xs.includes(best.x)) xs.push(best.x);
  if (!ys.includes(best.y)) ys.push(best.y);
  for (const y of ys) {
    for (const x of xs) {
      const r = { x, y, w: card.w, h: card.h };
      const covered = avoid.reduce((sum, a) => sum + overlap(r, a), 0);
      // O que cobre algo pesa muito mais que a distância; entre os livres vale o mais perto da âncora.
      const score = covered * 1000 + Math.hypot(x - anchor.x, y - anchor.y);
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

export type ArrowPlacement = 'above' | 'below' | 'left' | 'right';

/**
 * Onde a seta fica em volta do alvo: acima ou abaixo, e ao lado quando o alvo é uma coluna alta e estreita (a barra de
 * energia) ou quando não sobra altura. Do lado de dentro da tela com mais espaço livre.
 */
export function arrowPlacement(hole: Rect, bounds: { w: number; h: number }): ArrowPlacement {
  const tall = hole.h > bounds.h * 0.4 && hole.w < bounds.w * 0.25;
  const roomAbove = hole.y >= ARROW_SPACE;
  const roomBelow = bounds.h - (hole.y + hole.h) >= ARROW_SPACE;
  if (tall || (!roomAbove && !roomBelow)) return hole.x + hole.w / 2 > bounds.w / 2 ? 'left' : 'right';
  return arrowSide(hole, bounds.h);
}

/** Retângulo que a seta e a etiqueta ocupam (o cartão e a mão fogem dele). */
export function arrowBox(hole: Rect, bounds: { w: number; h: number }, side: ArrowPlacement, labelW = 220, h = ARROW_SPACE + 2): Rect {
  if (side === 'left') return { x: hole.x - labelW, y: hole.y + hole.h / 2 - h / 2, w: labelW, h };
  if (side === 'right') return { x: hole.x + hole.w, y: hole.y + hole.h / 2 - h / 2, w: labelW, h };
  const cx = arrowX(hole, bounds.w, labelW / 2);
  return { x: cx - labelW / 2, y: side === 'above' ? hole.y - h : hole.y + hole.h, w: labelW, h };
}
