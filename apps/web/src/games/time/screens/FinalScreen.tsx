import { useEffect } from 'react';
import { gradeOf, gradeWord, playGrade } from '@/lib/grade';
import { sfx } from '@/lib/sfx';
import { useReveal } from '@/lib/useReveal';
import { DailyPanel } from '@/components/DailyPanel';
import { ReflexFinal } from '@/components/ReflexFinal';
import type { GameTab } from '@/components/GameTabs';
import { MatchSummary } from '@/components/MatchSummary';
import type { Board } from '@/lib/ranking';
import { saveBest } from '@/lib/records';
import type { RoundResult, Run } from '../types';
import { TimeRoundsTable } from './TimeRoundsTable';
import { SaveNote } from '@/components/GuestNotice';
import { useSaveTime } from '../useSaveTime';

interface Props {
  run: Run;
  results: RoundResult[];
  /** Recorde do modo antes desta partida (décimos); `undefined` = sem estatísticas. */
  previousBest?: number;
  onMenu: (tab: GameTab, board?: Board) => void;
  onRematch: () => void;
}

export function FinalScreen({ run, results, previousBest, onMenu, onRematch }: Props) {
  const total = Math.round(results.reduce((a, r) => a + r.score * 10, 0)) / 10;
  const save = useSaveTime(run, results);

  useEffect(() => {
    saveBest('time', total);
  }, [total]);

  // Nota por nota: cada rodada aparece com o seu tique; o total sobe junto e, no fim, vem o som da faixa.
  const { shown, done } = useReveal(results.length, (i) => sfx.tick(Math.round(results[i]!.score)));
  const running = Math.round(results.slice(0, shown).reduce((a, r) => a + r.score * 10, 0)) / 10;
  useEffect(() => {
    if (done) playGrade(gradeOf(total / results.length).id);
  }, [done, total, results.length]);

  const grade = gradeOf(total / results.length);
  const totalTenths = Math.round(total * 10);
  return (
    <ReflexFinal
      modeLabel={run.kind === 'daily' ? 'Daily' : (MODE_NAME[run.preset] ?? run.preset)}
      heroLabel="TOTAL"
      heroValue={running.toFixed(1)}
      heroUnit={`/ ${results.length * 10}`}
      heroWord={done ? gradeWord(grade, 'time') : undefined}
      detailsTitle="Rodada por rodada"
      details={<TimeRoundsTable rows={results} shown={shown} />}
      record={
        done && run.kind !== 'daily' ? (
          <MatchSummary
            game="time"
            mode={run.preset}
            part="record"
            scoreTenths={totalTenths}
            previousBest={previousBest}
            saved={save === 'saved'}
            onRanking={() => onMenu('ranking', run.preset)}
          />
        ) : undefined
      }
      ranking={
        done ? (
          run.kind === 'daily' ? (
            <DailyPanel game="time" />
          ) : (
            <MatchSummary
              game="time"
              mode={run.preset}
              part="ranking"
              scoreTenths={totalTenths}
              previousBest={previousBest}
              saved={save === 'saved'}
              onRanking={() => onMenu('ranking', run.preset)}
            />
          )
        ) : undefined
      }
      save={<SaveNote className="tm-save" save={save} />}
      again={run.kind === 'daily' ? undefined : onRematch}
      board={run.kind === 'daily' ? 'daily' : run.preset}
      onMenu={onMenu}
    />
  );
}

const MODE_NAME: Record<string, string> = {
  classic: 'Clássico',
  quick: 'Rápido',
  strict: 'Sem estourar',
  sequence: 'Sequência',
  survival: 'Sobrevivência',
};
