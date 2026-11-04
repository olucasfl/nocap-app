import { describe, expect, it } from 'vitest';
import { fsDamage, fsIsBackstab, fsKills, FS_HP, type FsHitInfo } from './damage';
import { FsLoadout } from './gun';
import { FS_SHOP, fsBuy } from './shop';
import { FS_ARENA, type FsBox } from './map';
import { fsBodyHeight, fsEyeHeight, fsNewMover, fsQuiet, fsStepMover, FS_MOVE } from './movement';
import { fsFire, fsNewGunState, fsSpreadDeg } from './recoil';
import { fsDir, fsTrace, type FsBody } from './trace';
import { FS_HEAR_RANGE, FS_WEAPONS } from './weapons';
import { FS_BOTS, FS_SHOOTER, fsBotStep, fsNewBot, fsNewShooter, fsShooterStep } from './bots';
import { fsAssister } from './assist';

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
    expect(real.map((i) => i.id).sort()).toEqual(['ak', 'm4', 'pistol', 'shotgun', 'smg', 'sniper', 'usp', 'vest', 'vesthelm']);
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
    const a = run('b1', 3).st.x - -18;
    const b = run('b2', 3).st.x - -18;
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

describe('atiradores', () => {
  it('só atiram vendo você e dentro do alcance; o fuzil em rajadas, a sniper devagar', () => {
    const run = (w: 'pistol' | 'ak' | 'sniper', dist: number, sees: boolean, secs = 10) => {
      const st = fsNewShooter();
      let n = 0;
      for (let i = 0; i < secs * 60; i++) if (fsShooterStep(st, w, 1 / 60, dist, sees)) n++;
      return n;
    };
    expect(run('ak', 20, false)).toBe(0);
    expect(run('ak', 60, true)).toBe(0); // fora do alcance
    expect(run('pistol', 30, true)).toBe(0);
    expect(run('ak', 20, true)).toBeGreaterThan(run('pistol', 20, true));
    expect(run('sniper', 20, true)).toBeLessThan(run('pistol', 20, true));
    expect(run('sniper', 70, true)).toBeGreaterThan(0); // a sniper alcança longe
    expect(FS_SHOOTER.sniper.range).toBeGreaterThan(FS_SHOOTER.ak.range);
    expect(FS_SHOOTER.ak.range).toBeGreaterThan(FS_SHOOTER.pistol.range);
  });
  it('o alcance do som: pistola menor, fuzil maior, sniper maior ainda', () => {
    expect(FS_HEAR_RANGE.pistol).toBeLessThan(FS_HEAR_RANGE.ak);
    expect(FS_HEAR_RANGE.ak).toBeLessThan(FS_HEAR_RANGE.sniper);
    expect(FS_BOTS.filter((b) => b.kind === 'shoot').map((b) => b.weapon)).toEqual(['pistol', 'ak', 'sniper']);
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
