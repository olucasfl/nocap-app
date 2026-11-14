import { GolfLevel, type GolfLevelData } from '@nocap/games';

// as fases convertidas moram no pacote de jogos; cada uma baixa só quando é jogada
const LOADERS = import.meta.glob('../../../../../packages/games/src/minigolf/levels/*.json');

/** Baixa a fase `n` e monta o mundo de colisão (o mesmo do servidor). */
export async function loadLevel(n: number): Promise<GolfLevel> {
  const key = Object.keys(LOADERS).find((k) => k.endsWith(`/level-${n}.json`));
  if (!key) throw new Error(`fase ${n} não existe`);
  const mod = (await LOADERS[key]!()) as { default: GolfLevelData };
  return new GolfLevel(mod.default);
}
