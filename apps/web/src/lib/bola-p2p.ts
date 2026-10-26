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

/** Até este número de aparelhos conectados, todos recebem o estado a cada passo (60/s). */
const PEERS_FULL_RATE = 4;

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

/** O lado do líder: aceita as conexões e põe a partida para rodar numa thread própria (`bola-host.worker.ts`). */
export class BolaHostSession {
  private peers = new Map<string, HostPeer>();
  private worker: Worker | null = null;
  private unsub: () => void;
  private frameCbs = new Set<(f: BolaFrame) => void>();
  private rosterCbs = new Set<(rows: BolaRosterRow[]) => void>();
  private finished = false;
  private lastPeerText = '';
  readonly link: BolaLink;

  constructor(
    private readonly meId: string,
    private readonly setup: Setup,
    private readonly onOver: (r: HostResult) => void,
  ) {
    this.unsub = subscribeRoom('rtc', (m) => void this.onSignal(m as SignalIn));
    this.link = {
      local: true,
      minDelay: 25,
      rtt: () => 0,
      sendInput: (v) => this.worker?.postMessage({ t: 'input', id: this.meId, v }),
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
    if (typeof data !== 'string') return;
    try {
      this.worker?.postMessage({ t: 'input', id, v: JSON.parse(data) });
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

  /** Quem saiu (ou perdeu a conexão) vira bot no lugar; a lista nova volta do worker e vai a todos. */
  private peerGone(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    peer.pc.close();
    if (this.worker && !this.finished) this.worker.postMessage({ t: 'toBot', id });
    this.worker?.postMessage({ t: 'rate', everyPeerFrame: this.peers.size <= PEERS_FULL_RATE });
  }

  /** Começa a simular (todos os aparelhos já conectaram, ou o líder está sozinho). */
  start() {
    if (this.worker) return;
    const w = new Worker(new URL('./bola-host.worker.ts', import.meta.url), { type: 'module' });
    this.worker = w;
    w.onmessage = (ev: MessageEvent) => this.onWorker(ev.data as WorkerOut);
    w.postMessage({
      t: 'init',
      setup: this.setup,
      everyPeerFrame: this.peers.size <= PEERS_FULL_RATE,
    });
  }

  private onWorker(m: WorkerOut) {
    if (m.t === 'frame') {
      if (this.frameCbs.size > 0) {
        const f = JSON.parse(m.local) as BolaFrame;
        for (const cb of this.frameCbs) cb(f);
      }
      if (m.peer) {
        this.lastPeerText = m.peer;
        this.sendPeers(m.peer);
      }
    } else if (m.t === 'roster') {
      for (const cb of this.rosterCbs) cb(m.rows);
      const msg = JSON.stringify({ t: 'roster', rows: m.rows });
      for (const p of this.peers.values()) if (p.ctl?.readyState === 'open') p.ctl.send(msg);
    } else if (m.t === 'over') {
      this.finished = true;
      // o último quadro vai mais algumas vezes: o canal não garante entrega
      for (let i = 1; i <= 4; i++)
        window.setTimeout(() => this.sendPeers(this.lastPeerText), i * 120);
      this.onOver({ scores: m.scores, winner: m.winner });
    }
  }

  /** O líder encerra a partida com o placar de agora. */
  endNow() {
    this.worker?.postMessage({ t: 'end' });
  }

  private sendPeers(text: string) {
    if (!text) return;
    for (const p of this.peers.values()) {
      const ch = p.game;
      // canal entupido (rede ruim): pula o quadro em vez de empilhar atraso
      if (ch?.readyState === 'open' && ch.bufferedAmount < 64_000) ch.send(text);
    }
  }

  dispose() {
    this.worker?.postMessage({ t: 'stop' });
    this.worker?.terminate();
    this.worker = null;
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

type WorkerOut =
  | { t: 'frame'; local: string; peer: string | null }
  | { t: 'roster'; rows: BolaRosterRow[] }
  | { t: 'over'; scores: number[]; winner: number };

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
  private pings: number[] = [];
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
      minDelay: 45,
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
      this.pingTimer = window.setInterval(() => this.ping(), 500);
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
        // a resposta passa pela fila do aparelho do líder (que também desenha): vale o menor dos últimos, que é a rede de verdade
        this.pings = [...this.pings, Math.max(0, Date.now() - m.ts)].slice(-6);
        this.rttMs = Math.min(...this.pings);
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
