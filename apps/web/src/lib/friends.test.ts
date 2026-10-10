import { describe, expect, it } from 'vitest';
import { actionLabel, ago, presenceText, stateLabel } from './friends';

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

describe('visto por último', () => {
  // 15/10/2026 15:00 em São Paulo (UTC-3) = 18:00 UTC.
  const now = Date.parse('2026-10-15T18:00:00.000Z');
  const at = (iso: string) => ago(iso, now);

  it('conta minutos, depois horas no mesmo dia', () => {
    expect(at('2026-10-15T17:59:40.000Z')).toBe('agora');
    expect(at('2026-10-15T17:55:00.000Z')).toBe('há 5 min');
    expect(at('2026-10-15T15:30:00.000Z')).toBe('há 2 h');
  });

  it('ontem e antes trazem o horário de São Paulo', () => {
    expect(at('2026-10-14T17:30:00.000Z')).toBe('ontem às 14:30');
    expect(at('2026-10-12T12:05:00.000Z')).toBe('12/10 às 09:05');
  });

  it('o dia vira à meia-noite de São Paulo, não à de Greenwich', () => {
    // 02:00 UTC de 15/10 ainda é 23:00 de 14/10 em São Paulo: ontem.
    expect(at('2026-10-15T02:00:00.000Z')).toBe('ontem às 23:00');
  });

  it('online agora, visto há tanto ou ainda não entrou', () => {
    expect(presenceText({ online: true, lastSeenAt: null }, now)).toBe('Online agora');
    expect(presenceText({ online: false, lastSeenAt: '2026-10-15T17:55:00.000Z' }, now)).toBe(
      'Visto há 5 min',
    );
    expect(presenceText({ online: false, lastSeenAt: null }, now)).toBe('Ainda não entrou');
  });
});
