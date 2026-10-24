/** As 4 telas da abertura: tema (kicker), frase de impacto e uma linha de apoio. Curta de propósito. */
export const STORY = [
  'A Perigeu perdeu o Sistema Solar.',
  'Todos se apagaram. Menos um.',
  'Aperte. Uma estrela acende.',
  'Os grimórios ainda estão lá.',
] as const;

export const STORY_KICKER = ['Ano 2187', 'Cabine central', 'Primeiro toque', 'Atlas'] as const;

export const STORY_SUB = [
  'Um a um, os instrumentos da estação foram morrendo no escuro.',
  'Um botão vermelho, ainda aceso, esperando alguém.',
  'A cada toque ela devolve poeira estelar, e o céu volta a existir.',
  'Registros de quem apertou antes de você, espalhados pelos planetas. Reencontre todos.',
] as const;

export interface StoryState {
  index: number;
  done: boolean;
}

export const storyStart: StoryState = { index: 0, done: false };

export function storyNext(s: StoryState): StoryState {
  if (s.done) return s;
  return s.index >= STORY.length - 1 ? { index: s.index, done: true } : { index: s.index + 1, done: false };
}

export function storySkip(s: StoryState): StoryState {
  return { ...s, done: true };
}

/** Texto do botão: a última tela fecha a história. */
export function storyButton(s: StoryState): string {
  return s.index >= STORY.length - 1 ? 'Começar' : 'Continuar';
}
