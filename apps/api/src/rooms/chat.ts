import { RoomError } from './color-room.engine';

export const CHAT_MAX_LEN = 200;
export const CHAT_HISTORY = 50;
/** No máximo 1 mensagem por segundo e 5 a cada 10 segundos por pessoa. */
const MIN_GAP_MS = 1000;
const WINDOW_MS = 10_000;
const WINDOW_MAX = 5;

export interface ChatMessage {
  id: number;
  userId: string;
  username: string;
  text: string;
  at: number;
}

/**
 * Conversa de uma sala. Só vive na memória do motor: não vai ao banco e some com a sala. O
 * servidor limpa, limita o tamanho e o ritmo; o cliente não é confiável.
 */
export class RoomChat {
  private messages: ChatMessage[] = [];
  private seq = 0;
  private muted = new Set<string>();
  private sent = new Map<string, number[]>();

  constructor(private readonly now: () => number) {}

  send(userId: string, username: string, raw: string): ChatMessage {
    if (this.muted.has(userId)) throw new RoomError('O líder silenciou você nesta sala');
    // Sem caracteres de controle e com espaços normalizados: texto simples.
    const text = raw
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) throw new RoomError('Escreva algo antes de enviar');
    if (text.length > CHAT_MAX_LEN) {
      throw new RoomError(`Mensagem longa demais (até ${CHAT_MAX_LEN} caracteres)`);
    }
    const t = this.now();
    const recent = (this.sent.get(userId) ?? []).filter((x) => t - x < WINDOW_MS);
    const last = recent[recent.length - 1];
    if ((last !== undefined && t - last < MIN_GAP_MS) || recent.length >= WINDOW_MAX) {
      throw new RoomError('Calma, uma de cada vez');
    }
    recent.push(t);
    this.sent.set(userId, recent);
    const message = { id: ++this.seq, userId, username, text, at: t };
    this.messages.push(message);
    if (this.messages.length > CHAT_HISTORY) this.messages.shift();
    return message;
  }

  /** Silencia ou libera; devolve `true` se agora está silenciado. */
  toggleMute(userId: string): boolean {
    if (this.muted.delete(userId)) return false;
    this.muted.add(userId);
    return true;
  }

  forget(userId: string) {
    this.muted.delete(userId);
    this.sent.delete(userId);
  }

  history(): ChatMessage[] {
    return [...this.messages];
  }

  mutedList(): string[] {
    return [...this.muted];
  }
}
