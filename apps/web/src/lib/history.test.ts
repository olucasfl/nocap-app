import { colorPresets, encodeAnswer, generateColorRound } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { colorRounds, formatPlayedAt, kindLabel, modeLabel, type HistoryItem } from './history';

const base: HistoryItem = {
  matchId: 'm',
  game: 'color',
  mode: 'classic',
  kind: 'solo',
  seed: 'seed-1',
  playedAt: '2026-10-06T15:00:00.000Z',
  totalScore: 500,
  placement: null,
  answers: null,
};

describe('colorRounds', () => {
  it('regenera os alvos pela seed e dá 10 para respostas idênticas', () => {
    const settings = colorPresets.classic!;
    const answers = Array.from({ length: settings.rounds }, (_, i) =>
      encodeAnswer(generateColorRound('seed-1', settings, i)),
    );
    const rounds = colorRounds({ ...base, answers })!;
    expect(rounds).toHaveLength(settings.rounds);
    expect(rounds.every((r) => r.score === 10)).toBe(true);
    expect(rounds[0]!.target).toEqual(generateColorRound('seed-1', settings, 0));
  });

  it('devolve null sem respostas (detalhe expirado) ou com modo desconhecido', () => {
    expect(colorRounds(base)).toBeNull();
    expect(colorRounds({ ...base, mode: 'zzz', answers: [1] })).toBeNull();
  });
});

describe('rótulos', () => {
  it('traduz modo e tipo e mantém o que não conhece', () => {
    expect(modeLabel('flash')).toBe('Flash');
    expect(modeLabel('quick')).toBe('Rápido');
    expect(kindLabel('daily')).toBe('Daily');
    expect(modeLabel('x')).toBe('x');
  });
});

describe('formatPlayedAt', () => {
  it('usa dd/mm e o fuso de São Paulo', () => {
    expect(formatPlayedAt('2026-10-06T15:05:00.000Z')).toBe('06/10 12:05');
    expect(formatPlayedAt('2026-03-10T02:30:00.000Z')).toBe('09/03 23:30');
  });
});
