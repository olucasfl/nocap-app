import { createRng } from '../core/rng';
import {
  LEAD_IN_S,
  POWER_AVISO_MARGIN_S,
  POWER_RECOVERY_S,
  POWER_SPECS,
  lerp,
  type PowerKind,
} from './constants';

/**
 * O ciclo do Vigia: de costas (pode andar), aviso (ainda pode), olhando (mexeu, perdeu) e voltando
 * (pode andar de novo). Tudo sai da seed e do tempo, nunca de onde a pessoa está, então a corrida é
 * a mesma para quem jogar a mesma seed. Os poderes só caem no período de costas, avisados antes,
 * e acabam bem antes do próximo olhar: nada deles pode eliminar quem reage ao aviso.
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

export interface Cycle {
  start: number;
  /** O aviso de olhar começa aqui (o Vigia ainda está de costas). */
  avisoStart: number;
  /** Aqui ele viraria e olharia. */
  lookStart: number;
  lookEnd: number;
  end: number;
  /** Falso aviso: o sinal vem e ele não olha. */
  fake: boolean;
  powers: PowerEvent[];
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
    const [costJ, lookJ, fakeR, powR, offR, dirR, kindR, kind2R] = Array.from(
      { length: 8 },
      () => this.rng(),
    );
    const d = p.dAt(start);
    const costas = lerp(5.6, 2.0, d) * (0.85 + 0.3 * costJ!) * p.costasScale;
    const aviso = lerp(0.95, 0.45, d);
    const fake = fakeR! < p.pFake(d, start);
    const look = fake ? 0 : lerp(1.3, 2.6, d) * (0.9 + 0.2 * lookJ!);
    const avisoStart = start + costas;
    const lookStart = avisoStart + aviso;
    const lookEnd = lookStart + look;
    const end = lookEnd + (fake ? 0.5 : 0.35);

    const powers: PowerEvent[] = [];
    const limit = Math.min(lookStart - POWER_RECOVERY_S, avisoStart - POWER_AVISO_MARGIN_S);
    if (powR! < p.pPower(d, start) && start >= this.lastPowerEnd + p.minGap(d)) {
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
        kinds.forEach((kind, i) => {
          const spec = POWER_SPECS[kind];
          const effectStart = cursor + spec.tele;
          const effectEnd = effectStart + spec.effect;
          if (effectEnd > limit) return;
          powers.push({
            kind,
            teleStart: cursor,
            effectStart,
            effectEnd,
            dir: (dirR! < 0.5 ? -1 : 1) * (i % 2 ? -1 : 1) as -1 | 1,
          });
          cursor = effectEnd + 0.4;
        });
        if (powers.length > 0) this.lastPowerEnd = powers[powers.length - 1]!.effectEnd;
      }
    }
    this.cycles.push({ start, avisoStart, lookStart, lookEnd, end, fake, powers });
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
  return 'voltando';
}
