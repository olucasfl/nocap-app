import { currentRtt, sendRoomQuiet, subscribeRoom } from './rooms';

/** Um quadro do fluxo da partida (ver `BolaMatch.drainFrame`). */
export type BolaFrame = Record<string, unknown>;

export interface BolaRosterRow {
  slot: number;
  id: string;
  name: string;
  team: number;
  bot: boolean;
  away: boolean;
}

/**
 * Por onde a partida online chega e a entrada sai. O cliente do jogo só conhece isto: o servidor da sala, o aparelho
 * do líder (WebRTC) e o próprio líder (canal local, sem rede) têm o mesmo formato.
 */
export interface BolaLink {
  /** `[mx, mz, contador de pulos, número de sequência]` para quem simula. */
  sendInput(v: number[]): void;
  /** Cada quadro novo da partida. */
  onFrame(cb: (f: BolaFrame) => void): () => void;
  /** A lista de corpos mudou (alguém virou bot...). Opcional: pelo servidor ela vem no estado da sala. */
  onRoster?(cb: (rows: BolaRosterRow[]) => void): () => void;
  /** Ida e volta até quem simula (ms); 0 no aparelho do líder. */
  rtt(): number;
  /** Sem rede nenhuma (o aparelho do líder): pede menos atraso de desenho. */
  local: boolean;
  /** O menor atraso de desenho (ms) que o caminho aguenta: o servidor precisa de mais que a conexão direta. */
  minDelay: number;
}

/** O jeito de sempre: o servidor da sala simula e manda o fluxo `bs`. */
export const roomLink: BolaLink = {
  sendInput: (v) => sendRoomQuiet('bin', v),
  onFrame: (cb) => subscribeRoom('bs', (m) => cb(m as BolaFrame)),
  rtt: () => currentRtt(),
  local: false,
  // 70 ms: o atraso de desenho sobe sozinho quando a rede oscila (medido na simulação de rede)
  minDelay: 70,
};
