import { describe, expect, it } from 'vitest';
import {
  BATIDA_LANES,
  BATIDA_MAX_TENTHS,
  BatidaSim,
  ENERGY_START,
  GOOD_MS,
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
      out.push({ lane: n.lane, t: Math.round(n.t) + offset });
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

  it('ficam mais exigentes uma depois da outra e nenhuma passa de um ritmo tocável', () => {
    const [a, b, c] = ALL as [Song, Song, Song];
    expect(a.startBpm).toBeLessThan(b.startBpm);
    expect(b.startBpm).toBeLessThan(c.startBpm);
    expect(a.maxBpm).toBeLessThan(b.maxBpm);
    expect(b.maxBpm).toBeLessThan(c.maxBpm);
    expect(a.levelStart).toBeLessThan(c.levelStart);
    for (const s of ALL) expect(s.maxBpm).toBeLessThanOrEqual(140);
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
  it('começa no início da música, sobe a cada compasso e para no máximo dela', () => {
    for (const s of ALL) {
      expect(bpmAt(s, 0)).toBe(s.startBpm);
      expect(bpmAt(s, 10)).toBeGreaterThan(bpmAt(s, 1));
      expect(bpmAt(s, 1000)).toBe(s.maxBpm);
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
    expect(levelAt(SONGS.passo, 1000)).toBe(2);
    expect(levelAt(SONGS.frenesi, 1)).toBe(2);
  });

  it('no Primeiro Passo o início usa só as pistas do meio e depois abre', () => {
    const p = SONGS.passo;
    const early = new Set(notesBetween(SEED, p, 0, barStart(p, 12)).map((n) => n.lane));
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
      const steps = (notes: BatidaNote[]) => notes.map((n) => n.step).join(',');
      expect(steps(b1!)).toBe(steps(b2!));
      expect(steps(b4!)).toBe(steps(b1!));
    }
  });

  it('cada frase termina na pista de repouso, a do meio', () => {
    for (const s of ALL) {
      for (let phrase = 0; phrase < 12; phrase++) {
        const bars = phraseNotes(SEED, s, phrase);
        expect(bars[bars.length - 1]!.at(-1)!.lane).toBe(2);
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
    const run = evaluateBatida(SEED, SONG, [{ lane: 0, t: 100 }, ...perfectTaps(SEED, SONG, 20)]);
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
      { lane: note.lane, t },
      { lane: note.lane, t: t + 60 },
    ]);
    expect(run.perfect).toBe(1);
    expect(run.stray).toBe(1);
  });

  it('conta os toques até o fim; toque depois da energia zerada não conta', () => {
    const taps = perfectTaps(SEED, SONG, 6);
    expect(evaluateBatida(SEED, SONG, taps).usedTaps).toBe(taps.length);
    const dead = evaluateBatida(SEED, SONG, []);
    const late = evaluateBatida(SEED, SONG, [{ lane: 0, t: Math.round(dead.endedAtMs) + 5000 }]);
    expect(late.usedTaps).toBe(0);
  });
});

describe('validateTaps', () => {
  it('aceita toques em ordem', () => {
    expect(
      validateTaps([
        { lane: 0, t: 1000 },
        { lane: 4, t: 1010 },
      ]),
    ).toBeNull();
    expect(validateTaps([])).toBeNull();
  });

  it('recusa pista inválida, instante quebrado e fora de ordem', () => {
    expect(validateTaps([{ lane: 5, t: 10 }])).toMatch(/Pista/);
    expect(validateTaps([{ lane: 0, t: 1.5 }])).toMatch(/Instante/);
    expect(validateTaps([{ lane: 0, t: -1 }])).toMatch(/Instante/);
    expect(
      validateTaps([
        { lane: 0, t: 500 },
        { lane: 1, t: 400 },
      ]),
    ).toMatch(/ordem/);
  });

  it('recusa rajada impossível na mesma pista, mas aceita pistas diferentes juntas', () => {
    expect(
      validateTaps([
        { lane: 2, t: 1000 },
        { lane: 2, t: 1010 },
      ]),
    ).toMatch(/rápidos/);
    expect(
      validateTaps([
        { lane: 2, t: 1000 },
        { lane: 3, t: 1010 },
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
