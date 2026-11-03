import { createRng } from '../core/rng';
import type { FsWeapon } from './weapons';

export interface FsGunState {
  /** Número do tiro dentro da rajada (volta a 0 depois de `recoilResetS` sem atirar). */
  shot: number;
  /** Tempo desde o último tiro (s). */
  since: number;
  /** Dispersão acumulada pela rajada (graus). */
  bloom: number;
  /** Quantos tiros o jogador já deu (para a semente da dispersão). */
  fired: number;
}

export const fsNewGunState = (): FsGunState => ({ shot: 0, since: 99, bloom: 0, fired: 0 });

export interface FsMoveState {
  moving: boolean;
  airborne: boolean;
  ads: boolean;
}

/** Cone de dispersão atual (graus) pelo estado do jogador e pelo que a rajada já acumulou. */
export function fsSpreadDeg(w: FsWeapon, m: FsMoveState, g: FsGunState): number {
  const base = m.airborne ? w.spread.air : m.ads ? (m.moving ? w.spread.adsMove : w.spread.ads) : m.moving ? w.spread.move : w.spread.stand;
  return base + g.bloom;
}

export interface FsShot {
  /** Quanto a mira sobe/vai de lado por causa do recuo (graus, somado à câmera). */
  kickPitch: number;
  kickYaw: number;
  /** Desvio aleatório da bala dentro do cone (graus): o mesmo no cliente e no servidor. */
  devYaw: number;
  devPitch: number;
}

/**
 * Registra um tiro: avança o padrão de recuo da arma e sorteia o desvio da bala pela semente `(jogador, número do tiro)`,
 * então todo mundo calcula a mesma direção. O primeiro tiro de uma rajada parado é preciso (sem desvio se o cone for 0).
 */
export function fsFire(w: FsWeapon, g: FsGunState, m: FsMoveState, playerId: string): FsShot {
  if (g.since > w.recoilResetS) {
    g.shot = 0;
    g.bloom = 0;
  }
  const pat = w.recoil[Math.min(g.shot, w.recoil.length - 1)]!;
  const cone = fsSpreadDeg(w, m, g);
  const rnd = createRng(`${playerId}:${g.fired}`);
  // ponto uniforme no disco de raio `cone`
  const r = Math.sqrt(rnd()) * cone;
  const a = rnd() * Math.PI * 2;
  const out: FsShot = { kickPitch: pat[0], kickYaw: pat[1], devYaw: Math.cos(a) * r, devPitch: Math.sin(a) * r };
  g.shot++;
  g.fired++;
  g.since = 0;
  g.bloom = Math.min(w.bloom, g.bloom + w.bloomPerShot);
  return out;
}

/** Passa o tempo da arma (para o padrão voltar ao primeiro tiro e o cone fechar). */
export function fsGunTick(w: FsWeapon, g: FsGunState, dt: number): void {
  g.since += dt;
  if (g.since > w.recoilResetS) g.bloom = Math.max(0, g.bloom - dt * 3);
}
