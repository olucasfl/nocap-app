import { appendFileSync } from 'node:fs';
import { it } from 'vitest';
import { DUST_GOAL, TARGET_HOURS } from './economy';
import { simulateAverage } from './sim';
const SEEDS = ['a', 'b', 'c'];
it('calib', () => {
  for (let k = 1; k <= 5; k++) {
    let lo = Math.log(2e6), hi = Math.log(3e7);
    for (let n = 0; n < 9; n++) {
      const mid = (lo + hi) / 2;
      DUST_GOAL[k - 1] = Number(Math.exp(mid).toPrecision(3));
      const h = simulateAverage('normal', SEEDS, k).hours[k - 1]!;
      if (h > TARGET_HOURS[k - 1]!) hi = mid; else lo = mid;
    }
    DUST_GOAL[k - 1] = Number(Math.exp((lo + hi) / 2).toPrecision(3));
    const h = simulateAverage('normal', SEEDS, k).hours[k - 1]!;
    appendFileSync(process.env.CAL_LOG ?? 'calib.log', `life ${k}: goal ${DUST_GOAL[k - 1]} -> ${h.toFixed(2)} h (target ${TARGET_HOURS[k - 1]})\n`);
  }
}, 3_000_000);
