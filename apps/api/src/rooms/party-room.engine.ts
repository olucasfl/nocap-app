import {
  PARTY_MAX_ROUNDS,
  PARTY_MIN_ROUNDS,
  SHAPES_DURATION_MS,
  X1_BETWEEN_MS,
  X1_CLICK_WINDOW_MS,
  X1_MAX_COMP_MS,
  bigInfo,
  buildPlan,
  colorPoints,
  colorScoreTarget,
  commandText,
  ecoChallenge,
  ecoPoints,
  generateColorRound,
  generateColorStart,
  hashSeed,
  microTiming,
  scoreColor,
  shapeClickPoints,
  shapesRound,
  timeChallenge,
  timePoints,
  typingChallenge,
  typingPoints,
  x1Lead,
  x1Outcome,
  x1Pairs,
  x1Points,
  x1Shot,
  type Hsb,
  type MicroSlot,
  type ShapesRound,
  type Slot,
  type X1Shot,
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
export const SHOW_GRACE_MS = 600;
export const RANKING_MS = 4000;
/** Tutorial do minijogo grande: começa quando todos estão prontos ou após este tempo. */
// Só começa quando todos dão OK; este prazo longo é só para quem sumiu não travar a sala.
export const TUTORIAL_MS = 60_000;
export const BIG_LEAD_MS = 1500;
/** Teto do X1 (15 disparos de até ~6 s): depois disso os duelos abertos viram empate. */
export const X1_CAP_MS = 100_000;

export interface PartySettings {
  rounds: number;
}

type Side = 'a' | 'b';

interface Duel {
  a: string;
  /** `null` = Bot NoCap. */
  b: string | null;
  index: number;
  /** Placar líquido do ponto de vista de `a`. */
  lead: number;
  round: number;
  state: 'wait' | 'go' | 'between' | 'done';
  goAt: number;
  nextAt: number;
  shot: X1Shot;
  /** Chegada do clique de cada lado (relógio do servidor). */
  clicks: Partial<Record<Side, number>>;
  /** O que aconteceu no último disparo, para a tela mostrar o tempo de cada um. */
  last: { aMs: number | null; bMs: number | null; winner: Side | null; early: Side | null } | null;
  result: 'a' | 'b' | 'tie' | null;
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
  /** Pontos de cada um no desafio que acabou de terminar (para o placar). */
  private lastDelta = new Map<string, number>();
  /** Quem já respondeu o desafio atual. */
  private submitted = new Set<string>();
  private points = new Map<string, number>();
  /** A cor que cada um travou na Mesmíssima (aparece no placar como feedback). */
  private colorAnswers = new Map<string, Hsb>();
  private ready = new Set<string>();
  private times = { showAt: 0, pickAt: 0, endsAt: 0 };

  // Estado por desafio
  private timeStarts = new Map<string, number>();
  private ecoTaps = new Map<string, number[]>();
  private typed = new Set<string>();
  private shapes: ShapesRound | null = null;
  private shapeHits = new Map<string, Map<number, number>>();
  private duels: Duel[] = [];
  /** Ida e volta de cada aparelho (informada por ele), para a Arena X1 ser justa. */
  private rtt = new Map<string, number>();

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

  /** O chat fecha durante os desafios e fica aberto no lobby, no tutorial, no placar e no fim. */
  protected override chatOpen(): boolean {
    return this.phase !== 'micro' && this.phase !== 'big';
  }

  private get slot(): Slot | null {
    return this.plan[this.slotIndex] ?? null;
  }

  private get microSlot(): MicroSlot | null {
    const s = this.slot;
    return s?.kind === 'micro' ? s : null;
  }

  /** O aparelho informa o tempo de ida e volta; a Arena X1 desconta isso da reação. */
  setLatency(id: string, rttMs: number) {
    if (Number.isFinite(rttMs) && rttMs >= 0) this.rtt.set(id, Math.min(rttMs, 2000));
  }

  private comp(id: string): number {
    return Math.min(this.rtt.get(id) ?? 0, X1_MAX_COMP_MS);
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
    this.timeStarts = new Map();
    this.ecoTaps = new Map();
    this.typed = new Set();
    this.colorAnswers = new Map();
    if (slot.kind === 'micro') {
      const timing = microTiming(slot);
      const showAt = t + MICRO_LEAD_MS;
      const pickAt = showAt + timing.showMs + SHOW_GRACE_MS;
      this.times = { showAt, pickAt, endsAt: pickAt + timing.pickMs };
      this.phase = 'micro';
      this.phaseEndsAt = this.times.endsAt;
    } else {
      // Minijogo grande: tutorial e "pronto" antes de começar.
      this.phase = 'tutorial';
      this.phaseEndsAt = t + TUTORIAL_MS;
    }
  }

  private startBig() {
    const slot = this.slot;
    if (slot?.kind !== 'big') return;
    const t = this.now();
    const showAt = t + BIG_LEAD_MS;
    this.submitted = new Set();
    this.points = new Map();
    this.shapeHits = new Map();
    this.duels = [];
    this.shapes = null;
    if (slot.game === 'shapes') {
      this.shapes = shapesRound(slot.seed);
      this.times = { showAt, pickAt: showAt, endsAt: showAt + SHAPES_DURATION_MS + 1500 };
    } else {
      const ids = [...this.members.values()].filter((m) => m.connected).map((m) => m.id);
      this.duels = x1Pairs(slot.seed, ids).map((p, i) => {
        const shot = x1Shot(slot.seed, i, 0);
        return {
          a: p.a,
          b: p.b,
          index: i,
          lead: 0,
          round: 0,
          state: 'wait' as const,
          goAt: showAt + shot.delayMs,
          nextAt: 0,
          shot,
          clicks: {},
          last: null,
          result: null,
        };
      });
      this.times = { showAt, pickAt: showAt, endsAt: showAt + X1_CAP_MS };
    }
    this.phase = 'big';
    this.phaseEndsAt = this.times.endsAt;
  }

  /** O desafio acabou: fecha os pontos de quem não terminou, soma e mostra o placar. */
  private closeSlot() {
    const slot = this.slot;
    if (slot?.kind === 'micro') this.finalizeMicro(slot);
    else if (slot?.kind === 'big') this.scoreBig(slot);
    this.lastDelta = new Map();
    for (const id of this.members.keys()) {
      const pts = this.points.get(id) ?? 0;
      this.lastDelta.set(id, pts);
      this.scoreTotals.set(id, (this.scoreTotals.get(id) ?? 0) + pts);
    }
    const last = this.slotIndex === this.plan.length - 1;
    // Depois do último minijogo grande a partida vai direto para a revelação final.
    if (last && slot?.kind === 'big') return this.finish();
    this.phase = 'ranking';
    this.phaseEndsAt = this.now() + RANKING_MS;
  }

  private finish() {
    this.phase = 'final';
    this.phaseEndsAt = null;
  }

  override tick(): boolean {
    const t = this.now();
    if (this.phase === 'big' && this.slot?.kind === 'big' && this.slot.game === 'x1') {
      const changed = this.tickDuels(t);
      const over = this.duels.every((d) => d.state === 'done');
      if (over || (this.phaseEndsAt !== null && t >= this.phaseEndsAt)) {
        this.closeSlot();
        return true;
      }
      return changed;
    }
    if (this.phaseEndsAt === null || t < this.phaseEndsAt) return false;
    switch (this.phase) {
      case 'intro':
      case 'ranking':
        this.slotIndex += 1;
        this.startSlot();
        return true;
      case 'micro':
      case 'big':
        this.closeSlot();
        return true;
      case 'tutorial':
        this.startBig();
        return true;
      default:
        return false;
    }
  }

  // ---- micro-desafios ----

  private requireMicro(id: string, game: MicroSlot['game']): MicroSlot {
    this.requirePhase('micro');
    const slot = this.microSlot;
    if (!slot || slot.game !== game) throw new RoomError('Agora não dá para fazer isso');
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    return slot;
  }

  private answered(id: string, points: number) {
    this.points.set(id, points);
    this.submitted.add(id);
    this.locked.add(id);
    this.closeIfAllDone();
  }

  /** Mesmíssima: a cor travada. Só vale depois que o alvo some. */
  submitColor(id: string, answer: Hsb) {
    const slot = this.requireMicro(id, 'color');
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
    this.colorAnswers.set(id, answer);
    // Trave a cor que NÃO devia: perde 500 (a regra pedia para esperar).
    if (slot.variant === 'wait') return this.answered(id, -500);
    const target = colorScoreTarget(
      slot.variant,
      generateColorRound(slot.seed, { rounds: 1, showMs: 3000 }, 0),
    );
    this.answered(id, colorPoints(slot.variant, scoreColor(target, answer)));
  }

  /** Já Deu?: COMEÇAR dispara o relógio de quem apertou (o servidor mede). */
  timeBegin(id: string) {
    const slot = this.requireMicro(id, 'time');
    if (this.submitted.has(id) || this.timeStarts.has(id)) return;
    if (this.now() < this.times.pickAt - 300) throw new RoomError('Espere o alvo sumir');
    // Quieto: a regra era não apertar nada; apertou, perde 500.
    if (slot.variant === 'quieto') return this.answered(id, -500);
    this.timeStarts.set(id, this.now());
  }

  /** Já Deu?: PARAR. A duração é medida no servidor entre COMEÇAR e PARAR. */
  timeStop(id: string) {
    const slot = this.requireMicro(id, 'time');
    if (this.submitted.has(id)) return;
    const start = this.timeStarts.get(id);
    if (start === undefined) throw new RoomError('Comece a contagem antes de parar');
    this.answered(id, timePoints(slot, Math.max(0, this.now() - start)));
  }

  /** Ecooo: um toque. Sem aviso de certo ou errado; o servidor soma no fim. */
  ecoTap(id: string, pad: number) {
    const slot = this.requireMicro(id, 'eco');
    if (this.submitted.has(id)) return;
    if (this.now() < this.times.pickAt - 300) return;
    if (!Number.isInteger(pad) || pad < 0 || pad > 3) throw new RoomError('Botão inválido');
    const c = ecoChallenge(slot);
    const taps = [...(this.ecoTaps.get(id) ?? []), pad];
    this.ecoTaps.set(id, taps);
    // Tocar o botão proibido zera a rodada na hora; completou a sequência, fecha.
    if (c.forbidden === pad || taps.length >= c.expected.length) {
      this.answered(id, ecoPoints(slot, taps));
    }
  }

  /** Digitação: `submit` envia o texto; `touched` avisa que mexeu no campo (Mão Boba). */
  typing(id: string, text: string, touched: boolean, submit: boolean) {
    const slot = this.requireMicro(id, 'typing');
    if (this.submitted.has(id)) return;
    if (this.now() < this.times.pickAt - 300) return;
    const clean = String(text ?? '').slice(0, 40);
    if (touched) this.typed.add(id);
    if (slot.variant === 'maohoba') {
      if (touched || clean.trim()) this.answered(id, typingPoints(slot, clean, true, 0));
      return;
    }
    if (!submit) return;
    this.answered(id, typingPoints(slot, clean, touched, this.now() - this.times.pickAt));
  }

  /** Quem não terminou no tempo: o que já tinha vale (Ecooo) e o resto é zero (Mão Boba: quieto vale). */
  private finalizeMicro(slot: MicroSlot) {
    for (const id of this.members.keys()) {
      if (this.points.has(id)) continue;
      if (slot.game === 'eco') {
        this.points.set(id, ecoPoints(slot, this.ecoTaps.get(id) ?? []));
      } else if (
        (slot.game === 'color' && slot.variant === 'wait') ||
        (slot.game === 'time' && slot.variant === 'quieto')
      ) {
        // Ficou quieto como a regra pedia.
        this.points.set(id, 1000);
      } else if (slot.game === 'typing' && slot.variant === 'maohoba') {
        this.points.set(id, typingPoints(slot, '', this.typed.has(id), 0));
      } else {
        this.points.set(id, 0);
      }
    }
  }

  private closeIfAllDone() {
    if (this.phase !== 'micro') return;
    const waiting = [...this.members.values()].filter(
      (m) => m.connected && !this.submitted.has(m.id),
    );
    if (waiting.length === 0) this.closeSlot();
  }

  // ---- minijogos grandes ----

  /** Tutorial: "pronto" de cada um. Todos prontos começa na hora. */
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

  /** Caça-Formas: um clique numa peça. Vale pelo horário em que chega ao servidor. */
  shapeClick(id: string, itemId: number) {
    if (this.phase !== 'big' || !this.shapes || !this.members.has(id)) return;
    const pts = shapeClickPoints(this.shapes, Number(itemId), this.now() - this.times.showAt);
    if (pts === null) return;
    const hits = this.shapeHits.get(id) ?? new Map<number, number>();
    if (hits.has(Number(itemId))) return;
    hits.set(Number(itemId), pts);
    this.shapeHits.set(id, hits);
  }

  private duelOf(id: string): Duel | undefined {
    return this.duels.find((d) => d.a === id || d.b === id);
  }

  /** Arena X1: um clique. Antes de o botão aparecer é largada falsa e perde o disparo. */
  xClick(id: string) {
    if (this.phase !== 'big') return;
    const d = this.duelOf(id);
    if (!d || d.state === 'done') return;
    const side: Side = d.a === id ? 'a' : 'b';
    const t = this.now();
    if (d.state === 'wait') {
      if (t < d.goAt) this.finishShot(d, side === 'a' ? 'b' : 'a', side, null, null, t);
      return;
    }
    if (d.state !== 'go' || d.clicks[side] !== undefined) return;
    d.clicks[side] = t;
  }

  private reactionMs(d: Duel, side: Side): number | null {
    const at = d.clicks[side];
    if (at === undefined) return null;
    const id = side === 'a' ? d.a : d.b!;
    return Math.max(0, Math.round(at - d.goAt - this.comp(id)));
  }

  private tickDuels(t: number): boolean {
    let changed = false;
    for (const d of this.duels) {
      if (d.state === 'wait' && t >= d.goAt) {
        d.state = 'go';
        // A reação conta a partir de quando o botão realmente foi mostrado.
        d.goAt = t;
        changed = true;
      } else if (d.state === 'between' && t >= d.nextAt) {
        d.state = 'wait';
        changed = true;
      } else if (d.state === 'go') {
        const aMs = this.reactionMs(d, 'a');
        const bMs = d.b === null ? d.shot.botMs : this.reactionMs(d, 'b');
        let winner: Side | null | undefined;
        if (d.b === null) {
          // Bot: reage em `botMs`. Se a pessoa clicou antes, vence; se o bot passou, perdeu.
          if (aMs !== null) winner = aMs < d.shot.botMs ? 'a' : 'b';
          else if (t >= d.goAt + d.shot.botMs + this.comp(d.a)) winner = 'b';
        } else if (aMs !== null && bMs !== null) {
          winner = aMs <= bMs ? 'a' : 'b';
        } else {
          // Quem clicou primeiro espera um pouco o outro (latências diferentes) e depois vence.
          const first = Math.min(d.clicks.a ?? Infinity, d.clicks.b ?? Infinity);
          if (first !== Infinity && t >= first + 800) winner = d.clicks.a !== undefined ? 'a' : 'b';
        }
        if (winner === undefined && t >= d.goAt + X1_CLICK_WINDOW_MS) winner = null;
        if (winner !== undefined) {
          this.finishShot(d, winner, null, aMs, bMs, t);
          changed = true;
        }
      }
    }
    return changed;
  }

  private finishShot(
    d: Duel,
    winner: Side | null,
    early: Side | null,
    aMs: number | null,
    bMs: number | null,
    t: number,
  ) {
    const slot = this.slot;
    d.last = { aMs, bMs, winner, early };
    d.lead = x1Lead(d.lead, winner === null ? null : winner === 'a');
    d.round += 1;
    d.clicks = {};
    const out = x1Outcome(d.lead, d.round);
    if (out) {
      d.state = 'done';
      d.result = out;
      return;
    }
    d.state = 'between';
    d.nextAt = t + X1_BETWEEN_MS;
    if (slot?.kind === 'big') {
      d.shot = x1Shot(slot.seed, d.index, d.round);
      d.goAt = d.nextAt + d.shot.delayMs;
    }
  }

  private duelResult(d: Duel | undefined, id: string): 'win' | 'tie' | 'loss' {
    if (!d || d.result === null || d.result === 'tie') return 'tie';
    return (d.result === 'a') === (d.a === id) ? 'win' : 'loss';
  }

  private scoreBig(slot: Slot) {
    this.points = new Map();
    if (slot.kind !== 'big') return;
    for (const id of this.members.keys()) {
      if (slot.game === 'shapes') {
        const hits = this.shapeHits.get(id);
        this.points.set(id, hits ? [...hits.values()].reduce((a, b) => a + b, 0) : 0);
      } else {
        this.points.set(id, x1Points(this.duelResult(this.duelOf(id), id)));
      }
    }
  }

  // ---- saída de jogadores ----

  override disconnect(id: string) {
    super.disconnect(id);
    this.forfeit(id);
    this.closeIfAllDone();
  }

  override leave(id: string) {
    this.scoreTotals.delete(id);
    this.ready.delete(id);
    super.leave(id);
    this.forfeit(id);
    this.closeIfAllDone();
  }

  /** Quem sai no meio de um duelo perde por abandono. */
  private forfeit(id: string) {
    if (this.phase !== 'big') return;
    const d = this.duelOf(id);
    if (!d || d.state === 'done') return;
    d.state = 'done';
    d.result = d.a === id ? 'b' : 'a';
  }

  protected override reset() {
    super.reset();
    this.plan = [];
    this.slotIndex = -1;
    this.scoreTotals = new Map();
    this.duels = [];
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

  private x1View(viewerId: string | undefined) {
    const d = viewerId ? this.duelOf(viewerId) : undefined;
    if (!d || !viewerId) return null;
    const me: Side = d.a === viewerId ? 'a' : 'b';
    const other = me === 'a' ? d.b : d.a;
    const name = other ? (this.members.get(other)?.username ?? '?') : 'Bot NoCap';
    const sign = me === 'a' ? 1 : -1;
    const last = d.last
      ? {
          mine: me === 'a' ? d.last.aMs : d.last.bMs,
          theirs: me === 'a' ? d.last.bMs : d.last.aMs,
          won: d.last.winner === null ? null : d.last.winner === me,
          early: d.last.early === null ? null : d.last.early === me ? 'me' : 'them',
        }
      : null;
    return {
      opponent: name,
      lead: d.lead * sign || 0,
      round: d.round,
      state: d.state,
      shot: d.state === 'go' ? { x: d.shot.x, y: d.shot.y } : null,
      goAt: d.state === 'go' ? d.goAt : null,
      last,
      result: d.state === 'done' ? this.duelResult(d, viewerId) : null,
      duels: this.duels.length,
      finished: this.duels.filter((x) => x.state === 'done').length,
    };
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
      return {
        party: {
          ...base,
          kind: slot.kind,
          game: slot.game,
          delta: Object.fromEntries(this.lastDelta),
          // Mesmíssima: a cor alvo e o que cada um colocou, como feedback.
          reveal:
            slot.kind === 'micro' && slot.game === 'color'
              ? {
                  target: colorScoreTarget(
                    slot.variant,
                    generateColorRound(slot.seed, { rounds: 1, showMs: 3000 }, 0),
                  ),
                  answers: Object.fromEntries(this.colorAnswers),
                }
              : null,
        },
      };
    }
    if (slot.kind === 'micro') {
      return {
        party: {
          ...base,
          kind: 'micro',
          game: slot.game,
          variant: slot.variant,
          position: slot.position,
          command: commandText(slot),
          times: this.times,
          challenge: this.challengeOf(slot),
          submitted: [...this.submitted],
          mine: viewerId ? this.submitted.has(viewerId) : false,
          started: viewerId ? this.timeStarts.has(viewerId) : false,
        },
      };
    }
    return {
      party: {
        ...base,
        kind: 'big',
        game: slot.game,
        command: commandText(slot),
        info: bigInfo(slot),
        times: this.times,
        ready: [...this.ready],
        mine: viewerId ? this.ready.has(viewerId) : false,
        autoStartAt: this.phase === 'tutorial' ? this.phaseEndsAt : null,
        shapes:
          this.phase === 'big' && this.shapes
            ? { items: this.shapes.items, simSeed: String(hashSeed(slot.seed)) }
            : null,
        x1: this.phase === 'big' && slot.game === 'x1' ? this.x1View(viewerId) : null,
      },
    };
  }

  /** O que o aparelho precisa para mostrar o desafio (nunca a resposta pronta). */
  private challengeOf(slot: MicroSlot): Record<string, unknown> {
    switch (slot.game) {
      case 'color': {
        const target = generateColorRound(slot.seed, { rounds: 1, showMs: 3000 }, 0);
        return {
          target,
          start: generateColorStart(slot.seed, target, 0),
          showMs: microTiming(slot).showMs,
          blind: slot.variant === 'blind',
        };
      }
      case 'time': {
        const c = timeChallenge(slot);
        return {
          targetMs: c.targetMs,
          showClock: c.showClock,
          hideAfterMs: c.hideAfterMs,
          factor: c.factor,
        };
      }
      case 'eco': {
        const c = ecoChallenge(slot);
        return {
          sequence: c.sequence,
          pads: c.pads,
          stepMs: c.stepMs,
          length: c.expected.length,
        };
      }
      case 'typing':
        return { word: typingChallenge(slot).word };
    }
  }
}
