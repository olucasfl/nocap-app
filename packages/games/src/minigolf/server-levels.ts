/**
 * As 30 fases embutidas, para o servidor simular as salas do Mini Golf (spec 082). O app web NÃO usa isto: ele baixa cada
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
import l22 from './levels/level-22.json';
import l23 from './levels/level-23.json';
import l24 from './levels/level-24.json';
import l25 from './levels/level-25.json';
import l26 from './levels/level-26.json';
import l27 from './levels/level-27.json';
import l28 from './levels/level-28.json';
import l29 from './levels/level-29.json';
import l30 from './levels/level-30.json';
import type { GolfLevelData } from './physics';

const ALL = [l1, l2, l3, l4, l5, l6, l7, l8, l9, l10, l11, l12, l13, l14, l15, l16, l17, l18, l19, l20, l21, l22, l23, l24, l25, l26, l27, l28, l29, l30] as unknown as GolfLevelData[];

/** Dados da fase `n` (1 a 30). */
export function golfServerLevel(n: number): GolfLevelData {
  const d = ALL[n - 1];
  if (!d) throw new Error(`fase ${n} não existe`);
  return d;
}
