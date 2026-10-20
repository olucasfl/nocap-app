import { describe, expect, it } from 'vitest';
import { wordKey } from '@nocap/games';
import { WordLists, WORDS_DAILY_EPOCH } from './word-lists';
import { WordsService } from './words.service';
import type { WordRun } from './words.repository';

describe('listas de palavras', () => {
  const lists = new WordLists();

  it('toda resposta tem 5 letras e vale como palpite', () => {
    for (const w of lists.answers) {
      expect([...wordKey(w)]).toHaveLength(5);
      expect(lists.canonical(w)).not.toBeNull();
    }
  });

  it('a ordem do Daily não repete palavra e só usa respostas', () => {
    expect(new Set(lists.order.map(wordKey)).size).toBe(lists.order.length);
    const keys = new Set(lists.answers.map(wordKey));
    for (const w of lists.order) expect(keys.has(wordKey(w))).toBe(true);
  });

  it('palpite sem acento acha a forma correta', () => {
    expect(lists.canonical('AVIAO')).toBe(lists.accepted.get('aviao') ?? null);
    expect(lists.canonical('xxxxx')).toBeNull();
  });

  it('quando a lista acaba, repete em outra ordem, igual para todos e sem repetir dentro da volta', () => {
    const size = lists.dailyWords.length;
    const day = (n: number) => new Date(Date.parse(WORDS_DAILY_EPOCH + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
    const lap1 = Array.from({ length: size }, (_, i) => lists.daily(day(size + i)).word);
    expect(new Set(lap1).size).toBe(size);
    expect(lap1).not.toEqual(lists.dailyWords);
    expect(lists.daily(day(size)).word).toBe(lap1[0]);
    expect(lists.daily(day(size)).word).not.toBe(lists.dailyWords[size - 1]);
    expect(lists.daily(day(size)).number).toBe(size + 1);
  });

  it('o Daily anda um dia por vez e o primeiro dia é o número 1', () => {
    expect(lists.daily(WORDS_DAILY_EPOCH).number).toBe(1);
    expect(lists.daily(WORDS_DAILY_EPOCH).word).toBe(lists.order[0]);
    expect(lists.daily('2026-10-20').word).toBe(lists.order[1]);
    expect(lists.daily('2020-01-01').number).toBe(1);
  });
});

/** Repositórios em memória: o que importa aqui é a regra, não o SQL. */
function setup() {
  const rows = new Map<string, WordRun>();
  const saved: { matchId: string; ranked: boolean; kind: string; scoredTenths?: number }[] = [];
  const runs = {
    byId: async (id: string, userId: string) => {
      const r = rows.get(id);
      return r && r.userId === userId ? r : null;
    },
    daily: async (userId: string, game: string, day: string) =>
      [...rows.values()].find((r) => r.userId === userId && r.game === game && r.day === day) ?? null,
    runsOf: async (userId: string, game: string) =>
      [...rows.values()].filter((r) => r.userId === userId && r.game === game),
    recentAnswers: async (userId: string) =>
      [...rows.values()].filter((r) => r.userId === userId).flatMap((r) => r.answers),
    create: async (row: Partial<WordRun>) => {
      const created = {
        id: crypto.randomUUID(),
        guesses: [],
        state: 'open',
        matchId: null,
        day: null,
        startedAt: new Date(),
        finishedAt: null,
        ...row,
      } as WordRun;
      rows.set(created.id, created);
      return created;
    },
    appendGuess: async (id: string, userId: string, word: string, max: number) => {
      const r = rows.get(id);
      if (!r || r.userId !== userId || r.state !== 'open' || r.guesses.length >= max) return null;
      const next = { ...r, guesses: [...r.guesses, word] };
      rows.set(id, next);
      return next;
    },
    update: async (id: string, patch: Partial<WordRun>) => {
      rows.set(id, { ...rows.get(id)!, ...patch });
    },
  };
  const matches = {
    playerOfUser: async () => 'player-1',
    save: async (m: { matchId: string; ranked: boolean; kind: string; scored: { totalTenths: number } }) => {
      saved.push({ ...m, scoredTenths: m.scored.totalTenths });
      return { duplicate: false };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new WordsService(runs as any, matches as any);
  return { service, rows, saved };
}

describe('Classic Word\'s no servidor', () => {
  it('o Daily de hoje é um só: começa, retoma aberto e recusa depois de terminar', async () => {
    const { service, rows } = setup();
    const first = await service.start('wclassic', 'u1', 'classic', 'daily');
    const again = await service.start('wclassic', 'u1', 'classic', 'daily');
    expect(again.id).toBe(first.id);
    expect(first.answers).toBeNull();
    await service.giveUp('u1', first.id);
    expect(rows.get(first.id)!.state).toBe('lost');
    await expect(service.start('wclassic', 'u1', 'classic', 'daily')).rejects.toThrow();
  });

  it('o Daily só existe com uma palavra', async () => {
    const { service } = setup();
    await expect(service.start('wclassic', 'u1', 'dueto', 'daily')).rejects.toThrow();
    await expect(service.start('wclassic', 'u1', 'nada', 'solo')).rejects.toThrow();
  });

  it('vencer revela a resposta, dá a nota e salva a partida como ranqueada só no Daily', async () => {
    const { service, rows, saved } = setup();
    const run = await service.start('wclassic', 'u1', 'classic', 'daily');
    const answer = rows.get(run.id)!.answers[0]!;
    const view = await service.move('u1', run.id, answer);
    expect(view.state).toBe('won');
    expect(view.answers).toEqual([answer]);
    expect(view.nota).toBe(10);
    expect(saved).toEqual([expect.objectContaining({ matchId: run.id, ranked: true, kind: 'daily' })]);
    await expect(service.move('u1', run.id, answer)).rejects.toThrow();
  });

  it('modo livre não vai para o ranking e o Quarteto sorteia 4 palavras diferentes', async () => {
    const { service, rows, saved } = setup();
    const run = await service.start('wclassic', 'u1', 'quarteto', 'solo');
    expect(run.boards).toHaveLength(4);
    expect(new Set(rows.get(run.id)!.answers).size).toBe(4);
    await service.giveUp('u1', run.id);
    expect(saved[0]).toMatchObject({ ranked: false, kind: 'solo' });
  });

  it('palpite com palavra fora da lista ou de outro tamanho é recusado e não gasta tentativa', async () => {
    const { service, rows } = setup();
    const run = await service.start('wclassic', 'u1', 'classic', 'solo');
    await expect(service.move('u1', run.id, 'xxxxx')).rejects.toThrow();
    await expect(service.move('u1', run.id, 'casa')).rejects.toThrow();
    expect(rows.get(run.id)!.guesses).toHaveLength(0);
  });

  it('modo livre: voltar continua a partida aberta; ao terminar a próxima palavra já está sorteada', async () => {
    const { service, rows } = setup();
    const first = await service.start('wclassic', 'u1', 'classic', 'solo');
    const again = await service.start('wclassic', 'u1', 'classic', 'solo');
    expect(again.id).toBe(first.id);
    await service.giveUp('u1', first.id);
    const open = [...rows.values()].filter((r) => r.kind === 'solo' && r.mode === 'classic' && r.state === 'open');
    expect(open).toHaveLength(1);
    expect(open[0]!.id).not.toBe(first.id);
    const next = await service.start('wclassic', 'u1', 'classic', 'solo');
    expect(next.id).toBe(open[0]!.id);
  });

  it('as palavras do Daily ficam separadas das dos modos livres', async () => {
    const { service } = setup();
    const daily = new Set(service.lists.dailyWords.map(wordKey));
    for (const w of service.lists.freeAnswers) expect(daily.has(wordKey(w))).toBe(false);
    expect(service.lists.dailyWords.length).toBeGreaterThanOrEqual(300);
    expect(service.lists.freeAnswers.length).toBeGreaterThanOrEqual(300);
  });

  it('a partida guarda as tentativas (e não uma nota): acertar no 1º = 10, não acertar = tentativas + 1', async () => {
    const { service, rows, saved } = setup();
    const won = await service.start('wclassic', 'u1', 'classic', 'daily');
    await service.move('u1', won.id, rows.get(won.id)!.answers[0]!);
    expect(saved[0]).toMatchObject({ scoredTenths: 10 });
    const run = await service.start('wclassic', 'u2', 'classic', 'daily');
    await service.giveUp('u2', run.id);
    expect(saved[1]).toMatchObject({ scoredTenths: 70 });
  });

  it('o resumo dos modos mostra partidas, vitórias e a aberta', async () => {
    const { service, rows } = setup();
    const run = await service.start('wclassic', 'u1', 'dueto', 'solo');
    const answer = rows.get(run.id)!.answers[0]!;
    await service.move('u1', run.id, answer);
    const modes = await service.modes('wclassic', 'u1');
    expect(modes.dueto!.open).toEqual({ used: 1, tries: 7 });
    expect(modes.classic!.open).toBeNull();
    expect(modes.classic!.played).toBe(0);
  });

  it('a partida de outra conta não aparece', async () => {
    const { service } = setup();
    const run = await service.start('wclassic', 'u1', 'classic', 'solo');
    await expect(service.get('u2', run.id)).rejects.toThrow();
  });

  it('as 6 tentativas erradas acabam a partida e mostram a resposta', async () => {
    const { service, rows } = setup();
    const run = await service.start('wclassic', 'u1', 'classic', 'solo');
    const answer = wordKey(rows.get(run.id)!.answers[0]!);
    const wrong = service.lists.answers.filter((w) => wordKey(w) !== answer).slice(0, 6);
    let view = run;
    for (const w of wrong) view = await service.move('u1', run.id, w);
    expect(view.state).toBe('lost');
    expect(view.answers).not.toBeNull();
    expect(view.nota).toBe(0);
  });

  it('palavras comuns que também são nome de lugar ou plural valem como palpite (arcos, areia, bolos)', async () => {
    const { service } = setup();
    for (const w of ['arcos', 'areia', 'feliz', 'farol', 'bolos', 'gatos', 'mesas', 'reais']) {
      expect(service.lists.canonical(w), w).not.toBeNull();
    }
    const keys = service.accepted();
    expect(keys).toContain('arcos');
    expect(keys.length).toBeGreaterThan(10_000);
    // a lista aceita não entrega quais são as respostas
    expect(keys.length).toBeGreaterThan(service.lists.answers.length * 3);
  });

  it('o ç é uma letra à parte: o amarelo de um ç só vale quando a resposta tem ç', async () => {
    const { service, rows } = setup();
    const run = await service.start('wclassic', 'u1', 'classic', 'solo');
    // resposta com ç e palpite "barco": o c do palpite não é o ç da resposta
    rows.set(run.id, { ...rows.get(run.id)!, answers: ['braço'] });
    const view = await service.move('u1', run.id, 'barco');
    const row = view.boards[0]!.rows[0]!;
    expect(row[3]).toBe('m');
    // resposta com c comum e palpite com ç ("braço"): o ç fica cinza
    const run2 = await service.start('wclassic', 'u1', 'dueto', 'solo');
    rows.set(run2.id, { ...rows.get(run2.id)!, answers: ['barco', 'zebra'] });
    const v2 = await service.move('u1', run2.id, 'braco');
    expect(service.lists.canonical('braco')).toBe('braço');
    expect(v2.boards[0]!.rows[0]![3]).toBe('m');
  });
});
