import { describe, expect, it } from 'vitest';
import { elimWinner, poolOk, poolSize, reducer, initial, type Action, type State } from './state';

const run = (s: State, ...a: Action[]) => a.reduce(reducer, s);
const NAMES = ['Sofia', 'Alexandre', 'Lúcia', 'Diego', 'Bia'];
const base = (): State => {
  const s = NAMES.reduce((acc, name) => reducer(acc, { type: 'addPlayer', name }), initial());
  return { ...s, settings: { ...s.settings, categories: ['comida', 'animais'], impostors: 1, rounds: 2, voteMode: 'final', mode: 'classic' } };
};

describe('estado do Impostor (mesa)', () => {
  it('a mesa começa vazia', () => {
    expect(initial().players).toEqual([]);
  });
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
  it('filtros: com tudo marcado, tocar tira só aquele item; tocar de novo põe de volta', () => {
    const all = ['a', 'b', 'c'];
    const f = (st: State, value: string) => run(st, { type: 'filter', category: 'futebol', tag: 'group', value, all });
    let s = f(base(), 'a');
    expect(s.settings.filters!.futebol!.group).toEqual(['b', 'c']);
    s = f(s, 'b');
    expect(s.settings.filters!.futebol!.group).toEqual(['c']);
    // o último marcado não sai (sem nada marcado não há palavra para sortear)
    expect(f(s, 'c')).toBe(s);
    s = f(s, 'a');
    s = f(s, 'b');
    expect(s.settings.filters!.futebol!.group).toEqual([]);
  });
  it('poucas palavras bloqueiam o começo', () => {
    const s = { ...base(), settings: { ...base().settings, categories: [] } };
    expect(poolOk(s)).toBe(false);
    expect(poolSize(base())).toBeGreaterThan(100);
  });

  it('partida completa: papéis, rodadas de dicas, voto secreto e placar', () => {
    let s = run(base(), { type: 'start' });
    expect(s.phase).toBe('reveal');
    expect(Object.keys(s.round!.roles)).toHaveLength(5);
    for (let i = 0; i < 5; i++) s = run(s, { type: 'seen' });
    expect(s.phase).toBe('clues');
    // 2 rodadas x (instruções + hora de dizer) = 4 toques até abrir o debate
    expect(s.clueStep).toBe('brief');
    for (let i = 0; i < 3; i++) s = run(s, { type: 'clueNext' });
    expect(s.phase).toBe('clues');
    expect(s.clueRound).toBe(2);
    s = run(s, { type: 'clueNext' });
    expect(s.phase).toBe('talk');
    s = run(s, { type: 'go', phase: 'vote' });
    const imp = Object.entries(s.round!.roles).find(([, r]) => r.kind === 'impostor')![0];
    for (let i = 0; i < 5; i++) {
      expect(s.voteStep).toBe('pass');
      s = run(s, { type: 'voteReady' });
      const me = s.players[s.voter]!.id;
      const target = me === imp ? s.players.find((p) => p.id !== imp)!.id : imp;
      s = run(s, { type: 'castVote', target });
    }
    expect(s.phase).toBe('result');
    expect(s.result!.caught).toEqual([imp]);
    s = run(s, { type: 'finish' });
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

  it('quem entra no meio da sessão já aparece no ranking com 0 ponto', () => {
    let s = base();
    s = run(s, { type: 'addPlayer', name: 'Novo' });
    const novo = s.players[s.players.length - 1]!;
    expect(s.session.scores[novo.id]).toBe(0);
    s = run(s, { type: 'removePlayer', id: novo.id });
    expect(s.session.scores[novo.id]).toBeUndefined();
  });

  it('modo de perguntas tem uma rodada só: responder e ir para o debate', () => {
    let s = base();
    s = { ...s, settings: { ...s.settings, mode: 'wrong', rounds: 3 } };
    s = run(s, { type: 'start' });
    expect(s.round!.mode).toBe('wrong');
    for (let i = 0; i < s.players.length; i++) s = run(s, { type: 'seen' });
    s = run(s, { type: 'clueNext' });
    expect(s.clueStep).toBe('say');
    s = run(s, { type: 'clueNext' });
    expect(s.phase).toBe('talk');
  });

  describe('eliminação', () => {
    const elimBase = (players: number, impostors: number, rounds = 3): State => {
      let s = initial();
      for (let i = 0; i < players; i++) s = reducer(s, { type: 'addPlayer', name: `J${i + 1}` });
      s = { ...s, settings: { ...s.settings, categories: ['comida', 'animais'], impostors, rounds, voteMode: 'elim', mode: 'classic' } };
      s = run(s, { type: 'start' });
      for (let i = 0; i < players; i++) s = run(s, { type: 'seen' });
      return s;
    };
    const toVote = (s: State) => run(s, { type: 'clueNext' }, { type: 'clueNext' }, { type: 'go', phase: 'vote' });
    /** Todos os vivos votam no mesmo alvo (quem for o alvo vota em outra pessoa). */
    const allVote = (s: State, target: string) => {
      let st = s;
      const n = st.elim!.alive.length;
      for (let i = 0; i < n; i++) {
        st = run(st, { type: 'voteReady' });
        const me = st.elim!.alive[st.voter]!;
        const t = me === target ? st.elim!.alive.find((x) => x !== target)! : target;
        st = run(st, { type: 'castVote', target: t });
      }
      return st;
    };
    const outsiderOf = (s: State) => Object.entries(s.round!.roles).filter(([, r]) => r.kind !== 'civil').map(([id]) => id);

    it('depois das palavras vem o debate, depois a votação, e sai um', () => {
      let s = run(elimBase(6, 1), { type: 'clueNext' }, { type: 'clueNext' });
      expect(s.phase).toBe('talk');
      s = run(s, { type: 'go', phase: 'vote' });
      expect(s.phase).toBe('vote');
      expect(s.elim!.alive).toHaveLength(6);
      const civil = Object.entries(s.round!.roles).find(([, r]) => r.kind === 'civil')![0];
      s = allVote(s, civil);
      expect(s.phase).toBe('elimres');
      expect(s.elim!.alive).toHaveLength(5);
      expect(s.elim!.steps[0]!.out).toBe(civil);
    });
    it('um impostor só e pego na rodada 1: acaba na hora e os inocentes vencem', () => {
      let s = toVote(elimBase(6, 1));
      const imp = outsiderOf(s)[0]!;
      s = allVote(s, imp);
      expect(s.phase).toBe('elimres');
      expect(elimWinner(s)).toBe('innocents');
      s = run(s, { type: 'elimNext' });
      expect(s.phase).toBe('score');
      expect(s.result!.innocentsWin).toBe(true);
    });
    it('inocente eliminado: segue para a rodada 2 só com os vivos', () => {
      let s = toVote(elimBase(6, 1));
      const civil = Object.entries(s.round!.roles).find(([, r]) => r.kind === 'civil')![0];
      s = allVote(s, civil);
      expect(elimWinner(s)).toBeNull();
      s = run(s, { type: 'elimNext' });
      expect(s.phase).toBe('clues');
      expect(s.clueRound).toBe(2);
      expect(s.clueStep).toBe('brief');
      expect(s.elim!.alive).not.toContain(civil);
    });
    it('3 impostores pedidos em 4 jogadores: sorteia só 1 (limite da eliminação)', () => {
      const s = elimBase(4, 3);
      expect(outsiderOf(s)).toHaveLength(1);
    });
    it('2 impostores com 2 rodadas pedidas: o jogo ganha 3 rodadas', () => {
      const s = elimBase(6, 2, 2);
      expect(s.elim!.total).toBe(3);
    });
    it('empate: volta só com os empatados e na segunda vez sempre sai alguém', () => {
      let s = toVote(elimBase(6, 1));
      const [a, b] = s.elim!.alive;
      // a e b votam um no outro; os outros 4 se dividem 2 a 2: empate 3 x 3
      for (let i = 0; i < s.elim!.alive.length; i++) {
        s = run(s, { type: 'voteReady' });
        const target = i === 0 ? b! : i === 1 ? a! : i < 4 ? a! : b!;
        s = run(s, { type: 'castVote', target });
      }
      expect(s.phase).toBe('vote');
      expect(s.elimCands).toEqual([a, b]);
      expect(s.elimRevote).toBe(true);
      expect(s.voter).toBe(0);
      // segunda votação empatada de novo: sorteio, sempre sai alguém
      for (let i = 0; i < s.elim!.alive.length; i++) {
        s = run(s, { type: 'voteReady' });
        const me = s.elim!.alive[s.voter]!;
        const target = me === a ? b! : me === b ? a! : (i % 2 === 0 ? a! : b!);
        s = run(s, { type: 'castVote', target });
      }
      expect(s.phase).toBe('elimres');
      expect(s.elim!.alive).toHaveLength(5);
      expect([a, b]).toContain(s.elim!.steps[0]!.out);
    });
    it('os dois impostores saem: inocentes vencem; eliminados também pontuam', () => {
      let s = toVote(elimBase(6, 2));
      const [i1, i2] = outsiderOf(s);
      s = allVote(s, i1!);
      expect(elimWinner(s)).toBeNull();
      s = run(s, { type: 'elimNext' }, { type: 'clueNext' }, { type: 'clueNext' }, { type: 'go', phase: 'vote' });
      expect(s.phase).toBe('vote');
      s = allVote(s, i2!);
      expect(elimWinner(s)).toBe('innocents');
      s = run(s, { type: 'elimNext' });
      expect(s.phase).toBe('score');
      const civils = s.players.filter((p) => s.round!.roles[p.id]!.kind === 'civil');
      for (const c of civils) expect(s.result!.points[c.id]).toBeGreaterThanOrEqual(2);
    });
    it('erros dos inocentes dão a vitória aos impostores (empate numérico)', () => {
      let s = toVote(elimBase(6, 2));
      const civils = s.players.filter((p) => s.round!.roles[p.id]!.kind === 'civil').map((p) => p.id);
      s = allVote(s, civils[0]!);
      s = run(s, { type: 'elimNext' }, { type: 'clueNext' }, { type: 'clueNext' }, { type: 'go', phase: 'vote' });
      s = allVote(s, civils[1]!);
      expect(elimWinner(s)).toBe('impostors');
      s = run(s, { type: 'elimNext' });
      expect(s.result!.innocentsWin).toBe(false);
    });

    it('modo de perguntas: cada rodada tem uma pergunta nova e todo mundo vê de novo', () => {
      let s = initial();
      for (let i = 0; i < 6; i++) s = reducer(s, { type: 'addPlayer', name: `J${i + 1}` });
      s = { ...s, settings: { ...s.settings, categories: ['comida', 'animais'], impostors: 1, rounds: 3, voteMode: 'elim', mode: 'wrong' } };
      s = run(s, { type: 'start' });
      expect(s.round!.qa!.length).toBeGreaterThan(2);
      for (let i = 0; i < 6; i++) s = run(s, { type: 'seen' });
      s = toVote(s);
      const civil = Object.entries(s.round!.roles).find(([, r]) => r.kind === 'civil')![0];
      s = allVote(s, civil);
      s = run(s, { type: 'elimNext' });
      // rodada 2: volta a ver a pergunta (agora nova), só entre os vivos
      expect(s.phase).toBe('reveal');
      expect(s.seen).toBe(0);
      for (let i = 0; i < 5; i++) s = run(s, { type: 'seen' });
      expect(s.phase).toBe('clues');
      expect(s.clueRound).toBe(2);
    });
  });
});
