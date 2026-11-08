import { expect, it } from 'vitest';
import { FsNetSim } from './netsim';
import { fsPreloadMap } from './maps';
import { FsLoadout } from './gun';
import { fsClearLine } from './grenades';
import { fsEyeHeight } from './movement';
it('Duna: sniper parado mirando em alguém parado acerta sempre que o tiro sai (servidor)', async () => {
  await fsPreloadMap('duna');
  const sim = new FsNetSim({ minutes: 5, humans: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], bots: 0, map: 'duna' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const P = (sim as unknown as { players: Map<string, any> }).players;
  const map = sim.map;
  const sp = map.spawns;
  let seed = 3; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let SEQ = 0, nofire = 0;
  let tot = 0, hit = 0; const bad: string[] = [];
  for (let n = 0; n < 5000 && tot < 60; n++) {
    const s1 = sp[Math.floor(rnd() * sp.length)]!, s2 = sp[Math.floor(rnd() * sp.length)]!;
    const d = Math.hypot(s1.x - s2.x, s1.z - s2.z);
    if (d < 6 || d > 45) continue;
    const a = P.get('a'), b = P.get('b');
    a.loadout = new FsLoadout('sniper', 'pistol');
    for (const [p, s] of [[a, s1], [b, s2]] as const) { p.mover.x = s.x; p.mover.y = s.y; p.mover.z = s.z; p.mover.vx = p.mover.vy = p.mover.vz = 0; p.mover.onGround = true; p.shieldUntil = 0; p.alive = true; p.hp = 100; p.hist.length = 0; }
    for (let k = 0; k < 30; k++) sim.step();
    const eye: [number, number, number] = [a.mover.x, a.mover.y + fsEyeHeight(a.mover), a.mover.z];
    const tgt: [number, number, number] = [b.mover.x, b.mover.y + 0.9, b.mover.z];
    if (!fsClearLine(map.solids, eye, tgt)) continue;
    const dx = tgt[0] - eye[0], dy = tgt[1] - eye[1], dz = tgt[2] - eye[2];
    const yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI, pitch = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
    a.loadout.slot.gun.since = 99; a.loadout.drawT = 0;
    const hp0 = b.hp;
    const base = { fwd: 0, strafe: 0, jump: false, crouch: false, walk: false, yaw, pitch, reload: false, inspect: false, viewTick: sim.tick, cmds: [] };
    sim.pushInput('a', { ...base, seq: ++SEQ, trigger: false, alt: true });
    for (let k = 0; k < 40; k++) sim.step();
    sim.pushInput('a', { ...base, seq: ++SEQ, trigger: true, alt: true, viewTick: sim.tick });
    sim.step();
    tot++; const fired = a.loadout.slot.ammo < 5; if (!fired) nofire++;
    sim.pushInput('a', { ...base, seq: ++SEQ, trigger: false, alt: false });
    for (let k = 0; k < 5; k++) sim.step();
    if (b.hp < hp0 || !b.alive) hit++; else if (fired && bad.length < 6) bad.push(`d=${d.toFixed(1)} a=${s1.x.toFixed(1)},${s1.z.toFixed(1)} b=${s2.x.toFixed(1)},${s2.z.toFixed(1)} hp=${b.hp} wid=${a.loadout.weapon.id} ammo=${a.loadout.slot.ammo}`);
  }
  expect(tot - nofire, 'tiros dados').toBeGreaterThan(20);
  expect(hit, bad.join(' | ')).toBe(tot - nofire);
}, 120000);
