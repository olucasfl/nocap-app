import type { GameId } from '@/lib/stats';
import './game-tabs.css';

/** 'ranking' só existe como destino do botão "Ver ranking" (a página de Ranking é própria). */
export type GameTab = 'modes' | 'friends' | 'ranking';

type Section = Exclude<GameTab, 'ranking'>;

const TABS: { id: Section; label: string }[] = [
  { id: 'modes', label: 'Modos de partida' },
  { id: 'friends', label: 'Jogar com amigos' },
];

/** As duas seções de cada jogo: modos (inclui o Daily) e amigos (salas). O ranking tem página própria. */
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
