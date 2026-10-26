import { sendRoom, type RoomSnapshot } from '@/lib/rooms';

/** Os jogos que a sala do Fox Cap! pode jogar (spec 049). */
export const FOX_GAMES = [
  {
    id: 'bola',
    name: 'Fut Fox',
    note: 'Futebol de raposas com 2 a 4 times e bots.',
    cap: 'até 15',
  },
  {
    id: 'atravessa',
    name: 'Atravessa!',
    note: 'Atravesse estrada e rio, cada um com a sua cor.',
    cap: 'até 8',
  },
  {
    id: 'desmorona',
    name: 'Desmorona!',
    note: 'O chão some a cada passo; vence o último de pé.',
    cap: 'até 8',
  },
] as const;

/**
 * "Jogo da sala": só aparece na sala do Fox Cap!. O líder escolhe e troca; ao trocar, as regras e a tela do lobby
 * se adaptam ao jogo. Quem não é o líder só vê qual é.
 */
export function GamePicker({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const leader = snapshot.hostId === me;
  const none = snapshot.game === 'foxcap';
  return (
    <section className="lb-games" aria-label="Jogo da sala" data-testid="game-picker">
      <h3 className="lb-games-h mono">Jogo da sala</h3>
      {none && (
        <p className="mono lb-games-lead">
          {leader ? 'Escolha o jogo para começar.' : 'O líder ainda vai escolher o jogo.'}
        </p>
      )}
      <div className="lb-games-grid" role="radiogroup" aria-label="Jogo">
        {FOX_GAMES.map((g) => {
          const on = snapshot.game === g.id;
          return (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`lb-game${on ? ' is-on' : ''}`}
              disabled={!leader}
              data-sfx="select"
              data-testid={`pick-${g.id}`}
              onClick={() => !on && sendRoom('pickgame', { game: g.id })}
            >
              <b>{g.name}</b>
              <small>{g.note}</small>
              <span className="mono">{g.cap} pessoas</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
