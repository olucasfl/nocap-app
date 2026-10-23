// Mapa estelar (spec 040, etapa 20): o nó da Exploração que revela o que o próximo colapso traz. Só leitura.

import { newContentAt, type NewContentItem } from './content';
import { effectiveStats, type SaveState } from './engine';
import { milestoneGoal, milestoneKind, type MilestoneKind } from './milestone';

export interface StarMapRegion {
  /** Colapso que abre esta região (o conteúdo vem desse colapso). */
  collapse: number;
  regionName: string;
  /** O que ela traz; sem o Mapa detalhado só as contagens e os nomes de região/objetos/eventos. */
  items: NewContentItem[];
}

export interface StarMapView {
  regions: StarMapRegion[];
  /** Com o Mapa vivo: o marco da vida do próximo colapso. */
  milestone: { kind: MilestoneKind; target: number } | null;
}

/** `null` sem o Mapa estelar. O Horizonte mostra duas regiões à frente; o Mapa detalhado, os grimórios de cada uma. */
export function starMapView(state: SaveState): StarMapView | null {
  const ex = effectiveStats(state).explore;
  if (ex.starMap < 1) return null;
  const ahead = ex.horizon ? 2 : 1;
  const regions: StarMapRegion[] = [];
  for (let i = 1; i <= ahead; i++) {
    const k = state.collapses + i;
    const items = newContentAt(k).filter((it) => it.kind !== 'grimoire' || ex.mapDetail);
    const region = items.find((it) => it.kind === 'region');
    if (!region) continue;
    regions.push({ collapse: k, regionName: region.name, items: items.filter((it) => it.kind !== 'region') });
  }
  let milestone: StarMapView['milestone'] = null;
  if (ex.mapLive) {
    const n = state.collapses + 2;
    const kind = milestoneKind(n, state.collapses + 1);
    milestone = { kind, target: milestoneGoal(kind, n).target };
  }
  return { regions, milestone };
}
