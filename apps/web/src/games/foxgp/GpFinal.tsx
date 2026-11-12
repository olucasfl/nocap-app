import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GpKartPaint, GpPaint } from '@nocap/games';
import type { RematchRoom } from '@/components/final/RematchPanel';
import { GpPodium3D } from './GpPodium3D';
import { lapClock } from './format';
import { GP_THEME } from './theme';
import './theme.css';
import './gp-final.css';

export interface GpFinalRow {
  id: string;
  name: string;
  /** Cor da raposa (css). */
  color: string;
  /** Cor do pelo (número) e pintura, para o carro no pódio. */
  fur?: number;
  paint?: GpPaint | null;
  /** A pintura do kart (pódio do Arcade). */
  kart?: GpKartPaint | null;
  you: boolean;
  bot?: boolean;
  /** Tempo total da corrida (ms); null = não terminou. */
  ms: number | null;
  best: number | null;
  dnf: boolean;
}

export type GpFinalMode =
  | { kind: 'training'; onAgain?: () => void; onExit: () => void }
  | { kind: 'room'; room: RematchRoom };

const CONFETTI = ['#ff7d26', '#2f5bff', '#ffd23a', '#f4f6fb', '#29c26a', '#e8343c'];

/**
 * Pódio do Fox GP (spec 079, 3.5), no tema do artifact: o pódio em 3D com os carros dos três primeiros (o campeão com o
 * troféu), confetes, a tabela completa (vencedor com o tempo total, os outros com a diferença, DNF para quem não chegou) e
 * os destaques: volta mais rápida e o modo de física da partida. Treino: correr de novo ou voltar. Sala: revanche
 * por votação, sair, e o líder encerra a sala.
 */
export function GpFinal({
  rows,
  fastest,
  physics,
  mode,
}: {
  rows: GpFinalRow[];
  fastest: string;
  /** Nome do modo de física da partida (Arcade ou Realista). */
  physics: string;
  mode: GpFinalMode;
}) {
  const winner = rows[0];
  const meIdx = rows.findIndex((r) => r.you);
  const me = meIdx >= 0 ? rows[meIdx] : undefined;
  const won = !!me && meIdx === 0 && !me.dnf;
  const title = won
    ? 'Vitória'
    : me?.dnf
      ? 'Não terminou'
      : me
        ? `${meIdx + 1}º lugar`
        : `${winner?.name ?? ''} venceu`;
  const lead = winner?.ms ?? 0;
  const reduced = useMemo(
    () =>
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => card.current?.focus({ preventScroll: true }), []);
  const [sureClose, setSureClose] = useState(false);
  const room = mode.kind === 'room' ? mode.room : null;
  const votes = room ? room.members.filter((m) => m.connected && m.rematch).length : 0;
  const here = room ? room.members.filter((m) => m.connected).length : 0;
  return (
    <div
      className="gpf"
      role="dialog"
      aria-modal="true"
      aria-label="Resultado do Fox GP"
      data-testid="gp-final"
      tabIndex={-1}
      ref={card}
    >
      <div className="gpf-stripes" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="gpf-flag gp-checker" aria-hidden="true" />
      {!reduced && (
        <div className="gpf-confetti" aria-hidden="true">
          {Array.from({ length: 36 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  '--x': `${(i * 37) % 100}%`,
                  '--d': `${(i * 0.17) % 2.4}s`,
                  '--t': `${2.6 + ((i * 7) % 10) / 6}s`,
                  '--r': `${(i * 53) % 360}deg`,
                  background: CONFETTI[i % CONFETTI.length],
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      <div className="gpf-left">
        <div className="gpf-head">
          <span className="gp-kicker">Bandeirada · {physics === 'Arcade' ? 'Bala Track' : 'Circuito da Marina'}</span>
          <h1 className="gp-title gpf-title">
            {title}
            {won && <span>!</span>}
          </h1>
        </div>
        <div className="gpf-podium">
          <GpPodium3D
            kart={physics === 'Arcade'}
            top={rows
              .slice(0, 3)
              .map((r) => ({ name: r.name, fur: r.fur ?? 0xff7d26, paint: r.paint ?? null, kart: r.kart ?? null }))}
          />
          <ol className="gpf-podium-names" aria-label="Pódio">
            {rows.slice(0, 3).map((r, i) => (
              <li
                key={r.id}
                className={`p${i + 1}`}
                style={{ '--m': GP_THEME.medals[i] } as CSSProperties}
              >
                <b>{i + 1}º</b> {r.name}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="gpf-right">
        <div className="gp-tpanel gpf-table" role="table" aria-label="Classificação final">
          <div className="gpf-tr gpf-th" role="row">
            <span role="columnheader">Pos</span>
            <span role="columnheader">Piloto</span>
            <span role="columnheader">Tempo</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.id}
              role="row"
              className={`gpf-tr${r.you ? ' is-you' : ''}`}
              style={
                {
                  '--d': `${300 + i * 70}ms`,
                  '--m': GP_THEME.medals[i] ?? GP_THEME.muted,
                } as CSSProperties
              }
              data-testid={`gp-final-row-${i}`}
            >
              <span role="cell" className="gpf-pos">
                {i + 1}
              </span>
              <span role="cell" className="gpf-name">
                <i style={{ background: r.color }} aria-hidden="true" />
                {r.name}
                {r.bot && <small>bot</small>}
              </span>
              <span role="cell" className="gpf-time gpn">
                {r.dnf || r.ms === null
                  ? 'DNF'
                  : i === 0
                    ? lapClock(r.ms)
                    : `+${((r.ms - lead) / 1000).toFixed(3)}`}
              </span>
            </div>
          ))}
        </div>
        <div className="gpf-stats">
          <div className="gp-tpanel">
            <span className="gp-kicker">Volta mais rápida</span>
            <b data-testid="gp-final-fastest">{fastest}</b>
          </div>
          <div className="gp-tpanel">
            <span className="gp-kicker">Física</span>
            <b data-testid="gp-final-physics">{physics}</b>
          </div>
        </div>
        {room && (
          <p className="gpf-votes" role="status">
            Revanche: {votes} de {here} {room.message ? `· ${room.message}` : ''}
          </p>
        )}
        <div className="gpf-btns">
          {mode.kind === 'training' ? (
            <>
              <button
                type="button"
                className="gp-tbtn is-ghost"
                onClick={mode.onExit}
                data-testid="final-exit"
              >
                Voltar
              </button>
              {mode.onAgain && (
                <button
                  type="button"
                  className="gp-tbtn is-primary"
                  onClick={mode.onAgain}
                  data-testid="final-again"
                >
                  Correr de novo
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="gp-tbtn is-ghost"
                onClick={room!.onLeave}
                data-testid="final-leave"
              >
                Sair da sala
              </button>
              <button
                type="button"
                className="gp-tbtn is-primary"
                aria-pressed={room!.voted}
                onClick={() => room!.onVote(!room!.voted)}
                data-testid="final-rematch"
              >
                {room!.voted ? 'Esperando a revanche' : 'Revanche'}
              </button>
              {room!.isHost && (
                <button
                  type="button"
                  className={`gp-tbtn is-ghost${sureClose ? ' is-sure' : ''}`}
                  onClick={() => (sureClose ? room!.onClose() : setSureClose(true))}
                  onBlur={() => setSureClose(false)}
                >
                  {sureClose ? 'Toque de novo para encerrar' : 'Encerrar a sala'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
