import { describe, expect, it } from 'vitest';
import {
  ATR_IDLE_KILL_TICKS,
  ATR_RESPAWN_TICKS,
  ATR_ROOM_COLORS,
  ATR_ROOM_SIZES,
  ATR_STEP_TICKS,
  AtravessaMirror,
  AtravessaSim,
  AtravessaWorld,
  atravessaCheckpoints,
  atravessaRoomRules,
  atravessaTickAt,
  type AtravessaInput,
  type AtravessaRules,
  type Dir,
} from './index';

const advance = (sim: AtravessaSim, n: number) => {
  for (let i = 0; i < n; i++) sim.step();
};
const kill = (sim: AtravessaSim) => (sim as unknown as { die: (e: string) => void }).die('veiculo');

/** Um jogador simples e determinístico: pula para a frente a cada `every` ticks e de lado de vez em quando. */
function play(
  seed: string,
  rules: Partial<AtravessaRules>,
  ticks: number,
  every = 14,
): { sim: AtravessaSim; inputs: AtravessaInput[] } {
  const sim = new AtravessaSim(seed, undefined, rules);
  const inputs: AtravessaInput[] = [];
  while (!sim.halted && sim.tick < ticks) {
    if (sim.alive && sim.tick % every === 0) {
      const d: Dir = sim.tick % 70 === 0 ? 2 : sim.tick % 91 === 0 ? 3 : 0;
      inputs.push({ t: sim.tick + 1, d });
      sim.input(d);
    }
    sim.step();
  }
  return { sim, inputs };
}

describe('checkpoints', () => {
  it('de 50 em 50 até 200, de 75 em 75 até 500 e de 100 em 100 depois', () => {
    expect(atravessaCheckpoints(100)).toEqual([50]);
    expect(atravessaCheckpoints(250)).toEqual([50, 100, 150, 200]);
    expect(atravessaCheckpoints(500)).toEqual([50, 100, 150, 200, 275, 350, 425]);
    expect(atravessaCheckpoints(1000)).toEqual([
      50, 100, 150, 200, 275, 350, 425, 500, 600, 700, 800, 900,
    ]);
  });

  it('o fim do mapa nunca é checkpoint', () => {
    for (const len of Object.values(ATR_ROOM_SIZES)) expect(atravessaCheckpoints(len)).not.toContain(len);
  });

  it('o ponto de renascer é uma faixa de descanso e fica depois do checkpoint anterior', () => {
    for (let i = 0; i < 25; i++) {
      const w = new AtravessaWorld(`cp-${i}`);
      let prev = 0;
      for (const cp of atravessaCheckpoints(1000)) {
        const row = w.restRowAtOrBelow(cp);
        expect(w.lane(row).kind).toBe('descanso');
        expect(row).toBeLessThanOrEqual(cp);
        expect(row).toBeGreaterThan(prev);
        expect(w.lane(row).blocked).not.toContain(w.corridorAt(row));
        prev = cp;
      }
    }
  });
});

describe('regras da sala', () => {
  it('o Infinito não tem escuridão e engole quem fica parado; o Checkpoint tem corrida e checkpoints', () => {
    expect(atravessaRoomRules('infinito')).toMatchObject({
      darkness: false,
      idleKillTicks: ATR_IDLE_KILL_TICKS,
      finishRow: null,
      checkpoints: null,
    });
    const cp = atravessaRoomRules('checkpoint', 'grande');
    expect(cp).toMatchObject({ darkness: false, idleKillTicks: null, finishRow: 500 });
    expect(cp.checkpoints).toEqual(atravessaCheckpoints(500));
  });

  it('o relógio do mundo vem da hora marcada da largada', () => {
    expect(atravessaTickAt(1000, 1000)).toBe(0);
    expect(atravessaTickAt(2000, 1000)).toBe(60);
    expect(atravessaTickAt(500, 1000)).toBe(0);
  });

  it('há 8 cores diferentes', () => {
    expect(new Set(ATR_ROOM_COLORS.map((c) => c.hex)).size).toBe(8);
  });
});

describe('sem escuridão', () => {
  it('a escuridão nunca aparece e nem mata', () => {
    const sim = new AtravessaSim('quieto', undefined, { darkness: false });
    advance(sim, 60 * 60);
    expect(sim.alive).toBe(true);
    expect(sim.view().danger).toBe(0);
    expect(sim.view().darkRow).toBeLessThan(-500);
  });

  it('parado por 12 s é engolido; pulando de vez em quando, não', () => {
    const idle = new AtravessaSim('quieto', undefined, atravessaRoomRules('infinito'));
    advance(idle, ATR_IDLE_KILL_TICKS - 1);
    expect(idle.alive).toBe(true);
    advance(idle, 2);
    expect(idle.alive).toBe(false);
    expect(idle.end).toBe('parado');
    expect(idle.halted).toBe(true);

    const walker = new AtravessaSim('quieto', undefined, atravessaRoomRules('infinito'));
    for (let i = 0; i < 6; i++) {
      walker.input(i % 2 === 0 ? 2 : 3);
      advance(walker, 600);
    }
    expect(walker.alive).toBe(true);
  });

  it('bater numa árvore não conta como se mexer', () => {
    const w = new AtravessaWorld('arvore');
    let r = 3;
    while (!(w.lane(r).kind === 'descanso' && w.lane(r).blocked.length && w.lane(r - 1).kind === 'descanso')) r++;
    const sim = new AtravessaSim('arvore', w, atravessaRoomRules('infinito'));
    sim.row = r - 1;
    sim.best = r - 1;
    sim.hx = w.lane(r).blocked[0]!;
    for (let i = 0; i < 20; i++) {
      sim.input(0);
      advance(sim, 40);
    }
    expect(sim.alive).toBe(false);
    expect(sim.end).toBe('parado');
  });
});

describe('fim do mapa e checkpoints na simulação', () => {
  /** Duas faixas de descanso seguidas, longe da largada. */
  function restPair(w: AtravessaWorld) {
    let r = 30;
    while (!(w.lane(r).kind === 'descanso' && w.lane(r + 1).kind === 'descanso')) r++;
    return r;
  }

  it('chegar à linha do fim termina a corrida e para o relógio', () => {
    const w = new AtravessaWorld('fim');
    const r = restPair(w);
    const sim = new AtravessaSim('fim', w, { darkness: false, finishRow: r + 1 });
    sim.row = r;
    sim.best = r;
    sim.hx = w.corridorAt(r + 1);
    sim.input(0);
    advance(sim, ATR_STEP_TICKS + 2);
    expect(sim.finished).toBe(true);
    expect(sim.finishTick).toBeGreaterThan(0);
    const tick = sim.tick;
    advance(sim, 30);
    expect(sim.tick).toBe(tick);
    expect(sim.halted).toBe(true);
  });

  it('o checkpoint alcançado vale ao morrer: renasce nele, depois de uma pausa, com o mundo andando', () => {
    const w = new AtravessaWorld('renasce');
    const r = restPair(w);
    const sim = new AtravessaSim('renasce', w, { darkness: false, checkpoints: [r + 1], finishRow: r + 100 });
    sim.row = r;
    sim.best = r;
    sim.hx = w.corridorAt(r + 1);
    sim.input(0);
    advance(sim, ATR_STEP_TICKS + 1);
    expect(sim.checkpointRow).toBe(r + 1);

    // anda mais um pouco e morre
    kill(sim);
    expect(sim.alive).toBe(false);
    expect(sim.view().respawnIn).toBe(ATR_RESPAWN_TICKS);
    expect(sim.halted).toBe(false);
    const died = sim.tick;
    advance(sim, ATR_RESPAWN_TICKS - 1);
    expect(sim.alive).toBe(false);
    advance(sim, 1);
    expect(sim.alive).toBe(true);
    expect(sim.tick).toBe(died + ATR_RESPAWN_TICKS);
    expect(sim.row).toBe(r + 1);
    expect(sim.hx).toBe(w.corridorAt(r + 1));
    expect(sim.view().deaths).toBe(1);
    expect(sim.score).toBe(r + 1);
  });

  it('sem checkpoint alcançado volta à largada; o checkpoint em estrada renasce na faixa de descanso mais próxima', () => {
    const sim = new AtravessaSim('largada', undefined, { darkness: false, checkpoints: [50] });
    advance(sim, 5);
    kill(sim);
    advance(sim, ATR_RESPAWN_TICKS);
    expect(sim.alive).toBe(true);
    expect(sim.row).toBe(0);
    expect(sim.hx).toBe(0);

    const w = new AtravessaWorld('estrada');
    let q = 40;
    while (w.lane(q).kind !== 'estrada') q++;
    const s2 = new AtravessaSim('estrada', w, { darkness: false, checkpoints: [q] });
    s2.checkpointRow = q;
    kill(s2);
    advance(s2, ATR_RESPAWN_TICKS);
    expect(s2.alive).toBe(true);
    expect(w.lane(s2.row).kind).toBe('descanso');
    expect(s2.row).toBeLessThan(q);
  });

  it('sem a lista de checkpoints a morte é definitiva', () => {
    const sim = new AtravessaSim('fim-de-jogo', undefined, { darkness: false });
    kill(sim);
    expect(sim.halted).toBe(true);
    const tick = sim.tick;
    advance(sim, 600);
    expect(sim.alive).toBe(false);
    expect(sim.tick).toBe(tick);
  });
});

describe('espelho do servidor', () => {
  const rulesInf = atravessaRoomRules('infinito');
  const rulesCp = atravessaRoomRules('checkpoint', 'pequeno');

  /** Relata em pedaços de `chunk` ticks, como o aparelho faz. */
  function replay(seed: string, rules: Partial<AtravessaRules>, inputs: AtravessaInput[], upTo: number, chunk = 30) {
    const m = new AtravessaMirror(seed, rules);
    let sent = 0;
    for (let t = chunk; ; t += chunk) {
      const T = Math.min(t, upTo);
      const batch: AtravessaInput[] = [];
      while (sent < inputs.length && inputs[sent]!.t <= T) batch.push(inputs[sent++]!);
      expect(m.report(T, batch, T + 100)).toBe(true);
      if (T >= upTo) return m;
    }
  }

  it('reproduz exatamente a partida do aparelho (Infinito)', () => {
    for (const seed of ['e1', 'e2', 'e3']) {
      const { sim, inputs } = play(seed, rulesInf, 60 * 90);
      const m = replay(seed, rulesInf, inputs, sim.tick);
      expect(m.sim.row).toBe(sim.row);
      expect(m.sim.score).toBe(sim.score);
      expect(m.sim.alive).toBe(sim.alive);
      expect(m.sim.end).toBe(sim.end);
      expect(m.sim.tick).toBe(sim.tick);
    }
  });

  it('reproduz a corrida com mortes e checkpoints', () => {
    for (const seed of ['c1', 'c2', 'c3']) {
      const { sim, inputs } = play(seed, rulesCp, 60 * 120, 11);
      const m = replay(seed, rulesCp, inputs, sim.tick, 45);
      expect(m.sim.view()).toMatchObject({
        score: sim.score,
        deaths: sim.deaths,
        checkpoint: sim.checkpointRow,
        finished: sim.finished,
        alive: sim.alive,
        tick: sim.tick,
      });
    }
  });

  it('recusa relatos inválidos sem mudar nada', () => {
    const m = new AtravessaMirror('inval', rulesInf);
    expect(m.report(60, [{ t: 10, d: 2 }], 200)).toBe(true);
    const tick = m.tick;
    expect(tick).toBe(60);
    // no passado
    expect(m.report(120, [{ t: 30, d: 2 }], 200)).toBe(false);
    // fora de ordem
    expect(m.report(120, [{ t: 100, d: 3 }, { t: 90, d: 3 }], 200)).toBe(false);
    // depois do tick relatado
    expect(m.report(120, [{ t: 121, d: 3 }], 200)).toBe(false);
    // direção inválida, formato inválido
    expect(m.report(120, [{ t: 100, d: 7 }], 200)).toBe(false);
    expect(m.report(120, [{ t: 100.5, d: 3 }], 200)).toBe(false);
    expect(m.report(120, 'x', 200)).toBe(false);
    expect(m.report(120, [null], 200)).toBe(false);
    // tick para trás ou além do relógio do servidor
    expect(m.report(30, [], 200)).toBe(false);
    expect(m.report(500, [], 200)).toBe(false);
    expect(m.report(120.5, [], 200)).toBe(false);
    expect(m.tick).toBe(tick);
    // e o relato válido seguinte ainda passa
    expect(m.report(120, [{ t: 100, d: 3 }], 200)).toBe(true);
    expect(m.tick).toBe(120);
  });

  it('não anda mais depressa que o relógio do servidor', () => {
    const m = new AtravessaMirror('rapido', rulesInf);
    expect(m.report(700, [], 600)).toBe(false);
    expect(m.tick).toBe(0);
    expect(m.report(600, [], 600)).toBe(true);
    expect(m.tick).toBe(600);
  });

  it('limita o tamanho de um relato', () => {
    const m = new AtravessaMirror('grande', rulesInf);
    const many = Array.from({ length: 65 }, (_, i) => ({ t: i + 1, d: 2 }));
    expect(m.report(100, many, 200)).toBe(false);
  });

  it('quem morre de vez para o espelho; quem renasce continua', () => {
    const dead = new AtravessaMirror('quieto', rulesInf);
    expect(dead.report(ATR_IDLE_KILL_TICKS + 60, [], ATR_IDLE_KILL_TICKS + 100)).toBe(true);
    expect(dead.sim.end).toBe('parado');
    expect(dead.tick).toBeLessThan(ATR_IDLE_KILL_TICKS + 60);
    expect(dead.sim.halted).toBe(true);
    // um relato com o tick congelado do aparelho segue valendo
    expect(dead.report(dead.tick, [], dead.tick + 100)).toBe(true);

    const m = new AtravessaMirror('renasce-espelho', { darkness: false, checkpoints: [50], finishRow: 100 });
    kill(m.sim);
    expect(m.report(ATR_RESPAWN_TICKS + 10, [], ATR_RESPAWN_TICKS + 100)).toBe(true);
    expect(m.sim.alive).toBe(true);
    expect(m.tick).toBe(ATR_RESPAWN_TICKS + 10);
  });
});
