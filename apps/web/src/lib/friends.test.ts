import { describe, expect, it } from 'vitest';
import { actionLabel, stateLabel } from './friends';

describe('rótulos de amizade', () => {
  it('só há ação para quem não é amigo ou já pediu a você', () => {
    expect(actionLabel('none')).toBe('Adicionar');
    expect(actionLabel('incoming')).toBe('Aceitar');
    expect(actionLabel('friends')).toBeNull();
    expect(actionLabel('outgoing')).toBeNull();
  });

  it('descreve o estado quando não há ação', () => {
    expect(stateLabel('friends')).toBe('AMIGOS');
    expect(stateLabel('outgoing')).toBe('PEDIDO ENVIADO');
    expect(stateLabel('none')).toBe('');
  });
});
