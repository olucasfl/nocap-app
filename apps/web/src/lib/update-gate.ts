/** Telas em que dá para interromper a pessoa sem atrapalhar nada que ela esteja fazendo. */
const CALM_ROUTES = [
  '/',
  '/ranking',
  '/historico',
  '/amigos',
  '/perfil',
  '/entrar',
  '/criar-conta',
];

/**
 * O aviso de versão nova só aparece quando não vai atrapalhar: no início, no ranking, no
 * histórico, nos amigos, no perfil e no login. Nunca dentro de um jogo (nem no menu dele, que leva
 * a uma partida), de uma sala, do lobby ou do pódio, nem enquanto a conta está conectada a uma sala.
 * A versão nova espera: ao chegar numa tela calma o aviso aparece.
 */
export function canShowUpdate(pathname: string, inRoom: boolean): boolean {
  if (inRoom) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return CALM_ROUTES.some((r) => path === r || (r !== '/' && path.startsWith(`${r}/`)));
}
