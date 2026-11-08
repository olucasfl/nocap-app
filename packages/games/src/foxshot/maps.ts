/**
 * O mapa do Counter Fox: a Duna, gerada do modelo 3D (gridmap.ts, dados em duna.data.ts). Responde à interface `FsMapApi`, então o
 * motor, os bots, o servidor e as telas só falam com ela.
 */
import { createGridMap, type FsGridMapData, type FsMapApi } from './gridmap';
import { FS_DUNA_DATA } from './duna.data';

export type { FsMapApi } from './gridmap';
export type FsMapId = 'duna';

let duna: FsMapApi | null = null;
/** A Duna é montada na primeira vez que alguém pede (a grade é grande). */
export function fsMapDuna(): FsMapApi {
  return (duna ??= createGridMap({ id: 'duna', name: 'Duna', data: FS_DUNA_DATA as unknown as FsGridMapData, glb: 'duna/duna.glb' }));
}

export const FS_MAP_IDS: readonly FsMapId[] = ['duna'];
export const FS_MAP_NAMES: Record<FsMapId, string> = { duna: 'Duna' };
/** Só há um mapa: qualquer id (inclusive o antigo `cidade` salvo nas preferências) abre a Duna. */
export function fsMapById(_id?: string | null): FsMapApi {
  return fsMapDuna();
}
