import {
  ATR_DIRS,
  ATR_MAX_INPUTS,
  ATR_MAX_TICKS,
  ATR_ROOM_SIZES,
  ATR_TPS,
  atravessaCheckpoints,
  atravessaStartCol,
  ATR_IDLE_KILL_TICKS,
  type AtravessaRoomMode,
  type AtravessaRoomSize,
  type Dir,
} from './constants';
import { AtravessaSim, type AtravessaInput, type AtravessaRules } from './sim';
import { AtravessaWorld } from './world';

/** Quantas entradas cabem num único relato do aparelho. */
export const ATR_REPORT_MAX_INPUTS = 64;

/**
 * As regras de cada modo da sala (spec 031). O aparelho e o servidor chamam esta função com os mesmos
 * argumentos, então simulam exatamente a mesma partida.
 */
export function atravessaRoomRules(
  mode: AtravessaRoomMode,
  size: AtravessaRoomSize = 'medio',
  slot = 0,
): Partial<AtravessaRules> {
  const startX = atravessaStartCol(slot);
  if (mode === 'checkpoint') {
    const length = ATR_ROOM_SIZES[size];
    return {
      darkness: false,
      idleKillTicks: null,
      finishRow: length,
      checkpoints: atravessaCheckpoints(length),
      startX,
    };
  }
  return { darkness: false, idleKillTicks: ATR_IDLE_KILL_TICKS, finishRow: null, checkpoints: null, startX };
}

/**
 * As linhas que têm de ser zona segura numa sala de Checkpoint: cada checkpoint e as duas linhas ao
 * redor, e a chegada com a linha de trás. Descanso livre: ao morrer, quem volta nunca cai num perigo.
 */
export function atravessaSafeRows(mode: AtravessaRoomMode, size: AtravessaRoomSize): number[] {
  if (mode !== 'checkpoint') return [];
  const rows = new Set<number>();
  for (const cp of atravessaCheckpoints(ATR_ROOM_SIZES[size])) for (const r of [cp - 1, cp, cp + 1]) rows.add(r);
  const finish = ATR_ROOM_SIZES[size];
  rows.add(finish - 1);
  rows.add(finish);
  return [...rows].filter((r) => r >= 1).sort((a, b) => a - b);
}

/** O mundo de uma rodada da sala: servidor e aparelhos chamam isto com os mesmos argumentos. */
export const atravessaRoomWorld = (seed: string, mode: AtravessaRoomMode, size: AtravessaRoomSize) =>
  new AtravessaWorld(seed, { safeRows: atravessaSafeRows(mode, size) });

/** O tick do mundo no instante `now`, para uma largada marcada em `startAt` (ms, relógio do servidor). */
export const atravessaTickAt = (now: number, startAt: number): number =>
  Math.max(0, Math.floor(((now - startAt) * ATR_TPS) / 1000));

/**
 * O espelho de um herói no servidor. O aparelho joga a sua própria partida e, de tempos em tempos,
 * informa "estou no tick T e dei estes passos". O espelho valida o relato e avança a MESMA simulação
 * até o tick T; por isso a morte, a nota e o ranking saem daqui e nunca de uma posição enviada.
 *
 * Preparação para colisão (spec 031): a entrada é "pulo na direção D no tick T". Um servidor que
 * decida a ocupação das casas só precisa consumir estas mesmas entradas antes de aceitá-las.
 */
export class AtravessaMirror {
  readonly sim: AtravessaSim;
  private accepted = 0;
  private lastInputT = 0;
  private pending: AtravessaInput[] = [];

  constructor(seed: string, rules: Partial<AtravessaRules>, world?: AtravessaWorld) {
    this.sim = new AtravessaSim(seed, world, rules);
  }

  /** Quantos passos já foram aceitos (o aparelho usa para saber de onde reenviar). */
  get acceptedCount(): number {
    return this.accepted;
  }

  /** O último tick que a simulação alcançou. */
  get tick(): number {
    return this.sim.tick;
  }

  /**
   * Um relato do aparelho. `maxTick` é o tick que o relógio do servidor permite agora (mais a folga):
   * ninguém anda mais depressa que o tempo real. Devolve `false` (e não muda nada) se o relato for
   * inválido: entradas fora de ordem, no passado, depois do tick informado ou em excesso.
   */
  report(tick: unknown, inputs: unknown, maxTick: number, from?: unknown): boolean {
    if (typeof tick !== 'number' || !Number.isInteger(tick) || tick < this.sim.tick) return false;
    if (tick > Math.min(maxTick, ATR_MAX_TICKS)) return false;
    if (!Array.isArray(inputs) || inputs.length > ATR_REPORT_MAX_INPUTS) return false;
    // `from` é o número do primeiro passo do relato: o aparelho reenvia o que o servidor ainda não
    // confirmou, então um relato perdido nunca deixa a simulação do servidor diferente da do aparelho
    let list: unknown[] = inputs;
    if (from !== undefined) {
      if (typeof from !== 'number' || !Number.isInteger(from) || from < 0 || from > this.accepted) return false;
      list = inputs.slice(this.accepted - from);
    }
    if (this.accepted + list.length > ATR_MAX_INPUTS) return false;
    const parsed: AtravessaInput[] = [];
    let last = this.lastInputT;
    for (const i of list) {
      if (typeof i !== 'object' || i === null) return false;
      const { t, d } = i as Record<string, unknown>;
      if (typeof t !== 'number' || !Number.isInteger(t)) return false;
      // um passo só vale se ainda não foi simulado, na ordem e antes do tick do relato
      if (t < Math.max(last, this.sim.tick + 1) || t > tick) return false;
      if (typeof d !== 'number' || !ATR_DIRS.includes(d as Dir)) return false;
      parsed.push({ t, d: d as Dir });
      last = t;
    }
    this.pending.push(...parsed);
    this.accepted += parsed.length;
    this.lastInputT = last;
    this.advanceTo(tick);
    return true;
  }

  /** Avança com as entradas já recebidas até `tick` (para quando morre de vez ou termina a corrida). */
  advanceTo(tick: number) {
    const sim = this.sim;
    let i = 0;
    while (sim.tick < tick && !sim.halted) {
      while (i < this.pending.length && this.pending[i]!.t <= sim.tick + 1) sim.input(this.pending[i++]!.d);
      sim.step();
    }
    // o que sobrou são entradas de ticks ainda não simulados
    if (i > 0) this.pending.splice(0, i);
  }

  /** Quando o aparelho some: o herói fica parado até o mundo resolver (morre, ou fica como está). */
  settle(tick: number) {
    this.advanceTo(tick);
  }
}
