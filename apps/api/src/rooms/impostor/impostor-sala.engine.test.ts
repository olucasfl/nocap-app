import { describe, expect, it } from 'vitest';
import { RoomError } from '../color-room.engine';
import { ImpostorSalaEngine, SALA_CLUE_MS, SALA_ELIM_MS, SALA_REVEAL_MS, SALA_SHOW_MS } from './impostor-sala.engine';

const IDS = ['ana', 'bia', 'cris', 'dani', 'edu', 'fran'];

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
    // a cerimônia termina sozinha e o placar fecha
    adv(SALA_REVEAL_MS + 1);
    const done = snap(e, 'ana');
    expect(done.mesa.stage).toBe('score');
    expect(done.mesa.result.word).toBeTruthy();
    expect(done.mesa.result.innocentsWin).toBe(true);
    expect(done.mesa.session.games).toBe(1);
    expect(done.mesa.session.ranking.reduce((a: number, r: any) => a + r.points, 0)).toBeGreaterThan(0);
  });

  it('durante a cerimônia a palavra e os pontos ainda não aparecem', () => {
    const { e, ids } = setup();
    e.start('ana');
    toDebate(e, ids);
    for (const id of ids) e.readyToVote(id);
    const imp = ids.find((id) => (snap(e, id).mesa.me.kind as string) !== 'civil')!;
    for (const id of ids) e.castVote(id, id === imp ? ids.find((x) => x !== imp)! : imp);
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
    const { e, ids, adv } = setup(5);
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
    const { e, ids, adv } = setup(5);
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

  describe('eliminação', () => {
    const elimSetup = (n: number, impostors: number, rounds = 3, extra: Record<string, unknown> = {}) => {
      const r = setup(n, { voteMode: 'elim', impostors, rounds, revealRoles: true, ...extra });
      r.e.start('ana');
      for (const id of r.ids) r.e.markSeen(id);
      return r;
    };
    const roleOf = (e: ImpostorSalaEngine, id: string) => snap(e, id).mesa.me.kind as string;
    /** Uma rodada de dicas completa: cada vivo dá uma dica, na ordem. */
    const clueRound = (e: ImpostorSalaEngine, tag: string) => {
      const n = (snap(e, 'ana').mesa.alive as string[]).length;
      for (let i = 0; i < n; i++) e.submitClue(snap(e, 'ana').mesa.speaker as string, `d${tag}${i}x`);
    };
    const voteAll = (e: ImpostorSalaEngine, target: string) => {
      for (const id of snap(e, 'ana').mesa.alive as string[]) {
        const t = id === target ? (snap(e, 'ana').mesa.alive as string[]).find((x) => x !== target)! : target;
        e.castVote(id, t);
      }
    };

    it('depois das dicas vai direto à votação (sem debate); quem sai é eliminado e a partida acaba com 1 impostor pego', () => {
      const { e, ids, adv } = elimSetup(6, 1);
      clueRound(e, 'a');
      expect(snap(e, 'ana').phase).toBe('vote');
      const imp = ids.find((id) => roleOf(e, id) !== 'civil')!;
      voteAll(e, imp);
      const s = snap(e, 'ana');
      expect(s.phase).toBe('reveal');
      expect(s.mesa.stage).toBe('elim');
      expect(s.mesa.elim.steps[0].out).toBe(imp);
      expect(s.mesa.elim.steps[0].role).toBe('impostor');
      expect(s.mesa.elim.winner).toBe('innocents');
      adv(SALA_ELIM_MS + 1);
      const done = snap(e, 'ana');
      expect(done.mesa.stage).toBe('score');
      expect(done.mesa.result.innocentsWin).toBe(true);
    });
    it('inocente eliminado: a rodada 2 só tem os vivos, e quem saiu não fala nem vota', () => {
      const { e, ids, adv } = elimSetup(6, 1);
      clueRound(e, 'a');
      const civil = ids.find((id) => roleOf(e, id) === 'civil')!;
      voteAll(e, civil);
      expect(snap(e, 'ana').mesa.elim.winner).toBeNull();
      adv(SALA_ELIM_MS + 1);
      const s = snap(e, 'ana');
      expect(s.phase).toBe('play');
      expect(s.mesa.clueRound).toBe(2);
      expect(s.mesa.alive).not.toContain(civil);
      // o eliminado não é chamado a falar
      for (let i = 0; i < 5; i++) {
        const sp = snap(e, 'ana').mesa.speaker as string;
        expect(sp).not.toBe(civil);
        e.submitClue(sp, `r2d${i}x`);
      }
      expect(() => e.castVote(civil, ids.find((x) => x !== civil)!)).toThrow(/eliminado/);
      const voter = (snap(e, 'ana').mesa.alive as string[])[0]!;
      expect(() => e.castVote(voter, civil)).toThrow(/eliminada/);
    });
    it('mostrar papel desligado (2 impostores): o papel de quem saiu fica em segredo até o fim', () => {
      const { e, ids, adv } = elimSetup(6, 2, 3, { revealRoles: false });
      clueRound(e, 'a');
      const civil = ids.find((id) => roleOf(e, id) === 'civil')!;
      voteAll(e, civil);
      expect(snap(e, 'bia').mesa.elim.steps[0].role).toBeNull();
      adv(SALA_ELIM_MS + 1);
      expect(snap(e, 'bia').phase).toBe('play');
    });
    it('empate: volta só com os empatados; empate de novo sorteia e sempre sai alguém', () => {
      const { e, ids } = elimSetup(6, 1);
      clueRound(e, 'a');
      const [a, b] = ids.filter((id) => id !== 'x');
      // a e b votam um no outro; os outros 4 se dividem 2 a 2
      const others = ids.filter((id) => id !== a && id !== b);
      e.castVote(a!, b!);
      e.castVote(b!, a!);
      e.castVote(others[0]!, a!);
      e.castVote(others[1]!, a!);
      e.castVote(others[2]!, b!);
      e.castVote(others[3]!, b!);
      const s = snap(e, 'ana');
      expect(s.phase).toBe('vote');
      expect(s.mesa.cands).toEqual([a, b]);
      expect(s.mesa.voted).toEqual([]);
      expect(() => e.castVote(others[0]!, others[1]!)).toThrow(/empatados/);
      e.castVote(a!, b!);
      e.castVote(b!, a!);
      e.castVote(others[0]!, a!);
      e.castVote(others[1]!, a!);
      e.castVote(others[2]!, b!);
      e.castVote(others[3]!, b!);
      const after = snap(e, 'ana');
      expect(after.phase).toBe('reveal');
      expect([a, b]).toContain(after.mesa.elim.steps[0].out);
      expect(after.mesa.elim.steps[0].drawn).toBe(true);
    });
    it('2 impostores com 2 rodadas pedidas: o jogo ganha mais rodadas', () => {
      const { e } = elimSetup(6, 2, 2);
      expect(snap(e, 'ana').mesa.elim.total).toBe(3);
    });
    it('erros dos inocentes (empate numérico): impostores vencem', () => {
      const { e, ids, adv } = elimSetup(6, 2);
      clueRound(e, 'a');
      const civils = ids.filter((id) => roleOf(e, id) === 'civil');
      voteAll(e, civils[0]!);
      adv(SALA_ELIM_MS + 1);
      clueRound(e, 'b');
      voteAll(e, civils[1]!);
      expect(snap(e, 'ana').mesa.elim.winner).toBe('impostors');
      adv(SALA_ELIM_MS + 1);
      const done = snap(e, 'ana');
      expect(done.mesa.stage).toBe('score');
      expect(done.mesa.result.innocentsWin).toBe(false);
    });
  });
});

function toDebateConnected(e: ImpostorSalaEngine, ids: string[]) {
  for (let g = 0; g < 40 && snap(e, 'ana').phase === 'play'; g++) {
    const sp = snap(e, 'ana').mesa.speaker as string;
    if (ids.includes(sp)) e.submitClue(sp, `d${g}x`);
    else break;
  }
}
