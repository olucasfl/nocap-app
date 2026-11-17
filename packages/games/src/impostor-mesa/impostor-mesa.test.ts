import { describe, expect, it } from 'vitest';
import {
  IM_DEFAULTS,
  IM_EMPTY_HISTORY,
  imDryLimit,
  IM_POINTS,
  addResult,
  advanceHistory,
  IM_ELIM_MAX_ROUNDS,
  clampRounds,
  elimApply,
  elimOutcome,
  elimResolve,
  elimStart,
  imElimRounds,
  imRoundView,
  scoreElimination,
  drawRound,
  filterWords,
  imEffectiveMode,
  imImpostorLimit,
  leaders,
  newSession,
  rankingShift,
  scoreResult,
  sessionRanking,
  type ImElimState,
  type ImHistory,
  type ImRound,
  type ImQuestion,
  type ImSettings,
  type ImWord,
} from './index';

const ids = ['a', 'b', 'c', 'd', 'e'];
const W = (id: string, category: string, text: string, pair: string, tags: Record<string, string> = {}): ImWord => ({ id, category, text, pair, tags, fame: 1 });
const words: ImWord[] = [
  W('w1', 'comida', 'Pizza', 'Lasanha'),
  W('w2', 'comida', 'Sushi', 'Sashimi'),
  W('w3', 'futebol', 'Messi', 'Cristiano Ronaldo', { group: 'jogador-mundo' }),
  W('w4', 'futebol', 'Neymar', 'Vinicius Jr', { group: 'jogador-brasil' }),
  W('w5', 'futebol', 'Flamengo', 'Corinthians', { group: 'time-brasil' }),
];
const base = (o: Partial<ImSettings> = {}): ImSettings => ({ ...IM_DEFAULTS, categories: ['comida'], ...o });
const draw = (o: Partial<ImSettings> = {}, h: ImHistory = IM_EMPTY_HISTORY, round = 0, who = ids) =>
  drawRound({ ids: who, settings: base(o), words, seed: 's', roundIndex: round, history: h });

describe('limites', () => {
  it('rodadas de 1 a 5', () => {
    expect(clampRounds(0)).toBe(1);
    expect(clampRounds(3)).toBe(3);
    expect(clampRounds(9)).toBe(5);
  });
  it('impostores: até 3 e sempre sobra alguém', () => {
    expect(imImpostorLimit(3)).toBe(2);
    expect(imImpostorLimit(10)).toBe(3);
  });
  it('"sem palavra" só com 6 pessoas', () => {
    expect(imEffectiveMode('white', 5)).toBe('similar');
    expect(imEffectiveMode('white', 6)).toBe('white');
    expect(imEffectiveMode('classic', 3)).toBe('classic');
  });
});

describe('filtros de palavras', () => {
  it('só as categorias marcadas', () => {
    expect(filterWords(words, { categories: ['comida'] }).map((w) => w.id)).toEqual(['w1', 'w2']);
  });
  it('futebol: só jogadores do Brasil', () => {
    const r = filterWords(words, { categories: ['futebol'], filters: { futebol: { group: ['jogador-brasil'] } } });
    expect(r.map((w) => w.id)).toEqual(['w4']);
  });
  it('lista vazia no filtro aceita tudo', () => {
    expect(filterWords(words, { categories: ['futebol'], filters: { futebol: { group: [] } } })).toHaveLength(3);
  });
});

describe('sorteio da partida', () => {
  it('é determinístico', () => {
    expect(draw()).toEqual(draw());
  });
  it('clássico: impostor não vê palavra; dica mostra o tema', () => {
    const r = draw({ hint: true });
    const imp = Object.values(r.roles).filter((x) => x.kind === 'impostor');
    expect(imp).toHaveLength(1);
    expect(imp[0]!.text).toBeNull();
    expect(imp[0]!.knowsRole).toBe(true);
    expect(Object.values(r.roles).filter((x) => x.kind === 'civil').every((x) => x.text === r.civilText)).toBe(true);
  });
  it('palavra parecida: impostor recebe o par e não sabe que é impostor', () => {
    const r = draw({ mode: 'similar' });
    const imp = Object.values(r.roles).find((x) => x.kind === 'impostor')!;
    expect(imp.text).not.toBe(r.civilText);
    expect(imp.knowsRole).toBe(false);
  });
  it('sem palavra: um com o par e um sem nada, mesa de 6', () => {
    const six = [...ids, 'f'];
    const r = draw({ mode: 'white' }, IM_EMPTY_HISTORY, 0, six);
    expect(Object.values(r.roles).filter((x) => x.kind === 'white')).toHaveLength(1);
    expect(Object.values(r.roles).filter((x) => x.kind === 'impostor')).toHaveLength(1);
    const white = Object.entries(r.roles).find(([, x]) => x.kind === 'white')![0];
    expect(r.order[0]).not.toBe(white);
  });
  it('resposta errada: perguntas pareadas', () => {
    const q: ImQuestion = { id: 'q1', category: 'comida', q: 'Qual a sua comida favorita?', qPair: 'Qual comida você mais odeia?' };
    const r = drawRound({ ids, settings: base({ mode: 'wrong' }), words, questions: [q], seed: 's', roundIndex: 0, history: IM_EMPTY_HISTORY });
    const imp = Object.values(r.roles).find((x) => x.kind === 'impostor')!;
    expect(imp.text).toBe(q.qPair);
    expect(r.civilText).toBe(q.q);
  });
  it('impostores aleatórios ficam entre 1 e o máximo', () => {
    for (let i = 0; i < 40; i++) {
      const n = Object.values(draw({ impostors: 'random' }, IM_EMPTY_HISTORY, i).roles).filter((x) => x.kind !== 'civil').length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
  });
  it('não repete palavra enquanto houver nova', () => {
    const h: ImHistory = { dry: {}, used: ['w1'] };
    for (let i = 0; i < 20; i++) expect(draw({}, h, i).wordId).toBe('w2');
  });
  it('a ordem de fala não depende do papel: o impostor abre às vezes', () => {
    let impFirst = 0;
    for (let i = 0; i < 300; i++) {
      const r = draw({}, IM_EMPTY_HISTORY, i);
      if (r.roles[r.order[0]!]!.kind === 'impostor') impFirst++;
    }
    expect(impFirst).toBeGreaterThan(30);
    expect(impFirst).toBeLessThan(120);
  });
  it('recusa mesa fora de 3 a 15', () => {
    expect(() => draw({}, IM_EMPTY_HISTORY, 0, ['a', 'b'])).toThrow();
  });
});

describe('sorteio justo ao longo da sessão', () => {
  it('o rodízio mantém a espera dentro do limite (mesa de 6, 1 impostor)', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    let h = IM_EMPTY_HISTORY;
    const dry: Record<string, number> = {};
    let worst = 0;
    const times: Record<string, number> = {};
    for (let i = 0; i < 120; i++) {
      const r = draw({}, h, i, six);
      h = advanceHistory(h, six, r);
      for (const id of six) {
        if (r.roles[id]!.kind === 'civil') dry[id] = (dry[id] ?? 0) + 1;
        else {
          dry[id] = 0;
          times[id] = (times[id] ?? 0) + 1;
        }
        worst = Math.max(worst, dry[id]!);
      }
    }
    expect(imDryLimit(6, 1)).toBe(5);
    expect(worst).toBeLessThanOrEqual(imDryLimit(6, 1) + 1);
    for (const id of six) expect(times[id]).toBeGreaterThan(8);
  });
});

describe('resultado e pontos', () => {
  const round = draw();
  const imp = Object.entries(round.roles).find(([, r]) => r.kind === 'impostor')![0];
  const civils = ids.filter((i) => i !== imp);
  const allVote = (target: string) => Object.fromEntries(ids.filter((i) => i !== target).map((i) => [i, target]));

  it('pego por todos: inocentes ganham e quem votou certo ganha 2 + 1', () => {
    const r = scoreResult({ ids, round, votes: allVote(imp) });
    expect(r.caught).toEqual([imp]);
    expect(r.innocentsWin).toBe(true);
    for (const c of civils) expect(r.points[c]).toBe(IM_POINTS.rightVote + IM_POINTS.innocentsWin);
    expect(r.points[imp]).toBe(0);
  });
  it('escapou: impostor ganha 4 e inocentes não ganham', () => {
    const wrong = civils[0]!;
    const r = scoreResult({ ids, round, votes: allVote(wrong) });
    expect(r.caught).not.toContain(imp);
    expect(r.innocentsWin).toBe(false);
    expect(r.points[imp]).toBe(IM_POINTS.outsiderSurvived);
  });
  it('ninguém vota em si e quem não votou não pontua', () => {
    const r = scoreResult({ ids, round, votes: { [civils[0]!]: imp } });
    expect(r.points[civils[0]!]).toBeGreaterThanOrEqual(IM_POINTS.rightVote);
    expect(r.points[civils[1]!]).toBe(IM_POINTS.innocentsWin);
  });
});

describe('sessão e ranking', () => {
  const res = (points: Record<string, number>, out: string[] = [], caught: string[] = []) => ({
    counts: {}, caught, outsiders: out, innocentsWin: false, points,
  });
  it('soma as partidas', () => {
    let s = newSession(['a', 'b', 'c']);
    s = addResult(s, res({ a: 3, b: 1, c: 0 }));
    s = addResult(s, res({ a: 0, b: 4, c: 2 }));
    expect(s.games).toBe(2);
    expect(sessionRanking(s).map((r) => [r.id, r.points])).toEqual([['b', 5], ['a', 3], ['c', 2]]);
  });
  it('empate divide a posição; desempata por fugas', () => {
    let s = newSession(['a', 'b']);
    s = addResult(s, res({ a: 2, b: 2 }, ['b'], []));
    const r = sessionRanking(s);
    expect(r[0]!.id).toBe('b');
    expect(r[0]!.position).toBe(1);
    expect(r[1]!.position).toBe(2);
    const tie = sessionRanking(addResult(newSession(['a', 'b']), res({ a: 2, b: 2 })));
    expect(tie.map((x) => x.position)).toEqual([1, 1]);
    expect(leaders(addResult(newSession(['a', 'b']), res({ a: 2, b: 2 })))).toEqual(['a', 'b']);
  });
  it('quem entra no meio começa do zero', () => {
    const s = addResult(newSession(['a']), res({ a: 1, z: 2 }));
    expect(s.scores.z).toBe(2);
  });
  it('mudança de placar: calma ou brusca', () => {
    const before = addResult(newSession(['a', 'b', 'c', 'd']), res({ a: 9, b: 6, c: 3, d: 0 }));
    const calm = addResult(before, res({ a: 1, b: 1, c: 0, d: 0 }));
    expect(rankingShift(before, calm)).toBe('calm');
    const jump = addResult(before, res({ a: 0, b: 0, c: 0, d: 20 }));
    expect(rankingShift(before, jump)).toBe('brusque');
  });

  it('as proporções dos pontos: escapar vale muito', () => {
    const innocentBest = IM_POINTS.rightVote + IM_POINTS.innocentsWin;
    expect(IM_POINTS.outsiderSurvived).toBeGreaterThan(innocentBest);
  });

  it('o tema aparece para quem recebe palavra; a dica do impostor só com mais de 2 temas', () => {
    const labels = { comida: 'Comida', futebol: 'Futebol', animais: 'Animais' };
    const go = (cats: string[], hint: boolean) =>
      drawRound({ ids, settings: base({ categories: cats, hint }), words, categoryLabels: labels, seed: 's', roundIndex: 0, history: IM_EMPTY_HISTORY });
    const three = go(['comida', 'futebol', 'animais'], true);
    const civ = Object.values(three.roles).find((x) => x.kind === 'civil')!;
    expect(civ.theme).toBe(labels[words.find((w) => w.text === three.civilText)!.category as keyof typeof labels]);
    expect(Object.values(three.roles).find((x) => x.kind === 'impostor')!.hint).toBe(civ.theme);
    const two = go(['comida', 'futebol'], true);
    expect(Object.values(two.roles).find((x) => x.kind === 'impostor')!.hint).toBeNull();
    const off = go(['comida', 'futebol', 'animais'], false);
    expect(Object.values(off.roles).find((x) => x.kind === 'impostor')!.hint).toBeNull();
  });

});

describe('eliminação', () => {
  const six = ['a', 'b', 'c', 'd', 'e', 'f'];
  const mk = (n: number, impostors: number) => {
    const who = six.concat(['g', 'h', 'i', 'j']).slice(0, n);
    const round = drawRound({ ids: who, settings: base({ impostors, voteMode: 'elim' }), words, seed: 'e', roundIndex: 0, history: IM_EMPTY_HISTORY });
    const outs = who.filter((i) => round.roles[i]!.kind !== 'civil');
    const civs = who.filter((i) => round.roles[i]!.kind === 'civil');
    return { who, round, outs, civs };
  };
  const out = (st: ImElimState, round: ImRound, id: string, voters: string[] = []) =>
    elimApply(st, round, id, Object.fromEntries(voters.map((v) => [v, id])), false, false);

  it('limites: impostores menos da metade da mesa e rodadas mínimas = impostores + 1', () => {
    expect(imImpostorLimit(4, 'elim')).toBe(1);
    expect(imImpostorLimit(5, 'elim')).toBe(2);
    expect(imImpostorLimit(6, 'elim')).toBe(2);
    expect(imImpostorLimit(7, 'elim')).toBe(3);
    expect(imImpostorLimit(10, 'elim')).toBe(3);
    expect(imImpostorLimit(6, 'final')).toBe(3);
    expect(imElimRounds(2, 3)).toBe(4);
    expect(imElimRounds(5, 1)).toBe(5);
    expect(imElimRounds(1, 1)).toBe(2);
    expect(imElimRounds(9, 2)).toBe(IM_ELIM_MAX_ROUNDS);
  });
  it('sorteio de impostores respeita o limite da eliminação', () => {
    const r = mk(4, 3);
    expect(r.outs).toHaveLength(1);
  });
  it('voto: maioria elimina; empate volta só com os empatados; empate de novo sorteia', () => {
    const cand = ['a', 'b', 'c'];
    expect(elimResolve(cand, { a: 'b', b: 'a', c: 'b' }, false, 's')).toEqual({ kind: 'out', out: 'b', drawn: false });
    const tie = elimResolve(cand, { a: 'b', b: 'c' }, false, 's');
    expect(tie).toEqual({ kind: 'tie', tied: ['b', 'c'] });
    const again = elimResolve(['b', 'c'], { a: 'b', d: 'c' }, true, 's');
    expect(again.kind).toBe('out');
    expect((again as { drawn: boolean }).drawn).toBe(true);
    expect(['b', 'c']).toContain((again as { out: string }).out);
    // ninguém votou: sorteia (sempre sai alguém)
    const none = elimResolve(cand, {}, false, 's');
    expect(none.kind).toBe('out');
  });
  it('um impostor pego: inocentes vencem na hora (sem ir para a rodada 2)', () => {
    const { who, round, outs, civs } = mk(6, 1);
    let st = elimStart(who, round, 3);
    expect(elimOutcome(st, round)).toBeNull();
    st = out(st, round, outs[0]!, civs);
    expect(elimOutcome(st, round)).toBe('innocents');
  });
  it('erro: inocente eliminado e a partida segue; depois acerta e ganha', () => {
    const { who, round, outs, civs } = mk(6, 1);
    let st = elimStart(who, round, 3);
    st = out(st, round, civs[0]!);
    expect(elimOutcome(st, round)).toBeNull();
    expect(st.alive).toHaveLength(5);
    st = out(st, round, outs[0]!);
    expect(elimOutcome(st, round)).toBe('innocents');
  });
  it('dois impostores: um sai, a partida continua; os dois saem, inocentes vencem', () => {
    const { who, round, outs, civs } = mk(6, 2);
    let st = elimStart(who, round, 3);
    expect(st.total).toBe(3);
    st = out(st, round, outs[0]!);
    expect(elimOutcome(st, round)).toBeNull();
    st = out(st, round, outs[1]!);
    expect(elimOutcome(st, round)).toBe('innocents');
    void civs;
  });
  it('paridade: com 2 impostores em 6, o segundo erro dos inocentes dá a vitória aos impostores', () => {
    const { who, round, civs } = mk(6, 2);
    let st = elimStart(who, round, 3);
    st = out(st, round, civs[0]!);
    expect(elimOutcome(st, round)).toBeNull(); // 3 inocentes x 2 impostores
    st = out(st, round, civs[1]!);
    expect(elimOutcome(st, round)).toBe('impostors'); // 2 x 2
  });
  it('acabaram as rodadas com impostor vivo: impostores vencem', () => {
    const { who, round, civs } = mk(10, 2);
    let st = elimStart(who, round, 3);
    for (let i = 0; i < 3; i++) {
      expect(elimOutcome(st, round)).toBeNull();
      st = out(st, round, civs[i]!);
    }
    expect(elimOutcome(st, round)).toBe('impostors');
  });
  it('3 impostores e 2 rodadas pedidas: o app sobe para 4 rodadas', () => {
    const { who, round } = mk(8, 3);
    expect(elimStart(who, round, 2).total).toBe(4);
  });
  it('pontos: time inteiro ganha, inclusive os eliminados', () => {
    const { who, round, outs, civs } = mk(6, 1);
    let st = elimStart(who, round, 3);
    st = out(st, round, civs[0]!, [civs[1]!]);
    st = out(st, round, outs[0]!, [civs[1]!, civs[2]!, civs[3]!]);
    const r = scoreElimination(who, round, st, 'innocents');
    expect(r.innocentsWin).toBe(true);
    expect(r.points[civs[0]!]).toBe(IM_POINTS.innocentsWin); // eliminado, mas o time ganhou
    expect(r.points[civs[2]!]).toBe(IM_POINTS.innocentsWin + IM_POINTS.rightVote);
    expect(r.points[outs[0]!]).toBe(0);
    const r2 = scoreElimination(who, round, st, 'impostors');
    expect(r2.points[outs[0]!]).toBe(IM_POINTS.outsiderSurvived); // eliminado, mas o time ganhou
    expect(r2.points[civs[0]!]).toBe(0);
  });

  it('modo de perguntas também mostra o tema a quem recebe a pergunta', () => {
    const q: ImQuestion = { id: 'q1', category: 'comida', q: 'Qual a sua comida favorita?', qPair: 'Qual a sua bebida favorita?' };
    const r = drawRound({ ids, settings: base({ mode: 'wrong' }), words, questions: [q], categoryLabels: { comida: 'Comida' }, seed: 's', roundIndex: 0, history: IM_EMPTY_HISTORY });
    for (const role of Object.values(r.roles)) expect(role.theme).toBe('Comida');
  });

  it('perguntas com eliminação: uma pergunta nova por rodada, sem repetir', () => {
    const qs: ImQuestion[] = Array.from({ length: 9 }, (_, i) => ({ id: `q${i}`, category: 'comida', q: `Pergunta ${i}?`, qPair: `Parecida ${i}?` }));
    const r = drawRound({ ids, settings: base({ mode: 'wrong', voteMode: 'elim' }), words, questions: qs, categoryLabels: { comida: 'Comida' }, seed: 's', roundIndex: 0, history: IM_EMPTY_HISTORY });
    expect(r.qa).toBeDefined();
    expect(new Set(r.qa!.map((x) => x.id)).size).toBe(r.qa!.length);
    expect(r.qa![0]!.civil).toBe(r.civilText);
    const civil = ids.find((i) => r.roles[i]!.kind === 'civil')!;
    const imp = ids.find((i) => r.roles[i]!.kind !== 'civil')!;
    expect(imRoundView(r, civil, 1).text).toBe(r.qa![0]!.civil);
    expect(imRoundView(r, civil, 2).text).toBe(r.qa![1]!.civil);
    expect(imRoundView(r, imp, 2).text).toBe(r.qa![1]!.outsider);
    expect(imRoundView(r, civil, 2).text).not.toBe(imRoundView(r, civil, 1).text);
    // no voto final a pergunta é uma só
    const f = drawRound({ ids, settings: base({ mode: 'wrong' }), words, questions: qs, seed: 's', roundIndex: 0, history: IM_EMPTY_HISTORY });
    expect(f.qa).toBeUndefined();
  });
});
