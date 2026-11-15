import { FINAL_BOSS, HORDE_EVENTS, MAP_DRIP, MAP_EVENTS, DRIP_TIERS } from './hordes';
import { MAPS, MAP_IDS } from './data';
import { ALL_ENEMIES, MONSTER_BY_ID } from './monsters';
import { AXE_LAUNCHER, MAGIC_ORB_LAUNCHER, type EnemySettings } from './settings';

/**
 * Bestiário do Night Hunt (spec 084): uma entrada por inimigo, na ordem da primeira aparição. O nome e o texto dos monstros novos
 * vêm de `monsters.ts`; os do Slash estão aqui. Vida, dano, velocidade, XP e ouro são lidos de `ENEMIES` para nunca divergir do jogo.
 */
const SLASH: Record<string, [string, string]> = {
  BasicEnemy: [
    'Morcego Comum',
    'Pequeno, barulhento e em bando. Cada um é fraco, o problema é a quantidade.',
  ],
  BasicEnemySkeleton: [
    'Esqueleto Raso',
    'Ossos soltos que ainda lembram como andar atrás de você.',
  ],
  StandardEnemy: [
    'Goblin',
    'Verde, teimoso e sempre com fome. Corre um pouco mais rápido que o esqueleto.',
  ],
  TreasureEnemy: [
    'Goblin do Tesouro',
    'Carrega moedas e foge em linha reta. Quem o alcança leva o ouro.',
  ],
  FastEnemy: [
    'Tubarão da Terra',
    'Ninguém explicou a ele que tubarão vive na água. Rápido e mordedor.',
  ],
  SpeedEnemy: ['Corredor', 'Só sabe correr, e corre bem. Chega antes que você perceba.'],
  ToughEnemy: [
    'Verme Alado',
    'Um verme com asas pequenas demais para o tamanho. Aguenta mais pancada que parece.',
  ],
  HardEnemy: ['Verme Alado Robusto', 'O mesmo verme depois de uma boa temporada de treino.'],
  HarderEnemy: ['Verme Alado Veterano', 'Já viu muita gente cair. Pretende ver mais uma.'],
  HardestEnemy: ['Verme Alado Ancestral', 'O verme mais velho e mais duro da noite.'],
  EndEnemy: ['Corredor do Fim', 'O último que você vê quando o tempo acaba. Velocíssimo.'],
  TankEnemy: ['Bárbaro Blindado', 'Lento, enorme e cheio de vida. Prepare um bom plano.'],
  SiegeEnemyMelee: [
    'Tubarão de Cerco',
    'Um tubarão com muita vida e nenhuma pressa. Vem derrubar a muralha, e você é a muralha.',
  ],
  SiegeEnemyRanged: ['Arremessador de Cerco', 'Para, mira e atira machados. Depois anda de novo.'],
  SkeletonRanger: ['Esqueleto Arqueiro', 'Fica a distância e manda orbes escuros na sua direção.'],
  BatEnemy: ['Morcego Veloz', 'O morcego que treinou para ser difícil de acertar.'],
  CircleEnemy: ['Esqueleto Lento', 'Aparece em anel, bem devagar, e fecha o cerco aos poucos.'],
  CircleEnemyBat: ['Morcego do Anel', 'Um anel inteiro de morcegos que se fecha em volta de você.'],
  CircleEnemyStandard: ['Esqueleto Reforçado', 'O esqueleto do anel com uma armadura improvisada.'],
  CircleEnemyTough: ['Bárbaro do Anel', 'Fecha o anel com os ombros. Aguenta e empurra.'],
  CircleEnemyDark: ['Corvo Sombrio', 'Um corvo escuro que fecha o anel e solta orbes de longe.'],
  CircleEnemySkelePrison: ['Carcereiro', 'Guarda a prisão de esqueletos. Não gosta de fugitivos.'],
  WaveEnemy: ['Tubarão Relâmpago', 'Atravessa a tela em linha reta, numa muralha de dentes.'],
  WaveEnemyArmor: ['Esqueleto Blindado', 'Marcha em fila e não desvia de nada.'],
  WaveEnemyArmorFast: ['Corredor Blindado', 'A muralha que corre. Fique fora da linha.'],
  WaveEnemyArmorBlitz: ['Corredor Relâmpago', 'Uma muralha ainda mais rápida e mais dura.'],
  WaveEnemyDeath: [
    'Corvo da Morte',
    'Passa voando por cima de tudo, em uma linha da qual você precisa sair.',
  ],
  WaveEnemyArmorMarch: ['Esqueleto de Marcha', 'Avança sem pressa e sem parar, em formação.'],
  BasicBoss: ['Golem de Pedra', 'O primeiro chefe grande da noite. Devagar, mas bate forte.'],
  StandardBoss: ['Rei Orc', 'Chega com a coroa torta e muita raiva guardada.'],
  HardBoss: ['Rei Orc Furioso', 'O Rei Orc depois de perder a paciência.'],
  HarderBoss: ['Golem Antigo', 'Pedra que viu mais noites do que você jogou.'],
  HardestBoss: ['Rei Orc Supremo', 'O mais temido dos reis. Cada baú dele vale a luta.'],
  FinalBoss: ['Golem Final', 'O guardião do Campo Verde. Derrubá-lo conclui o mapa.'],
  Hunter: ['Caçador', 'Persegue, para, e arremessa machados. Faz tudo isso com calma.'],
  HunterMage: ['Mago Caçador', 'Um caçador que aprendeu magia sem largar o machado.'],
  BasicCheetah: ['Guepardo Jovem', 'Ainda aprende a caçar, mas já corre mais que você.'],
  StandardCheetah: ['Guepardo', 'Corre, para, observa e corre de novo.'],
};

/** Ordem da primeira aparição na partida (o que o bestiário numera). */
const ORDER = [
  'BasicEnemy',
  'CircleEnemyBat',
  'WaveEnemy',
  'WaveEnemyArmor',
  'TreasureEnemy',
  'BasicEnemySkeleton',
  'Vagalume',
  'GosmaAzul',
  'Gosminha',
  'StandardEnemy',
  'BasicBoss',
  'LoboDeGelo',
  'CircleEnemy',
  'FastEnemy',
  'Escorpiao',
  'NajaRubra',
  'CaoInfernal',
  'Espectro',
  'WaveEnemyArmorFast',
  'SpeedEnemy',
  'ToughEnemy',
  'StandardBoss',
  'OlhoSangrento',
  'CircleEnemyStandard',
  'EsqueletoCeifador',
  'VermeCerebral',
  'HardEnemy',
  'DragaoDouradoBoss',
  'TankEnemy',
  'GolemCristal',
  'HardBoss',
  'CircleEnemyTough',
  'Grifo',
  'EntAnciao',
  'HarderEnemy',
  'BatEnemy',
  'StandardCheetah',
  'BasicCheetah',
  'HarderBoss',
  'WaveEnemyArmorMarch',
  'DragaoRosa',
  'Hunter',
  'WaveEnemyArmorBlitz',
  'HardestEnemy',
  'SiegeEnemyMelee',
  'CircleEnemyDark',
  'HunterMage',
  'SkeletonRanger',
  'SiegeEnemyRanged',
  'CircleEnemySkelePrison',
  'HardestBoss',
  'EndEnemy',
  'WaveEnemyDeath',
  'FinalBoss',
  'DragaoDouradoFinalBoss',
  'GolemCristalFinalBoss',
];

export interface BestiaryEntry {
  id: string;
  /** Número na lista (começa em 1). */
  n: number;
  name: string;
  desc: string;
  /** Quadro de animação: 'Dc:<arte>' dos monstros novos ou o tipo gráfico do Slash. */
  art: string;
  stats: { hp: number; dmg: number; speed: number; xp: number; gold: number };
  /** O que o bicho faz de especial (uma frase), ou vazio. */
  ability: string;
  maps: string[];
  boss: boolean;
}

const MOVE_TEXT: Record<EnemySettings['moveType'], string> = {
  Follow: '',
  Launch: 'Avança em linha reta, sem desviar.',
  PeriodicFollow: 'Persegue e para de tempos em tempos.',
};

/** Mapas onde o inimigo aparece (varrendo a tabela de hordas de cada mapa ao longo do tempo). */
export function mapsOf(id: string): string[] {
  const found = new Set<string>();
  for (const map of Object.keys(MAPS)) {
    for (let t = 0; t <= 2400; t += 30) {
      const tier = [...DRIP_TIERS].reverse().find((x) => t >= x.from);
      if (tier?.weights.some(([e]) => e === id)) found.add(map);
      for (const ev of [...HORDE_EVENTS, ...(MAP_EVENTS[map] ?? [])])
        if (t >= ev.from && ev.enemy(t) === id) found.add(map);
    }
    if ((MAP_DRIP[map] ?? []).some(([, e]) => e === id)) found.add(map);
    if (FINAL_BOSS[map]?.id === id) found.add(map);
  }
  if (id === 'Gosminha') found.add('deserto');
  return [...found];
}

const rows = (): BestiaryEntry[] =>
  ORDER.map((id, i) => {
    const e = ALL_ENEMIES.find((x) => x.id === id)!;
    const m = MONSTER_BY_ID.get(id);
    const [name, desc] = m ? [m.name, m.desc] : SLASH[id]!;
    let ability = m?.rule ?? MOVE_TEXT[e.moveType];
    if (!m && (AXE_LAUNCHER.enemyIds as readonly string[]).includes(id))
      ability = 'Arremessa machados em você.';
    if (!m && (MAGIC_ORB_LAUNCHER.enemyIds as readonly string[]).includes(id))
      ability = 'Dispara orbes escuros.';
    return {
      id,
      n: i + 1,
      name,
      desc,
      art: e.graphicsType,
      stats: { hp: e.health, dmg: e.damage, speed: e.speed, xp: e.xpReward, gold: e.goldReward },
      ability,
      maps: ((all) =>
        all.some((x) => MAP_IDS.includes(x)) ? all.filter((x) => MAP_IDS.includes(x)) : all)(
        mapsOf(id),
      ),
      boss: id.endsWith('Boss'),
    };
  });
export const BESTIARY: readonly BestiaryEntry[] = rows();
