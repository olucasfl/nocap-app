import { describe, expect, it } from 'vitest';
import {
  BIG_WEIGHT,
  ENABLED_MICRO,
  MICRO_MAX,
  PARTY_MICRO_PER_ROUND,
  POINTS_BAD,
  POINTS_GOOD,
  POINTS_NEUTRAL,
  SHAPES_H,
  SHAPES_R,
  SHAPES_W,
  SHAPE_COLORS,
  SHAPE_KINDS,
  ShapesSim,
  VARIANTS,
  colorScoreTarget,
  SHAPES_DURATION_MS,
  TYPING_PICK_MS,
  WORDS,
  X1_MAX_ROUNDS,
  bigInfo,
  buildPlan,
  classify,
  colorPoints,
  colorShowMs,
  commandText,
  ecoChallenge,
  ecoPoints,
  microTiming,
  noteToPoints,
  shapeClickPoints,
  shapesRound,
  timeChallenge,
  timePoints,
  typingChallenge,
  typingPoints,
  x1Lead,
  x1Outcome,
  x1Pairs,
  x1Points,
  x1Shot,
  type BigSlot,
  type MicroSlot,
} from './index';

const micro = (plan: ReturnType<typeof buildPlan>) =>
  plan.filter((p): p is MicroSlot => p.kind === 'micro');

describe('buildPlan', () => {
  it('cada rodada tem 5 micro-desafios e 1 minijogo grande, em ordem', () => {
    const plan = buildPlan('s', 2);
    expect(plan).toHaveLength(2 * (PARTY_MICRO_PER_ROUND + 1));
    expect(plan.slice(0, 6).map((p) => p.kind)).toEqual([
      'micro',
      'micro',
      'micro',
      'micro',
      'micro',
      'big',
    ]);
    expect(plan.filter((p) => p.round === 2)).toHaveLength(6);
  });

  it('é determinística pela seed', () => {
    expect(buildPlan('abc', 3)).toEqual(buildPlan('abc', 3));
    expect(buildPlan('abc', 3)).not.toEqual(buildPlan('xyz', 3));
  });

  it('todos os jogos aparecem em cada rodada e nunca o mesmo duas vezes seguidas', () => {
    for (let i = 0; i < 60; i++) {
      const plan = buildPlan(`seed-${i}`, 3);
      for (let round = 1; round <= 3; round++) {
        const games = micro(plan.filter((p) => p.round === round)).map((m) => m.game);
        for (const g of ENABLED_MICRO) expect(games).toContain(g);
      }
      const all = micro(plan).map((m) => m.game);
      all.forEach((g, k) => {
        if (k > 0) expect(g).not.toBe(all[k - 1]);
      });
    }
  });

  it('o minijogo grande é sorteado: nunca o mesmo duas vezes seguidas e a ordem muda entre partidas', () => {
    const firsts = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const bigs = buildPlan(`g${i}`, 5).filter((p): p is BigSlot => p.kind === 'big');
      bigs.forEach((b, k) => {
        if (k > 0) expect(b.game).not.toBe(bigs[k - 1]!.game);
      });
      firsts.add(bigs[0]!.game);
    }
    // O primeiro grande nem sempre é o mesmo (as formas não vêm sempre primeiro).
    expect(firsts.size).toBe(2);
  });

  it('as pegadinhas e regras negativas aparecem em quase metade dos micro-desafios', () => {
    const list = micro(buildPlan('grande', 4000));
    const special = list.filter((p) => p.variant !== 'standard').length;
    const share = special / list.length;
    expect(share).toBeGreaterThan(0.35);
    expect(share).toBeLessThan(0.62);
  });

  it('todo comando tem texto e todo desafio tem tempos positivos', () => {
    for (const slot of buildPlan('texto', 5)) {
      expect(commandText(slot).length).toBeGreaterThan(5);
      if (slot.kind === 'micro') {
        const t = microTiming(slot);
        expect(t.showMs).toBeGreaterThan(0);
        expect(t.pickMs).toBeGreaterThan(1000);
      }
    }
  });
});

describe('Mesmíssima', () => {
  it('nota 10 vale 1000; 5 ou menos vale 0; linear no meio', () => {
    expect(noteToPoints(10)).toBe(MICRO_MAX);
    expect(noteToPoints(7.5)).toBe(500);
    expect(noteToPoints(5)).toBe(0);
  });

  it('Invertido: longe vale muito; perto demais tira pontos e pode ficar negativo', () => {
    expect(colorPoints('inverted', 0)).toBe(1000);
    expect(colorPoints('inverted', 6)).toBe(0);
    expect(colorPoints('inverted', 10)).toBe(-500);
  });

  it('o às cegas mostra o alvo por 1,5 s; os outros por 3 s', () => {
    expect(colorShowMs('blind')).toBe(1500);
    expect(colorShowMs('standard')).toBe(3000);
  });
});

describe('Já Deu?', () => {
  const ref = (variant: string) => ({ seed: 'tempo-1', variant });

  it('parar no tempo exato vale 1000; muito fora vale pouco; resposta absurda vale 0', () => {
    const c = timeChallenge(ref('standard'));
    expect(timePoints(ref('standard'), c.expectedMs)).toBe(1000);
    expect(timePoints(ref('standard'), Math.round(c.expectedMs * 1.6))).toBeLessThan(500);
    expect(timePoints(ref('standard'), 50)).toBe(0);
    expect(timePoints(ref('standard'), c.expectedMs * 4)).toBe(0);
  });

  it('Tempo Falso: o tempo real esperado é o alvo dividido pela velocidade do relógio', () => {
    const c = timeChallenge(ref('falso'));
    expect(c.factor).not.toBe(1);
    expect(c.expectedMs).toBe(Math.round(c.targetMs / c.factor));
    expect(c.showClock).toBe(true);
    expect(timePoints(ref('falso'), c.expectedMs)).toBe(1000);
  });

  it('só o Padrão esconde o relógio; o Cego mostra 1 segundo', () => {
    expect(timeChallenge(ref('standard')).showClock).toBe(false);
    expect(timeChallenge(ref('cego')).hideAfterMs).toBe(1000);
  });
});

describe('Ecooo', () => {
  const ref = (variant: string) => ({ seed: 'eco-1', variant });

  it('sequência de 8 a 12 passos; proporcional aos acertos', () => {
    const c = ecoChallenge(ref('standard'));
    expect(c.sequence.length).toBeGreaterThanOrEqual(8);
    expect(c.sequence.length).toBeLessThanOrEqual(12);
    expect(ecoPoints(ref('standard'), c.expected)).toBe(1000);
    const half = c.expected.map((p, i) => (i < c.expected.length / 2 ? p : (p + 1) % 4));
    expect(ecoPoints(ref('standard'), half)).toBeLessThan(700);
    expect(ecoPoints(ref('standard'), [])).toBe(0);
  });

  it('Só Ímpares e Trocado: o esperado muda, e tocar ao contrário não pontua', () => {
    const odd = ecoChallenge(ref('oddonly'));
    expect(odd.expected).toEqual(odd.sequence.filter((_, i) => i % 2 === 0));
    expect(ecoPoints(ref('oddonly'), odd.sequence)).toBeLessThan(1000);
    const swap = ecoChallenge(ref('swap'));
    expect(swap.expected).toEqual(swap.sequence.map((p) => [1, 0, 3, 2][p]));
    expect(ecoPoints(ref('swap'), swap.expected)).toBe(1000);
    expect(ecoPoints(ref('swap'), swap.sequence)).toBe(0);
  });

  it('Reverso: o esperado é a sequência de trás para frente', () => {
    const c = ecoChallenge(ref('reverse'));
    expect(c.expected).toEqual([...c.sequence].reverse());
  });

  it('Botão Proibido: a sequência mostra o botão, mas o esperado o ignora e tocá-lo zera', () => {
    const c = ecoChallenge(ref('forbidden'));
    expect(c.sequence).toContain(c.forbidden);
    expect(c.expected).not.toContain(c.forbidden);
    expect(ecoPoints(ref('forbidden'), c.expected)).toBe(1000);
    expect(ecoPoints(ref('forbidden'), [c.forbidden!, ...c.expected])).toBe(-300);
  });
});

describe('Digitação Ligeira', () => {
  const ref = (variant: string, seed = 'dig-1') => ({ seed, variant });

  it('palavra exata vale 400 a 1000 conforme a rapidez; errada vale 0', () => {
    const c = typingChallenge(ref('standard'));
    expect(typingPoints(ref('standard'), c.expected!, false, 0)).toBe(1000);
    expect(typingPoints(ref('standard'), c.expected!.toUpperCase(), false, TYPING_PICK_MS)).toBe(
      400,
    );
    expect(typingPoints(ref('standard'), 'errado', false, 100)).toBe(0);
  });

  it('Mão Boba: digitar, enviar ou só mexer no campo tira 500; ficar quieto vale 1000', () => {
    expect(typingPoints(ref('maohoba'), '', false, 0)).toBe(1000);
    expect(typingPoints(ref('maohoba'), 'oi', false, 0)).toBe(-500);
    expect(typingPoints(ref('maohoba'), '', true, 0)).toBe(-500);
  });

  it('as regras de exceção pedem o texto certo, e nunca ficam vazias', () => {
    for (let i = 0; i < 300; i++) {
      for (const v of ['reverse', 'novowels', 'noaccents', 'noa']) {
        const c = typingChallenge(ref(v, `s${i}`));
        expect(c.expected!.length).toBeGreaterThan(0);
        expect(typingPoints(ref(v, `s${i}`), c.expected!, false, 0)).toBe(1000);
      }
    }
    const noVowels = typingChallenge(ref('novowels', 'x'));
    expect(noVowels.expected).not.toMatch(/[aeiou]/);
    const noA = typingChallenge(ref('noa', 'x'));
    expect(noA.expected).not.toMatch(/a/);
  });

  it('"sem acentos" usa palavra acentuada e recusa o texto com acento', () => {
    const c = typingChallenge(ref('noaccents', 'acc'));
    expect(c.word).not.toBe(c.expected);
    // Digitar com acento quando a regra pedia sem: erra e perde 300.
    expect(typingPoints(ref('noaccents', 'acc'), c.word, false, 0)).toBe(-300);
    expect(typingPoints(ref('noaccents', 'acc'), c.expected!, false, 0)).toBe(1000);
  });

  it('o banco de palavras não tem duplicadas nem palavras muito longas', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
    expect(WORDS.every((w) => w.length >= 3 && w.length <= 11)).toBe(true);
  });
});

describe('Caça-Formas', () => {
  it('é determinístico, tem as regras no comando e uma lista de peças ao longo do tempo', () => {
    const a = shapesRound('forma-1');
    expect(a).toEqual(shapesRound('forma-1'));
    expect(a.items.length).toBeGreaterThanOrEqual(40);
    expect(a.items[a.items.length - 1]!.at).toBeLessThan(SHAPES_DURATION_MS);
    const info = bigInfo({ kind: 'big', game: 'shapes', seed: 'forma-1', round: 1 });
    expect(info.lines.join(' ')).toMatch(/CLIQUE/);
    expect(info.lines.join(' ')).toMatch(/EVITE/);
  });

  it('tem muitas formas e cores, e as peças inofensivas não custam nada', () => {
    expect(SHAPE_KINDS.length).toBeGreaterThanOrEqual(8);
    expect(SHAPE_COLORS.length).toBeGreaterThanOrEqual(6);
    expect(POINTS_NEUTRAL).toBe(0);
    const kinds = new Set<string>();
    for (let i = 0; i < 30; i++) shapesRound(`v${i}`).items.forEach((x) => kinds.add(x.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(7);
  });

  it('as boas, as proibidas e as inofensivas aparecem; quem bate nas duas regras é proibida', () => {
    for (let i = 0; i < 40; i++) {
      const r = shapesRound(`f${i}`);
      const count = (c: string) => r.items.filter((x) => x.cls === c).length;
      expect(count('good')).toBe(33);
      expect(count('bad')).toBe(21);
      for (const it of r.items) expect(classify(r, it.kind, it.color)).toBe(it.cls);
    }
    const r = shapesRound('f1');
    const both = { click: { shape: 'circle' as const }, avoid: { color: 'green' as const } };
    expect(classify({ ...r, ...both }, 'circle', 'green')).toBe('bad');
  });

  it('clique certo, proibido e outra peça valem o combinado; fora da janela não vale', () => {
    const r = shapesRound('f2');
    const good = r.items.find((x) => x.cls === 'good')!;
    const bad = r.items.find((x) => x.cls === 'bad')!;
    const neutral = r.items.find((x) => x.cls === 'neutral')!;
    expect(shapeClickPoints(r, good.id, good.at + 200)).toBe(POINTS_GOOD);
    expect(shapeClickPoints(r, bad.id, bad.at + 200)).toBe(POINTS_BAD);
    expect(shapeClickPoints(r, neutral.id, neutral.at + 200)).toBe(0);
    expect(shapeClickPoints(r, good.id, good.at - 50)).toBeNull();
    expect(shapeClickPoints(r, good.id, good.at + good.life + 5000)).toBeNull();
    expect(shapeClickPoints(r, 9999, 0)).toBeNull();
  });

  it('clicar em tudo não compensa: o saldo de quem clica em todas as peças é negativo', () => {
    for (let i = 0; i < 30; i++) {
      const r = shapesRound(`spam${i}`);
      const total = r.items.reduce(
        (sum, x) => sum + (x.cls === 'good' ? POINTS_GOOD : x.cls === 'bad' ? POINTS_BAD : 0),
        0,
      );
      expect(total).toBeLessThan(0);
    }
  });

  it('acertar todas as boas dá pelo menos o máximo do grande', () => {
    const r = shapesRound('f3');
    const good = r.items.filter((x) => x.cls === 'good').length;
    expect(good * POINTS_GOOD).toBeGreaterThanOrEqual(BIG_WEIGHT * MICRO_MAX * 0.9);
  });
});

describe('Caça-Formas: movimento', () => {
  const sim = (seed: string) => new ShapesSim(shapesRound(seed).items, `sim-${seed}`);

  it('é determinístico: o mesmo instante dá as mesmas posições, em qualquer ritmo de avanço', () => {
    const a = sim('m1');
    const b = sim('m1');
    a.advanceTo(9000);
    for (let t = 0; t <= 9000; t += 250) b.advanceTo(t);
    expect(a.pieces.map((p) => [p.id, Math.round(p.x * 100), Math.round(p.y * 100)])).toEqual(
      b.pieces.map((p) => [p.id, Math.round(p.x * 100), Math.round(p.y * 100)]),
    );
  });

  it('as peças ficam dentro da área, nunca uma por cima da outra, e andam de verdade', () => {
    const s = sim('m2');
    const first = new Map<number, [number, number]>();
    let moved = 0;
    for (let t = 0; t <= SHAPES_DURATION_MS; t += 100) {
      s.advanceTo(t);
      const list = s.pieces;
      for (const p of list) {
        expect(p.x).toBeGreaterThanOrEqual(SHAPES_R - 0.01);
        expect(p.x).toBeLessThanOrEqual(SHAPES_W - SHAPES_R + 0.01);
        expect(p.y).toBeGreaterThanOrEqual(SHAPES_R - 0.01);
        expect(p.y).toBeLessThanOrEqual(SHAPES_H - SHAPES_R + 0.01);
        const f = first.get(p.id);
        if (!f) first.set(p.id, [p.x, p.y]);
        else if (Math.hypot(p.x - f[0], p.y - f[1]) > 5) moved++;
      }
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const d = Math.hypot(list[i]!.x - list[j]!.x, list[i]!.y - list[j]!.y);
          // Folga pequena: o choque é resolvido a cada passo de 16 ms.
          expect(d).toBeGreaterThan(2 * SHAPES_R - 1.5);
        }
      }
    }
    expect(moved).toBeGreaterThan(20);
  });

  it('cada peça existe só durante a sua janela de tempo', () => {
    const r = shapesRound('m3');
    const s = new ShapesSim(r.items, 'sim-m3');
    const item = r.items[10]!;
    s.advanceTo(item.at - 50);
    expect(s.pieces.some((p) => p.id === item.id)).toBe(false);
    s.advanceTo(item.at + 100);
    expect(s.pieces.some((p) => p.id === item.id)).toBe(true);
    s.advanceTo(item.at + item.life + 100);
    expect(s.pieces.some((p) => p.id === item.id)).toBe(false);
  });
});

describe('Arena X1', () => {
  it('placar líquido: ganhar soma 1, perder tira 1; vence quem abre 3', () => {
    let lead = 0;
    for (const won of [true, true, false, true, true]) lead = x1Lead(lead, won);
    expect(lead).toBe(3);
    expect(x1Outcome(3, 5)).toBe('a');
    expect(x1Outcome(-3, 5)).toBe('b');
    expect(x1Outcome(1, 5)).toBeNull();
    expect(x1Outcome(0, X1_MAX_ROUNDS)).toBe('tie');
    expect(x1Lead(2, null)).toBe(2);
  });

  it('pontos: vitória 2000, empate 1000, derrota 0', () => {
    expect([x1Points('win'), x1Points('tie'), x1Points('loss')]).toEqual([2000, 1000, 0]);
  });

  it('pares: número par forma duelos entre pessoas; ímpar deixa um contra o bot', () => {
    const even = x1Pairs('s', ['a', 'b', 'c', 'd']);
    expect(even.every((p) => p.b !== null)).toBe(true);
    const odd = x1Pairs('s', ['a', 'b', 'c']);
    expect(odd).toHaveLength(2);
    expect(odd.filter((p) => p.b === null)).toHaveLength(1);
    expect(new Set(odd.flatMap((p) => [p.a, p.b]).filter(Boolean)).size).toBe(3);
  });

  it('o disparo é determinístico e o bot reage como humano', () => {
    expect(x1Shot('s', 0, 3)).toEqual(x1Shot('s', 0, 3));
    for (let i = 0; i < 100; i++) {
      const s = x1Shot('s', 1, i);
      expect(s.botMs).toBeGreaterThanOrEqual(280);
      expect(s.botMs).toBeLessThanOrEqual(460);
      expect(s.delayMs).toBeGreaterThanOrEqual(1500);
    }
  });
});

describe('Ecooo: tocar ao acaso não pontua', () => {
  const ref = { seed: 'eco-chance', variant: 'standard' };

  it('tocar sempre o mesmo botão, ou errar tudo, vale 0 ou quase nada', () => {
    const c = ecoChallenge(ref);
    expect(
      ecoPoints(
        ref,
        c.expected.map(() => 0),
      ),
    ).toBeLessThan(250);
    expect(
      ecoPoints(
        ref,
        c.expected.map((p) => (p + 1) % 4),
      ),
    ).toBe(0);
  });

  it('em média, tocar ao acaso rende perto de zero (nunca centenas de pontos)', () => {
    let sum = 0;
    for (let i = 0; i < 400; i++) {
      const c = ecoChallenge({ seed: `rand-${i}`, variant: 'standard' });
      let s = i + 1;
      const taps = c.expected.map(() => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s % 4;
      });
      sum += ecoPoints({ seed: `rand-${i}`, variant: 'standard' }, taps);
    }
    expect(sum / 400).toBeLessThan(120);
  });
});

describe('regras de troll e negativas', () => {
  it('Cor Oposta: a nota é contra o matiz + 180°', () => {
    const t = { h: 40, s: 60, b: 70 };
    expect(colorScoreTarget('complementary', t)).toEqual({ h: 220, s: 60, b: 70 });
    expect(colorScoreTarget('standard', t)).toEqual(t);
  });

  it('Já Deu? Sem Estourar: passar do alvo (com 150 ms de folga) tira 400', () => {
    const ref = { seed: 'noover-1', variant: 'noover' };
    const c = timeChallenge(ref);
    expect(c.noOver).toBe(true);
    expect(timePoints(ref, c.expectedMs)).toBe(1000);
    expect(timePoints(ref, c.expectedMs + 100)).toBeGreaterThan(0);
    expect(timePoints(ref, c.expectedMs + 400)).toBe(-400);
    // No padrão passar só reduz a nota, nunca é negativo.
    expect(
      timePoints({ seed: 'noover-1', variant: 'standard' }, c.expectedMs + 400),
    ).toBeGreaterThanOrEqual(0);
  });

  it('Digitação: Contar, Pontas e Dobrar pedem o texto certo; errar nas regras tira 300', () => {
    const ref = (variant: string) => ({ seed: 'troll-1', variant });
    for (const v of ['count', 'ends', 'twice']) {
      const c = typingChallenge(ref(v));
      expect(typingPoints(ref(v), c.expected!, false, 0)).toBe(1000);
      expect(typingPoints(ref(v), 'xyz', false, 0)).toBe(-300);
    }
    const w = typingChallenge(ref('count')).word;
    expect(typingChallenge(ref('count')).expected).toBe(
      String(w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').length),
    );
    const ends = typingChallenge(ref('ends'));
    expect(ends.expected).toHaveLength(2);
    expect(typingPoints(ref('standard'), 'xyz', false, 0)).toBe(0);
  });

  it('todas as variantes têm comando próprio e tempos válidos', () => {
    const cmds = new Set<string>();
    for (const [game, list] of Object.entries(VARIANTS)) {
      for (const v of list) {
        const slot = {
          kind: 'micro' as const,
          game: game as MicroSlot['game'],
          variant: v.id,
          seed: `cmd-${game}-${v.id}`,
          round: 1,
          position: 1,
        };
        const text = commandText(slot);
        expect(text.length).toBeGreaterThan(8);
        cmds.add(`${game}:${text}`);
        expect(microTiming(slot).pickMs).toBeGreaterThan(1000);
      }
    }
    expect(cmds.size).toBeGreaterThanOrEqual(20);
  });
});
