import {
  BACK_LIMIT,
  HALF,
  PLAYER_R,
  PUSH_COOLDOWN_MS,
  PUSH_POWER,
  PUSH_RANGE,
  SINAL_COLORS,
  SinalSim,
  clamp,
  darkSpeed,
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
/** Depois que a disputa se decide, a tela fica um instante antes do pódio. */
export const SINAL_FINISH_DELAY_MS = 2500;
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
}

/**
 * O Sinal Vermelho em sala (spec 020): todo mundo corre no MESMO mapa ao mesmo tempo, com o mesmo
 * Vigia, os mesmos poderes e os mesmos obstáculos. Cada pessoa é uma `SinalSim` da mesma seed,
 * avançada em conjunto (passo fixo de 1/60 s), então o Vigia é um só para todos; a escuridão
 * também é uma só (quem fica para trás é pego primeiro). Os bonecos não se sobrepõem, e quem chega perto de
 * outro ganha um botão para empurrá-lo (e quem se mexe sob o olhar do Vigia perde, empurrado ou
 * não). Perdeu, vira plateia. Vence quem chegar mais longe, e a corrida só acaba quando todos caem:
 * quem ainda corre continua jogando.
 */
export class SinalRoomEngine extends ColorRoomEngine {
  override readonly game = 'sinal' as const;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['infinito'];

  private racers = new Map<string, Racer>();
  /** A cor de cada pessoa (fica entre uma partida e a revanche). */
  private colors = new Map<string, string>();
  /** Quem a pessoa que caiu escolheu assistir. */
  private watching = new Map<string, string>();
  private lastStepAt = 0;
  private acc = 0;
  private sinceSend = 0;
  private finishAt: number | null = null;
  /** A frente da escuridão, uma só para a sala toda (m). */
  private dark = 0;

  constructor(opts: EngineOptions) {
    super(opts);
    this.mode = 'infinito';
    this.settings = { rounds: 1 };
  }

  protected override settingsForMode(): AnySettings {
    return { rounds: 1 };
  }

  protected override validSettings(merged: Record<string, unknown>, mode: string): boolean {
    return mode === 'infinito' && merged.rounds === 1;
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

  // ---- a corrida ----

  protected override beginRound() {
    this.roundIndex = 0;
    this.rounds = [{}];
    this.racers.clear();
    this.watching.clear();
    const ids = [...this.members.values()].sort((a, b) => a.joinedAt - b.joinedAt).map((m) => m.id);
    const edge = HALF - 1;
    ids.forEach((id, i) => {
      const sim = new SinalSim(this.seed, 'infinito');
      // Largam lado a lado, espalhados pelo corredor.
      sim.x = clamp((i - (ids.length - 1) / 2) * 1.3, -edge, edge);
      // a escuridão é uma só: quem manda nela é a sala (veja `stepAll`)
      sim.externalDark = true;
      this.dark = sim.darkFront;
      this.racers.set(id, { sim, input: [0, 0], seq: 0, events: [], pushedAt: -Infinity });
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

  /** Quem caiu escolhe quem assistir. */
  watch(id: string, target: string) {
    if (this.racers.has(target)) this.watching.set(id, target);
  }

  /** O vizinho mais próximo ao alcance do empurrão (vivo, outro jogador), ou `null`. */
  private pushTarget(id: string): string | null {
    const me = this.racers.get(id);
    if (!me || me.sim.dead || this.phase !== 'play') return null;
    let best: string | null = null;
    let bestD = PUSH_RANGE * PUSH_RANGE;
    for (const [other, r] of this.racers) {
      if (other === id || r.sim.dead) continue;
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
   * como mexer: empurrar alguém quando o Vigia olha é tirá-lo da corrida). Tem pausa entre usos.
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
      this.phase = 'final';
      this.phaseEndsAt = null;
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
      if (r.sim.dead) continue;
      r.sim.setDarkY(this.dark);
      // Quem perdeu a conexão fica parado (a escuridão resolve).
      const live = this.members.get(id)?.connected;
      const [ax, ay] = live ? r.input : [0, 0];
      for (const e of r.sim.step(ax, ay)) this.log(r, e);
    }
    // A névoa é UMA só, igual para todos. Anda no ritmo de quem está na frente (se ele para, ela acelera
    // para todos), nunca mais rápida que o boneco; quem fica para trás é pego primeiro.
    for (const r of this.racers.values()) {
      if (!r.sim.dead && (!lead || r.sim.y > lead.sim.y)) lead = r;
    }
    if (lead) this.dark += darkSpeed(lead.sim.course, lead.sim.time, lead.sim.idleLevel) / 60;
    this.separate();
  }

  /** Os bonecos vivos não se sobrepõem (escondidos, sim: o esconderijo cabe mais de um). */
  private separate() {
    const list = [...this.racers.values()].filter((r) => !r.sim.dead && !r.sim.isHidden);
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

  /**
   * A corrida só acaba quando TODOS caíram: quem perdeu assiste, e quem ainda corre continua até
   * cair também (a distância dele continua contando para o pódio).
   */
  private decided(): boolean {
    return [...this.racers.values()].every((r) => r.sim.dead);
  }

  // ---- fases que o Sinal Vermelho não usa ----

  protected override maybeAdvanceFromPick() {
    // não há "todo mundo respondeu": a corrida só acaba por `decided`
  }

  override next() {
    throw new RoomError('Agora não dá para fazer isso');
  }

  protected override reset() {
    super.reset();
    this.racers.clear();
    this.watching.clear();
    this.finishAt = null;
  }

  // ---- resultado ----

  /** Quem foi mais longe vence (empate divide); a nota é a distância em décimos de metro. */
  override finalRows(): FinalRow[] {
    const rows = [...this.members.values()]
      .map((m) => ({ m, tenths: this.racers.get(m.id)?.sim.result.tenths ?? 0 }))
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

  /** De quem é o mapa que esta pessoa vê: o dela, ou (se caiu) o de quem ela escolheu ou do líder. */
  private targetFor(viewerId?: string): string | null {
    if (!viewerId) return null;
    const mine = this.racers.get(viewerId);
    if (mine && !mine.sim.dead) return viewerId;
    const pick = this.watching.get(viewerId);
    if (pick && this.racers.get(pick) && !this.racers.get(pick)!.sim.dead) return pick;
    const leader = [...this.racers]
      .filter(([, r]) => !r.sim.dead)
      .sort((a, b) => b[1].sim.y - a[1].sim.y)[0];
    if (leader) return leader[0];
    return mine ? viewerId : ([...this.racers.keys()][0] ?? null);
  }

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    const colors = Object.fromEntries(this.colors);
    if (this.phase === 'lobby' || this.racers.size === 0) return { sinal: { colors } };
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const players = [...this.racers].map(([id, r]) => ({
      id,
      x: round2(r.sim.x),
      y: round2(r.sim.y),
      hidden: r.sim.isHidden,
      stunned: r.sim.isStunned,
      dead: r.sim.dead,
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
        /** O botão de empurrar: quem está ao alcance, e quando volta a poder usar. */
        push: me
          ? { target: near, readyAt: me.pushedAt + PUSH_COOLDOWN_MS, range: PUSH_RANGE }
          : null,
      },
    };
  }
}
