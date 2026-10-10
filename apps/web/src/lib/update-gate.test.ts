import { describe, expect, it } from 'vitest';
import { canShowUpdate } from './update-gate';

describe('quando o aviso de versão nova pode aparecer', () => {
  it('nas telas calmas', () => {
    for (const p of ['/', '/ranking', '/historico', '/amigos', '/amigos/ana', '/perfil', '/entrar'])
      expect(canShowUpdate(p, false), p).toBe(true);
  });

  it('nunca dentro de jogo, sala, lobby ou pódio', () => {
    for (const p of ['/cor', '/tempo', '/eco', '/nocap', '/sala', '/sala/ABCD'])
      expect(canShowUpdate(p, false), p).toBe(false);
  });

  it('nem em tela calma enquanto a conta está conectada a uma sala', () => {
    expect(canShowUpdate('/', true)).toBe(false);
    expect(canShowUpdate('/perfil', true)).toBe(false);
  });

  it('barra final não atrapalha', () => {
    expect(canShowUpdate('/perfil/', false)).toBe(true);
  });
});
