import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SURVIVAL_MAX_ROUNDS, timePresets } from '@nocap/games';
import { BackButton } from '@/components/BackButton';
import { DailyCard } from '@/components/DailyCard';
import { FriendsPanel } from '@/components/FriendsPanel';
import { ModePicker } from '@/components/ModePicker';
import { ModeSheet } from '@/components/ModeSheet';
import { GameTabs, type GameTab } from '@/components/GameTabs';
import { ArrowRight } from '@/components/icons';
import { PlayGate } from '@/components/PlayGate';
import { PullToRefresh } from '@/components/PullToRefresh';
import { RankingPanel } from '@/components/RankingPanel';
import { useAuth } from '@/lib/auth';
import type { Board } from '@/lib/ranking';
import { dailyMax, fetchStats } from '@/lib/stats';
import type { Mode } from '../types';

/** Modos de partida solo. O Daily é um cartão à parte, dentro do jogo. */
const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: 'classic', label: 'Clássico', desc: '3 RODADAS' },
  { id: 'quick', label: 'Rápido', desc: '1 RODADA' },
  { id: 'strict', label: 'Sem estourar', desc: 'PASSOU, ZERO' },
  { id: 'sequence', label: 'Sequência', desc: '5 ALVOS SEGUIDOS' },
  { id: 'survival', label: 'Sobrevivência', desc: '3 VIDAS' },
  { id: 'daily', label: 'Daily', desc: '1 POR DIA · RANKING' },
];

const LEAD: Record<Mode, string> = {
  classic:
    'Você vê um tempo alvo. Toque em COMEÇAR, depois em COMEÇAR A CONTAR, conte de cabeça e toque de novo para parar. Alternamos alvos curtos (menos de 10 s) e longos.',
  quick: 'Uma rodada só, quase sempre curta. Conte o tempo de cabeça e veja o quanto chegou perto.',
  strict: 'Passou do alvo, a rodada vale zero. Melhor parar um pouco antes do que estourar.',
  sequence:
    'Cinco alvos curtos (de 2 a 6 s), um atrás do outro, sem pausa. Acertou ou não, o próximo já vem. As notas aparecem no final.',
  survival:
    'Você tem 3 vidas. Cada alvo exige uma nota mínima (5, depois 6, depois 7). Errou, perde uma vida. Vale quantas rodadas você aguenta.',
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
  initialTab = 'modes',
  initialBoard,
  onMode,
  onStart,
  busy,
  error,
}: Props) {
  const user = useAuth((s) => s.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const daily = stats.data?.daily.time;
  const [tab, setTab] = useState<GameTab>(initialTab);
  const [board, setBoard] = useState<Board | undefined>(initialBoard);
  /** Modo cuja ficha está aberta (null = só a lista de modos). */
  const [open, setOpen] = useState<Mode | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const preset = timePresets[(open ?? 'classic') === 'daily' ? 'classic' : (open ?? 'classic')]!;

  const openMode = (id: string) => {
    onMode(id as Mode);
    setOpen(id as Mode);
  };

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
            onOpen={openMode}
            dailyNote={
              daily?.playedToday
                ? `FEITO · ${((daily.totalScore ?? 0) / 10).toFixed(1)}/${dailyMax('time')}`
                : 'DISPONÍVEL HOJE'
            }
          />
          {open && (
            <ModeSheet
              game="time"
              modeId={open}
              title={MODES.find((m) => m.id === open)?.label ?? ''}
              lead={LEAD[open]}
              onClose={close}
              rules={
                open === 'survival' ? (
                  <>
                    <div className="tm-rule">
                      <b>3</b>vidas
                    </div>
                    <div className="tm-rule">
                      <b>5→7</b>nota mínima
                    </div>
                    <div className="tm-rule">
                      <b>{SURVIVAL_MAX_ROUNDS}</b>rodadas máx.
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )
              }
            >
              {error && (
                <p className="acc-failure mono" role="alert">
                  {error}
                </p>
              )}
              {open === 'daily' ? (
                <DailyCard
                  game="time"
                  info={daily}
                  busy={busy}
                  onPlay={() => onStart('daily')}
                  onRanking={() => {
                    setBoard('daily');
                    setTab('ranking');
                    close();
                  }}
                />
              ) : (
                <PlayGate>
                  <button
                    type="button"
                    className="btn"
                    data-sfx="start"
                    disabled={busy}
                    onClick={() => onStart(open)}
                  >
                    {busy ? 'Preparando...' : 'Jogar'} <ArrowRight />
                  </button>
                </PlayGate>
              )}
            </ModeSheet>
          )}
        </>
      )}
      {tab === 'friends' && <FriendsPanel game="time" />}
      {tab === 'ranking' && <RankingPanel game="time" initialBoard={board} />}
    </section>
  );
}
