/** Um dano dado: quem bateu e quando (segundos de jogo). */
export interface FsDamageEntry {
  attacker: string;
  time: number;
}

/** Janela em que o dano ainda vale como assistência (s). Dano muito antigo do abate não conta. */
export const FS_ASSIST_WINDOW_S = 10;

/**
 * Quem ganha a assistência de um abate: só o jogador que bateu logo ANTES de quem matou (o último dano de outra pessoa, de
 * trás para a frente no registro). Se alguém bateu depois dele e antes do abate, quem ficou para trás não conta, e se o
 * dano foi há mais de `windowS` segundos também não. O próprio matador nunca ganha assistência.
 */
export function fsAssister(log: readonly FsDamageEntry[], killer: string, now: number, windowS = FS_ASSIST_WINDOW_S): string | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!;
    if (e.attacker === killer) continue;
    return now - e.time <= windowS ? e.attacker : null;
  }
  return null;
}
