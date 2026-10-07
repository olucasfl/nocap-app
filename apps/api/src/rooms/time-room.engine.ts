import { generateTimeRound, scoreTime, timePresets, type TimeSettings } from '@nocap/games';
import {
  ColorRoomEngine,
  DEFAULT_TIME_SETTINGS,
  RoomError,
  type AnySettings,
  type TimeRoomSettings,
} from './color-room.engine';

/** Depois de aparecer o alvo, a pessoa tem até 3× o alvo mais isto para começar e parar. */
export const PLAY_EXTRA_MS = 8000;

/**
 * Sala do Tempo. Reaproveita o ciclo de vida da sala da Cor (entrar, host, pronto, expulsar,
 * pódio, revanche) e troca só a rodada: cada pessoa começa e para o próprio relógio, e quem
 * mede é o servidor (o tempo que o aparelho informasse não seria confiável).
 */
export class TimeRoomEngine extends ColorRoomEngine {
  override readonly game = 'time' as const;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['classic', 'strict', 'sequence'];
  /** Quando cada pessoa apertou COMEÇAR na rodada atual. */
  private startedAt = new Map<string, number>();

  constructor(opts: ConstructorParameters<typeof ColorRoomEngine>[0]) {
    super(opts);
    this.settings = { ...DEFAULT_TIME_SETTINGS };
  }

  private get timeSettings(): TimeSettings {
    return this.settings as TimeRoomSettings;
  }

  protected override validSettings(merged: Record<string, unknown>, mode: string): boolean {
    const m = merged as unknown as TimeRoomSettings;
    const preset = timePresets[mode]!;
    return (
      Number.isInteger(m.rounds) &&
      m.rounds >= 1 &&
      m.rounds <= 10 &&
      // Faixa, cadência e "sem estourar" são as do modo escolhido: o host só ajusta as rodadas.
      m.noOvershoot === preset.noOvershoot &&
      m.minMs === preset.minMs &&
      m.maxMs === preset.maxMs &&
      m.mix === preset.mix
    );
  }

  /** Cada modo do Tempo traz o seu preset (rodadas, faixa de alvos, "sem estourar"). */
  protected override settingsForMode(mode: string): AnySettings {
    return { ...timePresets[mode]! };
  }

  protected override beginRound() {
    this.roundIndex += 1;
    this.rounds[this.roundIndex] = {};
    this.locked = new Set();
    this.startedAt = new Map();
    this.phase = 'play';
    const target = generateTimeRound(this.seed, this.timeSettings, this.roundIndex);
    this.phaseEndsAt = this.now() + target * 3 + PLAY_EXTRA_MS;
  }

  protected override reset() {
    super.reset();
    this.startedAt = new Map();
  }

  /** COMEÇAR: dispara o relógio de quem apertou. */
  begin(id: string) {
    this.requirePhase('play');
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    if (this.locked.has(id) || this.startedAt.has(id)) return;
    this.startedAt.set(id, this.now());
  }

  /** PARAR: o servidor mede o tempo desde o COMEÇAR e dá a nota. */
  stop(id: string) {
    this.requirePhase('play');
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    if (this.locked.has(id)) return;
    const startedAt = this.startedAt.get(id);
    if (startedAt === undefined) throw new RoomError('Comece a contagem antes de parar');
    const ms = Math.max(0, this.now() - startedAt);
    const target = generateTimeRound(this.seed, this.timeSettings, this.roundIndex);
    this.rounds[this.roundIndex]![id] = {
      answer: ms,
      score: scoreTime(target, ms, this.timeSettings),
    };
    this.locked.add(id);
    this.maybeAdvanceFromPick();
  }

  override leave(id: string) {
    this.startedAt.delete(id);
    super.leave(id);
  }
}
