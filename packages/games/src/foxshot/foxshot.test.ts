import { describe, expect, it } from 'vitest';
import { fsDamage, fsKills, FS_HP, type FsHitInfo } from './damage';
import { FsLoadout } from './gun';
import { FS_ARENA } from './map';
import { fsNewMover, fsStepMover, FS_MOVE } from './movement';
import { fsFire, fsNewGunState } from './recoil';
import { fsDir, fsTrace, type FsBody } from './trace';
import { FS_WEAPONS } from './weapons';

const hit = (o: Partial<FsHitInfo>): FsHitInfo => ({ zone: 'chest', dist: 10, armor: 0, helmet: false, wall: 1, ...o });

describe('dano estilo CS', () => {
  const { ak, pistol, sniper } = FS_WEAPONS;

  it('fuzil: tiro na cabeça mata com ou sem capacete', () => {
    expect(fsKills(fsDamage(ak, hit({ zone: 'head' })))).toBe(true);
    expect(fsKills(fsDamage(ak, hit({ zone: 'head', armor: 100, helmet: true })))).toBe(true);
    expect(fsKills(fsDamage(ak, hit({ zone: 'head', dist: 40, armor: 100, helmet: true })))).toBe(true);
  });

  it('fuzil: no corpo precisa de vários tiros; o colete reduz o dano', () => {
    const bare = fsDamage(ak, hit({}));
    const vest = fsDamage(ak, hit({ armor: 100 }));
    expect(bare.hp).toBe(36);
    expect(vest.hp).toBeLessThan(bare.hp);
    expect(vest.armorLoss).toBeGreaterThan(0);
    expect(fsKills(bare)).toBe(false);
  });

  it('pistola: de perto sem capacete a cabeça mata; com capacete não mata', () => {
    expect(fsKills(fsDamage(pistol, hit({ zone: 'head', dist: 6 })))).toBe(true);
    expect(fsKills(fsDamage(pistol, hit({ zone: 'head', dist: 6, armor: 100, helmet: true })))).toBe(false);
  });

  it('pistola: o dano cai com a distância e de longe a cabeça não mata mais', () => {
    const near = fsDamage(pistol, hit({ zone: 'chest', dist: 5 })).hp;
    const far = fsDamage(pistol, hit({ zone: 'chest', dist: 40 })).hp;
    expect(far).toBeLessThan(near);
    expect(fsKills(fsDamage(pistol, hit({ zone: 'head', dist: 40 })))).toBe(false);
  });

  it('sniper: qualquer acerto direto mata (com colete, nas pernas, a qualquer distância)', () => {
    for (const zone of ['head', 'chest', 'belly', 'legs'] as const) {
      expect(fsKills(fsDamage(sniper, hit({ zone, dist: 60 })))).toBe(true);
      expect(fsKills(fsDamage(sniper, hit({ zone, dist: 60, armor: 100, helmet: true })))).toBe(true);
    }
  });

  it('sniper: o tiro varado (atravessou parede) não mata no corpo', () => {
    expect(fsKills(fsDamage(sniper, hit({ zone: 'chest', wall: 0.5 })))).toBe(false);
    expect(fsDamage(sniper, hit({ zone: 'chest', wall: 0.5 })).hp).toBeLessThan(FS_HP);
  });

  it('pernas nunca têm proteção de colete', () => {
    const d = fsDamage(ak, hit({ zone: 'legs', armor: 100, helmet: true }));
    expect(d.protectedByArmor).toBe(false);
  });
});

describe('recuo por arma', () => {
  const run = (id: 'ak' | 'pistol' | 'sniper', n: number) => {
    const g = fsNewGunState();
    const w = FS_WEAPONS[id];
    const out: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const s = fsFire(w, g, { moving: false, airborne: false, ads: false }, 'p1');
      g.since = 0.05;
      out.push([s.kickPitch, s.kickYaw]);
    }
    return out;
  };

  it('cada arma tem o seu padrão (o fuzil sobe e vai de lado, a pistola dá coices curtos)', () => {
    const ak = run('ak', 10);
    const pi = run('pistol', 4);
    expect(ak.reduce((a, s) => a + s[0], 0)).toBeGreaterThan(5);
    expect(new Set(ak.map((s) => s[1].toFixed(2))).size).toBeGreaterThan(5);
    expect(pi[0]![0]).toBeGreaterThan(ak[0]![0]);
    expect(run('sniper', 1)[0]![0]).toBeGreaterThan(pi[0]![0]);
  });

  it('o padrão volta ao primeiro tiro depois de uma pausa', () => {
    const g = fsNewGunState();
    const w = FS_WEAPONS.ak;
    const m = { moving: false, airborne: false, ads: false };
    const first = fsFire(w, g, m, 'p1');
    for (let i = 0; i < 6; i++) {
      g.since = 0.05;
      fsFire(w, g, m, 'p1');
    }
    g.since = 1;
    expect(fsFire(w, g, m, 'p1').kickPitch).toBe(first.kickPitch);
  });

  it('o desvio é o mesmo para quem usa a mesma semente (cliente e servidor concordam)', () => {
    const a = fsNewGunState();
    const b = fsNewGunState();
    const m = { moving: true, airborne: false, ads: false };
    const sa = fsFire(FS_WEAPONS.ak, a, m, 'ana');
    const sb = fsFire(FS_WEAPONS.ak, b, m, 'ana');
    expect(sa).toEqual(sb);
    expect(fsFire(FS_WEAPONS.ak, fsNewGunState(), m, 'bia')).not.toEqual(sa);
  });

  it('andando a dispersão é maior que parado; a sniper só é precisa mirando parada', () => {
    const stand = fsFire(FS_WEAPONS.sniper, fsNewGunState(), { moving: false, airborne: false, ads: true }, 'p');
    expect(Math.hypot(stand.devYaw, stand.devPitch)).toBe(0);
    const walk = fsFire(FS_WEAPONS.sniper, fsNewGunState(), { moving: true, airborne: false, ads: true }, 'p');
    expect(Math.hypot(walk.devYaw, walk.devPitch)).toBeGreaterThan(0);
  });
});

describe('raio do tiro', () => {
  const body = (x: number, z: number, armor = 0, helmet = false): FsBody => ({ id: 'alvo', pos: [x, 0, z], alive: true, armor, helmet });
  const eye: [number, number, number] = [0, 1.2, 14];

  it('acha o alvo à frente e a região certa (cabeça acima, pernas abaixo)', () => {
    const d = fsDir(0, 0); // para -Z
    const bodies = [body(0, 2)];
    const head = fsTrace(FS_WEAPONS.ak, [0, 1.17, 14], d, [], bodies);
    expect(head.kind).toBe('player');
    expect(head.zone).toBe('head');
    const legs = fsTrace(FS_WEAPONS.ak, [0, 0.3, 14], d, [], bodies);
    expect(legs.zone).toBe('legs');
    const miss = fsTrace(FS_WEAPONS.ak, eye, fsDir(10, 0), [], bodies);
    expect(miss.kind).not.toBe('player');
  });

  it('parede maciça para o tiro; madeira fina deixa passar com dano menor', () => {
    const wall = { min: [-2, 0, 8] as [number, number, number], max: [2, 3, 8.4] as [number, number, number], pen: 0, mat: 'wall' as const };
    const wood = { ...wall, pen: 0.5, mat: 'wood' as const };
    const d = fsDir(0, 0);
    expect(fsTrace(FS_WEAPONS.ak, [0, 1.0, 14], d, [wall], [body(0, 2)]).kind).toBe('world');
    const through = fsTrace(FS_WEAPONS.ak, [0, 1.0, 14], d, [wood], [body(0, 2)]);
    expect(through.kind).toBe('player');
    expect(through.wall).toBeCloseTo(0.5);
    const direct = fsTrace(FS_WEAPONS.ak, [0, 1.0, 14], d, [], [body(0, 2)]);
    expect(through.damage!.hp).toBeLessThan(direct.damage!.hp);
    // sniper atravessa mais; pistola menos
    const sn = fsTrace(FS_WEAPONS.sniper, [0, 1.0, 14], d, [wood], [body(0, 2)]);
    expect(sn.wall).toBeGreaterThan(through.wall);
  });

  it('o chão para o tiro', () => {
    const t = fsTrace(FS_WEAPONS.ak, [0, 1.2, 14], fsDir(0, -30), [], []);
    expect(t.kind).toBe('world');
    expect(t.point[1]).toBeCloseTo(0, 3);
  });
});

describe('movimento', () => {
  it('anda para a frente, para na parede e sobe degraus baixos', () => {
    const m = fsNewMover(0, 18);
    for (let i = 0; i < 400; i++) fsStepMover(m, { fwd: 1, strafe: 0, jump: false, yaw: 0, speedMul: 1 }, 1 / 120, FS_ARENA);
    // seguiu para -Z e parou no muro (pilar em z 6..7,4 está em x -1..0,4: não é o caminho)
    expect(m.z).toBeLessThan(18);
    for (let i = 0; i < 1200; i++) fsStepMover(m, { fwd: 1, strafe: 0, jump: false, yaw: 0, speedMul: 1 }, 1 / 120, FS_ARENA);
    expect(m.z).toBeGreaterThan(-20 + FS_MOVE.radius - 0.01);
  });

  it('o pulo sobe e volta ao chão', () => {
    const m = fsNewMover(5, 18);
    fsStepMover(m, { fwd: 0, strafe: 0, jump: true, yaw: 0, speedMul: 1 }, 1 / 120, FS_ARENA);
    let top = 0;
    for (let i = 0; i < 300; i++) {
      fsStepMover(m, { fwd: 0, strafe: 0, jump: false, yaw: 0, speedMul: 1 }, 1 / 120, FS_ARENA);
      top = Math.max(top, m.y);
    }
    expect(top).toBeGreaterThan(0.5);
    expect(m.onGround).toBe(true);
    expect(m.y).toBe(0);
  });

  it('não atravessa caixote alto', () => {
    const m = fsNewMover(-13, -4);
    // caixote em x -12..-10, z -8..-6 (1,2 m): vai para -Z em x = -11
    m.x = -11;
    m.z = -3;
    for (let i = 0; i < 500; i++) fsStepMover(m, { fwd: 1, strafe: 0, jump: false, yaw: 0, speedMul: 1 }, 1 / 120, FS_ARENA);
    expect(m.z).toBeGreaterThan(-6 + FS_MOVE.radius - 0.05);
  });
});

describe('arma na mão', () => {
  const idle = { moving: false, airborne: false, ads: false };

  it('o fuzil atira em rajada pela cadência e gasta munição; sem munição recarrega', () => {
    const l = new FsLoadout();
    l.drawT = 0;
    let shots = 0;
    for (let i = 0; i < 120; i++) shots += l.update(1 / 60, { trigger: true, reload: false }, idle, 'p').filter((e) => e.type === 'fire').length;
    // 2 s a 600 rpm = ~20 tiros
    expect(shots).toBeGreaterThanOrEqual(18);
    expect(shots).toBeLessThanOrEqual(21);
    expect(l.slot.ammo).toBe(30 - shots);
  });

  it('a pistola só atira um tiro por clique', () => {
    const l = new FsLoadout();
    l.switchTo(1);
    l.drawT = 0;
    let shots = 0;
    for (let i = 0; i < 60; i++) shots += l.update(1 / 60, { trigger: true, reload: false }, idle, 'p').filter((e) => e.type === 'fire').length;
    expect(shots).toBe(1);
  });

  it('a sniper tem o ferrolho: não atira de novo antes de 1,4 s', () => {
    const l = new FsLoadout();
    l.switchTo(2);
    l.drawT = 0;
    let shots = 0;
    for (let i = 0; i < 70; i++) {
      shots += l.update(1 / 60, { trigger: i % 2 === 0, reload: false }, idle, 'p').filter((e) => e.type === 'fire').length;
    }
    expect(shots).toBe(1);
  });

  it('recarregar leva o tempo da arma e enche o carregador', () => {
    const l = new FsLoadout();
    l.drawT = 0;
    for (let i = 0; i < 10; i++) l.update(1 / 60, { trigger: true, reload: false }, idle, 'p');
    expect(l.slot.ammo).toBeLessThan(30);
    l.update(1 / 60, { trigger: false, reload: true }, idle, 'p');
    expect(l.reloading).toBe(true);
    for (let i = 0; i < 160; i++) l.update(1 / 60, { trigger: false, reload: false }, idle, 'p');
    expect(l.reloading).toBe(false);
    expect(l.slot.ammo).toBe(30);
  });
});
