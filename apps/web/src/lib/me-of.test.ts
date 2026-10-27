import { describe, expect, it } from 'vitest';
import { meOf, type RoomSnapshot } from './rooms';

const snap = (extra: Partial<RoomSnapshot>) => extra as RoomSnapshot;

describe('meOf: quem sou eu na sala', () => {
  it('conta: usa o id da conta', () => {
    expect(meOf(snap({ me: 'srv' }), 'conta')).toBe('conta');
  });

  it('convidado (sem conta no aparelho): usa o id que o servidor mandou, em qualquer jogo', () => {
    expect(meOf(snap({ me: 'g1' }))).toBe('g1');
    expect(meOf(snap({ bola: { me: 'g2' } as RoomSnapshot['bola'] }))).toBe('g2');
    expect(meOf(snap({ desmorona: { me: 'g3' } as RoomSnapshot['desmorona'] }))).toBe('g3');
  });

  it('sem sala nem conta: ninguém', () => {
    expect(meOf(null)).toBeUndefined();
    expect(meOf(snap({ me: null }))).toBeUndefined();
  });
});
