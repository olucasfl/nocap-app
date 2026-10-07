import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { timePresets } from '@nocap/games';
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
  { id: 'classic', label: 'Clássico', desc: '3 RODADAS' },
  { id: 'quick', label: 'Rápido', desc: '1 RODADA' },
  { id: 'strict', label: 'Sem estourar', desc: 'PASSOU, ZERO' },
  { id: 'daily', label: 'Daily', desc: '1 POR DIA · RANKING' },
];

const LEAD: Record<Mode, string> = {
  classic:
    'Você vê um tempo alvo. Toque em COMEÇAR, depois em COMEÇAR A CONTAR, conte de cabeça e toque de novo para parar. Alternamos alvos curtos (menos de 10 s) e longos.',
  quick: 'Uma rodada só, quase sempre curta. Conte o tempo de cabeça e veja o quanto chegou perto.',
  strict: 'Passou do alvo, a rodada vale zero. Melhor parar um pouco antes do que estourar.',
  daily: 'Os alvos de hoje são os mesmos para todo mundo. Três rodadas, uma única chance por dia.',
};

interface Props {
  mode: Mode;
  busy: boolean;
  error: string;
  initialTab?: GameTab;
  initialBoard?: Board;
  onMode: (m: Mode) => void;
  onStart: (m: Mode) => void;
}

export function StartScreen({
  mode,
  busy,
  error,
  initialTab = 'modes',
  initialBoard,
  onMode,
  onStart,
}: Props) {
  const user = useAuth((s) => s.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const daily = stats.data?.daily.time;
  const [tab, setTab] = useState<GameTab>(initialTab);
  const [board, setBoard] = useState<Board | undefined>(initialBoard);
  const shown = mode;
  const preset = timePresets[shown === 'daily' ? 'classic' : shown]!;

  return (
    <section className="screen">
      <PullToRefresh />
      <BackButton to="/" label="Jogos" />
      <h1>Tempo</h1>
      <GameTabs game="time" tab={tab} onTab={setTab} />
      {tab === 'modes' && (
        <>
          <ModePicker
            game="time"
            modes={MODES}
            value={mode}
            onChange={(id) => onMode(id as Mode)}
          />
          <p className="lead">{LEAD[shown]}</p>
          <div className="tm-rules">
            <div className="tm-rule">
              <b>{preset.rounds}</b>
              {preset.rounds === 1 ? 'rodada' : 'rodadas'}
            </div>
            <div className="tm-rule">
              <b>
                {preset.minMs / 1000}–{preset.maxMs / 1000}s
              </b>
              alvos
            </div>
            <div className="tm-rule">
              <b>{preset.rounds * 10}</b>pontos max
            </div>
          </div>
          {error && (
            <p className="acc-failure mono" role="alert">
              {error}
            </p>
          )}
          {shown !== 'daily' && (
            <div className="stack">
              <PlayGate>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => onStart(shown)}
                >
                  {busy ? 'Preparando...' : 'Jogar'} <ArrowRight />
                </button>
              </PlayGate>
            </div>
          )}
          {shown === 'daily' && (
            <DailyCard
              game="time"
              info={daily}
              busy={busy}
              onPlay={() => onStart('daily')}
              onRanking={() => {
                setBoard('daily');
                setTab('ranking');
              }}
            />
          )}
        </>
      )}
      {tab === 'friends' && <FriendsPanel game="time" />}
      {tab === 'ranking' && <RankingPanel game="time" initialBoard={board} />}
    </section>
  );
}
