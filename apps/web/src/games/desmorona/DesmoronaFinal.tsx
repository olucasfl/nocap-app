import type { CSSProperties } from 'react';
import { clock } from '@/components/final/math';
import { FinalShell, type FinalTone } from '@/components/final/FinalShell';
import { RematchPanel, TrainingActions, type RematchRoom } from '@/components/final/RematchPanel';
import { useCountUp } from '@/components/final/useCountUp';
import './dsm-final.css';

export interface DsmFinalRow {
  id: string;
  name: string;
  /** Cor da raposa (css). */
  color: string;
  you: boolean;
  bot?: boolean;
  /** Quando caiu (s de jogo); null = ficou de pé até o fim. */
  fellAt: number | null;
  /** Andar mais fundo que alcançou (1 a 6); só no treino. */
  floor?: number;
}

export type DsmFinalMode =
  | { kind: 'training'; onAgain?: () => void; onExit: () => void }
  | { kind: 'room'; room: RematchRoom };

/** Os três primeiros no pódio (o 1º no meio e mais alto). */
function Podium({ rows }: { rows: DsmFinalRow[] }) {
  const top = rows.slice(0, 3);
  // ordem visual: 2º, 1º, 3º
  const order = [top[1], top[0], top[2]].flatMap((r, i) => {
    const place = [2, 1, 3][i] as number;
    return r ? [{ r, place }] : [];
  });
  return (
    <ol className="dsf-podium" aria-label="Pódio">
      {order.map(({ r, place }) => (
        <li
          key={r.id}
          className={`dsf-pod p${place}${r.you ? ' is-you' : ''}`}
          style={{ '--d': `${place === 1 ? 500 : place === 2 ? 350 : 250}ms` } as CSSProperties}
        >
          <span className="dsf-fox" style={{ background: r.color }} aria-hidden="true" />
          <b className="dsf-pod-name">{r.name}</b>
          <span className="dsf-block">
            <i>{place}º</i>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Tela do fim do Desmorona! (treino e sala): quem venceu, o pódio, a classificação com quanto cada um durou e os
 * destaques da partida. Na sala traz a votação de "jogar de novo"; no treino, jogar de novo e voltar.
 */
export function DesmoronaFinal({
  rows,
  seconds,
  mode,
}: {
  /** Do 1º ao último. */
  rows: DsmFinalRow[];
  /** Duração da partida (s). */
  seconds: number;
  mode: DsmFinalMode;
}) {
  const winner = rows[0];
  const meIdx = rows.findIndex((r) => r.you);
  const me = meIdx >= 0 ? rows[meIdx] : undefined;
  const tone: FinalTone = !me ? 'watch' : meIdx === 0 ? 'win' : 'lose';
  const title =
    tone === 'win'
      ? 'Você venceu!'
      : tone === 'lose'
        ? `Você ficou em ${meIdx + 1}º`
        : `${winner?.name ?? 'Alguém'} venceu`;
  const sub =
    tone === 'win'
      ? 'O último de pé. Ninguém te derrubou.'
      : tone === 'lose'
        ? `${winner?.name ?? 'Alguém'} foi o último de pé${me?.fellAt != null ? `. Você caiu aos ${clock(me.fellAt)}.` : '.'}`
        : 'Fim de partida.';

  const fallen = rows.filter((r) => r.fellAt !== null);
  const first = [...fallen].sort((a, b) => (a.fellAt as number) - (b.fellAt as number))[0];
  const deepest = rows.reduce<DsmFinalRow | null>(
    (best, r) => (r.floor && (!best || r.floor > (best.floor ?? 0)) ? r : best),
    null,
  );
  const shownSeconds = useCountUp(Math.round(seconds), 450, 800);

  return (
    <FinalShell
      theme="dsm"
      tone={tone}
      kicker={`Desmorona! · fim de partida · ${rows.length} ${rows.length === 1 ? 'raposa' : 'raposas'}`}
      title={title}
      sub={sub}
      label="Resultado do Desmorona!"
      testId="dsm-final"
      deco={Array.from({ length: 7 }, (_, i) => (
        <i key={i} className="dsf-tile" style={{ '--k': i } as CSSProperties} />
      ))}
    >
      <div className="fz-cols">
        <div className="fz-main">
          {rows.length >= 3 && <Podium rows={rows} />}

          <ul className="fz-stats" aria-label="Destaques">
            <li style={{ '--d': '300ms' } as CSSProperties}>
              <small>Duração</small>
              <b data-testid="dsm-final-time">{clock(shownSeconds)}</b>
              <span>até o último cair</span>
            </li>
            {first && rows.length > 1 && (
              <li style={{ '--d': '420ms' } as CSSProperties}>
                <small>Caiu primeiro</small>
                <b style={{ color: first.color }}>{first.name}</b>
                <span>aos {clock(first.fellAt as number)}</span>
              </li>
            )}
            {deepest && (
              <li style={{ '--d': '540ms' } as CSSProperties}>
                <small>Foi mais fundo</small>
                <b style={{ color: deepest.color }}>{deepest.name}</b>
                <span>até o andar {deepest.floor}</span>
              </li>
            )}
          </ul>

          <ol className="fz-list" aria-label="Classificação">
            {rows.map((r, i) => {
              const k = r.fellAt === null || seconds <= 0 ? 1 : Math.min(1, r.fellAt / seconds);
              return (
                <li
                  key={r.id}
                  className={`fz-row${r.you ? ' is-you' : ''}${i === 0 ? ' is-first' : ''}`}
                  style={{ '--d': `${400 + i * 70}ms` } as CSSProperties}
                  data-testid={`dsm-final-row-${i}`}
                >
                  <span className="fz-pos">{i + 1}º</span>
                  <span className="fz-dot" style={{ background: r.color }} aria-hidden="true" />
                  <span className="fz-name">
                    {r.name}
                    {r.you && r.name.toLowerCase() !== 'você' && <small>você</small>}
                    {r.bot && <small className="is-bot">bot</small>}
                  </span>
                  <span className="fz-val">
                    {r.fellAt === null ? 'Último de pé' : `caiu aos ${clock(r.fellAt)}`}
                  </span>
                  <span className="fz-bar" aria-hidden="true">
                    <i style={{ transform: `scaleX(${k})` }} />
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <aside>
          {mode.kind === 'room' ? (
            <RematchPanel room={mode.room} />
          ) : (
            <TrainingActions
              note="Treino contra bots: não entra no ranking."
              onAgain={mode.onAgain}
              onExit={mode.onExit}
            />
          )}
        </aside>
      </div>
    </FinalShell>
  );
}
