// Rodado por `pnpm --filter @nocap/games sim` (vitest.sim.config.ts), não pelo `pnpm test`: imprime a tabela de horas por marco (spec 038, 6.5)
// e a tabela das 3 perfis da spec 040 (média de várias sementes). Variáveis: APERTA_SIM_COLLAPSES (40) e APERTA_SIM_SEEDS (12).
import { it } from 'vitest';
import { PROFILES, formatAverageTable, formatSimReport, simulate, simulateAverage } from './sim';

it('imprime o relatório do simulador', () => {
  const collapses = Number(process.env.APERTA_SIM_COLLAPSES ?? 40);
  const seeds = Array.from({ length: Number(process.env.APERTA_SIM_SEEDS ?? 12) }, (_, i) => `r${i}`);
  const results = (['casual', 'normal', 'active'] as const).map((profile) => simulate({ profile, seed: 'report', collapses: Math.min(collapses, 6) }));
  console.log(`\n${formatSimReport(results)}\n`);
  const hours: Partial<Record<keyof typeof PROFILES, number[]>> = {};
  for (const id of ['casual', 'normal', 'active'] as const) hours[id] = simulateAverage(id, seeds, collapses, 80).hours;
  console.log(`\nMédia de ${seeds.length} sementes\n${formatAverageTable(hours)}\n`);
});
