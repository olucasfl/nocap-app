// Config só do simulador: `pnpm --filter @nocap/games sim` imprime a tabela de horas (spec 038, 6.5).
// Fica fora do `pnpm test` porque a simulação de várias vidas leva dezenas de segundos.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.sim.ts'], testTimeout: 600_000 },
});
