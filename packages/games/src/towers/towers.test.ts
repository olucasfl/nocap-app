import { describe, expect, it } from 'vitest';
import {
  Body,
  FIELD_HALF,
  MAX_LIVES,
  PLATFORM_W,
  TOWERS_DT,
  TOWER_KINDS,
  TowersGame,
  World,
  bodyTop,
  mergeBodies,
  type TowersInput,
} from './index';

const NONE: TowersInput = { left: false, right: false, down: false };
const DROP: TowersInput = { left: false, right: false, down: true };

/** A plataforma do jogo (topo em y = 0, 7 de largura) num mundo à parte, para testar a física. */
function ground(world: World) {
  const b = new Body();
  b.setBoxes([{ cx: 0, cy: 0.8, hw: PLATFORM_W / 2, hh: 0.8, rc: 1, rs: 0 }], 1, true);
  b.x = 0;
  b.y = 0.8;
  return world.add(b);
}

function box(world: World, x: number, y: number, hw = 0.5, hh = 0.5): Body {
  const b = new Body();
  b.setBoxes([{ cx: 0, cy: 0, hw, hh, rc: 1, rs: 0 }]);
  b.x = x;
  b.y = y;
  return world.add(b);
}

const run = (world: World, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / TOWERS_DT); i++) world.step(TOWERS_DT);
};

describe('física', () => {
  it('uma caixa cai na plataforma e fica parada em cima dela', () => {
    const world = new World();
    ground(world);
    const b = box(world, 0, -4);
    run(world, 3);
    expect(b.y).toBeGreaterThan(-0.56);
    expect(b.y).toBeLessThan(-0.44);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(0.05);
    expect(Math.abs(b.x)).toBeLessThan(0.02);
  });

  it('uma pilha de 10 caixas alinhadas fica de pé', () => {
    const world = new World();
    ground(world);
    const stack: Body[] = [];
    for (let i = 0; i < 10; i++) stack.push(box(world, 0, -0.5 - i * 1.0));
    run(world, 6);
    for (const [i, b] of stack.entries()) {
      expect(Math.abs(b.x), `caixa ${i}`).toBeLessThan(0.2);
      expect(b.y, `caixa ${i}`).toBeGreaterThan(-0.5 - i - 0.2);
    }
  });

  it('uma caixa com o centro de massa fora da borda cai da plataforma', () => {
    const world = new World();
    ground(world);
    const b = box(world, PLATFORM_W / 2 + 0.3, -1);
    run(world, 4);
    expect(b.y).toBeGreaterThan(8);
  });

  it('um peso na ponta da beira (ainda apoiado) não cai', () => {
    const world = new World();
    ground(world);
    const b = box(world, PLATFORM_W / 2 - 0.2, -1);
    run(world, 4);
    expect(b.y).toBeLessThan(0);
  });

  it('empurrar uma caixa na superfície com atrito faz ela parar', () => {
    const world = new World();
    ground(world);
    const b = box(world, 0, -0.5);
    b.vx = 3;
    run(world, 3);
    expect(Math.abs(b.vx)).toBeLessThan(0.05);
    expect(b.x).toBeGreaterThan(0);
    expect(b.x).toBeLessThan(2.4);
  });

  it('com gelo escorrega mais longe', () => {
    const slide = (friction: number) => {
      const world = new World();
      const g = ground(world);
      g.friction = friction;
      const b = box(world, -2, -0.5);
      b.friction = friction;
      b.vx = 2;
      run(world, 1.5);
      return b.x;
    };
    expect(slide(0.04)).toBeGreaterThan(slide(0.7) + 0.4);
  });

  it('batida nova gera evento de impacto proporcional à velocidade', () => {
    const world = new World();
    ground(world);
    box(world, 0, -6);
    let maxSpeed = 0;
    for (let i = 0; i < 180; i++) {
      world.step(TOWERS_DT);
      for (const im of world.impacts) maxSpeed = Math.max(maxSpeed, im.speed);
    }
    expect(maxSpeed).toBeGreaterThan(5);
  });

  it('é determinística: mesmo começo, mesmo estado', () => {
    const sim = () => {
      const world = new World();
      ground(world);
      const a = box(world, 0.3, -3);
      const b = box(world, -0.4, -5, 1, 0.5);
      run(world, 4);
      return [a.x, a.y, a.c, a.s, b.x, b.y, b.c, b.s];
    };
    expect(sim()).toEqual(sim());
  });

  it('a vinha funde corpos num só, rígido', () => {
    const world = new World();
    ground(world);
    const a = box(world, 0, -0.5);
    const b = box(world, 0.6, -1.5);
    const m = mergeBodies(world, [a, b]);
    expect(world.bodies).toContain(m);
    expect(world.bodies).not.toContain(a);
    expect(m.boxes).toHaveLength(2);
    expect(m.mass).toBeCloseTo(2, 5);
    run(world, 3);
    expect(m.y).toBeLessThan(0);
    expect(bodyTop(m)).toBeLessThan(0);
  });
});

/** Joga: deixa a peça descer rápido até soltar e aparecer a próxima. */
function dropOne(g: TowersGame, input: TowersInput = DROP, maxSeconds = 12) {
  let waited = 0;
  while (!g.active && waited < 5 && !g.over) {
    g.step(NONE);
    waited += TOWERS_DT;
  }
  const first = g.active;
  let t = 0;
  while (g.active === first && first && !g.over && t < maxSeconds) {
    g.step(input);
    t += TOWERS_DT;
  }
  return first;
}

describe('o jogo', () => {
  it('as peças saem em sacolas de 7: as 7 primeiras são todas diferentes', () => {
    const g = new TowersGame('sacola');
    const first = g.queue.slice(0, 7);
    expect(new Set(first).size).toBe(7);
    expect(first.every((k) => k >= 0 && k < TOWER_KINDS.length)).toBe(true);
  });

  it('é determinístico pela seed', () => {
    const a = new TowersGame('x');
    const b = new TowersGame('x');
    expect(a.queue).toEqual(b.queue);
    expect(new TowersGame('y').queue).not.toEqual(a.queue);
    for (let i = 0; i < 600; i++) {
      a.step(i % 90 < 30 ? { left: true, right: false, down: false } : DROP);
      b.step(i % 90 < 30 ? { left: true, right: false, down: false } : DROP);
    }
    expect(a.stacked).toBe(b.stacked);
    expect(a.time).toBe(b.time);
    expect(a.world.bodies.map((x) => [x.x, x.y])).toEqual(b.world.bodies.map((x) => [x.x, x.y]));
  });

  it('a peça nasce, desce, pousa na plataforma e é solta; vem a próxima', () => {
    const g = new TowersGame('pouso');
    const p = dropOne(g);
    expect(p).toBeTruthy();
    expect(p!.phase).toBe('free');
    expect(g.releasedCount).toBe(1);
    expect(g.lives).toBe(MAX_LIVES);
    let waited = 0;
    while (!g.active && waited < 3) {
      g.step(NONE);
      waited += TOWERS_DT;
    }
    expect(g.active).not.toBeNull();
    expect(g.active).not.toBe(p);
  });

  it('assentar conta ponto: a nota é o máximo de peças empilhadas', () => {
    const g = new TowersGame('assenta');
    dropOne(g);
    for (let i = 0; i < 120; i++) g.step(NONE);
    expect(g.peak).toBe(1);
    expect(g.drainEvents().some((e) => e.type === 'settle')).toBe(true);
  });

  it('gira em passos de 90 graus (e troca largura por altura)', () => {
    const g = new TowersGame('gira');
    while (!g.active) g.step(NONE);
    // a primeira peça pode ser o O (quadrado): gira até achar uma que mude de forma
    for (let n = 0; n < 6; n++) {
      const p = g.active!;
      if (p.w !== p.h) {
        const [w, h] = [p.w, p.h];
        expect(g.rotate()).toBe(true);
        expect(g.active!.w).toBe(h);
        expect(g.active!.h).toBe(w);
        return;
      }
      dropOne(g);
      while (!g.active) g.step(NONE);
    }
    throw new Error('nenhuma peça retangular em 6 tentativas');
  });

  it('peça que cai fora da plataforma custa uma vida', () => {
    const g = new TowersGame('queda');
    while (!g.active) g.step(NONE);
    // Anda para a esquerda até o fim do campo, bem longe da plataforma, e cai direto no vazio
    const left: TowersInput = { left: true, right: false, down: false };
    let t = 0;
    while (g.lives === MAX_LIVES && t < 15) {
      g.step(left);
      t += TOWERS_DT;
    }
    expect(g.lives).toBe(MAX_LIVES - 1);
    expect(g.drainEvents().some((e) => e.type === 'life')).toBe(true);
  });

  it('sem vidas a partida acaba, e não nasce mais peça', () => {
    const g = new TowersGame('fim');
    const left: TowersInput = { left: true, right: false, down: true };
    let t = 0;
    while (!g.over && t < 90) {
      g.step(left);
      t += TOWERS_DT;
    }
    expect(g.over).toBe(true);
    expect(g.lives).toBe(0);
    const spawned = g.spawned;
    for (let i = 0; i < 120; i++) g.step(NONE);
    expect(g.spawned).toBe(spawned);
    expect(g.drainEvents().some((e) => e.type === 'over')).toBe(true);
  });

  it('as peças ficam dentro do campo', () => {
    const g = new TowersGame('campo');
    while (!g.active) g.step(NONE);
    const right: TowersInput = { left: false, right: true, down: false };
    for (let i = 0; i < 180; i++) {
      g.step(right);
      const p = g.active;
      if (p) expect(p.body.x - p.comx + p.w).toBeLessThanOrEqual(FIELD_HALF + 0.2);
    }
  });
});

describe('estabilidade e desempenho', () => {
  it('uma partida longa sem pensar não gera números quebrados e roda rápido', () => {
    const g = new TowersGame('longa');
    const t0 = Date.now();
    let sway = 0;
    for (let i = 0; i < 60 * 90 && !g.over; i++) {
      // vai e volta pelo campo, solta rápido de vez em quando
      sway = (i % 240) < 120 ? 1 : -1;
      g.step({ left: sway < 0 && i % 50 < 25, right: sway > 0 && i % 50 < 25, down: i % 7 < 3 });
      if (i % 200 === 0) g.rotate();
    }
    for (const b of g.world.bodies) {
      expect(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.c)).toBe(true);
    }
    expect(Date.now() - t0).toBeLessThan(15_000);
    expect(g.releasedCount).toBeGreaterThan(3);
  });
});

describe('magias', () => {
  const ready = (seed: string) => {
    const g = new TowersGame(seed);
    while (!g.active) g.step(NONE);
    return g;
  };

  it('cimento: a peça vira pedra e fica imóvel', () => {
    const g = ready('cimento');
    g.held.push('cimento');
    expect(g.castSpell()).toBe(true);
    expect(g.held).toEqual([]);
    const p = dropOne(g)!;
    expect(p.body.isStatic).toBe(true);
    expect(g.drainEvents().some((e) => e.type === 'petrify')).toBe(true);
  });

  it('vinha: a peça se funde ao que encostar', () => {
    const g = ready('vinha');
    const first = dropOne(g)!;
    while (!g.active) g.step(NONE);
    g.held.push('vinha');
    g.castSpell();
    const second = dropOne(g)!;
    expect(second.body).toBe(first.body);
    expect((second.body.data.pieces as unknown[]).length).toBe(2);
    expect(g.drainEvents().some((e) => e.type === 'ivy')).toBe(true);
  });

  it('desfazer: some com a última peça colocada, sem perder vida', () => {
    const g = ready('desfazer');
    const p = dropOne(g)!;
    while (!g.active) g.step(NONE);
    g.held.push('desfazer');
    expect(g.castSpell()).toBe(true);
    expect(p.dead).toBe(true);
    expect(g.world.bodies).not.toContain(p.body);
    expect(g.lives).toBe(MAX_LIVES);
  });

  it('desfazer sem nada colocado não gasta a magia', () => {
    const g = ready('desfazer2');
    g.held.push('desfazer');
    expect(g.castSpell()).toBe(false);
    expect(g.held).toEqual(['desfazer']);
  });

  it('vida extra: só com vida a menos', () => {
    const g = ready('vida');
    g.held.push('vida');
    expect(g.castSpell()).toBe(false);
    g.lives = 2;
    expect(g.castSpell()).toBe(true);
    expect(g.lives).toBe(3);
  });

  it('a cada 5 peças chega uma magia', () => {
    const g = new TowersGame('chega');
    let granted = 0;
    for (let n = 0; n < 5; n++) {
      dropOne(g);
      granted += g.drainEvents().filter((e) => e.type === 'spell').length;
    }
    expect(granted).toBe(1);
  });

  it('magias ruins pegam as próximas peças: grande, gelo, sem giro, rápida, gira', () => {
    const g = new TowersGame('ruins');
    g.fx.grande = 1;
    g.fx.gelo = 1;
    g.fx.semgiro = 1;
    g.fx.rapida = 1;
    g.fx.gira = 1;
    while (!g.active) g.step(NONE);
    const p = g.active!;
    expect(p.scale).toBeGreaterThan(1);
    expect(p.ice).toBe(true);
    expect(p.body.friction).toBeLessThan(0.1);
    expect(p.noRotate).toBe(true);
    expect(g.rotate()).toBe(false);
    expect(p.fast).toBe(true);
    expect(p.autoRotate).toBe(true);
    expect(g.fx.grande + g.fx.gelo + g.fx.semgiro + g.fx.rapida + g.fx.gira).toBe(0);
  });
});

describe('movimento de bloco em bloco e trava ao encostar', () => {
  const tlOf = (g: TowersGame) => g.active!.body.x - g.active!.comx;
  const ready = (seed: string) => {
    const g = new TowersGame(seed);
    while (!g.active) g.step(NONE);
    return g;
  };

  it('um toque anda exatamente uma casa e a peça fica alinhada à grade', () => {
    const g = ready('grade');
    const start = tlOf(g);
    expect(Number.isInteger(start)).toBe(true);
    for (let i = 0; i < 3; i++) g.step({ left: false, right: true, down: false });
    for (let i = 0; i < 40; i++) g.step(NONE);
    expect(tlOf(g)).toBeCloseTo(start + 1, 1);
    for (let i = 0; i < 3; i++) g.step({ left: true, right: false, down: false });
    for (let i = 0; i < 40; i++) g.step(NONE);
    expect(tlOf(g)).toBeCloseTo(start, 1);
  });

  it('segurar anda uma casa de cada vez, devagar', () => {
    const g = ready('segura');
    const start = tlOf(g);
    for (let i = 0; i < 60; i++) g.step({ left: false, right: true, down: false }); // 1 segundo
    const moved = tlOf(g) - start;
    expect(moved).toBeGreaterThanOrEqual(3);
    expect(moved).toBeLessThanOrEqual(7);
    for (let i = 0; i < 40; i++) g.step(NONE);
    expect(Number.isInteger(Math.round(tlOf(g) * 100) / 100)).toBe(true);
  });

  it('depois de encostar em algo a peça não anda nem gira mais', () => {
    const g = ready('trava');
    let guard = 0;
    while (!(g as unknown as { touched: boolean }).touched && guard++ < 60 * 20) g.step(NONE);
    expect((g as unknown as { touched: boolean }).touched).toBe(true);
    const tl = tlOf(g);
    for (let i = 0; i < 8 && g.active; i++) g.step({ left: false, right: true, down: false });
    if (g.active) expect(tlOf(g)).toBeCloseTo(tl, 1);
    expect(g.rotate()).toBe(false);
  });

  it('a peça nasce bem alto e desce devagar', () => {
    const g = ready('alto');
    const p = g.active!;
    // O caminho até a plataforma é longo (mais de 12 casas) e a descida é lenta (menos de 3 casas por segundo)
    expect(-p.body.y).toBeGreaterThan(12);
    expect(p.body.vy).toBeLessThan(3);
  });
});

describe('a peça que voa nunca empurra a torre', () => {
  it('enquanto a pessoa controla a peça, as peças da torre não saem do lugar', () => {
    const g = new TowersGame('sem-empurrao');
    const first = dropOne(g)!;
    for (let i = 0; i < 90; i++) g.step(NONE); // a primeira assenta
    const base = { x: first.body.x, y: first.body.y, c: first.body.c };
    // A segunda peça desce empurrando para o lado e para baixo, direto na torre.
    let steps = 0;
    while (!g.active && steps++ < 300) g.step(NONE);
    let worst = 0;
    steps = 0;
    while (g.active && steps++ < 60 * 20) {
      g.step({ left: false, right: true, down: true });
      worst = Math.max(worst, Math.hypot(first.body.x - base.x, first.body.y - base.y), Math.abs(first.body.c - base.c));
    }
    expect(worst).toBeLessThan(0.02);
  });
});
