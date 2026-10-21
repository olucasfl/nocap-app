import { UPGRADES } from './catalog';
import { clampNum, nextUpgradeCost, type SaveState } from './engine';

/** Passos do tutorial guiado (spec 038, seção 4.6). `SaveState.tutorial` guarda o passo atual ou 'done'. */
export const TUTORIAL_STEPS = 5;
/** O grimório do tutorial é sempre a Lua. */
export const TUTORIAL_GRIMOIRE = 'moon';
/** A melhoria do passo 4. */
export const TUTORIAL_UPGRADE_ID = 'pulse';

/** Poeira que o tutorial entrega de uma vez (a 1ª compra do Pulso Solar): a validação do ritmo a perdoa. */
export const TUTORIAL_DUST_ALLOWANCE = UPGRADES.find((u) => u.id === TUTORIAL_UPGRADE_ID)?.base ?? 0;

export function tutorialActive(state: SaveState): boolean {
  return state.tutorial !== 'done';
}

/** Passo atual (1 a 5) ou `null` com o tutorial concluído. */
export function tutorialStep(state: SaveState): number | null {
  return state.tutorial === 'done' ? null : Math.min(TUTORIAL_STEPS, Math.max(1, state.tutorial));
}

export function tutorialUpgradeIndex(): number {
  return UPGRADES.findIndex((u) => u.id === TUTORIAL_UPGRADE_ID);
}

/** Vai para o passo `to` só se o save está em `from`: uma transição repetida (duplo toque) não pula passos. */
export function advanceTutorial(state: SaveState, from: number, to: number | 'done'): SaveState {
  if (state.tutorial !== from) return state;
  return { ...state, tutorial: to };
}

/** "Pular tutorial" e "Começar a jogar": marca como feito. */
export function finishTutorial(state: SaveState): SaveState {
  return state.tutorial === 'done' ? state : { ...state, tutorial: 'done' };
}

/**
 * Passo 1: o primeiro toque já entrega a Lua, sem sorteio nem espera. Conta como uma escolha de verdade
 * (álbum, nível, contagem de escolhas), zera a barra e fecha qualquer escolha que o toque tenha aberto.
 */
export function grantTutorialGrimoire(state: SaveState): SaveState {
  const run = state.run;
  const current = run.build[TUTORIAL_GRIMOIRE] ?? 0;
  return {
    ...state,
    run: {
      ...run,
      build: { ...run.build, [TUTORIAL_GRIMOIRE]: Math.max(1, current) },
      picks: run.picks + (current === 0 ? 1 : 0),
      energy: 0,
      pending: null,
    },
    album: state.album.includes(TUTORIAL_GRIMOIRE) ? state.album : [...state.album, TUTORIAL_GRIMOIRE],
    stats: { ...state.stats, picks: state.stats.picks + (current === 0 ? 1 : 0) },
  };
}

/** Passo 2: completa a poeira que falta para a 1ª compra do Pulso Solar (nunca tira poeira). */
export function grantTutorialDust(state: SaveState): SaveState {
  const cost = nextUpgradeCost(state, tutorialUpgradeIndex());
  if (cost === null || state.run.dust >= cost) return state;
  const missing = cost - state.run.dust;
  return {
    ...state,
    run: { ...state.run, dust: clampNum(cost), dustLife: clampNum(state.run.dustLife + missing) },
    stats: { ...state.stats, dustTotal: clampNum(state.stats.dustTotal + missing) },
  };
}

/**
 * O que o motor permite durante o tutorial: no passo 1 só o toque, no 4 só a compra do Pulso Solar,
 * nos outros nada. Com o tutorial concluído, tudo.
 */
export function tutorialAllows(state: SaveState, action: 'press' | 'buy', upgradeIndex?: number): boolean {
  const step = tutorialStep(state);
  if (step === null) return true;
  if (action === 'press') return step === 1;
  return step === 4 && upgradeIndex === tutorialUpgradeIndex();
}
