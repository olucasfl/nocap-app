// Migração dos 55 grimórios antigos (um por raridade) para os 14 de hoje (spec 042). Só dado e uma função pura.

import { GRIMOIRE_RARITIES, grimoireById, type GrimoireRarity } from './catalog';
import { albumKey, legacyGain, levelCapOfRank, rarityRank } from './economy';
import { ALBUM_SPARKS } from './sparks';

type Legacy = readonly [to: string | null, rarity: GrimoireRarity];

/** Id antigo -> [grimório novo, raridade que ele tinha]. `null`: o grimório saiu do jogo (geradores e dois de efeito solto). */
export const LEGACY_GRIMOIRES: Readonly<Record<string, Legacy>> = {
  moon: ['moon', 'common'], jupiter: ['moon', 'rare'], deimos: ['moon', 'common'], aldebaran: ['moon', 'epic'], 'alpha-centauri-a': ['moon', 'epic'],
  vesta: ['sirius', 'common'], sirius: ['sirius', 'epic'], 'proxima-centauri': ['sirius', 'rare'], rigel: ['sirius', 'rare'],
  uranus: ['uranus', 'common'], europa: ['uranus', 'rare'], haumea: ['uranus', 'common'],
  vega: ['vega', 'epic'], 'milky-way': ['vega', 'legendary'], andromeda: ['vega', 'legendary'],
  venus: ['venus', 'common'], 'hale-bopp': ['venus', 'rare'], sedna: ['venus', 'epic'], eris: ['venus', 'rare'], ryugu: ['venus', 'common'],
  mars: ['mars', 'common'], enceladus: ['mars', 'rare'],
  io: ['io', 'common'], neptune: ['io', 'rare'], callisto: ['io', 'rare'],
  halley: ['halley', 'common'], pluto: ['halley', 'rare'], oumuamua: ['halley', 'epic'], 'voyager-1': ['halley', 'rare'],
  antares: ['antares', 'epic'], 'golden-record': ['antares', 'legendary'],
  mercury: ['mercury', 'common'], hygiea: ['mercury', 'common'], tethys: ['mercury', 'rare'],
  phobos: ['phobos', 'common'], charon: ['phobos', 'common'], triton: ['phobos', 'rare'],
  titan: ['titan', 'rare'], ceres: ['titan', 'common'], saturn: ['titan', 'rare'], pillars: ['titan', 'legendary'],
  betelgeuse: ['betelgeuse', 'epic'], horsehead: ['betelgeuse', 'epic'],
  'orion-nebula': ['orion-nebula', 'legendary'], 'crab-nebula': ['orion-nebula', 'epic'],
  pallas: [null, 'common'], earth: [null, 'common'], sun: [null, 'rare'], 'kepler-22b': [null, 'rare'], 'trappist-1': [null, 'rare'],
  'vela-pulsar': [null, 'epic'], 'pleiades-cluster': [null, 'epic'], sombrero: [null, 'legendary'], polaris: [null, 'epic'], ganymede: [null, 'rare'],
};

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Versão 5 para 6: o álbum vira versões descobertas ("moon:rare"), a vida em andamento troca os grimórios antigos pelos
 * novos equivalentes (fica o de maior raridade e nível, limitado ao teto) e a escolha aberta é descartada (a barra cheia
 * abre outra). As Cintilas do álbum antigo que a conversão não repõe voltam em `sparks.legacy`, para ninguém perder saldo.
 * Não muta o que recebe.
 */
export function migrateGrimoires(raw: unknown, targetVersion: number): unknown {
  if (!isObj(raw) || raw.version !== 5) return raw;
  const out: Record<string, unknown> = { ...raw, version: targetVersion };

  const oldAlbum = Array.isArray(raw.album) ? (raw.album as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const album: string[] = [];
  let oldSparks = 0;
  for (const key of oldAlbum) {
    const legacy = LEGACY_GRIMOIRES[key];
    if (!legacy) {
      album.push(key); // proibidos e o que já estiver no formato novo
      continue;
    }
    oldSparks += ALBUM_SPARKS[legacy[1]];
    if (legacy[0] !== null) {
      const k = albumKey(legacy[0], legacy[1]);
      if (!album.includes(k)) album.push(k);
    }
  }
  out.album = album;
  const newSparks = album.reduce((sum, k) => {
    const [id, r] = k.split(':');
    return id && r && grimoireById(id) ? sum + (ALBUM_SPARKS[r as GrimoireRarity] ?? 0) : sum;
  }, 0);
  const sp = raw.sparks;
  if (isObj(sp) && typeof sp.legacy === 'number' && oldSparks > newSparks) out.sparks = { ...sp, legacy: sp.legacy + (oldSparks - newSparks) };

  if (typeof raw.favorite === 'string') {
    const f = LEGACY_GRIMOIRES[raw.favorite];
    const to = f ? f[0] : raw.favorite;
    const locked = typeof to === 'string' && (grimoireById(to)?.unlockedAtCollapse ?? 0) > (typeof raw.collapses === 'number' ? raw.collapses : 0);
    out.favorite = to === undefined || locked ? null : to;
  }

  if (isObj(raw.run)) {
    const build: Record<string, number> = {};
    const buildGain: Record<string, number> = {};
    const buildRarity: Record<string, number> = {};
    const best: Record<string, { rank: number; level: number }> = {};
    const collapses = typeof raw.collapses === 'number' ? raw.collapses : 0;
    for (const [oid, lvl] of Object.entries(isObj(raw.run.build) ? (raw.run.build as Record<string, unknown>) : {})) {
      const legacy = LEGACY_GRIMOIRES[oid];
      if (!legacy || legacy[0] === null || typeof lvl !== 'number') continue;
      // Grimório que ainda não abriu neste colapso não entra na vida em andamento (o álbum guarda a descoberta).
      if ((grimoireById(legacy[0])?.unlockedAtCollapse ?? 0) > collapses) continue;
      const rank = rarityRank(legacy[1]);
      const cur = best[legacy[0]];
      if (!cur || rank > cur.rank || (rank === cur.rank && lvl > cur.level)) best[legacy[0]] = { rank, level: lvl };
    }
    for (const [id, b] of Object.entries(best)) {
      const level = Math.max(1, Math.min(levelCapOfRank(b.rank), b.level));
      const rarity = GRIMOIRE_RARITIES[b.rank] as GrimoireRarity;
      build[id] = level;
      buildGain[id] = legacyGain(rarity, level);
      buildRarity[id] = b.rank;
    }
    out.run = { ...raw.run, build, buildGain, buildRarity, pending: null };
  }
  return out;
}
