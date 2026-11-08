/**
 * O mapa do Counter Fox: a Duna, gerada do modelo 3D (gridmap.ts, dados em duna.data.ts). Responde à interface `FsMapApi`, então o
 * motor, os bots, o servidor e as telas só falam com ela.
 */
import { createGridMap, type FsGridMapData, type FsMapApi } from './gridmap';
import { FS_PVP_DATA } from './pvp.data';

export type { FsMapApi } from './gridmap';
export type FsMapId = 'duna' | 'pvp';

let duna: FsMapApi | null = null;
let dunaData: FsGridMapData | null = null;
let dunaLoad: Promise<void> | null = null;
/**
 * Carrega, só quando precisa, os dados pesados da Duna (1,2 MB de colisão; ficam fora do pacote principal). Chame e espere antes de
 * `fsMapById('duna')`; para a arena não faz nada.
 */
export function fsPreloadMap(id?: string | null): Promise<void> {
  if (id === 'pvp' || dunaData) return Promise.resolve();
  return (dunaLoad ??= import('./duna.data').then((m) => {
    dunaData = m.FS_DUNA_DATA as unknown as FsGridMapData;
  }));
}
/** A Duna (modelo de terceiros, ver docs/CREDITS-3D.md): colisão tirada da superfície do modelo. Precisa de `fsPreloadMap` antes. */
export function fsMapDuna(): FsMapApi {
  if (!dunaData) throw new Error('Duna ainda não carregada: espere fsPreloadMap()');
  return (duna ??= createGridMap({ id: 'duna', name: 'Duna', data: dunaData, glb: 'duna/duna.glb', plan: 'duna/duna-plan.png' }));
}

let pvp: FsMapApi | null = null;
/** A arena de blocos do modo PvP (mapa de terceiros, ver docs/CREDITS-3D.md): sem bombas, só as duas pontas de nascimento. */
export function fsMapPvp(): FsMapApi {
  return (pvp ??= createGridMap({ id: 'pvp', name: 'Arena de Blocos', data: FS_PVP_DATA as unknown as FsGridMapData, glb: 'pvp/pvp.glb', plan: 'pvp/pvp-plan.png' }));
}

export const FS_MAP_IDS: readonly FsMapId[] = ['duna', 'pvp'];
export const FS_MAP_NAMES: Record<FsMapId, string> = { duna: 'Duna', pvp: 'Arena de Blocos' };
/** `pvp` abre a arena de blocos; qualquer outro id (inclusive o antigo `cidade` e o `dust2` salvos nas preferências) abre a Duna. */
export function fsMapById(id?: string | null): FsMapApi {
  return id === 'pvp' ? fsMapPvp() : fsMapDuna();
}
