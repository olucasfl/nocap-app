import type { CSSProperties } from 'react';
import { clock } from '@/components/final/math';
import { FinalShell, type FinalTone } from '@/components/final/FinalShell';
import {
  RematchActions,
  RematchPanel,
  TrainingActions,
  type RematchRoom,
} from '@/components/final/RematchPanel';
import { useCountUp } from '@/components/final/useCountUp';
import './ping-final.css';

export interface PingStats {
  /** Duração da partida (s). */
  seconds: number;
  /** Maior troca de bolas num ponto. */
  longest: number;
  /** Bola mais rápida (km/h). */
  fastest: number;
  /** Smashes de quem olha. */
  smashes: number;
  /** Pontos de cada jogador. */
  points: [number, number];
  /** Batidas de cada jogador. */
  hits: [number, number];
}

export type PingFinalMode =
  | { kind: 'training'; onAgain?: () => void; onExit: () => void }
  | { kind: 'room'; room: RematchRoom };

/**
 * Tela do fim do Ping Fox! (treino e sala): o placar da partida, quem venceu, os números da partida (duração, maior
 * troca, bola mais rápida, smashes) e a barra de pontos de cada um. Na sala traz a votação de revanche.
 */
export function PingFinal({
  winner,
  score,
  names,
  stats,
  mode,
}: {
  winner: number;
  score: [number, number];
  names: [string, string];
  stats: PingStats;
  mode: PingFinalMode;
}) {
  const tone: FinalTone = winner === 0 ? 'win' : 'lose';
  const a = useCountUp(score[0], 350, 800);
  const b = useCountUp(score[1], 450, 800);
  const total = Math.max(1, stats.points[0] + stats.points[1]);
  return (
    <FinalShell
      theme="png"
      tone={tone}
      kicker="Ping Fox! · fim de partida"
      title={winner === 0 ? 'Você venceu!' : `${names[1]} venceu`}
      sub={
        winner === 0
          ? 'Boa! A mesa é sua.'
          : `Placar final ${score[0]} a ${score[1]}. A revanche está logo aí.`
      }
      label="Resultado do Ping Fox!"
      testId="png-final"
      deco={Array.from({ length: 6 }, (_, i) => (
        <i key={i} className="pnf-ball" style={{ '--k': i } as CSSProperties} />
      ))}
      footer={
        mode.kind === 'room' ? (
          <RematchActions room={mode.room} />
        ) : (
          <TrainingActions onAgain={mode.onAgain} onExit={mode.onExit} />
        )
      }
    >
      <div className={`fz-cols${mode.kind === 'room' ? '' : ' is-solo'}`}>
        <div className="fz-main">
          <div className="pnf-board" aria-label="Placar final">
            <div className={`pnf-side${winner === 0 ? ' is-winner' : ''}`}>
              <small>{names[0]}</small>
              <b data-testid="png-final-a">{a}</b>
            </div>
            <span className="pnf-vs" aria-hidden="true">
              x
            </span>
            <div className={`pnf-side${winner === 1 ? ' is-winner' : ''}`}>
              <small>{names[1]}</small>
              <b data-testid="png-final-b">{b}</b>
            </div>
          </div>

          <ul className="fz-stats" aria-label="Números da partida">
            <li style={{ '--d': '300ms' } as CSSProperties}>
              <small>Duração</small>
              <b>{clock(stats.seconds)}</b>
              <span>de partida</span>
            </li>
            <li style={{ '--d': '420ms' } as CSSProperties}>
              <small>Maior troca</small>
              <b>{stats.longest}</b>
              <span>{stats.longest === 1 ? 'batida' : 'batidas'} num ponto</span>
            </li>
            <li style={{ '--d': '540ms' } as CSSProperties}>
              <small>Bola mais rápida</small>
              <b>{stats.fastest}</b>
              <span>km/h</span>
            </li>
            <li style={{ '--d': '660ms' } as CSSProperties}>
              <small>Seus smashes</small>
              <b>{stats.smashes}</b>
              <span>na partida</span>
            </li>
          </ul>

          <ol className="fz-list" aria-label="Pontos de cada jogador">
            {[0, 1].map((i) => (
              <li
                key={i}
                className={`fz-row${i === 0 ? ' is-you' : ''}${i === winner ? ' is-first' : ''}`}
                style={{ '--d': `${500 + i * 80}ms` } as CSSProperties}
              >
                <span className="fz-pos">{i === winner ? '1º' : '2º'}</span>
                <span
                  className="fz-dot"
                  style={{ background: i === 0 ? '#ff7d26' : '#9a6bff' }}
                  aria-hidden="true"
                />
                <span className="fz-name">
                  {names[i]}
                  {i === 0 && <small>você</small>}
                </span>
                <span className="fz-val">
                  {stats.points[i]} {stats.points[i] === 1 ? 'ponto' : 'pontos'}
                  <small>{stats.hits[i]} batidas</small>
                </span>
                <span className="fz-bar" aria-hidden="true">
                  <i
                    style={{
                      transform: `scaleX(${Math.max(0.02, (stats.points[i] ?? 0) / total)})`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ol>
        </div>
        {mode.kind === 'room' && (
          <aside>
            <RematchPanel room={mode.room} />
          </aside>
        )}
      </div>
    </FinalShell>
  );
}
