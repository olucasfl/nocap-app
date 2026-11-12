import {
  GP_HALF_WIDTH,
  GP_KERB_W,
  GP_PIT_HALF,
  GP_SCENERY_PAD,
  GP_STAND_LEN,
  GP_STAND_ROOF_FROM,
  GP_STAND_ROOF_TO,
  GP_STAND_ROW0,
  GP_STAND_ROW_DEPTH,
  GP_STAND_ROW_STEP,
  GP_STAND_ROWS,
  GP_STAND_STEP,
  GP_TOWER_EVERY,
  GP_TOWER_OFF,
  GP_GARAGE_LEN,
  GP_GARAGE_DEPTH,
  GP_GARAGE_STEP,
} from './constants';
import type { GpTrack } from './track';

/**
 * Onde o cenário cabe (spec 081, Fase 13.4). As arquibancadas, garagens, torres e placas eram postas a partir da barreira
 * do próprio trecho, sem olhar o que existe atrás dela: onde a pista dobra sobre si mesma (reta principal, grampos), elas
 * caíam no asfalto do outro trecho. Aqui, função pura e testada: a cena só desenha o que estas funções devolvem.
 */

/** Um retângulo no chão, alinhado com a pista: centro no traçado `s`, de `from` a `to` de afastamento (com sinal). */
export interface GpFootprint {
  s: number;
  /** Afastamento do centro (com sinal) da borda de perto e da de longe. */
  from: number;
  to: number;
  /** Meio comprimento ao longo da pista (m). */
  halfLen: number;
}

/**
 * Pontos do chão livres de pista: longe do asfalto e da zebra de qualquer trecho, atrás da barreira de qualquer trecho
 * (com `behindWall`) e fora da faixa do box. Confere a distância até a linha central de todas as amostras (não só da
 * mais perto), que é o que pega as dobras.
 */
export function gpClearAt(track: GpTrack, x: number, z: number, behindWall = true, pad = GP_SCENERY_PAD): boolean {
  const n = track.n;
  const reach = track.limit + pad + 4;
  const reach2 = reach * reach;
  const road = GP_HALF_WIDTH + GP_KERB_W + pad;
  for (let j = 0; j < n; j++) {
    const dx = x - track.x[j]!;
    const dz = z - track.z[j]!;
    if (dx * dx + dz * dz > reach2) continue;
    // só a amostra "de frente" para o ponto (a projeção cai nela), senão um ponto ao lado da amostra seguinte conta errado
    const along = dx * track.tx[j]! + dz * track.tz[j]!;
    if (Math.abs(along) > track.ds * 0.75) continue;
    const d = dx * -track.tz[j]! + dz * track.tx[j]!;
    const ad = Math.abs(d);
    if (ad < road) return false;
    if (behindWall) {
      const w = track.wallAt(j, d);
      const need = (w === Infinity ? track.limit : Math.min(w, track.limit)) + pad;
      if (ad < need) return false;
    }
  }
  const g = track.projectGlobal(x, z);
  const pc = track.pitCenter(track.rel(g.s));
  if (pc !== null && Math.abs(g.d - pc) < GP_PIT_HALF + pad) return false;
  return true;
}

/** O retângulo inteiro está livre? Confere uma grade de pontos (cantos, bordas e meio, a cada ~1,5 m). */
export function gpFootprintClear(track: GpTrack, f: GpFootprint, behindWall = true): boolean {
  const lo = Math.min(f.from, f.to);
  const hi = Math.max(f.from, f.to);
  const na = Math.max(2, Math.ceil((f.halfLen * 2) / 1.5));
  const nb = Math.max(2, Math.ceil((hi - lo) / 1.5));
  for (let a = 0; a <= na; a++) {
    const s = f.s - f.halfLen + (a / na) * f.halfLen * 2;
    for (let b = 0; b <= nb; b++) {
      const p = track.pointAt(s, lo + ((hi - lo) * b) / nb);
      if (!gpClearAt(track, p.x, p.z, behindWall)) return false;
    }
  }
  return true;
}

/** Um trecho de arquibancada que cabe: quantos degraus (1 a 3), se tem telhado, e a placa com o nome no primeiro. */
export interface GpStandSlot {
  s: number;
  side: 1 | -1;
  /** Distância da barreira (do centro, sem sinal) de onde a arquibancada começa. */
  wall: number;
  rows: number;
  roof: boolean;
  /** O nome vai no primeiro trecho de cada arquibancada que coube. */
  name: string | null;
}

/** Retângulo do degrau `row` (ou do telhado, com `row = -1`) de um trecho de arquibancada. */
export function gpStandFootprint(slot: Pick<GpStandSlot, 's' | 'side' | 'wall'>, row: number): GpFootprint {
  const near =
    row < 0 ? GP_STAND_ROOF_FROM : GP_STAND_ROW0 + row * GP_STAND_ROW_STEP - GP_STAND_ROW_DEPTH / 2;
  const far = row < 0 ? GP_STAND_ROOF_TO : GP_STAND_ROW0 + row * GP_STAND_ROW_STEP + GP_STAND_ROW_DEPTH / 2;
  return {
    s: slot.s,
    from: slot.side * (slot.wall + near),
    to: slot.side * (slot.wall + far),
    halfLen: GP_STAND_LEN / 2,
  };
}

const slotsCache = new WeakMap<GpTrack, GpStandSlot[]>();

/**
 * As arquibancadas da pista (`def.stands`) onde cabem: cada trecho tenta 3 degraus com telhado; se não couber, tira o
 * telhado, depois degraus; se nem o primeiro degrau couber, o trecho é pulado.
 */
export function gpStandSlots(track: GpTrack): GpStandSlot[] {
  const hit = slotsCache.get(track);
  if (hit) return hit;
  const out: GpStandSlot[] = [];
  for (const st of track.def.stands ?? []) {
    const s0 = track.cpS[st.from] ?? 0;
    let s1 = track.cpS[st.to] ?? s0 + 40;
    if (s1 < s0) s1 += track.length;
    let named = false;
    for (let s = s0; s <= s1; s += GP_STAND_STEP) {
      const i = track.index(s);
      const w = track.wallAt(i, st.side);
      const wall = w === Infinity ? track.limit : Math.min(w, track.limit);
      const base = { s, side: st.side, wall };
      let rows = 0;
      while (rows < GP_STAND_ROWS && gpFootprintClear(track, gpStandFootprint(base, rows))) rows++;
      if (rows === 0) continue;
      const roof = rows === GP_STAND_ROWS && gpFootprintClear(track, gpStandFootprint(base, -1));
      out.push({ ...base, rows, roof, name: named ? null : st.name });
      named = true;
    }
  }
  slotsCache.set(track, out);
  return out;
}

/** As garagens do box: atrás da barreira do lado do box, onde couberem. */
export function gpGarageSlots(track: GpTrack): GpFootprint[] {
  const p = track.pit;
  if (!p) return [];
  const out: GpFootprint[] = [];
  for (let s = p.inEnd + 2; s < p.outStart - 2; s += GP_GARAGE_STEP) {
    const i = track.index(s);
    const w = track.wallAt(i, p.side);
    const wall = w === Infinity ? track.limit : w;
    const f: GpFootprint = {
      s,
      from: p.side * (wall + GP_SCENERY_PAD),
      to: p.side * (wall + GP_SCENERY_PAD + GP_GARAGE_DEPTH),
      halfLen: GP_GARAGE_LEN / 2,
    };
    if (gpFootprintClear(track, f)) out.push(f);
  }
  return out;
}

/** Torres de iluminação: nas retas, atrás da barreira, onde couberem. */
export function gpTowerSlots(track: GpTrack): { s: number; d: number }[] {
  const out: { s: number; d: number }[] = [];
  for (let s = 20; s < track.length; s += GP_TOWER_EVERY) {
    const i = track.index(s);
    if (Math.abs(track.curv[i]!) > 1 / 150) continue;
    for (const sd of [-1, 1] as const) {
      const w = track.wallAt(i, sd);
      if (w === Infinity || w < track.limit - 0.5) continue;
      const d = sd * (w + GP_TOWER_OFF);
      const q = track.pointAt(s, d);
      if (gpClearAt(track, q.x, q.z)) out.push({ s, d });
    }
  }
  return out;
}

/**
 * Placas de freada (100 e 50 m) antes das curvas fortes, do lado de fora, na área de escape (entre a zebra e a barreira):
 * nunca no asfalto nem na zebra de nenhum trecho.
 */
export function gpBoardSlots(track: GpTrack): { s: number; d: number; label: 100 | 50 }[] {
  const out: { s: number; d: number; label: 100 | 50 }[] = [];
  let lastCorner = -999;
  for (let i = 0; i < track.n; i++) {
    const k = track.curv[i]!;
    if (Math.abs(k) < 1 / 30 || i * track.ds - lastCorner < 160) continue;
    lastCorner = i * track.ds;
    const outside = k > 0 ? -1 : 1;
    for (const label of [100, 50] as const) {
      const s = i * track.ds - label;
      const j = track.index(s);
      const w = Math.min(track.wallAt(j, outside), track.limit);
      const d = outside * Math.max(GP_HALF_WIDTH + GP_KERB_W + 1, w - 1.2);
      const q = track.pointAt(s, d);
      if (gpClearAt(track, q.x, q.z, false)) out.push({ s, d, label });
    }
  }
  return out;
}
