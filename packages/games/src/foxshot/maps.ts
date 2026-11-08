/**
 * O mapa do Counter Fox: a Duna, gerada do modelo 3D (gridmap.ts, dados em duna.data.ts). Responde à interface `FsMapApi`, então o
 * motor, os bots, o servidor e as telas só falam com ela.
 */
import { createGridMap, type FsGridMapData, type FsMapApi } from './gridmap';
import { FS_DUNA_DATA } from './duna.data';
import { FS_PVP_DATA } from './pvp.data';

export type { FsMapApi } from './gridmap';
export type FsMapId = 'duna' | 'dust2' | 'pvp';

let duna: FsMapApi | null = null;
/** A Duna é montada na primeira vez que alguém pede (a grade é grande). */
export function fsMapDuna(): FsMapApi {
  return (duna ??= createGridMap({ id: 'duna', name: 'Duna', data: FS_DUNA_DATA as unknown as FsGridMapData, glb: 'duna/duna.glb' }));
}

let pvp: FsMapApi | null = null;
/** A arena de blocos do modo PvP (mapa de terceiros, ver docs/CREDITS-3D.md): sem bombas, só as duas pontas de nascimento. */
export function fsMapPvp(): FsMapApi {
  return (pvp ??= createGridMap({ id: 'pvp', name: 'Arena de Blocos', data: FS_PVP_DATA as unknown as FsGridMapData, glb: 'pvp/pvp.glb', plan: 'pvp/pvp-plan.png' }));
}

let dust2: FsMapApi | null = null;
let dust2Data: FsGridMapData | null = null;
let dust2Load: Promise<void> | null = null;
/**
 * Carrega, só quando precisa, os dados pesados do mapa (a Dust 2 tem 1,2 MB de colisão e não entra no pacote principal). Chame e espere antes de
 * `fsMapById('dust2')`; para a Duna e a arena não faz nada.
 */
export function fsPreloadMap(id?: string | null): Promise<void> {
  if (id !== 'dust2' || dust2Data) return Promise.resolve();
  return (dust2Load ??= import('./dust2.data').then((m) => {
    dust2Data = m.FS_DUST2_DATA as unknown as FsGridMapData;
  }));
}
/** A Dust 2 (modelo de terceiros, ver docs/CREDITS-3D.md): mesma escala, bombas e bases da Duna, com a colisão tirada da superfície do modelo. */
export function fsMapDust2(): FsMapApi {
  if (!dust2Data) throw new Error("Dust 2 ainda não carregada: espere fsPreloadMap('dust2')");
  return (dust2 ??= createGridMap({ id: 'dust2', name: 'Dust 2', data: dust2Data, glb: 'dust2/dust2.glb', plan: 'dust2/dust2-plan.png' }));
}

export const FS_MAP_IDS: readonly FsMapId[] = ['duna', 'dust2', 'pvp'];
export const FS_MAP_NAMES: Record<FsMapId, string> = { duna: 'Duna', dust2: 'Dust 2', pvp: 'Arena de Blocos' };
/** `pvp` abre a arena de blocos e `dust2` a Dust 2; qualquer outro id (inclusive o antigo `cidade` salvo nas preferências) abre a Duna. */
export function fsMapById(id?: string | null): FsMapApi {
  return id === 'pvp' ? fsMapPvp() : id === 'dust2' ? fsMapDust2() : fsMapDuna();
}
