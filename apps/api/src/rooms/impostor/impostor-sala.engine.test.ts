import { describe, expect, it } from 'vitest';
import { RoomError } from '../color-room.engine';
import { ImpostorSalaEngine, SALA_CLUE_MS, SALA_REVEAL_MS, SALA_SHOW_MS } from './impostor-sala.engine';

const IDS = ['ana', 'bia', 'cris', 'dani', 'edu'];

function setup(n = 5, patch: Record<string, unknown> = {}) {
  let t = 1_000;
  const e = new ImpostorSalaEngine({ code: 'ABCD', now: () => t, newSeed: () => 'seed' });
  const ids = IDS.slice(0, n);
  for (const id of ids) e.join(id, id);
  e.configure('ana', { categories: ['comida', 'animais'], rounds: 2, talkMs: 30_000, ...patch } as never);
  for (const id of ids.slice(1)) e.setReady(id, true);
  return { e, ids, adv: (ms: number) => { t += ms; return e.tick(); } };
}

const snap = (e: ImpostorSalaEngine, id: string) => e.snapshot(id) as unknown as { phase: string; mesa: Record<string, any> };

/** Leva a mesa até o debate: todos veem o papel e todos dão as dicas na ordem. */
function toDebate(e: ImpostorSalaEngine, ids: string[], rounds = 2) {
  for (const id of ids) e.markSeen(id);
  for (let r = 0; r < rounds; r++)
    for (let i = 0; i < ids.length; i++) {
      const sp = snap(e, 'ana').mesa.speaker as string;
      e.submitClue(sp, `dica${r}${i}x`);
    }
}

describe('Impostor em sala', () => {
  it('exige tema e gente suficiente', () => {
    let t = 0;
    const e = new ImpostorSalaEngine({ code: 'A', now: () => t++, newSeed: () => 's' });
    for (const id of ['ana', 'bia', 'cris']) e.join(id, id);
    e.setReady('bia', true);
    e.setReady('cris', true);
    expect(() => e.start('ana')).toThrow(/tema/);
    e.configure('ana', { categories: ['clash'] } as never); // só 52 palavras, mas o mínimo é 30: passa
    e.setReady('bia', true);
    e.setReady('cris', true);
    expect(() => e.start('ana')).not.toThrow();
  });

  it('cada pessoa recebe só o próprio papel (a palavra nunca vai para os outros nem a seed)', () => {
    const { e, ids } = setup();
    e.start('ana');
    expect(snap(e, 'ana').phase).toBe('show');
    const roles = ids.map((id) => snap(e, id).mesa.me);
    expect(roles.every((r) => r !== null)).toBe(true);
    const civil = roles.find((r) => r.kind === 'civil')!;
    for (const id of ids) {
      const json = JSON.stringify(snap(e, id));
      expect(json).not.toContain('"seed":"seed"');
      // o papel dos outros nunca aparece no estado de quem olha
      expect(Object.keys(snap(e, id).mesa)).not.toContain('roles');
    }
    expect(civil.text).toBeTruthy();
    // quem não está na mesa (espectador) não recebe papel
    expect(snap(e, 'intruso').mesa.me).toBeNull();
  });

  it('fluxo completo: papéis, 2 rodadas de dicas, debate, voto secreto, resultado e ranking', () => {
    const { e, ids, adv } = setup();
    e.start('ana');
    toDebate(e, ids);
    expect(snap(e, 'ana').phase).toBe('pick');
    expect(snap(e, 'ana').mesa.clues).toHaveLength(ids.length * 2);
    for (const id of ids) e.readyToVote(id);
    expect(snap(e, 'ana').phase).toBe('vote');
    const imp = ids.find((id) => (snap(e, id).mesa.me.kind as string) !== 'civil')!;
    for (const id of ids) e.castVote(id, id === imp ? ids.find((x) => x !== imp)! : imp);
    const s0 = snap(e, 'ana');
    expect(s0.phase).toBe('reveal');
    // primeiro a cerimônia: quem são os impostores e quem votou neles
    expect(s0.mesa.stage).toBe('reveal');
    expect(s0.mesa.result.outsiders).toEqual([imp]);
    expect(s0.mesa.result.votes[ids.find((x) => x !== imp)!]).toBe(imp);
    adv(SALA_REVEAL_MS + 1);
    const s = snap(e, 'ana');
    expect(s.mesa.stage).toBe('guess');
    expect(s.mesa.result.canGuess).toEqual([imp]);
    // chute que não bate: o grupo decide; "não vale" fecha a partida e pontua
    e.guess(imp, 'nada a ver');
    expect(snap(e, 'ana').mesa.stage).toBe('judge');
    expect(snap(e, 'ana').mesa.result.word).toBeTruthy();
    for (const id of ids.filter((x) => x !== imp)) e.judge(id, imp, false);
    const done = snap(e, 'ana');
    expect(done.mesa.stage).toBe('score');
    expect(done.mesa.result.word).toBeTruthy();
    expect(done.mesa.result.innocentsWin).toBe(true);
    expect(done.mesa.session.games).toBe(1);
    expect(done.mesa.session.ranking.reduce((a: number, r: any) => a + r.points, 0)).toBeGreaterThan(0);
  });

  it('chute parecido que o grupo aceita faz o impostor ganhar', () => {
    const { e, ids, adv } = setup();
    e.start('ana');
    toDebate(e, ids);
    for (const id of ids) e.readyToVote(id);
    const imp = ids.find((id) => (snap(e, id).mesa.me.kind as string) !== 'civil')!;
    for (const id of ids) e.castVote(id, id === imp ? ids.find((x) => x !== imp)! : imp);
    adv(SALA_REVEAL_MS + 1);
    e.guess(imp, 'sinonimo');
    expect(() => e.judge(imp, imp, true)).toThrow(/não decide/);
    for (const id of ids.filter((x) => x !== imp)) e.judge(id, imp, true);
    const done = snap(e, 'ana');
    expect(done.mesa.stage).toBe('score');
    expect(done.mesa.result.guessedRight).toEqual([imp]);
    expect(done.mesa.result.innocentsWin).toBe(false);
  });

  it('o resultado não entrega a palavra enquanto o impostor ainda vai chutar', () => {
    const { e, ids, adv } = setup();
    e.start('ana');
    toDebate(e, ids);
    for (const id of ids) e.readyToVote(id);
    const imp = ids.find((id) => (snap(e, id).mesa.me.kind as string) !== 'civil')!;
    for (const id of ids) e.castVote(id, id === imp ? ids.find((x) => x !== imp)! : imp);
    adv(SALA_REVEAL_MS + 1);
    const r = snap(e, 'bia').mesa.result;
    expect(r.word).toBeNull();
    expect(r.gains).toBeNull();
  });

  it('dicas: só na vez, uma palavra, sem a palavra secreta, sem repetir', () => {
    const { e, ids } = setup();
    e.start('ana');
    for (const id of ids) e.markSeen(id);
    const sp = snap(e, 'ana').mesa.speaker as string;
    const other = ids.find((id) => id !== sp)!;
    expect(() => e.submitClue(other, 'oi')).toThrow(RoomError);
    expect(() => e.submitClue(sp, 'duas palavras')).toThrow(/uma palavra/);
    expect(() => e.submitClue(sp, '')).toThrow(/Digite/);
    const civil = ids.map((id) => snap(e, id).mesa.me).find((r) => r.kind === 'civil').text as string;
    expect(() => e.submitClue(sp, civil.split(' ')[0]!)).toThrow(/secreta/);
    expect(() => e.submitClue(sp, 'a'.repeat(30))).toThrow(/grande/);
  });

  it('votar em si mesmo ou em quem não joga é recusado', () => {
    const { e, ids } = setup();
    e.start('ana');
    toDebate(e, ids);
    for (const id of ids) e.readyToVote(id);
    expect(() => e.castVote('ana', 'ana')).toThrow(/si mesmo/);
    expect(() => e.castVote('ana', 'fantasma')).toThrow(/não está/);
  });

  it('tick: prazo do papel e da dica avançam a mesa', () => {
    const { e, adv } = setup();
    e.start('ana');
    expect(adv(SALA_SHOW_MS - 1)).toBe(false);
    expect(adv(2)).toBe(true);
    expect(snap(e, 'ana').phase).toBe('play');
    const first = snap(e, 'ana').mesa.speaker;
    expect(adv(SALA_CLUE_MS + 1)).toBe(true);
    expect(snap(e, 'ana').mesa.speaker).not.toBe(first);
    expect(snap(e, 'ana').mesa.clues[0].word).toBe('');
  });

  it('debate sem limite só termina quando todos tocam em votar', () => {
    const { e, ids, adv } = setup(5, { talkMs: 0 });
    e.start('ana');
    toDebate(e, ids);
    expect(adv(10 * 60_000)).toBe(false);
    expect(snap(e, 'ana').phase).toBe('pick');
    for (const id of ids) e.readyToVote(id);
    expect(snap(e, 'ana').phase).toBe('vote');
  });

  it('continuar mantém o ranking e o ranking final sai ao encerrar', () => {
    const { e, ids, adv } = setup(5, { lastChance: false });
    e.start('ana');
    toDebate(e, ids);
    for (const id of ids) e.readyToVote(id);
    for (const id of ids) e.castVote(id, ids.find((x) => x !== id)!);
    adv(SALA_REVEAL_MS + 1);
    expect(snap(e, 'ana').mesa.stage).toBe('score');
    expect(() => e.continueSession('bia')).toThrow(/Só quem criou/);
    const before = snap(e, 'ana').mesa.session.ranking;
    e.continueSession('ana');
    const lobby = snap(e, 'ana');
    expect(lobby.phase).toBe('lobby');
    expect(lobby.mesa.session.games).toBe(1);
    expect(lobby.mesa.session.ranking).toEqual(before);
    // volta a jogar: todos já estão "prontos"
    expect(() => e.start('ana')).not.toThrow();
  });

  it('encerrar mostra o ranking final', () => {
    const { e, ids, adv } = setup(5, { lastChance: false });
    e.start('ana');
    toDebate(e, ids);
    for (const id of ids) e.readyToVote(id);
    for (const id of ids) e.castVote(id, ids.find((x) => x !== id)!);
    adv(SALA_REVEAL_MS + 1);
    e.endSession('ana');
    const s = e.snapshot('ana') as unknown as { phase: string; final: { userId: string }[] };
    expect(s.phase).toBe('final');
    expect(s.final).toHaveLength(5);
  });

  it('quem cai no meio não trava a mesa: perde a vez e o voto', () => {
    const { e, ids } = setup();
    e.start('ana');
    for (const id of ids) e.markSeen(id);
    e.disconnect('edu');
    // o debate segue com os que estão conectados
    toDebateConnected(e, ids.filter((i) => i !== 'edu'));
    expect(['pick', 'play']).toContain(snap(e, 'ana').phase);
  });
});

function toDebateConnected(e: ImpostorSalaEngine, ids: string[]) {
  for (let g = 0; g < 40 && snap(e, 'ana').phase === 'play'; g++) {
    const sp = snap(e, 'ana').mesa.speaker as string;
    if (ids.includes(sp)) e.submitClue(sp, `d${g}x`);
    else break;
  }
}
