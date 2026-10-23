// Habilidades ativas e automações da árvore (spec 040, etapa 19): lê os nós comprados e junta em números. Fica separado de
// `tree.ts` (o grafo) e de `skills.ts` (as ações) para o motor ler sem importar as ações.

import { nodeLive, nodeParam, treeNodeById } from './tree';

type Tree = Readonly<Record<string, number>>;

/** Teto de toques por segundo do Autoclick (anti-farm, spec 039 seção 5): conta como toque só até aqui. */
export const AUTOCLICK_MAX_CPS = 6;
/** Segundos que um objeto fica no campo antes de a Captura automática pegá-lo (a pessoa tem a chance de pegar antes). */
export const AUTO_CAPTURE_DELAY_SEC = 1.5;
/** Quanto de poeira disponível a Compra automática pode gastar, no máximo, por compra (padrão antes dos nós subirem). */
export const AUTOBUY_DEFAULT_LIMIT = 50;

export type SkillId = 'autoclick' | 'auto-capture' | 'auto-buy' | 'auto-suggest' | 'autopilot' | 'pulse' | 'supernova' | 'time-warp' | 'lens' | 'magnet';

/** As habilidades que viram botão na barra (as outras são automações sem botão de uso). */
export const BUTTON_SKILLS = ['autoclick', 'autopilot', 'pulse', 'supernova', 'time-warp', 'lens', 'magnet'] as const;
export type ButtonSkillId = (typeof BUTTON_SKILLS)[number];

export interface SkillStats {
  /** O botão existe (o nó que dá o botão foi comprado). */
  has: Record<ButtonSkillId, boolean>;
  autoclick: { cps: number; durationSec: number; cooldownSec: number; charges: number; combo: boolean };
  autoCapture: { on: boolean; maxPerTick: number; rare: boolean; legendary: boolean; magnet: boolean };
  autoBuy: { on: boolean; maxLimit: number; batch: number; smart: boolean; reserve: number };
  suggest: { on: boolean; why: boolean };
  autopilot: { on: boolean; durationSec: number };
  pulse: { touches: number; cooldownSec: number; charges: number; combo: boolean };
  supernova: { touches: number; power: number; chain: number; twice: boolean; big: number; cooldownSec: number };
  warp: { durationSec: number; cooldownSec: number };
  lens: { durationSec: number; wide: boolean };
  magnet: { range: number; pull: number; cooldownSec: number };
  /** Todas as habilidades voltam mais cedo por esta fração (0,15 = 15%). */
  cooldownCut: number;
  /** Cada habilidade dura mais tantos segundos. */
  extraSec: number;
  /** Combos: usar duas habilidades em seguida rende mais (multiplicador) e a Maestria. */
  comboMult: number;
  mastery: boolean;
}

const EMPTY_HAS = (): Record<ButtonSkillId, boolean> => ({ autoclick: false, autopilot: false, pulse: false, supernova: false, 'time-warp': false, lens: false, magnet: false });

export const BASE = {
  autoclickCooldown: 600,
  autoclickDuration: 60,
  pulseCooldown: 288,
  supernovaCooldown: 384,
  warpCooldown: 480,
  warpDuration: 15,
  lensDuration: 30,
  lensCooldown: 576,
  magnetCooldown: 384,
  autopilotCooldown: 1500,
} as const;

export function skillStats(tree: Tree): SkillStats {
  const s: SkillStats = {
    has: EMPTY_HAS(),
    autoclick: { cps: 0, durationSec: BASE.autoclickDuration, cooldownSec: BASE.autoclickCooldown, charges: 1, combo: false },
    autoCapture: { on: false, maxPerTick: 0, rare: false, legendary: false, magnet: false },
    autoBuy: { on: false, maxLimit: AUTOBUY_DEFAULT_LIMIT, batch: 1, smart: false, reserve: 0 },
    suggest: { on: false, why: false },
    autopilot: { on: false, durationSec: 0 },
    pulse: { touches: 0, cooldownSec: BASE.pulseCooldown, charges: 1, combo: false },
    supernova: { touches: 0, power: 1, chain: 0, twice: false, big: 1, cooldownSec: BASE.supernovaCooldown },
    warp: { durationSec: BASE.warpDuration, cooldownSec: BASE.warpCooldown },
    lens: { durationSec: BASE.lensDuration, wide: false },
    magnet: { range: 0, pull: 1, cooldownSec: BASE.magnetCooldown },
    cooldownCut: 0,
    extraSec: 0,
    comboMult: 1,
    mastery: false,
  };
  let autoDuration = 0;
  let pilotMult = 1;
  for (const [id, lvl] of Object.entries(tree)) {
    const n = treeNodeById(id);
    if (!n || lvl < 1 || !nodeLive(n)) continue;
    const p = (key: string): number => nodeParam(n, key, lvl);
    switch (n.effect.kind) {
      case 'autoclick':
        s.has.autoclick = true;
        s.autoclick.cps = Math.max(s.autoclick.cps, p('cps'));
        break;
      case 'autoclickSpeed':
        s.autoclick.cps = Math.max(s.autoclick.cps, p('cps'));
        break;
      case 'autoclickDuration':
        autoDuration = Math.max(autoDuration, p('sec'));
        break;
      case 'autoclickCooldown':
        s.autoclick.cooldownSec = Math.min(s.autoclick.cooldownSec, p('sec'));
        break;
      case 'autoclickCharges':
        s.autoclick.charges = Math.max(s.autoclick.charges, p('n'));
        break;
      case 'autoclickCombo':
        s.autoclick.combo = true;
        break;
      case 'autoCapture':
        s.autoCapture.on = true;
        s.autoCapture.maxPerTick = Math.max(s.autoCapture.maxPerTick, p('range'));
        break;
      case 'autoCaptureRange':
        s.autoCapture.maxPerTick = Math.max(s.autoCapture.maxPerTick, p('range'));
        break;
      case 'autoCaptureRare':
        s.autoCapture.rare = s.autoCapture.rare || p('rare') > 0;
        s.autoCapture.legendary = s.autoCapture.legendary || p('legendary') > 0;
        break;
      case 'autoCaptureMagnet':
        s.autoCapture.magnet = true;
        break;
      case 'autoBuy':
        s.autoBuy.on = true;
        break;
      case 'autoBuyLimit':
        s.autoBuy.maxLimit = Math.max(s.autoBuy.maxLimit, p('pct'));
        break;
      case 'autoBuyBatch':
        s.autoBuy.batch = Math.max(s.autoBuy.batch, p('n'));
        break;
      case 'autoBuySmart':
        s.autoBuy.smart = true;
        break;
      case 'autoBuyReserve':
        s.autoBuy.reserve = Math.max(s.autoBuy.reserve, p('pct'));
        break;
      case 'suggestPick':
        s.suggest.on = true;
        break;
      case 'suggestWhy':
        s.suggest.why = true;
        break;
      case 'autopilot':
        s.autopilot.on = true;
        s.has.autopilot = true;
        s.autopilot.durationSec = Math.max(s.autopilot.durationSec, p('sec'));
        break;
      case 'autopilotAll':
        pilotMult = Math.max(pilotMult, p('mult'));
        break;
      case 'skillPulse':
        s.has.pulse = true;
        s.pulse.touches = Math.max(s.pulse.touches, p('touches'));
        break;
      case 'pulseCharges':
        s.pulse.charges = Math.max(s.pulse.charges, p('n'));
        break;
      case 'pulseCooldown':
        s.pulse.cooldownSec = Math.min(s.pulse.cooldownSec, p('sec'));
        break;
      case 'pulseCombo':
        s.pulse.combo = true;
        break;
      case 'skillNova':
        s.has.supernova = true;
        s.supernova.touches = Math.max(s.supernova.touches, p('touches'));
        break;
      case 'novaPower':
        s.supernova.power = Math.max(s.supernova.power, p('mult'));
        break;
      case 'novaChain':
        s.supernova.chain = Math.max(s.supernova.chain, p('n'));
        break;
      case 'novaDouble':
        s.supernova.twice = true;
        break;
      case 'skillNovaBig':
        s.supernova.big = Math.max(s.supernova.big, p('mult'));
        break;
      case 'skillWarp':
        s.has['time-warp'] = true;
        s.warp.durationSec = Math.max(s.warp.durationSec, p('sec'));
        break;
      case 'warpDuration':
        s.warp.durationSec = Math.max(s.warp.durationSec, p('sec'));
        break;
      case 'warpCooldown':
        s.warp.cooldownSec = Math.min(s.warp.cooldownSec, p('sec'));
        break;
      case 'skillLens':
        s.has.lens = true;
        s.lens.durationSec = Math.max(s.lens.durationSec, p('sec'));
        break;
      case 'lensWide':
        s.lens.wide = true;
        break;
      case 'lensLong':
        s.lens.durationSec = Math.max(s.lens.durationSec, p('sec'));
        break;
      case 'skillMagnet':
        s.has.magnet = true;
        s.magnet.range = Math.max(s.magnet.range, p('range'));
        break;
      case 'magnetPull':
        s.magnet.pull = Math.max(s.magnet.pull, p('mult'));
        break;
      case 'skillCombo':
        s.comboMult = Math.max(s.comboMult, p('mult'));
        break;
      case 'skillCooldownAll':
        s.cooldownCut = Math.max(s.cooldownCut, p('pct') / 100);
        break;
      case 'skillMastery':
        s.mastery = true;
        break;
      case 'skillTimeDilate':
        s.extraSec = Math.max(s.extraSec, p('sec'));
        break;
      default:
    }
  }
  s.autopilot.durationSec *= pilotMult;
  if (s.has.autoclick) {
    s.autoclick.cps = Math.min(AUTOCLICK_MAX_CPS, s.autoclick.cps);
    s.autoclick.durationSec = Math.max(BASE.autoclickDuration, autoDuration);
  }
  return s;
}
