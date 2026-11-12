/**
 * Painel de desempenho do Fox GP (spec 081, Fase 2.2), só no desenvolvimento e com `?perf=1`: tempo médio e máximo por
 * quadro de cada etapa (simulação, bots, desenho, HUD, rede) e quantos quadros passaram de 33 ms. Os testes leem
 * `window.__gpPerf`.
 */
export type GpPerfPart = 'sim' | 'bots' | 'render' | 'hud' | 'net' | 'frame';

export interface GpPerf {
  frames: number;
  /** Quadros com intervalo acima de 33 ms. */
  over33: number;
  /** Maior intervalo entre quadros (ms). */
  maxGap: number;
  /** Soma e máximo (ms) de cada etapa. */
  sum: Record<GpPerfPart, number>;
  max: Record<GpPerfPart, number>;
  reset(): void;
  add(part: GpPerfPart, ms: number): void;
  /** Fecha o quadro: o intervalo desde o anterior (ms). */
  tick(gapMs: number): void;
  /** Média por quadro (ms) de cada etapa. */
  avg(): Record<GpPerfPart, number>;
}

const PARTS: GpPerfPart[] = ['sim', 'bots', 'render', 'hud', 'net', 'frame'];
const zero = () => Object.fromEntries(PARTS.map((p) => [p, 0])) as Record<GpPerfPart, number>;

export function newGpPerf(): GpPerf {
  const p: GpPerf = {
    frames: 0,
    over33: 0,
    maxGap: 0,
    sum: zero(),
    max: zero(),
    reset() {
      p.frames = 0;
      p.over33 = 0;
      p.maxGap = 0;
      p.sum = zero();
      p.max = zero();
    },
    add(part, ms) {
      p.sum[part] += ms;
      if (ms > p.max[part]) p.max[part] = ms;
    },
    tick(gap) {
      p.frames += 1;
      if (gap > 33.4) p.over33 += 1;
      if (gap > p.maxGap) p.maxGap = gap;
    },
    avg() {
      const out = zero();
      for (const k of PARTS) out[k] = p.frames ? p.sum[k] / p.frames : 0;
      return out;
    },
  };
  return p;
}

/** Ligado? Só no desenvolvimento (o código some do build de produção) e com `?perf=1` ou nos testes. */
export const gpPerfOn = (): boolean =>
  import.meta.env.DEV &&
  typeof location !== 'undefined' &&
  (new URLSearchParams(location.search).get('perf') === '1' ||
    !!(window as unknown as { __gpPerfOn?: boolean }).__gpPerfOn);

/** Texto do painel (uma linha por etapa). */
export function gpPerfText(p: GpPerf): string {
  const a = p.avg();
  const f = (n: number) => n.toFixed(2);
  return [
    `quadros ${p.frames} · >33 ms: ${p.over33} · maior ${p.maxGap.toFixed(1)} ms`,
    ...PARTS.map((k) => `${k.padEnd(6)} ${f(a[k])} ms (máx ${f(p.max[k])})`),
  ].join('\n');
}
