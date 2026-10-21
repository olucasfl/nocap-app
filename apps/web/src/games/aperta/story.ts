export const STORY = [
  'Ano 2187. A estação Perigeu perdeu contato com o Sistema Solar e todos os instrumentos se apagaram.',
  'Todos, menos um: um botão vermelho no centro da cabine, ainda aceso, esperando alguém.',
  'Cada vez que você o aperta, uma estrela distante acende de volta e deixa cair poeira estelar.',
  'Os grimórios, registros de quem apertou antes de você, estão espalhados pelos planetas. Aperte, e reencontre todos.',
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
