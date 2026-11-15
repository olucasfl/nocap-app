import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  HERO_INFO,
  MAP_INFO,
  UPGRADES,
  applyRun,
  buyHero,
  buyMeta,
  emptySave,
  goldWithBonus,
  mapUnlocked,
} from './rules';
import { NhWorld, NO_META, STEP, metaBonus } from './world';
import {
  EVOLUTIONS,
  HEROES,
  HERO_IDS,
  MAPS,
  MAP_IDS,
  UPGRADE_IDS,
  UPGRADE_MAX,
  swordAngleDeg,
} from './data';
import { overlaps } from './geometry';
import { ENEMIES, PLAYER_SETTINGS } from './settings';

const run = (w: NhWorld, seconds: number, input = { x: 0, y: 0 }) => {
  for (let i = 0; i < Math.round(seconds / STEP) && w.alive; i++) {
    if (w.pending) w.choose(w.pending.options[0]!);
    w.step(input);
  }
};
const snapshot = (w: NhWorld) =>
  JSON.stringify([
    w.t,
    w.player,
    w.enemies.map((e) => [e.x, e.y, e.hp]),
    w.items.length,
    w.kills,
    w.level,
  ]);

describe('geometria', () => {
  it('caixa girada encosta onde a caixa alinhada não encosta', () => {
    const a = { kind: 'box' as const, cx: 0, cy: 0, w: 100, h: 10, rot: Math.PI / 4 };
    const b = { kind: 'box' as const, cx: 30, cy: 30, w: 10, h: 10 };
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps({ ...a, rot: 0 }, b)).toBe(false);
  });
  it('círculo e caixa', () => {
    expect(
      overlaps({ kind: 'circle', cx: 0, cy: 0, r: 5 }, { kind: 'box', cx: 9, cy: 0, w: 10, h: 10 }),
    ).toBe(true);
    expect(
      overlaps(
        { kind: 'circle', cx: 0, cy: 0, r: 5 },
        { kind: 'box', cx: 12, cy: 0, w: 10, h: 10 },
      ),
    ).toBe(false);
  });
});

describe('espada', () => {
  it('fica em 170 graus até 0,47 s, gira até ~363 em 1 s e termina em 370', () => {
    expect(swordAngleDeg(0)).toBe(170);
    expect(swordAngleDeg(0.46)).toBe(170);
    expect(swordAngleDeg(1)).toBeCloseTo(363.1, 1);
    expect(swordAngleDeg(1.3)).toBe(370);
    let prev = 170;
    for (let t = 0.47; t <= 1; t += 0.02) {
      const a = swordAngleDeg(t);
      expect(a).toBeGreaterThanOrEqual(prev - 0.01);
      prev = a;
    }
    for (let t = 1; t <= 1.3; t += 0.02) expect(swordAngleDeg(t)).toBeLessThan(380);
  });
});

describe('mundo', () => {
  it('é determinístico: mesma seed e entradas dão o mesmo estado', () => {
    const a = new NhWorld('x');
    const b = new NhWorld('x');
    run(a, 40, { x: 1, y: 0.3 });
    run(b, 40, { x: 1, y: 0.3 });
    expect(snapshot(a)).toBe(snapshot(b));
    const c = new NhWorld('y');
    run(c, 40, { x: 1, y: 0.3 });
    expect(snapshot(c)).not.toBe(snapshot(a));
  });

  it('começa com 50 de vida, nível 0 e a espada recarregando', () => {
    const w = new NhWorld('s');
    expect(w.player.hp).toBe(50);
    expect(w.level).toBe(0);
    expect(w.requiredXp).toBe(10);
  });

  it('as hordas crescem com o tempo (valores do Slash)', () => {
    const w = new NhWorld('h');
    const circle = (n: number) => ({ x: Math.cos(n / 50), y: Math.sin(n / 50) });
    let n = 0;
    const go = (sec: number) => {
      for (let i = 0; i < sec * 60; i++) {
        if (w.pending) w.choose(w.pending.options[0]!);
        w.player.hp = w.player.maxHp;
        w.step(circle(n++));
      }
    };
    go(30);
    const early = w.enemies.length + w.kills;
    go(60);
    expect(w.enemies.length + w.kills).toBeGreaterThan(early);
    // o primeiro minuto só tem morcegos (BasicEnemy) e o anel de morcegos
    expect(ENEMIES.find((e) => e.id === 'BasicEnemy')?.health).toBe(2);
  });

  it('parado, o jogador acaba morrendo e o resultado guarda o tempo', () => {
    const w = new NhWorld('die');
    run(w, 60 * 12);
    expect(w.alive).toBe(false);
    expect(w.result().score).toBeGreaterThan(5);
  });

  it('XP vira nível e abre a janela com 3 opções; o mundo para até escolher', () => {
    const w = new NhWorld('xp');
    for (let i = 0; i < 10; i++)
      w.items.push({ uid: 900 + i, type: 'xp', x: 0, y: 0, attracted: false, speed: 0, born: 0 });
    w.step({ x: 0, y: 0 });
    expect(w.level).toBe(1);
    expect(w.pending?.kind).toBe('levelUp');
    expect(w.pending?.options).toHaveLength(3);
    const t = w.t;
    w.step({ x: 0, y: 0 });
    expect(w.t).toBe(t);
    const opt = w.pending!.options[0]!;
    w.choose(opt);
    expect(w.pending).toBeNull();
    expect(w.levels[opt as keyof typeof w.levels]).toBe(1);
  });

  it('melhorias respeitam o máximo do Slash', () => {
    const w = new NhWorld('m');
    for (let i = 0; i < 5; i++) w.levels.weaponLength++;
    expect(w.availableUpgrades()).not.toContain('weaponLength');
    expect(w.availableUpgrades()).toContain('weaponDamage');
  });

  it('a espada acerta um inimigo parado à direita no começo do golpe', () => {
    const w = new NhWorld('sw');
    w.weapon.timer = 1.99;
    const e = ENEMIES.find((x) => x.id === 'BasicEnemySkeleton')!;
    w.enemies.push({
      uid: 5000,
      s: e,
      x: 70,
      y: 4,
      hp: 4,
      speedX: 0,
      speedY: 0,
      life: -1,
      faceX: 1,
      flash: 0,
      follow: true,
      stateLeft: 0,
      dirX: 0,
      dirY: 0,
      shootTimer: 0,
      dead: false,
    });
    w.step({ x: 0, y: 0 });
    w.step({ x: 0, y: 0 });
    expect(w.enemies.find((x) => x.uid === 5000)!.hp).toBe(2);
  });

  it('regeneração cura 1 de vida a cada 5 s no nível 1', () => {
    const w = new NhWorld('r');
    w.player.hp = 10;
    w.levels.regeneration = 1;
    w.regen.amount = 1;
    run(w, 5.1);
    expect(w.player.hp).toBeGreaterThanOrEqual(11 - 4);
  });
});

describe('melhorias permanentes e conquistas', () => {
  it('bônus e preços vêm da tabela do Slash', () => {
    expect(metaBonus('health', 3)).toBe(30);
    expect(new NhWorld('v', { ...NO_META, health: 2 }).player.maxHp).toBe(70);
    const s = emptySave();
    s.gold = 10;
    expect(buyMeta(s, 'health')).toBe(true);
    expect(s.meta.health).toBe(1);
    expect(buyMeta(s, 'health')).toBe(false);
  });

  it('o Coletor de ouro multiplica o ouro da partida', () => {
    expect(goldWithBonus(100, { ...NO_META, goldGatherer: 2 })).toBe(120);
  });

  it('terminar uma partida libera conquistas e credita o prêmio', () => {
    const s = emptySave();
    const w = new NhWorld('c');
    w.kills = 3;
    w.t = 75;
    w.level = 5;
    w.levels.horizontal = 6;
    const { unlocked } = applyRun(s, w.result());
    const ids = unlocked.map((a) => a.id);
    expect(ids).toContain('first-blood');
    expect(ids).toContain('time-1');
    expect(ids).toContain('level-5');
    expect(ids).toContain('daggers');
    expect(s.highscore).toBe(75);
    expect(s.gold).toBeGreaterThan(0);
    expect(s.seen).toContain('horizontal');
  });

  it('toda conquista e todo item tem nome e descrição', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(2);
      expect(a.desc.length).toBeGreaterThan(5);
    }
    for (const u of Object.values(UPGRADES)) {
      expect(u.desc.length).toBeGreaterThan(10);
      for (let n = 1; n <= u.max; n++) expect(u.level(n).length).toBeGreaterThan(3);
    }
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
  });

  it('a tabela de XP tem 18 níveis como no Slash', () => {
    expect(PLAYER_SETTINGS.requiredXP).toHaveLength(18);
  });
});

const enemy = (w: NhWorld, id: string, x: number, y: number, uid: number) => {
  const s = ENEMIES.find((e) => e.id === id)!;
  w.enemies.push({
    uid,
    s,
    x,
    y,
    hp: s.health,
    speedX: 0,
    speedY: 0,
    life: -1,
    faceX: 1,
    flash: 0,
    follow: true,
    stateLeft: 0,
    dirX: 0,
    dirY: 0,
    shootTimer: 0,
    dead: false,
  });
};

describe('heróis e mapas', () => {
  it('cada herói começa com sua arma e seus números', () => {
    for (const id of HERO_IDS) {
      const w = new NhWorld('h' + id, NO_META, { hero: id });
      const h = HEROES[id]!;
      expect(w.player.maxHp).toBe(Math.round(50 * h.hp));
      if (h.start) expect(w.levels[h.start]).toBe(1);
      expect(HERO_INFO[id]?.desc.length).toBeGreaterThan(10);
    }
    expect(new NhWorld('x', NO_META, { hero: 'brann' }).armor).toBe(HEROES.brann!.armor);
  });

  it('os mapas mudam vida, velocidade e ouro dos inimigos', () => {
    const base = new NhWorld('m', NO_META, { map: 'campo' });
    const gelo = new NhWorld('m', NO_META, { map: 'gelo' });
    const sim = (w: NhWorld) => {
      for (let i = 0; i < 60 * 30 && w.alive; i++) {
        w.player.hp = w.player.maxHp;
        w.step({ x: 0, y: 0 });
      }
      return w.enemies.length ? w.enemies[0]!.hp : 0;
    };
    sim(base);
    sim(gelo);
    expect(MAPS.gelo!.enemyHp).toBeGreaterThan(1);
    expect(gelo.mapId).toBe('gelo');
    expect(MAP_IDS).toHaveLength(3);
  });

  it('comprar herói gasta ouro; mapas liberam pelo tempo sobrevivido', () => {
    const s = emptySave();
    expect(buyHero(s, 'mara')).toBe(false);
    s.gold = 400;
    expect(buyHero(s, 'mara')).toBe(true);
    expect(s.gold).toBe(270); // 400 - 150 do preço + 20 da conquista "Novo companheiro"
    expect(s.heroes).toContain('mara');
    expect(mapUnlocked(s, 'deserto')).toBe(false);
    s.stats.bestTime = 301;
    expect(mapUnlocked(s, 'deserto')).toBe(true);
    expect(MAP_INFO.gelo!.unlockTime).toBe(600);
  });
});

describe('armas novas, passivos e evoluções', () => {
  it('o machado sobe e cai atravessando inimigos', () => {
    const w = new NhWorld('a');
    w.levels.axe = 1;
    w.launchers.axe.timer = 9;
    enemy(w, 'BasicEnemy', 0, 150, 1);
    w.enemies[0]!.hp = 50;
    for (let i = 0; i < 90; i++) {
      w.player.hp = 50;
      w.step({ x: 0, y: 0 });
    }
    expect(w.projectiles.some((p) => p.kind === 'pAxe') || w.enemies[0]!.hp < 50).toBe(true);
  });

  it('os orbes giram e machucam quem encosta', () => {
    const w = new NhWorld('o');
    w.levels.orbit = 3;
    const orb = w.orbs()[0]!;
    enemy(w, 'TankEnemy', orb.x, orb.y, 2);
    const e = w.enemies[0]!;
    const hp = e.hp;
    w.step({ x: 0, y: 0 });
    expect(w.orbs()).toHaveLength(4);
    expect(e.hp).toBeLessThan(hp);
  });

  it('o raio acerta um inimigo da tela', () => {
    const w = new NhWorld('l');
    w.levels.lightning = 1;
    w.launchers.lightning.timer = 9;
    enemy(w, 'TankEnemy', 60, 60, 3);
    const hp = w.enemies[0]!.hp;
    w.step({ x: 0, y: 0 });
    expect(w.enemies[0]!.hp).toBeLessThan(hp);
    expect(w.drainEvents().some((e) => e.k === 'bolt')).toBe(true);
  });

  it('armadura reduz o dano (mínimo 1) e o amuleto aumenta a vida', () => {
    const w = new NhWorld('ar');
    w.levels.armor = 5;
    const hp = w.player.hp;
    (w as unknown as { hurtPlayer(n: number): void }).hurtPlayer(4);
    expect(w.player.hp).toBe(hp - 1);
    const v = new NhWorld('v');
    v.levels.heart = 0;
    v.choose = NhWorld.prototype.choose;
    v.pending = { kind: 'levelUp', options: ['heart'] };
    v.choose('heart');
    expect(v.player.maxHp).toBe(60);
  });

  it('o trevo pode abrir uma quarta opção', () => {
    let four = 0;
    for (let i = 0; i < 40; i++) {
      const w = new NhWorld('c' + i);
      w.levels.clover = 5;
      for (let k = 0; k < 10; k++)
        w.items.push({ uid: 800 + k, type: 'xp', x: 0, y: 0, attracted: false, speed: 0, born: 0 });
      w.step({ x: 0, y: 0 });
      if (w.pending?.options.length === 4) four++;
    }
    expect(four).toBeGreaterThan(5);
    expect(four).toBeLessThan(35);
  });

  it('os espaços são 6 armas e 6 passivos', () => {
    const w = new NhWorld('s');
    for (const u of ['weaponLength', 'horizontal', 'diagonal', 'halo', 'axe', 'orbit'] as const)
      w.levels[u] = 1;
    const avail = w.availableUpgrades();
    expect(avail).not.toContain('lightning');
    expect(avail).toContain('weaponDamage');
  });

  it('o baú evolui a arma quando ela está no máximo e o passivo certo está no inventário', () => {
    const w = new NhWorld('e');
    w.levels.halo = UPGRADE_MAX.halo;
    expect(w.availableEvolutions()).toEqual([]);
    w.levels.heart = 1;
    expect(w.availableEvolutions()).toEqual(['evoHalo']);
    w.items.push({ uid: 700, type: 'chest', x: 0, y: 0, attracted: false, speed: 0, born: 0 });
    w.step({ x: 0, y: 0 });
    expect(w.pending?.kind).toBe('chest');
    expect(w.pending?.options).toEqual(['evoHalo']);
    w.choose('evoHalo');
    expect(w.evolved.has('evoHalo')).toBe(true);
    expect(w.availableEvolutions()).toEqual([]);
    expect(w.result().evolutions).toEqual(['evoHalo']);
  });

  it('recusar o baú não muda nada e a evolução volta no próximo baú', () => {
    const w = new NhWorld('e');
    w.levels.halo = UPGRADE_MAX.halo;
    w.levels.heart = 1;
    w.items.push({ uid: 701, type: 'chest', x: 0, y: 0, attracted: false, speed: 0, born: 0 });
    w.step({ x: 0, y: 0 });
    expect(w.decline()).toBe(true);
    expect(w.pending).toBeNull();
    expect(w.evolved.size).toBe(0);
    expect(w.availableEvolutions()).toEqual(['evoHalo']);
    expect(w.decline()).toBe(false);
  });

  it('há uma evolução para cada arma e todo item evoluído tem descrição', () => {
    expect(EVOLUTIONS).toHaveLength(7);
    for (const e of EVOLUTIONS) {
      for (const m of e.maxed) expect(UPGRADE_IDS).toContain(m);
      expect(UPGRADE_IDS).toContain(e.passive);
    }
  });

  it('reroll, pular e banir gastam o que a partida dá', () => {
    const w = new NhWorld('r', { ...NO_META, reroll: 1, skip: 1, banish: 1 });
    expect([w.rerolls, w.skips, w.banishes]).toEqual([2, 2, 2]);
    for (let k = 0; k < 10; k++)
      w.items.push({ uid: 600 + k, type: 'xp', x: 0, y: 0, attracted: false, speed: 0, born: 0 });
    w.step({ x: 0, y: 0 });
    const before = [...w.pending!.options];
    expect(w.reroll()).toBe(true);
    expect(w.rerolls).toBe(1);
    expect(w.pending!.options).toHaveLength(before.length);
    const victim = w.pending!.options[0] as (typeof UPGRADE_IDS)[number];
    expect(w.banish(victim)).toBe(true);
    expect(w.pending!.options).not.toContain(victim);
    expect(w.availableUpgrades()).not.toContain(victim);
    const gold = w.gold;
    expect(w.skip()).toBe(true);
    expect(w.pending).toBeNull();
    expect(w.gold).toBe(gold + 5);
    expect([w.rerollsUsed, w.banishesUsed]).toEqual([1, 1]);
  });
});

describe('objetos quebráveis do cenário', () => {
  const walk = (w: NhWorld, n: number) => {
    for (let i = 0; i < n; i++) {
      w.player.hp = w.player.maxHp;
      w.step({ x: 1, y: 0 });
      w.drainEvents();
    }
  };
  it('nascem pelo hash da seed, iguais em duas partidas, e nunca no ponto de partida', () => {
    const a = new NhWorld('brk');
    const b = new NhWorld('brk');
    walk(a, 600);
    walk(b, 600);
    expect(a.breakables.length).toBeGreaterThan(3);
    expect(a.breakables.map((o) => [o.x, o.y, o.kind])).toEqual(
      b.breakables.map((o) => [o.x, o.y, o.kind]),
    );
    expect(a.breakables.every((o) => Math.hypot(o.x, o.y) >= 130)).toBe(true);
  });
  it('quebrar solta item e conta no resultado', () => {
    const w = new NhWorld('brk2');
    walk(w, 60);
    const o = w.breakables[0]!;
    const before = w.items.length;
    (w as unknown as { damageBreakable(b: unknown, d: number): void }).damageBreakable(o, 99);
    expect(w.items.length).toBeGreaterThan(before);
    expect(w.result().broken).toBe(1);
  });
  it('o ímã puxa todos os itens do mapa', () => {
    const w = new NhWorld('brk3');
    for (let i = 0; i < 5; i++)
      w.items.push({
        uid: 900 + i,
        type: 'xp',
        x: 2000 + i,
        y: 0,
        attracted: false,
        speed: 0,
        born: 0,
      });
    w.items.push({ uid: 950, type: 'magnet', x: 0, y: 0, attracted: false, speed: 0, born: 0 });
    w.step({ x: 0, y: 0 });
    expect(w.items.filter((i) => i.type === 'xp').every((i) => i.attracted)).toBe(true);
  });
});
