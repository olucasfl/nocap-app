import type { GameId } from '@/lib/stats';
import './game-tabs.css';

export type GameTab = 'modes' | 'friends' | 'ranking';

const TABS: { id: GameTab; label: string }[] = [
  { id: 'modes', label: 'Modos de partida' },
  { id: 'friends', label: 'Jogar com amigos' },
  { id: 'ranking', label: 'Ranking' },
];

/** As três seções de cada jogo: modos (inclui o Daily), amigos (salas) e ranking. */
export function GameTabs({
  game,
  tab,
  onTab,
}: {
  game: GameId;
  tab: GameTab;
  onTab: (t: GameTab) => void;
}) {
  return (
    <div className={`gt ${game}`} role="tablist" aria-label="Seções do jogo">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          data-sfx="tab"
          aria-selected={tab === t.id}
          onClick={() => onTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
