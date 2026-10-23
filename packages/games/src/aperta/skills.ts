// Habilidades ativas e automações do Aperta! (spec 040, etapa 19). As regras do anti-farm (spec 039, seção 5) valem aqui:
// o Autoclick conta como toque só até o teto de 6/s e só com o jogo aberto e visível (o relógio escondido congela tudo,
// ver `syncClock`), e nada disto rende com a aba fechada.

import { UPGRADES } from './catalog';
import { NOMINAL_TOUCHES_PER_SEC } from './economy';
import { awardAchievements } from './achievements';
import {
  buyUpgrade,
  captureObject,
  effectiveStats,
  isLegendary,
  nextUpgradeCost,
  pinsFirstObject,
  syncClock,
  type RunState,
  type SaveState,
  type SkillRun,
  withPick,
  offeredRarity,
} from './engine';
import { AUTO_CAPTURE_DELAY_SEC, AUTOBUY_DEFAULT_LIMIT, BASE, type ButtonSkillId, type SkillStats } from './tree-skills';

export interface SkillDef {
  id: ButtonSkillId;
  name: string;
  /** O que faz, em uma frase. */
  text: string;
}

export const SKILL_DEFS: readonly SkillDef[] = [
  { id: 'autoclick', name: 'Autoclick', text: 'Toques automáticos por um tempo.' },
  { id: 'autopilot', name: 'Piloto automático', text: 'Liga autoclick, captura e compra juntos por um tempo.' },
  { id: 'pulse', name: 'Pulso', text: 'Dá de uma vez a poeira de vários toques.' },
  { id: 'supernova', name: 'Supernova menor', text: 'Gasta a energia e vira poeira.' },
  { id: 'time-warp', name: 'Dobra temporal', text: 'Os geradores rendem em dobro por um tempo.' },
  { id: 'lens', name: 'Lente', text: 'Chama um objeto raro para o campo.' },
  { id: 'magnet', name: 'Ímã estelar', text: 'Os objetos no campo ficam mais tempo.' },
];

/** O id do registro guardado em `run.skills` de cada habilidade (a maioria é o próprio id). */
const CHAIN_KEY = 'chain';
/** Usar duas habilidades dentro desta janela dispara o bônus de combo (nó "Combo de habilidades"). */
const CHAIN_WINDOW_SEC = 8;
const MAGNET_SEC = 20;
const LENS_RARE_IN_SEC = 3;
const AUTOBUY_INTERVAL_SEC = 1;

export function skillsAvailable(state: SaveState): SkillDef[] {
  const has = effectiveStats(state).skills.has;
  return SKILL_DEFS.filter((d) => has[d.id]);
}

function baseCooldown(sk: SkillStats, id: ButtonSkillId): number {
  const raw = {
    autoclick: sk.autoclick.cooldownSec,
    autopilot: BASE.autopilotCooldown,
    pulse: sk.pulse.cooldownSec,
    supernova: sk.supernova.cooldownSec,
    'time-warp': sk.warp.cooldownSec,
    lens: BASE.lensCooldown,
    magnet: sk.magnet.cooldownSec,
  }[id];
  return raw * (1 - Math.min(0.6, sk.cooldownCut)) * (sk.mastery ? 0.9 : 1);
}

function maxCharges(sk: SkillStats, id: ButtonSkillId): number {
  return id === 'autoclick' ? sk.autoclick.charges : id === 'pulse' ? sk.pulse.charges : 1;
}

function duration(sk: SkillStats, id: ButtonSkillId): number {
  const raw = { autoclick: sk.autoclick.durationSec, autopilot: sk.autopilot.durationSec, 'time-warp': sk.warp.durationSec, lens: sk.lens.durationSec, magnet: MAGNET_SEC, pulse: 0, supernova: 0 }[id];
  return raw > 0 ? raw + sk.extraSec : 0;
}

/** Devolve as cargas que já voltaram: cada recarga completa devolve uma carga. */
function recharged(k: SkillRun | undefined, max: number, cooldown: number, now: number): SkillRun {
  const cur: SkillRun = k ?? { readyAt: 0, activeUntil: 0, charges: max };
  let { charges, readyAt } = cur;
  charges = Math.min(charges, max);
  while (charges < max && now >= readyAt) {
    charges += 1;
    readyAt = charges < max ? readyAt + cooldown : readyAt;
  }
  return { ...cur, charges, readyAt };
}

export interface SkillView {
  id: ButtonSkillId;
  name: string;
  text: string;
  charges: number;
  maxCharges: number;
  /** Segundos até a próxima carga voltar (0 se há carga). */
  cooldownLeft: number;
  /** Segundos que ainda dura (0 se não está ligada). */
  activeLeft: number;
  /** 0 a 1: quanto da recarga já passou (a barra de recarga, só por `transform`). */
  recharge: number;
  ready: boolean;
}

export function skillView(state: SaveState, id: ButtonSkillId, now: number): SkillView | null {
  const sk = effectiveStats(state).skills;
  if (!sk.has[id]) return null;
  const def = SKILL_DEFS.find((d) => d.id === id) as SkillDef;
  const max = maxCharges(sk, id);
  const cd = baseCooldown(sk, id);
  const k = recharged(state.run.skills[id], max, cd, now);
  const ready = k.charges > 0;
  const cooldownLeft = ready ? 0 : Math.max(0, k.readyAt - now);
  return {
    id,
    name: def.name,
    text: def.text,
    charges: k.charges,
    maxCharges: max,
    cooldownLeft,
    activeLeft: Math.max(0, k.activeUntil - now),
    recharge: ready ? 1 : Math.max(0, Math.min(1, 1 - cooldownLeft / Math.max(1, cd))),
    ready,
  };
}

/** Marca o uso de uma habilidade nas contas da conta (conquistas da família Automação). */
function noteUse(state: SaveState, id: string, count = true): SaveState {
  const used = state.stats.skillsUsed.includes(id) ? state.stats.skillsUsed : [...state.stats.skillsUsed, id];
  return { ...state, stats: { ...state.stats, skillsUsed: used, skillUses: state.stats.skillUses + (count ? 1 : 0) } };
}

/**
 * Usa uma habilidade: confere se existe (nó comprado), se há carga e se não há escolha aberta ou jogo parado
 * (quem chama não chama parado). Devolve o mesmo estado se não deu.
 */
/** Fração do ganho de Pulso e Supernova que entra quando a pessoa está tocando (ritmo ativo). */
export const SKILL_TOUCHING_SHARE = 0.25;

export function activateSkill(state: SaveState, id: ButtonSkillId, now: number): SaveState {
  const s = syncClock(state, now);
  if (s.run.pending || s.tutorial !== 'done') return state;
  const stats = effectiveStats(s);
  const sk = stats.skills;
  if (!sk.has[id]) return state;
  const max = maxCharges(sk, id);
  const cd = baseCooldown(sk, id);
  const cur = recharged(s.run.skills[id], max, cd, now);
  if (cur.charges <= 0) return state;

  // Combo de habilidades: a 2ª habilidade logo depois da 1ª rende mais.
  const chainAt = s.run.skills[CHAIN_KEY]?.activeUntil ?? 0;
  const chained = sk.comboMult > 1 && now < chainAt;
  const chainMult = chained ? sk.comboMult : 1;
  const touch = stats.dustPerTouch;
  const comboFull = (1 + stats.combo.pointValue * stats.combo.max) * stats.combo.fullMult;

  let run: RunState = s.run;
  let gain = 0;
  const dur = duration(sk, id);
  const next: SkillRun = { ...cur, charges: cur.charges - 1, readyAt: cur.charges >= max ? now + cd : cur.readyAt, activeUntil: dur > 0 ? now + dur : 0 };

  switch (id) {
    case 'pulse': {
      gain = touch * sk.pulse.touches * chainMult * (sk.pulse.combo && stats.combo.enabled ? comboFull : 1);
      if (sk.pulse.combo && stats.combo.enabled) run = { ...run, combo: stats.combo.max, lastPressAt: now };
      break;
    }
    case 'supernova': {
      const energyTouches = stats.energyPerTouch > 0 ? run.energy / stats.energyPerTouch : 0;
      const shots = (sk.supernova.twice ? 2 : 1) + sk.supernova.chain * 0.25;
      gain = touch * (sk.supernova.touches + energyTouches) * sk.supernova.power * sk.supernova.big * shots * chainMult;
      run = { ...run, energy: 0 };
      break;
    }
    case 'lens': {
      // Chama a Estrela Dourada para daqui a pouco (sem passar o intervalo normal).
      if (!stats.objects.disabled && !run.objects.some((o) => o.kind === 'golden')) {
        run = { ...run, nextRareAt: Math.min(run.nextRareAt ?? Infinity, now + LENS_RARE_IN_SEC) };
      }
      break;
    }
    case 'magnet': {
      const extra = 3 * Math.max(1, sk.magnet.range) * sk.magnet.pull;
      run = { ...run, objects: run.objects.map((o) => ({ ...o, expiresAt: o.expiresAt + extra })) };
      break;
    }
    default:
  }

  // Habilidades só poupam toque (decisão do Lucas, 23/10/2026): tocando, o pulso e a supernova rendem só uma fração.
  const touching = now - s.run.lastPressAt <= stats.activeWindowSec;
  const dust = Math.floor(gain * (touching ? SKILL_TOUCHING_SHARE : 1));
  run = {
    ...run,
    dust: dust > 0 ? run.dust + dust : run.dust,
    dustLife: dust > 0 ? run.dustLife + dust : run.dustLife,
    skills: {
      ...run.skills,
      [id]: next,
      [CHAIN_KEY]: { readyAt: 0, charges: 0, activeUntil: now + CHAIN_WINDOW_SEC },
    },
  };
  let out: SaveState = { ...s, run, stats: dust > 0 ? { ...s.stats, dustTotal: s.stats.dustTotal + dust } : s.stats };
  out = noteUse(out, id);
  // O Piloto também conta como uso das três automações.
  if (id === 'autopilot') out = noteUse(noteUse(out, 'autoclick', false), 'autopilot', false);
  return awardAchievements(out);
}

/** Liga ou desliga a Compra automática e muda o limite de preço (% da poeira por compra). */
export function setAutoBuy(state: SaveState, patch: { on?: boolean; limit?: number }): SaveState {
  const sk = effectiveStats(state).skills;
  if (!sk.autoBuy.on) return state;
  const cur = state.run.autoBuy;
  const limit = Math.max(1, Math.min(sk.autoBuy.maxLimit, Math.round(patch.limit ?? cur.limit)));
  const on = patch.on ?? cur.on;
  if (on === cur.on && limit === cur.limit) return state;
  return { ...state, run: { ...state.run, autoBuy: { on, limit } } };
}

const piloted = (run: RunState, now: number): boolean => (run.skills.autopilot?.activeUntil ?? 0) > now;

/**
 * Captura e Compra automáticas, uma vez por tick do jogo (só roda com o jogo aberto: quem chama é o laço da tela, que
 * não anda com a aba escondida nem pausado). Sem escolha aberta e só depois do tutorial.
 */
export function tickAutomation(state: SaveState, now: number): SaveState {
  if (state.run.pending || state.tutorial !== 'done') return state;
  const sk = effectiveStats(state).skills;
  let s = state;

  if (sk.autoCapture.on && s.run.objects.length > 0 && !pinsFirstObject(s)) {
    const wait = sk.autoCapture.magnet ? AUTO_CAPTURE_DELAY_SEC / 3 : AUTO_CAPTURE_DELAY_SEC;
    let taken = 0;
    for (const o of s.run.objects) {
      if (taken >= sk.autoCapture.maxPerTick) break;
      if (now - o.bornAt < wait) continue;
      if (o.kind === 'golden' || o.kind === 'probe') {
        if (!sk.autoCapture.rare) continue;
      } else if (isLegendary(o.kind) && !sk.autoCapture.legendary) continue;
      const after = captureObject(s, o.id, now);
      if (after !== s) {
        s = noteUse(after, 'auto-capture', false);
        taken += 1;
      }
    }
  }

  // Habilidades só poupam toque: o Piloto compra só com a pessoa parada (tocando, ela mesma compra).
  const idle = now - s.run.lastPressAt > effectiveStats(s).activeWindowSec;
  const buying = sk.autoBuy.on && (s.run.autoBuy.on || (piloted(s.run, now) && idle));
  if (buying) {
    const k = s.run.skills['auto-buy'];
    if (!k || now >= k.readyAt) {
      s = { ...s, run: { ...s.run, skills: { ...s.run.skills, 'auto-buy': { readyAt: now + AUTOBUY_INTERVAL_SEC, activeUntil: 0, charges: 0 } } } };
      const limit = Math.min(sk.autoBuy.maxLimit, s.run.autoBuy.limit || AUTOBUY_DEFAULT_LIMIT) / 100;
      for (let n = 0; n < sk.autoBuy.batch; n++) {
        const budget = s.run.dust * (1 - sk.autoBuy.reserve / 100);
        let best = -1;
        let bestCost = sk.autoBuy.smart ? -Infinity : Infinity;
        UPGRADES.forEach((_, i) => {
          const cost = nextUpgradeCost(s, i);
          if (cost === null || cost > budget * limit) return;
          if (sk.autoBuy.smart ? cost > bestCost : cost < bestCost) {
            best = i;
            bestCost = cost;
          }
        });
        if (best < 0) break;
        const bought = buyUpgrade(s, best);
        if (bought === s) break;
        s = noteUse(bought, 'auto-buy', false);
      }
    }
  }
  return s;
}

export interface Suggestion {
  id: string;
  /** Quanto o ganho por segundo sobe (em %), para mostrar o motivo (com o nó "Sugestão com motivo"). */
  gainPct: number;
}

/**
 * Escolha sugerida (nó da Automação): a carta da oferta que mais sobe o ganho por segundo agora. Só destaca; nunca escolhe.
 * `null` sem o nó, sem oferta aberta ou se nenhuma carta muda o ganho.
 */
export function suggestedOffer(state: SaveState): Suggestion | null {
  const p = state.run.pending;
  if (!p || !effectiveStats(state).skills.suggest.on) return null;
  const rate = (st: SaveState): number => {
    const e = effectiveStats(st);
    return e.dustPerTouch * NOMINAL_TOUCHES_PER_SEC + Math.min(e.autoDustPerSec, e.autoDustCap);
  };
  const base = rate(state);
  let best: Suggestion | null = null;
  for (const id of p.offers) {
    const hypothetical = withPick(state, id, offeredRarity(state, id));
    const gainPct = base > 0 ? (rate(hypothetical) / base - 1) * 100 : 0;
    if (!best || gainPct > best.gainPct) best = { id, gainPct };
  }
  return best && best.gainPct > 0 ? best : null;
}

/** Conta o uso da Escolha sugerida para a conquista (quando a pessoa escolhe a carta destacada). */
export function noteSuggestionTaken(state: SaveState): SaveState {
  return awardAchievements(noteUse(state, 'auto-suggest', false));
}
