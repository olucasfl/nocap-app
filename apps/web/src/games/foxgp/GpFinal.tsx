import type { CSSProperties } from 'react';
import { FinalShell, type FinalTone } from '@/components/final/FinalShell';
import {
  RematchActions,
  RematchPanel,
  TrainingActions,
  type RematchRoom,
} from '@/components/final/RematchPanel';
import { lapClock } from './format';
import './gp-final.css';

export interface GpFinalRow {
  id: string;
  name: string;
  /** Cor da raposa (css). */
  color: string;
  you: boolean;
  bot?: boolean;
  /** Tempo total da corrida (ms); null = não terminou. */
  ms: number | null;
  best: number | null;
  passes: number;
  dnf: boolean;
}

export type GpFinalMode =
  | { kind: 'training'; onAgain?: () => void; onExit: () => void }
  | { kind: 'room'; room: RematchRoom };

/** Os três primeiros no pódio (o 1º no meio, mais alto e com o troféu). */
function Podium({ rows }: { rows: GpFinalRow[] }) {
  const top = rows.slice(0, 3);
  const order = [top[1], top[0], top[2]].flatMap((r, i) => {
    const place = [2, 1, 3][i] as number;
    return r ? [{ r, place }] : [];
  });
  return (
    <ol className="gpf-podium" aria-label="Pódio">
      {order.map(({ r, place }) => (
        <li
          key={r.id}
          className={`gpf-pod p${place}${r.you ? ' is-you' : ''}`}
          style={{ '--d': `${place === 1 ? 500 : place === 2 ? 350 : 250}ms` } as CSSProperties}
        >
          {place === 1 && (
            <svg className="gpf-trophy" viewBox="0 0 40 40" aria-label="Troféu">
              <path d="M10 6h20v8a10 10 0 0 1-20 0Z" fill="#ffd23f" stroke="#1b1535" strokeWidth="3" />
              <path d="M10 9H5a5 5 0 0 0 5 7M30 9h5a5 5 0 0 1-5 7" fill="none" stroke="#1b1535" strokeWidth="3" />
              <path d="M17 24h6v6h-6Z" fill="#ffd23f" stroke="#1b1535" strokeWidth="3" />
              <path d="M12 34h16" stroke="#1b1535" strokeWidth="4" strokeLinecap="round" />
            </svg>
          )}
          <span className="gpf-fox" style={{ background: r.color }} aria-hidden="true" />
          <b className="gpf-pod-name">{r.name}</b>
          <span className="gpf-block">
            <i>{place}º</i>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Pódio do Fox GP (treino e sala): os três primeiros (o campeão com o troféu), a tabela com posição, piloto e tempo (o
 * vencedor com o total, os outros com a diferença; DNF para quem não chegou) e os destaques: volta mais rápida e
 * ultrapassagens com o turbo da cauda.
 */
export function GpFinal({
  rows,
  fastest,
  passes,
  mode,
}: {
  /** Do 1º ao último. */
  rows: GpFinalRow[];
  /** "Nome · 0:41.234" */
  fastest: string;
  /** "Nome · 3" */
  passes: string;
  mode: GpFinalMode;
}) {
  const winner = rows[0];
  const meIdx = rows.findIndex((r) => r.you);
  const me = meIdx >= 0 ? rows[meIdx] : undefined;
  const tone: FinalTone = !me ? 'watch' : meIdx === 0 && !me.dnf ? 'win' : 'lose';
  const title =
    tone === 'win'
      ? 'Você venceu!'
      : tone === 'lose'
        ? me?.dnf
          ? 'Não terminou'
          : `Você chegou em ${meIdx + 1}º`
        : `${winner?.name ?? 'Alguém'} venceu`;
  const sub =
    tone === 'win'
      ? `Primeiro na linha, em ${lapClock(winner?.ms ?? 0)}.`
      : `${winner?.name ?? 'Alguém'} venceu em ${lapClock(winner?.ms ?? 0)}.`;
  const lead = winner?.ms ?? 0;

  return (
    <FinalShell
      theme="gp"
      tone={tone}
      kicker={`Fox GP · Circuito da Toca · ${rows.length} ${rows.length === 1 ? 'raposa' : 'raposas'}`}
      title={title}
      sub={sub}
      label="Resultado do Fox GP"
      testId="gp-final"
      footer={
        mode.kind === 'room' ? (
          <RematchActions room={mode.room} />
        ) : (
          <TrainingActions onAgain={mode.onAgain} onExit={mode.onExit} />
        )
      }
      deco={Array.from({ length: 8 }, (_, i) => (
        <i key={i} className="gpf-flag" style={{ '--k': i } as CSSProperties} />
      ))}
    >
      <div className={`fz-cols${mode.kind === 'room' ? '' : ' is-solo'}`}>
        <div className="fz-main">
          {rows.length >= 2 && <Podium rows={rows} />}

          <ul className="fz-stats" aria-label="Destaques">
            <li style={{ '--d': '300ms' } as CSSProperties}>
              <small>Volta mais rápida</small>
              <b data-testid="gp-final-fastest">{fastest}</b>
            </li>
            <li style={{ '--d': '420ms' } as CSSProperties}>
              <small>Ultrapassagens com o turbo</small>
              <b>{passes}</b>
            </li>
          </ul>

          <ol className="fz-list" aria-label="Classificação">
            {rows.map((r, i) => (
              <li
                key={r.id}
                className={`fz-row${r.you ? ' is-you' : ''}${i === 0 ? ' is-first' : ''}`}
                style={{ '--d': `${400 + i * 70}ms` } as CSSProperties}
                data-testid={`gp-final-row-${i}`}
              >
                <span className="fz-pos">{i + 1}º</span>
                <span className="fz-dot" style={{ background: r.color }} aria-hidden="true" />
                <span className="fz-name">
                  {r.name}
                  {r.you && r.name.toLowerCase() !== 'você' && <small>você</small>}
                  {r.bot && <small className="is-bot">bot</small>}
                </span>
                <span className="fz-val mono">
                  {r.dnf || r.ms === null
                    ? 'DNF'
                    : i === 0
                      ? lapClock(r.ms)
                      : `+${((r.ms - lead) / 1000).toFixed(3)}`}
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
