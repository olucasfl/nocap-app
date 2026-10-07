import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { sfx } from '@/lib/sfx';
import { EndActions } from '@/components/EndActions';
import type { GameTab } from '@/components/GameTabs';
import { NewRecord } from '@/components/NewRecord';
import type { Board } from '@/lib/ranking';
import { saveBest } from '@/lib/records';
import { formatBest, isNewRecord } from '@/lib/stats';
import { GradeFx } from '@/components/GradeFx';
import { gradeLine, gradeOf, playGrade } from '@/lib/grade';
import { formatDiff, formatSeconds } from '../format';
import type { RoundResult, Run } from '../types';
import { SAVE_TEXT, useSaveTime } from '../useSaveTime';

interface Props {
  result: RoundResult;
  run: Run;
  isLast: boolean;
  onNext: () => void;
  onAgain: () => void;
  onMenu: (tab: GameTab, board?: Board) => void;
  /** Recorde do Rápido antes desta partida (décimos). */
  previousBest?: number;
  /** Sobrevivência: aviso de passou/perdeu vida, antes do botão. */
  extra?: ReactNode;
}

/** Fim do jogo rápido: salva a partida e oferece outra rodada. Recorde próprio. */
function QuickFooter({
  run,
  result,
  previousBest,
  onMenu,
  onAgain,
}: {
  run: Run;
  result: RoundResult;
  previousBest?: number;
  onMenu: (tab: GameTab, board?: Board) => void;
  onAgain: () => void;
}) {
  const save = useSaveTime(run, [result]);
  useEffect(() => {
    saveBest('time-quick', result.score);
  }, [result.score]);
  const now = Math.round(result.score * 10);
  return (
    <>
      {isNewRecord(previousBest, now) && (
        <NewRecord
          now={formatBest('time', 'quick', now)}
          before={formatBest('time', 'quick', previousBest!)}
        />
      )}
      <p className="tm-save" role="status">
        {SAVE_TEXT[save]}
      </p>
      <div className="stack">
        <button type="button" className="btn alt" onClick={onAgain}>
          Outra rodada
        </button>
        <EndActions board="quick" onMenu={onMenu} />
        <Link to="/" className="btn ghost">
          Voltar aos jogos
        </Link>
      </div>
    </>
  );
}

const REVEAL_DELAY_MS = 900;
const CLIMB_STEPS = 18;

/** Quanto tempo o tempo do jogador leva para subir: de 1,2 s a 2,6 s, proporcional ao tempo. */
const climbMs = (answer: number) => Math.min(2600, Math.max(1200, answer * 0.3));

/**
 * Resultado em quatro tempos: o alvo cai na tela (batida grave), o tempo do jogador sobe numa
 * pista até onde ele parou (tiques que sobem de tom), a marca do alvo mostra o quão perto
 * ficou e, no fim, o veredito chega com o som dele (cravou/perto: notas subindo; errou feio:
 * boing). Tudo isso só aqui, depois da contagem. Movimento reduzido mostra direto o final.
 */
export function ResultScreen({
  result,
  run,
  isLast,
  onNext,
  onAgain,
  onMenu,
  previousBest,
  extra,
}: Props) {
  const { target, answer, score } = result;
  const diff = answer - target;
  const overshot = run.settings.noOvershoot && answer > target;
  const reduced = useRef(
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  ).current;
  const [shown, setShown] = useState(reduced ? answer : 0);
  const [done, setDone] = useState(reduced);

  // Pista: vai até o maior entre alvo e resposta, com folga, para os dois caberem.
  const span = Math.max(target, answer) * 1.12;
  const targetPct = (target / span) * 100;
  const grade = gradeOf(score);
  const [line] = useState(() => gradeLine(grade.id, 'time'));

  useEffect(() => {
    const finish = () => {
      setDone(true);
      playGrade(grade.id);
    };

    sfx.thunk();
    if (reduced) {
      finish();
      return;
    }
    let raf = 0;
    let lastStep = -1;
    const duration = climbMs(answer);
    const timer = window.setTimeout(() => {
      const t0 = performance.now();
      const frame = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - (1 - p) ** 3;
        setShown(Math.round(answer * eased));
        const step = Math.floor(p * CLIMB_STEPS);
        if (step !== lastStep && p < 1) {
          lastStep = step;
          sfx.climb(step);
        }
        if (p < 1) raf = requestAnimationFrame(frame);
        else {
          setShown(answer);
          finish();
        }
      };
      raf = requestAnimationFrame(frame);
    }, REVEAL_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
    // Roda uma vez por resultado (a tela é remontada a cada rodada, `key={index}`).
  }, []);

  return (
    <section className={`screen tm-result${done ? ` done g-${grade.id}` : ''}`}>
      {done && <GradeFx id={grade.id} />}
      <div className="tm-slam">
        <div className="mono tm-label">ALVO</div>
        <b>{formatSeconds(target)}</b>
      </div>

      <div className="tm-track" aria-hidden="true">
        <div
          className={`tm-fill${overshot ? ' over' : ''}`}
          style={{ transform: `scaleX(${Math.min(1, shown / span)})` }}
        />
        <div className="tm-mark" style={{ left: `${targetPct}%` }}>
          <span className="mono">ALVO</span>
        </div>
      </div>

      <div className={`tm-you${overshot ? ' over' : ''}`}>
        <div className="mono tm-label">{overshot ? 'VOCÊ · ESTOUROU' : 'VOCÊ'}</div>
        <b aria-label={`Seu tempo: ${formatSeconds(answer)}`}>{formatSeconds(shown)}</b>
        <span className="mono tm-diff" style={{ visibility: done ? 'visible' : 'hidden' }}>
          {formatDiff(diff)}
        </span>
      </div>

      <div className="tm-verdict" role="status" aria-live="polite">
        {done && (
          <>
            <div className={`tm-stamp pop g-${grade.id}`}>
              <b>{score.toFixed(1)}</b>
              <span>{grade.word}</span>
            </div>
            <p className="gr-line">{line}</p>
          </>
        )}
      </div>

      {done && extra}
      {done &&
        (run.mode === 'quick' ? (
          <QuickFooter
            run={run}
            result={result}
            previousBest={previousBest}
            onMenu={onMenu}
            onAgain={onAgain}
          />
        ) : (
          <div className="stack">
            <button type="button" className="btn" onClick={onNext}>
              {isLast ? 'Ver resultado' : 'Próxima'}
            </button>
          </div>
        ))}
    </section>
  );
}
