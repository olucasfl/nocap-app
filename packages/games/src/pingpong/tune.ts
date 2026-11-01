import {
  PP_DRAG,
  PP_G,
  PP_MAGNUS,
  PP_PAD_COUPLE,
  PP_PAD_E,
  PP_PAD_MU,
  PP_TILT_BASE,
  PP_TILT_OFF,
  PP_TILT_VX,
  PP_TILT_VY,
  PP_TILT_VZ,
} from './constants';

/**
 * Os números que decidem a "sensação" da bola e da raquete. Ficam num objeto para os testes de calibração poderem
 * variá-los (a busca de parâmetros em `tune.test.ts`); o jogo nunca mexe nisto: vale o que está em `constants.ts`.
 */
export const ppTune = {
  drag: PP_DRAG,
  magnus: PP_MAGNUS,
  g: PP_G,
  padE: PP_PAD_E,
  padMu: PP_PAD_MU,
  couple: PP_PAD_COUPLE,
  tiltBase: PP_TILT_BASE,
  tiltVy: PP_TILT_VY,
  tiltVz: PP_TILT_VZ,
  tiltVx: PP_TILT_VX,
  tiltOff: PP_TILT_OFF,
};

export type PpTune = typeof ppTune;
export const ppTuneDefaults: PpTune = { ...ppTune };
