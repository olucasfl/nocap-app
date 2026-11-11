import type { GpEvent, GpInputPacket, GpSnapshot } from '@nocap/games';
import { sendRoomQuiet, subscribeRoom } from './rooms';

/**
 * Transporte do Fox GP (spec 079): a MESMA infraestrutura do Fut Fox (sinalização `rtc` pela sala, STUN do Google, dois
 * canais por aparelho: `game` sem ordem nem retransmissão, para estado e entrada; `ctl` com garantia, para eventos).
 * Quem não consegue conectar direto ao líder em alguns segundos usa a sala como repasse (`grin`, `grsnap`, `grev`):
 * a partida segue igual, só com um pouco mais de atraso.
 */

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};
const signal = (to: string, data: object) => sendRoomQuiet('rtc', { to, data });

interface SignalIn {
  from: string;
  data: { sdp?: RTCSessionDescriptionInit; cand?: RTCIceCandidateInit };
}

interface HostPeer {
  id: string;
  pc: RTCPeerConnection;
  game: RTCDataChannel | null;
  ctl: RTCDataChannel | null;
  cands: RTCIceCandidateInit[];
  remoteSet: boolean;
  open: boolean;
}

/** O lado do líder: recebe entradas (direto ou pela sala) e manda estado e eventos a todos. */
export class GpHostLink {
  private peers = new Map<string, HostPeer>();
  private unsubs: (() => void)[] = [];
  private inputCb: ((id: string, p: GpInputPacket) => void) | null = null;
  /** Quem joga e não está conectado direto: o estado também vai pela sala. */
  private racers = new Set<string>();
  /** A vaga de cada um (o estado completo do carro vai só para o dono). */
  private slotOf = new Map<string, number>();

  constructor(private readonly meId: string) {
    this.unsubs.push(
      subscribeRoom('rtc', (m) => void this.onSignal(m as SignalIn)),
      subscribeRoom('grin', (m) => {
        const r = m as { from?: string; p?: GpInputPacket };
        if (typeof r?.from === 'string' && r.p) this.inputCb?.(r.from, r.p);
      }),
    );
  }

  /** Quem participa da corrida, na ordem das vagas (para o repasse pela sala e o estado de cada um). */
  setRacers(ids: string[]) {
    this.racers = new Set(ids.filter((id) => id !== this.meId));
    this.slotOf = new Map(ids.map((id, i) => [id, i]));
  }

  onInput(cb: (id: string, p: GpInputPacket) => void) {
    this.inputCb = cb;
  }

  /** Quantos estão conectados direto e quantos pela sala (painel de rede). */
  stats() {
    const direct = [...this.peers.values()].filter((p) => p.open).length;
    return { direct, relay: Math.max(0, this.racers.size - direct) };
  }

  private relayNeeded(): boolean {
    for (const id of this.racers) if (!this.peers.get(id)?.open) return true;
    return false;
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
    const peer: HostPeer = {
      id,
      pc,
      game: null,
      ctl: null,
      cands: [],
      remoteSet: false,
      open: false,
    };
    this.peers.set(id, peer);
    pc.onicecandidate = (e) => {
      if (e.candidate) signal(id, { cand: e.candidate.toJSON() });
    };
    pc.ondatachannel = (e) => {
      const ch = e.channel;
      if (ch.label === 'game') {
        peer.game = ch;
        ch.onmessage = (ev) => {
          if (typeof ev.data !== 'string') return;
          try {
            this.inputCb?.(id, JSON.parse(ev.data) as GpInputPacket);
          } catch {
            /* entrada ilegível: ignora */
          }
        };
      } else {
        peer.ctl = ch;
        ch.onmessage = (ev) => {
          if (typeof ev.data !== 'string') return;
          try {
            const m = JSON.parse(ev.data) as { t?: string; ts?: number };
            if (m.t === 'hello') peer.open = true;
            else if (m.t === 'ping' && ch.readyState === 'open')
              ch.send(JSON.stringify({ t: 'pong', ts: m.ts }));
          } catch {
            /* ignora */
          }
        };
        ch.onclose = () => this.drop(id);
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.drop(id);
    };
    return peer;
  }

  private drop(id: string) {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    p.pc.close();
  }

  /**
   * Estado do líder: direto para quem está conectado (cada um recebe o estado completo só do próprio carro: com 20 carros
   * o pacote fica enxuto); pela sala se alguém ainda não está (com o estado completo de quem depende dela).
   */
  sendSnapshot(s: GpSnapshot, only: (s: GpSnapshot, slots: number[]) => GpSnapshot) {
    for (const p of this.peers.values()) {
      // canal entupido (rede ruim): pula o estado em vez de empilhar atraso
      if (!p.open || p.game?.readyState !== 'open' || p.game.bufferedAmount >= 64_000) continue;
      const slot = this.slotOf.get(p.id);
      p.game.send(JSON.stringify(only(s, slot === undefined ? [] : [slot])));
    }
    if (this.relayNeeded()) {
      const slots = [...this.racers]
        .filter((id) => !this.peers.get(id)?.open)
        .map((id) => this.slotOf.get(id))
        .filter((v): v is number => v !== undefined);
      sendRoomQuiet('grsnap', only(s, slots));
    }
  }

  /** Eventos (voltas, chegada, box, batidas): com garantia de entrega. */
  sendEvents(ev: GpEvent[]) {
    if (ev.length === 0) return;
    const text = JSON.stringify(ev);
    for (const p of this.peers.values())
      if (p.open && p.ctl?.readyState === 'open') p.ctl.send(text);
    if (this.relayNeeded()) sendRoomQuiet('grev', ev);
  }

  dispose() {
    for (const off of this.unsubs) off();
    for (const p of this.peers.values()) {
      if (p.ctl?.readyState === 'open') p.ctl.send(JSON.stringify({ t: 'bye' }));
      p.pc.close();
    }
    this.peers.clear();
  }
}

/** O lado dos outros aparelhos: tenta conectar direto ao líder; se não der, usa a sala. */
export class GpPeerLink {
  private pc: RTCPeerConnection | null = null;
  private game: RTCDataChannel | null = null;
  private ctl: RTCDataChannel | null = null;
  private cands: RTCIceCandidateInit[] = [];
  private remoteSet = false;
  private unsubs: (() => void)[] = [];
  private snapCb: ((s: GpSnapshot) => void) | null = null;
  private evCb: ((e: GpEvent[]) => void) | null = null;
  private pings: number[] = [];
  private pingTimer = 0;
  private failTimer = 0;
  /** 'direto' (WebRTC) ou 'sala' (repasse). */
  mode: 'conectando' | 'direto' | 'sala' = 'conectando';
  rtt = 0;

  constructor(
    private readonly hostId: string,
    timeoutMs = 6000,
  ) {
    this.unsubs.push(
      subscribeRoom('rtc', (m) => void this.onSignal(m as SignalIn)),
      subscribeRoom('grsnap', (m) => {
        if (this.mode !== 'direto') this.snapCb?.(m as GpSnapshot);
      }),
      subscribeRoom('grev', (m) => {
        if (this.mode !== 'direto' && Array.isArray(m)) this.evCb?.(m as GpEvent[]);
      }),
    );
    if (typeof RTCPeerConnection === 'undefined') {
      this.mode = 'sala';
      return;
    }
    const pc = new RTCPeerConnection(ICE);
    this.pc = pc;
    this.game = pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 });
    this.ctl = pc.createDataChannel('ctl');
    this.game.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      try {
        this.snapCb?.(JSON.parse(e.data) as GpSnapshot);
      } catch {
        /* estado ilegível: ignora */
      }
    };
    this.ctl.onmessage = (e) => this.onCtl(e.data);
    const check = () => {
      if (
        this.mode === 'direto' ||
        this.game?.readyState !== 'open' ||
        this.ctl?.readyState !== 'open'
      )
        return;
      this.mode = 'direto';
      window.clearTimeout(this.failTimer);
      this.ctl.send(JSON.stringify({ t: 'hello' }));
      this.pingTimer = window.setInterval(() => this.ping(), 500);
    };
    this.game.onopen = check;
    this.ctl.onopen = check;
    this.ctl.onclose = () => this.fallback();
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.fallback();
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) signal(this.hostId, { cand: e.candidate.toJSON() });
    };
    this.failTimer = window.setTimeout(() => {
      if (this.mode !== 'direto') this.fallback();
    }, timeoutMs);
    void this.start();
  }

  private async start() {
    if (!this.pc) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    signal(this.hostId, { sdp: this.pc.localDescription?.toJSON() });
  }

  private async onSignal({ from, data }: SignalIn) {
    if (from !== this.hostId || !data || !this.pc) return;
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
    if (this.ctl?.readyState === 'open')
      this.ctl.send(JSON.stringify({ t: 'ping', ts: Date.now() }));
  }

  private onCtl(data: unknown) {
    if (typeof data !== 'string') return;
    try {
      const m = JSON.parse(data) as { t?: string; ts?: number } | GpEvent[];
      if (Array.isArray(m)) this.evCb?.(m);
      else if (m.t === 'pong' && typeof m.ts === 'number') {
        this.pings = [...this.pings, Math.max(0, Date.now() - m.ts)].slice(-6);
        this.rtt = Math.min(...this.pings);
      } else if (m.t === 'bye') this.fallback();
    } catch {
      /* ignora */
    }
  }

  /** A conexão direta não saiu (ou caiu): segue pela sala. */
  private fallback() {
    if (this.mode === 'sala') return;
    this.mode = 'sala';
    window.clearTimeout(this.failTimer);
    window.clearInterval(this.pingTimer);
    this.pc?.close();
  }

  onSnapshot(cb: (s: GpSnapshot) => void) {
    this.snapCb = cb;
  }

  onEvents(cb: (e: GpEvent[]) => void) {
    this.evCb = cb;
  }

  sendInput(p: GpInputPacket) {
    if (this.mode === 'direto' && this.game?.readyState === 'open')
      this.game.send(JSON.stringify(p));
    else sendRoomQuiet('grin', p);
  }

  dispose() {
    window.clearTimeout(this.failTimer);
    window.clearInterval(this.pingTimer);
    for (const off of this.unsubs) off();
    this.pc?.close();
  }
}
