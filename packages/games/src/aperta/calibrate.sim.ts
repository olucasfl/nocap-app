// Ferramenta de calibragem (spec 039): ajusta DUST_GOAL das vidas 1 a 5 até o perfil normal bater com TARGET_HOURS.
// Roda com: CAL=1 pnpm exec vitest run --config vitest.sim.config.ts src/aperta/calibrate.sim.ts
import { it } from 'vitest';
import { DUST_GOAL, TARGET_HOURS } from './economy';
import { simulateAverage } from './sim';

const LIVES = 5;
const SEEDS = Array.from({ length: Number(process.env.CAL_SEEDS ?? 16) }, (_, i) => `c${i}`);

// Só roda com CAL=1, para não entrar no `pnpm sim` comum.
it.skipIf(!process.env.CAL)('calibra', () => {
  const history: { ln: number; h: number }[][] = Array.from({ length: LIVES }, () => []);
  for (let iter = 0; iter < Number(process.env.CAL_ITERS ?? 8); iter++) {
    const { hours } = simulateAverage('normal', SEEDS, LIVES);
    const line = hours.map((h, i) => `${h.toFixed(2)}/${TARGET_HOURS[i]}`).join('  ');
    console.log(`iter ${iter}: ${line}`);
    console.log(`  goals: ${DUST_GOAL.slice(0, LIVES).map((g) => g.toExponential(3)).join(', ')}`);
    let done = true;
    for (let i = 0; i < LIVES; i++) {
      const h = hours[i] as number;
      const target = TARGET_HOURS[i] as number;
      history[i]!.push({ ln: Math.log(DUST_GOAL[i] as number), h });
      if (Math.abs(h - target) / target > 0.04) done = false;
      const pts = history[i]!;
      let slope = 1; // horas por unidade de ln(meta) (chute inicial)
      if (pts.length >= 2) {
        const a = pts[pts.length - 2]!;
        const b = pts[pts.length - 1]!;
        if (Math.abs(b.ln - a.ln) > 1e-6 && (b.h - a.h) / (b.ln - a.ln) > 0.05) slope = (b.h - a.h) / (b.ln - a.ln);
      }
      const step = Math.max(-0.7, Math.min(0.7, (target - h) / slope));
      const next = Math.exp(Math.log(DUST_GOAL[i] as number) + step);
      DUST_GOAL[i] = Math.max(1000, next);
    }
    if (done) break;
  }
  console.log(`FINAL goals: [${DUST_GOAL.slice(0, LIVES).map((g) => g.toExponential(3)).join(', ')}]`);
});
