import { useQuery } from '@tanstack/react-query';
import { SURVIVAL_MAX_ROUNDS, timePresets } from '@nocap/games';
import { GameHubLanding, type HubMode } from '@/components/GameHubLanding';
import type { GameTab } from '@/components/GameTabs';
import { useAuth } from '@/lib/auth';
import { dailyMax, fetchStats, recordText } from '@/lib/stats';
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
    'Você tem 3 vidas. A nota mínima começa em 6 e vai subindo: 7 na rodada 6, 7,5 na 11, 8 na 16, 8,5 na 21 e 9 na 26. Errou, perde uma vida. Passou pelas 30 rodadas, você ganha.',
  daily: 'Os alvos de hoje são os mesmos para todo mundo. Três rodadas, uma única chance por dia.',
};

interface Props {
  mode: Mode;
  busy: boolean;
  error: string;
  initialTab?: GameTab;
  onMode: (m: Mode) => void;
  onStart: (m: Mode) => void;
}

/** O hub do Já Deu? (spec 067): Daily, modos, amigos, como jogar e configurações. */
export function StartScreen({ initialTab, onMode, onStart, busy, error }: Props) {
  const user = useAuth((s) => s.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const daily = stats.data?.daily.time;
  const modes: HubMode[] = MODES.filter((m) => m.id !== 'daily').map((m) => {
    const preset = timePresets[m.id]!;
    return {
      id: m.id,
      label: m.label,
      sub: m.desc,
      lead: LEAD[m.id],
      record: recordText(stats.data, 'time', m.id),
      rules:
        m.id === 'survival'
          ? [
              ['3', 'vidas'],
              ['6→9', 'nota mínima'],
              [String(SURVIVAL_MAX_ROUNDS.time), 'rodadas máx.'],
            ]
          : [
              [String(preset.rounds), preset.rounds === 1 ? 'rodada' : 'rodadas'],
              [`${preset.minMs / 1000}–${preset.maxMs / 1000}s`, 'alvos'],
              [String(preset.rounds * 10), 'pontos max'],
            ],
    };
  });

  return (
    <GameHubLanding
      game="time"
      roomGame="time"
      modes={modes}
      busy={busy}
      error={error}
      initial={initialTab === 'friends' ? 'friends' : initialTab === 'modes' ? 'modes' : 'main'}
      dailyDone={!!daily?.playedToday}
      dailyNote={
        daily?.playedToday
          ? `feito · ${((daily.totalScore ?? 0) / 10).toFixed(1)}/${dailyMax('time')}`
          : 'disponível hoje'
      }
      onStart={(id) => {
        onMode(id as Mode);
        onStart(id as Mode);
      }}
    />
  );
}
