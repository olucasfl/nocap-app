import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { colorPresets } from '@nocap/games';
import { BackButton } from '@/components/BackButton';
import { DailyCard } from '@/components/DailyCard';
import { FriendsPanel } from '@/components/FriendsPanel';
import { ModePicker } from '@/components/ModePicker';
import { GameTabs, type GameTab } from '@/components/GameTabs';
import { ArrowRight } from '@/components/icons';
import { PlayGate } from '@/components/PlayGate';
import { PullToRefresh } from '@/components/PullToRefresh';
import { RankingPanel } from '@/components/RankingPanel';
import { useAuth } from '@/lib/auth';
import type { Board } from '@/lib/ranking';
import { fetchStats } from '@/lib/stats';
import type { Mode } from '../types';

/** Modos de partida solo. O Daily é um cartão à parte, dentro do jogo. */
const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: 'classic', label: 'Clássico', desc: '5 RODADAS · 3 S' },
  { id: 'flash', label: 'Flash', desc: '5 RODADAS · 0,4 S' },
  { id: 'quick', label: 'Rápido', desc: '1 RODADA' },
  { id: 'daily', label: 'Daily', desc: '1 POR DIA · RANKING' },
];

const LEAD: Record<Mode, string> = {
  classic:
    'Uma cor aparece por 3 segundos. Depois some. Recrie de memória nos controles e veja o quanto você chegou perto.',
  flash: 'A cor pisca por menos de meio segundo. Sem tempo pra pensar: confie no olho.',
  quick: 'Só uma rodada, com 3 segundos pra decorar. Ideal pra jogar em 30 segundos.',
  daily: 'A cor de hoje é a mesma para todo mundo. Mesmas 5 cores, uma única chance por dia.',
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
  const shown = mode;
  const preset = colorPresets[shown === 'daily' ? 'classic' : shown]!;

  return (
    <section className="screen">
      <PullToRefresh />
      <BackButton to="/" label="Jogos" />
      <h1>Cor</h1>
      <GameTabs game="color" tab={tab} onTab={setTab} />
      {tab === 'modes' && (
        <>
          <ModePicker
            game="color"
            modes={MODES}
            value={mode}
            onChange={(id) => onMode(id as Mode)}
          />
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
          {shown !== 'daily' && (
            <div className="stack">
              <PlayGate>
                <button type="button" className="btn" onClick={() => onStart(shown)}>
                  Jogar <ArrowRight />
                </button>
              </PlayGate>
            </div>
          )}
          {shown === 'daily' && (
            <DailyCard
              game="color"
              info={daily}
              onPlay={() => onStart('daily')}
              onRanking={() => {
                setBoard('daily');
                setTab('ranking');
              }}
            />
          )}
        </>
      )}
      {tab === 'friends' && <FriendsPanel game="color" />}
      {tab === 'ranking' && <RankingPanel game="color" initialBoard={board} />}
    </section>
  );
}
