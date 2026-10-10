import { describe, expect, it } from 'vitest';
import {
  BATIDA_LANES,
  BATIDA_MAX_TENTHS,
  BatidaSim,
  ENERGY_START,
  BATIDA_MAX_HOLD_MS,
  GOOD_MS,
  HOLD_END_SLACK_MS,
  chanceAt,
  PERFECT_MS,
  SONGS,
  SONG_IDS,
  barAt,
  barMs,
  barStart,
  batidaMode,
  bpmAt,
  evaluateBatida,
  isSongId,
  judge,
  levelAt,
  multiplierFor,
  notesBetween,
  notesInBar,
  phraseNotes,
  rootAt,
  semitoneOf,
  songOfMode,
  timeOf,
  validateTaps,
  type BatidaNote,
  type BatidaTap,
  type Song,
} from './rhythm';

const SEED = 'seed-teste';
const SONG = SONGS.mare;
const ALL: Song[] = SONG_IDS.map((id) => SONGS[id]);

/** Toques perfeitos em todas as notas até `bars` compassos. */
function perfectTaps(seed: string, song: Song, bars: number, offset = 0): BatidaTap[] {
  const out: BatidaTap[] = [];
  for (let bar = 0; bar < bars; bar++) {
    for (const n of notesInBar(seed, song, bar)) {
      const down = Math.round(n.t) + offset;
      out.push({
        lane: n.lane,
        t: down,
        up: n.endT ? Math.round(n.endT) + offset + 10 : down + 40,
      });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

describe('as três músicas', () => {
  it('têm nomes, propostas e identidades diferentes', () => {
    expect(ALL.map((s) => s.name)).toEqual(['Primeiro Passo', 'Maré Alta', 'Frenesi']);
    expect(new Set(ALL.map((s) => s.groove)).size).toBe(3);
    expect(new Set(ALL.map((s) => s.lead)).size).toBe(3);
    expect(new Set(ALL.map((s) => s.scale.join())).size).toBe(3);
    for (const s of ALL) expect(s.tagline.length).toBeGreaterThan(20);
  });

  it('ficam mais exigentes uma depois da outra', () => {
    const [a, b, c] = ALL as [Song, Song, Song];
    expect(a.startBpm).toBeLessThan(b.startBpm);
    expect(b.startBpm).toBeLessThan(c.startBpm);
    // O andamento sobe mais depressa nas mais difíceis, mas em todas ele sobe sem parar.
    expect(a.bpmPerBar).toBeLessThan(b.bpmPerBar);
    expect(b.bpmPerBar).toBeLessThan(c.bpmPerBar);
    expect(a.levelStart).toBeLessThan(c.levelStart);
  });

  it('todas escalam sem parar: o andamento continua subindo por muitos minutos', () => {
    for (const s of ALL) {
      expect(bpmAt(s, 80)).toBeGreaterThan(bpmAt(s, 40));
      expect(bpmAt(s, 40)).toBeGreaterThan(bpmAt(s, 20));
      expect(s.maxBpm).toBeGreaterThanOrEqual(300);
    }
    // O fácil não fica parado em 100: ele só demora mais para chegar rápido.
    expect(bpmAt(SONGS.passo, 100)).toBeGreaterThan(170);
    expect(bpmAt(SONGS.passo, 10)).toBeLessThan(bpmAt(SONGS.mare, 10));
  });

  it('os ids e o modo guardado no servidor', () => {
    expect(SONG_IDS).toEqual(['passo', 'mare', 'frenesi']);
    expect(isSongId('mare')).toBe(true);
    expect(isSongId('outra')).toBe(false);
    expect(batidaMode('frenesi')).toBe('batida-frenesi');
    expect(songOfMode('batida-passo')).toBe(SONGS.passo);
    expect(songOfMode('batida-xyz')).toBeNull();
    expect(songOfMode('classic')).toBeNull();
    expect(songOfMode('batida')).toBeNull();
  });

  it('cada música gera notas diferentes para a mesma seed', () => {
    const [a, b, c] = ALL.map((s) => JSON.stringify(notesBetween(SEED, s, 0, 40_000)));
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
  });
});

describe('andamento', () => {
  it('começa no início da música, sobe a cada compasso e só para num teto altíssimo', () => {
    for (const s of ALL) {
      expect(bpmAt(s, 0)).toBe(s.startBpm);
      expect(bpmAt(s, 10)).toBeGreaterThan(bpmAt(s, 1));
      expect(bpmAt(s, 10_000)).toBe(s.maxBpm);
    }
  });

  it('o compasso encolhe conforme o andamento sobe', () => {
    expect(barMs(SONG, 0)).toBeCloseTo((4 * 60_000) / SONG.startBpm, 5);
    expect(barMs(SONG, 20)).toBeLessThan(barMs(SONG, 0));
  });

  it('os compassos se encaixam um depois do outro', () => {
    expect(barStart(SONG, 0)).toBe(0);
    expect(barStart(SONG, 3)).toBeCloseTo(barMs(SONG, 0) + barMs(SONG, 1) + barMs(SONG, 2), 5);
  });

  it('barAt acha o compasso de qualquer instante (e é o inverso de barStart)', () => {
    for (const s of ALL) {
      for (const bar of [0, 1, 5, 40, 120]) {
        expect(barAt(s, barStart(s, bar))).toBe(bar);
        expect(barAt(s, barStart(s, bar) + barMs(s, bar) / 2)).toBe(bar);
        expect(barAt(s, barStart(s, bar + 1) - 1)).toBe(bar);
      }
      expect(barAt(s, -5)).toBe(0);
    }
  });

  it('timeOf divide o compasso em 8 colcheias iguais', () => {
    expect(timeOf(SONG, 2, 0)).toBeCloseTo(barStart(SONG, 2), 5);
    expect(timeOf(SONG, 2, 4)).toBeCloseTo(barStart(SONG, 2) + barMs(SONG, 2) / 2, 5);
  });
});

describe('a música da seed', () => {
  it('é a mesma para a mesma seed e diferente para outra', () => {
    const a = JSON.stringify(notesBetween(SEED, SONG, 0, 60_000));
    expect(JSON.stringify(notesBetween(SEED, SONG, 0, 60_000))).toBe(a);
    expect(JSON.stringify(notesBetween('outra-seed', SONG, 0, 60_000))).not.toBe(a);
  });

  it('a contagem (compasso 0) não tem notas e a primeira nota vem depois dela', () => {
    for (const s of ALL) {
      expect(notesInBar(SEED, s, 0)).toEqual([]);
      expect(notesBetween(SEED, s, 0, 30_000)[0]!.t).toBeGreaterThanOrEqual(barStart(s, 1));
    }
  });

  it('as notas ficam em ordem, dentro das 5 pistas e sobre as colcheias', () => {
    for (const s of ALL) {
      const notes = notesBetween(SEED, s, 0, 120_000);
      expect(notes.length).toBeGreaterThan(30);
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i]!;
        expect(n.lane).toBeGreaterThanOrEqual(0);
        expect(n.lane).toBeLessThan(BATIDA_LANES);
        expect(n.t).toBeCloseTo(timeOf(s, n.bar, n.step), 5);
        if (i > 0) expect(n.t).toBeGreaterThanOrEqual(notes[i - 1]!.t);
      }
    }
  });

  it('todo compasso depois da contagem tem notas (a partida nunca "morre de silêncio")', () => {
    for (const s of ALL) {
      for (let bar = 1; bar < 200; bar++) {
        expect(notesInBar(SEED, s, bar).length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('a dificuldade sobe dentro de cada música, até o limite dela', () => {
    for (const s of ALL) {
      expect(levelAt(s, 1)).toBe(s.levelStart);
      expect(levelAt(s, 1000)).toBe(s.levelMax);
      let prev = 0;
      for (let bar = 1; bar < 200; bar++) {
        const l = levelAt(s, bar);
        expect(l).toBeGreaterThanOrEqual(prev);
        prev = l;
      }
    }
    expect(levelAt(SONGS.passo, 1000)).toBe(4);
    expect(levelAt(SONGS.frenesi, 1)).toBe(2);
  });

  it('no Primeiro Passo o início usa só as pistas do meio e depois abre', () => {
    const p = SONGS.passo;
    const early = new Set(notesBetween(SEED, p, 0, barStart(p, 14)).map((n) => n.lane));
    expect([...early].every((l) => l >= 1 && l <= 3)).toBe(true);
    const late = new Set(
      notesBetween(SEED, p, barStart(p, 30), barStart(p, 200)).map((n) => n.lane),
    );
    expect(late.size).toBe(BATIDA_LANES);
  });

  it('o Frenesi é mais denso que o Primeiro Passo, no mesmo trecho de compassos', () => {
    const density = (s: Song, from: number, to: number) => {
      let n = 0;
      for (let b = from; b < to; b++) n += notesInBar(SEED, s, b).length;
      return n / (to - from);
    };
    expect(density(SONGS.frenesi, 1, 17)).toBeGreaterThan(density(SONGS.passo, 1, 17) + 1);
  });

  it('a frase repete o ritmo (A, A, B, A) para a música soar como tema', () => {
    for (const s of ALL) {
      const [b1, b2, , b4] = phraseNotes(SEED, s, 3);
      const steps = (notes: BatidaNote[]) => [...new Set(notes.map((n) => n.step))].join(',');
      expect(steps(b1!)).toBe(steps(b2!));
      expect(steps(b4!)).toBe(steps(b1!));
    }
  });

  it('cada frase termina na pista de repouso, a do meio', () => {
    for (const s of ALL) {
      for (let phrase = 0; phrase < 12; phrase++) {
        const bars = phraseNotes(SEED, s, phrase);
        const last = bars[bars.length - 1]!;
        const lastStep = last.at(-1)!.step;
        expect(last.filter((n) => n.step === lastStep).map((n) => n.lane)).toContain(2);
      }
    }
  });
});

describe('harmonia', () => {
  it('o acorde muda a cada 2 compassos e a progressão volta ao início', () => {
    for (const s of ALL) {
      expect(rootAt(s, 1)).toBe(rootAt(s, 2));
      const len = s.progression.length * 2;
      expect(rootAt(s, 1)).toBe(rootAt(s, 1 + len));
    }
    expect(rootAt(SONGS.passo, 3)).not.toBe(rootAt(SONGS.passo, 2));
  });

  it('cada pista é um grau da escala da música sobre a raiz do acorde', () => {
    for (const s of ALL) {
      const base = rootAt(s, 1);
      expect([0, 1, 2, 3, 4].map((l) => semitoneOf(s, l, 1) - base)).toEqual([...s.scale]);
    }
  });
});

describe('julgamento e multiplicador', () => {
  it('Perfeito, Bom e Errou pelas janelas, para os dois lados', () => {
    expect(judge(0)).toBe('perfect');
    expect(judge(PERFECT_MS)).toBe('perfect');
    expect(judge(-PERFECT_MS)).toBe('perfect');
    expect(judge(PERFECT_MS + 1)).toBe('good');
    expect(judge(-GOOD_MS)).toBe('good');
    expect(judge(GOOD_MS + 1)).toBe('miss');
  });

  it('o multiplicador sobe com o combo: x1, x2 (8), x3 (16), x4 (32)', () => {
    expect([0, 7, 8, 15, 16, 31, 32, 200].map(multiplierFor)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('evaluateBatida', () => {
  it('quem acerta tudo em cheio acumula combo e a energia nunca acaba enquanto toca', () => {
    for (const s of ALL) {
      const run = evaluateBatida(SEED, s, perfectTaps(SEED, s, 60));
      expect(run.endedAtMs).toBeGreaterThan(barStart(s, 60));
      expect(run.stray).toBe(0);
      expect(run.good).toBe(0);
      expect(run.perfect).toBeGreaterThan(100);
      expect(run.maxCombo).toBe(run.perfect);
      expect(run.tenths).toBeGreaterThan(0);
    }
  });

  it('sem nenhum toque a energia acaba sozinha, nas primeiras notas', () => {
    const run = evaluateBatida(SEED, SONG, []);
    expect(run.perfect + run.good).toBe(0);
    // 70 de energia, -14 por nota perdida: a quinta nota perdida zera.
    expect(run.missed).toBe(Math.ceil(ENERGY_START / 14));
    expect(run.tenths).toBe(0);
    expect(run.endedBar).toBeGreaterThanOrEqual(1);
  });

  it('acertar tarde, mas dentro da janela, vale Bom (metade dos pontos)', () => {
    const run = evaluateBatida(SEED, SONG, perfectTaps(SEED, SONG, 6, PERFECT_MS + 20));
    expect(run.perfect).toBe(0);
    expect(run.good).toBeGreaterThan(5);
    expect(run.endedAtMs).toBeGreaterThan(barStart(SONG, 6));
    expect(evaluateBatida(SEED, SONG, perfectTaps(SEED, SONG, 6)).tenths).toBeGreaterThan(
      run.tenths,
    );
  });

  it('o multiplicador entra: acertos em sequência valem mais do que o mesmo número quebrado', () => {
    const all = notesBetween(SEED, SONG, 0, barStart(SONG, 10)).map((n) => ({
      lane: n.lane,
      t: Math.round(n.t),
      up: n.endT ? Math.round(n.endT) + 10 : Math.round(n.t) + 40,
    }));
    const sequence = evaluateBatida(SEED, SONG, all);
    const broken = evaluateBatida(
      SEED,
      SONG,
      all.filter((_, i) => i % 4 !== 3),
    );
    expect(sequence.maxCombo).toBeGreaterThan(8);
    expect(broken.maxCombo).toBeLessThan(4);
    expect(sequence.tenths / sequence.perfect).toBeGreaterThan(broken.tenths / broken.perfect);
  });

  it('tocar sem nota por perto custa energia e zera o combo', () => {
    const run = evaluateBatida(SEED, SONG, [
      { lane: 0, t: 100, up: 140 },
      ...perfectTaps(SEED, SONG, 20),
    ]);
    expect(run.stray).toBeGreaterThanOrEqual(1);
    expect(run.endedAtMs).toBeGreaterThan(barStart(SONG, 20));
  });

  it('é determinística: os mesmos toques dão sempre o mesmo resultado', () => {
    const taps = perfectTaps(SEED, SONG, 30).filter((_, i) => i % 5 !== 0);
    expect(evaluateBatida(SEED, SONG, taps)).toEqual(evaluateBatida(SEED, SONG, taps));
  });

  it('os toques de uma música não valem em outra (cada uma tem as suas notas)', () => {
    const taps = perfectTaps(SEED, SONGS.passo, 20);
    const onOther = evaluateBatida(SEED, SONGS.frenesi, taps);
    expect(onOther.endedAtMs).toBeLessThan(barStart(SONGS.frenesi, 20));
  });

  it('a nota não passa do teto guardado', () => {
    expect(evaluateBatida(SEED, SONG, perfectTaps(SEED, SONG, 500)).tenths).toBeLessThanOrEqual(
      BATIDA_MAX_TENTHS,
    );
  });

  it('cada toque vale uma nota só: bater duas vezes na mesma nota gasta energia', () => {
    const note = notesBetween(SEED, SONG, 0, 30_000)[0]!;
    const t = Math.round(note.t);
    const run = evaluateBatida(SEED, SONG, [
      { lane: note.lane, t, up: t + 20 },
      { lane: note.lane, t: t + 60, up: t + 80 },
    ]);
    expect(run.perfect).toBe(1);
    expect(run.stray).toBe(1);
  });

  it('conta os toques até o fim; toque depois da energia zerada não conta', () => {
    const taps = perfectTaps(SEED, SONG, 6);
    expect(evaluateBatida(SEED, SONG, taps).usedTaps).toBe(taps.length);
    const dead = evaluateBatida(SEED, SONG, []);
    const late = evaluateBatida(SEED, SONG, [
      { lane: 0, t: Math.round(dead.endedAtMs) + 5000, up: Math.round(dead.endedAtMs) + 5040 },
    ]);
    expect(late.usedTaps).toBe(0);
  });
});

describe('validateTaps', () => {
  it('aceita toques em ordem, cada um com o instante de soltar', () => {
    expect(
      validateTaps([
        { lane: 0, t: 1000, up: 1050 },
        { lane: 4, t: 1010, up: 1060 },
      ]),
    ).toBeNull();
    expect(validateTaps([])).toBeNull();
  });

  it('recusa pista inválida, instante quebrado e fora de ordem', () => {
    expect(validateTaps([{ lane: 5, t: 10, up: 50 }])).toMatch(/Pista/);
    expect(validateTaps([{ lane: 0, t: 1.5, up: 50 }])).toMatch(/Instante/);
    expect(validateTaps([{ lane: 0, t: -1, up: 50 }])).toMatch(/Instante/);
    expect(
      validateTaps([
        { lane: 0, t: 500, up: 540 },
        { lane: 1, t: 400, up: 440 },
      ]),
    ).toMatch(/ordem/);
  });

  it('soltar tem que vir depois de apertar, e não passar de 30 s', () => {
    expect(validateTaps([{ lane: 0, t: 500, up: 500 }])).toMatch(/Soltou/);
    expect(validateTaps([{ lane: 0, t: 500, up: 400 }])).toMatch(/Soltou/);
    expect(validateTaps([{ lane: 0, t: 500, up: 500.5 }])).toMatch(/Soltou/);
    expect(validateTaps([{ lane: 0, t: 500, up: 500 + BATIDA_MAX_HOLD_MS + 1 }])).toMatch(/Soltou/);
    expect(validateTaps([{ lane: 0, t: 500, up: 500 + BATIDA_MAX_HOLD_MS }])).toBeNull();
  });

  it('recusa rajada impossível na mesma pista, mas aceita pistas diferentes juntas', () => {
    expect(
      validateTaps([
        { lane: 2, t: 1000, up: 1005 },
        { lane: 2, t: 1010, up: 1020 },
      ]),
    ).toMatch(/rápidos/);
    expect(
      validateTaps([
        { lane: 2, t: 1000, up: 1020 },
        { lane: 3, t: 1010, up: 1030 },
      ]),
    ).toBeNull();
  });

  it('não dá para apertar de novo uma pista que ainda está apertada', () => {
    expect(
      validateTaps([
        { lane: 1, t: 1000, up: 2000 },
        { lane: 1, t: 1500, up: 1600 },
      ]),
    ).toMatch(/sem soltar/);
    expect(
      validateTaps([
        { lane: 1, t: 1000, up: 2000 },
        { lane: 1, t: 2000, up: 2050 },
      ]),
    ).toBeNull();
  });
});

describe('BatidaSim (a partida ao vivo)', () => {
  it('conta o mesmo que a avaliação de uma vez só, toque a toque', () => {
    const taps = perfectTaps(SEED, SONG, 30).filter((_, i) => i % 6 !== 0);
    const sim = new BatidaSim(SEED, SONG);
    for (const t of taps) {
      sim.tap(t.lane, t.t);
      if (sim.dead) break;
    }
    sim.runOut(taps[taps.length - 1]!.t);
    expect(sim.run).toEqual(evaluateBatida(SEED, SONG, taps));
  });

  it('devolve o que aconteceu: acerto com o desvio, erro de nota que passou, toque perdido', () => {
    const sim = new BatidaSim(SEED, SONG);
    const [first, second] = notesBetween(SEED, SONG, 0, 30_000);
    const hit = sim.tap(first!.lane, Math.round(first!.t) + 30);
    expect(hit).toEqual([
      expect.objectContaining({ kind: 'hit', judgement: 'perfect', delta: expect.any(Number) }),
    ]);
    const events = sim.tap((second!.lane + 2) % 5, Math.round(second!.t) + GOOD_MS + 40);
    expect(events.map((e) => e.kind)).toEqual(['miss', 'stray']);
  });

  it('expõe energia, combo e multiplicador para a barra e o placar', () => {
    const sim = new BatidaSim(SEED, SONG);
    expect(sim.currentEnergy).toBe(ENERGY_START);
    expect(sim.currentMultiplier).toBe(1);
    for (const n of notesBetween(SEED, SONG, 0, barStart(SONG, 6))) {
      sim.tap(n.lane, Math.round(n.t));
    }
    expect(sim.currentCombo).toBeGreaterThan(8);
    expect(sim.currentMultiplier).toBeGreaterThanOrEqual(2);
    expect(sim.currentEnergy).toBeGreaterThan(ENERGY_START);
  });
});

/** Notas de uma música por um bom trecho (de 1 até `bars`). */
const allNotes = (song: Song, bars: number, seed = SEED) => {
  const out: BatidaNote[] = [];
  for (let b = 1; b < bars; b++) out.push(...notesInBar(seed, song, b));
  return out;
};
const groups = (notes: BatidaNote[]) => {
  const by = new Map<string, number>();
  for (const n of notes) by.set(`${n.bar}:${n.step}`, (by.get(`${n.bar}:${n.step}`) ?? 0) + 1);
  return [...by.values()];
};

describe('acordes (notas juntas)', () => {
  it('no começo não há acorde, e depois aparecem de duas e, nas mais difíceis, de três', () => {
    for (const s of ALL) {
      expect(Math.max(...groups(allNotes(s, Math.max(2, s.doubles.from))))).toBe(1);
    }
    expect(Math.max(...groups(allNotes(SONGS.mare, 80)))).toBe(3);
    expect(Math.max(...groups(allNotes(SONGS.frenesi, 60)))).toBe(3);
    expect(Math.max(...groups(allNotes(SONGS.mare, 24)))).toBe(2);
  });

  it('nunca passa de 3 notas juntas, e todas em pistas diferentes', () => {
    for (const s of ALL) {
      const notes = allNotes(s, 300);
      expect(Math.max(...groups(notes))).toBeLessThanOrEqual(3);
      const keys = notes.map((n) => `${n.bar}:${n.step}:${n.lane}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('o fácil usa menos acordes que os outros, e o Frenesi mais que todos', () => {
    const share = (s: Song) => {
      const g = groups(allNotes(s, 120));
      return g.filter((x) => x > 1).length / g.length;
    };
    expect(share(SONGS.passo)).toBeLessThan(share(SONGS.mare));
    expect(share(SONGS.mare)).toBeLessThan(share(SONGS.frenesi));
  });

  it('a chance sobe sem parar com os compassos, até o teto', () => {
    const rule = { from: 10, base: 0.1, grow: 0.01 };
    expect(chanceAt(rule, 9, 0.5)).toBe(0);
    expect(chanceAt(rule, 10, 0.5)).toBeCloseTo(0.1, 5);
    expect(chanceAt(rule, 20, 0.5)).toBeCloseTo(0.2, 5);
    expect(chanceAt(rule, 5000, 0.5)).toBe(0.5);
  });
});

describe('notas longas (segurar)', () => {
  const holds = (song: Song, bars: number) =>
    allNotes(song, bars).filter((n) => n.endT !== undefined);

  it('aparecem depois do começo, em todas as músicas', () => {
    for (const s of ALL) {
      expect(holds(s, Math.max(2, s.holds.from)).length).toBe(0);
      expect(holds(s, 120).length).toBeGreaterThan(5);
    }
  });

  it('duram de 2 a 4 colcheias, dentro do mesmo compasso, e a pista fica livre até o fim', () => {
    for (const s of ALL) {
      const notes = allNotes(s, 200);
      for (const h of holds(s, 200)) {
        const steps = Math.round(((h.endT! - h.t) / barMs(s, h.bar)) * 8);
        expect([2, 4]).toContain(steps);
        expect(h.step + steps).toBeLessThanOrEqual(6);
        const clash = notes.filter(
          (n) =>
            n !== h &&
            n.bar === h.bar &&
            n.lane === h.lane &&
            n.step > h.step &&
            n.step <= h.step + steps + 1,
        );
        expect(clash).toEqual([]);
      }
    }
  });
});

describe('segurar na simulação', () => {
  /** A primeira nota longa da música e a hora de apertar e de soltar. */
  const firstHold = (song: Song) => {
    const h = allNotes(song, 200).find((n) => n.endT !== undefined)!;
    return h;
  };

  it('segurar até o fim vale pontos e conta como completa', () => {
    const song = SONGS.frenesi;
    const h = firstHold(song);
    const sim = new BatidaSim(SEED, song);
    // Acerta tudo até a nota longa, aperta nela e segura até depois do fim.
    const before = allNotes(song, h.bar).filter((n) => n.t < h.t);
    for (const n of before) {
      sim.tap(n.lane, Math.round(n.t));
      sim.release(n.lane, Math.round(n.t) + 30);
    }
    const base = sim.currentTenths;
    sim.tap(h.lane, Math.round(h.t));
    const afterHit = sim.currentTenths;
    const events = sim.release(h.lane, Math.round(h.endT!) + 20);
    expect(events.some((e) => e.kind === 'holdDone')).toBe(true);
    expect(sim.run.holds).toBe(1);
    expect(sim.run.holdsBroken).toBe(0);
    expect(sim.currentTenths).toBeGreaterThan(afterHit);
    expect(afterHit).toBeGreaterThan(base);
    expect(sim.holdingNote(h.lane)).toBeUndefined();
  });

  it('soltar cedo quebra: zera o combo, gasta energia e não dá os pontos da nota longa', () => {
    const song = SONGS.frenesi;
    const h = firstHold(song);
    const sim = new BatidaSim(SEED, song);
    for (const n of allNotes(song, h.bar).filter((x) => x.t < h.t)) {
      sim.tap(n.lane, Math.round(n.t));
      sim.release(n.lane, Math.round(n.t) + 30);
    }
    sim.tap(h.lane, Math.round(h.t));
    expect(sim.holdingNote(h.lane)).toBe(h);
    const energy = sim.currentEnergy;
    const combo = sim.currentCombo;
    expect(combo).toBeGreaterThan(0);
    const events = sim.release(h.lane, Math.round(h.t) + 40);
    expect(events.some((e) => e.kind === 'holdBroken')).toBe(true);
    expect(sim.currentCombo).toBe(0);
    expect(sim.currentEnergy).toBeLessThan(energy);
    expect(sim.run.holdsBroken).toBe(1);
    expect(sim.run.holds).toBe(0);
  });

  it('segurar e nem soltar: a nota longa se completa sozinha quando o tempo chega ao fim', () => {
    const song = SONGS.frenesi;
    const h = firstHold(song);
    const sim = new BatidaSim(SEED, song);
    for (const n of allNotes(song, h.bar).filter((x) => x.t < h.t)) {
      sim.tap(n.lane, Math.round(n.t));
      sim.release(n.lane, Math.round(n.t) + 30);
    }
    sim.tap(h.lane, Math.round(h.t));
    const events = sim.advance(h.endT! - HOLD_END_SLACK_MS + 1);
    expect(events.some((e) => e.kind === 'holdDone')).toBe(true);
  });

  it('uma partida só de acertos perfeitos (apertando e soltando certo) não perde nenhuma nota longa', () => {
    for (const s of ALL) {
      const run = evaluateBatida(SEED, s, perfectTaps(SEED, s, 120));
      expect(run.holds).toBeGreaterThan(0);
      expect(run.holdsBroken).toBe(0);
      expect(run.stray).toBe(0);
    }
  });

  it('soltar cedo em todas as notas longas aparece no resultado', () => {
    const song = SONGS.frenesi;
    const taps = perfectTaps(SEED, song, 60).map((t) => {
      const note = allNotes(song, 60).find((n) => Math.round(n.t) === t.t && n.lane === t.lane);
      return note?.endT ? { ...t, up: t.t + 40 } : t;
    });
    const run = evaluateBatida(SEED, song, taps);
    expect(run.holdsBroken).toBeGreaterThan(0);
    expect(run.holds).toBe(0);
  });

  it('o acorde vale por nota: acertar as três juntas soma o combo de três', () => {
    const song = SONGS.frenesi;
    const note = allNotes(song, 80).find((n) =>
      groups(allNotes(song, 80).filter((x) => x.bar === n.bar && x.step === n.step)).includes(3),
    )!;
    const chord = allNotes(song, 80).filter((n) => n.bar === note.bar && n.step === note.step);
    expect(chord).toHaveLength(3);
    const sim = new BatidaSim(SEED, song);
    // Antes do acorde, acerta o caminho até lá, apertando e soltando em ordem de tempo.
    const moments = allNotes(song, note.bar + 1)
      .filter((x) => x.t < note.t)
      .flatMap((n) => [
        { down: true, n, at: Math.round(n.t) },
        { down: false, n, at: n.endT ? Math.round(n.endT) + 10 : Math.round(n.t) + 30 },
      ])
      .filter((m) => m.at < note.t || m.down)
      .sort((a, b) => a.at - b.at || Number(a.down) - Number(b.down));
    for (const m of moments) {
      if (m.down) sim.tap(m.n.lane, m.at);
      else sim.release(m.n.lane, m.at);
    }
    const combo = sim.currentCombo;
    for (const n of chord) sim.tap(n.lane, Math.round(n.t));
    expect(sim.currentCombo).toBe(combo + 3);
  });
});
