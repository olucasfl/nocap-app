import type { EcoMode, EcoSettings, SongId } from '@nocap/games';

/** `batida` é o modo de ritmo (spec 019); os outros repetem sequências. */
export type Mode = EcoMode | 'daily' | 'batida';

/** Como a partida acabou: errou um botão, ficou parado, ou chegou ao teto de passos. */
export type EndReason = 'wrong' | 'timeout' | 'perfect';

/** Uma partida em andamento. A seed e a sessão vêm do servidor. */
export interface Run {
  matchId: string;
  mode: Mode;
  kind: 'solo' | 'daily';
  /** Nome do preset usado no servidor (o Daily é sempre `classic`). */
  preset: EcoMode;
  seed: string;
  /** Sessão assinada pelo servidor: prova de quando a partida começou (vazia = offline). */
  session: string;
  settings: EcoSettings;
}

/** Uma partida do Batida: só a seed e a sessão (o ritmo é o mesmo para quem tem a mesma seed). */
export interface BatidaRunInfo {
  matchId: string;
  seed: string;
  /** Sessão assinada pelo servidor (vazia = offline: joga, mas não salva). */
  session: string;
  /** A música escolhida na abertura (cada uma é um modo do ranking). */
  song: SongId;
}
