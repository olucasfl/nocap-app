import type { UpgradeId, ChoiceId } from './data';
import type { NhInput, NhWorld } from './world';

/**
 * Robô do Night Hunt (spec 083): joga uma partida inteira sem ninguém tocando na tela.
 * Serve ao simulador de equilíbrio (`nighthunt.sim.ts`) e aos testes de fumaça. Foge de quem chega perto,
 * recolhe cristais, moedas, poções e baús, e escolhe melhorias por uma lista de prioridade.
 */
export const BOT_PRIORITY: readonly UpgradeId[] = [
  'garlic',
  'wand',
  'whip',
  'cross',
  'bomb',
  'magma',
  'embers',
  'bone',
  'runes',
  'pentagram',
  'halo',
  'horizontal',
  'sword',
  'weaponDamage',
  'orbit',
  'lightning',
  'axe',
  'weaponLength',
  'heart',
  'armor',
  'regeneration',
  'tome',
  'boots',
  'swift',
  'growth',
  'greed',
  'duration',
  'amount',
  'magnet',
  'clover',
];
const LOW: readonly UpgradeId[] = ['clover', 'magnet', 'greed'];

export function botInput(w: NhWorld): NhInput {
  const p = w.player;
  let rx = 0;
  let ry = 0;
  let danger = 0;
  for (const e of w.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 240 * 240 || d2 < 1) continue;
    const d = Math.sqrt(d2);
    const wgt = (e.s.damage + 1) / (d2 / 900 + 1);
    rx += (dx / d) * wgt;
    ry += (dy / d) * wgt;
    danger += wgt;
  }
  for (const q of w.projectiles) {
    if (!q.hostile) continue;
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 200 * 200 || d2 < 1) continue;
    const d = Math.sqrt(d2);
    rx += (dx / d) * 2;
    ry += (dy / d) * 2;
  }
  // atração pelos itens: cristais e moedas sempre, poção se estiver machucado, baú e ímã sempre
  let best: { x: number; y: number; s: number } | null = null;
  for (const it of w.items) {
    const dx = it.x - p.x;
    const dy = it.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 520) continue;
    const base =
      it.type === 'chest'
        ? 5
        : it.type === 'health'
          ? p.hp < p.maxHp * 0.7
            ? 4
            : 0.3
          : it.type === 'magnet'
            ? 2.5
            : it.type === 'gold'
              ? 1.4
              : 1;
    const s = base / (d / 80 + 1);
    if (!best || s > best.s) best = { x: dx / (d || 1), y: dy / (d || 1), s };
  }
  let x = rx * 1.6;
  let y = ry * 1.6;
  if (best) {
    const k = danger > 3 ? 0.4 : 1.2;
    x += best.x * k;
    y += best.y * k;
  }
  if (!best && danger < 0.3) {
    // sem nada por perto: anda em círculo largo para juntar a horda e achar itens
    const a = w.t * 0.35;
    x += Math.cos(a);
    y += Math.sin(a);
  }
  const l = Math.hypot(x, y);
  return l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
}

/** Responde à janela aberta (nível ou baú). Devolve o que o robô fez. */
export function botAnswer(w: NhWorld): 'chose' | 'rerolled' | 'banished' | 'none' {
  const pend = w.pending;
  if (!pend) return 'none';
  const opts = pend.options;
  const evo = opts.find((o) => o.startsWith('evo'));
  if (evo) {
    w.choose(evo as ChoiceId);
    return 'chose';
  }
  if (pend.kind === 'levelUp') {
    const rank = (o: ChoiceId) => {
      const i = BOT_PRIORITY.indexOf(o as UpgradeId);
      return i < 0 ? 99 : i;
    };
    const low = opts.find((o) => LOW.includes(o as UpgradeId));
    if (low && w.banishes > 0 && w.levels[low as UpgradeId] === 0 && w.banish(low as UpgradeId))
      return 'banished';
    const top = Math.min(...opts.map(rank));
    if (top > 8 && w.rerolls > 0 && w.reroll()) return 'rerolled';
    // foca no que já tem (para chegar ao máximo e evoluir) e, entre os novos, segue a prioridade
    const owned = (o: ChoiceId) => (w.levels[o as UpgradeId] > 0 ? 0 : 1);
    const pick = [...opts].sort((a, b) => owned(a) - owned(b) || rank(a) - rank(b))[0]!;
    w.choose(pick);
    return 'chose';
  }
  w.choose(opts[0]!);
  return 'chose';
}

/** Joga até morrer ou até `maxSeconds`. */
export function botPlay(w: NhWorld, maxSeconds: number): void {
  const steps = Math.round(maxSeconds * 60);
  for (let i = 0; i < steps && w.alive; i++) {
    while (w.pending) if (botAnswer(w) === 'none') break;
    w.step(botInput(w));
    if (i % 60 === 0) w.drainEvents();
    else w.events.length = 0;
  }
}
