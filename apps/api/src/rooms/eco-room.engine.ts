import {
  ECO_PAUSE_MS,
  ECO_TAP_TIMEOUT_MS,
  ECO_MODES,
  ecoPresets,
  expectedTaps,
  lengthAt,
  maxRounds,
  padsAt,
  playbackMs,
  sequenceFor,
  stepMsAt,
  type EcoMode,
  type EcoSettings,
} from '@nocap/games';
import {
  ColorRoomEngine,
  RoomError,
  type AnySettings,
  type EngineOptions,
  type FinalRow,
} from './color-room.engine';

/** O resultado de cada vez fica na tela só o bastante para ler: o jogo segue em fila. */
const ECO_REVEAL_MS = 2500;
/** Aviso "VEZ DE FULANO" na tela de todos, antes de a sequência tocar e a pessoa ser liberada. */
export const ECO_ANNOUNCE_MS = 1800;
const PAD_COUNT = 9;

/**
 * Ecooo em sala, por vez (spec 012): todo mundo joga a MESMA sequência, um de cada vez, em fila.
 * A cada vez a sequência ganha um passo novo; todos veem a reprodução, mas só quem está na vez
 * repete. Acertou: passa para o próximo da fila (que repete tudo e mais um passo). Errou ou ficou
 * 8 s parado: sai e vira plateia. Vence quem sobrar. O servidor confere cada toque e a seed nunca
 * sai daqui. O Siga o Líder é outro motor (`EcoLeaderRoomEngine`).
 */
export class EcoRoomEngine extends ColorRoomEngine {
  override readonly game = 'eco' as const;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ECO_MODES;

  /** Ordem da fila (ordem de entrada na sala, fixa na largada). */
  private queue: string[] = [];
  /** Posição na fila da última pessoa que jogou. */
  private cursor = -1;
  /** Quem joga a vez atual. */
  private current: string | null = null;
  /** Quem ainda está na disputa. */
  private alive = new Set<string>();
  /** Quem caiu, na ordem em que caiu (o último a cair fica melhor colocado). */
  private fallen: string[] = [];
  /** Última rodada que cada pessoa completou. */
  private completed = new Map<string, number>();
  private progress = 0;
  private lastTap = 0;
  private playStart = 0;

  constructor(opts: EngineOptions) {
    super(opts);
    this.mode = 'classic';
    this.settings = this.settingsForMode('classic');
  }

  private get preset(): EcoSettings {
    return ecoPresets[this.mode as EcoMode];
  }

  /** Só o modo é regra do host: o teto de rodadas é o do modo escolhido. */
  protected override settingsForMode(mode: string): AnySettings {
    return { rounds: maxRounds(ecoPresets[mode as EcoMode]) };
  }

  protected override validSettings(merged: Record<string, unknown>, mode: string): boolean {
    const preset = ecoPresets[mode as EcoMode];
    return !!preset && merged.rounds === maxRounds(preset);
  }

  /** Vez atual (1, 2, 3...): é também o tamanho da sequência (menos o começo do modo). */
  private get round(): number {
    return this.roundIndex + 1;
  }

  // ---- partida ----

  protected override beginRound() {
    this.roundIndex += 1;
    this.rounds[this.roundIndex] = {};
    if (this.roundIndex === 0) {
      this.queue = [...this.members.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((m) => m.id);
      this.alive = new Set(this.queue);
      this.fallen = [];
      this.completed = new Map();
      this.cursor = -1;
    }
    // O próximo da fila que ainda está na disputa.
    const n = this.queue.length;
    for (let k = 1; k <= n; k++) {
      const id = this.queue[(this.cursor + k) % n]!;
      if (this.alive.has(id)) {
        this.cursor = (this.cursor + k) % n;
        this.current = id;
        break;
      }
    }
    this.progress = 0;
    // Todo mundo, menos quem está na vez, já "resolveu": a vez termina quando ele terminar.
    this.locked = new Set([...this.members.keys()].filter((id) => id !== this.current));
    this.phase = 'show';
    this.phaseEndsAt =
      this.now() + ECO_ANNOUNCE_MS + ECO_PAUSE_MS + playbackMs(this.preset, this.round);
  }

  override tick(): boolean {
    const t = this.now();
    if (this.phase === 'show' && this.phaseEndsAt !== null && t >= this.phaseEndsAt) {
      this.phase = 'play';
      this.phaseEndsAt = null;
      this.playStart = t;
      this.lastTap = t;
      this.maybeAdvanceFromPick();
      return true;
    }
    if (this.phase === 'play') {
      if (this.current && !this.locked.has(this.current) && t - this.lastTap > ECO_TAP_TIMEOUT_MS) {
        this.fall(this.current);
        this.maybeAdvanceFromPick();
        return true;
      }
      return false;
    }
    return super.tick();
  }

  /** TOQUE de quem está na vez. O servidor confere contra a sequência. */
  tap(id: string, pad: number) {
    // Toque adiantado, atrasado ou de quem não está na vez: ignora em silêncio.
    if (this.phase !== 'play' || id !== this.current || this.locked.has(id)) return;
    if (!Number.isInteger(pad) || pad < 0 || pad >= PAD_COUNT) {
      throw new RoomError('Botão inválido');
    }
    const expected = expectedTaps(this.seed, this.preset, this.round);
    this.lastTap = this.now();
    if (pad !== expected[this.progress]) {
      this.fall(id);
    } else {
      this.progress += 1;
      if (this.progress === expected.length) {
        this.completed.set(id, this.round);
        this.locked.add(id);
      }
    }
    this.maybeAdvanceFromPick();
  }

  private fall(id: string) {
    this.alive.delete(id);
    this.fallen.push(id);
    this.locked.add(id);
  }

  protected override toReveal() {
    // Quem estava na vez e sumiu (desconectou) cai.
    if (this.current && !this.locked.has(this.current)) this.fall(this.current);
    if (this.current) {
      const done = this.alive.has(this.current);
      this.rounds[this.roundIndex]![this.current] = {
        answer: done ? lengthAt(this.preset, this.round) : this.progress,
        score: done ? 1 : 0,
      };
    }
    super.toReveal();
    this.phaseEndsAt = this.now() + ECO_REVEAL_MS;
  }

  protected override finishReveal() {
    const last = this.round >= maxRounds(this.preset);
    if (this.alive.size <= 1 || last) {
      this.phase = 'final';
      this.phaseEndsAt = null;
    } else {
      this.beginRound();
    }
  }

  override leave(id: string) {
    this.alive.delete(id);
    this.queue = this.queue.filter((q) => q !== id);
    super.leave(id);
  }

  protected override reset() {
    super.reset();
    this.queue = [];
    this.alive = new Set();
    this.fallen = [];
    this.current = null;
  }

  // ---- resultado ----

  /** Quem sobrou vence (empate se o teto acabou); depois, quem caiu por último. */
  override finalRows(): FinalRow[] {
    const preset = this.preset;
    const survivors = [...this.members.values()].filter((m) => this.alive.has(m.id));
    const out = [...this.fallen].reverse();
    const byId = (id: string) => this.members.get(id);
    const ordered = [
      ...survivors.sort((a, b) => a.joinedAt - b.joinedAt).map((m) => ({ m, place: 1 })),
      ...out.flatMap((id, i) => {
        const m = byId(id);
        return m ? [{ m, place: survivors.length + i + 1 }] : [];
      }),
    ];
    return ordered.map(({ m, place }) => {
      const done = this.completed.get(m.id) ?? 0;
      return {
        userId: m.id,
        username: m.username,
        // Pontos do pódio: passos da última sequência que completou ×10, como no solo.
        totalTenths: done === 0 ? 0 : lengthAt(preset, done) * 10,
        placement: place,
        answers: [],
      };
    });
  }

  // ---- o que o cliente enxerga ----

  /** A seed nunca sai: o cliente recebe só a sequência da vez (e só depois que ela começa). */
  protected override publicSeed(): string {
    return '';
  }

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    if (this.phase === 'lobby') return {};
    const s = this.preset;
    const showing = this.phase === 'show' || this.phase === 'play' || this.phase === 'reveal';
    const mine = this.phase === 'play' && viewerId === this.current && !this.locked.has(viewerId);
    // A fila a partir de quem joga agora, só com quem ainda está na disputa.
    const start = Math.max(0, this.queue.indexOf(this.current ?? ''));
    const queue = this.queue
      .map((_, i) => this.queue[(start + i) % this.queue.length]!)
      .filter((id) => this.alive.has(id) || id === this.current);
    return {
      eco: {
        round: this.round,
        length: lengthAt(s, this.round),
        pads: padsAt(s, this.round),
        stepMs: stepMsAt(s, this.round),
        reverse: s.reverse,
        sequence: showing ? sequenceFor(this.seed, s, this.round) : null,
        turn: this.current,
        announceMs: ECO_ANNOUNCE_MS,
        queue,
        participants: this.current ? [this.current] : [],
        alive: [...this.alive],
        progress: viewerId === this.current ? this.progress : 0,
        /** Quando a pessoa na vez perde por ficar parada (o contador de 8 s). */
        tapDeadline: mine ? this.lastTap + ECO_TAP_TIMEOUT_MS : null,
      },
    };
  }
}
