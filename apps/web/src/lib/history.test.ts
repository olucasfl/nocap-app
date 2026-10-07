import {
  colorPresets,
  encodeAnswer,
  generateColorRound,
  generateTimeRound,
  timePresets,
} from '@nocap/games';
import { describe, expect, it } from 'vitest';
import {
  colorRounds,
  formatPlayedAt,
  classifyMatch,
  gameLabel,
  kindLabel,
  matchMax,
  modeLabel,
  scoreParts,
  timeRounds,
  type HistoryItem,
} from './history';

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

describe('Tempo no histórico', () => {
  const time = { ...base, game: 'time', mode: 'classic', seed: 'seed-t' };

  it('regenera o alvo pela seed e recalcula a nota', () => {
    const settings = timePresets.classic!;
    const answers = Array.from({ length: settings.rounds }, (_, i) =>
      generateTimeRound('seed-t', settings, i),
    );
    const rounds = timeRounds({ ...time, answers })!;
    expect(rounds).toHaveLength(settings.rounds);
    expect(rounds.every((r) => r.score === 10 && r.answer === r.target)).toBe(true);
  });

  it('sem respostas ou com modo desconhecido, não há detalhe', () => {
    expect(timeRounds(time)).toBeNull();
    expect(timeRounds({ ...time, mode: 'zzz', answers: [1] })).toBeNull();
  });

  it('rótulos do jogo e do modo "sem estourar"', () => {
    expect(gameLabel('time')).toBe('Tempo');
    expect(gameLabel('color')).toBe('Cor');
    expect(modeLabel('strict')).toBe('Sem estourar');
  });
});

describe('máximo de pontos da partida', () => {
  it('rápido vale 10; Cor clássica 50, Tempo 30 (partidas antigas de 5 rodadas, 50); sala usa as respostas guardadas', () => {
    expect(matchMax({ game: 'color', mode: 'quick', answers: null })).toBe(10);
    expect(matchMax({ game: 'time', mode: 'quick', answers: null })).toBe(10);
    expect(matchMax({ game: 'color', mode: 'classic', answers: null })).toBe(50);
    expect(matchMax({ game: 'time', mode: 'strict', answers: null })).toBe(30);
    expect(matchMax({ game: 'time', mode: 'strict', answers: [1, 2, 3, 4, 5] })).toBe(50);
    expect(matchMax({ game: 'color', mode: 'room', answers: [1, 2, 3] })).toBe(30);
  });
});

describe('partida antiga do Tempo no histórico', () => {
  it('5 respostas guardadas usam o preset antigo (alvos de 5 a 15 s) e não o de 3 rodadas', () => {
    const old = {
      ...base,
      game: 'time',
      mode: 'classic',
      seed: 'velha',
      answers: [6000, 7000, 8000, 9000, 10_000],
    };
    const rounds = timeRounds(old)!;
    expect(rounds).toHaveLength(5);
    for (const r of rounds) {
      expect(r.target).toBeGreaterThanOrEqual(5000);
      expect(r.target).toBeLessThanOrEqual(15_000);
    }
    expect(matchMax(old)).toBe(50);
  });
});

describe('classificação da partida', () => {
  const solo = (totalScore: number, mode = 'classic') => ({
    game: 'color',
    mode,
    answers: null,
    placement: null,
    totalScore,
  });

  it('em sala vale a colocação', () => {
    expect(classifyMatch({ ...solo(100), mode: 'room', answers: [1, 2, 3], placement: 1 })).toEqual(
      {
        label: '1º lugar',
        tone: 'top',
      },
    );
    expect(classifyMatch({ ...solo(100), mode: 'room', answers: [1], placement: 3 })).toEqual({
      label: '3º lugar',
      tone: 'mid',
    });
  });

  it('sozinho vale a faixa da nota sobre o máximo do modo', () => {
    expect(classifyMatch(solo(480)).label).toBe('CRAVOU'); // 48/50
    expect(classifyMatch(solo(420)).label).toBe('QUASE'); // 42/50
    expect(classifyMatch(solo(300)).label).toBe('MEH'); // 30/50
    expect(classifyMatch(solo(100)).label).toBe('ERROU'); // 10/50
    // o mesmo valor pesa diferente no rápido (máximo 10): 9,5/10 cravou
    expect(classifyMatch(solo(95, 'quick')).label).toBe('CRAVOU');
  });
});

describe('Sobrevivência no histórico', () => {
  const item = (rounds: number) => ({
    game: 'color',
    mode: 'survival',
    answers: Array(rounds).fill(1),
    placement: null,
    totalScore: rounds * 10,
  });

  it('mostra as rodadas jogadas em vez de pontos', () => {
    expect(scoreParts(item(7))).toEqual({ main: '7', unit: ' rodadas' });
  });

  it('classifica pelo número de rodadas', () => {
    expect(classifyMatch(item(3)).label).toBe('CEDO DEMAIS');
    expect(classifyMatch(item(6)).label).toBe('MEH');
    expect(classifyMatch(item(10)).label).toBe('FORTE');
    expect(classifyMatch(item(16)).label).toBe('LENDÁRIO');
  });
});
