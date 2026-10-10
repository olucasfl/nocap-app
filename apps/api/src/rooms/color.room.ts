import { randomInt, randomUUID } from 'node:crypto';
import { Room, ServerError, matchMaker, type Client } from 'colyseus';
import type { Auth } from '../auth/auth';
import { ColorRoomEngine, MAX_PLAYERS, RoomError } from './color-room.engine';
import { TimeRoomEngine } from './time-room.engine';
import { ImpostorRoomEngine } from './impostor/impostor-room.engine';
import { EcoRoomEngine } from './eco-room.engine';
import { EcoLeaderRoomEngine } from './eco-leader-room.engine';
import { PartyRoomEngine } from './party-room.engine';
import { IMPOSTOR_MAX_PLAYERS } from '@nocap/games';
import type { InvitesService } from './invites.service';
import type { RoomsRepository } from './rooms.repository';

/** Sem I, O, 0 e 1: letras que se confundem ao ditar o código. */
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const TICK_MS = 250;
/** Quanto tempo alguém com a tela bloqueada tem para voltar no meio da partida. */
const RECONNECT_SECONDS = 60;
/** No lobby e no pódio a vaga não fica presa tanto tempo: voltar é só entrar pelo código. */
const LOBBY_RECONNECT_SECONDS = 25;

/** Dependências que o Nest injeta na inicialização (o Colyseus instancia a sala sozinho). */
export const roomDeps: {
  auth: Auth | null;
  repo: RoomsRepository | null;
  invites: InvitesService | null;
  /** Em que sala cada conta está (uma por vez). Em memória, como as salas. */
  activeRooms: Map<string, string>;
} = {
  auth: null,
  repo: null,
  invites: null,
  activeRooms: new Map(),
};

interface AuthData {
  id: string;
  username: string;
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const code = Array.from({ length: 4 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join(
      '',
    );
    if (!(await matchMaker.getRoomById(code))) return code;
  }
  throw new ServerError(503, 'Não foi possível gerar um código de sala');
}

/** A sala existe neste servidor e a conta ainda é membro dela? */
function roomOf(roomId: string): ColorRoom | null {
  try {
    const room = matchMaker.getLocalRoomById(roomId);
    return room instanceof ColorRoom ? room : null;
  } catch {
    return null;
  }
}
const isMemberOf = (roomId: string, userId: string) => !!roomOf(roomId)?.hasMember(userId);

export type MyRoomInfo = ReturnType<ColorRoom['describeFor']>;

/** A sala em que a conta está agora, ou `null`. Registro que sobrou de sala acabada é limpo aqui. */
export function myRoomInfo(userId: string): MyRoomInfo | null {
  const roomId = roomDeps.activeRooms.get(userId);
  if (!roomId) return null;
  const room = roomOf(roomId);
  if (!room?.hasMember(userId)) {
    roomDeps.activeRooms.delete(userId);
    return null;
  }
  return room.describeFor(userId);
}

/** Sai da sala atual pelo servidor (vale mesmo com a conexão caída). `true` se estava em alguma. */
export function leaveMyRoom(userId: string): boolean {
  const roomId = roomDeps.activeRooms.get(userId);
  if (!roomId) return false;
  const room = roomOf(roomId);
  roomDeps.activeRooms.delete(userId);
  return room ? room.evict(userId) : false;
}

/**
 * Sala da Cor. As regras vivem em `ColorRoomEngine`; aqui só há rede: autenticar, repassar
 * mensagens, mandar o estado a todos e cuidar de queda de conexão. Sala é sempre
 * personalizada, então nunca entra no ranking (`ranked = false`).
 */
export class ColorRoom extends Room {
  maxClients = MAX_PLAYERS;
  protected engine!: ColorRoomEngine;
  protected engineOpts!: ConstructorParameters<typeof ColorRoomEngine>[0];
  private saved = false;
  /** Quem o servidor mandou sair (expulsão, saída pelo app) ou trocou de aparelho: não reconecta. */
  private dismissed = new Map<string, 'gone' | 'replace'>();
  /** Reconexões em espera por conta. Cancelar libera a vaga na hora (saída, expulsão, nova conexão). */
  private waiting = new Map<string, ReturnType<ColorRoom['allowReconnection']>>();

  async onCreate() {
    const code = await uniqueCode();
    this.roomId = code;
    this.engineOpts = {
      code,
      now: () => Date.now(),
      newSeed: () => randomUUID().slice(0, 12),
    };
    this.engine = this.makeEngine(this.engineOpts);

    this.onMessage('ready', (c, m: { ready?: boolean }) =>
      this.act(c, (id) => this.engine.setReady(id, !!m?.ready)),
    );
    this.onMessage('configure', (c, m) =>
      this.act(c, (id) => {
        this.beforeConfigure(id, m);
        this.engine.configure(id, m ?? {});
      }),
    );
    this.onMessage('kick', (c, m: { id?: string }) =>
      this.act(c, (id) => {
        const target = this.engine.kick(id, String(m?.id ?? ''));
        // Também vale para quem está sem conexão: a reserva dele cai e ele não volta sozinho.
        this.dropClient(target, 4001);
      }),
    );
    this.onMessage('start', (c) => this.act(c, (id) => this.engine.start(id)));
    this.registerGameMessages();
    this.onMessage('next', (c) => this.act(c, (id) => this.engine.next(id)));
    this.onMessage('vote', (c, m: { again?: boolean }) =>
      this.act(c, (id) => this.engine.voteRematch(id, !!m?.again)),
    );
    this.onMessage('invite', (c, m: { username?: string }) => void this.invite(c, m?.username));
    // Só o líder encerra: todo mundo é avisado e sai, e a sala deixa de existir.
    this.onMessage('close', (c) => {
      const id = (c.userData as AuthData | undefined)?.id;
      if (!id) return;
      if (!this.engine.isHost(id)) return c.send('error', 'Só o líder pode encerrar a sala');
      this.broadcast('closed');
      void this.disconnect();
    });
    // Sincronia de relógio: o aparelho mede o desvio para o relógio do servidor.
    this.onMessage('ping', (c, m: { t0?: number; rtt?: number }) => {
      const id = (c.userData as AuthData | undefined)?.id;
      if (id && typeof m?.rtt === 'number') this.onLatency(id, m.rtt);
      c.send('pong', { t0: m?.t0, ts: Date.now() });
    });
    this.onMessage('chat', (c, m: { text?: unknown }) => {
      const id = (c.userData as AuthData | undefined)?.id;
      if (!id) return;
      try {
        this.broadcast('chat', this.engine.sendChat(id, typeof m?.text === 'string' ? m.text : ''));
      } catch (e) {
        if (e instanceof RoomError) c.send('error', e.message);
        else throw e;
      }
    });
    this.onMessage('mute', (c, m: { id?: string }) =>
      this.act(c, (id) => void this.engine.muteMember(id, String(m?.id ?? ''))),
    );

    this.setSimulationInterval(() => {
      if (this.engine.tick()) this.publish();
    }, this.tickMs);
  }

  protected makeEngine(opts: ConstructorParameters<typeof ColorRoomEngine>[0]): ColorRoomEngine {
    return new ColorRoomEngine(opts);
  }

  /** De quanto em quanto tempo a sala avança por relógio (a Arena X1 pede mais fino). */
  protected tickMs = TICK_MS;

  /** O aparelho informou o tempo de ida e volta (usado só onde latência importa). */
  protected onLatency(_id: string, _rtt: number) {}

  /** Gancho antes de mudar as regras (o Ecooo troca de formato aqui). */
  protected beforeConfigure(_id: string, _m: { mode?: unknown } | undefined) {}

  /** Mensagens próprias do jogo (a Cor trava uma cor; o Tempo começa e para). */
  protected registerGameMessages() {
    this.onMessage('lock', (c, m) => this.act(c, (id) => this.engine.lock(id, m)));
  }

  /** Token da sessão (o mesmo do app) → conta. Sala exige conta: convidado não entra. */
  async onAuth(_client: Client, options: { token?: string }): Promise<AuthData> {
    const token = options?.token;
    if (!token || !roomDeps.auth)
      throw new ServerError(401, 'Entre na sua conta para jogar em sala');
    const session = await roomDeps.auth.api
      .getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) })
      .catch(() => null);
    const user = session?.user as { id: string; username?: string | null } | undefined;
    if (!user?.username) throw new ServerError(401, 'Sessão inválida. Entre de novo.');
    // Uma sala por vez: evita uma pessoa abrir salas em série (reconectar na mesma sala vale).
    const current = roomDeps.activeRooms.get(user.id);
    if (current && current !== this.roomId) {
      // O registro pode ter sobrado de uma sala que já acabou: só vale se a pessoa ainda está nela.
      if (isMemberOf(current, user.id)) {
        throw new ServerError(409, `Você já está na sala ${current}. Saia dela primeiro.`);
      }
      roomDeps.activeRooms.delete(user.id);
    }
    return { id: user.id, username: user.username };
  }

  onJoin(client: Client, _options: unknown, auth: AuthData) {
    try {
      // Mesma conta em outro aparelho: o aparelho antigo sai.
      for (const other of this.clients) {
        if (other !== client && other.userData?.id === auth.id) {
          this.dismissed.set(other.sessionId, 'replace');
          other.leave(4002);
        }
      }
      this.engine.join(auth.id, auth.username);
    } catch (e) {
      throw new ServerError(409, e instanceof RoomError ? e.message : 'Não foi possível entrar');
    }
    client.userData = { id: auth.id, username: auth.username };
    // Entrou de novo por uma conexão nova (link, código): a espera da conexão antiga não vale mais,
    // senão ela expiraria depois e tiraria da sala quem está jogando.
    this.cancelWaiting(auth.id);
    roomDeps.activeRooms.set(auth.id, this.roomId);
    roomDeps.invites?.consume(auth.id, this.roomId);
    this.publish();
    client.send('chatHistory', this.engine.chat.history());
  }

  async onLeave(client: Client, consented: boolean) {
    const user = client.userData as AuthData | undefined;
    if (!user) return;
    const why = this.dismissed.get(client.sessionId);
    this.dismissed.delete(client.sessionId);
    // Trocou de aparelho: a pessoa continua na sala pelo aparelho novo.
    if (why === 'replace') return;
    // Já foi tirada pelo servidor (`dropClient`): a vaga e o registro já foram liberados.
    if (why === 'gone') return;
    if (consented) {
      this.engine.leave(user.id);
      this.cancelWaiting(user.id);
      this.forget(user.id);
      return this.afterLeave();
    }
    this.engine.disconnect(user.id);
    this.publish();
    const wait = this.allowReconnection(client, this.graceSeconds());
    this.waiting.set(user.id, wait);
    try {
      const back = await wait;
      this.engine.join(user.id, user.username);
      back.send('chatHistory', this.engine.chat.history());
    } catch {
      // Só expulsa se a espera ainda era esta e a pessoa não voltou por outra conexão.
      const stale = this.waiting.get(user.id) === wait;
      if (stale && !this.isLive(user.id)) {
        this.engine.leave(user.id);
        this.forget(user.id);
      }
    } finally {
      if (this.waiting.get(user.id) === wait) this.waiting.delete(user.id);
    }
    this.afterLeave();
  }

  private graceSeconds() {
    const phase = this.engine.currentPhase;
    return phase === 'lobby' || phase === 'final' ? LOBBY_RECONNECT_SECONDS : RECONNECT_SECONDS;
  }

  private isLive(userId: string) {
    return this.clients.some((c) => (c.userData as AuthData | undefined)?.id === userId);
  }

  private cancelWaiting(userId: string) {
    const wait = this.waiting.get(userId);
    if (!wait) return;
    this.waiting.delete(userId);
    wait.reject(false);
  }

  /** A conta está nesta sala (conectada ou esperando para reconectar). */
  hasMember(userId: string) {
    return this.engine.has(userId);
  }

  /** O que o app mostra em "Você está na sala ...". */
  describeFor(userId: string) {
    return {
      code: this.roomId,
      game: this.engine.game,
      phase: this.engine.currentPhase,
      members: this.engine.memberCount,
      maxPlayers: this.engine.capacity,
      host: this.engine.hostName,
      connected: this.engine.isConnected(userId),
    };
  }

  /** Desliga as conexões da conta e cancela a espera de reconexão (expulsão ou saída pelo app). */
  private dropClient(userId: string | undefined, code: number) {
    if (!userId) return;
    this.cancelWaiting(userId);
    this.forget(userId);
    for (const c of this.clients) {
      if ((c.userData as AuthData | undefined)?.id !== userId) continue;
      this.dismissed.set(c.sessionId, 'gone');
      c.leave(code);
    }
  }

  /**
   * Tira a conta da sala agora, mesmo que a conexão tenha caído (a tela de quem saiu já fechou e a
   * conexão antiga ainda estaria "esperando voltar"). É o que o botão Sair garante pelo HTTP.
   */
  evict(userId: string): boolean {
    if (!this.engine.has(userId)) {
      this.forget(userId);
      return false;
    }
    this.engine.leave(userId);
    this.dropClient(userId, 4000);
    this.afterLeave();
    return true;
  }

  /** A pessoa saiu de vez: pode entrar em outra sala. */
  private forget(userId: string) {
    if (roomDeps.activeRooms.get(userId) === this.roomId) roomDeps.activeRooms.delete(userId);
  }

  private afterLeave() {
    if (this.engine.isEmpty) return void this.disconnect();
    this.publish();
  }

  onDispose() {
    // Sala encerrada: ninguém mais está nela.
    for (const [userId, roomId] of roomDeps.activeRooms) {
      if (roomId === this.roomId) roomDeps.activeRooms.delete(userId);
    }
    // nada a limpar: o estado só existe em memória
  }

  /** Roda uma ação de regra e devolve o erro (em pt-BR) só a quem pediu. */
  protected act(client: Client, run: (userId: string) => void) {
    const id = (client.userData as AuthData | undefined)?.id;
    if (!id) return;
    try {
      run(id);
      this.publish();
    } catch (e) {
      if (e instanceof RoomError) client.send('error', e.message);
      else throw e;
    }
  }

  /** Convida um amigo para esta sala. Só no lobby, e só quem já está na sala. */
  private async invite(client: Client, username?: string) {
    const me = client.userData as AuthData | undefined;
    try {
      if (!me || !roomDeps.invites) return;
      if (this.engine.currentPhase !== 'lobby') {
        throw new RoomError('Só dá para convidar no lobby');
      }
      const sent = await roomDeps.invites.send(
        me,
        String(username ?? ''),
        this.roomId,
        (id) => this.engine.has(id),
      );
      client.send('invited', { username: sent.username });
    } catch (e) {
      client.send('error', e instanceof Error ? e.message : 'Não foi possível convidar');
    }
  }

  private publish() {
    // A fase vai nos metadados da sala: é como o serviço de convites sabe se ela ainda está no lobby.
    void this.setMetadata({ phase: this.engine.currentPhase });
    // Cada pessoa recebe o próprio estado: no Intruso, papel, cor e dica são secretos.
    for (const client of this.clients) {
      client.send('snapshot', this.engine.snapshot((client.userData as AuthData | undefined)?.id));
    }
    if (this.engine.currentPhase === 'final' && !this.saved && this.engine.persistable) {
      this.saved = true;
      void this.saveResult();
    }
    if (this.engine.currentPhase === 'lobby') this.saved = false;
  }

  /** Resultado salvo como partida de sala (sem ranking). Falha não derruba a sala. */
  private async saveResult() {
    try {
      // O Intruso é a Cor: entra na aba da Mesmíssima do histórico, com o modo dele.
      const game = this.engine.game;
      await roomDeps.repo?.saveRoomMatch({
        game: game === 'impostor' || game === 'party' ? 'color' : game,
        mode: this.engine.historyMode,
        seed: this.engine.currentSeed,
        settings: this.engine.currentSettings,
        rows: this.engine.finalRows(),
      });
    } catch (e) {
      console.error('falha ao salvar a partida da sala', e);
    }
  }
}

/** Sala do Tempo: mesma estrutura, outra rodada (cada pessoa começa e para o seu relógio). */
export class TimeRoom extends ColorRoom {
  protected override makeEngine(opts: ConstructorParameters<typeof ColorRoomEngine>[0]) {
    return new TimeRoomEngine(opts);
  }

  protected override registerGameMessages() {
    const engine = () => this.engine as TimeRoomEngine;
    this.onMessage('begin', (c) => this.act(c, (id) => engine().begin(id)));
    this.onMessage('stop', (c) => this.act(c, (id) => engine().stop(id)));
  }
}

/** Sala do Intruso: a Cor com papéis secretos e votação (de 3 a 12 pessoas). */
export class ImpostorRoom extends ColorRoom {
  override maxClients = IMPOSTOR_MAX_PLAYERS;

  protected override makeEngine(opts: ConstructorParameters<typeof ColorRoomEngine>[0]) {
    return new ImpostorRoomEngine(opts);
  }

  protected override registerGameMessages() {
    const engine = () => this.engine as ImpostorRoomEngine;
    this.onMessage('lock', (c, m) => this.act(c, (id) => engine().lock(id, m)));
    this.onMessage('suspect', (c, m: { id?: string | null }) =>
      this.act(c, (id) => engine().vote(id, m?.id ? String(m.id) : null)),
    );
  }
}

/**
 * Sala do Ecooo. O host escolhe o formato no lobby: a Corrida (quatro modos) ou o Siga o Líder.
 * Cada formato é um motor; ao trocar, a sala leva as pessoas, o líder e o chat para o novo.
 */
export class EcoRoom extends ColorRoom {
  protected override makeEngine(opts: ConstructorParameters<typeof ColorRoomEngine>[0]) {
    return new EcoRoomEngine(opts);
  }

  protected override beforeConfigure(id: string, m: { mode?: unknown } | undefined) {
    if (typeof m?.mode !== 'string') return;
    const wantLeader = m.mode === 'leader';
    if (wantLeader === this.engine instanceof EcoLeaderRoomEngine) return;
    // Quem não é o líder ou fora do lobby: deixa o `configure` recusar com a mensagem certa.
    if (!this.engine.isHost(id) || this.engine.currentPhase !== 'lobby') return;
    const next = wantLeader
      ? new EcoLeaderRoomEngine(this.engineOpts)
      : new EcoRoomEngine(this.engineOpts);
    next.adoptFrom(this.engine);
    this.engine = next;
  }

  protected override registerGameMessages() {
    this.onMessage('tap', (c, m: { pad?: number }) =>
      this.act(c, (id) =>
        (this.engine as EcoRoomEngine | EcoLeaderRoomEngine).tap(id, Number(m?.pad)),
      ),
    );
    this.onMessage('submit', (c, m: { sequence?: unknown }) =>
      this.act(c, (id) => {
        if (this.engine instanceof EcoLeaderRoomEngine) this.engine.submit(id, m?.sequence);
      }),
    );
  }
}

/** Sala do NoCap!: micro-desafios e minijogos grandes, todos jogando ao mesmo tempo (spec 016). */
export class PartyRoom extends ColorRoom {
  /** Fino o bastante para o botão da Arena X1 aparecer na hora marcada. */
  protected override tickMs = 50;

  protected override onLatency(id: string, rtt: number) {
    (this.engine as PartyRoomEngine).setLatency(id, rtt);
  }

  protected override makeEngine(opts: ConstructorParameters<typeof ColorRoomEngine>[0]) {
    return new PartyRoomEngine(opts);
  }

  protected override registerGameMessages() {
    const engine = () => this.engine as PartyRoomEngine;
    this.onMessage('submit', (c, m: { color?: { h: number; s: number; b: number } }) =>
      this.act(c, (id) => engine().submitColor(id, m?.color as never)),
    );
    this.onMessage('tbegin', (c) => this.act(c, (id) => engine().timeBegin(id)));
    this.onMessage('tstop', (c) => this.act(c, (id) => engine().timeStop(id)));
    this.onMessage('etap', (c, m: { pad?: number }) =>
      this.act(c, (id) => engine().ecoTap(id, Number(m?.pad))),
    );
    this.onMessage('type', (c, m: { text?: string; touched?: boolean; submit?: boolean }) =>
      this.act(c, (id) => engine().typing(id, String(m?.text ?? ''), !!m?.touched, !!m?.submit)),
    );
    // Clique de forma: sem aviso a todos (muitos por segundo e nada muda na tela de ninguém).
    this.onMessage('sclick', (c, m: { id?: number }) => {
      const uid = (c.userData as { id?: string } | undefined)?.id;
      if (uid) engine().shapeClick(uid, Number(m?.id));
    });
    this.onMessage('xclick', (c) => this.act(c, (id) => engine().xClick(id)));
    this.onMessage('tready', (c) => this.act(c, (id) => engine().tutorialReady(id)));
    this.onMessage('begin', (c) => this.act(c, (id) => engine().begin(id)));
  }
}
