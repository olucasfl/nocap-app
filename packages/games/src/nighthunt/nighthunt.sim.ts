import { describe, it } from 'vitest';
import { botPlay } from './bot';
import { HERO_IDS, MAP_IDS, UPGRADE_IDS } from './data';
import { NO_META, NhWorld } from './world';

/**
 * Simulador de equilíbrio do Night Hunt (spec 083). `pnpm --filter @nocap/games sim` joga partidas com o robô
 * e imprime sobrevivência, nível e abates por herói e por mapa, e quais melhorias terminaram mais altas.
 * Variáveis: NH_RUNS (partidas por linha, 6), NH_SECONDS (limite por partida, 600), NH_HEROES, NH_MAPS (listas por vírgula).
 */
const RUNS = Number(process.env.NH_RUNS ?? 6);
const SECONDS = Number(process.env.NH_SECONDS ?? 600);
const heroes = (process.env.NH_HEROES ?? HERO_IDS.join(',')).split(',');
const maps = (process.env.NH_MAPS ?? MAP_IDS.join(',')).split(',');

function row(hero: string, map: string) {
  const t: number[] = [];
  const lv: number[] = [];
  const kills: number[] = [];
  const evo: number[] = [];
  const topItems = new Map<string, number>();
  for (let i = 0; i < RUNS; i++) {
    const w = new NhWorld(`sim-${hero}-${map}-${i}`, NO_META, { hero, map });
    botPlay(w, SECONDS);
    t.push(w.t);
    lv.push(w.level + 1);
    kills.push(w.kills);
    evo.push(w.evolved.size);
    for (const u of UPGRADE_IDS)
      if (w.levels[u] > 0) topItems.set(u, (topItems.get(u) ?? 0) + w.levels[u]);
  }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
  const died = t.filter((x) => x < SECONDS - 1).length;
  return {
    hero,
    map,
    med: med(t),
    avg: avg(t),
    lv: avg(lv),
    kills: avg(kills),
    evo: avg(evo),
    died,
    items: [...topItems]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k]) => k)
      .join(','),
  };
}

describe('simulador de equilíbrio do Night Hunt', () => {
  it('imprime a tabela por herói e mapa', () => {
    const lines = [
      'herói      mapa     tempo mediano  médio   nível  abates  evol.  mortes  itens mais usados',
    ];
    for (const m of maps) {
      for (const h of heroes) {
        const r = row(h, m);
        lines.push(
          `${r.hero.padEnd(10)} ${r.map.padEnd(8)} ${fmt(r.med).padStart(13)} ${fmt(r.avg).padStart(7)} ${r.lv.toFixed(1).padStart(7)} ${String(Math.round(r.kills)).padStart(7)} ${r.evo.toFixed(1).padStart(6)} ${String(r.died).padStart(3)}/${RUNS}  ${r.items}`,
        );
      }
    }
    console.log('\n' + lines.join('\n') + `\n(partidas de até ${SECONDS}s, ${RUNS} por linha)\n`);
  });
});
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
