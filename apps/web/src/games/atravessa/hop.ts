import type { AtravessaEnd, AtravessaView, Dir } from '@nocap/games';

/**
 * A pose do herói em cada instante (spec 028, "Movimento do herói"): tudo calculado só a partir do que
 * o núcleo informa, sem estado, para a animação ser sempre a mesma e fácil de testar.
 *
 * Um pulo tem três tempos: agachar (antecipação), esticar no ar e achatar de leve no pouso. Volume
 * preservado (se estica na altura, afina na largura) e tudo volta ao normal, nada fica deformado.
 */

export interface Pose {
  /** Altura do corpo acima do chão, em casas. */
  lift: number;
  /** Escalas do corpo (volume preservado). */
  sx: number;
  sy: number;
  sz: number;
  /** Inclinação para a frente do pulo, em radianos. */
  pitch: number;
  /** Balanço de lado (pedra afundando), em radianos. */
  roll: number;
  /** 0 a 1: quanto do herói ainda aparece (some ao afundar ou ser engolido). */
  alpha: number;
}

/** Quanto do pulo (0 a 1) dura o agachar de saída. */
export const ANTICIPATION = 0.3;
/** Quanto dura o amassado do pouso, em ticks. */
export const LANDING_TICKS = 9;
const SQUASH = 0.11;
const STRETCH = 0.14;
const LAND = 0.17;

/** Uma lombada suave de 0 a 1 e de volta, entre `a` e `b`. */
const hump = (x: number, a: number, b: number) => (x <= a || x >= b ? 0 : Math.sin(((x - a) / (b - a)) * Math.PI));

const volume = (sy: number) => {
  const w = 1 / Math.sqrt(sy);
  return { sx: w, sy, sz: w };
};

export const REST: Pose = { lift: 0, sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, alpha: 1 };

export function heroPose(view: AtravessaView, now = 0): Pose {
  if (!view.alive) return REST;
  if (view.step) {
    const p = view.step.progress;
    // agacha um instante ao sair do chão e estica no resto do arco (as duas curvas se sobrepõem, sem degrau)
    const sy = 1 - SQUASH * hump(p, 0, ANTICIPATION) + STRETCH * hump(p, ANTICIPATION / 2, 1);
    return { ...REST, ...volume(sy), lift: view.hop, pitch: -0.16 * hump(p, ANTICIPATION, 1) };
  }
  const age = view.landed?.age ?? LANDING_TICKS;
  if (age < LANDING_TICKS) {
    const k = age / LANDING_TICKS;
    // amassa e volta: seno com queda, termina exatamente em 1
    const sy = 1 - LAND * Math.sin(k * Math.PI) * (1 - k);
    return { ...REST, ...volume(sy), pitch: 0 };
  }
  if (view.sinking > 0) {
    // a pedra cede: balança cada vez mais antes de cair
    return { ...REST, roll: Math.sin(now * 28) * 0.18 * view.sinking, lift: -0.12 * view.sinking };
  }
  return REST;
}

/** A pose da morte; `age` em segundos desde o fim. Curta e sem exagero. */
export function deathPose(end: AtravessaEnd, age: number): Pose {
  const k = Math.min(1, age / 0.45);
  const ease = 1 - (1 - k) * (1 - k);
  switch (end) {
    case 'veiculo':
    case 'trem':
      // achatado no chão
      return { ...REST, ...volume(1 - 0.82 * ease), sx: 1 + 0.9 * ease, sz: 1 + 0.5 * ease };
    case 'agua':
    case 'afundou':
    case 'arrastado':
      return { ...REST, lift: -0.9 * ease, alpha: 1 - ease, sy: 1 - 0.3 * ease };
    default:
      // a escuridão: o herói vai ficando sem luz e some devagar
      return { ...REST, alpha: 1 - 0.85 * ease, sy: 1 - 0.1 * ease };
  }
}

/** O giro do herói (radianos em torno de Y) para cada direção; frente é -Z. */
export const HEADING: Record<Dir, number> = { 0: 0, 1: Math.PI, 2: Math.PI / 2, 3: -Math.PI / 2 };

/** Chega ao ângulo `to` pelo caminho mais curto, a no máximo `max` radianos. */
export function turnToward(from: number, to: number, max: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + Math.max(-max, Math.min(max, d));
}
