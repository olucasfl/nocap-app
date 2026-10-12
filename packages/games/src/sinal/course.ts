import { createRng } from '../core/rng';
import {
  BOSS_POWERS,
  COVER_DURABILITY,
  COVER_FRAGILE,
  HALF,
  OWN_POWER,
  SINAL_MAPS,
  lerp,
  type PowerKind,
  type SinalMapId,
  type SinalMode,
} from './constants';
import type { TimelineParams } from './vigia';

/**
 * A pista de uma partida. No Infinito é uma só, sem fim. No Clássico cada fase é uma pista com
 * linha de chegada: 4 fases e o chefe, num mapa; passou, vem outro mapa sorteado, sem repetir até
 * fechar os três, e então tudo volta ao primeiro, cada vez mais difícil.
 */

export interface Course {
  mode: SinalMode;
  /** Número da fase na corrida (1, 2, 3...). No Infinito é sempre 1. */
  n: number;
  map: SinalMapId;
  boss: boolean;
  /** Linha de chegada em metros (Infinity no Infinito). */
  length: number;
  /** Quanto a escuridão começa atrás da largada (m). */
  darkStart: number;
}

export const PHASES_PER_MAP = 5; // 4 fases e o chefe

/** A ordem dos mapas numa corrida do Clássico: os três, sem repetir, e depois tudo de novo. */
export function mapOrder(seed: string): SinalMapId[] {
  const rng = createRng(`${seed}:mapas`);
  const maps = [...SINAL_MAPS];
  for (let i = maps.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [maps[i], maps[j]] = [maps[j]!, maps[i]!];
  }
  return maps;
}

export function classicoCourse(seed: string, n: number): Course {
  const order = mapOrder(seed);
  const round = Math.floor((n - 1) / PHASES_PER_MAP);
  const boss = (n - 1) % PHASES_PER_MAP === PHASES_PER_MAP - 1;
  const base = 100 + 20 * n;
  return {
    mode: 'classico',
    n,
    map: order[round % order.length]!,
    boss,
    length: Math.round(boss ? base * 1.6 : base),
    darkStart: 50,
  };
}

export function infinitoCourse(seed: string): Course {
  const rng = createRng(`${seed}:mapa`);
  return {
    mode: 'infinito',
    n: 1,
    map: SINAL_MAPS[Math.floor(rng() * SINAL_MAPS.length)]!,
    boss: false,
    length: Infinity,
    darkStart: 60,
  };
}

export function courseFor(seed: string, mode: SinalMode, n: number): Course {
  return mode === 'infinito' ? infinitoCourse(seed) : classicoCourse(seed, n);
}

/** Dificuldade (0 a 1) de uma fase do Clássico: sobe com o número da fase, sem nunca chegar a 1. */
export function phaseDifficulty(n: number, boss: boolean): number {
  const d = n / (n + 9);
  return boss ? Math.min(0.97, d + 0.1) : d;
}

/** Os parâmetros do Vigia de uma pista (os tempos e os poderes). */
export function timelineParams(course: Course): TimelineParams {
  if (course.mode === 'infinito') {
    // Tudo cresce com o tempo de corrida: o Vigia mais ligeiro, mais falsos avisos, poderes variados.
    const own = OWN_POWER[course.map];
    return {
      dAt: (t) => t / (t + 300),
      pFake: (d, t) => (t < 60 ? 0 : lerp(0.08, 0.25, d)),
      pPower: (_d, t) => (t < 20 ? 0 : 0.55),
      minGap: (d) => lerp(14, 8, d),
      pool: (t): PowerKind[] => {
        const pool: PowerKind[] = [own];
        if (t >= 60) pool.push('rajada', 'cortina');
        if (t >= 120) pool.push('lama', 'invertido');
        if (t >= 180) pool.push('apagao', 'chuva');
        return pool;
      },
      chain: () => 1,
      costasScale: 1,
    };
  }
  const d = phaseDifficulty(course.n, course.boss);
  const own = OWN_POWER[course.map];
  if (course.boss) {
    return {
      dAt: () => d,
      pFake: () => lerp(0.15, 0.3, d),
      pPower: () => 0.9,
      minGap: () => 4,
      pool: () => [...BOSS_POWERS, own],
      chain: () => 2,
      costasScale: 1.6,
    };
  }
  return {
    dAt: () => d,
    pFake: () => (course.n < 3 ? 0 : lerp(0.1, 0.25, d)),
    pPower: () => (course.n < 2 ? 0 : 0.6),
    minGap: () => 12,
    pool: () => [own],
    chain: () => 1,
    costasScale: 1,
  };
}

// ---- esconderijos --------------------------------------------------------------

export interface CoverDef {
  id: number;
  x: number;
  y: number;
  fragile: boolean;
  /** Quanto aguenta, em segundos. */
  max: number;
}

/**
 * Os esconderijos ao longo da pista, gerados à medida que a pessoa avança. Pequenos, espaçados
 * (cada vez mais) e com a posição lateral sempre mudando: nunca formam fila de um até o outro.
 */
export class CoverField {
  readonly list: CoverDef[] = [];
  private readonly rng: () => number;
  private nextY = 0;
  private sign = 0;

  constructor(
    private readonly course: Course,
    seedKey: string,
  ) {
    this.rng = createRng(seedKey);
    this.nextY = 16 + this.rng() * 10;
  }

  private dAt(y: number): number {
    return this.course.mode === 'infinito'
      ? y / (y + 700)
      : phaseDifficulty(this.course.n, this.course.boss);
  }

  /** Garante os esconderijos até a altura `untilY`. */
  ensure(untilY: number) {
    while (this.nextY <= untilY) {
      const d = this.dAt(this.nextY);
      const [gapR, xR, fragR] = [this.rng(), this.rng(), this.rng()];
      const side = HALF - 1.6;
      // Troca de lado a cada esconderijo: nunca um atrás do outro.
      this.sign = this.sign === 0 ? (xR < 0.5 ? -1 : 1) : -this.sign;
      const x = this.sign * (1.8 + ((xR * 7.13) % 1) * (side - 1.8));
      const fragileFrom = this.course.mode === 'classico' ? this.course.n >= 4 : d > 0.2;
      const fragile = fragileFrom && fragR < lerp(0.1, 0.5, d);
      this.list.push({
        id: this.list.length,
        x,
        y: this.nextY,
        fragile,
        max: fragile ? COVER_FRAGILE : COVER_DURABILITY,
      });
      // O espaço entre eles cresce com a dificuldade.
      this.nextY += lerp(lerp(22, 34, d), lerp(45, 80, d), gapR);
    }
  }
}
