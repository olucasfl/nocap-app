import {
  DSM_LAYERS,
  DSM_MAX_PLAYERS,
  DSM_PUSH_CD,
  DSM_PUSH_MAX,
  ATR_ROOM_COLORS,
  DSM_ROOM_COUNTDOWN_MS,
  DSM_ROOM_MAX_SEC,
  DSM_ROOM_STALL_MS,
  dsmLayerRadii,
  hexRing,
} from '@nocap/games';
import { ColorRoomEngine, RoomError, type EngineOptions, type FinalRow } from './color-room.engine';

/** Antes disto ninguém pode ter caído na lava (a queda inicial dura cerca de 1 s). */
const MIN_DEATH_SEC = 1.5;
/** Dois relatos de posição da mesma pessoa mais juntos que isto são ignorados. */
const MIN_POS_GAP_MS = 25;

interface Racer {
  id: string;
  username: string;
  slot: number;
  alive: boolean;
  /** Hora da morte (s do jogo); 0 enquanto vivo. */
  deadAt: number;
  /** Último relato de posição (relógio da sala, ms). */
  lastPosAt: number;
  /** [x, y, z, vx, vz, heading, flags]; flags = grounded + 2 * camada. */
  pos: number[] | null;
}

/** Posição de uma raposa no fluxo `pos`: [vaga, x, y, z, vx, vz, direção, flags]. */
export type DesmoronaPos = number[];

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * O Desmorona! em sala (spec 044, fase 2). Cada aparelho simula só a SUA raposa e refaz sozinho a mesma arena
 * (mesma seed, mesmo relógio da sala): o chão cai por tempo, não por mensagem. A sala decide o que precisa ser
 * igual para todos: quem pisou primeiro em cada ladrilho (e a hora disso), quem morreu e quando, e o fim.
 * Sem colisão entre raposas (a fase 3 acrescenta). Não grava ranking nem histórico.
 */
export class DesmoronaRoomEngine extends ColorRoomEngine {
  override readonly game = 'desmorona' as const;
  override readonly persistable = false;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['classico'];

  /** A cor de cada pessoa (fica entre uma partida e a revanche). A paleta é a mesma do Atravessa!. */
  private colors = new Map<string, string>();
  private racers = new Map<string, Racer>();
  /** `camada:q:r` → hora (s do jogo) em que o primeiro pisou. */
  private steps = new Map<string, number>();
  private startAt = 0;
  private radii: readonly number[] = [];
  private deathCount = 0;
  private dirty = false;
  private winnerId: string | null = null;
  /** Empurrões a entregar (esvaziado por `drainPushes`). */
  private pushes: { to: string; from: number; kx: number; kz: number }[] = [];
  private pushAt = new Map<string, number>();
  /** Passos novos para transmitir (esvaziado por `drainSteps`). */
  private outbox: number[][] = [];

  constructor(opts: EngineOptions) {
    super({ ...opts, maxPlayers: DSM_MAX_PLAYERS });
    this.mode = 'classico';
    this.settings = { rounds: 1 };
  }

  protected override validSettings(_merged: Record<string, unknown>, mode: string): boolean {
    return mode === 'classico';
  }

  /** Durante a partida o celular é todo do jogo. */
  protected override chatOpen(): boolean {
    return this.phase !== 'show' && this.phase !== 'play';
  }

  // ---- pessoas e cores ----

  override join(id: string, username: string) {
    super.join(id, username);
    if (!this.colors.has(id)) {
      const taken = new Set(this.colors.values());
      this.colors.set(
        id,
        (ATR_ROOM_COLORS.find((c) => !taken.has(c.hex)) ?? ATR_ROOM_COLORS[0]!).hex,
      );
    }
  }

  /** Escolhe a cor da raposa no lobby: nenhuma cor é de duas pessoas. */
  setColor(id: string, hex: string) {
    this.requirePhase('lobby');
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    if (!ATR_ROOM_COLORS.some((c) => c.hex === hex)) throw new RoomError('Cor inválida');
    for (const [other, taken] of this.colors) {
      if (other !== id && taken === hex) throw new RoomError('Essa cor já é de outra pessoa');
    }
    this.colors.set(id, hex);
    this.members.get(id)!.ready = false;
  }

  /** Tira a sua cor (fica sem cor até escolher outra): quem estava pronto deixa de estar. */
  clearColor(id: string) {
    this.requirePhase('lobby');
    const m = this.members.get(id);
    if (!m) throw new RoomError('Você não está na sala');
    this.colors.delete(id);
    m.ready = false;
  }

  /** Só marca pronto quem tem cor. */
  override setReady(id: string, ready: boolean) {
    if (ready && this.members.has(id) && !this.colors.has(id))
      throw new RoomError('Escolha a sua cor');
    super.setReady(id, ready);
  }

  override start(id: string) {
    const without = [...this.members.values()].filter((m) => m.connected && !this.colors.has(m.id));
    if (this.phase === 'lobby' && without.length > 0) {
      throw new RoomError(
        without.length === 1
          ? `${without[0]!.username} ainda não escolheu a cor`
          : 'Todo mundo precisa escolher uma cor',
      );
    }
    super.start(id);
  }

  // ---- partida ----

  protected override publicSeed(): string {
    return this.seed;
  }

  protected override beginRound() {
    this.roundIndex = 0;
    this.rounds[0] = {};
    this.startAt = this.now() + DSM_ROOM_COUNTDOWN_MS;
    this.steps.clear();
    this.outbox = [];
    this.pushes = [];
    this.pushAt.clear();
    this.deathCount = 0;
    this.winnerId = null;
    this.racers.clear();
    const ordered = [...this.members.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    this.radii = dsmLayerRadii(ordered.length);
    ordered.forEach((m, slot) =>
      this.racers.set(m.id, {
        id: m.id,
        username: m.username,
        slot,
        alive: true,
        deadAt: 0,
        lastPosAt: this.startAt,
        pos: null,
      }),
    );
    this.phase = 'show';
    this.phaseEndsAt = this.startAt;
  }

  private get racing(): boolean {
    return this.phase === 'play' || (this.phase === 'show' && this.now() >= this.startAt);
  }

  /** Segundos de jogo agora (negativo na contagem). */
  private clock(): number {
    return (this.now() - this.startAt) / 1000;
  }

  /** O relato de posição da própria raposa (cerca de 15 por segundo). Inválido é ignorado. */
  report(id: string, v: unknown): void {
    if (!this.racing) return;
    const r = this.racers.get(id);
    if (!r || !r.alive || !Array.isArray(v) || v.length !== 7 || !v.every(finite)) return;
    const [x, y, z, vx, vz, heading, flags] = v as number[];
    if (Math.abs(x!) > 80 || Math.abs(z!) > 80 || y! > 40 || y! < -120) return;
    const t = this.now();
    if (t - r.lastPosAt < MIN_POS_GAP_MS && r.pos) return;
    r.lastPosAt = t;
    r.pos = [r2(x!), r2(y!), r2(z!), r2(vx!), r2(vz!), r2(heading!), Math.trunc(flags!)];
  }

  /** "Pisei neste ladrilho": o primeiro a pisar fixa a hora em que ele quebra para todo mundo. */
  step(id: string, v: unknown): void {
    if (!this.racing) return;
    const r = this.racers.get(id);
    const m = v as { l?: unknown; q?: unknown; r?: unknown } | null;
    if (
      !r ||
      !r.alive ||
      !m ||
      !Number.isInteger(m.l) ||
      !Number.isInteger(m.q) ||
      !Number.isInteger(m.r)
    )
      return;
    const l = m.l as number;
    const q = m.q as number;
    const rr = m.r as number;
    if (l < 0 || l >= DSM_LAYERS || hexRing(q, rr) > (this.radii[l] ?? -1)) return;
    const key = `${l}:${q}:${rr}`;
    if (this.steps.has(key)) return;
    const at = Math.max(0, this.clock());
    this.steps.set(key, at);
    this.outbox.push([l, q, rr, Math.round(at * 1000)]);
  }

  /** "Empurrei esta raposa": a sala confere e entrega só a ela, que aplica o impulso em si. */
  push(id: string, v: unknown): void {
    if (!this.racing) return;
    const from = this.racers.get(id);
    const m = v as { to?: unknown; kx?: unknown; kz?: unknown } | null;
    if (!from || !from.alive || !m || typeof m.to !== 'string' || !finite(m.kx) || !finite(m.kz))
      return;
    const to = this.racers.get(m.to);
    if (!to || !to.alive || to.id === id) return;
    const t = this.now();
    const key = `${id}>${to.id}`;
    if (t - (this.pushAt.get(key) ?? 0) < DSM_PUSH_CD * 1000 * 0.8) return;
    this.pushAt.set(key, t);
    const len = Math.hypot(m.kx, m.kz);
    const k = len > DSM_PUSH_MAX ? DSM_PUSH_MAX / len : 1;
    this.pushes.push({ to: to.id, from: from.slot, kx: r2(m.kx * k), kz: r2(m.kz * k) });
  }

  drainPushes() {
    const out = this.pushes;
    this.pushes = [];
    return out;
  }

  /** "Caí na lava": vale depois da queda inicial. */
  die(id: string): void {
    if (!this.racing || this.clock() < MIN_DEATH_SEC) return;
    this.kill(id);
  }

  private kill(id: string) {
    const r = this.racers.get(id);
    if (!r || !r.alive) return;
    r.alive = false;
    r.deadAt = this.clock();
    this.deathCount += 1;
    this.dirty = true;
  }

  /** Alguém saiu no meio da partida: conta como queda. */
  override leave(id: string) {
    this.colors.delete(id);
    if (this.phase === 'show' || this.phase === 'play') this.kill(id);
    super.leave(id);
  }

  override disconnect(id: string) {
    super.disconnect(id);
  }

  protected override maybeAdvanceFromPick() {}

  protected override toReveal() {
    this.finish();
  }

  protected override reset() {
    super.reset();
    this.racers.clear();
    this.steps.clear();
    this.outbox = [];
    this.winnerId = null;
    this.deathCount = 0;
  }

  override tick(): boolean {
    const t = this.now();
    if (this.phase === 'show') {
      if (t < this.startAt) return false;
      this.phase = 'play';
      this.phaseEndsAt = null;
      return true;
    }
    if (this.phase !== 'play') return false;
    for (const r of this.racers.values()) {
      if (!r.alive) continue;
      const member = this.members.get(r.id);
      // sumiu da sala ou ficou sem relatar por muito tempo (aba em segundo plano): caiu
      if ((member && !member.connected) || t - r.lastPosAt > DSM_ROOM_STALL_MS) this.kill(r.id);
    }
    const alive = [...this.racers.values()].filter((r) => r.alive);
    if ((alive.length <= 1 && this.clock() > MIN_DEATH_SEC) || this.clock() > DSM_ROOM_MAX_SEC) {
      this.finish();
      return true;
    }
    const changed = this.dirty;
    this.dirty = false;
    return changed;
  }

  private finish() {
    const alive = [...this.racers.values()].filter((r) => r.alive);
    if (alive.length === 1) this.winnerId = alive[0]!.id;
    else if (alive.length === 0) {
      this.winnerId =
        [...this.racers.values()].sort((a, b) => b.deadAt - a.deadAt || a.slot - b.slot)[0]?.id ??
        null;
    }
    this.phase = 'final';
    this.phaseEndsAt = null;
  }

  // ---- o que cada aparelho enxerga ----

  /** Posições para o fluxo `pos` (só de quem já relatou). */
  positions(): DesmoronaPos[] {
    const out: DesmoronaPos[] = [];
    for (const r of this.racers.values()) if (r.alive && r.pos) out.push([r.slot, ...r.pos]);
    return out;
  }

  /** Passos novos desde a última chamada: [camada, q, r, hora em ms de jogo]. */
  drainSteps(): number[][] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }

  /** Todos os passos já dados (quem volta à sala no meio da partida refaz o chão). */
  allSteps(): number[][] {
    return [...this.steps].map(
      ([k, at]) => [...k.split(':').map(Number), Math.round(at * 1000)] as number[],
    );
  }

  /** Colocação: vencedor, depois quem caiu por último. Os vivos no limite de tempo dividem o 1º lugar. */
  override finalRows(): FinalRow[] {
    const racers = [...this.racers.values()];
    const key = (r: Racer) => (r.alive ? Infinity : r.id === this.winnerId ? Infinity : r.deadAt);
    const sorted = racers.sort((a, b) => key(b) - key(a) || a.slot - b.slot);
    let placement = 0;
    return sorted.map((r, i) => {
      if (i === 0 || key(r) !== key(sorted[i - 1]!)) placement = i + 1;
      return { userId: r.id, username: r.username, totalTenths: 0, placement, answers: [] };
    });
  }

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    const started = this.phase !== 'lobby';
    const slots: Record<string, number> = {};
    const dead: Record<string, number> = {};
    for (const r of this.racers.values()) {
      slots[r.id] = r.slot;
      if (!r.alive) dead[r.id] = Math.round(r.deadAt * 1000);
    }
    return {
      desmorona: {
        me: viewerId ?? null,
        startAt: started ? this.startAt : null,
        slots: started ? slots : {},
        colors: Object.fromEntries(this.colors),
        dead: started ? dead : {},
        winnerId: this.phase === 'final' ? this.winnerId : null,
      },
    };
  }
}

export { RoomError };
