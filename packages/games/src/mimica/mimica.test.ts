import { describe, expect, it } from 'vitest';
import {
  MIM_OPTIONS,
  MIM_SPEED_SKIPS,
  mimApply,
  mimDrawDeck,
  mimDrawOptions,
  mimEstimateMinutes,
  mimNewSession,
  mimRanking,
  mimRemainingToAssign,
  mimSchedule,
  mimScoreClassicSolo,
  mimScoreClassicTeams,
  mimScoreSpeedSolo,
  mimScoreSpeedTeams,
  mimShift,
  mimSidesValid,
  mimSpeedCorrect,
  mimSpeedCurrent,
  mimSpeedSkip,
  mimSpeedSkipsLeft,
  mimSpeedStart,
  mimTotalTurns,
  mimWinners,
  type MimSettings,
  type MimWord,
} from './index';

const words: MimWord[] = [
  ...Array.from({ length: 8 }, (_, i): MimWord => ({ id: `c${i}`, category: i < 4 ? 'animais' : 'comida', text: `classico ${i}`, pool: 'classic' })),
  ...Array.from({ length: 12 }, (_, i): MimWord => ({ id: `s${i}`, category: i < 6 ? 'acoes' : 'animais', text: `speed ${i}`, pool: 'speed' })),
];
const base: MimSettings = { format: 'teams', style: 'classic', seconds: 90, rounds: 2, categories: ['animais', 'comida'] };

describe('mímica: lados e calendário', () => {
  it('times de 2 a 5, pessoas de 2 a 12', () => {
    expect(mimSidesValid('teams', 1)).toBe(false);
    expect(mimSidesValid('teams', 2)).toBe(true);
    expect(mimSidesValid('teams', 5)).toBe(true);
    expect(mimSidesValid('teams', 6)).toBe(false);
    expect(mimSidesValid('solo', 2)).toBe(true);
    expect(mimSidesValid('solo', 1)).toBe(false);
    expect(mimSidesValid('solo', 13)).toBe(false);
  });
  it('total de turnos: 2 times e 5 rodadas são 10, 3 times e 5 rodadas são 15', () => {
    expect(mimTotalTurns(2, 5)).toBe(10);
    expect(mimTotalTurns(3, 5)).toBe(15);
  });
  it('em cada rodada todo lado joga uma vez, na mesma ordem', () => {
    const t = mimSchedule(['a', 'b', 'c'], 2);
    expect(t.map((x) => x.side)).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
    expect(t.map((x) => x.round)).toEqual([1, 1, 1, 2, 2, 2]);
    expect(t.map((x) => x.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('estimativa de duração sobe com turnos e tempo', () => {
    const a = mimEstimateMinutes('classic', 90, 2, 5);
    expect(a).toBeGreaterThan(10);
    expect(mimEstimateMinutes('classic', 90, 3, 5)).toBeGreaterThan(a);
    expect(mimEstimateMinutes('speed', 60, 2, 1)).toBeGreaterThanOrEqual(1);
  });
});

describe('mímica: sorteio de palavras', () => {
  it('Clássico: 3 opções diferentes, só do pool clássico e dos temas escolhidos', () => {
    const o = mimDrawOptions({ words, settings: { ...base, categories: ['animais'] }, used: [], seed: 's', turnIndex: 0 });
    expect(o).toHaveLength(MIM_OPTIONS);
    expect(new Set(o.map((w) => w.id)).size).toBe(MIM_OPTIONS);
    expect(o.every((w) => w.pool === 'classic' && w.category === 'animais')).toBe(true);
  });
  it('é determinístico pela seed e muda por turno', () => {
    const a = mimDrawOptions({ words, settings: base, used: [], seed: 's', turnIndex: 0 }).map((w) => w.id);
    expect(mimDrawOptions({ words, settings: base, used: [], seed: 's', turnIndex: 0 }).map((w) => w.id)).toEqual(a);
    const b = mimDrawOptions({ words, settings: base, used: [], seed: 's', turnIndex: 1 }).map((w) => w.id);
    expect(b).not.toEqual(a);
  });
  it('palavras já usadas só voltam quando acabam as novas', () => {
    const used = ['c0', 'c1', 'c2', 'c3', 'c4'];
    const o = mimDrawOptions({ words, settings: base, used, seed: 's', turnIndex: 0 });
    expect(o.map((w) => w.id).sort()).toEqual(['c5', 'c6', 'c7']);
    const all = mimDrawOptions({ words, settings: base, used: words.filter((w) => w.pool === 'classic').map((w) => w.id), seed: 's', turnIndex: 0 });
    expect(all).toHaveLength(MIM_OPTIONS);
  });
  it('poucas palavras nos temas dá erro claro', () => {
    expect(() => mimDrawOptions({ words, settings: { ...base, categories: ['nada'] }, used: [], seed: 's', turnIndex: 0 })).toThrow();
    expect(() => mimDrawDeck({ words, settings: { ...base, style: 'speed', categories: ['nada'] }, used: [], seed: 's', turnIndex: 0 })).toThrow();
  });
  it('Speed: baralho só com palavras speed, sem repetir dentro do turno', () => {
    const d = mimDrawDeck({ words, settings: { ...base, style: 'speed', categories: ['acoes', 'animais'] }, used: ['s0'], seed: 's', turnIndex: 0, size: 5 });
    expect(d).toHaveLength(5);
    expect(new Set(d.map((w) => w.id)).size).toBe(5);
    expect(d.every((w) => w.pool === 'speed')).toBe(true);
    expect(d.some((w) => w.id === 's0')).toBe(false);
  });
});

describe('mímica: turno do Speed', () => {
  const deck = words.filter((w) => w.pool === 'speed').slice(0, 8);
  it('acertar avança e guarda; pular avança sem pontuar', () => {
    let t = mimSpeedStart(deck);
    expect(mimSpeedCurrent(t)?.id).toBe('s0');
    t = mimSpeedCorrect(t);
    t = mimSpeedSkip(t);
    expect(t.correct).toEqual(['s0']);
    expect(t.skipped).toEqual(['s1']);
    expect(mimSpeedCurrent(t)?.id).toBe('s2');
  });
  it('no máximo 3 pulos por turno', () => {
    let t = mimSpeedStart(deck);
    for (let i = 0; i < 5; i++) t = mimSpeedSkip(t);
    expect(t.skipped).toHaveLength(MIM_SPEED_SKIPS);
    expect(mimSpeedSkipsLeft(t)).toBe(0);
    expect(mimSpeedCurrent(t)?.id).toBe('s3');
    expect(mimSpeedCorrect(t).correct).toEqual(['s3']);
  });
  it('baralho acabado não quebra', () => {
    let t = mimSpeedStart(deck.slice(0, 1));
    t = mimSpeedCorrect(t);
    expect(mimSpeedCurrent(t)).toBeNull();
    expect(mimSpeedCorrect(t)).toEqual(t);
    expect(mimSpeedSkip(t)).toEqual(t);
  });
});

describe('mímica: pontos', () => {
  it('Clássico em Times: acertou no tempo dá 3 ao time da mímica', () => {
    expect(mimScoreClassicTeams({ mimer: 'a', guessed: true, stealers: ['b'] })).toEqual({ a: 3 });
  });
  it('Clássico em Times: no roubo cada time que acertou ganha 1 e o da mímica fica com 0', () => {
    expect(mimScoreClassicTeams({ mimer: 'a', guessed: false, stealers: ['b', 'c'] })).toEqual({ b: 1, c: 1 });
    expect(mimScoreClassicTeams({ mimer: 'a', guessed: false, stealers: [] })).toEqual({});
    expect(mimScoreClassicTeams({ mimer: 'a', guessed: false, stealers: ['a', 'b', 'b'] })).toEqual({ b: 1 });
  });
  it('Clássico Individual: quem acertou 3 e quem fez a mímica 2; ninguém acertou não pontua', () => {
    expect(mimScoreClassicSolo({ mimer: 'a', guesser: 'b' })).toEqual({ b: 3, a: 2 });
    expect(mimScoreClassicSolo({ mimer: 'a', guesser: null })).toEqual({});
    expect(mimScoreClassicSolo({ mimer: 'a', guesser: 'a' })).toEqual({});
  });
  it('Speed em Times: 1 por palavra', () => {
    expect(mimScoreSpeedTeams({ mimer: 'a', correct: 7 })).toEqual({ a: 7 });
    expect(mimScoreSpeedTeams({ mimer: 'a', correct: 0 })).toEqual({ a: 0 });
  });
  it('Speed Individual: mímico 2 por palavra, quem acertou 1 só pelas marcadas', () => {
    expect(mimScoreSpeedSolo({ mimer: 'a', correct: 12, guessedBy: { b: 5, c: 4 } })).toEqual({ a: 24, b: 5, c: 4 });
    expect(mimRemainingToAssign(12, { b: 5, c: 4 })).toBe(3);
  });
  it('Speed Individual: acertos sem dono só pontuam o mímico, e marcar demais dá erro', () => {
    expect(mimScoreSpeedSolo({ mimer: 'a', correct: 6, guessedBy: {} })).toEqual({ a: 12 });
    expect(() => mimScoreSpeedSolo({ mimer: 'a', correct: 3, guessedBy: { b: 2, c: 2 } })).toThrow();
  });
  it('Speed Individual ignora marcar o próprio mímico e contagens zeradas', () => {
    expect(mimScoreSpeedSolo({ mimer: 'a', correct: 4, guessedBy: { a: 2, b: 0, c: 2 } })).toEqual({ a: 8, c: 2 });
  });
});

describe('mímica: ranking', () => {
  it('soma pontos e conta turnos', () => {
    let s = mimNewSession(['a', 'b', 'c']);
    s = mimApply(s, { a: 3 });
    s = mimApply(s, { b: 1, c: 1 });
    expect(s.scores).toEqual({ a: 3, b: 1, c: 1 });
    expect(s.turns).toBe(2);
  });
  it('empate divide a posição', () => {
    let s = mimNewSession(['a', 'b', 'c']);
    s = mimApply(s, { a: 3, b: 3, c: 1 });
    expect(mimRanking(s).map((r) => [r.id, r.position])).toEqual([['a', 1], ['b', 1], ['c', 3]]);
    expect(mimWinners(s)).toEqual(['a', 'b']);
  });
  it('lado que entra no ranking depois do começo é aceito', () => {
    const s = mimApply(mimNewSession(['a']), { z: 2 });
    expect(s.scores.z).toBe(2);
  });
  it('troca brusca quando alguém sobe 2 lugares ou mais', () => {
    let before = mimNewSession(['a', 'b', 'c']);
    before = mimApply(before, { a: 5, b: 3, c: 1 });
    expect(mimShift(before, mimApply(before, { b: 1 }))).toBe('calm');
    expect(mimShift(before, mimApply(before, { c: 6 }))).toBe('brusque');
  });
});
