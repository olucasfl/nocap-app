import { useQuery } from '@tanstack/react-query';
import { SURVIVAL_MAX_ROUNDS, colorDailySettings, colorPresets } from '@nocap/games';
import { GameHubLanding, type HubMode } from '@/components/GameHubLanding';
import type { GameTab } from '@/components/GameTabs';
import { useAuth } from '@/lib/auth';
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

const DAILY_INTRO = {
  rules: [
    { value: String(colorDailySettings.rounds), label: 'rodadas' },
    { value: `${colorDailySettings.showMs / 1000}s`, label: 'para decorar' },
    { value: '1', label: 'chance por dia' },
  ],
  text: 'Uma cor aparece e some. Recrie de memória nos controles.',
};

const seconds = (ms: number) => `${ms / 1000}s`.replace('.', ',');

interface Props {
  mode: Mode;
  initialTab?: GameTab;
  onMode: (m: Mode) => void;
  onStart: (m: Mode) => void;
}

/** O hub da Mesmíssima (spec 067): Daily, modos, amigos, como jogar e configurações. */
export function StartScreen({ initialTab, mode, onMode, onStart }: Props) {
  const user = useAuth((s) => s.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const daily = stats.data?.daily.color;
  const modes: HubMode[] = MODES.filter((m) => m.id !== 'daily').map((m) => {
    const id = m.id;
    const preset = id === 'impostor' ? null : colorPresets[id as Mode]!;
    return {
      id,
      label: m.label,
      sub: m.desc,
      lead: LEAD[id],
      roomGame: id === 'impostor' ? 'impostor' : undefined,
      record: id === 'impostor' ? null : recordText(stats.data, 'color', id as Mode),
      rules:
        id === 'impostor'
          ? [
              ['3-12', 'pessoas'],
              ['1-3', 'intrusos'],
              ['300+', 'cores'],
            ]
          : id === 'survival'
            ? [
                ['3', 'vidas'],
                ['6→9', 'nota mínima'],
                [String(SURVIVAL_MAX_ROUNDS.color), 'rodadas máx.'],
              ]
            : [
                [String(preset!.rounds), preset!.rounds === 1 ? 'rodada' : 'rodadas'],
                [seconds(preset!.showMs), 'pra decorar'],
                [String(preset!.rounds * 10), 'pontos max'],
              ],
    };
  });

  return (
    <GameHubLanding
      game="color"
      roomGame="color"
      modes={modes}
      initial={
        initialTab === 'friends'
          ? 'friends'
          : initialTab === 'modes'
            ? 'modes'
            : mode === 'daily'
              ? 'daily'
              : 'main'
      }
      dailyDone={!!daily?.playedToday}
      dailyNote={
        daily?.playedToday
          ? `feito · ${((daily.totalScore ?? 0) / 10).toFixed(1)}/${dailyMax('color')}`
          : 'disponível hoje'
      }
      dailyIntro={DAILY_INTRO}
      onStart={(id) => {
        onMode(id as Mode);
        onStart(id as Mode);
      }}
    />
  );
}
