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
  /** Deslocamento de lado (casas), giro em torno do eixo de frente e do eixo vertical (só nas mortes). */
  dx: number;
  rz: number;
  ry: number;
}

/** Quanto do pulo (0 a 1) dura o agachar de saída. */
export const ANTICIPATION = 0.35;
/** Quanto dura o amassado do pouso, em ticks. */
export const LANDING_TICKS = 9;
const SQUASH = 0.09;
const STRETCH = 0.12;
const LAND = 0.17;

/** Uma lombada suave de 0 a 1 e de volta, entre `a` e `b`. */
const hump = (x: number, a: number, b: number) => (x <= a || x >= b ? 0 : Math.sin(((x - a) / (b - a)) * Math.PI));

const volume = (sy: number) => {
  const w = 1 / Math.sqrt(sy);
  return { sx: w, sy, sz: w };
};

export const REST: Pose = { lift: 0, sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, alpha: 1, dx: 0, rz: 0, ry: 0 };

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

const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * A pose da morte (spec 029); `age` em segundos desde o fim e `killer` é o lado de onde veio quem
 * matou (-1, 0 ou 1). Cada causa tem a sua: atropelado é arremessado e cai de lado, o trem lança
 * longe, a água engole com um balanço, a mordida fecha, a varrida derruba e a escuridão apaga.
 */
export function deathPose(end: AtravessaEnd, age: number, killer: -1 | 0 | 1 = 0): Pose {
  const side = killer === 0 ? 1 : killer;
  switch (end) {
    case 'veiculo':
    case 'atingido': {
      const power = end === 'veiculo' ? 1 : 0.75;
      const e = clamp01(age / 0.55);
      const flight = clamp01(age / 0.7);
      const down = smooth((age - 0.62) / 0.2);
      return {
        ...REST,
        ...volume(1 - 0.45 * down),
        dx: side * (0.15 + 3.2 * power * (1 - (1 - e) * (1 - e))),
        lift: 1.5 * power * Math.sin(Math.PI * flight),
        rz: -side * Math.min(age * 15, 5.0) * power + side * 0.0,
        sx: 1 + 0.5 * down,
      };
    }
    case 'trem': {
      const e = clamp01(age / 0.7);
      const flight = clamp01(age / 0.95);
      return {
        ...REST,
        dx: side * (0.3 + 7 * (1 - (1 - e) * (1 - e))),
        lift: 2.7 * Math.sin(Math.PI * flight),
        rz: -side * age * 22,
        ry: age * 9,
      };
    }
    case 'agua':
    case 'arrastado':
    case 'afundou': {
      const slow = end === 'afundou' ? 0.75 : 0.5;
      const e = clamp01(age / slow);
      return {
        ...REST,
        lift: -0.95 * e + 0.35 * Math.sin(Math.PI * clamp01(age / 0.25)) * (1 - e),
        sy: 1 - 0.4 * e,
        alpha: 1 - e * e,
        rz: Math.sin(age * 18) * 0.28 * (1 - e),
      };
    }
    case 'mordido': {
      const shake = age < 0.2 ? Math.sin(age * 90) * 0.12 : 0;
      const e = smooth((age - 0.18) / 0.35);
      return { ...REST, ...volume(1 - 0.55 * e), sx: 1 - 0.55 * e, sz: 1 - 0.55 * e, lift: 0.3 * Math.sin(Math.PI * clamp01(age / 0.5)), alpha: 1 - e, rz: shake };
    }
    default: {
      // a escuridão: o herói vai ficando sem luz e some devagar
      const e = clamp01(age / 0.45);
      return { ...REST, alpha: 1 - 0.85 * e, sy: 1 - 0.1 * e };
    }
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
