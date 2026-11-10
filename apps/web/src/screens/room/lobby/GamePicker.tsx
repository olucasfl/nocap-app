import { sendRoom, type RoomSnapshot } from '@/lib/rooms';

interface PickGame {
  id: string;
  name: string;
  note: string;
  cap: string;
}

/** Os jogos que se pode jogar com amigos em uma sala, por categoria (spec 070). Toda sala troca entre eles. */
export const GAME_CATEGORIES: { id: string; title: string; games: PickGame[] }[] = [
  {
    id: 'reflexo',
    title: 'Reflexo e precisão',
    games: [
      {
        id: 'color',
        name: 'Mesmíssima',
        note: 'Recrie de memória a cor que apareceu e sumiu.',
        cap: 'até 12',
      },
      {
        id: 'time',
        name: 'Já Deu?',
        note: 'Conte o tempo de cabeça e pare na hora certa.',
        cap: 'até 12',
      },
      {
        id: 'eco',
        name: 'Ecooo',
        note: 'Repita a sequência de sons e luzes, ou siga o líder.',
        cap: 'até 12',
      },
    ],
  },
  {
    id: 'festa',
    title: 'Jogos de festa',
    games: [
      {
        id: 'impostor',
        name: 'Intruso',
        note: 'Alguns não veem a cor: ache quem é o intruso.',
        cap: '3 a 12',
      },
    ],
  },
  {
    id: 'foxcap',
    title: 'Fox Cap!',
    games: [
      {
        id: 'foxshot',
        name: 'Counter Fox',
        note: 'Mata-mata em primeira pessoa no mapa Duna, com bots.',
        cap: 'até 10',
      },
      {
        id: 'bola',
        name: 'Fut Fox',
        note: 'Futebol de raposas com 2 a 4 times e bots.',
        cap: 'até 15',
      },
      {
        id: 'pingpong',
        name: 'Ping Fox!',
        note: 'Pingue-pongue 1 contra 1: a raquete bate de verdade.',
        cap: 'até 8',
      },
      {
        id: 'foxgp',
        name: 'Fox GP',
        note: 'Corrida de F1 das raposas: classificação, 3 voltas, turbo e box.',
        cap: 'até 8',
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
    ],
  },
];

/** Compatibilidade: a lista plana de jogos. */
export const FOX_GAMES: readonly PickGame[] = GAME_CATEGORIES.flatMap((c) => c.games);

/**
 * "Jogo da sala": só aparece na sala do Fox Cap!. O líder escolhe e troca; ao trocar, as regras e a tela do lobby
 * se adaptam ao jogo. Quem não é o líder só vê qual é.
 */
export function GamePicker({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const leader = snapshot.hostId === me;
  const none = snapshot.game === 'foxcap';
  const current = FOX_GAMES.find((g) => g.id === snapshot.game);
  return (
    <section className="lb-games" aria-label="Jogo da sala" data-testid="game-picker">
      {current ? (
        <>
          <h3 className="lb-games-h mono">Jogo selecionado</h3>
          <div className="lb-game is-on lb-game-now" data-testid="game-current">
            <b>{current.name}</b>
            <small>{current.note}</small>
            <span className="mono">{current.cap} pessoas</span>
          </div>
        </>
      ) : (
        <h3 className="lb-games-h mono">Jogos</h3>
      )}
      {none && (
        <p className="mono lb-games-lead">
          {leader ? 'Escolha o jogo para começar.' : 'O líder ainda vai escolher o jogo.'}
        </p>
      )}
      {GAME_CATEGORIES.map((cat) => {
        const list = cat.games.filter((g) => g.id !== snapshot.game);
        if (list.length === 0) return null;
        return (
          <div className="lb-games-cat" key={cat.id} data-testid={`cat-${cat.id}`}>
            <h3 className="lb-games-h mono lb-games-cat-h">{cat.title}</h3>
            <div className="lb-games-grid" role="radiogroup" aria-label={cat.title}>
              {list.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={false}
                  className="lb-game"
                  disabled={!leader}
                  data-sfx="select"
                  data-testid={`pick-${g.id}`}
                  onClick={() => sendRoom('pickgame', { game: g.id })}
                >
                  <b>{g.name}</b>
                  <small>{g.note}</small>
                  <span className="mono">{g.cap} pessoas</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
