import {
  ECO_PAUSE_MS,
  ECO_TAP_TIMEOUT_MS,
  LEADER_MAX_ROUNDS,
  LEADER_MIN_ROUNDS,
  LEADER_STEP_MS,
  createRng,
  firstBrokenRule,
  followerScore,
  leaderCreateMs,
  leaderPads,
  leaderRules,
  leaderScore,
  leaderTaps,
  ruleLabel,
  validLeaderSequence,
} from '@nocap/games';
import {
  ColorRoomEngine,
  RoomError,
  type AnySettings,
  type EngineOptions,
} from './color-room.engine';

const REVEAL_MS = 8000;

/**
 * Ecooo, Siga o Líder (spec 012): em cada rodada um jogador (o "criador") monta uma sequência
 * dentro das regras da rodada; o servidor valida, toca para todos ao mesmo tempo e os outros
 * repetem. A sequência só chega aos seguidores na reprodução. O histórico guarda só quem jogou e a colocação.
 */
export class EcoLeaderRoomEngine extends ColorRoomEngine {
  override readonly game = 'eco' as const;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['leader'];

  private order: string[] = [];
  private leaderId: string | null = null;
  private sequence: number[] | null = null;
  private followers: string[] = [];
  private progress = new Map<string, number>();
  private lastTap = new Map<string, number>();
  private playStart = 0;
  private timedOut = false;

  constructor(opts: EngineOptions) {
    super(opts);
    this.mode = 'leader';
    this.settings = { rounds: 6 };
  }

  override get historyMode() {
    return 'leader';
  }

  private get round(): number {
    return this.roundIndex + 1;
  }

  protected override validSettings(merged: Record<string, unknown>): boolean {
    const r = merged.rounds;
    return (
      Number.isInteger(r) &&
      (r as number) >= LEADER_MIN_ROUNDS &&
      (r as number) <= LEADER_MAX_ROUNDS
    );
  }

  protected override settingsForMode(_mode: string, current: AnySettings): AnySettings {
    return current;
  }

  // ---- partida ----

  protected override beginRound() {
    this.roundIndex += 1;
    this.rounds[this.roundIndex] = {};
    if (this.roundIndex === 0) {
      const rng = createRng(`${this.seed}:order`);
      const ids = [...this.members.keys()];
      // Embaralha (Fisher-Yates) pela seed: a ordem dos criadores é sorteada na largada.
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [ids[i], ids[j]] = [ids[j]!, ids[i]!];
      }
      this.order = ids;
    }
    // O próximo criador que ainda está na sala e conectado; quem saiu é pulado.
    const n = this.order.length;
    const pick = (needConnected: boolean) =>
      Array.from({ length: n }, (_, k) => this.order[(this.roundIndex + k) % n]!).find((id) => {
        const m = this.members.get(id);
        return !!m && (!needConnected || m.connected);
      });
    this.leaderId = pick(true) ?? pick(false) ?? null;
    this.followers = [...this.members.keys()].filter((id) => id !== this.leaderId);
    this.sequence = null;
    this.timedOut = false;
    this.progress = new Map();
    this.lastTap = new Map();
    this.locked = new Set(this.leaderId ? [this.leaderId] : []);
    this.phase = 'create';
    this.phaseEndsAt = this.now() + leaderCreateMs(this.round);
  }

  /** O criador envia a sequência; o servidor confere as regras e diz qual falhou. */
  submit(id: string, seq: unknown) {
    this.requirePhase('create');
    if (id !== this.leaderId) throw new RoomError('Quem cria esta rodada é outra pessoa');
    const taps = Array.isArray(seq) ? (seq as number[]) : [];
    const rules = leaderRules(this.seed, this.round);
    const broken = firstBrokenRule(taps, rules, leaderPads(this.round));
    if (broken !== null) throw new RoomError(`Falta cumprir: ${ruleLabel(rules[broken]!)}`);
    this.sequence = taps;
    this.startShow();
  }

  private startShow() {
    this.phase = 'show';
    this.phaseEndsAt = this.now() + ECO_PAUSE_MS + leaderTaps(this.round) * LEADER_STEP_MS;
  }

  override tick(): boolean {
    const t = this.now();
    if (this.phase === 'create' && this.phaseEndsAt !== null && t >= this.phaseEndsAt) {
      // Acabou o tempo: o servidor monta uma sequência válida e o criador fica sem pontos.
      this.sequence = validLeaderSequence(this.seed, this.round);
      this.timedOut = true;
      this.startShow();
      return true;
    }
    if (this.phase === 'show' && this.phaseEndsAt !== null && t >= this.phaseEndsAt) {
      this.phase = 'play';
      this.phaseEndsAt = null;
      this.playStart = t;
      this.maybeAdvanceFromPick();
      return true;
    }
    if (this.phase === 'play') {
      let changed = false;
      for (const id of this.followers) {
        if (this.locked.has(id)) continue;
        if (t - (this.lastTap.get(id) ?? this.playStart) > ECO_TAP_TIMEOUT_MS) {
          this.locked.add(id);
          changed = true;
        }
      }
      if (changed) this.maybeAdvanceFromPick();
      return changed;
    }
    return super.tick();
  }

  tap(id: string, pad: number) {
    if (this.phase !== 'play') return;
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    if (!this.followers.includes(id) || this.locked.has(id) || !this.sequence) return;
    if (!Number.isInteger(pad) || pad < 0 || pad >= leaderPads(this.round)) {
      throw new RoomError('Botão inválido');
    }
    const pos = this.progress.get(id) ?? 0;
    this.lastTap.set(id, this.now());
    if (pad !== this.sequence[pos]) {
      this.locked.add(id);
    } else {
      this.progress.set(id, pos + 1);
      if (pos + 1 === this.sequence.length) this.locked.add(id);
    }
    this.maybeAdvanceFromPick();
  }

  protected override toReveal() {
    const n = leaderTaps(this.round);
    const round = this.rounds[this.roundIndex]!;
    const scores: number[] = [];
    for (const id of this.followers) {
      const correct = this.progress.get(id) ?? 0;
      const score = followerScore(correct, n);
      round[id] = { answer: correct, score };
      if (this.members.get(id)?.connected) scores.push(score);
    }
    if (this.leaderId && this.members.has(this.leaderId)) {
      round[this.leaderId] = {
        answer: n,
        score: this.timedOut ? 0 : leaderScore(scores),
      };
    }
    super.toReveal();
    this.phaseEndsAt = this.now() + REVEAL_MS;
  }

  override leave(id: string) {
    this.progress.delete(id);
    this.lastTap.delete(id);
    this.followers = this.followers.filter((f) => f !== id);
    super.leave(id);
  }

  protected override reset() {
    super.reset();
    this.order = [];
    this.leaderId = null;
    this.sequence = null;
    this.followers = [];
  }

  // ---- o que o cliente enxerga ----

  protected override publicSeed(): string {
    return '';
  }

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    if (this.phase === 'lobby' || this.phase === 'final') return {};
    const showing = this.phase === 'show' || this.phase === 'play' || this.phase === 'reveal';
    const running = this.phase === 'play' && !!viewerId && !this.locked.has(viewerId);
    return {
      eco: {
        round: this.round,
        length: leaderTaps(this.round),
        pads: leaderPads(this.round),
        stepMs: LEADER_STEP_MS,
        reverse: false,
        sequence: showing ? this.sequence : null,
        leader: this.leaderId,
        rules: leaderRules(this.seed, this.round),
        timedOut: this.timedOut,
        participants: this.followers,
        alive: this.followers,
        progress: viewerId ? (this.progress.get(viewerId) ?? 0) : 0,
        tapDeadline: running
          ? (this.lastTap.get(viewerId) ?? this.playStart) + ECO_TAP_TIMEOUT_MS
          : null,
      },
    };
  }
}
