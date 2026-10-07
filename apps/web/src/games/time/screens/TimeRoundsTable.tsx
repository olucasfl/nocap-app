import { gradeOf } from '@/lib/grade';
import { formatDiff, formatSeconds } from '../format';
import type { RoundResult } from '../types';

/**
 * Como foi cada rodada, em colunas: ALVO, SEU TEMPO, DIFERENÇA e NOTA, com a classificação da
 * nota (cravou, mandou bem, meh...) e, na Sobrevivência, se passou ou perdeu vida.
 */
export function TimeRoundsTable({
  rows,
  passed,
  shown = rows.length,
}: {
  rows: RoundResult[];
  /** Sobrevivência: por rodada, passou da nota mínima? */
  passed?: boolean[];
  /** Quantas linhas já foram reveladas (as demais ficam reservadas, invisíveis). */
  shown?: number;
}) {
  return (
    <div className="tt" role="table" aria-label="Suas rodadas">
      <div className="tt-row tt-head mono" role="row">
        <span role="columnheader">#</span>
        <span role="columnheader">ALVO</span>
        <span role="columnheader">SEU TEMPO</span>
        <span role="columnheader">DIFERENÇA</span>
        <span role="columnheader">NOTA</span>
      </div>
      {rows.map((r, i) => {
        const grade = gradeOf(r.score);
        return (
          <div
            className={`tt-row${passed && !passed[i] ? ' lost' : ''}${i < shown ? ' in' : ' pending'}`}
            role="row"
            key={i}
          >
            <span className="tt-n mono">{i + 1}</span>
            <span className="mono tt-v">{formatSeconds(r.target)}</span>
            <span className="mono tt-v">{formatSeconds(r.answer)}</span>
            <span className="mono tt-v tt-diff">{formatDiff(r.answer - r.target)}</span>
            <span className="tt-score">
              <b>{r.score.toFixed(1)}</b>
              <i className={`gc gc-${grade.id}`}>{grade.word}</i>
              {passed && (
                <em className={passed[i] ? 'ok' : 'bad'}>{passed[i] ? 'passou' : 'perdeu vida'}</em>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
