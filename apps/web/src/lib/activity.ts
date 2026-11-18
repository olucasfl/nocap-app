/**
 * O que a pessoa está fazendo agora, a partir da tela em que está: dentro de um jogo, numa sala ou navegando no NoCap.
 * Vai no batimento do app (`/me/ping`) e aparece para os amigos como "online · jogando X". Só o tipo e o id do jogo
 * saem do aparelho; nada além disso.
 */
export type Activity = { state: 'game'; game: string } | { state: 'room'; game: null } | { state: 'menu'; game: null };

export const GAME_LABELS: Record<string, string> = {
  color: 'Mesmíssima',
  time: 'Já Deu?',
  eco: 'Ecooo',
  blocks: "Block's",
  atravessa: 'Atravessa!',
  words: "Word's",
  wclassic: "Word's",
  desmorona: 'Desmorona!',
  foxgp: 'Fox GP',
  bola: 'Fut Fox',
  pingpong: 'Ping Fox!',
  counterfox: 'Counter Fox',
  minigolf: 'Mini Golf',
  nighthunt: 'Night Hunt',
  impostor: 'Impostor',
  mimica: 'Mímica',
};

const PATH_GAMES: [RegExp, string][] = [
  [/^\/cor(\/|$)/, 'color'],
  [/^\/tempo(\/|$)/, 'time'],
  [/^\/eco(\/|$)/, 'eco'],
  [/^\/atravessa(\/|$)/, 'atravessa'],
  [/^\/blocks(\/|$)/, 'blocks'],
  [/^\/words(\/|$)/, 'words'],
  [/^\/minigolf(\/|$)/, 'minigolf'],
  [/^\/nighthunt(\/|$)/, 'nighthunt'],
  [/^\/mesa\/impostor(\/|$)/, 'impostor'],
  [/^\/mesa\/mimica(\/|$)/, 'mimica'],
  [/^\/fox-cap\/desmorona(\/|$)/, 'desmorona'],
  [/^\/fox-cap\/bola(\/|$)/, 'bola'],
  [/^\/fox-cap\/counter-fox(\/|$)/, 'counterfox'],
];

/** `pathname` e o `jogo` da busca (`/fox-cap?jogo=foxgp`) viram a atividade. */
export function activityFor(pathname: string, jogo?: string | null): Activity {
  if (pathname.startsWith('/sala')) return { state: 'room', game: null };
  for (const [re, game] of PATH_GAMES) if (re.test(pathname)) return { state: 'game', game };
  if (pathname.startsWith('/fox-cap') && jogo && jogo !== 'foxcap') return { state: 'game', game: jogo };
  return { state: 'menu', game: null };
}

/** "jogando Fox GP", "numa sala", "no menu"; `null` quando não sabe (versão antiga do servidor). */
export function activityText(a: Activity | null | undefined): string | null {
  if (!a) return null;
  if (a.state === 'room') return 'numa sala';
  if (a.state === 'menu') return 'no menu';
  const name = GAME_LABELS[a.game];
  return name ? `jogando ${name}` : 'jogando';
}
