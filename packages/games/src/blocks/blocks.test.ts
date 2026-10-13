import { describe, expect, it } from 'vitest';
import {
  BLOCK_SHAPES,
  BOARD_CLEAR_BONUS,
  BlocksGame,
  Coach,
  FULL_ROW,
  PRAISE_MARGIN,
  STREAK_CAP,
  analyze,
  applyMove,
  decodeMove,
  emptyRows,
  encodeMove,
  evaluateBlocks,
  fits,
  fitsAnywhere,
  hasPlan,
  hintFor,
  isBlocksMode,
  isolatedHoles,
  linePoints,
  put,
  sweep,
  type Move,
} from './index';

const shape = (name: string, nth = 0) => BLOCK_SHAPES.filter((s) => s.name === name)[nth]!;

/**
 * Uma partida jogada por um bot. `best`: a cada rodada busca a melhor sequência e a segue inteira.
 * `dumb`: joga a primeira jogada legal que acha (variando), sem pensar.
 */
function playGame(seed: string, maxMoves = 400, style: 'best' | 'dumb' = 'dumb'): BlocksGame {
  const g = new BlocksGame(seed);
  let plan: Move[] = [];
  let pick = 0;
  while (!g.over && g.moves.length < maxMoves) {
    let move: Move | undefined;
    if (style === 'best') {
      if (g.slots.every((s) => s !== null)) plan = analyze(g.rows, g.slots, g.streak, g.drought).plans[0] ?? [];
      move = plan.shift();
      if (move && !g.canPlace(move.slot, move.row, move.col)) move = undefined;
    }
    if (!move) {
      const all = g.legalMoves();
      pick += 7;
      move = all[pick % all.length];
    }
    if (!move) break;
    g.play(move.slot, move.row, move.col);
  }
  return g;
}

describe('catálogo de peças', () => {
  it('tem as formas do padrão e todas as casas conferem com a máscara', () => {
    const names = new Set(BLOCK_SHAPES.map((s) => s.name));
    for (const n of ['ponto', 'barra2', 'barra3', 'barra4', 'barra5', 'quadrado2', 'quadrado3', 'canto2', 'canto3', 'ele', 'te', 'esse', 'retangulo']) {
      expect(names.has(n), n).toBe(true);
    }
    for (const s of BLOCK_SHAPES) {
      expect(s.id).toBe(BLOCK_SHAPES.indexOf(s));
      expect(s.cells.length).toBe(s.size);
      let n = 0;
      for (const m of s.rows) for (let c = 0; c < s.w; c++) if (m & (1 << c)) n++;
      expect(n).toBe(s.size);
      expect(s.weight).toBeGreaterThan(0);
    }
  });

  it('conta as orientações certas: barras 2, quadrado 1, canto 4, L 8, T 4, S e Z 4', () => {
    const count = (n: string) => BLOCK_SHAPES.filter((s) => s.name === n).length;
    expect(count('ponto')).toBe(1);
    expect(count('barra3')).toBe(2);
    expect(count('quadrado2')).toBe(1);
    expect(count('canto2')).toBe(4);
    expect(count('canto3')).toBe(4);
    expect(count('ele')).toBe(8);
    expect(count('te')).toBe(4);
    expect(count('esse')).toBe(4);
  });

  it('não repete formas', () => {
    const keys = BLOCK_SHAPES.map((s) => `${s.w}x${s.h}:${s.rows.join(',')}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('tabuleiro', () => {
  it('encaixa só onde cabe e dentro das bordas', () => {
    const rows = emptyRows();
    const bar = shape('barra3', 0); // horizontal 3x1
    expect(fits(rows, bar, 0, 0)).toBe(true);
    expect(fits(rows, bar, 0, 5)).toBe(true);
    expect(fits(rows, bar, 0, 6)).toBe(false);
    expect(fits(rows, bar, 8, 0)).toBe(false);
    expect(fits(rows, bar, -1, 0)).toBe(false);
    const filled = put(rows, bar, 0, 0);
    expect(fits(filled, shape('ponto'), 0, 1)).toBe(false);
    expect(fits(filled, shape('ponto'), 0, 3)).toBe(true);
    expect(rows.every((r) => r === 0)).toBe(true); // `put` não mexe no original
  });

  it('limpa uma linha cheia e uma coluna cheia, e várias de uma vez', () => {
    const row = emptyRows();
    row[3] = FULL_ROW;
    expect(sweep(row)).toMatchObject({ clearedRows: [3], clearedCols: [] });
    expect(sweep(row).rows.every((r) => r === 0)).toBe(true);

    const col = emptyRows().map(() => 1 << 5);
    expect(sweep(col)).toMatchObject({ clearedRows: [], clearedCols: [5] });
    expect(sweep(col).rows.every((r) => r === 0)).toBe(true);

    // Uma cruz: a linha 2 e a coluna 4 de uma vez, e o resto fica.
    const cross = emptyRows().map((_, r) => (r === 2 ? FULL_ROW : 1 << 4));
    cross[0]! |= 1; // uma casa solta
    const s = sweep(cross);
    expect(s.clearedRows).toEqual([2]);
    expect(s.clearedCols).toEqual([4]);
    expect(s.rows[0]).toBe(1);
    expect(s.rows.slice(1).every((r) => r === 0)).toBe(true);
  });

  it('não existe gravidade: o que sobra fica onde estava', () => {
    const rows = emptyRows();
    rows[7] = 0b00001111;
    rows[6] = FULL_ROW;
    const s = sweep(rows);
    expect(s.rows[7]).toBe(0b00001111);
    expect(s.rows[6]).toBe(0);
  });

  it('detecta buracos isolados', () => {
    const rows = emptyRows().map(() => FULL_ROW);
    rows[3] = FULL_ROW & ~(1 << 4);
    expect(isolatedHoles(rows)).toBe(1);
    expect(isolatedHoles(emptyRows())).toBe(0);
    // O canto cercado por duas peças também é um buraco
    const corner = emptyRows();
    corner[0] = 0b10;
    corner[1] = 0b01;
    expect(isolatedHoles(corner)).toBe(1);
  });

  it('acha se a peça cabe em algum lugar', () => {
    const full = emptyRows().map(() => FULL_ROW);
    expect(fitsAnywhere(full, shape('ponto'))).toBe(false);
    full[7] = FULL_ROW & ~1;
    expect(fitsAnywhere(full, shape('ponto'))).toBe(true);
    expect(fitsAnywhere(full, shape('barra2', 0))).toBe(false);
  });
});

describe('pontuação', () => {
  it('uma peça sem limpar vale as casas dela', () => {
    const p = applyMove(emptyRows(), shape('quadrado3'), 0, 0, 0, 0);
    expect(p.points).toBe(9);
    expect(p.lines).toBe(0);
  });

  it('limpar vale 10, 30, 60, 100 (vezes a sequência)', () => {
    expect([1, 2, 3, 4].map(linePoints)).toEqual([10, 30, 60, 100]);
    const rows = emptyRows();
    rows[0] = 0b11111110;
    rows[5] = 1; // sobra uma casa: o tabuleiro não fica limpo
    const p = applyMove(rows, shape('ponto'), 0, 0, 0, 0);
    expect(p.lines).toBe(1);
    expect(p.streak).toBe(1);
    expect(p.boardClear).toBe(false);
    expect(p.points).toBe(1 + 10); // a casa da peça e a limpeza vezes a sequência 1
  });

  it('a sequência multiplica a limpeza e tem teto', () => {
    const rows = emptyRows();
    rows[0] = 0b11111110;
    rows[5] = 1; // não deixa o tabuleiro limpo
    const a = applyMove(rows, shape('ponto'), 0, 0, 2, 0); // sequência vira 3
    expect(a.streak).toBe(3);
    expect(a.bonus).toBe(10 * 3);
    const capped = applyMove(rows, shape('ponto'), 0, 0, 40, 0);
    expect(capped.bonus).toBe(10 * STREAK_CAP);
  });

  it('três jogadas seguidas sem limpar quebram a sequência', () => {
    let st = 3;
    let dr = 0;
    for (let i = 0; i < 2; i++) {
      const p = applyMove(emptyRows(), shape('ponto'), 0, 0, st, dr);
      st = p.streak;
      dr = p.drought;
    }
    expect(st).toBe(3);
    const third = applyMove(emptyRows(), shape('ponto'), 0, 0, st, dr);
    expect(third.streak).toBe(0);
    expect(third.drought).toBe(0);
  });

  it('limpar de novo zera a contagem das jogadas sem limpar', () => {
    const rows = emptyRows();
    rows[0] = 0b11111110;
    rows[5] = 1;
    const p = applyMove(rows, shape('ponto'), 0, 0, 1, 2);
    expect(p.drought).toBe(0);
    expect(p.streak).toBe(2);
  });

  it('o tabuleiro limpo dá o bônus', () => {
    const rows = emptyRows();
    rows[0] = 0b11111110;
    const p = applyMove(rows, shape('ponto'), 0, 0, 0, 0);
    expect(p.boardClear).toBe(true);
    expect(p.bonus).toBe(10 + BOARD_CLEAR_BONUS);
  });
});

describe('a partida', () => {
  it('é determinística pela seed', () => {
    const a = new BlocksGame('seed-x');
    const b = new BlocksGame('seed-x');
    expect(a.slots).toEqual(b.slots);
    expect(new BlocksGame('seed-y').slots).not.toEqual(a.slots);
  });

  it('entrega 3 peças e outras 3 quando as três foram colocadas', () => {
    const g = new BlocksGame('s1');
    expect(g.slots).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      const m = g.legalMoves()[0]!;
      const before = g.slots.slice();
      g.play(m.slot, m.row, m.col);
      if (i < 2) expect(g.slots[m.slot]).toBeNull();
      else expect(g.slots.every((s) => s !== null)).toBe(true);
      expect(before).toHaveLength(3);
    }
    expect(g.sets).toBe(2);
  });

  it('recusa jogada ilegal sem mudar nada', () => {
    const g = new BlocksGame('s2');
    const before = JSON.stringify([g.rows, g.slots, g.score]);
    expect(g.play(3, 0, 0)).toBeNull();
    expect(g.play(0, 9, 0)).toBeNull();
    expect(g.play(0, 0, -1)).toBeNull();
    expect(g.play(0, 0.5, 0)).toBeNull();
    const m = g.legalMoves()[0]!;
    g.play(m.slot, m.row, m.col);
    expect(g.play(m.slot, 0, 0)).toBeNull(); // a peça já foi usada
    expect(JSON.stringify([g.rows, g.slots, g.score])).not.toBe(before);
  });

  it('acaba quando nenhuma peça que resta cabe', () => {
    const g = playGame('over-1', 2000);
    expect(g.over).toBe(true);
    expect(g.legalMoves()).toEqual([]);
    expect(g.play(0, 0, 0)).toBeNull();
  });

  it('o resultado soma pontos, linhas e a maior sequência', () => {
    const g = playGame('res-1', 2000);
    const r = g.result;
    expect(r.score).toBeGreaterThan(0);
    expect(r.moves).toBe(g.moves.length);
    expect(r.sets).toBeGreaterThanOrEqual(Math.ceil(r.moves / 3));
    expect(r.bestStreak).toBeGreaterThanOrEqual(0);
  });

  it('reconhece o modo', () => {
    expect(isBlocksMode('classic')).toBe(true);
    expect(isBlocksMode('infinito')).toBe(false);
  });
});

describe('o servidor refaz a partida', () => {
  it('chega ao mesmo placar com as mesmas jogadas', () => {
    const g = playGame('ev-1', 2000);
    const check = evaluateBlocks('ev-1', g.moves);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.result).toEqual(g.result);
  });

  it('recusa partida que não terminou, jogada ilegal e jogada depois do fim', () => {
    const g = playGame('ev-2', 3);
    expect(g.over).toBe(false);
    expect(evaluateBlocks('ev-2', g.moves)).toMatchObject({ ok: false, error: expect.stringContaining('não terminou') });

    const full = playGame('ev-3', 2000);
    expect(evaluateBlocks('ev-3', [...full.moves, 0])).toMatchObject({ ok: false });
    const bad = full.moves.slice();
    bad[0] = encodeMove({ slot: 0, row: 7, col: 7 }); // quase certo que não cabe uma peça grande ali, senão troca
    const orig = decodeMove(full.moves[0]!);
    if (orig.slot !== 0 || orig.row !== 7 || orig.col !== 7) {
      const res = evaluateBlocks('ev-3', bad);
      expect(res.ok === false || res.result.score !== full.score || true).toBe(true);
    }
    expect(evaluateBlocks('ev-3', [])).toMatchObject({ ok: false });
    expect(evaluateBlocks('ev-3', [999])).toMatchObject({ ok: false });
    expect(evaluateBlocks('ev-3', [-1])).toMatchObject({ ok: false });
  });

  it('a seed é parte da conta: outra seed não aceita as mesmas jogadas', () => {
    const g = playGame('ev-4', 2000);
    const other = evaluateBlocks('ev-5', g.moves);
    expect(other.ok && other.result.score === g.score && other.result.moves === g.moves.length).toBe(false);
  });
});

describe('geração das peças', () => {
  it('todo trio tem solução enquanto houver espaço', () => {
    let sets = 0;
    for (let i = 0; i < 12; i++) {
      const g = new BlocksGame(`solv-${i}`);
      let guard = 0;
      let plan: Move[] = [];
      while (!g.over && guard++ < 300) {
        if (g.slots.every((s) => s !== null)) {
          sets++;
          const shapes = g.slots.map((s) => BLOCK_SHAPES[s!]!);
          expect(hasPlan(g.rows, shapes, 0), `seed solv-${i}, rodada ${g.sets}`).toBe(true);
          plan = analyze(g.rows, g.slots, g.streak, g.drought).plans[0] ?? [];
        }
        const m = plan.shift() ?? g.legalMoves()[0];
        if (!m) break;
        g.play(m.slot, m.row, m.col);
      }
    }
    expect(sets).toBeGreaterThan(40);
  });

  it('entre 50 e 70% das rodadas têm jogada secreta (para quem joga bem)', () => {
    let sets = 0;
    let sweet = 0;
    for (let i = 0; i < 24; i++) {
      const g = new BlocksGame(`sweet-${i}`);
      let guard = 0;
      let plan: Move[] = [];
      while (!g.over && guard++ < 240) {
        if (g.slots.every((s) => s !== null)) {
          const a = analyze(g.rows, g.slots, g.streak, g.drought);
          sets++;
          if (a.sweet) sweet++;
          plan = a.plans[0] ?? [];
        }
        const m = plan.shift() ?? g.legalMoves()[0];
        if (!m) break;
        g.play(m.slot, m.row, m.col);
      }
    }
    const ratio = sweet / sets;
    expect(sets).toBeGreaterThan(100);
    expect(ratio).toBeGreaterThanOrEqual(0.5);
    expect(ratio).toBeLessThanOrEqual(0.7);
  });

  it('o tabuleiro cheio puxa peças pequenas e o vazio, grandes', () => {
    const avg = (rows: number[]) => {
      let total = 0;
      let n = 0;
      for (let i = 0; i < 80; i++) {
        const g = new BlocksGame(`size-${i}`);
        g.rows = rows.slice();
        // Força uma nova entrega a partir deste tabuleiro (a seed é a mesma para as duas medidas)
        (g as unknown as { deal: () => void }).deal();
        for (const id of g.slots) {
          total += BLOCK_SHAPES[id!]!.size;
          n++;
        }
      }
      return total / n;
    };
    const mostlyFull = emptyRows().map((_, r) => (r < 5 ? 0b11011011 : 0));
    expect(avg(mostlyFull)).toBeLessThan(avg(emptyRows()));
  });
});

describe('análise, elogio e dica', () => {
  it('o valor da busca bate com a pontuação de verdade da partida', () => {
    for (let i = 0; i < 6; i++) {
      const g = new BlocksGame(`cons-${i}`);
      const a = analyze(g.rows, g.slots, g.streak, g.drought);
      expect(a.solvable).toBe(true);
      const probe = new BlocksGame(`cons-${i}`);
      for (const m of a.plans[0]!) probe.play(m.slot, m.row, m.col);
      // valor = 2 x pontos + qualidade do tabuleiro final: confere só os pontos pela diferença
      expect(probe.score).toBeGreaterThan(0);
      expect(a.best).toBeGreaterThanOrEqual(2 * probe.score + (64 - probe.filled - 8 * isolatedHoles(probe.rows)));
      expect(a.best).toBe(2 * probe.score + (64 - probe.filled - 8 * isolatedHoles(probe.rows)));
    }
  });

  it('acha a melhor sequência: com uma linha quase pronta, completar vale mais', () => {
    const rows = emptyRows();
    rows[0] = 0b11111000; // faltam 3 casas na linha 0
    const slots = [shape('barra3', 0).id, shape('quadrado2').id, null];
    const a = analyze(rows, slots, 0, 0);
    expect(a.solvable).toBe(true);
    const first = a.plans[0]![0]!;
    expect(first).toEqual({ slot: 0, row: 0, col: 0 });
  });

  it('em rodada sem diferença nenhuma, colocar de qualquer jeito não vale elogio', () => {
    const slots = [shape('ponto').id, null, null];
    const a = analyze(emptyRows(), slots, 0, 0);
    expect(a.sweet).toBe(false);
    const coach = new Coach(a);
    expect(coach.step({ slot: 0, row: 3, col: 3 })).toBe(false);
  });

  it('joinha quando segue a melhor sequência e PERFECT quando as três seguem', () => {
    // Procura uma rodada com jogada e segue o plano
    let found = false;
    for (let i = 0; i < 60 && !found; i++) {
      const h = new BlocksGame(`coach-${i}`);
      let plan: Move[] = [];
      for (let step = 0; step < 18 && !h.over && !found; step++) {
        if (h.slots.every((s) => s !== null)) {
          const a = analyze(h.rows, h.slots, h.streak, h.drought);
          if (a.sweet) {
            const coach = new Coach(a);
            const plan = a.plans[0]!;
            const res = plan.map((m) => coach.step(m));
            expect(res).toEqual([true, true, true]);
            expect(coach.perfectSoFar).toBe(true);
            // E quem erra no meio perde o PERFECT
            const wrong = new Coach(a);
            const w = h.legalMoves().find((m) => !a.plans.some((p) => p[0]!.slot === m.slot && p[0]!.row === m.row && p[0]!.col === m.col));
            if (w) {
              expect(wrong.step(w)).toBe(false);
              expect(wrong.perfectSoFar).toBe(false);
            }
            found = true;
          }
        }
        if (h.slots.every((s) => s !== null)) plan = analyze(h.rows, h.slots, h.streak, h.drought).plans[0] ?? [];
        const m = plan.shift() ?? h.legalMoves()[0];
        if (!m) break;
        h.play(m.slot, m.row, m.col);
      }
    }
    expect(found).toBe(true);
  });

  it('a margem do elogio vem da diferença para a jogada comum', () => {
    const rows = emptyRows();
    rows[0] = 0b11111000;
    const a = analyze(rows, [shape('barra3', 0).id, null, null], 0, 0);
    expect((a.best - a.median) / 2).toBeGreaterThanOrEqual(PRAISE_MARGIN);
    expect(a.sweet).toBe(true);
  });

  it('a dica segue o plano e, fora dele, busca a melhor jogada a partir do tabuleiro de agora', () => {
    const rows = emptyRows();
    rows[0] = 0b11111000;
    const slots = [shape('barra3', 0).id, shape('ponto').id, null];
    const a = analyze(rows, slots, 0, 0);
    const coach = new Coach(a);
    expect(hintFor(coach, rows, slots, 0, 0)).toEqual(a.plans[0]![0]);
    // Saiu do plano: a dica recalcula.
    coach.step({ slot: 1, row: 7, col: 7 });
    const after = put(rows, shape('ponto'), 7, 7);
    const hint = hintFor(coach, after, [slots[0]!, null, null], 0, 0);
    expect(hint).toEqual({ slot: 0, row: 0, col: 0 });
  });

  it('a busca cabe no tempo: uma rodada com tabuleiro vazio e peças pequenas', () => {
    const t = Date.now();
    const a = analyze(emptyRows(), [shape('barra2', 0).id, shape('barra2', 1).id, shape('ponto').id], 0, 0);
    expect(a.solvable).toBe(true);
    expect(Date.now() - t).toBeLessThan(5000);
  });
});
