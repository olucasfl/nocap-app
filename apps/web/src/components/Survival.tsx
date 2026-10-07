import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { buzz, sfx } from '@/lib/sfx';
import type { Board } from '@/lib/ranking';
import { EndActions } from './EndActions';
import type { GameTab } from './GameTabs';
import { useReveal } from '@/lib/useReveal';
import { NewRecord } from './NewRecord';
import { SURVIVAL_LIVES } from '@nocap/games';
import './survival.css';

/** Vidas (quadrados cheios/vazios) e a nota mínima da rodada, no topo durante a Sobrevivência. */
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
      <div className="sv-lives" aria-hidden="true">
        {Array.from({ length: SURVIVAL_LIVES }, (_, i) => (
          <i key={i} className={i < lives ? 'on' : lost && i === lives ? 'drop' : ''} />
        ))}
      </div>
      <span className="mono sv-round">RODADA {round}</span>
      <span className="mono sv-min">NOTA MÍNIMA {minScore}</span>
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
  record,
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
  /** Bateu o recorde do modo: mostra o aviso animado. */
  record?: { now: string; before: string } | null;
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
      {done && record && <NewRecord now={record.now} before={record.before} />}
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
