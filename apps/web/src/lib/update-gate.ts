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
 * a uma partida) nem no meio de uma partida de sala: a versão nova espera.
 *
 * Exceção, a pedido do Lucas: quem chega a uma sala (link, código) sem a versão nova vê o aviso
 * **antes de qualquer coisa**, e quem já está no lobby dela também (a partida ainda não começou).
 * Depois de atualizar a página recarrega e a pessoa volta para a mesma sala.
 */
export function canShowUpdate(pathname: string, inRoom: boolean, roomPhase?: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const onRoomPage = path === '/sala' || path.startsWith('/sala/');
  if (inRoom) return onRoomPage && roomPhase === 'lobby';
  if (onRoomPage) return true;
  return CALM_ROUTES.some((r) => path === r || (r !== '/' && path.startsWith(`${r}/`)));
}
