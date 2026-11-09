import { useQuery } from '@tanstack/react-query';
import { ECO_MAX_PADS, ecoPresets } from '@nocap/games';
import { GameHubLanding, type HubMode } from '@/components/GameHubLanding';
import type { GameTab } from '@/components/GameTabs';
import { useAuth } from '@/lib/auth';
import { dailyScoreText, fetchStats, recordText } from '@/lib/stats';
import type { Mode } from '../types';

/** Modos de partida solo. O Daily é um cartão à parte, dentro do jogo. */
const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: 'classic', label: 'Clássico', desc: '4 BOTÕES' },
  { id: 'escalada', label: 'Escalada', desc: 'MAIS BOTÕES' },
  { id: 'velocidade', label: 'Velocidade', desc: 'CADA VEZ MAIS RÁPIDO' },
  { id: 'reverso', label: 'Reverso', desc: 'DE TRÁS PARA FRENTE' },
  { id: 'batida', label: 'Eco Hero', desc: 'RITMO · 3 MÚSICAS' },
  { id: 'daily', label: 'Daily', desc: '1 POR DIA · RANKING' },
];

const LEAD: Record<Mode, string> = {
  classic:
    'Os botões se acendem numa ordem, cada um com o seu som. Repita a sequência. A cada acerto ela ganha mais um passo. Errou, acabou.',
  escalada: `Igual ao Clássico, mas a cada 3 rodadas entra um botão novo, até ${ECO_MAX_PADS}. A sequência fica mais difícil de guardar.`,
  velocidade:
    'A sequência toca cada vez mais rápido: começa em 700 ms por passo e, a cada rodada, acelera até 170 ms na rodada 20. Vai até 30 passos. Difícil, mas dá.',
  reverso:
    'Você vê a sequência na ordem e repete de trás para frente. O último botão que acendeu é o primeiro que você toca.',
  batida:
    'Três músicas para escolher. Cinco pistas, notas que vêm do fundo e você toca no botão certo na hora certa: cada acerto toca uma nota e, juntas, elas formam a música. Acertos seguidos sobem o multiplicador; erros gastam a energia.',
  daily:
    'A sequência de hoje é a mesma para todo mundo. Modo Clássico, uma única tentativa por dia.',
};

interface Props {
  mode: Mode;
  busy: boolean;
  error: string;
  initialTab?: GameTab;
  onMode: (m: Mode) => void;
  onStart: (m: Mode) => void;
}

/** O hub do Ecooo (spec 067): Daily, modos, amigos, como jogar e configurações. */
export function StartScreen({ initialTab, onMode, onStart, busy, error }: Props) {
  const user = useAuth((s) => s.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const daily = stats.data?.daily.eco;
  const modes: HubMode[] = MODES.filter((m) => m.id !== 'daily').map((m) => {
    if (m.id === 'batida')
      return {
        id: m.id,
        label: m.label,
        sub: m.desc,
        lead: LEAD[m.id],
        record: null,
        rules: [
          ['5', 'pistas'],
          ['3', 'músicas'],
          ['x4', 'multiplicador máx.'],
        ] as [string, string][],
      };
    const preset = ecoPresets[m.id as Exclude<Mode, 'daily' | 'batida'>];
    return {
      id: m.id,
      label: m.label,
      sub: m.desc,
      lead: LEAD[m.id],
      record: recordText(stats.data, 'eco', m.id),
      rules: [
        [
          preset.maxPads > preset.pads ? `${preset.pads}→${preset.maxPads}` : String(preset.pads),
          'botões',
        ],
        [
          preset.speedUpMs > 0
            ? `${preset.stepMs}→${preset.minStepMs}`
            : String(preset.startLength),
          preset.speedUpMs > 0
            ? 'ms por passo'
            : preset.startLength === 1
              ? 'passo no início'
              : 'passos no início',
        ],
        [String(preset.maxSteps), 'passos máx.'],
      ] as [string, string][],
    };
  });

  return (
    <GameHubLanding
      game="eco"
      roomGame="eco"
      modes={modes}
      busy={busy}
      error={error}
      initial={initialTab === 'friends' ? 'friends' : initialTab === 'modes' ? 'modes' : 'main'}
      dailyDone={!!daily?.playedToday}
      dailyNote={
        daily?.playedToday
          ? `feito · ${dailyScoreText('eco', daily.totalScore ?? 0)}`
          : 'disponível hoje'
      }
      onStart={(id) => {
        onMode(id as Mode);
        onStart(id as Mode);
      }}
    />
  );
}
