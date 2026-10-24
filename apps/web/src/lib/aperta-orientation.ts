/**
 * O Aperta! no celular é só de lado. Onde o navegador deixa (Android, em tela cheia ou PWA instalado), travamos a
 * orientação em paisagem; onde não deixa (iOS), o CSS gira a tela inteira do jogo quando o aparelho está em pé
 * (`aperta.css`). As duas coisas valem só para tela de toque.
 */
interface LockableOrientation extends ScreenOrientation {
  lock?: (orientation: 'landscape') => Promise<void>;
}

const isTouch = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

/** Tenta travar em paisagem; precisa ser chamado dentro de um toque do jogador (por isso sai do botão Jogar). Falha em silêncio. */
export async function tryLockLandscape(): Promise<void> {
  if (!isTouch()) return;
  const o = typeof screen !== 'undefined' ? (screen.orientation as LockableOrientation | undefined) : undefined;
  if (!o?.lock) return;
  try {
    await o.lock('landscape');
    return;
  } catch {
    /* sem tela cheia o Chrome recusa: tenta de novo entrando nela */
  }
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await o.lock('landscape');
  } catch {
    /* não deu: o CSS cuida de girar a tela */
  }
}

/** Solta a trava e sai da tela cheia (ao sair do Aperta!). */
export function releaseOrientation(): void {
  try {
    (screen.orientation as { unlock?: () => void } | undefined)?.unlock?.();
  } catch {
    /* sem suporte */
  }
  if (typeof document !== 'undefined' && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
}
