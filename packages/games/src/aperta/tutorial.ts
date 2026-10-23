import { UPGRADES } from './catalog';
import { nextUpgradeCost, type SaveState } from './engine';
import { sparksTotal } from './sparks';

/**
 * Tutorial dinâmico do Aperta! (spec 038, seção 4.6): o jogador age, a tela reage e o passo só avança por
 * ação. `SaveState.tutorial` guarda o passo atual ou 'done'; `SaveState.ui` guarda o que já apareceu.
 *
 *  1 TOUCH      só o botão central: "Toque aqui para ganhar poeira"
 *  2 UPGRADE    poeira da 1ª melhoria juntada: surge Melhorias; abrir a página e comprar
 *  3 BACK       comprou: fechar a página e voltar a tocar
 *  4 FILL       tocar até a barra de energia encher
 *  5 CHOOSE     a escolha do 1º grimório abriu: surge Grimórios; cartão explica a escolha
 *  6 GRIMOIRES  abrir a página de Grimórios
 *  7 FREE       jogo livre; cartões curtos por gatilho (conquista, objeto) e, por último, a árvore
 */
export const TUTORIAL = { TOUCH: 1, UPGRADE: 2, BACK: 3, FILL: 4, CHOOSE: 5, GRIMOIRES: 6, FREE: 7 } as const;
/** Último passo guiado (os passos 1 a 6 são seguidos; o 7 só mostra cartões por gatilho). */
export const TUTORIAL_STEPS = TUTORIAL.GRIMOIRES;

/** Botões que nascem escondidos e vão surgindo com o tutorial. Os objetos no espaço aparecem no passo 7. */
export type UiButton = 'upgrades' | 'grimoires' | 'achievements' | 'tree';
export const UI_BUTTONS: readonly UiButton[] = ['upgrades', 'grimoires', 'achievements', 'tree'];

/** Cartões do passo 7: cada um tem um gatilho, menos a árvore, que vem por último. */
export type TutorialHint = 'achievements' | 'objects' | 'collapse' | 'tree';
export const TUTORIAL_HINTS: readonly TutorialHint[] = ['achievements', 'objects', 'collapse', 'tree'];

/**
 * A 1ª conquista ("Primeiro toque") cai no 1º toque, no meio do passo 1, e ninguém a vê. O cartão de
 * Conquistas espera a seguinte, que chega com o aviso na tela.
 */
export const ACHIEVEMENT_HINT_AT = 2;

export interface UiState {
  /** Botões já liberados pelo tutorial (quem pula ou tem progresso antigo vê todos, ver `unlockedButtons`). */
  unlocked: UiButton[];
  /** Cartões do passo 7 já vistos. */
  hints: TutorialHint[];
  /** Quantas conquistas a pessoa já viu na página (o selo da dock mostra as que passam disso). */
  achSeen?: number;
}

export const freshUi = (): UiState => ({ unlocked: [], hints: [], achSeen: 0 });

export function tutorialActive(state: SaveState): boolean {
  return state.tutorial !== 'done';
}

/** Passo atual (1 a 7) ou `null` com o tutorial concluído. */
export function tutorialStep(state: SaveState): number | null {
  return state.tutorial === 'done' ? null : Math.min(TUTORIAL.FREE, Math.max(1, state.tutorial));
}

/** Os objetos no espaço só aparecem a partir do jogo livre (antes disso a tela é só o botão). */
export function objectsVisible(state: SaveState): boolean {
  const step = tutorialStep(state);
  return step === null || step >= TUTORIAL.FREE;
}

/** Vai para o passo `to` só se o save está em `from`: uma transição repetida (duplo toque) não pula passos. */
export function advanceTutorial(state: SaveState, from: number, to: number | 'done'): SaveState {
  if (state.tutorial !== from) return state;
  return { ...state, tutorial: to };
}

/** "Pular tutorial": marca como feito, e com isso todos os botões aparecem de uma vez. */
export function finishTutorial(state: SaveState): SaveState {
  return state.tutorial === 'done' ? state : { ...state, tutorial: 'done' };
}

const totalUpgradeLevels = (state: SaveState) => state.run.upgradeLevels.reduce((sum, lvl) => sum + lvl, 0);

/** Alguma melhoria já cabe na poeira de agora? (o gatilho do passo 1; o preço vem do motor) */
export function canAffordUpgrade(state: SaveState): boolean {
  return affordableUpgradeIndex(state) !== null;
}

/** A melhoria mais barata que já dá para comprar: a que o tutorial manda comprar. */
export function affordableUpgradeIndex(state: SaveState): number | null {
  let best: number | null = null;
  let bestCost = Infinity;
  for (let i = 0; i < UPGRADES.length; i++) {
    const cost = nextUpgradeCost(state, i);
    if (cost !== null && state.run.dust >= cost && cost < bestCost) {
      best = i;
      bestCost = cost;
    }
  }
  return best;
}

/** O cartão do passo 7 que está na vez (ou `null`): conquista e objeto por gatilho, a árvore por último. */
export function pendingHint(state: SaveState): TutorialHint | null {
  if (state.tutorial !== TUTORIAL.FREE) return null;
  const seen = state.ui.hints;
  if (!seen.includes('achievements') && state.achievements.length >= ACHIEVEMENT_HINT_AT) return 'achievements';
  if (!seen.includes('objects') && state.run.objects.length > 0) return 'objects';
  // O colapso é explicado cedo (2 grimórios escolhidos), com a meta à vista: a pessoa precisa saber para onde está indo.
  if (!seen.includes('collapse') && state.run.picks >= 2) return 'collapse';
  // A Árvore entra com a 1ª Cintila ganha (as conquistas pagam), depois dos outros dois cartões.
  if (!seen.includes('tree') && seen.includes('achievements') && seen.includes('objects') && seen.includes('collapse') && sparksTotal(state) >= 1) return 'tree';
  return null;
}

/** Botão que o cartão `hint` apresenta (o de objetos não tem botão). */
export function hintButton(hint: TutorialHint): UiButton | null {
  return hint === 'objects' || hint === 'collapse' ? null : hint;
}

/** Marca um cartão como visto; com os três vistos, o tutorial termina. */
export function markHintSeen(state: SaveState, hint: TutorialHint): SaveState {
  if (state.tutorial === 'done' || state.ui.hints.includes(hint)) return state;
  const hints = [...state.ui.hints, hint];
  const ui = { ...state.ui, hints };
  return TUTORIAL_HINTS.every((h) => hints.includes(h)) ? { ...state, ui, tutorial: 'done' } : { ...state, ui };
}

function unlock(state: SaveState, ...buttons: UiButton[]): SaveState {
  const missing = buttons.filter((b) => !state.ui.unlocked.includes(b));
  return missing.length === 0 ? state : { ...state, ui: { ...state.ui, unlocked: [...state.ui.unlocked, ...missing] } };
}

function settleOnce(state: SaveState): SaveState {
  const step = state.tutorial;
  if (step === 'done') return state;
  const pending = state.run.pending !== null;

  // A barra pode encher antes do que o roteiro previa (toques sem comprar): pula direto para a escolha.
  if (step < TUTORIAL.CHOOSE && pending) return unlock({ ...state, tutorial: TUTORIAL.CHOOSE }, 'upgrades', 'grimoires');
  if (step === TUTORIAL.TOUCH && canAffordUpgrade(state)) return unlock({ ...state, tutorial: TUTORIAL.UPGRADE }, 'upgrades');
  if (step === TUTORIAL.UPGRADE && totalUpgradeLevels(state) > 0) return { ...state, tutorial: TUTORIAL.BACK };
  if (step === TUTORIAL.CHOOSE && !pending && state.run.picks > 0) return unlock({ ...state, tutorial: TUTORIAL.GRIMOIRES }, 'grimoires');
  if (step === TUTORIAL.FREE) {
    const hint = pendingHint(state);
    const button = hint ? hintButton(hint) : null;
    if (button) return unlock(state, button);
  }
  return state;
}

/**
 * Aplica as transições que dependem só do progresso (poeira juntada, compra feita, escolha aberta ou feita,
 * gatilhos do passo 7). O controlador chama depois de cada mudança; devolve o mesmo objeto se nada mudou.
 */
export function settleTutorial(state: SaveState): SaveState {
  let current = state;
  for (let i = 0; i < 8; i++) {
    const next = settleOnce(current);
    if (next === current) return current;
    current = next;
  }
  return current;
}

/**
 * Botões visíveis. Com o tutorial concluído (ou pulado) são todos; durante ele valem os liberados e o que o
 * progresso já provou (comprou melhoria, tem grimório), para o save não esconder o que a pessoa já usou.
 */
export function unlockedButtons(state: SaveState): ReadonlySet<UiButton> {
  if (state.tutorial === 'done') return new Set(UI_BUTTONS);
  const set = new Set<UiButton>(state.ui.unlocked);
  if (totalUpgradeLevels(state) > 0) set.add('upgrades');
  if (state.album.length > 0 || state.run.picks > 0) set.add('grimoires');
  return set;
}

/**
 * Save de antes do tutorial dinâmico (sem `ui`): quem já tocou entra com tudo liberado (tutorial concluído),
 * mesmo parado num passo do roteiro antigo, cujos números mudaram; quem nunca tocou começa do passo 1.
 */
export function migrateTutorial(save: SaveState): SaveState {
  if ((save as Partial<SaveState>).ui !== undefined) return save;
  const played = save.stats.clicks > 0 || save.run.clicks > 0;
  return { ...save, ui: freshUi(), tutorial: save.tutorial === 'done' || played ? 'done' : 1 };
}

/** Conquistas ganhas que a pessoa ainda não viu na página. */
export function unseenAchievements(state: SaveState): number {
  return Math.max(0, state.achievements.length - (state.ui.achSeen ?? 0));
}

/** A pessoa abriu a página de Conquistas: tudo que foi ganho até agora está visto. */
export function markAchievementsSeen(state: SaveState): SaveState {
  if (state.achievements.length <= (state.ui.achSeen ?? 0)) return state;
  return { ...state, ui: { ...state.ui, achSeen: state.achievements.length } };
}
