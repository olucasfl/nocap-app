import { describe, expect, it } from 'vitest';
import {
  BIG_WEIGHT,
  ENABLED_MICRO,
  MICRO_MAX,
  PARTY_MICRO_PER_ROUND,
  POINTS_BAD,
  POINTS_GOOD,
  POINTS_NEUTRAL,
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

  it('o grande alterna: Caça-Formas nas rodadas ímpares e Arena X1 nas pares', () => {
    const bigs = buildPlan('s', 4).filter((p): p is BigSlot => p.kind === 'big');
    expect(bigs.map((b) => b.game)).toEqual(['shapes', 'x1', 'shapes', 'x1']);
  });

  it('as pegadinhas aparecem em torno de 20% dos micro-desafios', () => {
    const list = micro(buildPlan('grande', 4000));
    const special = list.filter((p) => p.variant !== 'standard').length;
    const share = special / list.length;
    expect(share).toBeGreaterThan(0.15);
    expect(share).toBeLessThan(0.28);
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

  it('Reverso: o esperado é a sequência de trás para frente', () => {
    const c = ecoChallenge(ref('reverse'));
    expect(c.expected).toEqual([...c.sequence].reverse());
  });

  it('Botão Proibido: a sequência mostra o botão, mas o esperado o ignora e tocá-lo zera', () => {
    const c = ecoChallenge(ref('forbidden'));
    expect(c.sequence).toContain(c.forbidden);
    expect(c.expected).not.toContain(c.forbidden);
    expect(ecoPoints(ref('forbidden'), c.expected)).toBe(1000);
    expect(ecoPoints(ref('forbidden'), [c.forbidden!, ...c.expected])).toBe(0);
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
    expect(typingPoints(ref('noaccents', 'acc'), c.word, false, 0)).toBe(0);
    expect(typingPoints(ref('noaccents', 'acc'), c.expected!, false, 0)).toBe(1000);
  });

  it('o banco de palavras não tem duplicadas nem palavras muito longas', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
    expect(WORDS.every((w) => w.length >= 3 && w.length <= 11)).toBe(true);
  });
});

describe('Caça-Formas', () => {
  it('é determinístico, tem as regras no comando e uma lista de itens ao longo do tempo', () => {
    const a = shapesRound('forma-1');
    expect(a).toEqual(shapesRound('forma-1'));
    expect(a.items.length).toBeGreaterThan(30);
    expect(a.items[a.items.length - 1]!.at).toBeLessThan(SHAPES_DURATION_MS);
    const info = bigInfo({ kind: 'big', game: 'shapes', seed: 'forma-1', round: 1 });
    expect(info.lines.join(' ')).toMatch(/CLIQUE/);
    expect(info.lines.join(' ')).toMatch(/EVITE/);
  });

  it('as peças boas vencem a metade e quem bate nas duas regras conta como proibida', () => {
    for (let i = 0; i < 40; i++) {
      const r = shapesRound(`f${i}`);
      const good = r.items.filter((x) => x.cls === 'good').length;
      expect(good).toBeGreaterThan(r.items.length * 0.3);
      for (const it of r.items) expect(classify(r, it.kind, it.color)).toBe(it.cls);
    }
    const r = shapesRound('f1');
    const both = { click: { shape: 'circle' as const }, avoid: { color: 'green' as const } };
    expect(classify({ ...r, ...both }, 'circle', 'green')).toBe('bad');
  });

  it('clique certo +100, proibido -150, neutro -50; fora da janela não vale', () => {
    const r = shapesRound('f2');
    const good = r.items.find((x) => x.cls === 'good')!;
    const bad = r.items.find((x) => x.cls === 'bad')!;
    const neutral = r.items.find((x) => x.cls === 'neutral')!;
    expect(shapeClickPoints(r, good.id, good.at + 200)).toBe(POINTS_GOOD);
    expect(shapeClickPoints(r, bad.id, bad.at + 200)).toBe(POINTS_BAD);
    expect(shapeClickPoints(r, neutral.id, neutral.at + 200)).toBe(POINTS_NEUTRAL);
    expect(shapeClickPoints(r, good.id, good.at - 50)).toBeNull();
    expect(shapeClickPoints(r, good.id, good.at + good.life + 5000)).toBeNull();
    expect(shapeClickPoints(r, 9999, 0)).toBeNull();
  });

  it('acertar todas as boas dá o máximo do grande', () => {
    const r = shapesRound('f3');
    const good = r.items.filter((x) => x.cls === 'good').length;
    expect(good * POINTS_GOOD).toBeGreaterThanOrEqual(BIG_WEIGHT * MICRO_MAX * 0.8);
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
