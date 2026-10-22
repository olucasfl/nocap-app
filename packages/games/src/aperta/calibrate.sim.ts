// Ferramenta de calibragem (spec 040): acha a meta de poeira de cada vida para o perfil normal ficar no alvo de horas.
// Roda com: CAL=1 pnpm exec vitest run --config vitest.sim.config.ts src/aperta/calibrate.sim.ts
// Variáveis: CAL_LIVES (padrão 40), CAL_SEEDS (16), CAL_ITERS (8), CAL_HOURS (1.8), CAL_GROWTH (0.02, depois do 15º).
import { it } from 'vitest';
import { GOAL_SEGMENTS, LIFE_BAND_LAST_COLLAPSE, dustGoal } from './economy';
import { simulateAverage } from './sim';

const LIVES = Number(process.env.CAL_LIVES ?? 40);
const SEEDS = Array.from({ length: Number(process.env.CAL_SEEDS ?? 16) }, (_, i) => `c${i}`);
const BASE_HOURS = Number(process.env.CAL_HOURS ?? 1.8);
const GROWTH = Number(process.env.CAL_GROWTH ?? 0.02);

const target = (k: number): number => (k <= LIVES && k <= LIFE_BAND_LAST_COLLAPSE ? BASE_HOURS : BASE_HOURS * Math.pow(1 + GROWTH, k - LIFE_BAND_LAST_COLLAPSE));

function apply(goals: number[]): void {
  GOAL_SEGMENTS.length = 0;
  for (let k = 2; k <= LIVES; k++) GOAL_SEGMENTS.push({ upTo: k, ratio: (goals[k - 1] as number) / (goals[k - 2] as number) });
  GOAL_SEGMENTS.push({ upTo: Infinity, ratio: 1.1 });
}

// Só roda com CAL=1, para não entrar no `pnpm sim` comum.
it.skipIf(!process.env.CAL)('calibra', () => {
  // Ponto de partida: as metas de hoje com o salto do 2º colapso multiplicado por CAL_M (padrão 3,5).
  GOAL_SEGMENTS[0]!.ratio *= Number(process.env.CAL_M ?? 3.5);
  const goals: number[] = Array.from({ length: LIVES }, (_, i) => dustGoal(i + 1));
  const history: { ln: number; h: number }[][] = Array.from({ length: LIVES }, () => []);
  for (let iter = 0; iter < Number(process.env.CAL_ITERS ?? 8); iter++) {
    apply(goals);
    const { hours } = simulateAverage('normal', SEEDS, LIVES, Number(process.env.CAL_MAXH ?? 12));
    console.log(`iter ${iter}: ${hours.map((h, i) => `${h.toFixed(2)}/${target(i + 1).toFixed(2)}`).join('  ')}`);
    console.log(`  goals: [${goals.map((g) => g.toExponential(3)).join(', ')}]`);
    for (let i = 1; i < LIVES; i++) {
      const h = hours[i] as number;
      const t = target(i + 1);
      history[i]!.push({ ln: Math.log(goals[i] as number), h });
      const pts = history[i]!;
      let slope = t / 2;
      if (pts.length >= 2) {
        const a = pts[pts.length - 2]!;
        const b = pts[pts.length - 1]!;
        if (Math.abs(b.ln - a.ln) > 1e-6 && (b.h - a.h) / (b.ln - a.ln) > 0.05) slope = (b.h - a.h) / (b.ln - a.ln);
      }
      const step = Math.max(-0.6, Math.min(0.6, ((t - h) / slope) * 0.8));
      goals[i] = Math.exp(Math.log(goals[i] as number) + step);
    }
    // As metas só crescem: uma vida nunca pede menos poeira que a anterior.
    for (let i = 1; i < LIVES; i++) goals[i] = Math.max(goals[i] as number, (goals[i - 1] as number) * 1.02);
  }
  console.log(`FINAL goals: [${goals.map((g) => g.toExponential(3)).join(', ')}]`);
}, 3_600_000);
