import { it } from 'vitest';
import { UPGRADES } from './catalog';
import { effectiveStats } from './engine';
import { simulate } from './sim';

it('trace', () => {
  const marks = [1, 3, 5, 10, 15, 30, 60, 120, 180, 240, 360, 480, 600];
  const seen = new Set<number>();
  simulate({
    profile: 'normal',
    seed: 'v0',
    collapses: 1,
    trace: (h, s) => {
      const m = Math.round(h * 60);
      const mark = marks.find((x) => x === m);
      if (mark === undefined || seen.has(mark)) return;
      seen.add(mark);
      const st = effectiveStats(s);
      const owned = UPGRADES.map((u, i) => [u.id, s.run.upgradeLevels[i] ?? 0] as const).filter(([, l]) => l > 0).map(([id, l]) => `${id}${l > 1 ? 'x' + l : ''}`).join(' ');
      console.log(`min ${mark}: toque ${st.dustPerTouch.toFixed(1)} auto ${st.autoDustPerSec.toFixed(1)}/s (teto ${st.autoDustCap.toFixed(1)}) energia/toque ${st.energyPerTouch.toFixed(2)} picks ${s.run.picks} vida ${s.run.dustLife.toExponential(2)} | ${owned}`);
    },
  });
});
