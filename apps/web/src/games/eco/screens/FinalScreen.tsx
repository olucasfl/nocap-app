import { useEffect, useMemo } from 'react';
import { evaluateRun, expectedTaps, lengthAt } from '@nocap/games';
import { DailyPanel } from '@/components/DailyPanel';
import { ReflexFinal } from '@/components/ReflexFinal';
import type { GameTab } from '@/components/GameTabs';
import { GradeFx } from '@/components/GradeFx';
import { MatchSummary } from '@/components/MatchSummary';
import { gradeOf, playGrade } from '@/lib/grade';
import type { Board } from '@/lib/ranking';
import { saveBest } from '@/lib/records';
import { ecoGradeScore } from '../grade';
import { PadChip } from '../pads';
import type { EndReason, Run } from '../types';
import { SaveNote } from '@/components/GuestNotice';
import { useSaveEco } from '../useSaveEco';

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
    <>
      <GradeFx id={grade.id} />
      <ReflexFinal
        modeLabel={run.kind === 'daily' ? 'Daily' : (MODE_NAME[run.preset] ?? run.preset)}
        heroLabel="PASSOS"
        heroValue={steps}
        heroUnit={`/ ${run.settings.maxSteps}`}
        heroWord={grade.word}
        heroNote={REASON_TEXT[reason]}
        detailsTitle="Como terminou"
        details={
          <div className="eco-end mono">
            <span>{REASON_TEXT[reason]}</span>
            {miss ? (
              <span className="eco-miss">
                ERA <PadChip pad={miss.correct} /> VOCÊ TOCOU <PadChip pad={miss.pressed} />
              </span>
            ) : (
              <span>
                {steps} de {run.settings.maxSteps} passos
              </span>
            )}
          </div>
        }
        record={
          run.kind !== 'daily' ? (
            <MatchSummary
              game="eco"
              mode={run.preset}
              part="record"
              scoreTenths={steps * 10}
              previousBest={previousBest}
              saved={save === 'saved'}
              onRanking={() => onMenu('ranking', run.preset)}
            />
          ) : undefined
        }
        ranking={
          run.kind === 'daily' ? (
            <DailyPanel game="eco" />
          ) : (
            <MatchSummary
              game="eco"
              mode={run.preset}
              part="ranking"
              scoreTenths={steps * 10}
              previousBest={previousBest}
              saved={save === 'saved'}
              onRanking={() => onMenu('ranking', run.preset)}
            />
          )
        }
        save={<SaveNote className="eco-save" save={save} />}
        again={run.kind === 'daily' ? undefined : onRematch}
        board={run.kind === 'daily' ? 'daily' : run.preset}
        onMenu={onMenu}
      />
    </>
  );
}

const MODE_NAME: Record<string, string> = {
  classic: 'Clássico',
  escalada: 'Escalada',
  velocidade: 'Velocidade',
  reverso: 'Reverso',
};
