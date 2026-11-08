/**
 * O mapa do Counter Fox: a Duna, gerada do modelo 3D (gridmap.ts, dados em duna.data.ts). Responde à interface `FsMapApi`, então o
 * motor, os bots, o servidor e as telas só falam com ela.
 */
import { createGridMap, type FsGridMapData, type FsMapApi } from './gridmap';
import { FS_DUNA_DATA } from './duna.data';
import { FS_PVP_DATA } from './pvp.data';

export type { FsMapApi } from './gridmap';
export type FsMapId = 'duna' | 'pvp';

let duna: FsMapApi | null = null;
/** A Duna é montada na primeira vez que alguém pede (a grade é grande). */
export function fsMapDuna(): FsMapApi {
  return (duna ??= createGridMap({ id: 'duna', name: 'Duna', data: FS_DUNA_DATA as unknown as FsGridMapData, glb: 'duna/duna.glb' }));
}

let pvp: FsMapApi | null = null;
/** A arena de blocos do modo PvP (mapa de terceiros, ver docs/CREDITS-3D.md): sem bombas, só as duas pontas de nascimento. */
export function fsMapPvp(): FsMapApi {
  return (pvp ??= createGridMap({ id: 'pvp', name: 'Arena de Blocos', data: FS_PVP_DATA as unknown as FsGridMapData, glb: 'pvp/pvp.glb' }));
}

export const FS_MAP_IDS: readonly FsMapId[] = ['duna', 'pvp'];
export const FS_MAP_NAMES: Record<FsMapId, string> = { duna: 'Duna', pvp: 'Arena de Blocos' };
/** `pvp` abre a arena de blocos; qualquer outro id (inclusive o antigo `cidade` salvo nas preferências) abre a Duna. */
export function fsMapById(id?: string | null): FsMapApi {
  return id === 'pvp' ? fsMapPvp() : fsMapDuna();
}
