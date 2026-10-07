import type { GameId } from '@/lib/stats';
import './game-tabs.css';

/** Barra de abas (mesmo visual das abas do jogo), com qualquer lista de abas. */
export function TabBar<T extends string>({
  game,
  label,
  tabs,
  value,
  onChange,
}: {
  game: GameId;
  label: string;
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className={`gt ${game}`}
      role="tablist"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          data-sfx="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
