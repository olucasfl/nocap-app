import { randomInt, randomUUID } from 'node:crypto';
import { Room, ServerError, matchMaker, type Client } from 'colyseus';
import type { Auth } from '../auth/auth';
import { ColorRoomEngine, MAX_PLAYERS, RoomError } from './color-room.engine';
import { TimeRoomEngine } from './time-room.engine';
import { ImpostorRoomEngine } from './impostor/impostor-room.engine';
import { EcoRoomEngine } from './eco-room.engine';
import { EcoLeaderRoomEngine } from './eco-leader-room.engine';
import { AtravessaRoomEngine } from './atravessa-room.engine';
import { BolaRoomEngine } from './bola-room.engine';
import { FoxLobbyEngine } from './fox-lobby.engine';
import { DesmoronaRoomEngine } from './desmorona-room.engine';
import {
  ATR_ROOM_MAX_PLAYERS,
  BOL_ROOM_MAX,
  DSM_MAX_PLAYERS,
  IMPOSTOR_MAX_PLAYERS,
} from '@nocap/games';
import {
  GUEST_PREFIX,
  cleanNickname,
  createGuestLimiter,
  isGuestId,
  usernameLookalikes,
} from './guest-nick';
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
  /** Entrou sem conta (só apelido). */
  guest?: boolean;
}

type GuestRequest = {
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

/** Quantas entradas de convidado por origem a cada minuto. */
export const guestLimit = createGuestLimiter(10, 60_000);

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

    this.setSimulationInterval(() => this.step(), this.tickMs);
  }

  /** Um passo da sala: avança o motor, publica o estado se mudou e deixa o jogo transmitir o que é dele. */
  protected step() {
    if (this.engine.tick()) this.publish();
    this.afterTick();
  }

  protected makeEngine(opts: ConstructorParameters<typeof ColorRoomEngine>[0]): ColorRoomEngine {
    return new ColorRoomEngine(opts);
  }

  /** De quanto em quanto tempo a sala avança por relógio (a Arena X1 pede mais fino). */
  protected tickMs = TICK_MS;

  /** Depois de cada passo da sala (o Atravessa! transmite as posições aqui). */
  protected afterTick() {}

  /** O aparelho informou o tempo de ida e volta (usado só onde latência importa). */
  protected onLatency(_id: string, _rtt: number) {}

  /** Gancho antes de mudar as regras (o Ecooo troca de formato aqui). */
  protected beforeConfigure(_id: string, _m: { mode?: unknown } | undefined) {}

  /** Mensagens próprias do jogo (a Cor trava uma cor; o Tempo começa e para). */
  protected registerGameMessages() {
    this.onMessage('lock', (c, m) => this.act(c, (id) => this.engine.lock(id, m)));
  }

  /** Token da sessão (o mesmo do app) → conta. Sala exige conta: convidado não entra. */
  async onAuth(
    _client: Client,
    options: { token?: string; guest?: boolean; nickname?: unknown },
    request?: GuestRequest,
  ): Promise<AuthData> {
    if (options?.guest === true) return this.authGuest(options.nickname, request);
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

  /**
   * Sem conta: o servidor cria uma identidade só desta entrada (a pessoa não escolhe o id) e o
   * apelido vale só nesta sala. Não pode repetir um nome da sala nem imitar o @ de uma conta.
   */
  private async authGuest(nickname: unknown, request?: GuestRequest): Promise<AuthData> {
    const fwd = request?.headers?.['x-forwarded-for'];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
    const origin = first || request?.socket?.remoteAddress || 'local';
    if (!guestLimit(origin))
      throw new ServerError(429, 'Muitas tentativas. Espere um pouco e tente de novo.');
    const checked = cleanNickname(nickname);
    if (!checked.ok) throw new ServerError(400, checked.error);
    if (this.engine.hasName(checked.nick)) {
      throw new ServerError(409, 'Esse apelido já está na sala. Escolha outro.');
    }
    if (await roomDeps.repo?.usernameTaken(usernameLookalikes(checked.nick))) {
      throw new ServerError(409, 'Esse apelido é de uma conta. Escolha outro.');
    }
    return { id: GUEST_PREFIX + randomUUID(), username: checked.nick, guest: true };
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
    client.userData = { id: auth.id, username: auth.username, guest: auth.guest };
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
      if (me?.guest) throw new RoomError('Crie uma conta para convidar amigos.');
      if (!me || !roomDeps.invites) return;
      if (this.engine.currentPhase !== 'lobby') {
        throw new RoomError('Só dá para convidar no lobby');
      }
      const sent = await roomDeps.invites.send(me, String(username ?? ''), this.roomId, (id) =>
        this.engine.has(id),
      );
      client.send('invited', { username: sent.username });
    } catch (e) {
      client.send('error', e instanceof Error ? e.message : 'Não foi possível convidar');
    }
  }

  protected publish() {
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
        game:
          game === 'impostor' ||
          game === 'atravessa' ||
          game === 'desmorona' ||
          game === 'bola' ||
          game === 'foxcap'
            ? 'color'
            : game,
        mode: this.engine.historyMode,
        seed: this.engine.currentSeed,
        settings: this.engine.currentSettings,
        // Quem jogou sem conta não tem histórico: só as contas ficam registradas.
        rows: this.engine.finalRows().filter((r) => !isGuestId(r.userId)),
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

/**
 * Sala do Atravessa! (spec 031): todo mundo no mesmo mapa. Cada aparelho simula o seu herói e manda
 * "run" (o tick e os passos); a sala responde "ack" e transmite "pos" 10 vezes por segundo com a
 * posição de todos, que vem do espelho do servidor.
 */
export class AtravessaRoom extends ColorRoom {
  override maxClients = ATR_ROOM_MAX_PLAYERS;
  protected override tickMs = 100;

  protected override makeEngine(opts: ConstructorParameters<typeof ColorRoomEngine>[0]) {
    return new AtravessaRoomEngine(opts);
  }

  protected override registerGameMessages() {
    const engine = () => this.engine as AtravessaRoomEngine;
    this.onMessage('color', (c, m: { hex?: string }) =>
      this.act(c, (id) => engine().setColor(id, String(m?.hex ?? ''))),
    );
    this.onMessage('uncolor', (c) => this.act(c, (id) => engine().clearColor(id)));
    this.onMessage('endround', (c) => this.act(c, (id) => engine().endRound(id)));
    // Chega 10 vezes por segundo por pessoa: nada de estado a todos, só a confirmação a quem mandou.
    this.onMessage('run', (c, m: { t?: unknown; i?: unknown; n?: unknown }) => {
      const id = (c.userData as AuthData | undefined)?.id;
      if (!id) return;
      const accepted = engine().report(id, m?.t, m?.i, m?.n);
      if (accepted !== null) c.send('ack', { n: accepted });
    });
  }

  protected override afterTick() {
    const engine = this.engine as AtravessaRoomEngine;
    if (engine.currentPhase === 'play') this.broadcast('pos', engine.positions());
  }
}

/**
 * Sala do Desmorona! (spec 044, fase 2). Cada aparelho simula a sua raposa e manda "dpos" (posição) e "dstep"
 * (pisei neste ladrilho); a sala transmite "pos" 10 vezes por segundo e "dstep" na hora, com a hora oficial.
 */
export class DesmoronaRoom extends ColorRoom {
  override maxClients = DSM_MAX_PLAYERS;
  protected override tickMs = 100;

  protected override makeEngine(opts: ConstructorParameters<typeof ColorRoomEngine>[0]) {
    return new DesmoronaRoomEngine(opts);
  }

  protected override registerGameMessages() {
    const engine = () => this.engine as DesmoronaRoomEngine;
    const idOf = (c: Client) => (c.userData as AuthData | undefined)?.id;
    this.onMessage('dpos', (c, m) => {
      const id = idOf(c);
      if (id) engine().report(id, m);
    });
    this.onMessage('dstep', (c, m) => {
      const id = idOf(c);
      if (id) engine().step(id, m);
    });
    this.onMessage('dpush', (c, m) => {
      const id = idOf(c);
      if (id) engine().push(id, m);
    });
    this.onMessage('color', (c, m: { hex?: string }) =>
      this.act(c, (id) => engine().setColor(id, String(m?.hex ?? ''))),
    );
    this.onMessage('uncolor', (c) => this.act(c, (id) => engine().clearColor(id)));
    this.onMessage('ddead', (c) => {
      const id = idOf(c);
      if (id) engine().die(id);
    });
    // quem entra (ou volta) no meio da partida pede os ladrilhos que já foram pisados
    this.onMessage('dsync', (c) => c.send('dsteps', engine().allSteps()));
  }

  protected override afterTick() {
    const engine = this.engine as DesmoronaRoomEngine;
    if (engine.currentPhase !== 'play') return;
    this.broadcast('pos', engine.positions());
    const steps = engine.drainSteps();
    if (steps.length > 0) this.broadcast('dsteps', steps);
    for (const p of engine.drainPushes()) {
      const target = this.clients.find((c) => (c.userData as AuthData | undefined)?.id === p.to);
      target?.send('dpushed', { from: p.from, kx: p.kx, kz: p.kz });
    }
  }
}

/**
 * Sala do Fut Fox (spec 046, fase 2). O servidor simula tudo; os aparelhos mandam só a entrada ("bin") e recebem o
 * estado ("bs") a cada tick. Times, formato e bots no lobby: "bteam", "bformat", "bbots"; "bend" encerra a partida.
 */
export class BolaRoom extends ColorRoom {
  override maxClients = BOL_ROOM_MAX;
  /** 60 passos por segundo, um estado enviado por passo: a entrada vira movimento em no máximo 16 ms. */
  protected override tickMs = 16;

  protected override makeEngine(opts: ConstructorParameters<typeof ColorRoomEngine>[0]) {
    const engine = new BolaRoomEngine(opts);
    engine.p2pEnabled = true;
    return engine;
  }

  protected override registerGameMessages() {
    const engine = () => this.engine as BolaRoomEngine;
    const idOf = (c: Client) => (c.userData as AuthData | undefined)?.id;
    this.onMessage('bin', (c, m) => {
      const id = idOf(c);
      if (id) engine().input(id, m);
    });
    this.onMessage('bteam', (c, m: { team?: unknown; bot?: unknown }) =>
      this.act(c, (id) => engine().setTeam(id, m?.team, m?.bot)),
    );
    this.onMessage('bformat', (c, m) => this.act(c, (id) => engine().setFormat(id, m ?? {})));
    this.onMessage('bbots', (c, m: { team?: unknown; delta?: unknown }) =>
      this.act(c, (id) => engine().setBots(id, m?.team, m?.delta)),
    );
    this.onMessage('bend', (c) => this.act(c, (id) => engine().endNow(id)));
    // partida ponto a ponto (spec 048): o servidor só repassa a sinalização WebRTC e recebe o resultado
    this.onMessage('bp2p', (c, m: { ok?: unknown }) => {
      const id = idOf(c);
      if (id) engine().p2pReport(id, m?.ok);
    });
    this.onMessage('bres', (c, m: { scores?: unknown; winner?: unknown }) => {
      const id = idOf(c);
      if (id) engine().p2pResult(id, m ?? {});
    });
    this.onMessage('rtc', (c, m: { to?: unknown; data?: unknown }) => {
      const from = idOf(c);
      if (!from || typeof m?.to !== 'string' || typeof m.data !== 'object' || m.data === null)
        return;
      if (JSON.stringify(m.data).length > 12_000) return;
      const target = this.clients.find((x) => idOf(x) === m.to);
      target?.send('rtc', { from, data: m.data });
    });
  }

  protected override afterTick() {
    const frame = (this.engine as BolaRoomEngine).drainFrame();
    if (frame) this.broadcast('bs', frame);
  }
}

/** Nomes e limites dos jogos que a sala do Fox Cap! pode jogar. */
const FOX_GAMES = {
  atravessa: { name: 'Atravessa!', make: (o: EngineOpts) => new AtravessaRoomEngine(o) },
  desmorona: { name: 'Desmorona!', make: (o: EngineOpts) => new DesmoronaRoomEngine(o) },
  bola: {
    name: 'Fut Fox',
    make: (o: EngineOpts) => {
      const e = new BolaRoomEngine(o);
      e.p2pEnabled = true;
      return e;
    },
  },
} as const;
type EngineOpts = ConstructorParameters<typeof ColorRoomEngine>[0];
type FoxGame = keyof typeof FOX_GAMES;

/**
 * Sala do Fox Cap! (spec 049): nasce sem jogo; o líder escolhe (e pode trocar) entre Atravessa!, Desmorona! e Fut Fox
 * no lobby. Trocar de jogo é trocar o motor da sala (como o Ecooo faz entre Corrida e Siga o Líder): as pessoas, o
 * líder e o chat vão junto. As mensagens de cada jogo valem só enquanto o motor é daquele jogo.
 */
export class FoxRoom extends ColorRoom {
  override maxClients = BOL_ROOM_MAX;
  /** O passo mais fino (Fut Fox); os jogos de 10 passos por segundo rodam a cada ~100 ms por dentro de `step`. */
  protected override tickMs = 16;
  private handlers = new Map<string, Map<string, (c: Client, m: unknown) => void>>();
  private lastStep = 0;

  protected override makeEngine(opts: EngineOpts) {
    const e = new FoxLobbyEngine(opts);
    e.flex = true;
    return e;
  }

  protected override registerGameMessages() {
    // Cada jogo registra as suas mensagens como se a sala fosse dele (por um "sósia" que repassa tudo à sala). Aqui cada
    // tipo vira um só despachante que olha de quem é o motor de agora (o Atravessa! e o Desmorona! usam o mesmo "color").
    for (const [game, room] of [
      ['atravessa', AtravessaRoom],
      ['desmorona', DesmoronaRoom],
      ['bola', BolaRoom],
    ] as const) {
      const twin = Object.create(this) as { onMessage: unknown };
      twin.onMessage = (type: string | number, cb: (c: Client, m: unknown) => void) => {
        const key = String(type);
        let per = this.handlers.get(key);
        if (!per) {
          const table = new Map<string, (c: Client, m: unknown) => void>();
          per = table;
          this.handlers.set(key, table);
          this.onMessage(type, (c: Client, m: unknown) => table.get(this.engine.game)?.(c, m));
        }
        per.set(game, cb);
      };
      (room.prototype as unknown as { registerGameMessages(): void }).registerGameMessages.call(
        twin,
      );
    }
    this.onMessage('pickgame', (c: Client, m: { game?: unknown }) =>
      this.act(c, (id) => this.pickGame(id, m?.game)),
    );
  }

  /** O líder escolhe ou troca o jogo da sala (só no lobby). */
  private pickGame(id: string, game: unknown) {
    if (!this.engine.isHost(id)) throw new RoomError('Só o líder escolhe o jogo');
    if (this.engine.currentPhase !== 'lobby')
      throw new RoomError('Agora não dá para trocar o jogo');
    if (typeof game !== 'string' || !(game in FOX_GAMES)) throw new RoomError('Jogo inválido');
    const g = game as FoxGame;
    if (this.engine.game === g) return;
    const next = FOX_GAMES[g].make(this.engineOpts);
    if (this.engine.memberCount > next.capacity) {
      throw new RoomError(
        `${FOX_GAMES[g].name} aceita até ${next.capacity} pessoas e a sala tem ${this.engine.memberCount}`,
      );
    }
    next.adoptFrom(this.engine);
    this.engine = next;
    this.publish();
  }

  protected override step() {
    const now = Date.now();
    // o Fut Fox roda a cada passo de 16 ms; os outros jogos, a cada 100 ms (como as salas deles)
    if (this.engine.game !== 'bola' && now - this.lastStep < 92) return;
    this.lastStep = now;
    super.step();
  }

  protected override afterTick() {
    const proto = { atravessa: AtravessaRoom, desmorona: DesmoronaRoom, bola: BolaRoom }[
      this.engine.game as FoxGame
    ]?.prototype as unknown as { afterTick?: () => void } | undefined;
    proto?.afterTick?.call(this);
  }
}
