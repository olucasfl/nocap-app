import { useEffect, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { evaluateRun, expectedTaps, lengthAt } from '@nocap/games';
import { DailyPanel } from '@/components/DailyPanel';
import { EndActions } from '@/components/EndActions';
import type { GameTab } from '@/components/GameTabs';
import { GradeFx } from '@/components/GradeFx';
import { NewRecord } from '@/components/NewRecord';
import { gradeOf, playGrade } from '@/lib/grade';
import type { Board } from '@/lib/ranking';
import { saveBest } from '@/lib/records';
import { formatBest, isNewRecord } from '@/lib/stats';
import { ecoGradeScore } from '../grade';
import { PadChip } from '../pads';
import type { EndReason, Run } from '../types';
import { SAVE_TEXT, useSaveEco } from '../useSaveEco';

interface Props {
  run: Run;
  taps: number[];
  reason: EndReason;
  /** Recorde do modo antes desta partida (décimos); `undefined` = sem estatísticas. */
  previousBest?: number;
  onMenu: (tab: GameTab, board?: Board) => void;
  onRematch: () => void;
}

const REASON_TEXT: Record<EndReason, string> = {
  wrong: 'ERROU UM BOTÃO',
  timeout: 'FICOU PARADO',
  perfect: 'ECO PERFEITO',
};

export function FinalScreen({ run, taps, reason, previousBest, onMenu, onRematch }: Props) {
  // O mesmo cálculo do servidor: passos da maior sequência repetida.
  const result = useMemo(() => evaluateRun(run.seed, run.settings, taps), [run, taps]);
  const steps = result.steps;
  const grade = gradeOf(ecoGradeScore(steps, run.settings.maxSteps));
  const save = useSaveEco(run, taps);

  // Onde errou: o botão certo e o que foi tocado.
  const miss = useMemo(() => {
    if (result.ended !== 'wrong') return null;
    const want = expectedTaps(run.seed, run.settings, result.roundsShown);
    let before = 0;
    for (let r = 1; r < result.roundsShown; r++) before += lengthAt(run.settings, r);
    const at = result.usedTaps - before - 1;
    return { correct: want[at]!, pressed: taps[result.usedTaps - 1]! };
  }, [result, run, taps]);

  useEffect(() => {
    saveBest('eco', steps);
  }, [steps]);

  useEffect(() => {
    const id = window.setTimeout(() => playGrade(grade.id), 450);
    return () => window.clearTimeout(id);
  }, [grade.id]);

  return (
    <section className="screen">
      <GradeFx id={grade.id} />
      <div className="eco-total">
        <div>
          <div className="mono eco-label">PASSOS</div>
          <b>{steps}</b>
        </div>
        <div className="eco-total-side">
          <span className="eco-word">{grade.word}</span>
          <span className="mono">/ {run.settings.maxSteps}</span>
        </div>
      </div>

      <div className="eco-end mono">
        <span>{REASON_TEXT[reason]}</span>
        {miss && (
          <span className="eco-miss">
            ERA <PadChip pad={miss.correct} /> VOCÊ TOCOU <PadChip pad={miss.pressed} />
          </span>
        )}
      </div>

      {run.kind !== 'daily' && isNewRecord(previousBest, steps * 10) && (
        <NewRecord
          now={formatBest('eco', run.preset, steps * 10)}
          before={formatBest('eco', run.preset, previousBest!)}
        />
      )}
      <p className="eco-save" role="status">
        {SAVE_TEXT[save]}
      </p>
      {run.kind === 'daily' && <DailyPanel game="eco" />}
      <div className="stack">
        {/* O Daily é uma tentativa por dia: sem revanche. */}
        {run.kind !== 'daily' && (
          <button type="button" className="btn alt" data-sfx="start" onClick={onRematch}>
            Revanche
          </button>
        )}
        <EndActions board={run.kind === 'daily' ? 'daily' : run.preset} onMenu={onMenu} />
        <Link to="/" className="btn ghost">
          Voltar aos jogos
        </Link>
      </div>
    </section>
  );
}
