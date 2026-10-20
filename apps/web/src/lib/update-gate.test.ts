import { describe, expect, it } from 'vitest';
import { canShowUpdate } from './update-gate';

describe('quando o aviso de versão nova pode aparecer', () => {
  it('nas telas calmas', () => {
    for (const p of ['/', '/ranking', '/amigos', '/amigos/ana', '/perfil', '/entrar'])
      expect(canShowUpdate(p, false), p).toBe(true);
  });

  it('nunca dentro de um jogo', () => {
    for (const p of ['/cor', '/tempo', '/eco', '/nocap', '/atravessa'])
      expect(canShowUpdate(p, false), p).toBe(false);
  });

  it('quem chega a uma sala sem estar nela vê o aviso antes de qualquer coisa', () => {
    for (const p of ['/sala', '/sala/ABCD', '/sala/ABCD/'])
      expect(canShowUpdate(p, false), p).toBe(true);
  });

  it('já dentro da sala: aparece no lobby, mas nunca no meio da partida nem no pódio', () => {
    expect(canShowUpdate('/sala/ABCD', true, 'lobby')).toBe(true);
    for (const phase of ['show', 'play', 'pick', 'reveal', 'final', 'micro', 'big'])
      expect(canShowUpdate('/sala/ABCD', true, phase), phase).toBe(false);
  });

  it('nem em tela calma enquanto a conta está conectada a uma sala', () => {
    expect(canShowUpdate('/', true)).toBe(false);
    expect(canShowUpdate('/perfil', true)).toBe(false);
  });

  it('barra final não atrapalha', () => {
    expect(canShowUpdate('/perfil/', false)).toBe(true);
  });
});
