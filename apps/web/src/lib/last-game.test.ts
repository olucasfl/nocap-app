import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gameOfPath, lastGame, rememberGame } from './last-game';

describe('último jogo', () => {
  beforeEach(() => {
    // o ambiente de teste não tem armazenamento do navegador: um simples mapa em memória
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      clear: () => mem.clear(),
    });
  });

  it('reconhece a tela de cada jogo, inclusive as internas', () => {
    expect(gameOfPath('/cor')?.name).toBe('Mesmíssima');
    expect(gameOfPath('/words/classic/fase/classic/3')?.name).toBe("Classic Word's");
    expect(gameOfPath('/fox-cap/desmorona')?.name).toBe('Desmorona!');
    expect(gameOfPath('/fox-cap')?.name).toBe('Fox Cap!');
    expect(gameOfPath('/ranking')).toBeNull();
    expect(gameOfPath('/corrida')).toBeNull();
  });

  it('guarda o último jogo aberto e ignora telas que não são jogo', () => {
    expect(lastGame()).toBeNull();
    rememberGame('/blocks');
    rememberGame('/perfil');
    expect(lastGame()).toEqual({ name: "Block's", to: '/blocks' });
  });

  it('um valor estragado no armazenamento não quebra nada', () => {
    localStorage.setItem('nocap-last-game', '{"name":1}');
    expect(lastGame()).toBeNull();
    localStorage.setItem('nocap-last-game', 'não é json');
    expect(lastGame()).toBeNull();
  });
});
