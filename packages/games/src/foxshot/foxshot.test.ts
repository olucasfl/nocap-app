import { describe, expect, it } from 'vitest';
import { fsDamage, fsKills, FS_HP, type FsHitInfo } from './damage';
import { FsLoadout } from './gun';
import { FS_SHOP, fsBuy } from './shop';
import { FS_ARENA } from './map';
import { fsBodyHeight, fsEyeHeight, fsNewMover, fsQuiet, fsStepMover, FS_MOVE } from './movement';
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
    const l = new FsLoadout('sniper', 'pistol');
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

describe('três armas: primária, secundária e faca', () => {
  const idle = { moving: false, airborne: false, ads: false };

  it('começa com fuzil, pistola e faca; a faca é o espaço 3 e nunca sai', () => {
    const l = new FsLoadout();
    expect(l.slots.map((s) => s?.id)).toEqual(['ak', 'pistol', 'knife']);
    expect(l.drop(2)).toBeNull();
    expect(l.slots[2]?.id).toBe('knife');
  });

  it('a faca corta com o botão de atirar e estoca com o de mirar (mais dano, mais espera)', () => {
    const l = new FsLoadout();
    l.switchTo(2);
    l.drawT = 0;
    const a = l.update(0.016, { trigger: true, reload: false }, idle, 'p');
    expect(a).toEqual([expect.objectContaining({ type: 'melee', kind: 'slash' })]);
    // não corta de novo enquanto espera
    expect(l.update(0.016, { trigger: false, reload: false }, idle, 'p')).toEqual([]);
    l.cooldown = 0;
    const b = l.update(0.016, { trigger: false, reload: false, alt: true }, idle, 'p');
    expect(b).toEqual([expect.objectContaining({ type: 'melee', kind: 'stab' })]);
    expect(l.cooldown).toBeGreaterThan(0.9);
    expect(FS_WEAPONS.knife.melee!.stab).toBeGreaterThan(FS_WEAPONS.knife.damage);
  });

  it('F inspeciona a faca parada e qualquer ataque ou troca interrompe', () => {
    const l = new FsLoadout();
    l.switchTo(2);
    l.drawT = 0;
    const ev = l.update(0.016, { trigger: false, reload: false, inspect: true }, idle, 'p');
    expect(ev[0]).toMatchObject({ type: 'inspect' });
    expect(l.inspecting).toBe(true);
    l.update(0.016, { trigger: true, reload: false }, idle, 'p');
    expect(l.inspecting).toBe(false);
  });

  it('comprar uma arma do mesmo espaço troca e devolve a antiga (para cair no chão)', () => {
    const l = new FsLoadout();
    const r = fsBuy(l, 'sniper');
    expect(r.ok).toBe(true);
    expect(r.dropped?.id).toBe('ak');
    expect(l.slots[0]?.id).toBe('sniper');
    expect(l.weapon.id).toBe('sniper');
    // pistola nova no espaço 2 não mexe na primária
    expect(l.slots[0]?.id).toBe('sniper');
    // comprar de novo a mesma arma só enche o carregador (nada cai no chão)
    l.slots[1]!.ammo = 1;
    const again = fsBuy(l, 'pistol');
    expect(again.ok).toBe(true);
    expect(again.dropped).toBeUndefined();
    expect(l.slots[1]!.ammo).toBe(FS_WEAPONS.pistol.mag);
  });

  it('item "em breve" não compra e o colete vira armadura', () => {
    const l = new FsLoadout();
    expect(fsBuy(l, 'smg1')).toMatchObject({ ok: false, reason: 'soon' });
    expect(fsBuy(l, 'vesthelm').armor).toEqual({ points: 100, helmet: true });
    expect(fsBuy(l, 'xxx')).toMatchObject({ ok: false, reason: 'unknown' });
  });

  it('soltar a primária leva para a secundária', () => {
    const l = new FsLoadout();
    const d = l.drop(0);
    expect(d?.id).toBe('ak');
    expect(l.slots[0]).toBeNull();
    expect(l.weapon.id).toBe('pistol');
    expect(l.switchTo(0)).toEqual([]);
  });

  it('a loja tem 5 colunas e só itens reais podem ser comprados', () => {
    expect(FS_SHOP).toHaveLength(5);
    const real = FS_SHOP.flatMap((c) => c.items).filter((i) => !i.soon);
    expect(real.map((i) => i.id).sort()).toEqual(['ak', 'knife', 'pistol', 'sniper', 'vest', 'vesthelm']);
  });
});

describe('agachar e andar devagar', () => {
  const run = (inp: Partial<Parameters<typeof fsStepMover>[1]>, secs = 1.5) => {
    const m = fsNewMover(5, 18);
    for (let i = 0; i < secs * 120; i++) fsStepMover(m, { fwd: 1, strafe: 0, jump: false, yaw: 0, speedMul: 1, ...inp }, 1 / 120, FS_ARENA);
    return m;
  };

  it('Ctrl agacha: o corpo e os olhos descem e a velocidade cai', () => {
    const m = run({ crouch: true });
    expect(m.crouchK).toBe(1);
    expect(fsBodyHeight(m)).toBeCloseTo(FS_MOVE.crouchHeight);
    expect(fsEyeHeight(m)).toBeCloseTo(FS_MOVE.crouchEye);
    const stand = run({});
    expect(Math.hypot(m.vx, m.vz)).toBeLessThan(Math.hypot(stand.vx, stand.vz) * 0.6);
  });

  it('Shift anda mais devagar e sem barulho', () => {
    const walk = run({ walk: true });
    const stand = run({});
    expect(Math.hypot(walk.vx, walk.vz)).toBeCloseTo(Math.hypot(stand.vx, stand.vz) * FS_MOVE.walkMul, 0);
    expect(fsQuiet({ walk: true })).toBe(true);
    expect(fsQuiet({ crouch: true })).toBe(true);
    expect(fsQuiet({})).toBe(false);
  });

  it('não levanta com um teto baixo em cima', () => {
    const m = fsNewMover(0, 0);
    m.crouchK = 1;
    const low = [{ min: [-2, 1.0, -2] as [number, number, number], max: [2, 2, 2] as [number, number, number], pen: 0, mat: 'wall' as const }];
    for (let i = 0; i < 100; i++) fsStepMover(m, { fwd: 0, strafe: 0, jump: false, yaw: 0, speedMul: 1, crouch: true }, 1 / 120, low);
    for (let i = 0; i < 100; i++) fsStepMover(m, { fwd: 0, strafe: 0, jump: false, yaw: 0, speedMul: 1, crouch: false }, 1 / 120, low);
    expect(m.crouchK).toBeGreaterThan(0.5);
  });
});
