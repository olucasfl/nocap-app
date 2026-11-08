/**
 * Os mapas do Counter Fox: a Duna (feita à mão, dust.ts) e a Cidade (gerada do modelo 3D, gridmap.ts). Cada um responde à mesma
 * interface (`FsMapApi`), então o motor, os bots, o servidor e as telas não precisam saber qual é.
 */
import {
  FS_DUST_HALF,
  FS_DUST_HOTSPOTS,
  FS_DUST_LABELS,
  FS_DUST_MARKS,
  FS_DUST_COLS,
  FS_DUST_ROWS,
  FS_DUST_SOLIDS,
  FS_DUST_SPAWNS,
  FS_DUST_X0,
  FS_DUST_Z0,
  FS_CELL,
  fsDustCellX,
  fsDustCellZ,
  fsDustCol,
  fsDustFloorY,
  fsDustHeight,
  fsDustLevel,
  fsDustLineWalkable,
  fsDustNearestFree,
  fsDustPath,
  fsDustRow,
  fsDustWalkable,
  fsPickSpawn,
  fsSiteAt,
} from './dust';
import { createGridMap, type FsGridMapData, type FsMapApi } from './gridmap';
import { FS_MAP2_DATA } from './map2.data';

export type { FsMapApi } from './gridmap';
export type FsMapId = 'duna' | 'cidade';

export const FS_MAP_DUNA: FsMapApi = {
  id: 'duna',
  name: 'Duna',
  solids: FS_DUST_SOLIDS,
  marks: FS_DUST_MARKS,
  spawns: FS_DUST_SPAWNS,
  hotspots: FS_DUST_HOTSPOTS,
  half: FS_DUST_HALF,
  labels: FS_DUST_LABELS,
  floorY: fsDustFloorY,
  siteAt: fsSiteAt,
  pickSpawn: (foes, rng, boxes, spawns) => fsPickSpawn(foes, rng, boxes, spawns),
  path: fsDustPath,
  nearestFree: fsDustNearestFree,
  cellX: fsDustCellX,
  cellZ: fsDustCellZ,
  col: fsDustCol,
  row: fsDustRow,
  walkable: fsDustWalkable,
  lineWalkable: fsDustLineWalkable,
  grid: { cols: FS_DUST_COLS, rows: FS_DUST_ROWS, x0: FS_DUST_X0, z0: FS_DUST_Z0, cell: FS_CELL, wall: (c, r) => fsDustLevel(c, r) < 0, height: fsDustHeight },
  visual: { kind: 'dust' },
};

let cidade: FsMapApi | null = null;
/** A Cidade é montada na primeira vez que alguém pede (a grade é grande). */
export function fsMapCidade(): FsMapApi {
  return (cidade ??= createGridMap({ id: 'cidade', name: 'Cidade', data: FS_MAP2_DATA as unknown as FsGridMapData, glb: 'map2/map2.glb' }));
}

export const FS_MAP_IDS: readonly FsMapId[] = ['duna', 'cidade'];
export const FS_MAP_NAMES: Record<FsMapId, string> = { duna: 'Duna', cidade: 'Cidade' };
export function fsMapById(id?: string | null): FsMapApi {
  return id === 'cidade' ? fsMapCidade() : FS_MAP_DUNA;
}
