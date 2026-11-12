/**
 * Avisos do Fox GP (spec 080, Fase 10): uma fila só, no centro em cima. Um aviso não atropela o outro: cada um fica pelo
 * menos 2 s (texto de leitura), entra e sai em 350 ms. Pura, com teste.
 */
export type GpNoticeKind = 'info' | 'highlight' | 'drs' | 'turbo' | 'alert' | 'result';

export interface GpNotice {
  id: number;
  kind: GpNoticeKind;
  text: string;
  /** Linha menor embaixo (opcional). */
  sub?: string;
  /** Quanto fica na tela (ms), contando a entrada e a saída. */
  ms: number;
}

/** Mínimo na tela (leitura) e o tempo de entrada/saída. */
export const NOTICE_MIN_MS = 2000;
export const NOTICE_FADE_MS = 350;
/** Mais que isto na fila: os mais velhos do mesmo tipo saem (não acumula aviso velho). */
const QUEUE_MAX = 4;

export class GpNoticeQueue {
  private queue: GpNotice[] = [];
  private seq = 0;
  current: GpNotice | null = null;
  private until = 0;

  /** Entra na fila. Um aviso igual ao que está na tela ou já na fila é ignorado. */
  push(kind: GpNoticeKind, text: string, ms = NOTICE_MIN_MS + 600, sub?: string) {
    if (this.current?.text === text || this.queue.some((n) => n.text === text)) return;
    this.queue.push({ id: ++this.seq, kind, text, sub, ms: Math.max(NOTICE_MIN_MS, ms) });
    if (this.queue.length > QUEUE_MAX) {
      const i = this.queue.findIndex((n) => n.kind === kind);
      this.queue.splice(i >= 0 ? i : 0, 1);
    }
  }

  /** A cada quadro: troca para o próximo quando o de agora acabou. Devolve true se mudou. */
  tick(now: number): boolean {
    if (this.current && now < this.until) return false;
    const next = this.queue.shift() ?? null;
    if (next === this.current) return false;
    this.current = next;
    if (next) this.until = now + next.ms;
    return true;
  }

  clear() {
    this.queue = [];
    this.current = null;
    this.until = 0;
  }
}
