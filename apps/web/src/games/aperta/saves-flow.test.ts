import { describe, expect, it } from 'vitest';
import { afterPick, apertaAccess, askDelete, backOrClose, cancelDelete, savesModalStart } from './saves-flow';

describe('modal de saves: apagar em 2 passos', () => {
  it('o primeiro toque só pede confirmação, não apaga', () => {
    expect(askDelete(savesModalStart, 1)).toEqual({ confirmingDelete: 1 });
  });

  it('pedir o outro espaço troca a pergunta (nunca duas ao mesmo tempo)', () => {
    expect(askDelete({ confirmingDelete: 1 }, 2)).toEqual({ confirmingDelete: 2 });
  });

  it('cancelar volta ao estado inicial', () => {
    expect(cancelDelete()).toEqual(savesModalStart);
  });

  it('Esc com confirmação aberta fecha só a confirmação', () => {
    expect(backOrClose({ confirmingDelete: 2 })).toEqual({ state: savesModalStart, close: false });
  });

  it('Esc sem confirmação fecha o modal', () => {
    expect(backOrClose(savesModalStart).close).toBe(true);
  });
});

describe('convidado', () => {
  it('só quem tem conta joga; o convidado vê o convite', () => {
    expect(apertaAccess('ready', false)).toBe('guest');
    expect(apertaAccess('ready', true)).toBe('player');
  });

  it('enquanto a sessão carrega, ninguém é tratado como convidado', () => {
    expect(apertaAccess('loading', false)).toBe('checking');
  });
});

describe('depois de escolher o save', () => {
  it('save sem história vista começa pela história; com ela vista, vai ao jogo', () => {
    expect(afterPick(false)).toBe('story');
    expect(afterPick(true)).toBe('game');
  });
});
