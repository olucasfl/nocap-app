import { useCallback, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { SURVIVAL_MAX_ROUNDS, colorDailySettings, colorPresets } from '@nocap/games';
import { BackButton } from '@/components/BackButton';
import { DailyScreen } from '@/components/DailyScreen';
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
/** O Intruso só existe em sala: aparece na lista como os outros, mas a ficha leva a criar uma sala. */
type ModeId = Mode | 'impostor';

const MODES: { id: ModeId; label: string; desc: string }[] = [
  { id: 'classic', label: 'Clássico', desc: '3 RODADAS · 3 S' },
  { id: 'flash', label: 'Flash', desc: '3 RODADAS · 0,4 S' },
  { id: 'quick', label: 'Rápido', desc: '1 RODADA' },
  { id: 'blind', label: 'Às cegas', desc: 'SEM PRÉVIA' },
  { id: 'survival', label: 'Sobrevivência', desc: '3 VIDAS' },
  { id: 'impostor', label: 'Intruso', desc: 'SÓ COM AMIGOS' },
  { id: 'daily', label: 'Daily', desc: '1 POR DIA · RANKING' },
];

const LEAD: Record<ModeId, string> = {
  impostor:
    'A turma recria a mesma cor, mas alguns são intrusos: não veem a cor, só uma dica. Depois todo mundo vota em quem acha que é o intruso.',
  classic:
    'Uma cor aparece por 3 segundos. Depois some. Recrie de memória nos controles e veja o quanto você chegou perto.',
  flash: 'A cor pisca por menos de meio segundo. Sem tempo pra pensar: confie no olho.',
  quick: 'Só uma rodada, com 3 segundos pra decorar. Ideal pra jogar em 30 segundos.',
  blind:
    'Você não vê a cor que está montando, só os controles. As notas só aparecem no fim. Confie na memória.',
  survival:
    'Você tem 3 vidas. A nota mínima começa em 6 e vai subindo: 7 na rodada 6, 7,5 na 11, 8 na 16, 8,5 na 21 e 9 na 26. O tempo para decorar cai devagar. Errou, perde uma vida. Passou pelas 30 rodadas, você ganha.',
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
  const board = initialBoard;
  /** Modo cuja ficha está aberta (null = só a lista de modos). */
  const [open, setOpen] = useState<ModeId | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const preset =
    open === 'daily'
      ? colorDailySettings
      : colorPresets[open && open !== 'impostor' ? open : 'classic']!;

  /** O Daily tem tela própria (resultado do dia e parte social), fora da ficha dos outros modos. */
  const [dailyView, setDailyView] = useState(false);

  const openMode = (id: string) => {
    if (id !== 'impostor') onMode(id as Mode);
    if (id === 'daily') setDailyView(true);
    else setOpen(id as ModeId);
  };

  if (dailyView) {
    return (
      <DailyScreen
        game="color"
        onPlay={() => onStart('daily')}
        intro={{
          rules: [
            { value: String(colorDailySettings.rounds), label: 'rodadas' },
            { value: `${colorDailySettings.showMs / 1000}s`, label: 'para decorar' },
            { value: '1', label: 'chance por dia' },
          ],
          text: 'Uma cor aparece e some. Recrie de memória nos controles. As cores são as mesmas para todo mundo, e sua nota soma no ranking do dia.',
        }}
        onBack={() => setDailyView(false)}
      />
    );
  }

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
              record={
                open === 'daily' || open === 'impostor'
                  ? null
                  : recordText(stats.data, 'color', open)
              }
              onClose={close}
              rules={
                open === 'impostor' ? (
                  <>
                    <div className="cg-rule">
                      <b>3-12</b>pessoas
                    </div>
                    <div className="cg-rule">
                      <b>1-3</b>intrusos
                    </div>
                    <div className="cg-rule">
                      <b>300+</b>cores
                    </div>
                  </>
                ) : open === 'survival' ? (
                  <>
                    <div className="cg-rule">
                      <b>3</b>vidas
                    </div>
                    <div className="cg-rule">
                      <b>6→9</b>nota mínima
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
              {open === 'impostor' ? (
                <>
                  <p className="mono ms-note">
                    Esse modo só funciona em sala, com no mínimo 3 pessoas. Quer criar uma sala
                    agora?
                  </p>
                  <Link
                    to="/sala"
                    search={{ jogo: 'impostor' }}
                    className="btn alt"
                    data-sfx="start"
                  >
                    Criar sala <ArrowRight />
                  </Link>
                </>
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
