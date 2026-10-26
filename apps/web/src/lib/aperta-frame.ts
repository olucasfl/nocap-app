import { useEffect, useState, type CSSProperties } from 'react';

/**
 * Moldura do Aperta! no celular (pedido do Lucas: o jogo só existe de lado e NÃO pode mudar nem bugar quando se vira o
 * aparelho). Em vez de deixar o CSS reagir a `@media (orientation)` (no iOS o tamanho da janela chega velho e em passos
 * durante a virada, e o layout pisca), o tamanho e o giro do jogo vêm de um número só, medido por aqui:
 *
 *  - `free`: PC e telas grandes; a raiz ocupa a janela (CSS `inset: 0`).
 *  - `landscape`: celular deitado; a raiz ocupa a janela.
 *  - `rotated`: celular em pé; a raiz tem a largura e a altura TROCADAS e gira 90 graus, então o jogo continua de lado.
 *
 * Depois de cada evento de tamanho a medida se repete algumas vezes (o iOS demora a atualizar `innerWidth`/`innerHeight`),
 * e só muda de modo quando o valor realmente mudou.
 */
export type FrameMode = 'free' | 'landscape' | 'rotated';

export interface Frame {
  mode: FrameMode;
  /** Largura e altura da janela no momento da medida. */
  iw: number;
  ih: number;
}

/** Maior lado curto de um celular (CSS px); tablets passam disso e seguem livres. */
export const PHONE_MAX_SHORT_SIDE = 599;

/** Puro: o modo da moldura para uma janela `iw` x `ih`, em tela de toque ou não. */
export function frameFor(iw: number, ih: number, coarse: boolean): Frame {
  const phone = coarse && Math.min(iw, ih) <= PHONE_MAX_SHORT_SIDE;
  if (!phone) return { mode: 'free', iw, ih };
  return { mode: ih > iw ? 'rotated' : 'landscape', iw, ih };
}

/** Puro: o estilo que a raiz `.ap` recebe. Só o modo girado precisa de medidas em pixels. */
export function frameStyle(f: Frame): CSSProperties | undefined {
  if (f.mode !== 'rotated') return undefined;
  return {
    inset: 'auto',
    top: 0,
    left: 0,
    width: f.ih,
    height: f.iw,
    transformOrigin: '0 0',
    transform: `translateX(${f.iw}px) rotate(90deg)`,
  };
}

/** Atrasos (ms) das medidas depois de um evento de tamanho: o iOS entrega o tamanho novo aos poucos. */
export const MEASURE_DELAYS_MS = [0, 80, 250, 600];

function measure(): Frame {
  const coarse =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const vv = window.visualViewport;
  // `visualViewport` acompanha a janela de verdade (barra do Safari); sem ele vale `innerWidth/innerHeight`.
  const iw = Math.round(vv?.width ?? window.innerWidth);
  const ih = Math.round(vv?.height ?? window.innerHeight);
  return frameFor(iw, ih, coarse);
}

const same = (a: Frame, b: Frame) => a.mode === b.mode && a.iw === b.iw && a.ih === b.ih;

/** Moldura do jogo: atributo `data-frame` e estilo para pôr na raiz `.ap`. */
export function useApertaFrame(): { 'data-frame': FrameMode; style: CSSProperties | undefined } {
  const [frame, setFrame] = useState<Frame>(() =>
    typeof window === 'undefined' ? { mode: 'free', iw: 0, ih: 0 } : measure(),
  );

  useEffect(() => {
    let timers: number[] = [];
    const settle = () => {
      for (const t of timers) window.clearTimeout(t);
      timers = MEASURE_DELAYS_MS.map((d) =>
        window.setTimeout(() => {
          const next = measure();
          setFrame((prev) => (same(prev, next) ? prev : next));
        }, d),
      );
    };
    settle();
    window.addEventListener('resize', settle);
    window.addEventListener('orientationchange', settle);
    window.addEventListener('pageshow', settle);
    window.visualViewport?.addEventListener('resize', settle);
    return () => {
      for (const t of timers) window.clearTimeout(t);
      window.removeEventListener('resize', settle);
      window.removeEventListener('orientationchange', settle);
      window.removeEventListener('pageshow', settle);
      window.visualViewport?.removeEventListener('resize', settle);
    };
  }, []);

  return { 'data-frame': frame.mode, style: frameStyle(frame) };
}
