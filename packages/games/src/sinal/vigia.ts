import { createRng } from '../core/rng';
import {
  LEAD_IN_S,
  POWER_AVISO_MARGIN_S,
  POWER_RECOVERY_S,
  POWER_TIGHT_MARGIN_S,
  POWER_SPECS,
  lerp,
  type CycleKind,
  type PowerKind,
} from './constants';

/**
 * O ciclo do Vigia: de costas (pode andar), aviso (ainda pode), olhando (mexeu, perdeu) e voltando
 * (pode andar de novo). Tudo sai da seed e do tempo, nunca de onde a pessoa está, então a corrida é
 * a mesma para quem jogar a mesma seed. Nada é "sempre igual": os ciclos têm jeitos diferentes
 * (aviso rápido, olhar longo, olhadinha, olhar duplo) e o intervalo entre eles varia bastante.
 * Os poderes só caem no período de costas, avisados antes, e acabam bem antes do próximo olhar:
 * nada deles pode eliminar quem reage ao aviso.
 */

export interface PowerEvent {
  kind: PowerKind;
  /** Aviso do poder, começo e fim do efeito (segundos desde o início da fase). */
  teleStart: number;
  effectStart: number;
  effectEnd: number;
  /** Para os poderes que empurram de lado: -1 ou 1. */
  dir: -1 | 1;
}

/** O segundo olhar do ciclo "duplo": um novo aviso curto e outro olhar logo depois do primeiro. */
export interface Again {
  avisoStart: number;
  lookStart: number;
  lookEnd: number;
}

export interface Cycle {
  kind: CycleKind;
  start: number;
  /** O aviso de olhar começa aqui (o Vigia ainda está de costas). */
  avisoStart: number;
  /** Aqui ele viraria e olharia. */
  lookStart: number;
  lookEnd: number;
  end: number;
  /** Falso aviso: o sinal vem e ele não olha. */
  fake: boolean;
  again?: Again;
  powers: PowerEvent[];
  /** Emboscada: o aviso de olhar vem logo depois do fim do poder (sem a folga de recuperação). */
  tight?: boolean;
}

export interface TimelineParams {
  /** Dificuldade (0 a 1) no instante t. */
  dAt(t: number): number;
  pFake(d: number, t: number): number;
  /** Chance de haver poder num ciclo (quando o intervalo mínimo já passou). */
  pPower(d: number, t: number): number;
  /** Intervalo mínimo entre o fim de um poder e o próximo, em segundos. */
  minGap(d: number): number;
  pool(t: number): readonly PowerKind[];
  /** Quantos poderes seguidos cabem num ciclo. */
  chain(t: number): number;
  /** Os chefes ficam mais tempo de costas (mais espaço para soltar poderes). */
  costasScale: number;
}

/** Os pesos de cada jeito de olhar: já variados desde o começo e mais agressivos com a dificuldade. */
export function kindWeights(d: number): Record<CycleKind, number> {
  return {
    normal: 1,
    longo: 0.3,
    espia: 0.2 + 0.2 * d,
    rapido: 0.15 + 0.6 * d,
    duplo: 0.1 + 0.5 * d,
  };
}

function pickKind(d: number, r: number): CycleKind {
  const w = kindWeights(d);
  const total = w.normal + w.longo + w.espia + w.rapido + w.duplo;
  let x = r * total;
  for (const k of ['normal', 'longo', 'espia', 'rapido', 'duplo'] as CycleKind[]) {
    x -= w[k];
    if (x < 0) return k;
  }
  return 'normal';
}

export class VigiaTimeline {
  readonly cycles: Cycle[] = [];
  private readonly rng: () => number;
  private lastPowerEnd = -Infinity;

  constructor(
    readonly params: TimelineParams,
    seedKey: string,
  ) {
    this.rng = createRng(seedKey);
  }

  private generate() {
    const p = this.params;
    const last = this.cycles[this.cycles.length - 1];
    const start = last ? last.end : LEAD_IN_S;
    // Sempre os mesmos sorteios por ciclo, qualquer que seja o resultado: a corrida não "desanda".
    const [costJ, lookJ, fakeR, powR, offR, dirR, kindR, kind2R, calmR, kindPickR, tightR] = Array.from(
      { length: 11 },
      () => this.rng(),
    );
    const d = p.dAt(start);
    const fake = fakeR! < p.pFake(d, start);
    const kind: CycleKind = fake ? 'normal' : pickKind(d, kindPickR!);

    // Quanto tempo de costas: varia bastante (0,6x a 1,5x), e às vezes é uma pausa longa.
    let costas =
      lerp(5.6, 2.0, d) * (0.6 + 0.9 * costJ!) * p.costasScale * (calmR! < 0.12 ? 1.6 : 1);
    costas = Math.max(1.4, costas);

    // O jeito de olhar
    let aviso = lerp(0.95, 0.45, d);
    let look = lerp(1.3, 2.6, d) * (0.9 + 0.2 * lookJ!);
    if (kind === 'rapido') {
      aviso = lerp(0.42, 0.3, d);
      look = lerp(0.9, 1.4, d);
    } else if (kind === 'longo') {
      look = lerp(2.6, 3.8, d) * (0.9 + 0.2 * lookJ!);
    } else if (kind === 'espia') {
      look = 0.4 + 0.2 * lookJ!;
    } else if (kind === 'duplo') {
      look = lerp(0.8, 1.2, d);
    }
    if (fake) look = 0;

    // Os poderes: se o ciclo vai ter poder, o tempo de costas é esticado para caber.
    const powers: PowerEvent[] = [];
    let tight = false;
    const wantPower = powR! < p.pPower(d, start) && start >= this.lastPowerEnd + p.minGap(d);
    if (wantPower) {
      const pool = p.pool(start);
      if (pool.length > 0) {
        const firstIdx = Math.floor(kindR! * pool.length);
        const kinds: PowerKind[] = [pool[firstIdx]!];
        if (p.chain(start) >= 2 && pool.length > 1) {
          let second = Math.floor(kind2R! * pool.length);
          if (second === firstIdx) second = (second + 1) % pool.length;
          kinds.push(pool[second]!);
        }
        let cursor = start + 0.5 + offR! * 0.8;
        const planned: { kind: PowerKind; teleStart: number; effectStart: number; effectEnd: number }[] = [];
        for (const k of kinds) {
          const spec = POWER_SPECS[k];
          const effectStart = cursor + spec.tele;
          const effectEnd = effectStart + spec.effect;
          planned.push({ kind: k, teleStart: cursor, effectStart, effectEnd });
          cursor = effectEnd + 0.4;
        }
        // O tempo de costas cresce até o último poder acabar com folga antes do aviso.
        const need = planned[planned.length - 1]!.effectEnd - start + POWER_AVISO_MARGIN_S + 0.4;
        costas = Math.max(costas, need);
        // De vez em quando o Vigia vira logo depois do poder (emboscada): o aviso ainda toca, e o
        // efeito já acabou, então dá para parar, mas a folga é curta.
        if (tightR! < lerp(0.2, 0.45, d)) {
          tight = true;
          costas = planned[planned.length - 1]!.effectEnd - start + POWER_TIGHT_MARGIN_S;
        }
        planned.forEach((q, i) =>
          powers.push({ ...q, dir: ((dirR! < 0.5 ? -1 : 1) * (i % 2 ? -1 : 1)) as -1 | 1 }),
        );
      }
    }

    const avisoStart = start + costas;
    const lookStart = avisoStart + aviso;
    const lookEnd = lookStart + look;
    let again: Again | undefined;
    let end = lookEnd + (fake ? 0.5 : 0.35);
    if (kind === 'duplo' && !fake) {
      const a2 = lookEnd + 0.25;
      const l2 = a2 + 0.3;
      again = { avisoStart: a2, lookStart: l2, lookEnd: l2 + lerp(0.8, 1.2, d) };
      end = again.lookEnd + 0.35;
    }
    // Garantia de equidade (o sorteio acima já deixa folga; isto confere).
    const limit = tight
      ? avisoStart - POWER_TIGHT_MARGIN_S + 1e-9
      : Math.min(lookStart - POWER_RECOVERY_S, avisoStart - POWER_AVISO_MARGIN_S);
    while (powers.length > 0 && powers[powers.length - 1]!.effectEnd > limit) powers.pop();
    if (powers.length > 0) this.lastPowerEnd = powers[powers.length - 1]!.effectEnd;

    this.cycles.push({ kind, start, avisoStart, lookStart, lookEnd, end, fake, again, powers, tight: tight && powers.length > 0 });
  }

  /** O ciclo que está valendo no instante `t` (segundos). */
  cycleAt(t: number): Cycle {
    while (this.cycles.length === 0 || this.cycles[this.cycles.length - 1]!.end <= t) {
      this.generate();
      if (this.cycles.length > 100_000) break;
    }
    let lo = 0;
    let hi = this.cycles.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cycles[mid]!.end <= t) lo = mid + 1;
      else hi = mid;
    }
    return this.cycles[lo]!;
  }

  /** Os ciclos até o instante `t` (para quem quer inspecionar a linha do tempo). */
  upTo(t: number): Cycle[] {
    this.cycleAt(t);
    return this.cycles.filter((c) => c.start <= t);
  }
}

export type VigiaState = 'costas' | 'aviso' | 'olhando' | 'voltando';

export function stateAt(cycle: Cycle, t: number): VigiaState {
  if (t < cycle.avisoStart) return 'costas';
  if (t < cycle.lookStart) return 'aviso';
  if (!cycle.fake && t < cycle.lookEnd) return 'olhando';
  const a = cycle.again;
  if (a) {
    if (t >= a.avisoStart && t < a.lookStart) return 'aviso';
    if (t >= a.lookStart && t < a.lookEnd) return 'olhando';
  }
  return 'voltando';
}

/** O olhar que está valendo agora (o do começo do ciclo ou o segundo do olhar duplo). */
export function activeLook(cycle: Cycle, t: number): { start: number; end: number } | null {
  if (!cycle.fake && t >= cycle.lookStart && t < cycle.lookEnd) {
    return { start: cycle.lookStart, end: cycle.lookEnd };
  }
  const a = cycle.again;
  if (a && t >= a.lookStart && t < a.lookEnd) return { start: a.lookStart, end: a.lookEnd };
  return null;
}
