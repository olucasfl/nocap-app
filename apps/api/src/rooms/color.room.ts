import { randomInt, randomUUID } from 'node:crypto';
import { Room, ServerError, matchMaker, type Client } from 'colyseus';
import type { Auth } from '../auth/auth';
import { ColorRoomEngine, MAX_PLAYERS, RoomError } from './color-room.engine';
import type { RoomsRepository } from './rooms.repository';

/** Sem I, O, 0 e 1: letras que se confundem ao ditar o código. */
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const TICK_MS = 250;
/** Quanto tempo alguém com a tela bloqueada tem para voltar. */
const RECONNECT_SECONDS = 60;

/** Dependências que o Nest injeta na inicialização (o Colyseus instancia a sala sozinho). */
export const roomDeps: { auth: Auth | null; repo: RoomsRepository | null } = {
  auth: null,
  repo: null,
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
  private engine!: ColorRoomEngine;
  private saved = false;
  /** Quem o servidor mandou sair (expulsão) ou trocou de aparelho: não pode reconectar. */
  private dismissed = new Map<string, 'kick' | 'replace'>();

  async onCreate() {
    const code = await uniqueCode();
    this.roomId = code;
    this.engine = new ColorRoomEngine({
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
    this.onMessage('lock', (c, m) => this.act(c, (id) => this.engine.lock(id, m)));
    this.onMessage('next', (c) => this.act(c, (id) => this.engine.next(id)));
    this.onMessage('rematch', (c) => this.act(c, (id) => this.engine.rematch(id)));

    this.setSimulationInterval(() => {
      if (this.engine.tick()) this.publish();
    }, TICK_MS);
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
      return this.afterLeave();
    }
    this.engine.disconnect(user.id);
    this.publish();
    try {
      await this.allowReconnection(client, RECONNECT_SECONDS);
      this.engine.join(user.id, user.username);
    } catch {
      this.engine.leave(user.id);
    }
    this.afterLeave();
  }

  private afterLeave() {
    if (this.engine.isEmpty) return void this.disconnect();
    this.publish();
  }

  onDispose() {
    // nada a limpar: o estado só existe em memória
  }

  /** Roda uma ação de regra e devolve o erro (em pt-BR) só a quem pediu. */
  private act(client: Client, run: (userId: string) => void) {
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

  private publish() {
    this.broadcast('snapshot', this.engine.snapshot());
    if (this.engine.currentPhase === 'final' && !this.saved) {
      this.saved = true;
      void this.saveResult();
    }
    if (this.engine.currentPhase === 'lobby') this.saved = false;
  }

  /** Resultado salvo como partida de sala (sem ranking). Falha não derruba a sala. */
  private async saveResult() {
    try {
      await roomDeps.repo?.saveRoomMatch({
        seed: this.engine.currentSeed,
        settings: this.engine.currentSettings,
        rows: this.engine.finalRows(),
      });
    } catch (e) {
      console.error('falha ao salvar a partida da sala', e);
    }
  }
}
