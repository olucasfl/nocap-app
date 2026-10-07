import { randomInt, randomUUID } from 'node:crypto';
import { Room, ServerError, matchMaker, type Client } from 'colyseus';
import type { Auth } from '../auth/auth';
import { ColorRoomEngine, MAX_PLAYERS, RoomError } from './color-room.engine';
import { TimeRoomEngine } from './time-room.engine';
import { ImpostorRoomEngine } from './impostor/impostor-room.engine';
import { IMPOSTOR_MAX_PLAYERS } from '@nocap/games';
import type { InvitesService } from './invites.service';
import type { RoomsRepository } from './rooms.repository';

/** Sem I, O, 0 e 1: letras que se confundem ao ditar o código. */
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const TICK_MS = 250;
/** Quanto tempo alguém com a tela bloqueada tem para voltar. */
const RECONNECT_SECONDS = 60;

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

/**
 * Sala da Cor. As regras vivem em `ColorRoomEngine`; aqui só há rede: autenticar, repassar
 * mensagens, mandar o estado a todos e cuidar de queda de conexão. Sala é sempre
 * personalizada, então nunca entra no ranking (`ranked = false`).
 */
export class ColorRoom extends Room {
  maxClients = MAX_PLAYERS;
  protected engine!: ColorRoomEngine;
  private saved = false;
  /** Quem o servidor mandou sair (expulsão) ou trocou de aparelho: não pode reconectar. */
  private dismissed = new Map<string, 'kick' | 'replace'>();

  async onCreate() {
    const code = await uniqueCode();
    this.roomId = code;
    this.engine = this.makeEngine({
      code,
      now: () => Date.now(),
      newSeed: () => randomUUID().slice(0, 12),
    });

    this.onMessage('ready', (c, m: { ready?: boolean }) =>
      this.act(c, (id) => this.engine.setReady(id, !!m?.ready)),
    );
    this.onMessage('configure', (c, m) => this.act(c, (id) => this.engine.configure(id, m ?? {})));
    this.onMessage('kick', (c, m: { id?: string }) =>
      this.act(c, (id) => {
        const target = this.engine.kick(id, String(m?.id ?? ''));
        const gone = this.clients.find((x) => x.userData?.id === target);
        if (gone) {
          this.dismissed.set(gone.sessionId, 'kick');
          gone.leave(4001);
        }
      }),
    );
    this.onMessage('start', (c) => this.act(c, (id) => this.engine.start(id)));
    this.registerGameMessages();
    this.onMessage('next', (c) => this.act(c, (id) => this.engine.next(id)));
    this.onMessage('vote', (c, m: { again?: boolean }) =>
      this.act(c, (id) => this.engine.voteRematch(id, !!m?.again)),
    );
    this.onMessage('invite', (c, m: { username?: string }) => void this.invite(c, m?.username));

    this.setSimulationInterval(() => {
      if (this.engine.tick()) this.publish();
    }, TICK_MS);
  }

  protected makeEngine(opts: ConstructorParameters<typeof ColorRoomEngine>[0]): ColorRoomEngine {
    return new ColorRoomEngine(opts);
  }

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
      throw new ServerError(409, 'Você já está em outra sala. Saia dela primeiro.');
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
    roomDeps.activeRooms.set(auth.id, this.roomId);
    roomDeps.invites?.consume(auth.id, this.roomId);
    this.publish();
  }

  async onLeave(client: Client, consented: boolean) {
    const user = client.userData as AuthData | undefined;
    if (!user) return;
    const why = this.dismissed.get(client.sessionId);
    this.dismissed.delete(client.sessionId);
    // Trocou de aparelho: a pessoa continua na sala pelo aparelho novo.
    if (why === 'replace') return;
    if (consented || why === 'kick') {
      this.engine.leave(user.id);
      this.forget(user.id);
      return this.afterLeave();
    }
    this.engine.disconnect(user.id);
    this.publish();
    try {
      await this.allowReconnection(client, RECONNECT_SECONDS);
      this.engine.join(user.id, user.username);
    } catch {
      this.engine.leave(user.id);
      this.forget(user.id);
    }
    this.afterLeave();
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
      const sent = await roomDeps.invites.send(me, String(username ?? ''), this.roomId);
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
      await roomDeps.repo?.saveRoomMatch({
        game: this.engine.game as 'color' | 'time',
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

/** Sala do Intruso: a Cor com papéis secretos e votação (de 3 a 8 pessoas). */
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
