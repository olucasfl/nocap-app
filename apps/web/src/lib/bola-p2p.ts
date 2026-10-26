import { BOL_TEAM_COLORS, BolaMatch, type BolInfo } from '@nocap/games';
import type { BolaFrame, BolaLink, BolaRosterRow } from './bola-link';
import { sendRoomQuiet, subscribeRoom, type BolaRoomState } from './rooms';

/**
 * Partida ponto a ponto do Fut Fox (spec 048): o aparelho do líder simula a partida e os outros aparelhos conectam a ele
 * por WebRTC. O servidor da sala só repassa a sinalização (`rtc`). Dois canais por aparelho:
 *  - `game`: sem ordem e sem retransmissão (como UDP): quadros do líder para os outros e entrada dos outros para o líder.
 *    O estado novo sempre vale mais que o perdido, então perder um quadro não atrasa o seguinte.
 *  - `ctl`: com garantia: ping, lista de corpos e despedida.
 */

type Setup = NonNullable<BolaRoomState['setup']>;

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};

interface SignalIn {
  from: string;
  data: { sdp?: RTCSessionDescriptionInit; cand?: RTCIceCandidateInit };
}

const signal = (to: string, data: object) => sendRoomQuiet('rtc', { to, data });

/** Eventos ficam neste tempo (ms) em todo quadro enviado: um quadro perdido não perde o gol nem o som. */
const EVENT_KEEP_MS = 600;
/** Aparelhos que não estão no líder recebem este tanto de quadros por segundo. */
const PEER_FPS = 30;

/** Um relógio que não é desacelerado quando a aba está em segundo plano (o líder precisa continuar simulando). */
function makeTicker(fn: () => void, ms: number): () => void {
  try {
    const url = URL.createObjectURL(
      new Blob([`setInterval(()=>postMessage(0),${ms})`], { type: 'text/javascript' }),
    );
    const w = new Worker(url);
    w.onmessage = fn;
    return () => {
      w.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const id = window.setInterval(fn, ms);
    return () => window.clearInterval(id);
  }
}

interface HostPeer {
  id: string;
  pc: RTCPeerConnection;
  game: RTCDataChannel | null;
  ctl: RTCDataChannel | null;
  cands: RTCIceCandidateInit[];
  remoteSet: boolean;
}

export interface HostResult {
  scores: number[];
  winner: number;
}

/** O lado do líder: aceita as conexões, simula a partida e manda o fluxo. */
export class BolaHostSession {
  private peers = new Map<string, HostPeer>();
  private match: BolaMatch | null = null;
  private stopTicker: (() => void) | null = null;
  private unsub: () => void;
  private frameCbs = new Set<(f: BolaFrame) => void>();
  private rosterCbs = new Set<(rows: BolaRosterRow[]) => void>();
  private evBuf: { at: number; e: Record<string, unknown> }[] = [];
  private pendingSt: unknown = null;
  private tickN = 0;
  private finished = false;
  readonly link: BolaLink;

  constructor(
    private readonly meId: string,
    private readonly setup: Setup,
    private readonly onOver: (r: HostResult) => void,
  ) {
    this.unsub = subscribeRoom('rtc', (m) => void this.onSignal(m as SignalIn));
    this.link = {
      local: true,
      rtt: () => 0,
      sendInput: (v) => this.match?.input(this.meId, v),
      onFrame: (cb) => {
        this.frameCbs.add(cb);
        return () => void this.frameCbs.delete(cb);
      },
      onRoster: (cb) => {
        this.rosterCbs.add(cb);
        return () => void this.rosterCbs.delete(cb);
      },
    };
  }

  private async onSignal({ from, data }: SignalIn) {
    if (!from || !data) return;
    let peer = this.peers.get(from);
    if (data.sdp && data.sdp.type === 'offer') {
      peer?.pc.close();
      peer = this.newPeer(from);
      await peer.pc.setRemoteDescription(data.sdp);
      peer.remoteSet = true;
      for (const c of peer.cands.splice(0)) await peer.pc.addIceCandidate(c).catch(() => undefined);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      signal(from, { sdp: peer.pc.localDescription?.toJSON() });
    } else if (data.cand && peer) {
      if (peer.remoteSet) await peer.pc.addIceCandidate(data.cand).catch(() => undefined);
      else peer.cands.push(data.cand);
    }
  }

  private newPeer(id: string): HostPeer {
    const pc = new RTCPeerConnection(ICE);
    const peer: HostPeer = { id, pc, game: null, ctl: null, cands: [], remoteSet: false };
    this.peers.set(id, peer);
    pc.onicecandidate = (e) => {
      if (e.candidate) signal(id, { cand: e.candidate.toJSON() });
    };
    pc.ondatachannel = (e) => {
      const ch = e.channel;
      if (ch.label === 'game') {
        peer.game = ch;
        ch.onmessage = (ev) => this.onInput(id, ev.data);
      } else {
        peer.ctl = ch;
        ch.onmessage = (ev) => this.onCtl(peer, ev.data);
        ch.onclose = () => this.peerGone(id);
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.peerGone(id);
    };
    return peer;
  }

  private onInput(id: string, data: unknown) {
    if (typeof data !== 'string' || !this.match) return;
    try {
      this.match.input(id, JSON.parse(data));
    } catch {
      /* entrada ilegível: ignora */
    }
  }

  private onCtl(peer: HostPeer, data: unknown) {
    if (typeof data !== 'string') return;
    try {
      const m = JSON.parse(data) as { t?: string; ts?: number };
      if (m.t === 'ping' && peer.ctl?.readyState === 'open') {
        peer.ctl.send(JSON.stringify({ t: 'pong', ts: m.ts }));
      }
    } catch {
      /* ignora */
    }
  }

  /** Quem saiu (ou perdeu a conexão) vira bot no lugar e todos recebem a lista nova. */
  private peerGone(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    peer.pc.close();
    if (this.match && !this.finished) {
      this.match.toBot(id);
      this.broadcastRoster();
    }
  }

  private broadcastRoster() {
    const m = this.match;
    if (!m) return;
    const rows = m.roster();
    for (const cb of this.rosterCbs) cb(rows);
    const msg = JSON.stringify({ t: 'roster', rows });
    for (const p of this.peers.values()) if (p.ctl?.readyState === 'open') p.ctl.send(msg);
  }

  /** Começa a simular (todos os aparelhos já conectaram, ou o líder está sozinho). */
  start() {
    if (this.match) return;
    const s = this.setup;
    const humans: BolInfo[] = s.humans.map((h) => ({
      id: h.id,
      name: h.name,
      color: BOL_TEAM_COLORS[h.team] as number,
      team: h.team,
    }));
    this.match = new BolaMatch({
      teams: s.teams,
      perTeam: s.perTeam,
      durationSec: s.durationSec,
      seed: s.seed,
      humans,
      bots: s.bots,
      away: s.away,
      now: () => Date.now(),
    });
    this.stopTicker = makeTicker(() => this.loop(), 16);
  }

  /** O líder encerra a partida com o placar de agora. */
  endNow() {
    this.match?.endNow();
  }

  private loop() {
    const m = this.match;
    if (!m || this.finished) return;
    m.tick();
    const frame = m.drainFrame(true);
    if (!frame) return;
    const now = Date.now();
    for (const e of frame.ev as Record<string, unknown>[]) this.evBuf.push({ at: now, e });
    while (this.evBuf.length > 0 && now - (this.evBuf[0] as { at: number }).at > EVENT_KEEP_MS) {
      this.evBuf.shift();
    }
    if (frame.st) this.pendingSt = frame.st;
    for (const cb of this.frameCbs) cb(frame);
    const every = Math.max(1, Math.round(60 / PEER_FPS));
    if (this.tickN++ % every === 0 || m.over) this.sendPeers(frame);
    if (m.over) {
      this.finished = true;
      // o último quadro vai mais algumas vezes: o canal não garante entrega
      for (let i = 1; i <= 4; i++) window.setTimeout(() => this.sendPeers(frame), i * 120);
      this.onOver({ scores: [...m.world.scores], winner: m.world.winner });
      this.stopTicker?.();
      this.stopTicker = null;
    }
  }

  private sendPeers(frame: BolaFrame) {
    const out: BolaFrame = { ...frame, ev: this.evBuf.map((x) => x.e) };
    if (this.pendingSt) {
      out.st = this.pendingSt;
      this.pendingSt = null;
    }
    const text = JSON.stringify(out);
    for (const p of this.peers.values()) {
      const ch = p.game;
      // canal entupido (rede ruim): pula o quadro em vez de empilhar atraso
      if (ch?.readyState === 'open' && ch.bufferedAmount < 64_000) ch.send(text);
    }
  }

  dispose() {
    this.stopTicker?.();
    this.stopTicker = null;
    this.unsub();
    for (const p of this.peers.values()) {
      if (p.ctl?.readyState === 'open') p.ctl.send(JSON.stringify({ t: 'bye' }));
      p.pc.close();
    }
    this.peers.clear();
    this.frameCbs.clear();
    this.rosterCbs.clear();
  }
}

export interface PeerHandlers {
  /** Os dois canais abriram: dá para jogar por aqui. */
  onOpen: () => void;
  /** Não conseguiu conectar no tempo (rede com NAT estrito, bloqueio...). */
  onFail: () => void;
  /** Depois de aberto, a conexão caiu ou o líder avisou que saiu. */
  onClosed: () => void;
}

/** O lado dos outros aparelhos: conecta ao do líder, manda a entrada e recebe o fluxo. */
export class BolaPeerSession {
  private pc: RTCPeerConnection;
  private game: RTCDataChannel;
  private ctl: RTCDataChannel;
  private unsub: () => void;
  private frameCbs = new Set<(f: BolaFrame) => void>();
  private rosterCbs = new Set<(rows: BolaRosterRow[]) => void>();
  private cands: RTCIceCandidateInit[] = [];
  private remoteSet = false;
  private open = false;
  private ended = false;
  private rttMs = 0;
  private pingTimer = 0;
  private failTimer = 0;
  readonly link: BolaLink;

  constructor(
    private readonly hostId: string,
    private readonly h: PeerHandlers,
    timeoutMs = 6000,
  ) {
    this.pc = new RTCPeerConnection(ICE);
    this.game = this.pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 });
    this.ctl = this.pc.createDataChannel('ctl');
    this.unsub = subscribeRoom('rtc', (m) => void this.onSignal(m as SignalIn));
    this.link = {
      local: false,
      rtt: () => this.rttMs,
      sendInput: (v) => {
        if (this.game.readyState === 'open') this.game.send(JSON.stringify(v));
      },
      onFrame: (cb) => {
        this.frameCbs.add(cb);
        return () => void this.frameCbs.delete(cb);
      },
      onRoster: (cb) => {
        this.rosterCbs.add(cb);
        return () => void this.rosterCbs.delete(cb);
      },
    };
    this.game.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      try {
        const f = JSON.parse(e.data) as BolaFrame;
        for (const cb of this.frameCbs) cb(f);
      } catch {
        /* quadro ilegível: ignora */
      }
    };
    this.ctl.onmessage = (e) => this.onCtl(e.data);
    const check = () => {
      if (this.open || this.game.readyState !== 'open' || this.ctl.readyState !== 'open') return;
      this.open = true;
      window.clearTimeout(this.failTimer);
      this.pingTimer = window.setInterval(() => this.ping(), 1000);
      this.ping();
      this.h.onOpen();
    };
    this.game.onopen = check;
    this.ctl.onopen = check;
    this.ctl.onclose = () => this.end(false);
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed') {
        this.end(false);
      }
    };
    this.pc.onicecandidate = (e) => {
      if (e.candidate) signal(this.hostId, { cand: e.candidate.toJSON() });
    };
    this.failTimer = window.setTimeout(() => {
      if (!this.open) this.end(true);
    }, timeoutMs);
  }

  /** Manda a oferta ao líder (pela sala). */
  async start() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    signal(this.hostId, { sdp: this.pc.localDescription?.toJSON() });
  }

  private async onSignal({ from, data }: SignalIn) {
    if (from !== this.hostId || !data || this.ended) return;
    if (data.sdp && data.sdp.type === 'answer') {
      await this.pc.setRemoteDescription(data.sdp);
      this.remoteSet = true;
      for (const c of this.cands.splice(0)) await this.pc.addIceCandidate(c).catch(() => undefined);
    } else if (data.cand) {
      if (this.remoteSet) await this.pc.addIceCandidate(data.cand).catch(() => undefined);
      else this.cands.push(data.cand);
    }
  }

  private ping() {
    if (this.ctl.readyState === 'open')
      this.ctl.send(JSON.stringify({ t: 'ping', ts: Date.now() }));
  }

  private onCtl(data: unknown) {
    if (typeof data !== 'string') return;
    try {
      const m = JSON.parse(data) as { t?: string; ts?: number; rows?: BolaRosterRow[] };
      if (m.t === 'pong' && typeof m.ts === 'number') {
        const rtt = Math.max(0, Date.now() - m.ts);
        this.rttMs = this.rttMs === 0 ? rtt : this.rttMs * 0.7 + rtt * 0.3;
      } else if (m.t === 'roster' && Array.isArray(m.rows)) {
        for (const cb of this.rosterCbs) cb(m.rows);
      } else if (m.t === 'bye') this.end(false);
    } catch {
      /* ignora */
    }
  }

  /** `failed`: nunca abriu; senão a conexão aberta caiu. */
  private end(failed: boolean) {
    if (this.ended) return;
    this.ended = true;
    if (failed || !this.open) this.h.onFail();
    else this.h.onClosed();
    this.dispose();
  }

  dispose() {
    this.ended = true;
    window.clearTimeout(this.failTimer);
    window.clearInterval(this.pingTimer);
    this.unsub();
    this.game.onmessage = null;
    this.pc.close();
    this.frameCbs.clear();
    this.rosterCbs.clear();
  }
}
