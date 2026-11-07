import { describe, expect, it } from 'vitest';
import { FsBombMatch, fsBombConfig, FS_BOMB_DEFAULTS } from './bomb';

function mk(cfg = {}) {
  const m = new FsBombMatch(cfg);
  for (const id of ['t1', 't2']) m.addPlayer(id, 'tr');
  for (const id of ['c1', 'c2']) m.addPlayer(id, 'ct');
  m.startRound();
  return m;
}
const live = (m: FsBombMatch) => m.step(m.cfg.buySec + 0.01);

describe('modo Bomba', () => {
  it('opções com undefined ou NaN usam o padrão (regressão: o round acabava na hora)', () => {
    const c = fsBombConfig({ winRounds: undefined, roundSec: undefined, buySec: NaN });
    expect(c.roundSec).toBe(115);
    expect(c.buySec).toBe(15);
    expect(c.winRounds).toBe(8);
  });

  it('opções ficam dentro da faixa', () => {
    expect(fsBombConfig({ winRounds: 99, buySec: 1, roundSec: 999 })).toMatchObject({ winRounds: 13, buySec: 5, roundSec: 180 });
  });

  it('só compra na base e na fase de compra, com dinheiro finito', () => {
    const m = mk();
    expect(m.buy('t1', 200, false)).toBe(false);
    expect(m.buy('t1', 900, true)).toBe(false); // só tem 800
    expect(m.buy('t1', 200, true)).toBe(true);
    expect(m.players.get('t1')!.money).toBe(600);
    live(m);
    expect(m.phase).toBe('live');
    expect(m.buy('t1', 100, true)).toBe(false);
  });

  it('CT vence por tempo e recebe a vitória; TR recebe o bônus de derrota crescente', () => {
    const m = mk();
    live(m);
    m.step(m.cfg.roundSec + 0.1);
    expect(m.lastRound).toEqual({ winner: 'ct', reason: 'time' });
    expect(m.players.get('c1')!.money).toBe(800 + 3250);
    expect(m.players.get('t1')!.money).toBe(800 + 1400);
    m.nextRound();
    live(m);
    m.step(m.cfg.roundSec + 0.1);
    expect(m.players.get('t1')!.money).toBe(800 + 1400 + 1900);
  });

  it('abate rende por arma e nada por abate em aliado', () => {
    const m = mk();
    live(m);
    m.kill('t1', 'c1', 'smg');
    expect(m.players.get('t1')!.money).toBe(800 + 600);
    m.kill('t1', 't2', 'ak');
    expect(m.players.get('t1')!.money).toBe(800 + 600);
  });

  it('TR todos mortos sem bomba: CT vence; CT todos mortos: TR vence', () => {
    const a = mk();
    live(a);
    a.kill('c1', 't1', 'ak');
    a.kill('c1', 't2', 'ak');
    expect(a.lastRound).toEqual({ winner: 'ct', reason: 'elim' });
    const b = mk();
    live(b);
    b.kill('t1', 'c1', 'ak');
    b.kill('t1', 'c2', 'ak');
    expect(b.lastRound).toEqual({ winner: 'tr', reason: 'elim' });
  });

  it('só o portador planta; planta em 3,2 s, bomba explode e o TR vence com 3500', () => {
    const m = mk();
    live(m);
    const who = m.carrier!;
    const other = who === 't1' ? 't2' : 't1';
    m.plant(other, true, 'A', 5);
    expect(m.phase).toBe('live');
    m.plant(who, true, null, 5); // fora do pátio
    expect(m.phase).toBe('live');
    m.plant(who, true, 'A', 1.6);
    m.plant(who, false, 'A', 0.1); // soltou: perde o progresso
    expect(m.plantProgress).toBe(0);
    m.plant(who, true, 'A', 3.3);
    expect(m.phase).toBe('planted');
    expect(m.site).toBe('A');
    expect(m.players.get(who)!.money).toBe(800 + 300);
    m.step(m.cfg.bombSec + 0.1);
    expect(m.lastRound).toEqual({ winner: 'tr', reason: 'bomb' });
    expect(m.players.get(other)!.money).toBe(800 + 3500);
  });

  it('desarmar leva 10 s (5 s com kit) e dá a vitória ao CT; TR morto com bomba plantada não encerra', () => {
    const m = mk();
    live(m);
    const who = m.carrier!;
    m.plant(who, true, 'B', 3.3);
    m.kill('c1', 't1', 'ak');
    m.kill('c1', 't2', 'ak');
    expect(m.phase).toBe('planted');
    m.defuse('t1', true, true, 20); // TR não desarma
    expect(m.phase).toBe('planted');
    m.defuse('c1', true, true, 9);
    expect(m.phase).toBe('planted');
    m.defuse('c1', true, true, 1.1);
    expect(m.lastRound).toEqual({ winner: 'ct', reason: 'defuse' });
    const k = mk();
    live(k);
    k.plant(k.carrier!, true, 'A', 3.3);
    k.giveKit('c1');
    k.defuse('c1', true, true, 5.1);
    expect(k.lastRound?.reason).toBe('defuse');
  });

  it('TR perde mas plantou: todos os TR ganham o extra da bomba', () => {
    const m = mk();
    live(m);
    m.plant(m.carrier!, true, 'A', 3.3);
    m.defuse('c1', true, true, 10.1);
    expect(m.players.get('t2')!.money).toBe(800 + 1400 + 800);
  });

  it('troca de lado na metade zera o dinheiro, e a partida acaba ao chegar em N rounds', () => {
    const m = mk({ winRounds: 3 });
    const win = (side: 'tr' | 'ct') => {
      live(m);
      if (side === 'ct') m.step(m.cfg.roundSec + 0.1);
      else {
        m.kill('t1', 'c1', 'ak');
        m.kill('t1', 'c2', 'ak');
      }
    };
    win('ct');
    m.nextRound();
    win('ct');
    m.nextRound(); // metade (N-1 = 2 rounds jogados): troca de lado
    expect(m.players.get('t1')!.side).toBe('ct');
    expect(m.players.get('t1')!.money).toBe(FS_BOMB_DEFAULTS.startMoney);
    expect(m.score).toEqual({ tr: 2, ct: 0 }); // o placar acompanha os times, não os lados
    live(m);
    m.kill('c1', 't1', 'ak'); // c1/c2 agora são TR e já tinham 2 rounds
    m.kill('c1', 't2', 'ak');
    expect(m.phase).toBe('over');
    expect(m.winner).toBe('tr');
  });

  it('dinheiro respeita o teto', () => {
    const m = mk({ startMoney: 15900 });
    live(m);
    m.step(m.cfg.roundSec + 0.1);
    expect(m.players.get('c1')!.money).toBe(16000);
  });

  it('o portador larga a bomba e outro terrorista pega; morrer também larga a bomba', () => {
    const m = mk();
    live(m);
    const first = m.carrier!;
    const other = first === 't1' ? 't2' : 't1';
    expect(m.dropBomb('c1')).toBe(false); // só quem leva larga
    expect(m.dropBomb(first)).toBe(true);
    expect(m.carrier).toBeNull();
    expect(m.dropped).toBe(true);
    expect(m.pickBomb('c1')).toBe(false); // CT não pega
    expect(m.pickBomb(other)).toBe(true);
    expect(m.carrier).toBe(other);
    expect(m.dropped).toBe(false);
    // quem leva morre: a bomba cai e fica no chão até alguém pegar
    m.kill('c1', other, 'ak');
    expect(m.carrier).toBeNull();
    expect(m.dropped).toBe(true);
    expect(m.pickBomb(other)).toBe(false); // morto não pega
    expect(m.pickBomb(first)).toBe(true);
    // plantar com a bomba pega do chão
    m.plant(first, true, 'A', 3.3);
    expect(m.phase).toBe('planted');
    expect(m.pickBomb(first)).toBe(false); // depois de plantada não se pega mais
  });
});
