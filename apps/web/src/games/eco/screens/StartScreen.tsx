import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ECO_MAX_PADS, ECO_MAX_STEPS, ecoPresets } from '@nocap/games';
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
import { dailyScoreText, fetchStats, recordText } from '@/lib/stats';
import type { Mode } from '../types';

/** Modos de partida solo. O Daily é um cartão à parte, dentro do jogo. */
const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: 'classic', label: 'Clássico', desc: '4 BOTÕES' },
  { id: 'escalada', label: 'Escalada', desc: 'MAIS BOTÕES' },
  { id: 'velocidade', label: 'Velocidade', desc: 'CADA VEZ MAIS RÁPIDO' },
  { id: 'reverso', label: 'Reverso', desc: 'DE TRÁS PARA FRENTE' },
  { id: 'daily', label: 'Daily', desc: '1 POR DIA · RANKING' },
];

const LEAD: Record<Mode, string> = {
  classic:
    'Os botões se acendem numa ordem, cada um com o seu som. Repita a sequência. A cada acerto ela ganha mais um passo. Errou, acabou.',
  escalada: `Igual ao Clássico, mas a cada 3 rodadas entra um botão novo, até ${ECO_MAX_PADS}. A sequência fica mais difícil de guardar.`,
  velocidade:
    'A sequência toca cada vez mais rápido: começa em 650 ms por passo e, a cada rodada, acelera até 160 ms. Difícil, mas dá.',
  reverso:
    'Você vê a sequência na ordem e repete de trás para frente. O último botão que acendeu é o primeiro que você toca.',
  daily:
    'A sequência de hoje é a mesma para todo mundo. Modo Clássico, uma única tentativa por dia.',
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
  const daily = stats.data?.daily.eco;
  const [tab, setTab] = useState<GameTab>(initialTab);
  /** Modo cuja ficha está aberta (null = só a lista de modos). */
  const [open, setOpen] = useState<Mode | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const preset = ecoPresets[open && open !== 'daily' ? open : 'classic'];

  /** O Daily tem tela própria (resultado do dia e parte social), fora da ficha dos outros modos. */
  const [dailyView, setDailyView] = useState(false);

  const openMode = (id: string) => {
    onMode(id as Mode);
    if (id === 'daily') setDailyView(true);
    else setOpen(id as Mode);
  };

  if (dailyView) {
    return (
      <DailyScreen
        game="eco"
        busy={busy}
        error={error}
        onPlay={() => onStart('daily')}
        onBack={() => setDailyView(false)}
      />
    );
  }

  return (
    <section className="screen">
      <PullToRefresh />
      <BackButton to="/" label="Jogos" />
      <h1>Ecooo</h1>
      <GameTabs game="eco" tab={tab} onTab={setTab} />
      {tab === 'modes' && (
        <>
          <ModePicker
            game="eco"
            modes={MODES}
            onOpen={openMode}
            dailyNote={
              daily?.playedToday
                ? `FEITO · ${dailyScoreText('eco', daily.totalScore ?? 0)}`
                : 'DISPONÍVEL HOJE'
            }
          />
          {open && (
            <ModeSheet
              game="eco"
              modeId={open}
              title={MODES.find((m) => m.id === open)?.label ?? ''}
              lead={LEAD[open]}
              record={open === 'daily' ? null : recordText(stats.data, 'eco', open)}
              onClose={close}
              rules={
                <>
                  <div className="eco-rule">
                    <b>
                      {preset.maxPads > preset.pads
                        ? `${preset.pads}→${preset.maxPads}`
                        : preset.pads}
                    </b>
                    botões
                  </div>
                  <div className="eco-rule">
                    <b>
                      {preset.speedUpMs > 0
                        ? `${preset.stepMs}→${preset.minStepMs}`
                        : preset.startLength}
                    </b>
                    {preset.speedUpMs > 0
                      ? 'ms por passo'
                      : preset.startLength === 1
                        ? 'passo no início'
                        : 'passos no início'}
                  </div>
                  <div className="eco-rule">
                    <b>{ECO_MAX_STEPS}</b>passos máx.
                  </div>
                </>
              }
            >
              {error && (
                <p className="acc-failure mono" role="alert">
                  {error}
                </p>
              )}
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
            </ModeSheet>
          )}
        </>
      )}
      {tab === 'friends' && <FriendsPanel game="eco" />}
      {tab === 'ranking' && <RankingPanel game="eco" initialBoard={initialBoard} />}
    </section>
  );
}
