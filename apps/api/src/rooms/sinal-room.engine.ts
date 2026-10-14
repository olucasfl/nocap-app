import {
  BACK_LIMIT,
  HALF,
  PLAYER_R,
  POWER_RANGE,
  POWER_WARN_TICKS,
  PUSH_COOLDOWN_MS,
  PUSH_POWER,
  PUSH_RANGE,
  SINAL_COLORS,
  SinalSim,
  clamp,
  darkSpeed,
  isHinder,
  type ItemKind,
  type SinalEvent,
} from '@nocap/games';
import {
  ColorRoomEngine,
  RoomError,
  type AnySettings,
  type EngineOptions,
  type FinalRow,
} from './color-room.engine';

/** Contagem antes de largar: dá tempo de todo mundo ver o mapa e as cores. */
export const SINAL_COUNTDOWN_MS = 3500;
/** Depois que a fase se decide (todos chegaram ou caíram), a tela fica um instante antes do resumo. */
export const SINAL_FINISH_DELAY_MS = 2500;
/** O resumo da fase, antes da próxima começar sozinha (o líder pode pular). */
export const SINAL_PHASE_BREAK_MS = 8000;
export const SINAL_MAX_PHASES = 5;
const STEP_MS = 1000 / 60;
/** A cada quantos passos (1/60 s) o estado vai aos aparelhos: 15 por segundo. */
const PUBLISH_EVERY = 4;
const MAX_STEPS_PER_TICK = 15;
/** Quantos eventos (sons e avisos) cada corredor guarda para os aparelhos pegarem. */
const EVENT_RING = 24;

type LoggedEvent = SinalEvent & { n: number };

interface Racer {
  sim: SinalSim;
  /** O último analógico (-100 a 100). */
  input: [number, number];
  seq: number;
  events: LoggedEvent[];
  /** Quando empurrou pela última vez (relógio da sala, ms). */
  pushedAt: number;
  /** Quem o empurrou por último e quando (para creditar a queda no placar de mortes). */
  pushedBy: { by: string; at: number } | null;
  /** Ordem de chegada na linha (1 = primeiro); null enquanto não chegou. */
  place: number | null;
  /** Apertou o botão do item: vale no próximo passo. */
  useQueued: boolean;
}

/** Uma linha do placar da corrida: quem caiu (e por quê) ou quem chegou na linha. */
export interface FeedEntry {
  n: number;
  /** Relógio da sala (ms) de quando aconteceu. */
  at: number;
  id: string;
  kind: 'morte' | 'chegada';
  reason: 'vigia' | 'escuridao' | null;
  /** Quem empurrou (só nas quedas que vieram até 2,5 s depois de um empurrão). */
  by: string | null;
  meters: number;
  /** Ordem de chegada (só nas chegadas). */
  place: number | null;
}

/** O resumo de uma fase: cada pessoa, como terminou e o total até aqui (em décimos de metro). */
export interface PhaseSummary {
  n: number;
  total: number;
  rows: { id: string; tenths: number; finished: boolean; place: number; totalTenths: number }[];
}

/** A queda vale como "empurrado por" se o empurrão foi até 2,5 s antes. */
const PUSH_CREDIT_MS = 2500;
const FEED_KEEP = 20;
const FEED_SHOW = 6;
const SMALLINT_MAX = 32767;

/**
 * O Sinal Vermelho em sala (spec 020): uma corrida em FASES (de 1 a 5, o líder escolhe), cada uma
 * com linha de chegada, no MESMO mapa ao mesmo tempo para todos, com o mesmo Vigia, os mesmos
 * poderes e os mesmos obstáculos. Cada pessoa é uma `SinalSim` da mesma seed, avançada em
 * conjunto (passo fixo de 1/60 s). A névoa é uma só para a sala. Quem cruza a linha ou cai vira
 * plateia da fase (e escolhe quem assistir); a fase acaba quando todos chegaram ou caíram, e a
 * seguinte começa sozinha. Quem chega soma a fase inteira; quem cai soma até onde foi. Vence quem
 * somar mais metros no fim. Quem chega perto de outro ganha um botão para empurrá-lo.
 */
export class SinalRoomEngine extends ColorRoomEngine {
  override readonly game = 'sinal' as const;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['classico'];

  private racers = new Map<string, Racer>();
  /** A cor de cada pessoa (fica entre uma partida e a revanche). */
  private colors = new Map<string, string>();
  /** Quem cada espectador escolheu assistir. */
  private watching = new Map<string, string>();
  private lastStepAt = 0;
  private acc = 0;
  private sinceSend = 0;
  private finishAt: number | null = null;
  /** A frente da escuridão, uma só para a sala toda (m). */
  private dark = 0;
  /** O placar da fase: quedas e chegadas. */
  private feed: FeedEntry[] = [];
  private feedSeq = 0;
  private announced = new Set<string>();
  private arrivals = 0;
  /** Metros (em décimos) de cada pessoa somando as fases já terminadas. */
  private phaseTotals = new Map<string, number>();
  private lastSummary: PhaseSummary | null = null;

  constructor(opts: EngineOptions) {
    super(opts);
    this.mode = 'classico';
    this.settings = { rounds: 2 };
  }

  protected override settingsForMode(_mode: string, current: AnySettings): AnySettings {
    return current;
  }

  protected override validSettings(merged: Record<string, unknown>, mode: string): boolean {
    const r = merged.rounds;
    return (
      mode === 'classico' &&
      Number.isInteger(r) &&
      (r as number) >= 1 &&
      (r as number) <= SINAL_MAX_PHASES
    );
  }

  /** O Sinal Vermelho tem o chat só no lobby e no pódio: no meio da corrida ninguém digita. */
  protected override chatOpen(): boolean {
    return this.phase === 'lobby' || this.phase === 'final';
  }

  // ---- pessoas e cores ----

  override join(id: string, username: string) {
    super.join(id, username);
    if (!this.colors.has(id)) {
      const taken = new Set(this.colors.values());
      this.colors.set(id, (SINAL_COLORS.find((c) => !taken.has(c.hex)) ?? SINAL_COLORS[0]!).hex);
    }
  }

  override leave(id: string) {
    this.colors.delete(id);
    this.racers.delete(id);
    this.watching.delete(id);
    this.phaseTotals.delete(id);
    super.leave(id);
  }

  /** Escolhe a cor do boneco no lobby: nenhuma cor é de duas pessoas. */
  setColor(id: string, hex: string) {
    this.requirePhase('lobby');
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    if (!SINAL_COLORS.some((c) => c.hex === hex)) throw new RoomError('Cor inválida');
    for (const [other, taken] of this.colors) {
      if (other !== id && taken === hex) throw new RoomError('Essa cor já é de outra pessoa');
    }
    this.colors.set(id, hex);
    const m = this.members.get(id)!;
    m.ready = false;
  }

  // ---- as fases ----

  /** Começa a próxima fase: todo mundo (inclusive quem caiu antes) volta a largar. */
  protected override beginRound() {
    this.roundIndex += 1;
    this.rounds[this.roundIndex] = {};
    if (this.roundIndex === 0) {
      this.phaseTotals.clear();
      this.lastSummary = null;
    }
    this.racers.clear();
    this.watching.clear();
    this.feed = [];
    this.announced.clear();
    this.arrivals = 0;
    const phase = this.roundIndex + 1;
    const ids = [...this.members.values()].sort((a, b) => a.joinedAt - b.joinedAt).map((m) => m.id);
    const edge = HALF - 1;
    ids.forEach((id, i) => {
      // Na sala entram os itens que atrapalham os outros jogadores (as posições são as mesmas do solo).
      const sim = new SinalSim(this.seed, 'classico', phase, true);
      // Largam lado a lado, espalhados pelo corredor.
      sim.x = clamp((i - (ids.length - 1) / 2) * 1.3, -edge, edge);
      // A linha de chegada para o boneco ali, e a escuridão é uma só: quem manda nelas é a sala.
      sim.holdAtFinish = true;
      sim.externalDark = true;
      this.dark = sim.darkFront;
      this.racers.set(id, {
        sim,
        input: [0, 0],
        seq: 0,
        events: [],
        pushedAt: -Infinity,
        pushedBy: null,
        place: null,
        useQueued: false,
      });
    });
    this.finishAt = null;
    this.acc = 0;
    this.sinceSend = 0;
    this.phase = 'show';
    this.phaseEndsAt = this.now() + SINAL_COUNTDOWN_MS;
  }

  /** O analógico de quem corre (só vale durante a corrida; não manda estado a ninguém). */
  move(id: string, x: number, y: number) {
    const r = this.racers.get(id);
    if (!r || this.phase !== 'play') return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    r.input = [clamp(Math.round(x), -100, 100), clamp(Math.round(y), -100, 100)];
  }

  /** Quem está mais perto (em qualquer direção) dentro do alcance dos poderes, ainda correndo, ou `null`. */
  private powerTarget(id: string): string | null {
    const me = this.racers.get(id);
    if (!me || !this.running(me)) return null;
    let best: string | null = null;
    let bestD = POWER_RANGE * POWER_RANGE;
    for (const [other, r] of this.racers) {
      if (other === id || !this.running(r)) continue;
      const d = (r.sim.x - me.sim.x) ** 2 + (r.sim.y - me.sim.y) ** 2;
      if (d <= bestD) {
        best = other;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * O botão do item. Os que beneficiam valem na hora; os que atrapalham só saem se há alguém ao
   * alcance (senão o item fica com você e o aparelho avisa que não há alvo).
   */
  use(id: string) {
    const me = this.racers.get(id);
    if (!me || this.phase !== 'play' || !this.running(me)) return;
    const item = me.sim.held;
    if (!item) return;
    if (isHinder(item) && !this.powerTarget(id)) {
      this.log(me, { kind: 'sem-alvo' });
      return;
    }
    me.useQueued = true;
  }

  /** Um poder que atrapalha saiu: vai para quem está mais perto, que tem 0,8 s de aviso. */
  private launch(id: string, item: ItemKind) {
    const target = this.powerTarget(id);
    if (!target) return;
    const other = this.racers.get(target)!;
    other.sim.receive(item, POWER_WARN_TICKS);
    other.pushedBy = { by: id, at: this.now() };
    this.log(other, { kind: 'ameaca', item });
  }

  /** Quem caiu ou chegou escolhe quem assistir (entre quem ainda corre). */
  watch(id: string, target: string) {
    const r = this.racers.get(target);
    if (r && this.running(r)) this.watching.set(id, target);
  }

  private running(r: Racer) {
    return !r.sim.dead && !r.sim.finished;
  }

  /** O vizinho mais próximo ao alcance do empurrão (ainda correndo, outro jogador), ou `null`. */
  private pushTarget(id: string): string | null {
    const me = this.racers.get(id);
    if (!me || !this.running(me) || this.phase !== 'play') return null;
    let best: string | null = null;
    let bestD = PUSH_RANGE * PUSH_RANGE;
    for (const [other, r] of this.racers) {
      if (other === id || !this.running(r)) continue;
      const d = (r.sim.x - me.sim.x) ** 2 + (r.sim.y - me.sim.y) ** 2;
      if (d <= bestD) {
        best = other;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * O botão de empurrar: joga o vizinho mais próximo para longe (e, como toda pancada, isso conta
   * como mexer e atordoa: empurrar alguém quando o Vigia olha é tirá-lo da corrida). Tem pausa entre usos.
   */
  push(id: string) {
    const me = this.racers.get(id);
    if (!me || this.phase !== 'play') return;
    if (this.now() - me.pushedAt < PUSH_COOLDOWN_MS) return;
    const target = this.pushTarget(id);
    if (!target) return;
    const other = this.racers.get(target)!;
    let dx = other.sim.x - me.sim.x;
    let dy = other.sim.y - me.sim.y;
    if (dx * dx + dy * dy < 1e-6) {
      dx = 1;
      dy = 0;
    }
    other.sim.shove(dx, dy, PUSH_POWER);
    other.pushedBy = { by: id, at: this.now() };
    me.pushedAt = this.now();
    this.log(me, { kind: 'empurrou' });
    this.log(other, { kind: 'choque', size: 0.85 });
  }

  private log(r: Racer, e: SinalEvent) {
    r.seq += 1;
    r.events.push({ ...e, n: r.seq });
    if (r.events.length > EVENT_RING) r.events.shift();
  }

  override tick(): boolean {
    const t = this.now();
    if (this.phase === 'show') {
      if (this.phaseEndsAt !== null && t >= this.phaseEndsAt) {
        this.phase = 'play';
        this.phaseEndsAt = null;
        this.lastStepAt = t;
        this.acc = 0;
        this.sinceSend = 0;
        return true;
      }
      return false;
    }
    // o resumo da fase passa para a próxima (ou o pódio) pelo relógio da sala
    if (this.phase !== 'play') return super.tick();

    // Passos de 1/60 s, tantos quantos o relógio pede (com um teto para não travar a sala).
    this.acc += Math.min(250, t - this.lastStepAt);
    this.lastStepAt = t;
    let steps = 0;
    while (this.acc >= STEP_MS && steps < MAX_STEPS_PER_TICK) {
      this.acc -= STEP_MS;
      steps++;
      this.stepAll();
      this.sinceSend++;
    }
    if (this.finishAt === null && this.decided()) this.finishAt = t + SINAL_FINISH_DELAY_MS;
    if (this.finishAt !== null && t >= this.finishAt) {
      this.concludePhase();
      return true;
    }
    if (this.sinceSend >= PUBLISH_EVERY) {
      this.sinceSend = 0;
      return true;
    }
    return false;
  }

  private stepAll() {
    let lead: Racer | null = null;
    for (const [id, r] of this.racers) {
      if (!this.running(r)) continue;
      r.sim.setDarkY(this.dark);
      // Quem perdeu a conexão fica parado (a escuridão resolve).
      const live = this.members.get(id)?.connected;
      const [ax, ay] = live ? r.input : [0, 0];
      const use = r.useQueued;
      r.useQueued = false;
      for (const e of r.sim.step(ax, ay, use)) {
        this.log(r, e);
        if (e.kind === 'item') {
          // o item do chão é um só para a sala: quem pegou primeiro leva
          for (const [oid, o] of this.racers) if (oid !== id) o.sim.markTaken(e.id);
        } else if (e.kind === 'usou' && isHinder(e.item)) {
          this.launch(id, e.item);
        }
      }
      if (r.sim.finished && r.place === null) this.announceArrival(id, r);
      else if (r.sim.dead && !this.announced.has(id)) this.announceDeath(id, r);
    }
    // A névoa é UMA só, igual para todos. Anda no ritmo de quem está na frente (se ele para, ela acelera
    // para todos), nunca mais rápida que o boneco; quem fica para trás é pego primeiro.
    for (const r of this.racers.values()) {
      if (this.running(r) && (!lead || r.sim.y > lead.sim.y)) lead = r;
    }
    if (lead) this.dark += darkSpeed(lead.sim.course, lead.sim.time, lead.sim.idleLevel) / 60;
    this.separate();
  }

  /** Quem acabou de cruzar a linha entra no placar com a ordem de chegada. */
  private announceArrival(id: string, r: Racer) {
    this.arrivals += 1;
    r.place = this.arrivals;
    this.announced.add(id);
    this.feedSeq += 1;
    this.feed.push({
      n: this.feedSeq,
      at: this.now(),
      id,
      kind: 'chegada',
      reason: null,
      by: null,
      meters: Math.floor(r.sim.course.length),
      place: r.place,
    });
    if (this.feed.length > FEED_KEEP) this.feed.shift();
  }

  /** Quem acabou de cair entra no placar (com o crédito, se foi empurrado há pouco). */
  private announceDeath(id: string, r: Racer) {
    this.announced.add(id);
    const reason = r.sim.result.ended;
    if (reason !== 'vigia' && reason !== 'escuridao') return;
    const credit = r.pushedBy && this.now() - r.pushedBy.at < PUSH_CREDIT_MS ? r.pushedBy.by : null;
    this.feedSeq += 1;
    this.feed.push({
      n: this.feedSeq,
      at: this.now(),
      id,
      kind: 'morte',
      reason,
      by: credit,
      meters: Math.floor(r.sim.result.meters),
      place: null,
    });
    if (this.feed.length > FEED_KEEP) this.feed.shift();
  }

  /** Os bonecos ainda correndo não se sobrepõem (escondidos, sim: o esconderijo cabe mais de um). */
  private separate() {
    const list = [...this.racers.values()].filter((r) => this.running(r) && !r.sim.isHidden);
    const min = PLAYER_R * 2;
    const edge = HALF - PLAYER_R;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!.sim;
        const b = list[j]!.sim;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-6) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        a.x = clamp(a.x - ux * push, -edge, edge);
        a.y = Math.max(BACK_LIMIT, a.y - uy * push);
        b.x = clamp(b.x + ux * push, -edge, edge);
        b.y = Math.max(BACK_LIMIT, b.y + uy * push);
      }
    }
  }

  /** A fase só acaba quando todos já chegaram ou caíram: quem ainda corre continua jogando. */
  private decided(): boolean {
    return [...this.racers.values()].every((r) => !this.running(r));
  }

  /** Soma a fase nos totais e vai para o resumo (ou, na última fase, para o pódio). */
  private concludePhase() {
    const phaseNo = this.roundIndex + 1;
    const rows = [...this.racers].map(([id, r]) => ({
      id,
      tenths: r.sim.result.tenths,
      finished: r.sim.finished,
      arrival: r.place ?? Infinity,
    }));
    // chegou primeiro vem primeiro (na ordem em que cruzou); depois quem foi mais longe
    rows.sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return a.finished ? a.arrival - b.arrival : b.tenths - a.tenths;
    });
    for (const r of rows) {
      this.phaseTotals.set(r.id, Math.min(SMALLINT_MAX, (this.phaseTotals.get(r.id) ?? 0) + r.tenths));
    }
    this.lastSummary = {
      n: phaseNo,
      total: this.settings.rounds,
      rows: rows.map((r, i) => ({
        id: r.id,
        tenths: r.tenths,
        finished: r.finished,
        place: i + 1,
        totalTenths: this.phaseTotals.get(r.id) ?? 0,
      })),
    };
    this.finishAt = null;
    if (phaseNo >= this.settings.rounds) {
      this.phase = 'final';
      this.phaseEndsAt = null;
    } else {
      this.phase = 'reveal';
      this.phaseEndsAt = this.now() + SINAL_PHASE_BREAK_MS;
    }
  }

  // ---- fases que o Sinal Vermelho não usa ----

  protected override maybeAdvanceFromPick() {
    // não há "todo mundo respondeu": a fase só acaba por `decided`
  }

  /** O resumo da fase terminou (ou o líder pulou): começa a próxima. */
  protected override finishReveal() {
    this.beginRound();
  }

  protected override reset() {
    super.reset();
    this.racers.clear();
    this.watching.clear();
    this.phaseTotals.clear();
    this.lastSummary = null;
    this.finishAt = null;
    this.feed = [];
    this.announced.clear();
  }

  // ---- resultado ----

  /** Vence quem somou mais metros em todas as fases (empate divide a colocação). */
  override finalRows(): FinalRow[] {
    const rows = [...this.members.values()]
      .map((m) => ({ m, tenths: this.phaseTotals.get(m.id) ?? 0 }))
      .sort((a, b) => b.tenths - a.tenths || a.m.joinedAt - b.m.joinedAt);
    let placement = 0;
    let prev: number | null = null;
    return rows.map((r, i) => {
      if (prev === null || r.tenths !== prev) placement = i + 1;
      prev = r.tenths;
      return {
        userId: r.m.id,
        username: r.m.username,
        totalTenths: r.tenths,
        placement,
        answers: [],
      };
    });
  }

  // ---- o que cada cliente enxerga ----

  /** A seed nunca sai: ela entregaria o Vigia e o mapa inteiros. */
  protected override publicSeed(): string {
    return '';
  }

  /** De quem é o mapa que esta pessoa vê: o dela, ou (se caiu ou chegou) o de quem ela escolheu ou do líder. */
  private targetFor(viewerId?: string): string | null {
    if (!viewerId) return null;
    const mine = this.racers.get(viewerId);
    if (mine && this.running(mine)) return viewerId;
    const pick = this.watching.get(viewerId);
    if (pick && this.racers.get(pick) && this.running(this.racers.get(pick)!)) return pick;
    const leader = [...this.racers]
      .filter(([, r]) => this.running(r))
      .sort((a, b) => b[1].sim.y - a[1].sim.y)[0];
    if (leader) return leader[0];
    return mine ? viewerId : ([...this.racers.keys()][0] ?? null);
  }

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    const colors = Object.fromEntries(this.colors);
    if (this.phase === 'lobby') return { sinal: { colors } };
    const summary = this.phase === 'reveal' || this.phase === 'final' ? this.lastSummary : null;
    if (this.racers.size === 0) return { sinal: { colors, summary } };
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const players = [...this.racers].map(([id, r]) => ({
      id,
      x: round2(r.sim.x),
      y: round2(r.sim.y),
      hidden: r.sim.isHidden,
      stunned: r.sim.isStunned,
      dead: r.sim.dead,
      finished: r.sim.finished,
      place: r.place,
      meters: Math.floor(r.sim.result.meters),
    }));
    const target = this.targetFor(viewerId);
    const racer = target ? this.racers.get(target) : undefined;
    const me = viewerId ? this.racers.get(viewerId) : undefined;
    const near = viewerId ? this.pushTarget(viewerId) : null;
    return {
      sinal: {
        colors,
        players,
        target,
        view: racer ? racer.sim.view : null,
        events: racer ? racer.events : [],
        endsAt: this.phaseEndsAt,
        finishing: this.finishAt !== null,
        /** Como estou: caí? cheguei (em que lugar)? e por quê caí (para a animação, só de quem perde). */
        mine: me
          ? {
              dead: me.sim.dead,
              finished: me.sim.finished,
              place: me.place,
              reason: me.sim.result.ended,
            }
          : null,
        /** O placar da fase: as últimas quedas e chegadas, da mais velha para a mais nova. */
        feed: this.feed.slice(-FEED_SHOW),
        summary,
        /** O botão de empurrar: quem está ao alcance, e quando volta a poder usar. */
        push:
          me && this.running(me)
            ? { target: near, readyAt: me.pushedAt + PUSH_COOLDOWN_MS, range: PUSH_RANGE }
            : null,
        /** O alvo do próximo poder que atrapalha (o mais perto, em qualquer direção, até 15 m). */
        power: me && this.running(me) ? { target: this.powerTarget(viewerId!), range: POWER_RANGE } : null,
      },
    };
  }
}
