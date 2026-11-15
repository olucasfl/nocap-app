import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, UPGRADES, applyRun, buyMeta, emptySave, goldWithBonus } from './rules';
import { NhWorld, NO_META, STEP, metaBonus } from './world';
import { swordAngleDeg } from './data';
import { overlaps } from './geometry';
import { ENEMIES, PLAYER_SETTINGS } from './settings';

const run = (w: NhWorld, seconds: number, input = { x: 0, y: 0 }) => {
  for (let i = 0; i < Math.round(seconds / STEP) && w.alive; i++) {
    if (w.pending) w.choose(w.pending.options[0]!);
    w.step(input);
  }
};
const snapshot = (w: NhWorld) => JSON.stringify([w.t, w.player, w.enemies.map((e) => [e.x, e.y, e.hp]), w.items.length, w.kills, w.level]);

describe('geometria', () => {
  it('caixa girada encosta onde a caixa alinhada não encosta', () => {
    const a = { kind: 'box' as const, cx: 0, cy: 0, w: 100, h: 10, rot: Math.PI / 4 };
    const b = { kind: 'box' as const, cx: 30, cy: 30, w: 10, h: 10 };
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps({ ...a, rot: 0 }, b)).toBe(false);
  });
  it('círculo e caixa', () => {
    expect(overlaps({ kind: 'circle', cx: 0, cy: 0, r: 5 }, { kind: 'box', cx: 9, cy: 0, w: 10, h: 10 })).toBe(true);
    expect(overlaps({ kind: 'circle', cx: 0, cy: 0, r: 5 }, { kind: 'box', cx: 12, cy: 0, w: 10, h: 10 })).toBe(false);
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
    for (let i = 0; i < 10; i++) w.items.push({ uid: 900 + i, type: 'xp', x: 0, y: 0, attracted: false, speed: 0, born: 0 });
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
    expect(w.levels[opt]).toBe(1);
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
    w.enemies.push({ uid: 5000, s: e, x: 70, y: 4, hp: 4, speedX: 0, speedY: 0, life: -1, faceX: 1, flash: 0, follow: true, stateLeft: 0, dirX: 0, dirY: 0, shootTimer: 0, dead: false });
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
    w.level = 6;
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
