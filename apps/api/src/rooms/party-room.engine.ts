import {
  PARTY_MAX_ROUNDS,
  PARTY_MIN_ROUNDS,
  TAP_MIN_GAP_MS,
  TAP_MS,
  buildPlan,
  colorPoints,
  colorShowMs,
  commandText,
  generateColorRound,
  generateColorStart,
  scoreColor,
  tapPoints,
  type Hsb,
  type Slot,
} from '@nocap/games';
import {
  ColorRoomEngine,
  RoomError,
  type AnySettings,
  type EngineOptions,
  type FinalRow,
} from './color-room.engine';

/** Tempos do palco (ms). A entrada dá tempo para a animação terminar antes de o desafio começar. */
export const INTRO_MS = 3500;
export const MICRO_LEAD_MS = 1200;
export const PICK_MS = 20_000;
export const SHOW_GRACE_MS = 600;
export const RANKING_MS = 4000;
/** Tutorial do minijogo grande: começa quando todos estão prontos ou após este tempo. */
export const TUTORIAL_MS = 20_000;
export const BIG_LEAD_MS = 1500;

export interface PartySettings {
  rounds: number;
}

/**
 * NoCap! (spec 016): cada rodada tem 5 micro-desafios rápidos e 1 minijogo grande. O servidor
 * monta o plano pela seed, marca os tempos no relógio dele, confere cada resposta e soma os
 * pontos (que podem ficar negativos quando a regra do desafio tira pontos). Nada de ranking:
 * só o histórico de sala.
 */
export class PartyRoomEngine extends ColorRoomEngine {
  override readonly game = 'party' as const;
  protected override readonly modes: readonly string[] = ['party'];

  private plan: Slot[] = [];
  private slotIndex = -1;
  private scoreTotals = new Map<string, number>();
  /** Pontos de cada um no desafio que acabou de terminar (para o ranking). */
  private lastDelta = new Map<string, number>();
  /** Quem já respondeu o desafio atual. */
  private submitted = new Set<string>();
  private points = new Map<string, number>();
  private taps = new Map<string, { count: number; last: number }>();
  private ready = new Set<string>();
  private times = { showAt: 0, pickAt: 0, endsAt: 0 };

  constructor(opts: EngineOptions) {
    super(opts);
    this.mode = 'party';
    this.settings = { rounds: 1 };
  }

  override get historyMode() {
    return 'party';
  }

  protected override validSettings(merged: Record<string, unknown>): boolean {
    const r = merged.rounds;
    return (
      Number.isInteger(r) && (r as number) >= PARTY_MIN_ROUNDS && (r as number) <= PARTY_MAX_ROUNDS
    );
  }

  protected override settingsForMode(_mode: string, current: AnySettings): AnySettings {
    return current;
  }

  /** O chat fecha durante os desafios e fica aberto no lobby, no tutorial, no ranking e no fim. */
  protected override chatOpen(): boolean {
    return this.phase !== 'micro' && this.phase !== 'big';
  }

  private get slot(): Slot | null {
    return this.plan[this.slotIndex] ?? null;
  }

  // ---- partida ----

  protected override beginRound() {
    this.plan = buildPlan(this.seed, this.settings.rounds);
    this.slotIndex = -1;
    this.scoreTotals = new Map([...this.members.keys()].map((id) => [id, 0]));
    this.lastDelta = new Map();
    this.phase = 'intro';
    this.phaseEndsAt = this.now() + INTRO_MS;
  }

  private startSlot() {
    const slot = this.slot;
    if (!slot) return this.finish();
    const t = this.now();
    this.submitted = new Set();
    this.points = new Map();
    this.ready = new Set();
    this.locked = new Set();
    if (slot.kind === 'micro') {
      const showAt = t + MICRO_LEAD_MS;
      const pickAt = showAt + colorShowMs(slot.variant) + SHOW_GRACE_MS;
      this.times = { showAt, pickAt, endsAt: pickAt + PICK_MS };
      this.phase = 'micro';
      this.phaseEndsAt = this.times.endsAt;
    } else {
      // Minijogo grande: tutorial e "pronto" antes de começar.
      this.phase = 'tutorial';
      this.phaseEndsAt = t + TUTORIAL_MS;
    }
  }

  private startBig() {
    const t = this.now();
    this.taps = new Map();
    this.submitted = new Set();
    this.times = {
      showAt: t + BIG_LEAD_MS,
      pickAt: t + BIG_LEAD_MS,
      endsAt: t + BIG_LEAD_MS + TAP_MS,
    };
    this.phase = 'big';
    this.phaseEndsAt = this.times.endsAt;
  }

  /** O desafio acabou: soma os pontos e mostra o ranking. */
  private closeSlot() {
    this.lastDelta = new Map();
    for (const id of this.members.keys()) {
      const pts = this.points.get(id) ?? 0;
      this.lastDelta.set(id, pts);
      this.scoreTotals.set(id, (this.scoreTotals.get(id) ?? 0) + pts);
    }
    const last = this.slotIndex === this.plan.length - 1;
    // Depois do último minijogo grande a partida vai direto para a revelação final.
    if (last && this.slot?.kind === 'big') return this.finish();
    this.phase = 'ranking';
    this.phaseEndsAt = this.now() + RANKING_MS;
  }

  private finish() {
    this.phase = 'final';
    this.phaseEndsAt = null;
  }

  override tick(): boolean {
    const t = this.now();
    if (this.phaseEndsAt === null || t < this.phaseEndsAt) return false;
    switch (this.phase) {
      case 'intro':
      case 'ranking':
        this.slotIndex += 1;
        this.startSlot();
        return true;
      case 'micro':
        this.closeSlot();
        return true;
      case 'tutorial':
        this.startBig();
        return true;
      case 'big':
        this.scoreBig();
        this.closeSlot();
        return true;
      default:
        return false;
    }
  }

  // ---- respostas ----

  /** Mesmíssima: a cor travada. Só vale depois que o alvo some. */
  submitColor(id: string, answer: Hsb) {
    this.requirePhase('micro');
    const slot = this.slot;
    if (slot?.kind !== 'micro') return;
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    if (this.submitted.has(id)) return;
    if (this.now() < this.times.pickAt - 300) throw new RoomError('Espere o alvo sumir');
    const valid =
      Number.isInteger(answer?.h) &&
      answer.h >= 0 &&
      answer.h <= 360 &&
      Number.isInteger(answer.s) &&
      answer.s >= 0 &&
      answer.s <= 100 &&
      Number.isInteger(answer.b) &&
      answer.b >= 0 &&
      answer.b <= 100;
    if (!valid) throw new RoomError('Resposta inválida');
    const target = generateColorRound(slot.seed, { rounds: 1, showMs: 3000 }, 0);
    this.points.set(id, colorPoints(slot.variant, scoreColor(target, answer)));
    this.submitted.add(id);
    this.locked.add(id);
    this.closeIfAllDone();
  }

  /** Minijogo grande: cada toque conta, desde que respeite o intervalo humano mínimo. */
  tap(id: string) {
    if (this.phase !== 'big' || !this.members.has(id)) return;
    const t = this.now();
    if (t < this.times.showAt || t > this.times.endsAt) return;
    const cur = this.taps.get(id) ?? { count: 0, last: 0 };
    if (t - cur.last < TAP_MIN_GAP_MS) return;
    this.taps.set(id, { count: cur.count + 1, last: t });
  }

  private scoreBig() {
    this.points = new Map(
      [...this.members.keys()].map((id) => [id, tapPoints(this.taps.get(id)?.count ?? 0)]),
    );
  }

  private closeIfAllDone() {
    const waiting = [...this.members.values()].filter(
      (m) => m.connected && !this.submitted.has(m.id),
    );
    if (waiting.length === 0) this.closeSlot();
  }

  /** Tutorial do grande: "pronto" de cada um. Todos prontos começa na hora. */
  tutorialReady(id: string) {
    this.requirePhase('tutorial');
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    this.ready.add(id);
    const waiting = [...this.members.values()].filter((m) => m.connected && !this.ready.has(m.id));
    if (waiting.length === 0) this.startBig();
  }

  /** O líder começa o grande antes do tempo. */
  begin(id: string) {
    this.requireHost(id);
    this.requirePhase('tutorial');
    this.startBig();
  }

  override disconnect(id: string) {
    super.disconnect(id);
    if (this.phase === 'micro') this.closeIfAllDone();
  }

  override leave(id: string) {
    this.scoreTotals.delete(id);
    this.ready.delete(id);
    super.leave(id);
    if (this.phase === 'micro') this.closeIfAllDone();
  }

  protected override reset() {
    super.reset();
    this.plan = [];
    this.slotIndex = -1;
    this.scoreTotals = new Map();
  }

  // ---- resultado ----

  override finalRows(): FinalRow[] {
    const rows = [...this.members.values()]
      .map((m) => ({ m, total: this.scoreTotals.get(m.id) ?? 0 }))
      .sort((a, b) => b.total - a.total || a.m.joinedAt - b.m.joinedAt);
    let placement = 0;
    let prev: number | null = null;
    return rows.map((r, i) => {
      if (prev === null || r.total !== prev) placement = i + 1;
      prev = r.total;
      return {
        userId: r.m.id,
        username: r.m.username,
        // O banco guarda smallint: pontos em dezenas (o pódio mostra x10).
        totalTenths: Math.max(-32768, Math.min(32767, Math.round(r.total / 10))),
        placement,
        answers: [],
      };
    });
  }

  // ---- o que o cliente enxerga ----

  protected override publicSeed(): string {
    return '';
  }

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    const totals = Object.fromEntries(this.scoreTotals);
    if (this.phase === 'lobby') return {};
    const slot = this.slot;
    const rounds = this.settings.rounds;
    const base = {
      totals,
      round: slot?.round ?? 1,
      rounds,
      index: this.slotIndex,
      count: this.plan.length,
    };
    if (this.phase === 'intro' || !slot) return { party: base };
    if (this.phase === 'ranking') {
      return { party: { ...base, kind: slot.kind, delta: Object.fromEntries(this.lastDelta) } };
    }
    if (slot.kind === 'micro') {
      const target = generateColorRound(slot.seed, { rounds: 1, showMs: 3000 }, 0);
      return {
        party: {
          ...base,
          kind: 'micro',
          game: slot.game,
          variant: slot.variant,
          position: slot.position,
          command: commandText(slot),
          times: this.times,
          challenge: {
            target,
            start: generateColorStart(slot.seed, target, 0),
            showMs: colorShowMs(slot.variant),
            blind: slot.variant === 'blind',
          },
          submitted: [...this.submitted],
          mine: viewerId ? this.submitted.has(viewerId) : false,
        },
      };
    }
    return {
      party: {
        ...base,
        kind: 'big',
        game: slot.game,
        command: commandText(slot),
        times: this.times,
        ready: [...this.ready],
        mine: viewerId ? this.ready.has(viewerId) : false,
        autoStartAt: this.phase === 'tutorial' ? this.phaseEndsAt : null,
      },
    };
  }
}
