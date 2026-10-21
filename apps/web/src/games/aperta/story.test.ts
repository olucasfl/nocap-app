import { describe, expect, it } from 'vitest';
import { STORY, storyButton, storyNext, storySkip, storyStart } from './story';

describe('história', () => {
  it('tem 4 telas', () => {
    expect(STORY).toHaveLength(4);
  });

  it('avança tela a tela e só termina depois da quarta', () => {
    let s = storyStart;
    for (let i = 1; i < STORY.length; i++) {
      s = storyNext(s);
      expect(s).toEqual({ index: i, done: false });
    }
    s = storyNext(s);
    expect(s.done).toBe(true);
    expect(s.index).toBe(STORY.length - 1);
  });

  it('pular termina de qualquer tela', () => {
    expect(storySkip(storyNext(storyStart)).done).toBe(true);
  });

  it('o botão vira "Começar" na última tela', () => {
    expect(storyButton(storyStart)).toBe('Continuar');
    expect(storyButton({ index: STORY.length - 1, done: false })).toBe('Começar');
  });
});
