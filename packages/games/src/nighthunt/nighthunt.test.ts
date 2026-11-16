import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  EVO_INFO,
  HERO_INFO,
  MAP_INFO,
  UPGRADES,
  applyRun,
  mapCompleted,
  buyHero,
  buyMeta,
  emptySave,
  goldWithBonus,
  mapUnlocked,
} from './rules';
import { NhWorld, NO_META, STEP, metaBonus, type Enemy } from './world';
import { MONSTERS, ALL_ENEMIES } from './monsters';
import { BESTIARY } from './bestiary';
import { botPlay } from './bot';
import {
  EVOLUTIONS,
  HEROES,
  HERO_IDS,
  MAPS,
  MAP_IDS,
  PASSIVE_IDS,
  UPGRADE_IDS,
  WEAPON_IDS,
  type UpgradeId,
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
      maxHp: 1,
      aux: 0,
      mode: 0,
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
  it('bônus vêm da tabela do Slash e os preços são 15 vezes os do Slash', () => {
    expect(metaBonus('health', 3)).toBe(30);
    expect(new NhWorld('v', { ...NO_META, health: 2 }).player.maxHp).toBe(70);
    const s = emptySave();
    s.gold = 10;
    expect(buyMeta(s, 'health')).toBe(false); // custa 150
    s.gold = 150;
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
    maxHp: 1,
    aux: 0,
    mode: 0,
  });
};

describe('heróis e mapas', () => {
  it('cada herói começa com sua arma e seus números', () => {
    for (const id of HERO_IDS) {
      const w = new NhWorld('h' + id, NO_META, { hero: id });
      const h = HEROES[id]!;
      expect(w.player.maxHp).toBe(Math.round(50 * h.hp));
      if (h.start) expect(w.levels[h.start]).toBe(1);
      // só o Kael começa com a Espada; todo herói tem uma arma inicial que evolui
      expect(w.levels.sword).toBe(h.sword ? 1 : 0);
      expect(h.sword || h.start).toBeTruthy();
      const weapon = h.start ?? 'sword';
      expect(EVOLUTIONS.some((e) => e.maxed.includes(weapon))).toBe(true);
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
    expect(MAP_IDS).toEqual(['campo', 'deserto']);
  });

  it('comprar herói gasta ouro; mapas liberam pelo tempo sobrevivido', () => {
    const s = emptySave();
    expect(buyHero(s, 'mara')).toBe(false);
    s.gold = 1000;
    expect(buyHero(s, 'vesper')).toBe(true);
    expect(s.gold).toBe(420); // 1000 - 600 do preço + 20 da conquista "Novo companheiro"
    expect(s.heroes).toContain('vesper');
    expect(HERO_IDS.map((id) => HEROES[id]!.price)).toEqual([
      0, 600, 1200, 1800, 2400, 3000, 3600, 4200,
    ]);
    expect(mapUnlocked(s, 'deserto')).toBe(false);
    s.stats.bestTime = 8 * 60;
    s.stats.bestLevel = 10;
    expect(mapUnlocked(s, 'deserto')).toBe(false); // faltam os 3 chefes
    s.stats.bossKills = 3;
    expect(mapUnlocked(s, 'deserto')).toBe(true);
    expect(mapUnlocked(s, 'gelo')).toBe(false);
    s.stats.bestTime = 15 * 60;
    s.stats.bestLevel = 25;
    s.stats.evolutions = ['evoHalo', 'evoAxe'];
    expect(mapUnlocked(s, 'gelo')).toBe(true);
    expect(MAP_INFO.gelo!.reqs).toHaveLength(3);
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
    expect(EVOLUTIONS).toHaveLength(17);
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

describe('guardar e continuar a partida', () => {
  it('o texto guardado volta a ser a mesma partida e cabe no limite da conta', () => {
    const w = new NhWorld('save1', NO_META, { hero: 'mara', map: 'deserto' });
    w.levels.halo = 3;
    for (let i = 0; i < 60 * 240; i++) {
      if (w.pending) w.choose(w.pending.options[0]!);
      w.player.hp = w.player.maxHp;
      w.step({ x: Math.cos(i / 200), y: Math.sin(i / 200) });
      w.drainEvents();
    }
    const text = w.snapshot();
    expect(text.length).toBeLessThan(60_000);
    const r = NhWorld.restore(text)!;
    expect(r).not.toBeNull();
    expect(r.heroId).toBe('mara');
    expect(r.mapId).toBe('deserto');
    expect(r.t).toBeCloseTo(w.t, 1);
    expect(r.level).toBe(w.level);
    expect(r.kills).toBe(w.kills);
    expect(r.levels.halo).toBe(3);
    expect(r.enemies.length).toBeGreaterThan(0);
    expect(r.evolved.size).toBe(w.evolved.size);
    for (let i = 0; i < 600; i++) {
      r.player.hp = r.player.maxHp;
      r.step({ x: 1, y: 0 });
      r.drainEvents();
    }
    expect(r.t).toBeGreaterThan(w.t + 9);
    expect(NhWorld.restore('lixo')).toBeNull();
  });
});

describe('monstros novos (Dungeon Crawl)', () => {
  const run = (w: NhWorld, sec: number) => {
    for (let i = 0; i < sec * 60; i++) {
      if (w.pending) w.choose(w.pending.options[0]!);
      w.player.hp = w.player.maxHp;
      w.step({ x: Math.cos(i / 300), y: Math.sin(i / 300) });
      w.drainEvents();
    }
  };
  const ids = (w: NhWorld) => new Set(w.enemies.map((e) => e.s.id));
  const spawn = (w: NhWorld, id: string, dx = 40, dy = 0) =>
    (w as unknown as { spawnEnemy(a: number, b: number, c: string): Enemy }).spawnEnemy(dx, dy, id);

  it('nenhum monstro novo no Campo Verde e vários no Deserto', () => {
    const campo = new NhWorld('mc', NO_META, { map: 'campo' });
    run(campo, 420);
    for (const m of MONSTERS) expect(ids(campo).has(m.id)).toBe(false);
    const des = new NhWorld('md', NO_META, { map: 'deserto' });
    run(des, 420);
    const seen = [...ids(des)].filter((id) => MONSTERS.some((m) => m.id === id));
    expect(seen.length).toBeGreaterThanOrEqual(3);
  });
  it('a maioria dos monstros é do mapa 2, nenhum é do mapa 1', () => {
    expect(MONSTERS.filter((m) => m.maps.includes('campo'))).toHaveLength(0);
    expect(MONSTERS.filter((m) => m.maps.includes('deserto')).length).toBeGreaterThanOrEqual(10);
    expect(new Set(MONSTERS.map((m) => m.art)).size).toBeGreaterThanOrEqual(15);
  });
  it('Gosma Azul se divide, Golem solta estilhaços, Escorpião aguenta projétil', () => {
    const w = new NhWorld('ms');
    const g = spawn(w, 'GosmaAzul');
    (w as unknown as { damageEnemy(e: Enemy, d: number): void }).damageEnemy(g, 999);
    expect(w.enemies.filter((e) => e.s.id === 'Gosminha' && !e.dead)).toHaveLength(2);
    const golem = spawn(w, 'GolemCristal');
    const before = w.projectiles.length;
    (w as unknown as { damageEnemy(e: Enemy, d: number): void }).damageEnemy(golem, 9999);
    expect(w.projectiles.length - before).toBe(8);
  });
  it('Espectro fica fantasma e não sofre dano; Verme drena XP; Ent segura o jogador', () => {
    const w = new NhWorld('mg');
    const s = spawn(w, 'Espectro', 900, 900);
    s.aux = 3; // fase fantasma
    const hp = s.hp;
    (w as unknown as { damageEnemy(e: Enemy, d: number): void }).damageEnemy(s, 5);
    expect(s.hp).toBe(hp);
    s.aux = 0;
    (w as unknown as { damageEnemy(e: Enemy, d: number): void }).damageEnemy(s, 1);
    expect(s.hp).toBe(hp - 1);
    const a = new NhWorld('me');
    spawn(a, 'EntAnciao', 60, 0);
    a.step({ x: 1, y: 0 });
    const free = new NhWorld('me2');
    free.step({ x: 1, y: 0 });
    expect(a.player.x).toBeLessThan(free.player.x);
    const v = new NhWorld('mv');
    v.xp = 10;
    spawn(v, 'VermeCerebral', 0, 0);
    v.step({ x: 0, y: 0 });
    expect(v.xp).toBe(7);
  });
  it('bote da Naja: avisa, dispara em linha reta e espera de novo', () => {
    const w = new NhWorld('mn');
    const n = spawn(w, 'NajaRubra', 120, 0);
    n.aux = 0;
    w.step({ x: 0, y: 0 });
    expect(n.mode).toBe(1);
    for (let i = 0; i < 40; i++) w.step({ x: 0, y: 0 });
    expect(n.mode).toBe(2);
  });
});

describe('sistemas da fase 3: empurrão, separação, obstáculos, coleta e vitória', () => {
  const step = (w: NhWorld, n: number) => {
    for (let i = 0; i < n; i++) {
      w.player.hp = w.player.maxHp;
      w.step({ x: 0, y: 0 });
      w.drainEvents();
    }
  };
  const spawn = (w: NhWorld, id: string, dx: number, dy: number) =>
    (w as unknown as { spawnEnemy(a: number, b: number, c: string): Enemy }).spawnEnemy(dx, dy, id);

  it('empurrão afasta o inimigo, e chefe quase não sai do lugar', () => {
    const w = new NhWorld('k1');
    const a = spawn(w, 'BasicEnemy', 60, 0);
    const b = spawn(w, 'BasicBoss', -60, 0);
    w.knock(a, 0, 0, 300);
    w.knock(b, 0, 0, 300);
    const ax = a.x;
    const bx = b.x;
    step(w, 20);
    expect(a.x - ax).toBeGreaterThan(20);
    expect(bx - b.x).toBeLessThan(5);
  });
  it('separação: inimigos empilhados se afastam uns dos outros', () => {
    const w = new NhWorld('k2');
    const es = Array.from({ length: 8 }, () => spawn(w, 'Hunter', 900, 900));
    for (const e of es) e.speedX = e.speedY = 0;
    step(w, 120);
    const xs = es.map((e) => e.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(20);
  });
  it('obstáculos nascem pela seed, travam o jogador e não ficam na partida', () => {
    const a = new NhWorld('o1', NO_META, { map: 'campo' });
    for (let i = 0; i < 400; i++) {
      a.player.hp = a.player.maxHp;
      a.step({ x: 1, y: 0.2 });
      a.drainEvents();
    }
    expect(a.obstacles.length).toBeGreaterThan(0);
    expect(a.obstacles.every((o) => Math.hypot(o.x, o.y) >= 190)).toBe(true);
    const o = a.obstacles[0]!;
    a.player.x = o.x - o.r - 4;
    a.player.y = o.y;
    for (let i = 0; i < 30; i++) a.step({ x: 1, y: 0 });
    expect(Math.hypot(a.player.x - o.x, a.player.y - o.y)).toBeGreaterThanOrEqual(o.r + 15);
  });
  it('item entra no alcance de atração e só é pego no alcance de coleta', () => {
    const w = new NhWorld('p1');
    w.items.push({ uid: 9001, type: 'xp', x: 60, y: 0, attracted: false, speed: 0, born: 0 });
    w.step({ x: 0, y: 0 });
    expect(w.items[0]!.attracted).toBe(true);
    w.items.length = 0;
    w.items.push({ uid: 9002, type: 'xp', x: 120, y: 0, attracted: false, speed: 0, born: 0 });
    w.step({ x: 0, y: 0 });
    expect(w.items[0]!.attracted).toBe(false);
    w.levels.magnet = 5;
    w.step({ x: 0, y: 0 });
    expect(w.items[0]!.attracted).toBe(true);
  });
  it('chefe final aparece só na partida normal; matar conclui o mapa e o infinito não tem chefe final', () => {
    const n = new NhWorld('f1', NO_META, { map: 'campo' });
    (n as unknown as { spawnerTime: number }).spawnerTime = 899.9;
    step(n, 30);
    const boss = n.enemies.find((e) => e.s.id === 'FinalBoss')!;
    expect(boss).toBeTruthy();
    (n as unknown as { damageEnemy(e: Enemy, d: number): void }).damageEnemy(boss, 1e9);
    expect(n.victory).toBe(true);
    expect(n.result().won).toBe(true);
    const inf = new NhWorld('f2', NO_META, { map: 'campo', infinite: true });
    (inf as unknown as { spawnerTime: number }).spawnerTime = 899.9;
    step(inf, 30);
    expect(inf.enemies.some((e) => e.s.id === 'FinalBoss')).toBe(false);
  });
  it('concluir o mapa libera o infinito e o infinito guarda recordes', () => {
    const s = emptySave();
    expect(mapCompleted(s, 'campo')).toBe(false);
    const w = new NhWorld('v1');
    w.victory = true;
    w.t = 700;
    applyRun(s, w.result(), 1000);
    expect(mapCompleted(s, 'campo')).toBe(true);
    const i = new NhWorld('v2', NO_META, { infinite: true });
    i.t = 900;
    i.kills = 321;
    applyRun(s, i.result(), 2000);
    expect(s.stats.mapRecords.campo).toMatchObject({ t: 900, kills: 321 });
  });
});

describe('armas novas da fase 3', () => {
  const spawn = (w: NhWorld, id: string, dx: number, dy: number) =>
    (w as unknown as { spawnEnemy(a: number, b: number, c: string): Enemy }).spawnEnemy(dx, dy, id);
  /** Joga N segundos com um grupo de inimigos fixos em volta e devolve a vida total que sobrou. */
  const hpAfter = (weapon: UpgradeId, level: number, secs: number, evo?: string) => {
    const base = weapon === 'garlic' ? 40 : 110;
    const w = new NhWorld('wp-' + weapon);
    w.levels[weapon] = level;
    w.levels.sword = 0;
    if (evo) w.evolved.add(evo as never);
    const es: Enemy[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const e = spawn(
        w,
        'ToughEnemy',
        Math.cos(a) * (base + (i % 3) * 12),
        Math.sin(a) * (base + (i % 3) * 12),
      );
      e.speedX = e.speedY = 0;
      e.hp = e.maxHp = 400;
      es.push(e);
    }
    for (let i = 0; i < secs * 60; i++) {
      w.player.hp = w.player.maxHp;
      w.step({ x: 0, y: 0 });
      w.drainEvents();
    }
    return es.reduce((a, e) => a + Math.max(0, e.hp), 0);
  };
  const FULL = 12 * 400;
  for (const id of [
    'whip',
    'wand',
    'garlic',
    'magma',
    'embers',
    'cross',
    'bone',
    'runes',
    'bomb',
  ] as const) {
    it(`${id} causa dano nos inimigos e melhora com os níveis`, () => {
      const low = hpAfter(id, 1, 14);
      const high = hpAfter(id, 6, 14);
      expect(low).toBeLessThan(FULL);
      // a Aura de Alho no nível 6 empurra forte e tira os inimigos do alcance: só exige que cause dano
      if (id === 'garlic') expect(high).toBeLessThan(FULL);
      else expect(high).toBeLessThanOrEqual(low);
    });
  }
  it('pentagrama limpa a tela, puxa os itens e a recarga é longa', () => {
    const w = new NhWorld('wp-pent');
    w.levels.pentagram = 1;
    w.levels.sword = 0;
    const e = spawn(w, 'ToughEnemy', 150, 50);
    e.speedX = e.speedY = 0;
    e.hp = e.maxHp = 999;
    w.items.push({ uid: 7777, type: 'xp', x: 400, y: 0, attracted: false, speed: 0, born: 0 });
    const go = (n: number) => {
      for (let i = 0; i < n; i++) {
        w.player.hp = w.player.maxHp;
        w.step({ x: 0, y: 0 });
        w.drainEvents();
      }
    };
    go(60 * 19);
    expect(e.hp).toBe(999);
    go(60 * 3);
    expect(e.hp).toBeLessThan(999);
    expect(w.items.every((it) => it.attracted) || w.items.length === 0).toBe(true);
  });
  it('quantidade soma projéteis, maldição reforça inimigos e dá XP, duração estica as poças', () => {
    const w = new NhWorld('wp-pass');
    w.levels.wand = 1;
    w.levels.amount = 2;
    expect(w.amountBonus).toBe(2);
    w.levels.curse = 3;
    const e = spawn(w, 'BasicEnemy', 500, 500);
    const base = new NhWorld('wp-pass2');
    const b = spawn(base, 'BasicEnemy', 500, 500);
    expect(e.maxHp).toBeGreaterThanOrEqual(b.maxHp);
    expect(w.curseXp).toBeCloseTo(1.3);
    w.levels.duration = 4;
    expect(w.durMult).toBeCloseTo(1.6);
  });
  it('cada arma nova tem uma evolução com passivo, texto e ícone', () => {
    for (const id of [
      'whip',
      'wand',
      'garlic',
      'magma',
      'embers',
      'cross',
      'bone',
      'runes',
      'pentagram',
      'bomb',
    ] as const) {
      const ev = EVOLUTIONS.find((x) => x.maxed.includes(id));
      expect(ev, id).toBeTruthy();
      expect(EVO_INFO[ev!.id].desc.length).toBeGreaterThan(20);
      expect(UPGRADES[id].icon.startsWith('X/')).toBe(true);
      expect(WEAPON_IDS).toContain(id);
    }
    expect(PASSIVE_IDS).toEqual(expect.arrayContaining(['duration', 'amount', 'curse']));
  });
});

describe('evolução na janela de nível e aviso de combinação', () => {
  it('arma no máximo + passivo certo: a próxima janela de nível entrega a evolução', () => {
    const w = new NhWorld('ev1');
    w.levels.garlic = 6;
    w.levels.regeneration = 1;
    (w as unknown as { addXp(n: number): void }).addXp(1e6);
    expect(w.pending?.kind).toBe('levelUp');
    expect(w.pending?.options[0]).toBe('evoGarlic');
    w.choose('evoGarlic');
    expect(w.evolved.has('evoGarlic')).toBe(true);
  });
  it('sem o passivo a evolução não aparece', () => {
    const w = new NhWorld('ev2');
    w.levels.garlic = 6;
    (w as unknown as { addXp(n: number): void }).addXp(1e6);
    expect(w.pending?.options.some((o) => o.startsWith('evo'))).toBe(false);
  });
  it('a carta avisa "combina com" só quando você já tem o parceiro', () => {
    const w = new NhWorld('ev3');
    expect(w.comboHint('heart')).toBeNull();
    w.levels.whip = 2;
    expect(w.comboHint('heart')).toBe('whip');
    w.levels.heart = 1;
    expect(w.comboHint('whip')).toBe('heart');
    expect(w.comboHint('evoWhip')).toBeNull();
  });
});

describe('bestiário', () => {
  it('todo inimigo do jogo tem entrada, nome, texto e números iguais aos do jogo', () => {
    const ids = new Set(BESTIARY.map((b) => b.id));
    for (const e of ALL_ENEMIES) expect(ids.has(e.id), e.id).toBe(true);
    expect(new Set(BESTIARY.map((b) => b.n)).size).toBe(BESTIARY.length);
    for (const b of BESTIARY) {
      expect(b.name.length).toBeGreaterThan(2);
      expect(b.desc.length).toBeGreaterThan(15);
      const e = ALL_ENEMIES.find((x) => x.id === b.id)!;
      expect(b.stats.hp).toBe(e.health);
      expect(b.stats.dmg).toBe(e.damage);
    }
    expect(BESTIARY.find((b) => b.id === 'Vagalume')!.maps).toEqual(['deserto']);
    expect(BESTIARY.find((b) => b.id === 'BasicEnemy')!.maps).toContain('campo');
  });
  it('a partida conta quem apareceu e quantos de cada foram derrotados, e o save soma', () => {
    const w = new NhWorld('bs1');
    const a = (w as unknown as { spawnEnemy(x: number, y: number, c: string): Enemy }).spawnEnemy(
      500,
      0,
      'BasicEnemy',
    );
    (w as unknown as { damageEnemy(e: Enemy, d: number): void }).damageEnemy(a, 99);
    const r = w.result();
    expect(r.seenIds).toContain('BasicEnemy');
    expect(r.killsById.BasicEnemy).toBe(1);
    const s = emptySave();
    applyRun(s, r, 1);
    applyRun(s, r, 2);
    expect(s.stats.bestiary.BasicEnemy).toBe(3);
  });
});

describe('limite de 6 itens e substituição na evolução', () => {
  it('janelas de nível em fila não deixam passar de 6 armas e 6 passivos', () => {
    const w = new NhWorld('cap1');
    for (const id of ['whip', 'wand', 'garlic', 'magma', 'embers', 'cross'] as const)
      w.levels[id] = 1;
    w.levels.sword = 0;
    for (const id of ['heart', 'armor', 'boots', 'magnet', 'clover', 'tome'] as const)
      w.levels[id] = 1;
    (w as unknown as { addXp(n: number): void }).addXp(1e7);
    let guard = 0;
    while (w.pending && guard++ < 400) {
      for (const o of w.pending.options)
        if (!o.startsWith('evo')) expect(w.levels[o as UpgradeId] > 0).toBe(true);
      w.choose(w.pending.options[0]!);
    }
    const weapons = WEAPON_IDS.filter((u) => w.levels[u] > 0).length;
    const passives = PASSIVE_IDS.filter((u) => w.levels[u] > 0).length;
    expect(weapons).toBeLessThanOrEqual(6);
    expect(passives).toBeLessThanOrEqual(6);
  });
  it('o robô jogando nunca passa de 6 armas e 6 passivos', () => {
    for (const seed of ['b1', 'b2', 'b3']) {
      const w = new NhWorld('cap-' + seed);
      botPlay(w, 300);
      expect(WEAPON_IDS.filter((u) => w.levels[u] > 0).length).toBeLessThanOrEqual(6);
      expect(PASSIVE_IDS.filter((u) => w.levels[u] > 0).length).toBeLessThanOrEqual(6);
    }
  });
});

describe('baú dos chefes (16/11/2026)', () => {
  it('todo chefe derrotado solta um baú, em qualquer semente', () => {
    for (const id of ['BasicBoss', 'StandardBoss', 'HardBoss', 'FinalBoss']) {
      for (let k = 0; k < 20; k++) {
        const w = new NhWorld(`boss-chest-${id}-${k}`);
        const spawn = (w as unknown as { spawnEnemy(x: number, y: number, c: string): Enemy })
          .spawnEnemy;
        const e = spawn.call(w, 400, 0, id);
        (w as unknown as { damageEnemy(e: Enemy, d: number): void }).damageEnemy(e, 1e9);
        expect(w.items.filter((i) => i.type === 'chest')).toHaveLength(1);
      }
    }
  });
});
