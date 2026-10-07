import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { timePresets } from '@nocap/games';
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
  { id: 'quick', label: 'Rápido' },
  { id: 'strict', label: 'Sem estourar' },
];

const LEAD: Record<Exclude<Mode, 'daily'>, string> = {
  classic:
    'Você vê um tempo alvo. Toque em COMEÇAR, depois em COMEÇAR A CONTAR, conte de cabeça e toque de novo para parar. Alternamos alvos curtos (menos de 10 s) e longos.',
  quick: 'Uma rodada só, quase sempre curta. Conte o tempo de cabeça e veja o quanto chegou perto.',
  strict: 'Passou do alvo, a rodada vale zero. Melhor parar um pouco antes do que estourar.',
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
  const shown = mode === 'daily' ? 'classic' : mode;
  const preset = timePresets[shown]!;

  return (
    <section className="screen">
      <BackButton to="/" label="Jogos" />
      <h1>Tempo</h1>
      <GameTabs game="time" tab={tab} onTab={setTab} />
      {tab === 'modes' && (
        <>
          <div className="tm-seg" role="radiogroup" aria-label="Modo de jogo">
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
          <div className="stack">
            <PlayGate>
              <button type="button" className="btn" disabled={busy} onClick={() => onStart(shown)}>
                {busy ? 'Preparando...' : 'Jogar'} <ArrowRight />
              </button>
            </PlayGate>
          </div>
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
        </>
      )}
      {tab === 'friends' && <FriendsPanel game="time" />}
      {tab === 'ranking' && <RankingPanel game="time" initialBoard={board} />}
    </section>
  );
}
