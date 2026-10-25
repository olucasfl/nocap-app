import { createRng } from '../core/rng';
import {
  DSM_ACCEL,
  DSM_AIR_JUMP,
  DSM_BODY_R,
  DSM_KNOCK_DECAY,
  DSM_PUSH,
  DSM_PUSH_CD,
  DSM_PUSH_GAIN,
  DSM_PUSH_MAX,
  DSM_PUSH_MIN_SPEED,
  DSM_RECOIL,
  DSM_CRACK_SEC,
  DSM_GRACE_SEC,
  DSM_GRAVITY,
  DSM_JUMP,
  DSM_LAVA_DEPTH,
  DSM_LAYERS,
  dsmLayerRadii,
  DSM_MAX_FALL,
  DSM_SPAWN_Y,
  DSM_SPEED,
  DSM_TILE_LIFE,
  DSM_WAVE_ALL_AFTER,
  DSM_WAVE_ARC0,
  DSM_WAVE_ARC_GROW,
  DSM_WAVE_EVERY,
  DSM_WAVE_FIRST,
  DSM_WAVE_LIFE,
  DSM_WAVE_MIN_EVERY,
  DSM_WAVE_SHRINK,
} from './constants';
import { hexKey, hexRing, hexToWorld, hexesOfRadius, layerY, worldToHex } from './hex';

export type DsmTileStatus = 'firme' | 'pisado' | 'caiu';

export interface DsmTile {
  layer: number;
  q: number;
  r: number;
  x: number;
  z: number;
  status: DsmTileStatus;
  /** Hora (s do jogo) em que o ladrilho quebra, quando pisado. */
  breakAt: number;
  /** Veio de uma onda (aparece diferente). */
  wave: boolean;
}

export interface DsmPlayerInfo {
  id: string;
  name: string;
  /** Cor do pelo, 0xRRGGBB. */
  color: number;
  bot?: boolean;
}

export interface DsmInput {
  /** Direção desejada no plano, cada eixo de -1 a 1 (já com a câmera aplicada pelo chamador). */
  mx: number;
  mz: number;
  jump: boolean;
}

export interface DsmPlayer extends DsmPlayerInfo {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Direção em que olha (radianos). */
  heading: number;
  grounded: boolean;
  /** Camada em que está parado (só vale com `grounded`). */
  layer: number;
  /** Camada mais baixa em que já pousou. */
  deepest: number;
  alive: boolean;
  /** Hora da eliminação (s do jogo); só vale se `alive` for falso. */
  deadAt: number;
  /** 1 = primeiro a morrer; 0 enquanto vivo. */
  deathOrder: number;
  /** Impulso de empurrão em andamento (m/s); se apaga sozinho. */
  kx: number;
  kz: number;
  /** Já usou o pulo duplo neste voo. */
  airJumped: boolean;
  /** Online: raposa de outra pessoa. Quem manda é o relato dela, o mundo não simula o corpo. */
  remote?: boolean;
}

export type DsmEvent =
  | { type: 'land'; id: string; layer: number }
  | { type: 'step'; id: string; layer: number; q: number; r: number }
  | { type: 'break'; layer: number; q: number; r: number }
  | { type: 'wave'; layer: number; index: number }
  | { type: 'fall'; id: string; layer: number }
  | { type: 'dead'; id: string }
  | { type: 'airjump'; id: string }
  | { type: 'push'; from: string; to: string; kx: number; kz: number }
  | { type: 'win'; id: string };

const NO_INPUT: DsmInput = { mx: 0, mz: 0, jump: false };

/**
 * O mundo do Desmorona!: ladrilhos, raposas e regras. Determinístico: com a mesma `seed`, os mesmos jogadores e as
 * mesmas entradas, o resultado é igual em todo lugar (o servidor e as telas refazem a mesma conta).
 */
export class DsmWorld {
  readonly seed: string;
  /** Raio de cada camada nesta partida (cresce com o número de jogadores). */
  readonly radii: readonly number[];
  readonly tiles = new Map<string, DsmTile>();
  readonly players: DsmPlayer[] = [];
  /** Hora do jogo, em segundos. */
  t = 0;
  ended = false;
  winnerId: string | null = null;
  /** Ordem em que as raposas morreram (a primeira é a 1ª a morrer). */
  readonly deaths: string[] = [];
  /** Quantas ondas já aconteceram. */
  waves = 0;
  private nextWave = DSM_WAVE_FIRST;
  private waveEvery = DSM_WAVE_EVERY;
  private rng: () => number;
  private events: DsmEvent[] = [];
  /** Online: o fim da partida e as mortes das outras raposas vêm da sala, não desta conta. */
  private external = false;
  /** Quando cada par pode empurrar de novo (hora do jogo). */
  private pushReady = new Map<string, number>();

  constructor(seed: string, infos: readonly DsmPlayerInfo[]) {
    this.seed = seed;
    this.radii = dsmLayerRadii(infos.length);
    this.rng = createRng(`${seed}:desmorona`);
    for (let layer = 0; layer < DSM_LAYERS; layer++) {
      for (const h of hexesOfRadius(this.radii[layer] as number)) {
        const p = hexToWorld(h.q, h.r);
        this.tiles.set(hexKey(layer, h.q, h.r), { layer, q: h.q, r: h.r, x: p.x, z: p.z, status: 'firme', breakAt: 0, wave: false });
      }
    }
    // largada: cada raposa cai de um ponto espalhado em volta do centro (ordem fixa pela seed)
    const spawnRng = createRng(`${seed}:spawn`);
    const n = infos.length;
    const offset = spawnRng() * Math.PI * 2;
    infos.forEach((info, i) => {
      const ang = offset + (i / Math.max(1, n)) * Math.PI * 2;
      const rad = 2.2 + spawnRng() * 5.4;
      this.players.push({
        ...info,
        x: Math.cos(ang) * rad,
        y: DSM_SPAWN_Y + spawnRng() * 2,
        z: Math.sin(ang) * rad,
        vx: 0,
        vy: 0,
        vz: 0,
        heading: ang + Math.PI,
        grounded: false,
        layer: 0,
        deepest: -1,
        alive: true,
        deadAt: 0,
        deathOrder: 0,
        kx: 0,
        kz: 0,
        airJumped: false,
      });
    });
  }

  /** Liga o modo online: `localId` é a única raposa simulada aqui; o fim da partida vem da sala (`finish`). */
  goOnline(localId: string): void {
    this.external = true;
    for (const p of this.players) p.remote = p.id !== localId;
  }

  /** Online: a posição relatada de outra raposa. */
  setRemote(id: string, s: { x: number; y: number; z: number; vx: number; vz: number; heading: number; grounded: boolean; layer: number; airJumped?: boolean }): void {
    const p = this.players.find((q) => q.id === id);
    if (!p || !p.remote || !p.alive) return;
    p.x = s.x;
    p.y = s.y;
    p.z = s.z;
    p.vx = s.vx;
    p.vz = s.vz;
    p.heading = s.heading;
    if (s.grounded && !p.grounded) this.events.push({ type: 'land', id, layer: s.layer });
    if (s.layer > p.deepest && p.deepest >= 0) this.events.push({ type: 'fall', id, layer: s.layer });
    if (s.airJumped && !p.airJumped && !s.grounded) this.events.push({ type: 'airjump', id });
    p.airJumped = !!s.airJumped && !s.grounded;
    p.grounded = s.grounded;
    p.layer = s.layer;
    if (s.layer > p.deepest) p.deepest = s.layer;
  }

  /** Online: a sala confirmou que alguém pisou neste ladrilho em `at` (s do jogo). Vale a hora da sala. */
  applyStep(layer: number, q: number, r: number, at: number): void {
    const tile = this.tile(layer, q, r);
    if (!tile || tile.status === 'caiu') return;
    if (tile.status === 'firme') this.events.push({ type: 'step', id: '', layer, q, r });
    tile.status = 'pisado';
    tile.breakAt = at + (DSM_TILE_LIFE[layer] ?? 1);
  }

  /** Online: a sala disse que esta raposa caiu na lava. */
  markDead(id: string): void {
    const p = this.players.find((q) => q.id === id);
    if (p?.alive) this.kill(p);
  }

  /** Online: a sala decidiu o vencedor. */
  finish(winnerId: string | null): void {
    if (this.ended) return;
    this.ended = true;
    this.winnerId = winnerId;
    if (winnerId) this.events.push({ type: 'win', id: winnerId });
  }

  tile(layer: number, q: number, r: number): DsmTile | undefined {
    return this.tiles.get(hexKey(layer, q, r));
  }

  /** O ladrilho de pé (não caído) sob o ponto, na camada. */
  standingTile(layer: number, x: number, z: number): DsmTile | undefined {
    const h = worldToHex(x, z);
    const t = this.tiles.get(hexKey(layer, h.q, h.r));
    return t && t.status !== 'caiu' ? t : undefined;
  }

  /** O quanto o ladrilho está perto de quebrar (0 = firme, 1 = quebrando agora). */
  crack(t: DsmTile): number {
    if (t.status !== 'pisado') return 0;
    const left = t.breakAt - this.t;
    return left >= DSM_CRACK_SEC ? 0 : Math.min(1, Math.max(0, 1 - left / DSM_CRACK_SEC));
  }

  alivePlayers(): DsmPlayer[] {
    return this.players.filter((p) => p.alive);
  }

  /** Entrega (e esvazia) os eventos desde a última chamada: sons e efeitos da tela. */
  drainEvents(): DsmEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Primeiro ladrilho que ainda existe na camada, ou `null` se acabaram. */
  private tilesLeft(layer: number): DsmTile[] {
    const out: DsmTile[] = [];
    for (const t of this.tiles.values()) if (t.layer === layer && t.status !== 'caiu') out.push(t);
    return out;
  }

  step(dt: number, inputs: Readonly<Record<string, DsmInput>> = {}): void {
    if (this.ended) return;
    this.t += dt;
    const prevY = new Map<string, number>();
    for (const p of this.players) {
      if (!p.alive) continue;
      if (p.remote) continue;
      prevY.set(p.id, p.y);
      this.movePlayer(p, inputs[p.id] ?? NO_INPUT, dt);
    }
    this.collide();
    this.landPlayers(prevY);
    this.updateTiles();
    this.updateWaves();
    this.checkLava();
    this.checkEnd();
  }

  private movePlayer(p: DsmPlayer, input: DsmInput, dt: number): void {
    const len = Math.hypot(input.mx, input.mz);
    const k = len > 1 ? 1 / len : 1;
    const tx = input.mx * k * DSM_SPEED;
    const tz = input.mz * k * DSM_SPEED;
    // aceleração limitada: pega velocidade rápido, mas sem "teleportar"
    const ax = tx - p.vx;
    const az = tz - p.vz;
    const al = Math.hypot(ax, az);
    const maxD = DSM_ACCEL * dt * (p.grounded ? 1 : 0.45);
    if (al <= maxD) {
      p.vx = tx;
      p.vz = tz;
    } else {
      p.vx += (ax / al) * maxD;
      p.vz += (az / al) * maxD;
    }
    if (len > 0.1) p.heading = Math.atan2(input.mx, input.mz);
    if (p.grounded && input.jump) {
      p.vy = DSM_JUMP;
      p.grounded = false;
    } else if (!p.grounded && input.jump && !p.airJumped) {
      // pulo duplo: sempre dá a altura inteira, mesmo no meio de uma queda
      p.airJumped = true;
      // soma uma parte da subida que ainda tem: o pulo duplo logo depois de sair do chão também se nota
      p.vy = DSM_AIR_JUMP + Math.max(0, p.vy) * 0.5;
      this.events.push({ type: 'airjump', id: p.id });
    }
    p.x += (p.vx + p.kx) * dt;
    p.z += (p.vz + p.kz) * dt;
    const decay = Math.exp(-DSM_KNOCK_DECAY * dt);
    p.kx *= decay;
    p.kz *= decay;
    if (Math.abs(p.kx) < 0.01) p.kx = 0;
    if (Math.abs(p.kz) < 0.01) p.kz = 0;
    if (!p.grounded) {
      p.vy = Math.max(-DSM_MAX_FALL, p.vy - DSM_GRAVITY * dt);
      p.y += p.vy * dt;
    } else if (!this.standingTile(p.layer, p.x, p.z)) {
      // o chão acabou debaixo dos pés (andou para fora ou o ladrilho quebrou)
      p.grounded = false;
      p.vy = 0;
    }
  }

  /** Online: me empurraram (a tela de quem empurrou avisou a sala, que avisou esta). */
  applyKnock(id: string, kx: number, kz: number): void {
    const p = this.players.find((q) => q.id === id);
    if (!p || !p.alive || p.remote) return;
    const len = Math.hypot(kx, kz);
    const k = len > DSM_PUSH_MAX ? DSM_PUSH_MAX / len : 1;
    p.kx += kx * k;
    p.kz += kz * k;
  }

  /**
   * Corpos não se atravessam, e quem corre contra o outro o empurra. Só vale entre raposas vivas na mesma altura.
   * Online só se move a raposa desta tela; o empurrão em outra vira o evento `push`, que a sala entrega a ela.
   */
  private collide(): void {
    const ps = this.players;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i] as DsmPlayer;
      if (!a.alive) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j] as DsmPlayer;
        if (!b.alive || (a.remote && b.remote) || Math.abs(a.y - b.y) > 1.1) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = DSM_BODY_R * 2;
        if (d >= min) continue;
        const nx = d > 1e-4 ? dx / d : 1;
        const nz = d > 1e-4 ? dz / d : 0;
        const over = min - d;
        // separação: quem é simulado aqui se afasta (inteiro se o outro é só um reflexo da rede)
        if (!a.remote && !b.remote) {
          a.x -= nx * over * 0.5;
          a.z -= nz * over * 0.5;
          b.x += nx * over * 0.5;
          b.z += nz * over * 0.5;
        } else if (!a.remote) {
          a.x -= nx * over * 0.7;
          a.z -= nz * over * 0.7;
        } else {
          b.x += nx * over * 0.7;
          b.z += nz * over * 0.7;
        }
        this.tryPush(a, b, nx, nz);
        this.tryPush(b, a, -nx, -nz);
      }
    }
  }

  /** `from` empurra `to` (n aponta de um para o outro) se vier rápido o bastante e o par não estiver em espera. */
  private tryPush(from: DsmPlayer, to: DsmPlayer, nx: number, nz: number): void {
    if (from.remote) return; // quem decide é a tela de quem corre
    const closing = (from.vx + from.kx) * nx + (from.vz + from.kz) * nz;
    if (closing < DSM_PUSH_MIN_SPEED) return;
    const key = `${from.id}>${to.id}`;
    if ((this.pushReady.get(key) ?? 0) > this.t) return;
    this.pushReady.set(key, this.t + DSM_PUSH_CD);
    const force = Math.min(DSM_PUSH_MAX, DSM_PUSH + closing * DSM_PUSH_GAIN);
    const kx = nx * force;
    const kz = nz * force;
    if (!to.remote) {
      to.kx += kx;
      to.kz += kz;
    }
    from.kx -= nx * force * DSM_RECOIL;
    from.kz -= nz * force * DSM_RECOIL;
    this.events.push({ type: 'push', from: from.id, to: to.id, kx, kz });
  }

  private landPlayers(prevY: Map<string, number>): void {
    for (const p of this.players) {
      if (!p.alive || p.grounded) continue;
      const before = prevY.get(p.id) ?? p.y;
      if (p.vy > 0) continue;
      for (let layer = 0; layer < DSM_LAYERS; layer++) {
        const sy = layerY(layer);
        if (before >= sy - 1e-6 && p.y <= sy && this.standingTile(layer, p.x, p.z)) {
          p.y = sy;
          p.vy = 0;
          p.grounded = true;
          p.airJumped = false;
          p.layer = layer;
          if (layer > p.deepest) {
            if (p.deepest >= 0) this.events.push({ type: 'fall', id: p.id, layer });
            p.deepest = layer;
          }
          this.events.push({ type: 'land', id: p.id, layer });
          break;
        }
      }
    }
  }

  private updateTiles(): void {
    for (const p of this.players) {
      if (!p.alive || p.remote || !p.grounded || this.t < DSM_GRACE_SEC) continue;
      const tile = this.standingTile(p.layer, p.x, p.z);
      if (tile && tile.status === 'firme') {
        tile.status = 'pisado';
        tile.breakAt = this.t + (DSM_TILE_LIFE[tile.layer] ?? 1);
        this.events.push({ type: 'step', id: p.id, layer: tile.layer, q: tile.q, r: tile.r });
      }
    }
    for (const tile of this.tiles.values()) {
      if (tile.status === 'pisado' && this.t >= tile.breakAt) {
        tile.status = 'caiu';
        this.events.push({ type: 'break', layer: tile.layer, q: tile.q, r: tile.r });
      }
    }
  }

  private updateWaves(): void {
    if (this.t < this.nextWave) return;
    this.waves += 1;
    this.nextWave = this.t + this.waveEvery;
    this.waveEvery = Math.max(DSM_WAVE_MIN_EVERY, this.waveEvery * DSM_WAVE_SHRINK);
    // a onda vai na camada mais alta que ainda tem chão
    let layer = 0;
    while (layer < DSM_LAYERS && this.tilesLeft(layer).length === 0) layer++;
    if (layer >= DSM_LAYERS) return;
    const arc = this.t > DSM_WAVE_ALL_AFTER ? 360 : Math.min(360, DSM_WAVE_ARC0 + (this.waves - 1) * DSM_WAVE_ARC_GROW);
    const start = this.rng() * 360;
    for (const t of this.tilesLeft(layer)) {
      if (t.status === 'caiu') continue;
      const ang = ((Math.atan2(t.z, t.x) * 180) / Math.PI + 360) % 360;
      const d = (ang - start + 360) % 360;
      // o ladrilho do centro entra em qualquer onda de 360°
      if (d <= arc || hexRing(t.q, t.r) === 0) {
        if (t.status === 'firme' || t.breakAt > this.t + DSM_WAVE_LIFE) {
          t.status = 'pisado';
          t.breakAt = this.t + DSM_WAVE_LIFE;
          t.wave = true;
        }
      }
    }
    this.events.push({ type: 'wave', layer, index: this.waves });
  }

  private checkLava(): void {
    const floor = layerY(DSM_LAYERS - 1) - DSM_LAVA_DEPTH;
    for (const p of this.players) {
      if (p.alive && !p.remote && p.y < floor) this.kill(p);
    }
  }

  private kill(p: DsmPlayer): void {
    p.alive = false;
    p.deadAt = this.t;
    this.deaths.push(p.id);
    p.deathOrder = this.deaths.length;
    this.events.push({ type: 'dead', id: p.id });
  }

  private checkEnd(): void {
    if (this.external) return;
    const alive = this.alivePlayers();
    if (alive.length > 1 || this.players.length < 2) return;
    this.ended = true;
    if (alive.length === 1) {
      this.winnerId = (alive[0] as DsmPlayer).id;
    } else {
      // todos caíram juntos: vence quem morreu por último (e, no empate, a camada mais funda)
      const last = [...this.players].sort((a, b) => b.deadAt - a.deadAt || b.deepest - a.deepest)[0] as DsmPlayer;
      this.winnerId = last.id;
    }
    this.events.push({ type: 'win', id: this.winnerId });
  }

  /** A colocação final (1º = vencedor), na ordem. Vale depois do fim. */
  standings(): DsmPlayer[] {
    const dead = [...this.deaths].reverse().map((id) => this.players.find((p) => p.id === id) as DsmPlayer);
    const alive = this.players.filter((p) => p.alive);
    const winner = alive.length > 0 ? alive : [];
    const order = [...winner, ...dead];
    // se o vencedor já morreu junto (todos caíram), ele fica à frente
    if (this.winnerId) {
      const i = order.findIndex((p) => p.id === this.winnerId);
      if (i > 0) order.unshift(...order.splice(i, 1));
    }
    return order;
  }
}
