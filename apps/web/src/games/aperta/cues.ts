import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';

/** O que da tela interessa ao som: lido a cada atualização e comparado com a anterior. */
export interface CueInput {
  starReady: boolean;
  eventId: string | null;
  missionDone: boolean;
  region: string;
  /** Chave da faixa "Novo no espaço" visível (muda a cada colapso). */
  freshKey: string | null;
}

export type Cue = 'ready' | 'shower' | 'storm' | 'mission' | 'warp' | 'chime';

/**
 * Sons de transição de estado (spec 038, seção 11): só dispara na mudança, nunca ao montar a tela
 * (`prev` nulo), então retomar o save não faz barulho. A região também muda sozinha ao colapsar, e
 * esse caso já tem o som do colapso, por isso `warp` só vale quando a faixa nova não apareceu junto.
 */
export function cuesFor(prev: CueInput | null, next: CueInput): Cue[] {
  if (!prev) return [];
  const out: Cue[] = [];
  if (!prev.starReady && next.starReady) out.push('ready');
  if (next.eventId && next.eventId !== prev.eventId) out.push(next.eventId === 'meteor-shower' ? 'shower' : 'storm');
  if (!prev.missionDone && next.missionDone) out.push('mission');
  const freshNew = next.freshKey !== null && next.freshKey !== prev.freshKey;
  if (next.region !== prev.region && !freshNew) out.push('warp');
  if (freshNew) out.push('chime');
  return out;
}

const VIBRATION: Partial<Record<Cue, number | number[]>> = {
  ready: [10, 30, 10],
  shower: [16, 40, 16],
  storm: [30, 50, 30],
  mission: [12, 40, 12],
};

export function playCue(cue: Cue) {
  apertaSfx[cue]();
  const v = VIBRATION[cue];
  if (v) apertaVibrate(v);
}
