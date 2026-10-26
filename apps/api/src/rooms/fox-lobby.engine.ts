import { BOL_ROOM_MAX } from '@nocap/games';
import { ColorRoomEngine, RoomError, type EngineOptions } from './color-room.engine';

/**
 * O lobby da sala do Fox Cap! antes de haver um jogo (spec 049): só reúne a galera. Quem decide o jogo é o líder
 * (`FoxRoom.pickGame`), que troca este motor pelo do jogo escolhido levando as pessoas e o chat.
 */
export class FoxLobbyEngine extends ColorRoomEngine {
  override readonly game = 'foxcap' as const;
  override readonly persistable = false;
  protected override readonly minPlayers = 1;
  protected override readonly modes: readonly string[] = ['lobby'];

  constructor(opts: EngineOptions) {
    super({ ...opts, maxPlayers: BOL_ROOM_MAX });
    this.mode = 'lobby';
  }

  protected override validSettings(): boolean {
    return false;
  }

  override start(_id: string): void {
    throw new RoomError('Escolha um jogo antes de começar');
  }
}
