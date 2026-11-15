/**
 * As 21 fases embutidas, para o servidor simular as salas do Mini Golf (spec 082). O app web NÃO usa isto: ele baixa cada
 * fase sob demanda (`import.meta.glob`); o pacote é `sideEffects: false`, então o bundle do web descarta estes dados.
 */
import l1 from './levels/level-1.json';
import l2 from './levels/level-2.json';
import l3 from './levels/level-3.json';
import l4 from './levels/level-4.json';
import l5 from './levels/level-5.json';
import l6 from './levels/level-6.json';
import l7 from './levels/level-7.json';
import l8 from './levels/level-8.json';
import l9 from './levels/level-9.json';
import l10 from './levels/level-10.json';
import l11 from './levels/level-11.json';
import l12 from './levels/level-12.json';
import l13 from './levels/level-13.json';
import l14 from './levels/level-14.json';
import l15 from './levels/level-15.json';
import l16 from './levels/level-16.json';
import l17 from './levels/level-17.json';
import l18 from './levels/level-18.json';
import l19 from './levels/level-19.json';
import l20 from './levels/level-20.json';
import l21 from './levels/level-21.json';
import type { GolfLevelData } from './physics';

const ALL = [l1, l2, l3, l4, l5, l6, l7, l8, l9, l10, l11, l12, l13, l14, l15, l16, l17, l18, l19, l20, l21] as unknown as GolfLevelData[];

/** Dados da fase `n` (1 a 21). */
export function golfServerLevel(n: number): GolfLevelData {
  const d = ALL[n - 1];
  if (!d) throw new Error(`fase ${n} não existe`);
  return d;
}
