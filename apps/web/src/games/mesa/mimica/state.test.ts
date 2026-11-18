import { describe, expect, it } from 'vitest';
import { initial, mimerId, reducer, sidesOf, type Action, type State } from './state';

const run = (s: State, ...as: Action[]) => as.reduce(reducer, s);
const withPlayers = (s: State, names: string[]) => names.reduce((acc, n) => reducer(acc, { type: 'addPlayer', name: n }), s);

function ready(format: 'teams' | 'solo', style: 'classic' | 'speed', rounds = 2): State {
  let s = initial();
  s = run(s, { type: 'mode', format, style }, { type: 'settings', patch: { rounds } });
  if (format === 'solo') s = withPlayers(s, ['Ana', 'Beto', 'Caio']);
  else s = run(s, { type: 'addTeam' });
  return run(s, { type: 'start' }, { type: 'ready' });
}

describe('estado da mímica', () => {
  it('começa com 2 times prontos e temas sem Músicas e Marcas', () => {
    const s = initial();
    expect(s.teams).toHaveLength(2);
    expect(s.settings.categories).not.toContain('musica');
    expect(s.settings.categories).not.toContain('marcas');
    expect(s.settings.categories).toContain('animais');
  });
  it('trocar para Speed liga o tema Ações e o tempo padrão de 60 s', () => {
    const s = run(initial(), { type: 'mode', format: 'teams', style: 'speed' });
    expect(s.settings.seconds).toBe(60);
    expect(s.settings.categories).toContain('acoes');
  });
  it('limites: no máximo 5 times, no mínimo 2 jogadores para começar', () => {
    let s = initial();
    for (let i = 0; i < 6; i++) s = run(s, { type: 'addTeam' });
    expect(s.teams).toHaveLength(5);
    const solo = run(initial(), { type: 'mode', format: 'solo', style: 'classic' });
    expect(run(solo, { type: 'start' }).phase).toBe('mode');
    expect(run(withPlayers(solo, ['A']), { type: 'start' }).error).toBeTruthy();
    expect(run(withPlayers(solo, ['A', 'B']), { type: 'start' }).phase).toBe('pass');
  });
  it('Clássico em Times: acertou no tempo dá 3 ao time da mímica e fecha o turno', () => {
    let s = ready('teams', 'classic');
    expect(s.phase).toBe('choose');
    expect(s.cur?.options).toHaveLength(3);
    const first = mimerId(s);
    s = run(s, { type: 'choose', id: s.cur!.options[0]!.id }, { type: 'hit' });
    expect(s.phase).toBe('result');
    expect(s.session.scores[first]).toBe(3);
    expect(s.used).toHaveLength(1);
  });
  it('Clássico em Times: sem acerto o roubo dá 1 a cada time que acertou', () => {
    let s = ready('teams', 'classic');
    const me = mimerId(s);
    const others = s.teams.filter((t) => t.id !== me).map((t) => t.id);
    s = run(s, { type: 'choose', id: s.cur!.options[0]!.id }, { type: 'timeup' });
    expect(s.phase).toBe('judge');
    s = run(s, { type: 'judge', guessed: false });
    expect(s.phase).toBe('steal');
    s = run(s, { type: 'steal', ids: [others[0]!, others[1]!] });
    expect(s.session.scores[me]).toBe(0);
    expect(s.session.scores[others[0]!]).toBe(1);
    expect(s.session.scores[others[1]!]).toBe(1);
  });
  it('Clássico Individual: tempo acabou vai para "quem acertou", 3 e 2 pontos', () => {
    let s = ready('solo', 'classic');
    const me = mimerId(s);
    const other = s.players.find((p) => p.id !== me)!.id;
    s = run(s, { type: 'choose', id: s.cur!.options[0]!.id }, { type: 'timeup' });
    expect(s.phase).toBe('pick');
    s = run(s, { type: 'pick', id: other });
    expect(s.session.scores[other]).toBe(3);
    expect(s.session.scores[me]).toBe(2);
  });
  it('Speed em Times: 1 ponto por acerto, 3 pulos no máximo', () => {
    let s = ready('teams', 'speed');
    expect(s.phase).toBe('play');
    const me = mimerId(s);
    s = run(s, { type: 'speedHit' }, { type: 'speedHit' }, { type: 'speedSkip' }, { type: 'speedSkip' }, { type: 'speedSkip' }, { type: 'speedSkip' }, { type: 'speedHit' });
    expect(s.cur!.speed!.skipped).toHaveLength(3);
    s = run(s, { type: 'timeup' });
    expect(s.phase).toBe('result');
    expect(s.session.scores[me]).toBe(3);
  });
  it('Speed Individual: o tempo leva a "quem acertou" e os pontos seguem o contador', () => {
    let s = ready('solo', 'speed');
    const me = mimerId(s);
    const [a, b] = s.players.filter((p) => p.id !== me);
    s = run(s, { type: 'speedHit' }, { type: 'speedHit' }, { type: 'speedHit' }, { type: 'timeup' });
    expect(s.phase).toBe('assign');
    s = run(s, { type: 'assign', guessedBy: { [a!.id]: 2, [b!.id]: 1 } });
    expect(s.session.scores[me]).toBe(6);
    expect(s.session.scores[a!.id]).toBe(2);
    expect(s.session.scores[b!.id]).toBe(1);
  });
  it('Speed Individual sem acertos vai direto ao resultado', () => {
    let s = ready('solo', 'speed');
    s = run(s, { type: 'timeup' });
    expect(s.phase).toBe('result');
  });
  it('percorre o calendário até o final e sorteia palavras novas a cada turno', () => {
    let s = ready('teams', 'classic', 1);
    const seen = new Set<string>();
    for (let t = 0; t < 3; t++) {
      const id = s.cur!.options[0]!.id;
      seen.add(id);
      s = run(s, { type: 'choose', id }, { type: 'hit' }, { type: 'next' });
      if (t < 2) s = run(s, { type: 'ready' });
    }
    expect(s.phase).toBe('final');
    expect(seen.size).toBe(3);
    expect(sidesOf(s).length).toBe(3);
  });
  it('"jogar de novo" zera o placar e volta à vez do primeiro', () => {
    let s = ready('teams', 'classic', 1);
    s = run(s, { type: 'choose', id: s.cur!.options[0]!.id }, { type: 'hit' }, { type: 'again' });
    expect(s.phase).toBe('pass');
    expect(s.turn).toBe(0);
    expect(Object.values(s.session.scores).every((n) => n === 0)).toBe(true);
  });
});

describe('toques atrasados e cartelas', () => {
  it('"timeup" repetido não pontua duas vezes e acerto depois do fim é ignorado', () => {
    let s = ready('teams', 'speed');
    const me = mimerId(s);
    s = run(s, { type: 'speedHit' }, { type: 'speedHit' }, { type: 'timeup' });
    const once = s.session.scores[me];
    expect(once).toBe(2);
    s = run(s, { type: 'timeup' }, { type: 'speedHit' }, { type: 'speedSkip' });
    expect(s.session.scores[me]).toBe(2);
    expect(s.phase).toBe('result');
  });
  it('"hit" fora da fase de jogo não faz nada', () => {
    const s = ready('teams', 'classic');
    expect(s.phase).toBe('choose');
    expect(run(s, { type: 'hit' }).phase).toBe('choose');
  });
  it('guarda a fase anterior e se o turno acabou por tempo', () => {
    let s = ready('solo', 'classic');
    s = run(s, { type: 'choose', id: s.cur!.options[0]!.id });
    expect(s.prev).toBe('choose');
    const hit = run(s, { type: 'hit' });
    expect(hit.phase).toBe('pick');
    expect(hit.timedOut).toBe(false);
    const late = run(s, { type: 'timeup' });
    expect(late.phase).toBe('pick');
    expect(late.timedOut).toBe(true);
    expect(late.prev).toBe('play');
  });
});
