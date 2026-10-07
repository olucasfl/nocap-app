import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SURVIVAL_MAX_ROUNDS, colorPresets } from '@nocap/games';
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
import { dailyMax, fetchStats, recordText } from '@/lib/stats';
import type { Mode } from '../types';

/** Modos de partida solo. O Daily é um cartão à parte, dentro do jogo. */
const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: 'classic', label: 'Clássico', desc: '5 RODADAS · 3 S' },
  { id: 'flash', label: 'Flash', desc: '5 RODADAS · 0,4 S' },
  { id: 'quick', label: 'Rápido', desc: '1 RODADA' },
  { id: 'blind', label: 'Às cegas', desc: 'SEM PRÉVIA' },
  { id: 'survival', label: 'Sobrevivência', desc: '3 VIDAS' },
  { id: 'daily', label: 'Daily', desc: '1 POR DIA · RANKING' },
];

const LEAD: Record<Mode, string> = {
  classic:
    'Uma cor aparece por 3 segundos. Depois some. Recrie de memória nos controles e veja o quanto você chegou perto.',
  flash: 'A cor pisca por menos de meio segundo. Sem tempo pra pensar: confie no olho.',
  quick: 'Só uma rodada, com 3 segundos pra decorar. Ideal pra jogar em 30 segundos.',
  blind:
    'Você não vê a cor que está montando, só os controles. As notas só aparecem no fim. Confie na memória.',
  survival:
    'Você tem 3 vidas. A nota mínima começa em 6 e sobe: 7 na rodada 5, 8 na 10, 9 na 15 e 10 da 20 em diante. O tempo para decorar cai a cada cor. Errou, perde uma vida. Passou pelas 30 rodadas, você ganha.',
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

export function StartScreen({ initialTab = 'modes', initialBoard, onMode, onStart }: Props) {
  const user = useAuth((s) => s.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const daily = stats.data?.daily.color;
  const [tab, setTab] = useState<GameTab>(initialTab);
  const [board, setBoard] = useState<Board | undefined>(initialBoard);
  /** Modo cuja ficha está aberta (null = só a lista de modos). */
  const [open, setOpen] = useState<Mode | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const preset = colorPresets[(open ?? 'classic') === 'daily' ? 'classic' : (open ?? 'classic')]!;

  const openMode = (id: string) => {
    onMode(id as Mode);
    setOpen(id as Mode);
  };

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
            onOpen={openMode}
            dailyNote={
              daily?.playedToday
                ? `FEITO · ${((daily.totalScore ?? 0) / 10).toFixed(1)}/${dailyMax('color')}`
                : 'DISPONÍVEL HOJE'
            }
          />
          {open && (
            <ModeSheet
              game="color"
              modeId={open}
              title={MODES.find((m) => m.id === open)?.label ?? ''}
              lead={LEAD[open]}
              record={open === 'daily' ? null : recordText(stats.data, 'color', open)}
              onClose={close}
              rules={
                open === 'survival' ? (
                  <>
                    <div className="cg-rule">
                      <b>3</b>vidas
                    </div>
                    <div className="cg-rule">
                      <b>6→10</b>nota mínima
                    </div>
                    <div className="cg-rule">
                      <b>{SURVIVAL_MAX_ROUNDS.color}</b>rodadas máx.
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )
              }
            >
              {open === 'daily' ? (
                <DailyCard
                  game="color"
                  info={daily}

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

                    onClick={() => onStart(open)}
                  >
                    Jogar <ArrowRight />
                  </button>
                </PlayGate>
              )}
            </ModeSheet>
          )}
        </>
      )}
      {tab === 'friends' && <FriendsPanel game="color" />}
      {tab === 'ranking' && <RankingPanel game="color" initialBoard={board} />}
    </section>
  );
}
