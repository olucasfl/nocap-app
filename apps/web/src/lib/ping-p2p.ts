import { sendRoomQuiet, subscribeRoom } from './rooms';

/**
 * Canal direto entre os dois jogadores do Ping Fox! (WebRTC), como o do Fut Fox (spec 048): as batidas e a raquete vão
 * de um aparelho para o outro sem passar pela sala e SEM espera de retransmissão (canal sem ordem, como UDP). No
 * WebSocket (TCP) um pacote perdido trava todos os seguintes por 200 a 500 ms, e é isso que fazia a bola "teleportar".
 * Aqui o que se perde é coberto pelo pacote seguinte: cada pacote repete as batidas dos últimos 700 ms (quem recebe
 * descarta as repetidas pelo número do tick). A sala continua recebendo tudo pelo caminho de antes (juiz, quem assiste e
 * reserva se o canal direto não abrir).
 */
const ICE: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};

/** Repete as batidas por este tempo (ms) em cada pacote. */
const REPEAT_MS = 700;

export interface PingPeerMsg {
  /** Batidas e lançamentos (formato de `PpNetEvent`, validado por quem recebe). */
  e?: unknown[];
  /** A raquete de quem mandou: x, y e alcance. */
  p?: [number, number, number];
}

interface SignalIn {
  from: string;
  data: { sdp?: RTCSessionDescriptionInit; cand?: RTCIceCandidateInit; hi?: boolean };
}

export class PingPeer {
  private pc: RTCPeerConnection | null = null;
  private ch: RTCDataChannel | null = null;
  private cands: RTCIceCandidateInit[] = [];
  private remoteSet = false;
  private recent: { at: number; ev: unknown }[] = [];
  private unsub: () => void;
  private retry: number | null = null;
  private tries = 0;
  private closed = false;

  constructor(
    private readonly otherId: string,
    /** Quem começa a conversa (manda a oferta): um dos dois, sempre o mesmo. */
    private readonly initiator: boolean,
    private readonly onMessage: (m: PingPeerMsg) => void,
  ) {
    this.unsub = subscribeRoom('rtc', (m) => void this.onSignal(m as SignalIn));
  }

  private signal(data: object) {
    sendRoomQuiet('rtc', { to: this.otherId, data });
  }

  /** Abre o canal. Quem não começa avisa que está pronto; quem começa manda a oferta (e tenta de novo se não conectar). */
  start() {
    if (this.initiator) {
      this.retry = window.setInterval(() => {
        if (this.open || this.closed || this.tries >= 6) {
          if (this.retry !== null) window.clearInterval(this.retry);
          return;
        }
        void this.offer();
      }, 2500);
    } else {
      this.signal({ hi: true });
    }
  }

  get open(): boolean {
    return this.ch?.readyState === 'open';
  }

  private fresh(): RTCPeerConnection {
    this.pc?.close();
    this.remoteSet = false;
    this.cands = [];
    const pc = new RTCPeerConnection(ICE);
    this.pc = pc;
    pc.onicecandidate = (e) => {
      if (e.candidate) this.signal({ cand: e.candidate.toJSON() });
    };
    pc.ondatachannel = (e) => this.attach(e.channel);
    return pc;
  }

  private attach(ch: RTCDataChannel) {
    this.ch = ch;
    ch.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      try {
        this.onMessage(JSON.parse(ev.data) as PingPeerMsg);
      } catch {
        /* pacote ilegível: o próximo cobre */
      }
    };
  }

  private async offer() {
    this.tries++;
    const pc = this.fresh();
    // sem ordem e sem retransmissão: o estado novo sempre vale mais que o perdido
    this.attach(pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 }));
    await pc.setLocalDescription(await pc.createOffer());
    this.signal({ sdp: pc.localDescription?.toJSON() });
  }

  private async onSignal({ from, data }: SignalIn) {
    if (this.closed || from !== this.otherId || !data) return;
    if (data.hi && this.initiator && !this.open) {
      await this.offer();
    } else if (data.sdp && data.sdp.type === 'offer' && !this.initiator) {
      const pc = this.fresh();
      await pc.setRemoteDescription(data.sdp);
      this.remoteSet = true;
      for (const c of this.cands.splice(0)) await pc.addIceCandidate(c).catch(() => undefined);
      await pc.setLocalDescription(await pc.createAnswer());
      this.signal({ sdp: pc.localDescription?.toJSON() });
    } else if (data.sdp && data.sdp.type === 'answer' && this.initiator && this.pc) {
      await this.pc.setRemoteDescription(data.sdp).catch(() => undefined);
      this.remoteSet = true;
      for (const c of this.cands.splice(0)) await this.pc.addIceCandidate(c).catch(() => undefined);
    } else if (data.cand && this.pc) {
      if (this.remoteSet) await this.pc.addIceCandidate(data.cand).catch(() => undefined);
      else this.cands.push(data.cand);
    }
  }

  /** Manda um pacote: as batidas novas e as dos últimos 700 ms (já mandadas, para cobrir pacote perdido) e a raquete. */
  send(newEvents: unknown[], pad?: [number, number, number]) {
    if (!this.open) return;
    const now = performance.now();
    for (const ev of newEvents) this.recent.push({ at: now, ev });
    this.recent = this.recent.filter((r) => now - r.at < REPEAT_MS);
    const msg: PingPeerMsg = {};
    if (this.recent.length > 0) msg.e = this.recent.map((r) => r.ev);
    if (pad) msg.p = pad;
    if (msg.e === undefined && msg.p === undefined) return;
    try {
      this.ch?.send(JSON.stringify(msg));
    } catch {
      /* canal fechando */
    }
  }

  close() {
    this.closed = true;
    this.unsub();
    if (this.retry !== null) window.clearInterval(this.retry);
    this.ch?.close();
    this.pc?.close();
  }
}
