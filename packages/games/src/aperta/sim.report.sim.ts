// Rodado por `pnpm --filter @nocap/games sim` (vitest.sim.config.ts), não pelo `pnpm test`: imprime a tabela de horas por marco (spec 038, 6.5).
import { it } from 'vitest';
import { formatSimReport, simulate } from './sim';

it('imprime o relatório do simulador', () => {
  const collapses = Number(process.env.APERTA_SIM_COLLAPSES ?? 5);
  const results = (['casual', 'normal', 'compulsive'] as const).map((profile) => simulate({ profile, seed: 'report', collapses }));
  console.log(`\n${formatSimReport(results)}\n`);
});
