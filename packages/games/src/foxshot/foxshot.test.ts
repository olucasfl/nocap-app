import { createRng } from '../core/rng';
import { describe, expect, it } from 'vitest';
import { fsDamage, fsIsBackstab, fsKills, FS_HP, type FsHitInfo } from './damage';
import { FsLoadout } from './gun';
import { FS_SHOP, fsBuy } from './shop';
import { FS_ARENA, FS_ARENA_HALF, FS_MOVE_SIGNS, FS_SPAWN, FS_TARGETS, FS_TRAIN_AREAS, FS_TRAIN_GALLERY, type FsBox } from './map';

/** Sala simples para os testes de movimento: paredes a 20 m e um caixote de 1,2 m. */
const wallBox = (x0: number, z0: number, x1: number, z1: number, h = 4, pen = 0): FsBox => ({ min: [x0, 0, z0], max: [x1, h, z1], pen, mat: 'wall' });
const ROOM: readonly FsBox[] = [wallBox(-20.5, -20.5, 20.5, -20), wallBox(-20.5, 20, 20.5, 20.5), wallBox(-20.5, -20, -20, 20), wallBox(20, -20, 20.5, 20), { min: [-12, 0, -8], max: [-10, 1.2, -6], pen: 0.5, mat: 'crate' }];
import { fsBodyHeight, fsEyeHeight, fsNewMover, fsQuiet, fsStepMover, FS_MOVE } from './movement';
import { fsFire, fsNewGunState, fsSpreadDeg } from './recoil';
import { fsDir, fsTrace, type FsBody } from './trace';
import { FS_HEAR_RANGE, FS_WEAPONS } from './weapons';
import { FS_BOTS, fsBotStep, fsNewBot, fsNewRange, fsRangeStep } from './bots';
import { fsAssister } from './assist';
import { FS_GRENADES, fsClearLine, fsFlashEffect, fsFragDamage, fsGrenadeLaunch, fsGrenadeStep, fsThrowPower } from './grenades';

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
    for (let i = 0; i < 400; i++) fsStepMover(m, { fwd: 1, strafe: 0, jump: false, yaw: 0, speedMul: 1 }, 1 / 120, ROOM);
    // seguiu para -Z e parou no muro (pilar em z 6..7,4 está em x -1..0,4: não é o caminho)
    expect(m.z).toBeLessThan(18);
    for (let i = 0; i < 1200; i++) fsStepMover(m, { fwd: 1, strafe: 0, jump: false, yaw: 0, speedMul: 1 }, 1 / 120, ROOM);
    expect(m.z).toBeGreaterThan(-20 + FS_MOVE.radius - 0.01);
  });

  it('o pulo sobe e volta ao chão', () => {
    const m = fsNewMover(5, 18);
    fsStepMover(m, { fwd: 0, strafe: 0, jump: true, yaw: 0, speedMul: 1 }, 1 / 120, ROOM);
    let top = 0;
    for (let i = 0; i < 300; i++) {
      fsStepMover(m, { fwd: 0, strafe: 0, jump: false, yaw: 0, speedMul: 1 }, 1 / 120, ROOM);
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
    for (let i = 0; i < 500; i++) fsStepMover(m, { fwd: 1, strafe: 0, jump: false, yaw: 0, speedMul: 1 }, 1 / 120, ROOM);
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

describe('agachado: o corpo desce junto', () => {
  const w = FS_WEAPONS.ak;
  const body = (crouch: number): FsBody => ({ id: 'b', pos: [0, 0, -10], alive: true, armor: 0, helmet: false, crouch });
  it('tiro na altura da cabeça de pé passa por cima de quem está agachado; na cabeça nova acerta', () => {
    const standingHead: [number, number, number] = [0, 1.17, 0];
    const dir = fsDir(0, 0);
    expect(fsTrace(w, standingHead, dir, [], [body(0)]).kind).toBe('player');
    expect(fsTrace(w, standingHead, dir, [], [body(1)]).kind).toBe('none');
    const crouchHead: [number, number, number] = [0, 1.17 * (0.95 / 1.3), 0];
    const t = fsTrace(w, crouchHead, dir, [], [body(1)]);
    expect(t.zone).toBe('head');
  });
});

describe('arma vazia', () => {
  it('segurando o gatilho faz o clique sozinho (uma vez); clicar de novo recarrega', () => {
    const l = new FsLoadout('ak', 'pistol');
    l.drawT = 0;
    l.slot.ammo = 0;
    const mv = { moving: false, airborne: false, ads: false };
    const types = (ev: ReturnType<FsLoadout['update']>) => ev.map((e) => e.type);
    // segura o gatilho: clique de vazio na hora, sem apertar de novo
    expect(types(l.update(0.016, { trigger: true, reload: false }, mv, 'p'))).toEqual(['dry']);
    // continua segurando: não repete o clique nem recarrega
    for (let i = 0; i < 60; i++) expect(types(l.update(0.016, { trigger: true, reload: false }, mv, 'p'))).toEqual([]);
    expect(l.reloading).toBe(false);
    // solta e clica de novo: só recarrega (sem outro clique de vazio)
    l.update(0.016, { trigger: false, reload: false }, mv, 'p');
    expect(types(l.update(0.016, { trigger: true, reload: false }, mv, 'p'))).toEqual(['reload']);
    expect(l.reloading).toBe(true);
  });
  it('quando o último tiro sai com o gatilho segurado, o clique de vazio vem logo depois', () => {
    const l = new FsLoadout('ak', 'pistol');
    l.drawT = 0;
    l.slot.ammo = 1;
    const mv = { moving: false, airborne: false, ads: false };
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) for (const e of l.update(0.016, { trigger: true, reload: false }, mv, 'p')) seen.push(e.type);
    expect(seen.slice(0, 2)).toEqual(['fire', 'dry']);
    expect(seen.filter((x) => x === 'dry')).toHaveLength(1);
  });
});

describe('gatilho com memória', () => {
  it('o clique um instante antes de a sniper poder atirar dispara assim que puder', () => {
    const l = new FsLoadout('sniper', 'pistol');
    l.drawT = 0;
    const mv = { moving: false, airborne: false, ads: true };
    const fired = (ev: ReturnType<FsLoadout['update']>) => ev.some((e) => e.type === 'fire');
    expect(fired(l.update(0.016, { trigger: true, reload: false }, mv, 'p'))).toBe(true);
    l.update(0.016, { trigger: false, reload: false }, mv, 'p');
    // espera quase terminar o ferrolho e clica um pouco antes
    let t = 0;
    while (l.cooldown > 0.15) {
      l.update(0.016, { trigger: false, reload: false }, mv, 'p');
      t += 0.016;
    }
    expect(fired(l.update(0.016, { trigger: true, reload: false }, mv, 'p'))).toBe(false);
    let got = false;
    for (let i = 0; i < 30 && !got; i++) got = fired(l.update(0.016, { trigger: false, reload: false }, mv, 'p'));
    expect(got).toBe(true);
    expect(t).toBeGreaterThan(0);
  });
});

describe('faca: clique golpeia uma vez, segurar repete', () => {
  it('segurar o botão esquerdo corta de 0,5 em 0,5 s e o direito estoca de 1 em 1 s', () => {
    const l = new FsLoadout(null, 'pistol');
    l.switchTo(2);
    l.drawT = 0;
    const mv = { moving: false, airborne: false, ads: false };
    let n = 0;
    for (let i = 0; i < 600; i++) n += l.update(1 / 120, { trigger: true, reload: false }, mv, 'p').filter((e) => e.type === 'melee').length;
    expect(n).toBeGreaterThanOrEqual(9);
    expect(n).toBeLessThanOrEqual(11);
    // um clique só: um golpe
    const c = new FsLoadout(null, 'pistol');
    c.switchTo(2);
    c.drawT = 0;
    let one = c.update(1 / 120, { trigger: true, reload: false }, mv, 'p').filter((e) => e.type === 'melee').length;
    for (let i = 0; i < 300; i++) one += c.update(1 / 120, { trigger: false, reload: false }, mv, 'p').filter((e) => e.type === 'melee').length;
    expect(one).toBe(1);
    // segurar o direito: estocadas mais espaçadas que os cortes
    const r = new FsLoadout(null, 'pistol');
    r.switchTo(2);
    r.drawT = 0;
    let st = 0;
    for (let i = 0; i < 600; i++) st += r.update(1 / 120, { trigger: false, reload: false, alt: true }, mv, 'p').filter((e) => e.type === 'melee' && e.kind === 'stab').length;
    expect(st).toBeGreaterThanOrEqual(4);
    expect(st).toBeLessThanOrEqual(6);
  });
});

describe('faca: dano fixo', () => {
  it('corte 35 e estocada 70 em qualquer região, com ou sem colete e capacete', () => {
    const k = FS_WEAPONS.knife;
    for (const zone of ['head', 'chest', 'belly', 'legs'] as const)
      for (const armor of [0, 100]) {
        const h = { zone, dist: 1, armor, helmet: armor > 0, wall: 1 };
        expect(fsDamage(k, h).hp).toBe(35);
        expect(fsDamage({ ...k, damage: k.melee!.stab }, h).hp).toBe(70);
      }
  });
});

describe('três armas: primária, secundária e faca', () => {
  const idle = { moving: false, airborne: false, ads: false };

  it('o jogo começa só com pistola e faca; a faca é o espaço 3, não se compra e nunca sai', () => {
    const l = new FsLoadout(null, 'pistol');
    expect(l.slots.map((s) => s?.id)).toEqual([undefined, 'pistol', 'knife']);
    expect(fsBuy(l, 'knife').ok).toBe(false);
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
    // quem já tem a arma não compra de novo: nada muda
    l.slots[1]!.ammo = 1;
    const again = fsBuy(l, 'pistol');
    expect(again).toMatchObject({ ok: false, reason: 'owned' });
    expect(l.slots[1]!.ammo).toBe(1);
    expect(fsBuy(l, 'sniper')).toMatchObject({ ok: false, reason: 'owned' });
  });

  it('item "em breve" não compra e o colete vira armadura', () => {
    const l = new FsLoadout();
    expect(fsBuy(l, 'smg2')).toMatchObject({ ok: false, reason: 'soon' });
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
    expect(real.map((i) => i.id).sort()).toEqual(['ak', 'flash', 'frag', 'm4', 'pistol', 'shotgun', 'smg', 'sniper', 'usp', 'vest', 'vesthelm']);
  });
});

describe('agachar e andar devagar', () => {
  const run = (inp: Partial<Parameters<typeof fsStepMover>[1]>, secs = 1.5) => {
    const m = fsNewMover(5, 18);
    for (let i = 0; i < secs * 120; i++) fsStepMover(m, { fwd: 1, strafe: 0, jump: false, yaw: 0, speedMul: 1, ...inp }, 1 / 120, ROOM);
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

describe('bots de treino', () => {
  const run = (id: string, secs: number) => {
    const spec = FS_BOTS.find((b) => b.id === id)!;
    const st = fsNewBot(spec);
    const seen = new Set<string>();
    let maxY = 0;
    for (let i = 0; i < secs * 60; i++) {
      fsBotStep(st, spec, 1 / 60);
      seen.add(st.anim);
      maxY = Math.max(maxY, st.y);
    }
    return { st, seen, maxY, spec };
  };
  it('o que anda vai e volta sem sair da raia', () => {
    const { st, spec, seen } = run('b1', 20);
    expect(seen.has('run')).toBe(true);
    expect(st.x).toBeGreaterThanOrEqual(Math.min(spec.x, spec.x1) - 0.01);
    expect(st.x).toBeLessThanOrEqual(Math.max(spec.x, spec.x1) + 0.01);
  });
  it('shift anda mais devagar e agachado usa a animação de agachado', () => {
    const a = run('b1', 3).st.x - -12;
    const b = run('b2', 3).st.x - -12;
    expect(b).toBeLessThan(a * 0.7);
    expect(run('b3', 4).seen.has('crouchwalk')).toBe(true);
    expect(run('b3', 4).st.crouch).toBeGreaterThan(0.99);
  });
  it('o que pula sai do chão e volta; o que gira muda de direção', () => {
    const j = run('b4', 5);
    expect(j.maxY).toBeGreaterThan(0.5);
    expect(j.seen.has('jump')).toBe(true);
    expect(run('b5', 3).st.h).toBeGreaterThan(Math.PI / 2 + 1);
  });
});

describe('movimento estilo CS', () => {
  const none: FsBox[] = [];
  const step = (m: ReturnType<typeof fsNewMover>, inp: Partial<Parameters<typeof fsStepMover>[1]>, secs: number, boxes: readonly FsBox[] = none) => {
    for (let i = 0; i < Math.round(secs * 120); i++) fsStepMover(m, { fwd: 0, strafe: 0, jump: false, yaw: 0, speedMul: 1, ...inp }, 1 / 120, boxes);
  };
  const speed = (m: ReturnType<typeof fsNewMover>) => Math.hypot(m.vx, m.vz);

  it('ao soltar a tecla o corpo desliza um pouco e para; apertar o lado oposto freia mais rápido', () => {
    const a = fsNewMover(0, 0);
    step(a, { strafe: 1 }, 1);
    expect(speed(a)).toBeCloseTo(FS_MOVE.run, 1);
    step(a, {}, 0.1);
    expect(speed(a)).toBeGreaterThan(1); // ainda desliza
    step(a, {}, 1.5);
    expect(speed(a)).toBeLessThan(0.01); // e para
    const b = fsNewMover(0, 0);
    step(b, { strafe: 1 }, 1);
    step(b, { strafe: -1 }, 0.1);
    const c = fsNewMover(0, 0);
    step(c, { strafe: 1 }, 1);
    step(c, {}, 0.1);
    expect(speed(b)).toBeLessThan(speed(c)); // contra-strafe freia mais do que só soltar
  });

  it('no ar, virar a câmera e apertar o lado ganha velocidade acima da corrida (strafe jump)', () => {
    const m = fsNewMover(0, 0);
    step(m, { fwd: 1 }, 1);
    const base = speed(m);
    let yaw = 0;
    for (let hop = 0; hop < 6; hop++) {
      m.onGround = true;
      fsStepMover(m, { fwd: 0, strafe: 1, jump: true, yaw, speedMul: 1 }, 1 / 120, none);
      for (let i = 0; i < 100 && !m.onGround; i++) {
        yaw -= 0.5; // gira a câmera enquanto aperta D
        fsStepMover(m, { fwd: 0, strafe: 1, jump: false, yaw, speedMul: 1 }, 1 / 120, none);
      }
    }
    expect(speed(m)).toBeGreaterThan(base * 1.15);
  });

  it('andar na diagonal (de pé ou agachado) mantém a velocidade, sem perder tudo', () => {
    for (const crouch of [false, true]) {
      const d = fsNewMover(0, 0);
      step(d, { fwd: 1, strafe: 1, crouch }, 2);
      const r = fsNewMover(0, 0);
      step(r, { fwd: 1, crouch }, 2);
      expect(speed(d)).toBeGreaterThan(speed(r) * 0.97);
    }
  });

  it('o pulo vai a cerca de 0,95 m e dura cerca de 0,63 s', () => {
    const m = fsNewMover(0, 0);
    let top = 0;
    let t = 0;
    fsStepMover(m, { fwd: 0, strafe: 0, jump: true, yaw: 0, speedMul: 1 }, 1 / 120, none);
    while (!m.onGround && t < 3) {
      fsStepMover(m, { fwd: 0, strafe: 0, jump: false, yaw: 0, speedMul: 1 }, 1 / 120, none);
      top = Math.max(top, m.y);
      t += 1 / 120;
    }
    expect(top).toBeGreaterThan(0.85);
    expect(top).toBeLessThan(1.05);
    expect(t).toBeGreaterThan(0.55);
    expect(t).toBeLessThan(0.75);
  });

  const climb = (h: number, crouch: boolean) => {
    const ledge: FsBox[] = [{ min: [-5, 0, -80], max: [5, h, -3], pen: 0, mat: 'metal' }];
    const m = fsNewMover(0, 0);
    // corre até 1,3 m da borda, pula e (se quiser) agacha no ar
    let jumped = false;
    for (let i = 0; i < 120 * 4; i++) {
      const near = m.z < -3 + 1.3 + FS_MOVE.radius;
      const jump = near && !jumped && m.onGround;
      if (jump) jumped = true;
      fsStepMover(m, { fwd: 1, strafe: 0, jump, yaw: 0, speedMul: 1, crouch: crouch && jumped && !m.onGround }, 1 / 120, ledge);
    }
    return m;
  };
  it('pulo simples sobe em 0,7 m, não em 1,0 m; pulo + Ctrl sobe em 1,0 m e em 1,25 m; 1,6 m nunca', () => {
    expect(climb(0.7, false).y).toBeCloseTo(0.7, 1);
    expect(climb(1.0, false).y).toBeLessThan(0.2);
    expect(climb(1.0, true).y).toBeCloseTo(1.0, 1);
    expect(climb(1.25, true).y).toBeCloseTo(1.25, 1);
    expect(climb(1.6, true).y).toBeLessThan(0.2);
  });
});

describe('contra-strafe: tiro reto quando o boneco para', () => {
  it('a dispersão acompanha a velocidade real: parado preciso, correndo espalhado, freando volta a ficar preciso', () => {
    const w = FS_WEAPONS.ak;
    const g = fsNewGunState();
    const at = (speed: number) => fsSpreadDeg(w, { moving: speed > 0.8, airborne: false, ads: false, speed }, g);
    expect(at(0)).toBeCloseTo(w.spread.stand, 5);
    expect(at(5.2)).toBeCloseTo(w.spread.move, 5);
    expect(at(0.5)).toBeLessThan(at(2));
    expect(at(2)).toBeLessThan(at(5.2));
    // A solto e D apertado: a velocidade passa por perto de zero e o tiro sai reto
    const m = fsNewMover(0, 0);
    for (let i = 0; i < 120; i++) fsStepMover(m, { fwd: 0, strafe: -1, jump: false, yaw: 0, speedMul: 1 }, 1 / 120, []);
    let best = 99;
    for (let i = 0; i < 60; i++) {
      fsStepMover(m, { fwd: 0, strafe: 1, jump: false, yaw: 0, speedMul: 1 }, 1 / 120, []);
      best = Math.min(best, Math.hypot(m.vx, m.vz));
    }
    expect(best).toBeLessThan(0.9);
    expect(at(best)).toBeCloseTo(w.spread.stand, 5);
  });
});

describe('armas novas', () => {
  const W = FS_WEAPONS;
  it('submetralhadora: menos dano e mais cadência que o fuzil', () => {
    expect(W.smg.damage).toBeLessThan(W.ak.damage);
    expect(W.smg.rpm).toBeGreaterThan(W.ak.rpm);
    expect(W.smg.auto).toBe(true);
  });
  it('fuzil leve: dano, carregador e recuo diferentes do outro fuzil', () => {
    expect(W.m4.damage).not.toBe(W.ak.damage);
    expect(W.m4.mag).not.toBe(W.ak.mag);
    expect(W.m4.recoil[3]).not.toEqual(W.ak.recoil[3]);
    expect(W.m4.rpm).not.toBe(W.ak.rpm);
  });
  it('pistola silenciada: menos bala, bem mais precisa e com menos dano (mas não muito menos)', () => {
    expect(W.usp.mag).toBeLessThan(W.pistol.mag);
    expect(W.usp.spread.stand).toBeLessThan(W.pistol.spread.stand / 3);
    expect(W.usp.spread.move).toBeLessThan(W.pistol.spread.move);
    expect(W.usp.damage).toBeLessThan(W.pistol.damage);
    expect(W.usp.damage).toBeGreaterThan(W.pistol.damage * 0.7);
    expect(W.usp.slot).toBe('secondary');
  });
  it('escopeta: 8 cartuchos, 9 projéteis por tiro, tiro único com bombeio', () => {
    expect(W.shotgun.mag).toBe(8);
    expect(W.shotgun.pellets).toBe(9);
    expect(W.shotgun.auto).toBe(false);
    expect(W.shotgun.boltS).toBeGreaterThan(0.5);
    const g = fsNewGunState();
    const shot = fsFire(W.shotgun, g, { moving: false, airborne: false, ads: false }, 'p');
    expect(shot.pellets).toHaveLength(9);
    expect(new Set(shot.pellets!.map((p) => p.devYaw.toFixed(4))).size).toBeGreaterThan(5); // espalhados
  });
  it('escopeta: de perto o tiro mata (vários projéteis acertam), de longe quase nada acerta e o dano cai', () => {
    const hits = (dist: number) => {
      let total = 0;
      const body: FsBody = { id: 'b', pos: [0, 0, -dist], alive: true, armor: 0, helmet: false };
      for (let n = 0; n < 60; n++) {
        const g = fsNewGunState();
        const shot = fsFire(W.shotgun, g, { moving: false, airborne: false, ads: false }, 'p' + n);
        for (const p of shot.pellets!) {
          const t = fsTrace(W.shotgun, [0, 1.0, 0], fsDir(p.devYaw, p.devPitch), [], [body]);
          if (t.kind === 'player') total += t.damage!.hp;
        }
      }
      return total / 60;
    };
    const near = hits(4);
    const mid = hits(15);
    const far = hits(35);
    expect(near).toBeGreaterThanOrEqual(100); // mata de perto
    expect(mid).toBeLessThan(near * 0.7);
    expect(far).toBeLessThan(mid * 0.5);
    expect(far).toBeLessThan(40);
  });
  it('escopeta: todos os projéteis acertando mata, metade dá cerca de metade do dano, um só dá pouco', () => {
    const body: FsBody = { id: 'b', pos: [0, 0, -3], alive: true, armor: 0, helmet: false };
    const dmg = (n: number) => {
      let total = 0;
      for (let i = 0; i < n; i++) {
        const t = fsTrace(FS_WEAPONS.shotgun, [0, 0.9, 0], fsDir(0, 0), [], [body]);
        total += t.damage!.hp;
      }
      return total;
    };
    expect(dmg(9)).toBeGreaterThanOrEqual(FS_HP);
    expect(dmg(4)).toBeLessThan(dmg(9) * 0.55);
    expect(dmg(4)).toBeGreaterThan(dmg(9) * 0.35);
    expect(dmg(1)).toBeLessThan(25);
    // com colete também mata se todos acertam
    const vest: FsBody = { ...body, armor: 100 };
    let withVest = 0;
    for (let i = 0; i < 9; i++) withVest += fsTrace(FS_WEAPONS.shotgun, [0, 0.9, 0], fsDir(0, 0), [], [vest]).damage!.hp;
    expect(withVest).toBeGreaterThanOrEqual(FS_HP);
  });
  it('alcance do som: a silenciada quase não se ouve, a escopeta se ouve longe', () => {
    expect(FS_HEAR_RANGE.usp).toBeLessThan(FS_HEAR_RANGE.pistol);
    expect(FS_HEAR_RANGE.shotgun).toBeGreaterThan(FS_HEAR_RANGE.smg);
  });
  it('as armas novas cabem nos espaços certos', () => {
    expect(W.smg.slot).toBe('primary');
    expect(W.shotgun.slot).toBe('primary');
    expect(W.m4.slot).toBe('primary');
    const l = new FsLoadout(null, 'pistol');
    expect(fsBuy(l, 'usp').dropped?.id).toBe('pistol');
    expect(l.slots[1]?.id).toBe('usp');
    expect(fsBuy(l, 'shotgun').ok).toBe(true);
    expect(l.slots[0]?.id).toBe('shotgun');
  });
});

describe('atiradores do estande (só atiram para a frente)', () => {
  const shooters = FS_BOTS.filter((x) => x.kind === 'shoot');
  const rand = createRng('estande');
  it('há um atirador por arma de fogo, cada um numa cabine', () => {
    expect(shooters.map((x) => x.weapon)).toEqual(['pistol', 'usp', 'smg', 'm4', 'ak', 'shotgun', 'sniper']);
    expect(new Set(shooters.map((x) => x.x)).size).toBe(7);
  });
  it('olham para o paredão (norte) e a bala bate nele, nunca na galeria nem nas cabines vizinhas', () => {
    for (const sh of shooters) {
      const st = fsNewBot(sh);
      // o rumo (x, z) do bot: frente = (cos h, sin h) = norte (z negativo)
      expect(Math.cos(st.h)).toBeCloseTo(0, 5);
      expect(Math.sin(st.h)).toBeCloseTo(-1, 5);
      const origin: [number, number, number] = [sh.x, 1, sh.z - 0.4];
      const tr = fsTrace(FS_WEAPONS[sh.weapon!], origin, [0, 0, -1], FS_ARENA, []);
      expect(tr.kind).toBe('world');
      expect(tr.point[2]).toBeLessThan(-26);
      expect(Math.abs(tr.point[0] - sh.x)).toBeLessThan(0.5);
      // e a galeria (z de -13 a -9) fica atrás: o tiro nunca vai para lá
      expect(tr.point[2]).toBeLessThan(FS_TRAIN_GALLERY.z0);
    }
  });
  it('a galeria é separada do estande por vidro que não deixa passar bala', () => {
    const through = fsTrace(FS_WEAPONS.sniper, [30, 1, -10], [0, 0, -1], FS_ARENA, []);
    expect(through.kind).toBe('world');
    expect(through.point[2]).toBeGreaterThan(-13.5);
    expect(FS_ARENA.some((bx) => bx.mat === 'glass')).toBe(true);
  });
  it('atiram no ritmo da arma: fuzil em rajadas, pistola tiro a tiro, sniper devagar; ninguém atira sem parar', () => {
    const run = (w: 'pistol' | 'ak' | 'sniper', secs = 20) => {
      const st = fsNewRange();
      let n = 0;
      for (let i = 0; i < secs * 60; i++) if (fsRangeStep(st, w, 1 / 60, rand)) n++;
      return n;
    };
    const ak = run('ak');
    const pistol = run('pistol');
    const sniper = run('sniper');
    expect(ak).toBeGreaterThan(pistol);
    expect(sniper).toBeLessThan(pistol);
    expect(sniper).toBeGreaterThan(2);
    // pausas entre rajadas: nunca o máximo da cadência o tempo todo
    expect(ak).toBeLessThan(20 * (600 / 60));
  });
  it('o alcance do som: pistola menor, fuzil maior, sniper maior ainda', () => {
    expect(FS_HEAR_RANGE.pistol).toBeLessThan(FS_HEAR_RANGE.ak);
    expect(FS_HEAR_RANGE.ak).toBeLessThan(FS_HEAR_RANGE.sniper);
  });
});

describe('Mapa de Treino', () => {
  const inside = (x: number, z: number, a: (typeof FS_TRAIN_AREAS)[number]) => x > a.x0 && x < a.x1 && z > a.z0 && z < a.z1;
  const solid = (x: number, z: number) => FS_ARENA.some((bx) => bx.max[1] > 1 && x > bx.min[0] - 0.3 && x < bx.max[0] + 0.3 && z > bx.min[2] - 0.3 && z < bx.max[2] + 0.3);
  it('tem as sete áreas e o nascimento está na avenida, livre', () => {
    expect(FS_TRAIN_AREAS.map((a) => a.id).sort()).toEqual(['avenue', 'move', 'nades', 'range', 'targets', 'walkers', 'walls']);
    expect(inside(FS_SPAWN.x, FS_SPAWN.z, FS_TRAIN_AREAS.find((a) => a.id === 'avenue')!)).toBe(true);
    expect(solid(FS_SPAWN.x, FS_SPAWN.z)).toBe(false);
    expect(FS_ARENA_HALF).toEqual([45, 27]);
  });
  it('de qualquer ponto de nascimento dá para chegar a cada sala pela porta (andando em linha reta e pelas portas)', () => {
    // da avenida até o centro de cada sala, passando pela porta (x = -30, 0 ou 30)
    const m0 = (x: number, z: number) => {
      const m = fsNewMover(x, z);
      return m;
    };
    const targets: [number, number, number][] = [[-30, -18, -30], [0, -18, 0], [30, -11, 30], [-30, 18, -30], [0, 12, 0], [30, 11, 30]];
    for (const [dx, tz, door] of targets) {
      const m = m0(door, 0);
      // anda até a sala em linha reta pela porta
      for (let i = 0; i < 120 * 6 && Math.abs(m.z - tz) > 0.4; i++) {
        fsStepMover(m, { fwd: 1, strafe: 0, jump: false, yaw: tz < 0 ? 0 : 180, speedMul: 1 }, 1 / 120, FS_ARENA);
      }
      expect(Math.abs(m.z - tz), `sala ${dx}`).toBeLessThan(1);
    }
  });
  it('os alvos e bots estão cada um dentro da sua sala e fora das paredes', () => {
    const all = [...FS_TARGETS, ...FS_BOTS];
    for (const t of all) {
      expect(FS_TRAIN_AREAS.some((a) => inside(t.x, t.z, a)), t.id).toBe(true);
      expect(solid(t.x, t.z), t.id).toBe(false);
    }
    expect(FS_TARGETS.length).toBeGreaterThanOrEqual(15);
  });
  it('cada barreira de material tem o poder de penetração certo e um alvo atrás dela', () => {
    const through = (x: number, wid: 'ak' | 'sniper') => fsTrace(FS_WEAPONS[wid], [x, 1.0, 10.5], [0, 0, 1], FS_ARENA, [{ id: 'a', pos: [x, 0, 17.5], alive: true, armor: 0, helmet: false }]);
    // parede maciça: nada passa; madeira fina: passa
    expect(through(34, 'sniper').kind).toBe('world');
    expect(through(19, 'ak').kind).toBe('player');
    expect(through(19, 'ak').damage!.hp).toBeLessThan(FS_WEAPONS.ak.damage * 1.0);
  });
  it('as placas existem e as das salas estão sobre as portas', () => {
    for (const door of [-30, 0, 30]) {
      expect(FS_MOVE_SIGNS.some((sg) => sg.x === door && Math.abs(sg.z) > 8 && sg.big)).toBe(true);
    }
  });
  it('o túnel baixo só passa agachado e os pulos altos não sobem', () => {
    const run = (crouch: boolean) => {
      const m = fsNewMover(-34.5, 18.5);
      m.crouchK = crouch ? 1 : 0;
      for (let i = 0; i < 120 * 3; i++) fsStepMover(m, { fwd: 1, strafe: 0, jump: false, yaw: 90, speedMul: 1, crouch }, 1 / 120, FS_ARENA);
      return m;
    };
    expect(run(true).x).toBeLessThan(-40);
    expect(run(false).x).toBeGreaterThan(-36.5);
  });
});

describe('facada nas costas', () => {
  const face: [number, number] = [0, -1]; // o alvo olha para -z
  it('só vale nas costas de verdade: na diagonal é a facada comum', () => {
    expect(fsIsBackstab(face, [0, 0], [0, 2])).toBe(true); // bem atrás
    expect(fsIsBackstab(face, [0, 0], [1, 2])).toBe(true); // ~27 graus
    expect(fsIsBackstab(face, [0, 0], [2, 1.2])).toBe(false); // ~59 graus da linha das costas: diagonal
    expect(fsIsBackstab(face, [0, 0], [2, -1])).toBe(false); // de lado/frente
    expect(fsIsBackstab(face, [0, 0], [0, -2])).toBe(false); // de frente
  });
  it('a facada nas costas mata na hora (100) e a comum dá 70', () => {
    expect(FS_WEAPONS.knife.melee!.backstab).toBeGreaterThanOrEqual(FS_HP);
    expect(FS_WEAPONS.knife.melee!.stab).toBeLessThan(FS_HP);
  });
});

describe('assistência', () => {
  it('dei dano e outro matou: assistência para mim', () => {
    expect(fsAssister([{ attacker: 'eu', time: 10 }, { attacker: 'k', time: 12 }], 'k', 13)).toBe('eu');
  });
  it('dei dano, outro deu dano depois de mim e um terceiro matou: não conto (só vale quem bateu logo antes)', () => {
    const log = [{ attacker: 'eu', time: 10 }, { attacker: 'b', time: 11 }, { attacker: 'k', time: 12 }];
    expect(fsAssister(log, 'k', 13)).toBe('b');
  });
  it('dano muito antigo não conta', () => {
    expect(fsAssister([{ attacker: 'eu', time: 0 }, { attacker: 'k', time: 60 }], 'k', 61)).toBeNull();
  });
  it('o matador não ganha assistência e sem outro dano não há assistência', () => {
    expect(fsAssister([{ attacker: 'k', time: 5 }, { attacker: 'k', time: 6 }], 'k', 7)).toBeNull();
    expect(fsAssister([], 'k', 7)).toBeNull();
  });
});

describe('granadas', () => {
  const mv = { moving: false, airborne: false, ads: false };
  it('explosiva: dano cheio (60) no centro, menos longe e nada fora do raio', () => {
    expect(fsFragDamage(0)).toBe(60);
    expect(fsFragDamage(3.5)).toBe(30);
    expect(fsFragDamage(6.9)).toBeLessThan(3);
    expect(fsFragDamage(7)).toBe(0);
    expect(fsFragDamage(20)).toBe(0);
    expect(fsFragDamage(1)).toBeGreaterThan(fsFragDamage(4));
  });
  it('a parede no meio protege da explosão e da luz', () => {
    const wall: FsBox[] = [{ min: [-5, 0, -0.2], max: [5, 3, 0.2], pen: 0, mat: 'wall' }];
    expect(fsClearLine(wall, [0, 1, -3], [0, 1, 3])).toBe(false);
    expect(fsClearLine(wall, [0, 1, 3], [0, 1, 6])).toBe(true);
  });
  it('luz: cega quem olha, não cega quem está de costas ou atrás da parede, perto cega mais', () => {
    const eye: [number, number, number] = [0, 1.2, 0];
    const flashAt = (z: number): [number, number, number] => [0, 1.5, z];
    const front = fsFlashEffect(eye, [0, 0, -1], flashAt(-5), true);
    expect(front.blind).toBeGreaterThan(2.5);
    expect(fsFlashEffect(eye, [0, 0, 1], flashAt(-5), true).blind).toBe(0); // de costas
    expect(fsFlashEffect(eye, [0, 0, -1], flashAt(-5), false).blind).toBe(0); // parede no meio
    expect(fsFlashEffect(eye, [0, 0, -1], flashAt(-2), true).blind).toBeGreaterThan(fsFlashEffect(eye, [0, 0, -1], flashAt(-15), true).blind);
    expect(fsFlashEffect(eye, [0, 0, -1], flashAt(-40), true)).toEqual({ blind: 0, deaf: 0 });
    // quem não vê ouve o estouro
    expect(fsFlashEffect(eye, [0, 0, 1], flashAt(-5), true).deaf).toBeGreaterThan(2);
    // olhando de lado cega só um pouco
    const side = fsFlashEffect(eye, [1, 0, 0], flashAt(-5), true);
    expect(side.blind).toBeGreaterThan(0);
    expect(side.blind).toBeLessThan(front.blind * 0.5);
  });
  it('arremesso como no CS: esquerdo lança longe, direito joga perto, os dois média distância', () => {
    expect(fsThrowPower('far')).toBe(1);
    expect(fsThrowPower('near')).toBeLessThan(fsThrowPower('mid'));
    expect(fsThrowPower('mid')).toBeLessThan(fsThrowPower('far'));
    const land = (p: number) => {
      const g = fsGrenadeLaunch('frag', [0, 1.5, 0], [0, 0, -1], p);
      for (let i = 0; i < 600 && g.age < 4; i++) fsGrenadeStep(g, 1 / 120, []);
      return -g.z;
    };
    expect(land(1)).toBeGreaterThan(land(0.55) + 3);
    expect(land(0.55)).toBeGreaterThan(land(0.1) + 2);
    expect(land(0.1)).toBeLessThan(6.5); // "aqui perto"
  });
  it('explode depois do tempo e quica na parede', () => {
    const g = fsGrenadeLaunch('frag', [0, 1.2, 0], [0, 0, -1], 0.8);
    const wall: FsBox[] = [{ min: [-5, 0, -4.1], max: [5, 4, -4], pen: 0, mat: 'wall' }];
    let boom = false;
    let t = 0;
    while (!boom && t < 5) {
      boom = fsGrenadeStep(g, 1 / 120, wall);
      t += 1 / 120;
    }
    expect(t).toBeGreaterThanOrEqual(FS_GRENADES.frag.fuse - 0.02);
    expect(t).toBeLessThan(FS_GRENADES.frag.fuse + 0.05);
    expect(g.z).toBeGreaterThan(-4.1); // não atravessou a parede
    expect(g.bounces).toBeGreaterThan(0);
  });
  it('inventário: máximo de 2 de cada, tecla 4 passa pela primeira, pela outra e volta à arma', () => {
    const l = new FsLoadout('ak', 'pistol');
    expect(fsBuy(l, 'frag').ok).toBe(true);
    expect(fsBuy(l, 'frag').ok).toBe(true);
    expect(fsBuy(l, 'frag')).toMatchObject({ ok: false, reason: 'owned' });
    expect(fsBuy(l, 'flash').ok).toBe(true);
    expect(l.selectGrenade('next')).toEqual([{ type: 'grenadeDraw', grenade: 'frag' }]);
    expect(l.held).toBe('frag');
    expect(l.selectGrenade('next')).toEqual([{ type: 'grenadeDraw', grenade: 'flash' }]);
    expect(l.held).toBe('flash');
    expect(l.selectGrenade('next')[0]).toMatchObject({ type: 'draw' });
    expect(l.held).toBeNull();
    // tecla específica
    l.selectGrenade('flash');
    expect(l.held).toBe('flash');
    l.selectGrenade('flash');
    expect(l.held).toBeNull();
  });
  it('apertar o botão esquerdo tira o pino e soltar lança longe; o direito lança perto; sem granada sobrando volta à arma', () => {
    const l = new FsLoadout('ak', 'pistol');
    fsBuy(l, 'frag');
    fsBuy(l, 'frag');
    fsBuy(l, 'flash');
    l.selectGrenade('frag');
    l.drawT = 0;
    const run = (trigger: boolean, alt: boolean, secs: number) => {
      const out: string[] = [];
      const th: { power: number; style: string }[] = [];
      for (let i = 0; i < Math.round(secs * 120); i++)
        for (const e of l.update(1 / 120, { trigger, alt, reload: false }, mv, 'p')) {
          out.push(e.type);
          if (e.type === 'throw') th.push({ power: e.power, style: e.style });
        }
      return { out, th };
    };
    // esquerdo: aperta (pino), solta (longe)
    expect(run(true, false, 0.1).out).toContain('pin');
    const far = run(false, false, 0.05);
    expect(far.th[0]).toEqual({ power: 1, style: 'far' });
    run(false, false, 0.7); // acabou o arremesso
    // direito: perto
    expect(l.held).toBe('frag');
    run(false, true, 0.1);
    expect(run(false, false, 0.05).th[0]).toEqual({ power: 0.1, style: 'near' });
    run(false, false, 0.7);
    // acabaram as explosivas: passa para a de luz; os dois botões = média distância
    expect(l.held).toBe('flash');
    l.drawT = 0;
    run(true, false, 0.05);
    run(true, true, 0.1);
    expect(run(false, false, 0.05).th[0]).toEqual({ power: 0.55, style: 'mid' });
    // sem granada: volta à arma
    expect(run(false, false, 1).out).toContain('draw');
    expect(l.held).toBeNull();
  });
});

// ---------------------------------------------------------------- Duna (spec 057)
import {
  FS_DUST_BOXES, FS_DUST_COLS, FS_DUST_GRID, FS_DUST_HOTSPOTS, FS_DUST_SPAWNS, FS_DUST_ZONES, FS_DUST_ROWS,
  fsDustLevel, fsDustCol, fsDustPath, fsDustRow, fsDustWalkable, fsDustZoneAt, fsDustCellX, fsDustCellZ, fsPickSpawn, fsDustLineWalkable,
  fsDmNew, fsDmStep, fsDmFlash, type FsDmFoe, type FsDmAction,
  fsFlinch, fsFlinchAt, fsDustDecor, FsNetSim, fsNetParseInput, type FsNetCmd,
  FS_MATCH_BOTS, fsMatchConfig, fsMatchResult, fsMatchScore, FS_MATCH_MINUTES,
} from './index';

describe('Duna: mapa', () => {
  it('todas as linhas têm o mesmo tamanho e a borda é parede', () => {
    for (const row of FS_DUST_GRID) expect(row.length).toBe(FS_DUST_COLS);
    expect(FS_DUST_GRID.length).toBe(FS_DUST_ROWS);
    for (const c of FS_DUST_GRID[0]!) expect(c).toBe('#');
    for (const row of FS_DUST_GRID) {
      expect(row[0]).toBe('#');
      expect(row[FS_DUST_COLS - 1]).toBe('#');
    }
  });

  it('as zonas existem: base CT, base TR, bomba A, bomba B e meio', () => {
    const ids = FS_DUST_ZONES.map((z) => z.id);
    for (const id of ['A', 'B', 'CT', 'TR', 'mid']) expect(ids).toContain(id);
  });

  it('o chão todo é um só pedaço: dá para ir de qualquer chão a qualquer outro subindo no máximo um degrau', () => {
    const free: [number, number][] = [];
    for (let r = 0; r < FS_DUST_ROWS; r++) for (let c = 0; c < FS_DUST_COLS; c++) if (fsDustWalkable(c, r)) free.push([c, r]);
    const seen = new Set<number>([free[0]![1] * FS_DUST_COLS + free[0]![0]]);
    const q = [free[0]!];
    while (q.length) {
      const [c, r] = q.pop()!;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = (r + dr) * FS_DUST_COLS + (c + dc);
        if (fsDustWalkable(c + dc, r + dr) && Math.abs(fsDustLevel(c + dc, r + dr) - fsDustLevel(c, r)) <= 1 && !seen.has(k)) {
          seen.add(k);
          q.push([c + dc, r + dr]);
        }
      }
    }
    expect(free.length - seen.size).toBe(0);
  });

  it('nenhum corredor é estreito demais: todo chão tem folga de ao menos 2 células em uma direção', () => {
    for (let r = 0; r < FS_DUST_ROWS; r++) {
      for (let c = 0; c < FS_DUST_COLS; c++) {
        if (fsDustLevel(c, r) < 0) continue;
        const h = (fsDustLevel(c - 1, r) >= 0 ? 1 : 0) + (fsDustLevel(c + 1, r) >= 0 ? 1 : 0);
        const v = (fsDustLevel(c, r - 1) >= 0 ? 1 : 0) + (fsDustLevel(c, r + 1) >= 0 ? 1 : 0);
        // célula sozinha (sem vizinha em nenhuma direção) seria um buraco inalcançável
        expect(h + v, `${c},${r}`).toBeGreaterThan(0);
      }
    }
  });

  it('todo ponto de nascimento e de passeio é chão livre', () => {
    for (const s of FS_DUST_SPAWNS) expect(fsDustWalkable(fsDustCol(s.x), fsDustRow(s.z))).toBe(true);
    for (const [x, z] of FS_DUST_HOTSPOTS) expect(fsDustWalkable(fsDustCol(x), fsDustRow(z))).toBe(true);
  });

  it('ninguém nasce dentro de uma caixa', () => {
    for (const s of FS_DUST_SPAWNS) {
      const m = fsNewMover(s.x, s.z);
      const inside = FS_DUST_BOXES.some((b) => s.x > b.min[0] && s.x < b.max[0] && s.z > b.min[2] && s.z < b.max[2] && b.min[1] < s.y + 1 && b.max[1] > s.y + 0.35);
      expect(inside).toBe(false);
      expect(m.y).toBe(0);
    }
  });

  it('há caminho da base TR até as duas bombas, o meio e a base CT', () => {
    const tr = FS_DUST_SPAWNS.find((s) => s.zone === 'TR')!;
    for (const id of ['A', 'B', 'CT', 'mid'] as const) {
      const spot = FS_DUST_SPAWNS.find((s) => s.zone === id)!;
      const p = fsDustPath(tr.x, tr.z, spot.x, spot.z);
      expect(p.length, id).toBeGreaterThan(0);
      expect(Math.hypot(p[p.length - 1]![0] - spot.x, p[p.length - 1]![1] - spot.z)).toBeLessThan(1.1);
    }
  });

  it('o caminho nunca atravessa parede: cada trecho é andável com folga', () => {
    const a = FS_DUST_SPAWNS.find((s) => s.zone === 'TR')!;
    const b = FS_DUST_SPAWNS.find((s) => s.zone === 'A')!;
    const p = fsDustPath(a.x, a.z, b.x, b.z);
    let x = a.x;
    let z = a.z;
    for (const [nx, nz] of p) {
      expect(fsDustLineWalkable(x, z, nx, nz)).toBe(true);
      x = nx;
      z = nz;
    }
  });

  it('um corpo andando em linha reta pelo caminho chega ao destino sem ficar preso', () => {
    const a = FS_DUST_SPAWNS.find((s) => s.zone === 'TR')!;
    const b = FS_DUST_SPAWNS.find((s) => s.zone === 'B')!;
    const m = fsNewMover(a.x, a.z);
    m.y = a.y;
    const path = fsDustPath(a.x, a.z, b.x, b.z);
    let t = 0;
    for (const [px, pz] of path) {
      for (let i = 0; i < 120 * 30 && Math.hypot(px - m.x, pz - m.z) > 0.35; i++) {
        const yaw = (Math.atan2(-(px - m.x), -(pz - m.z)) * 180) / Math.PI;
        fsStepMover(m, { fwd: 1, strafe: 0, jump: false, yaw, speedMul: 1 }, 1 / 120, FS_DUST_BOXES);
        t++;
      }
      expect(Math.hypot(px - m.x, pz - m.z)).toBeLessThan(0.6);
    }
    expect(t / 120).toBeLessThan(40);
  });

  it('as paredes param a bala e os caixotes de madeira deixam passar parte', () => {
    const w = FS_WEAPONS.ak;
    // de dentro da base TR para o norte, através do prédio central: bate na parede
    const tr = FS_DUST_SPAWNS.find((s) => s.zone === 'TR')!;
    const tr1 = fsTrace(w, [tr.x, 1, tr.z], [0, 0, -1], FS_DUST_BOXES, []);
    expect(tr1.kind).toBe('world');
  });

  it('zona do ponto: o centro da base CT é a base CT', () => {
    const z = fsDustZoneAt(fsDustCellX(28), fsDustCellZ(17));
    expect(z?.id).toBe('CT');
  });

  it('o ponto de nascimento escolhido fica longe e fora da vista dos inimigos vivos', () => {
    const foe = FS_DUST_SPAWNS.find((s) => s.zone === 'CT')!;
    const pick = fsPickSpawn([{ x: foe.x, z: foe.z }], () => 0);
    expect(Math.hypot(pick.x - foe.x, pick.z - foe.z)).toBeGreaterThan(25);
    // sem inimigos: qualquer um serve
    expect(FS_DUST_SPAWNS).toContain(fsPickSpawn([], () => 0.99));
  });

  it('número de caixas é razoável para a cena', () => {
    expect(FS_DUST_BOXES.length).toBeLessThan(400);
  });
});

describe('Partida: pontos e resultado', () => {
  it('abate vale 10 e assistência 5', () => {
    expect(fsMatchScore({ kills: 3, assists: 2 })).toBe(40);
    expect(fsMatchScore({ kills: 0, assists: 0 })).toBe(0);
  });

  it('durações e bots válidos; o resto é ajustado', () => {
    expect([...FS_MATCH_MINUTES]).toEqual([2, 3, 5, 7, 10]);
    expect(fsMatchConfig(7, 9)).toEqual({ minutes: 7, bots: 9 });
    expect(fsMatchConfig(4, 0)).toEqual({ minutes: 5, bots: FS_MATCH_BOTS.min });
    expect(fsMatchConfig(10, 99).bots).toBe(9);
    expect(fsMatchConfig(2, Number.NaN).bots).toBe(FS_MATCH_BOTS.default);
  });

  it('quem tem mais pontos vence; desempate por abates e depois menos mortes', () => {
    const rows = fsMatchResult([
      { id: 'a', name: 'A', kills: 2, assists: 0, deaths: 1 }, // 20
      { id: 'b', name: 'B', kills: 1, assists: 2, deaths: 5 }, // 20, menos abates
      { id: 'c', name: 'C', kills: 0, assists: 1, deaths: 0 }, // 5
    ]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(rows[0]!.winner).toBe(true);
    expect(rows[1]!.winner).toBe(false);
    expect(rows[2]!.place).toBe(3);
  });

  it('empate total divide a vitória', () => {
    const rows = fsMatchResult([
      { id: 'a', name: 'A', kills: 1, assists: 0, deaths: 1 },
      { id: 'b', name: 'B', kills: 1, assists: 0, deaths: 1 },
      { id: 'c', name: 'C', kills: 0, assists: 0, deaths: 2 },
    ]);
    expect(rows.filter((r) => r.winner).length).toBe(2);
    expect(rows[2]!.place).toBe(3);
  });
});

describe('Bots do mata-mata', () => {
  const rng = createRng('dm-test');
  const run = (b: ReturnType<typeof fsDmNew>, foes: FsDmFoe[], secs: number) => {
    const acts: FsDmAction[] = [];
    for (let t = 0; t < secs; t += 0.016) acts.push(...fsDmStep(b, { now: t, dt: 0.016, rng, foes }));
    return acts;
  };
  const cell = (c: number, r: number) => [fsDustCellX(c), fsDustCellZ(r)] as const;

  it('vê um inimigo em campo aberto e atira nele', () => {
    const [x, z] = cell(27, 48);
    const [fx, fz] = cell(27, 28);
    const b = fsDmNew('b', x, z, 0, 'ak', rng);
    const acts = run(b, [{ id: 'p', x: fx, y: 0, z: fz, crouch: 0, noisy: false }], 3);
    expect(acts.some((a) => a.type === 'fire')).toBe(true);
  });

  it('não atira em quem está atrás da parede', () => {
    const [x, z] = cell(11, 40);
    const [fx, fz] = cell(27, 40); // do outro lado da parede entre o túnel e o Meio
    const b = fsDmNew('b', x, z, -90, 'ak', rng);
    const acts = run(b, [{ id: 'p', x: fx, y: 0, z: fz, crouch: 0, noisy: false }], 3);
    expect(acts.some((a) => a.type === 'fire')).toBe(false);
  });

  it('com o carregador vazio recarrega e depois volta a atirar', () => {
    const [x, z] = cell(29, 51);
    const [fx, fz] = cell(29, 44);
    const b = fsDmNew('b', x, z, 0, 'pistol', rng);
    b.ammo = 1;
    const acts = run(b, [{ id: 'p', x: fx, y: 0, z: fz, crouch: 0, noisy: false }], 8);
    expect(acts.some((a) => a.type === 'reload')).toBe(true);
    expect(acts.filter((a) => a.type === 'fire').length).toBeGreaterThan(2);
  });

  it('sozinho passeia pelo mapa sem ficar preso e sem atravessar parede', () => {
    const [x, z] = cell(8, 56);
    const b = fsDmNew('b', x, z, 0, 'm4', rng);
    b.mover.y = 0.3;
    const seen = new Set<string>();
    for (let t = 0; t < 90; t += 0.016) {
      fsDmStep(b, { now: t, dt: 0.016, rng, foes: [] });
      seen.add(`${Math.floor(b.mover.x / 6)},${Math.floor(b.mover.z / 6)}`);
      expect(fsDustWalkable(fsDustCol(b.mover.x), fsDustRow(b.mover.z))).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(14);
  });

  it('cego pela luz não atira', () => {
    const [x, z] = cell(27, 48);
    const [fx, fz] = cell(27, 28);
    const b = fsDmNew('b', x, z, 0, 'ak', rng);
    fsDmFlash(b, 5);
    const acts = run(b, [{ id: 'p', x: fx, y: 0, z: fz, crouch: 0, noisy: false }], 3);
    expect(acts.some((a) => a.type === 'fire')).toBe(false);
  });

  it('escopeta não atira de longe', () => {
    const [x, z] = cell(27, 50);
    const [fx, fz] = cell(27, 25);
    const b = fsDmNew('b', x, z, 0, 'shotgun', rng);
    const acts = run(b, [{ id: 'p', x: fx, y: 0, z: fz, crouch: 0, noisy: false }], 1.5);
    expect(acts.some((a) => a.type === 'fire')).toBe(false);
  });
});

describe('Tiro recebido desacelera', () => {
  it('mais dano, mais lento, mas nunca abaixo de 62% da velocidade', () => {
    expect(fsFlinch(10).mul).toBeGreaterThan(fsFlinch(40).mul);
    expect(fsFlinch(500).mul).toBeCloseTo(0.62, 5);
    expect(fsFlinch(0).mul).toBeLessThan(0.9);
  });
  it('volta à velocidade cheia no fim da duração', () => {
    const f = fsFlinch(30);
    expect(fsFlinchAt(f, 0)).toBeCloseTo(f.mul, 5);
    expect(fsFlinchAt(f, f.dur / 2)).toBeGreaterThan(f.mul);
    expect(fsFlinchAt(f, f.dur)).toBe(1);
    expect(f.dur).toBeLessThanOrEqual(0.7);
  });
});

describe('Duna: enfeites', () => {
  it('a decoração é sempre a mesma e tem prédios, arcos e postes', () => {
    const a = fsDustDecor();
    const b = fsDustDecor();
    expect(a).toEqual(b);
    for (const m of ['arch_a', 'lamp', 'bld_a']) expect(a.some((p) => p.model === m), m).toBe(true);
    expect(a.length).toBeLessThan(600);
  });
  it('nenhum prédio chega perto de chão andável (nada atravessa corredor)', () => {
    const blds = fsDustDecor().filter((q) => q.model.startsWith('bld_'));
    expect(blds.length).toBeGreaterThan(8);
    for (const p of blds) {
      const c0 = fsDustCol(p.x);
      const r0 = fsDustRow(p.z);
      for (let dr = -8; dr <= 8; dr++) for (let dc = -8; dc <= 8; dc++) expect(fsDustLevel(c0 + dc, r0 + dr) < 0, `${c0},${r0}`).toBe(true);
    }
  });
});

describe('Simulação do servidor (mata-mata online)', () => {
  const baseIn = { fwd: 0, strafe: 0, jump: false, crouch: false, walk: false, yaw: 0, pitch: 0, trigger: false, alt: false, reload: false, inspect: false, viewTick: 0 };
  let seqN = 0;
  const inp = (o: Partial<typeof baseIn> & { cmds?: FsNetCmd[] } = {}) => ({ ...baseIn, seq: ++seqN, ...o });
  const aim = (a: { x: number; y: number; z: number }, b: { x: number; z: number }, yEye = 1.2) => ({
    yaw: ((Math.atan2(-(b.x - a.x), -(b.z - a.z)) * 180) / Math.PI + 360) % 360,
    pitch: (Math.atan2(0.9 - yEye, Math.hypot(b.x - a.x, b.z - a.z)) * 180) / Math.PI,
  });
  /** Dois humanos, sem bots, com um ao alcance e à vista do outro na Base TR. */
  const duel = () => {
    const sim = new FsNetSim({ minutes: 2, humans: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }], bots: 1, rng: createRng('duel') });
    for (const [id, x, z] of [['a', 9, 54], ['b', 9, 59], ['c', 10, 54]] as const) {
      const p = sim.players.get(id)!;
      p.mover.x = fsDustCellX(x);
      p.mover.z = fsDustCellZ(z);
      p.mover.y = 0.3;
      p.hist = [];
    }
    // os bots não atrapalham o teste
    sim.players.get('b1')!.alive = false;
    sim.players.get('b1')!.respawnAt = 1e9;
    return sim;
  };
  const shoot = (sim: FsNetSim, from: string, to: string, ticks = 90) => {
    const a = sim.players.get(from)!;
    const b = sim.players.get(to)!;
    for (let i = 0; i < ticks; i++) {
      const ang = aim({ x: a.mover.x, y: a.mover.y, z: a.mover.z }, { x: b.mover.x, z: b.mover.z }, a.mover.y + 1.2);
      sim.pushInput(from, inp({ ...ang, trigger: i % 2 === 0, viewTick: sim.tick }));
      for (const id of ['a', 'b', 'c']) if (id !== from) sim.pushInput(id, inp({ yaw: 0 }));
      sim.step();
    }
  };

  it('a sala tem no máximo 10 jogadores contando os bots', () => {
    const humans = Array.from({ length: 4 }, (_, i) => ({ id: `h${i}`, name: `H${i}` }));
    const sim = new FsNetSim({ minutes: 5, humans, bots: 9 });
    expect(sim.roster.length).toBe(10);
    expect(sim.roster.filter((r) => r.bot).length).toBe(6);
  });

  it('a entrada vinda da rede é conferida e limpa', () => {
    expect(fsNetParseInput(null)).toBeNull();
    expect(fsNetParseInput({ seq: 'x' })).toBeNull();
    const ok = fsNetParseInput({ seq: 3, fwd: 9, strafe: -9, yaw: -90, pitch: 500, cmds: [{ t: 'buy', id: 'ak' }, { t: 'slot', i: 7 }, { t: 'x' }] })!;
    expect(ok.fwd).toBe(1);
    expect(ok.strafe).toBe(-1);
    expect(ok.yaw).toBe(270);
    expect(ok.pitch).toBe(88);
    expect(ok.cmds).toEqual([{ t: 'buy', id: 'ak' }]);
  });

  it('o servidor anda o corpo igual ao aparelho (previsão sem diferença)', () => {
    const sim = duel();
    const a = sim.players.get('a')!;
    const mine = fsNewMover(a.mover.x, a.mover.z);
    mine.y = a.mover.y;
    for (let i = 0; i < 90; i++) {
      const o = inp({ fwd: 1, strafe: i % 40 < 20 ? 1 : 0, jump: i === 30, yaw: 20 });
      sim.pushInput('a', o);
      sim.step();
      for (let k = 0; k < 2; k++) {
        fsStepMover(mine, { fwd: o.fwd, strafe: o.strafe, jump: o.jump && k === 0, yaw: o.yaw, speedMul: FS_WEAPONS.pistol.moveMul, crouch: false, walk: false }, 1 / 120, FS_DUST_BOXES);
      }
    }
    expect(Math.hypot(a.mover.x - mine.x, a.mover.z - mine.z)).toBeLessThan(1e-6);
    expect(a.mover.y).toBeCloseTo(mine.y, 6);
    expect(a.lastSeq).toBeGreaterThan(80);
  });

  it('entrada repetida ou velha é ignorada', () => {
    const sim = duel();
    const o = inp({ fwd: 1 });
    sim.pushInput('a', o);
    sim.pushInput('a', o);
    expect(sim.players.get('a')!.queue.length).toBe(1);
    sim.step();
    sim.pushInput('a', o);
    expect(sim.players.get('a')!.queue.length).toBe(0);
  });

  it('um abate dá 10 pontos, a assistência dá 5, e o abatido renasce em 3 s', () => {
    const sim = duel();
    // A bate primeiro (tiros curtos), depois C termina
    shoot(sim, 'a', 'b', 1);
    const hpAfterA = sim.players.get('b')!.hp;
    expect(hpAfterA).toBeLessThan(100);
    shoot(sim, 'c', 'b', 150);
    const b = sim.players.get('b')!;
    expect(b.alive).toBe(false);
    expect(sim.players.get('c')!.kills).toBe(1);
    expect(sim.points('c')).toBe(10);
    expect(sim.players.get('a')!.assists).toBe(1);
    expect(sim.points('a')).toBe(5);
    const evs = sim.drainEvents();
    expect(evs.some((e) => e.k === 'kill' && e.killer === 'c' && e.victim === 'b' && e.assist === 'a')).toBe(true);
    for (let i = 0; i < 181; i++) sim.step();
    expect(b.alive).toBe(true);
    expect(b.hp).toBe(100);
    expect(sim.drainEvents().some((e) => e.k === 'spawn' && e.id === 'b')).toBe(true);
  });

  it('compensação de atraso: acerta onde o alvo estava na tela de quem atirou', () => {
    const sim = duel();
    const a = sim.players.get('a')!;
    const b = sim.players.get('b')!;
    // B ficou parado por 10 passos e depois saiu do lugar (3 m para o lado)
    for (let i = 0; i < 10; i++) sim.step();
    const was = { x: b.mover.x, z: b.mover.z };
    const viewTick = sim.tick;
    b.mover.x += 3;
    for (let i = 0; i < 4; i++) sim.step();
    // A mira onde B estava há 4 passos e a tela dele mostrava o passo `viewTick`
    const ang = aim({ x: a.mover.x, y: a.mover.y, z: a.mover.z }, was, a.mover.y + 1.2);
    sim.drainEvents();
    sim.pushInput('a', inp({ ...ang, trigger: true, viewTick }));
    sim.step();
    expect(sim.drainEvents().some((e) => e.k === 'hit' && e.by === 'a' && e.vic === 'b')).toBe(true);
    // sem compensação (tela atual) erraria
    const sim2 = duel();
    const a2 = sim2.players.get('a')!;
    const b2 = sim2.players.get('b')!;
    for (let i = 0; i < 10; i++) sim2.step();
    const was2 = { x: b2.mover.x, z: b2.mover.z };
    b2.mover.x += 3;
    for (let i = 0; i < 40; i++) sim2.step();
    sim2.drainEvents();
    sim2.pushInput('a', inp({ ...aim({ x: a2.mover.x, y: a2.mover.y, z: a2.mover.z }, was2, a2.mover.y + 1.2), trigger: true, viewTick: sim2.tick }));
    sim2.step();
    expect(sim2.drainEvents().some((e) => e.k === 'hit')).toBe(false);
  });

  it('comprar arma e colete pela entrada funciona no servidor', () => {
    const sim = duel();
    sim.pushInput('a', inp({ cmds: [{ t: 'buy', id: 'ak' }, { t: 'buy', id: 'vesthelm' }] }));
    sim.step();
    const a = sim.players.get('a')!;
    expect(a.loadout.slots[0]?.id).toBe('ak');
    expect(a.armor).toBe(100);
    expect(a.helmet).toBe(true);
  });

  it('granada explosiva machuca quem está perto e credita quem jogou', () => {
    const sim = duel();
    const a = sim.players.get('a')!;
    const b = sim.players.get('b')!;
    b.mover.x = a.mover.x;
    b.mover.z = a.mover.z - 6;
    sim.pushInput('a', inp({ cmds: [{ t: 'buy', id: 'frag' }, { t: 'nade', k: 'frag' }] }));
    sim.step();
    for (let i = 0; i < 40; i++) sim.step();
    // solta o botão para lançar: segura e solta perto de B (força baixa)
    const ang = aim({ x: a.mover.x, y: a.mover.y, z: a.mover.z }, { x: b.mover.x, z: b.mover.z }, 1.2);
    sim.pushInput('a', inp({ ...ang, trigger: true }));
    for (let i = 0; i < 4; i++) sim.step();
    sim.pushInput('a', inp({ ...ang, trigger: false }));
    for (let i = 0; i < 60 * 4; i++) sim.step();
    const evs = sim.drainEvents();
    expect(evs.some((e) => e.k === 'nade' && e.by === 'a')).toBe(true);
    expect(evs.some((e) => e.k === 'boom')).toBe(true);
  });

  it('o quadro tem uma linha por jogador e a partida acaba no tempo, com tabela', () => {
    const sim = new FsNetSim({ minutes: 2, humans: [{ id: 'a', name: 'A' }], bots: 2, rng: createRng('fim') });
    const f = sim.frame();
    expect(f.p.length).toBe(3);
    expect(f.p[0]!.length).toBe(15);
    expect(f.left).toBe(2 * 60 * 60);
    for (let i = 0; i < 2 * 60 * 60 + 5; i++) sim.step();
    expect(sim.over).toBe(true);
    expect(sim.drainEvents().some((e) => e.k === 'over')).toBe(true);
    const rows = sim.results();
    expect(rows.length).toBe(3);
    expect(rows.some((r) => r.winner)).toBe(true);
  });

  it('os bots do servidor andam, lutam entre si e pontuam', () => {
    const sim = new FsNetSim({ minutes: 2, humans: [{ id: 'a', name: 'A' }], bots: 5, rng: createRng('bots') });
    const start = sim.roster.filter((r) => r.bot).map((r) => ({ ...sim.players.get(r.id)!.mover }));
    for (let i = 0; i < 60 * 60; i++) sim.step();
    const moved = sim.roster.filter((r) => r.bot).filter((r, i) => Math.hypot(sim.players.get(r.id)!.mover.x - start[i]!.x, sim.players.get(r.id)!.mover.z - start[i]!.z) > 3).length;
    expect(moved).toBeGreaterThanOrEqual(3);
    const total = [...sim.players.values()].reduce((s, p) => s + p.kills + p.deaths, 0);
    expect(total).toBeGreaterThan(0);
  });
});
