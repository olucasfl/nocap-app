import { describe, expect, it } from 'vitest';
import { poolOk, poolSize, reducer, initial, type Action, type State } from './state';

const run = (s: State, ...a: Action[]) => a.reduce(reducer, s);
const base = (): State => {
  const s = initial();
  return { ...s, players: s.players.slice(0, 5), settings: { ...s.settings, categories: ['comida', 'animais'], impostors: 1, rounds: 2, lastChance: true, mode: 'classic' } };
};

describe('estado do Impostor (mesa)', () => {
  it('adiciona e remove jogadores, no máximo 15, com personagem sem repetir', () => {
    let s = base();
    s = run(s, { type: 'addPlayer', name: '  Caio  ' });
    expect(s.players.at(-1)!.name).toBe('Caio');
    expect(new Set(s.players.map((p) => p.avatar)).size).toBe(s.players.length);
    for (let i = 0; i < 20; i++) s = run(s, { type: 'addPlayer', name: `J${i}` });
    expect(s.players).toHaveLength(15);
    s = run(s, { type: 'removePlayer', id: s.players[0]!.id });
    expect(s.players).toHaveLength(14);
  });
  it('ignora nome vazio', () => {
    const s = base();
    expect(run(s, { type: 'addPlayer', name: '   ' }).players).toHaveLength(s.players.length);
  });
  it('rodadas ficam entre 1 e 5', () => {
    expect(run(base(), { type: 'settings', patch: { rounds: 9 } }).settings.rounds).toBe(5);
    expect(run(base(), { type: 'settings', patch: { rounds: 0 } }).settings.rounds).toBe(1);
  });
  it('filtros: marcar e desmarcar um valor', () => {
    let s = run(base(), { type: 'filter', category: 'futebol', tag: 'group', value: 'selecao' });
    expect(s.settings.filters!.futebol!.group).toEqual(['selecao']);
    s = run(s, { type: 'filter', category: 'futebol', tag: 'group', value: 'selecao' });
    expect(s.settings.filters!.futebol!.group).toEqual([]);
  });
  it('poucas palavras bloqueiam o começo', () => {
    const s = { ...base(), settings: { ...base().settings, categories: [] } };
    expect(poolOk(s)).toBe(false);
    expect(poolSize(base())).toBeGreaterThan(100);
  });

  it('partida completa: papéis, rodadas de dicas, voto secreto, chute e placar', () => {
    let s = run(base(), { type: 'start' });
    expect(s.phase).toBe('reveal');
    expect(Object.keys(s.round!.roles)).toHaveLength(5);
    for (let i = 0; i < 5; i++) s = run(s, { type: 'seen' });
    expect(s.phase).toBe('clues');
    // 2 rodadas x 5 jogadores = 10 vezes "próximo" até abrir o debate
    for (let i = 0; i < 9; i++) s = run(s, { type: 'nextTurn' });
    expect(s.phase).toBe('clues');
    s = run(s, { type: 'nextTurn' });
    expect(s.phase).toBe('talk');
    s = run(s, { type: 'go', phase: 'vote' });
    const imp = Object.entries(s.round!.roles).find(([, r]) => r.kind === 'impostor')![0];
    for (let i = 0; i < 5; i++) {
      const me = s.players[s.voter]!.id;
      const target = me === imp ? s.players.find((p) => p.id !== imp)!.id : imp;
      s = run(s, { type: 'castVote', target });
    }
    expect(s.phase).toBe('result');
    expect(s.result!.caught).toEqual([imp]);
    expect(s.result!.canGuess).toEqual([imp]);
    s = run(s, { type: 'guess', text: 'nada a ver' });
    expect(s.phase).toBe('score');
    expect(s.session.games).toBe(1);
    expect(s.result!.innocentsWin).toBe(true);
    // quem votou certo (inocentes) pontuou; o ranking soma
    const total = Object.values(s.session.scores).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
    // segunda partida soma ao ranking
    s = run(s, { type: 'start' });
    expect(s.session.games).toBe(1);
    expect(s.game).toBe(1);
    expect(s.history.used).toHaveLength(1);
  });
  it('sem última chance, o resultado vai direto ao placar', () => {
    let s = run({ ...base(), settings: { ...base().settings, lastChance: false } }, { type: 'start' });
    for (let i = 0; i < 5; i++) s = run(s, { type: 'seen' });
    s = run(s, { type: 'go', phase: 'vote' });
    for (let i = 0; i < 5; i++) s = run(s, { type: 'castVote', target: s.players.find((p) => p.id !== s.players[s.voter]!.id)!.id });
    expect(s.result!.canGuess).toEqual([]);
    s = run(s, { type: 'finish' });
    expect(s.phase).toBe('score');
  });
  it('continuar jogando mantém o ranking; entra gente nova do zero e quem saiu deixa o ranking', () => {
    let s = run(base(), { type: 'start' });
    for (let i = 0; i < 5; i++) s = run(s, { type: 'seen' });
    s = run(s, { type: 'go', phase: 'vote' });
    for (let i = 0; i < 5; i++) s = run(s, { type: 'castVote', target: s.players.find((p) => p.id !== s.players[s.voter]!.id)!.id });
    s = run(s, { type: 'finish' });
    const before = { ...s.session.scores };
    const gone = s.players[0]!.id;
    s = run(s, { type: 'go', phase: 'players' }, { type: 'removePlayer', id: gone }, { type: 'addPlayer', name: 'Novo' }, { type: 'start' });
    const novo = s.players.at(-1)!.id;
    expect(s.session.scores[novo]).toBe(0);
    expect(gone in s.session.scores).toBe(false);
    for (const p of s.players.slice(0, -1)) expect(s.session.scores[p.id]).toBe(before[p.id]);
    expect(s.session.games).toBe(1);
  });
  it('"nova sessão" zera o ranking mas mantém jogadores e ajustes', () => {
    let s = run(base(), { type: 'start' });
    for (let i = 0; i < 5; i++) s = run(s, { type: 'seen' });
    s = run(s, { type: 'go', phase: 'vote' });
    for (let i = 0; i < 5; i++) s = run(s, { type: 'castVote', target: s.players.find((p) => p.id !== s.players[s.voter]!.id)!.id });
    s = run(s, { type: 'finish' });
    const keep = s.players.length;
    s = run(s, { type: 'reset' });
    expect(s.session.games).toBe(0);
    expect(s.players).toHaveLength(keep);
  });
});
