import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { buzz, sfx } from '@/lib/sfx';
import type { Board } from '@/lib/ranking';
import { EndActions } from './EndActions';
import type { GameTab } from './GameTabs';
import { useReveal } from '@/lib/useReveal';
import { SURVIVAL_LIVES } from '@nocap/games';
import './survival.css';

const HEART =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

/**
 * As vidas: um coração cheio para cada vida que sobrou e um contorno apagado para cada uma que se
 * foi. Quando acabou de perder uma, o coração enche, estoura e some. Só transform/opacity; parado
 * (sem batida) para valer também durante a contagem do Tempo.
 */
export function Lives({ lives, lost = false }: { lives: number; lost?: boolean }) {
  return (
    <div className="sv-lives-box" role="img" aria-label={`${lives} de ${SURVIVAL_LIVES} vidas`}>
      <span className="mono sv-lives-tag">VIDAS</span>
      <span className="sv-hearts" aria-hidden="true">
        {Array.from({ length: SURVIVAL_LIVES }, (_, i) => {
          const state = i < lives ? 'on' : lost && i === lives ? 'drop' : 'off';
          return (
            <span key={i} className={`sv-heart ${state}`}>
              <svg viewBox="0 0 24 24" className="sv-heart-base">
                <path d={HEART} />
              </svg>
              <svg viewBox="0 0 24 24" className="sv-heart-fill">
                <path d={HEART} />
              </svg>
            </span>
          );
        })}
      </span>
      <span className="mono sv-lives-n">
        {lives}/{SURVIVAL_LIVES}
      </span>
    </div>
  );
}

/** As vidas e a nota mínima da rodada, no topo durante a Sobrevivência. */
export function SurvivalBar({
  lives,
  minScore,
  round,
  lost = false,
}: {
  lives: number;
  minScore: number;
  round: number;
  /** Acabou de perder uma vida: o quadrado que sumiu anima ao se apagar. */
  lost?: boolean;
}) {
  return (
    <div
      className="sv-bar"
      role="status"
      aria-label={`Rodada ${round}, ${lives} vidas, nota mínima ${minScore}`}
    >
      <Lives lives={lives} lost={lost} />
      <div className="sv-info">
        <span className="mono sv-round">RODADA {round}</span>
        <span className="mono sv-min">NOTA MÍNIMA {minScore}</span>
      </div>
    </div>
  );
}

/** Depois de cada rodada: passou ou perdeu uma vida (e quantas restam). */
export function SurvivalVerdict({
  passed,
  lives,
  minScore,
  over,
}: {
  passed: boolean;
  lives: number;
  minScore: number;
  over: boolean;
}) {
  useEffect(() => {
    if (passed) sfx.coin();
    else sfx.lifeLost();
  }, [passed]);
  return (
    <>
      {/* Clarão de tela inteira, só opacidade: verde passou, laranja perdeu vida. */}
      <div className={`sv-flash ${passed ? 'ok' : 'bad'}`} aria-hidden="true" />
      <p className={`sv-verdict ${passed ? 'ok' : 'bad'}`} role="status">
        {passed ? (
          <span className="sv-burst" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} style={{ '--a': `${i * 45}deg` } as CSSProperties} />
            ))}
          </span>
        ) : (
          <span className="sv-crack" aria-hidden="true" />
        )}
        {passed
          ? `Passou! Nota mínima ${minScore}.`
          : over
            ? `Abaixo de ${minScore}: acabaram as vidas.`
            : `Abaixo de ${minScore}: perdeu uma vida. Restam ${lives}.`}
      </p>
    </>
  );
}

export interface SurvivalRow {
  /** Texto da esquerda (ex.: "ΔE 4.1" ou "4,80 s → 4,62 s"). */
  detail: string;
  score: number;
  passed: boolean;
}

/** Resultado da Sobrevivência: quantas rodadas a pessoa jogou e como foi cada uma. */
export function SurvivalFinal({
  completed,
  limit,
  rows,
  table,
  saveText,
  summary,
  onMenu,
  onRematch,
}: {
  completed: boolean;
  /** Limite de rodadas do modo (quem chega até aqui ganha). */
  limit: number;
  rows: SurvivalRow[];
  /** Substitui a lista padrão de rodadas (o Tempo usa a tabela de colunas). */
  table?: (shown: number) => ReactNode;
  saveText: string;
  /** Volta ao menu do jogo (ranking do modo ou lista de modos). */
  onMenu: (tab: GameTab, board?: Board) => void;
  /** Nota contra o recorde e lugar no ranking (o `MatchSummary` do jogo). */
  summary?: ReactNode;
  onRematch: () => void;
}) {
  // Rodada por rodada: o número de rodadas sobe junto com as linhas que aparecem.
  const { shown, done } = useReveal(rows.length, (i) =>
    rows[i]!.passed ? sfx.coin() : sfx.lifeLost(),
  );
  useEffect(() => {
    if (!done) return;
    if (completed) sfx.win();
    else sfx.gameOver();
    buzz(40);
  }, [done, completed]);
  return (
    <section className="screen">
      <div className="sv-total">
        <div className="mono">{completed ? 'COMPLETOU!' : 'VOCÊ JOGOU'}</div>
        <b>{shown}</b>
        <div className="mono">{shown === 1 ? 'RODADA' : 'RODADAS'}</div>
        {done && completed && <small className="mono">LIMITE DE {limit} RODADAS</small>}
      </div>
      {table?.(shown) ?? (
        <ul className="sv-rows">
          {rows.map((r, i) => (
            <li key={i} className={`${r.passed ? 'ok' : 'bad'}${i < shown ? ' in' : ' pending'}`}>
              <span className="mono">{i + 1}</span>
              <span className="mono sv-detail">{r.detail}</span>
              <b>{r.score.toFixed(1)}</b>
              <span className="mono sv-tag">{r.passed ? 'PASSOU' : 'VIDA'}</span>
            </li>
          ))}
        </ul>
      )}
      {done && summary}
      <p className="sv-save mono" role="status">
        {saveText}
      </p>
      <div className="stack">
        <button type="button" className="btn alt" onClick={onRematch}>
          Jogar de novo
        </button>
        <EndActions board="survival" onMenu={onMenu} />
        <Link to="/" className="btn ghost">
          Voltar aos jogos
        </Link>
      </div>
    </section>
  );
}
