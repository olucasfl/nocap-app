import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { colorPresets } from '@nocap/games';
import { BackButton } from '@/components/BackButton';
import { DailyCard } from '@/components/DailyCard';
import { FriendsPanel } from '@/components/FriendsPanel';
import { GameTabs, type GameTab } from '@/components/GameTabs';
import { ArrowRight } from '@/components/icons';
import { PlayGate } from '@/components/PlayGate';
import { RankingPanel } from '@/components/RankingPanel';
import { useAuth } from '@/lib/auth';
import type { Board } from '@/lib/ranking';
import { fetchStats } from '@/lib/stats';
import type { Mode } from '../types';

/** Modos de partida solo. O Daily é um cartão à parte, dentro do jogo. */
const MODES: { id: Exclude<Mode, 'daily'>; label: string }[] = [
  { id: 'classic', label: 'Clássico' },
  { id: 'flash', label: 'Flash' },
  { id: 'quick', label: 'Rápido' },
];

const LEAD: Record<Exclude<Mode, 'daily'>, string> = {
  classic:
    'Uma cor aparece por 3 segundos. Depois some. Recrie de memória nos controles e veja o quanto você chegou perto.',
  flash: 'A cor pisca por menos de meio segundo. Sem tempo pra pensar: confie no olho.',
  quick: 'Só uma rodada, com 3 segundos pra decorar. Ideal pra jogar em 30 segundos.',
};

const seconds = (ms: number) => `${ms / 1000}s`.replace('.', ',');

interface Props {
  mode: Mode;
  initialTab?: GameTab;
  initialBoard?: Board;
  onMode: (m: Mode) => void;
  onStart: (m: Mode) => void;
}

export function StartScreen({ mode, initialTab = 'modes', initialBoard, onMode, onStart }: Props) {
  const user = useAuth((s) => s.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const daily = stats.data?.daily.color;
  const [tab, setTab] = useState<GameTab>(initialTab);
  const [board, setBoard] = useState<Board | undefined>(initialBoard);
  const shown = mode === 'daily' ? 'classic' : mode;
  const preset = colorPresets[shown]!;

  return (
    <section className="screen">
      <BackButton to="/" label="Jogos" />
      <h1>Cor</h1>
      <GameTabs game="color" tab={tab} onTab={setTab} />
      {tab === 'modes' && (
        <>
          <div className="cg-seg" role="radiogroup" aria-label="Modo de jogo">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={shown === m.id}
                onClick={() => onMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="lead">{LEAD[shown]}</p>
          <div className="cg-rules">
            <div className="cg-rule">
              <b>{preset.rounds}</b>
              {preset.rounds === 1 ? 'rodada' : 'rodadas'}
            </div>
            <div className="cg-rule">
              <b>{seconds(preset.showMs)}</b>pra decorar
            </div>
            <div className="cg-rule">
              <b>{preset.rounds * 10}</b>pontos max
            </div>
          </div>
          <div className="stack">
            <PlayGate>
              <button type="button" className="btn" onClick={() => onStart(shown)}>
                Jogar <ArrowRight />
              </button>
            </PlayGate>
          </div>
          <DailyCard
            game="color"
            info={daily}
            onPlay={() => onStart('daily')}
            onRanking={() => {
              setBoard('daily');
              setTab('ranking');
            }}
          />
        </>
      )}
      {tab === 'friends' && <FriendsPanel game="color" />}
      {tab === 'ranking' && <RankingPanel game="color" initialBoard={board} />}
    </section>
  );
}
