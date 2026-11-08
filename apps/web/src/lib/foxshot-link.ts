import { FS_NET_HZ } from '@nocap/games';
import { currentRtt, gameFrozen, sendRoom, sendRoomQuiet, serverNow, subscribeRoom } from './rooms';

/**
 * Por onde a partida do Counter Fox chega e a entrada sai (spec 060). O cliente do jogo só conhece `FsLink`:
 *  - `fsRoomLink`: a sala (servidor) simula e manda `fss`; a entrada vai em `fsin` (a reserva, e o jeito antigo);
 *  - o aparelho do líder simula num Worker e manda o estado direto aos outros por WebRTC (dois canais: `game` sem ordem e
 *    sem retransmissão, como UDP, e `ctl` com garantia para ping); o próprio líder joga por um canal local, sem rede.
 * A sala só repassa a sinalização (`rtc`) e decide quem simula: se todos conectarem ao líder na contagem, a partida roda
 * ponto a ponto; senão o servidor simula, como sempre (ninguém fica de fora).
 */
export interface FsLink {
  /** Um pacote com as últimas entradas. */
  sendInput(batch: unknown): void;
  /** Cada quadro novo `{ f, s, e }`. */
  onFrame(cb: (m: unknown) => void): () => void;
  /** Ida e volta até quem simula (ms). */
  rtt(): number;
  local: boolean;
  /** O menor atraso de desenho (ms) que o caminho aguenta. */
  minDelay: number;
}

export const fsRoomLink: FsLink = {
  sendInput: (v) => sendRoomQuiet('fsin', v),
  onFrame: (cb) => subscribeRoom('fss', cb),
  rtt: () => currentRtt(),
  local: false,
  minDelay: 100,
};

/** Rastro curto da conexão (para depurar e para os testes). */
export const fsNetLog: string[] = [];
const logNet = (t: string) => {
  fsNetLog.push(`${Math.round(performance.now())} ${t}`);
  if (fsNetLog.length > 40) fsNetLog.shift();
};
type SimOpts = Record<string, unknown>;
type FsRow = { id: string; name: string; points: number; kills: number; assists: number; deaths: number; place: number };

const ICE: RTCConfiguration = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
interface SignalIn {
  from: string;
  data: { sdp?: RTCSessionDescriptionInit; cand?: RTCIceCandidateInit };
}
const signal = (to: string, data: object) => {
  logNet('signal -> ' + to + ' ' + Object.keys(data).join(','));
  sendRoomQuiet('rtc', { to, data });
};

interface HostPeer {
  id: string;
  pc: RTCPeerConnection;
  game: RTCDataChannel | null;
  ctl: RTCDataChannel | null;
  cands: RTCIceCandidateInit[];
  remoteSet: boolean;
}

/** O lado do líder: aceita as conexões e roda a partida num Worker. */
export class FsHostSession {
  private peers = new Map<string, HostPeer>();
  private worker: Worker | null = null;
  private pauseTimer = 0;
  private unsub: () => void;
  private frameCbs = new Set<(m: unknown) => void>();
  readonly link: FsLink;

  constructor(private readonly meId: string) {
    this.unsub = subscribeRoom('rtc', (m) => void this.onSignal(m as SignalIn));
    this.link = {
      local: true,
      minDelay: 35,
      rtt: () => 0,
      sendInput: (v) => {
        for (const x of (Array.isArray(v) ? v : [v]).slice(0, 8)) this.worker?.postMessage({ t: 'input', id: this.meId, v: x });
      },
      onFrame: (cb) => {
        this.frameCbs.add(cb);
        return () => void this.frameCbs.delete(cb);
      },
    };
  }

  private async onSignal({ from, data }: SignalIn) {
    if (!from || !data) return;
    let peer = this.peers.get(from);
    if (data.sdp && data.sdp.type === 'offer') {
      logNet('host offer from ' + from);
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
      logNet(`host pc ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.peerGone(id);
    };
    pc.oniceconnectionstatechange = () => logNet(`host ice ${pc.iceConnectionState}`);
    return peer;
  }

  private onInput(id: string, data: unknown) {
    if (typeof data !== 'string') return;
    try {
      const list = JSON.parse(data) as unknown;
      for (const v of Array.isArray(list) ? list.slice(0, 8) : [list]) this.worker?.postMessage({ t: 'input', id, v });
    } catch {
      /* entrada ilegível: ignora */
    }
  }

  private onCtl(peer: HostPeer, data: unknown) {
    if (typeof data !== 'string') return;
    try {
      const m = JSON.parse(data) as { t?: string; ts?: number };
      if (m.t === 'ping' && peer.ctl?.readyState === 'open') peer.ctl.send(JSON.stringify({ t: 'pong', ts: m.ts }));
    } catch {
      /* ignora */
    }
  }

  /** Quem saiu (ou perdeu a conexão) vira bot no lugar. */
  private peerGone(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    peer.pc.close();
    this.worker?.postMessage({ t: 'toBot', id });
  }

  /** Começa a simular quando a contagem acabar (`startAt` na hora da sala). */
  start(opts: SimOpts, startAt: number) {
    if (this.worker) return;
    const w = new Worker(new URL('./foxshot-host.worker.ts', import.meta.url), { type: 'module' });
    this.worker = w;
    w.onmessage = (ev: MessageEvent) => this.onWorker(ev.data as WorkerOut);
    w.postMessage({ t: 'init', opts, delayMs: Math.max(0, startAt - serverNow()) });
    // a pausa do líder da sala para a partida daqui também
    let frozen = false;
    this.pauseTimer = window.setInterval(() => {
      const now = gameFrozen();
      if (now === frozen) return;
      frozen = now;
      this.worker?.postMessage({ t: 'pause', on: now });
    }, 60);
  }

  private onWorker(m: WorkerOut) {
    if (m.t === 'frames') {
      const mine = m.texts[this.meId] ?? m.texts['*'];
      if (mine && this.frameCbs.size > 0) {
        const f = JSON.parse(mine) as unknown;
        for (const cb of this.frameCbs) cb(f);
      }
      for (const p of this.peers.values()) {
        const text = m.texts[p.id] ?? m.texts['*'];
        const ch = p.game;
        // canal entupido (rede ruim): pula o quadro em vez de empilhar atraso
        if (text && ch?.readyState === 'open' && ch.bufferedAmount < 64_000) ch.send(text);
      }
    } else if (m.t === 'status') {
      sendRoomQuiet('fsres', { rows: m.rows, over: m.over, bomb: m.bomb });
    }
  }

  dispose() {
    window.clearInterval(this.pauseTimer);
    this.worker?.postMessage({ t: 'stop' });
    this.worker?.terminate();
    this.worker = null;
    this.unsub();
    for (const p of this.peers.values()) p.pc.close();
    this.peers.clear();
    this.frameCbs.clear();
  }
}

type WorkerOut = { t: 'frames'; texts: Record<string, string> } | { t: 'status'; rows: FsRow[]; over: boolean; bomb?: unknown };

export interface FsPeerHandlers {
  onOpen: () => void;
  onFail: () => void;
  onClosed: () => void;
}

/** O lado dos outros aparelhos: conecta ao do líder, manda a entrada e recebe o estado. */
export class FsPeerSession {
  private pc: RTCPeerConnection;
  private game: RTCDataChannel;
  private ctl: RTCDataChannel;
  private unsub: () => void;
  private frameCbs = new Set<(m: unknown) => void>();
  private cands: RTCIceCandidateInit[] = [];
  private remoteSet = false;
  private open = false;
  private ended = false;
  private rttMs = 0;
  private pings: number[] = [];
  private pingTimer = 0;
  private failTimer = 0;
  readonly link: FsLink;

  constructor(
    private readonly hostId: string,
    private readonly h: FsPeerHandlers,
    timeoutMs = 5500,
  ) {
    this.pc = new RTCPeerConnection(ICE);
    this.game = this.pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 });
    this.ctl = this.pc.createDataChannel('ctl');
    this.unsub = subscribeRoom('rtc', (m) => void this.onSignal(m as SignalIn));
    this.link = {
      local: false,
      minDelay: 60,
      rtt: () => this.rttMs,
      sendInput: (v) => {
        if (this.game.readyState === 'open') this.game.send(JSON.stringify(v));
      },
      onFrame: (cb) => {
        this.frameCbs.add(cb);
        return () => void this.frameCbs.delete(cb);
      },
    };
    this.game.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      try {
        const f = JSON.parse(e.data) as unknown;
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
      logNet(`peer pc ${this.pc.connectionState}`);
      if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed') this.end(false);
    };
    this.pc.oniceconnectionstatechange = () => logNet(`peer ice ${this.pc.iceConnectionState}`);
    this.pc.onicecandidate = (e) => {
      if (e.candidate) signal(this.hostId, { cand: e.candidate.toJSON() });
    };
    this.failTimer = window.setTimeout(() => {
      if (!this.open) this.end(true);
    }, timeoutMs);
  }

  async start() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    signal(this.hostId, { sdp: this.pc.localDescription?.toJSON() });
  }

  private async onSignal({ from, data }: SignalIn) {
    logNet('peer got signal from ' + from + ' ' + Object.keys(data ?? {}).join(','));
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
    if (this.ctl.readyState === 'open') this.ctl.send(JSON.stringify({ t: 'ping', ts: Date.now() }));
  }

  private onCtl(data: unknown) {
    if (typeof data !== 'string') return;
    try {
      const m = JSON.parse(data) as { t?: string; ts?: number };
      if (m.t === 'pong' && typeof m.ts === 'number') {
        // o menor dos últimos é a rede de verdade (a resposta passa pela fila do aparelho do líder, que também desenha)
        this.pings = [...this.pings, Math.max(0, Date.now() - m.ts)].slice(-6);
        this.rttMs = Math.min(...this.pings);
      }
    } catch {
      /* ignora */
    }
  }

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
  }
}

/** Tudo que o cliente precisa saber da sala para escolher o caminho. */
export interface FsNetView {
  me: string;
  phase: string;
  foxshot?: { net?: string; p2pHost?: string | null; setup?: SimOpts | null; startAt?: number | null } | null;
}

/**
 * Escolhe e troca o caminho da partida. `link` é um só e não muda: por baixo ele segue a sala, o líder remoto ou o canal local
 * do líder. Chame `update` a cada mudança da sala.
 */
export class FsNetClient {
  readonly link: FsLink;
  private cbs = new Set<(m: unknown) => void>();
  private cur: FsLink = fsRoomLink;
  private unCur: () => void = () => undefined;
  private host: FsHostSession | null = null;
  private peer: FsPeerSession | null = null;
  private key = '';
  private started = false;

  constructor() {
    // os getters abaixo têm o próprio `this` (o objeto literal), então a classe precisa de um nome
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.link = {
      get local() {
        return self.cur.local;
      },
      get minDelay() {
        return self.cur.minDelay;
      },
      rtt: () => this.cur.rtt(),
      sendInput: (v) => this.cur.sendInput(v),
      onFrame: (cb) => {
        this.cbs.add(cb);
        return () => void this.cbs.delete(cb);
      },
    };
    this.bind(fsRoomLink);
  }

  private bind(l: FsLink) {
    this.unCur();
    this.cur = l;
    this.unCur = l.onFrame((m) => {
      for (const cb of this.cbs) cb(m);
    });
  }

  debug() {
    return { key: this.key, host: !!this.host, peer: !!this.peer, started: this.started, direct: this.direct };
  }

  /** `p2p`: o caminho direto está valendo agora. */
  get direct(): boolean {
    return this.cur !== fsRoomLink;
  }

  update(v: FsNetView) {
    try {
      this.updateInner(v);
    } catch (e) {
      logNet('erro ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  private updateInner(v: FsNetView) {
    const fx = v.foxshot;
    const net = fx?.net ?? 'server';
    const hostId = fx?.p2pHost ?? null;
    if (net === 'server' || !hostId || (v.phase !== 'show' && v.phase !== 'play')) {
      if (this.host || this.peer) this.teardown();
      if (this.cur !== fsRoomLink) this.bind(fsRoomLink);
      this.key = '';
      return;
    }
    const key = `${hostId}:${fx?.startAt ?? 0}`;
    if (key !== this.key) {
      this.teardown();
      this.key = key;
      this.started = false;
      if (hostId === v.me) {
        logNet('host session');
        this.host = new FsHostSession(v.me);
        // o líder está pronto na hora: só espera os outros conectarem
        sendRoom('fsp2p', { ok: true });
      } else {
        // o prazo do aparelho acompanha a contagem da sala (menos uma folga para a sala decidir antes)
        const timeoutMs = Math.max(3000, (fx?.startAt ?? 0) - serverNow() - 700);
        const peer = new FsPeerSession(hostId, {
          onOpen: () => {
            logNet('peer open');
            sendRoom('fsp2p', { ok: true });
          },
          onFail: () => {
            logNet('peer fail');
            sendRoom('fsp2p', { ok: false });
            this.peer = null;
            if (this.cur !== fsRoomLink) this.bind(fsRoomLink);
          },
          onClosed: () => {
            this.peer = null;
            if (this.cur !== fsRoomLink) this.bind(fsRoomLink);
          },
        }, timeoutMs);
        this.peer = peer;
        logNet('peer session -> ' + hostId);
        void peer.start().then(() => logNet('peer offer sent')).catch((e) => logNet('offer erro ' + e));
      }
    }
    if (net === 'p2p') {
      if (this.host) {
        if (!this.started && fx?.setup && fx.startAt) {
          this.started = true;
          this.host.start(fx.setup, fx.startAt);
        }
        if (this.cur !== this.host.link) this.bind(this.host.link);
      } else if (this.peer && this.cur !== this.peer.link) this.bind(this.peer.link);
    }
  }

  private teardown() {
    this.host?.dispose();
    this.peer?.dispose();
    this.host = null;
    this.peer = null;
  }

  /** Fecha as conexões e volta ao caminho da sala. Pode ser chamado de novo `update` depois (o React em desenvolvimento monta duas vezes). */
  dispose() {
    this.teardown();
    this.key = '';
    this.started = false;
    this.bind(fsRoomLink);
  }
}

export const FS_NET_FRAME_MS = 1000 / (FS_NET_HZ / 2);
