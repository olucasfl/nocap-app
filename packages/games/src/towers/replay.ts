import { TOWERS_DT } from './constants';
import { TowersCode, TowersGame, type TowersInput, type TowersResult } from './game';

/** Passos no máximo por partida (20 minutos a 60 por segundo): acima disso é lixo ou fraude. */
export const TOWERS_MAX_STEPS = 72_000;
/** Entradas do registro no máximo. */
export const TOWERS_MAX_LOG = 30_000;

export type TowersCheck = { ok: true; result: TowersResult; steps: number } | { ok: false; error: string };

/**
 * O servidor refaz a partida do Block Towers: a seed e o registro de teclas definem tudo (a física
 * roda em passo fixo, sem relógio). Só vale partida que terminou, e o tempo dela não pode passar
 * do que a sessão permite (`elapsedMs`).
 */
export function evaluateTowers(seed: string, log: readonly number[]): TowersCheck {
  if (log.length === 0) return { ok: false, error: 'A partida não tem jogadas' };
  if (log.length > TOWERS_MAX_LOG) return { ok: false, error: 'Jogadas demais' };
  let prev = -1;
  for (const n of log) {
    if (!Number.isInteger(n) || n < 0 || n >= TOWERS_MAX_STEPS * 16) return { ok: false, error: 'Registro inválido' };
    const step = Math.floor(n / 16);
    if (step < prev) return { ok: false, error: 'Registro fora de ordem' };
    prev = step;
    const code = n % 16;
    if (code === 0 || (code > 4 && code < 8)) return { ok: false, error: 'Registro inválido' };
  }
  const game = new TowersGame(seed);
  const input: TowersInput = { left: false, right: false, down: false };
  let i = 0;
  for (let step = 0; step < TOWERS_MAX_STEPS && !game.over; step++) {
    while (i < log.length && Math.floor(log[i]! / 16) === step) {
      const code = log[i]! % 16;
      if (code === TowersCode.Rotate) game.rotate();
      else if (code === TowersCode.Left) game.press(-1);
      else if (code === TowersCode.Right) game.press(1);
      else if (code === TowersCode.Cast) game.castSpell();
      else {
        const bits = code - TowersCode.Keys;
        input.left = (bits & 1) !== 0;
        input.right = (bits & 2) !== 0;
        input.down = (bits & 4) !== 0;
      }
      i++;
    }
    game.step(input, TOWERS_DT);
    game.drainEvents();
  }
  if (!game.over) return { ok: false, error: 'A partida enviada não terminou' };
  if (i < log.length) return { ok: false, error: 'Há jogadas depois do fim da partida' };
  return { ok: true, result: game.result, steps: game.steps };
}
