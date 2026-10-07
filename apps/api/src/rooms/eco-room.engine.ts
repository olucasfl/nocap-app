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

/** Quanto tempo a revelação de cada rodada fica na tela (a Corrida é rápida). */
const ECO_REVEAL_MS = 4000;
const PAD_COUNT = 9;

interface Stats {
  /** Rodadas completas. */
  completed: number;
  /** Toques certos na rodada em que caiu (desempate). */
  fallTaps: number;
  /** Tempo total de toques das rodadas completas, medido pelo servidor. */
  ms: number;
}

/**
 * Ecooo, Corrida (spec 012): a cada rodada o servidor toca a mesma sequência para todos e todos
 * repetem. Errou ou ficou 8 s parado: está fora e vira plateia. A partida acaba quando sobra
 * uma pessoa, quando todos caem juntos ou quando alguém chega ao teto do modo. O servidor
 * confere cada toque: o cliente nunca manda "acertei" e a seed nunca sai daqui.
 */
export class EcoRoomEngine extends ColorRoomEngine {
  override readonly game = 'eco' as const;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ECO_MODES;

  /** Quem ainda está na disputa. */
  private alive = new Set<string>();
  /** Quem jogava a rodada atual (inclui quem caiu nela). */
  private participants: string[] = [];
  private stats = new Map<string, Stats>();
  private progress = new Map<string, number>();
  private lastTap = new Map<string, number>();
  private playStart = 0;

  constructor(opts: EngineOptions) {
    super(opts);
    this.mode = 'classic';
    this.settings = this.settingsForMode('classic');
  }

  private get preset(): EcoSettings {
    return ecoPresets[this.mode as EcoMode];
  }

  /** Só o modo é regra do host: as rodadas são as do modo escolhido. */
  protected override settingsForMode(mode: string): AnySettings {
    return { rounds: maxRounds(ecoPresets[mode as EcoMode]) };
  }

  protected override validSettings(merged: Record<string, unknown>, mode: string): boolean {
    const preset = ecoPresets[mode as EcoMode];
    return !!preset && merged.rounds === maxRounds(preset);
  }

  /** Rodada atual (1, 2, 3...). */
  private get round(): number {
    return this.roundIndex + 1;
  }

  // ---- partida ----

  protected override beginRound() {
    this.roundIndex += 1;
    this.rounds[this.roundIndex] = {};
    if (this.roundIndex === 0) {
      this.alive = new Set(this.members.keys());
      this.stats = new Map([...this.members.keys()].map((id) => [id, blank()]));
    }
    this.participants = [...this.alive];
    this.progress = new Map();
    this.lastTap = new Map();
    // Quem já caiu assiste: conta como "resolvido" para a rodada poder terminar.
    this.locked = new Set([...this.members.keys()].filter((id) => !this.alive.has(id)));
    this.phase = 'show';
    this.phaseEndsAt = this.now() + ECO_PAUSE_MS + playbackMs(this.preset, this.round);
  }

  override tick(): boolean {
    const t = this.now();
    if (this.phase === 'show' && this.phaseEndsAt !== null && t >= this.phaseEndsAt) {
      this.phase = 'play';
      this.phaseEndsAt = null;
      this.playStart = t;
      this.maybeAdvanceFromPick();
      return true;
    }
    if (this.phase === 'play') {
      let changed = false;
      for (const id of this.participants) {
        if (this.locked.has(id)) continue;
        const since = this.lastTap.get(id) ?? this.playStart;
        if (t - since > ECO_TAP_TIMEOUT_MS) {
          this.fall(id);
          changed = true;
        }
      }
      if (changed) this.maybeAdvanceFromPick();
      return changed;
    }
    return super.tick();
  }

  /** TOQUE em um botão. O servidor confere contra a sequência da rodada. */
  tap(id: string, pad: number) {
    // Toque adiantado (ainda na reprodução) ou atrasado: ignora em silêncio.
    if (this.phase !== 'play') return;
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    if (!this.participants.includes(id) || this.locked.has(id)) return;
    if (!Number.isInteger(pad) || pad < 0 || pad >= PAD_COUNT) {
      throw new RoomError('Botão inválido');
    }
    const t = this.now();
    const expected = expectedTaps(this.seed, this.preset, this.round);
    const pos = this.progress.get(id) ?? 0;
    this.lastTap.set(id, t);
    if (pad !== expected[pos]) {
      this.progress.set(id, pos);
      this.fall(id);
    } else {
      this.progress.set(id, pos + 1);
      if (pos + 1 === expected.length) {
        const s = this.stats.get(id)!;
        s.completed = this.round;
        s.ms += t - this.playStart;
        this.locked.add(id);
      }
    }
    this.maybeAdvanceFromPick();
  }

  private fall(id: string) {
    const s = this.stats.get(id);
    if (s) s.fallTaps = this.progress.get(id) ?? 0;
    this.alive.delete(id);
    this.locked.add(id);
  }

  protected override toReveal() {
    // Quem estava desconectado e não terminou cai.
    for (const id of this.participants) if (!this.locked.has(id)) this.fall(id);
    const len = lengthAt(this.preset, this.round);
    const round = this.rounds[this.roundIndex]!;
    for (const id of this.participants) {
      const done = this.alive.has(id);
      round[id] = { answer: done ? len : (this.progress.get(id) ?? 0), score: done ? 1 : 0 };
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
    this.participants = this.participants.filter((p) => p !== id);
    this.progress.delete(id);
    this.lastTap.delete(id);
    super.leave(id);
  }

  protected override reset() {
    super.reset();
    this.alive = new Set();
    this.participants = [];
    this.stats = new Map();
  }

  // ---- resultado ----

  override finalRows(): FinalRow[] {
    const preset = this.preset;
    const rows = [...this.members.values()].map((m) => ({
      m,
      s: this.stats.get(m.id) ?? blank(),
    }));
    const key = (r: (typeof rows)[number]) => [r.s.completed, r.s.fallTaps, -r.s.ms];
    rows.sort((a, b) => {
      const [ka, kb] = [key(a), key(b)];
      for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i]! - ka[i]!;
      return a.m.joinedAt - b.m.joinedAt;
    });
    let placement = 0;
    return rows.map((r, i) => {
      const prev = rows[i - 1];
      if (!prev || key(prev).some((v, k) => v !== key(r)[k])) placement = i + 1;
      return {
        userId: r.m.id,
        username: r.m.username,
        // Pontos do pódio: passos ×10, como no solo.
        totalTenths: r.s.completed === 0 ? 0 : lengthAt(preset, r.s.completed) * 10,
        placement,
        answers: [],
      };
    });
  }

  // ---- o que o cliente enxerga ----

  /** A seed nunca sai: o cliente recebe só a sequência da rodada (e só depois que ela começa). */
  protected override publicSeed(): string {
    return '';
  }

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    if (this.phase === 'lobby') return {};
    const s = this.preset;
    const showing = this.phase === 'show' || this.phase === 'play' || this.phase === 'reveal';
    const mine = viewerId ? this.lastTap.get(viewerId) : undefined;
    const running = this.phase === 'play' && viewerId && !this.locked.has(viewerId);
    return {
      eco: {
        round: this.round,
        length: lengthAt(s, this.round),
        pads: padsAt(s, this.round),
        stepMs: stepMsAt(s, this.round),
        reverse: s.reverse,
        sequence: showing ? sequenceFor(this.seed, s, this.round) : null,
        participants: this.participants,
        alive: [...this.alive],
        /** Toques certos de cada um na rodada (só a própria pessoa vê o seu andamento exato). */
        progress: viewerId ? (this.progress.get(viewerId) ?? 0) : 0,
        /** Quando a pessoa perde por ficar parada (para o contador de 8 s). */
        tapDeadline: running ? (mine ?? this.playStart) + ECO_TAP_TIMEOUT_MS : null,
      },
    };
  }
}

const blank = (): Stats => ({ completed: 0, fallTaps: 0, ms: 0 });
