import { useEffect, type CSSProperties } from 'react';
import { Link } from '@tanstack/react-router';
import { buzz, sfx } from '@/lib/sfx';
import { NewRecord } from './NewRecord';
import { SURVIVAL_LIVES, SURVIVAL_MAX_ROUNDS } from '@nocap/games';
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
  played,
  completed,
  rows,
  saveText,
  game,
  record,
  onRematch,
}: {
  played: number;
  completed: boolean;
  rows: SurvivalRow[];
  saveText: string;
  game: 'cor' | 'tempo';
  /** Bateu o recorde do modo: mostra o aviso animado. */
  record?: { now: string; before: string } | null;
  onRematch: () => void;
}) {
  useEffect(() => {
    if (completed) sfx.win();
    else sfx.gameOver();
    buzz(40);
  }, [completed]);
  return (
    <section className="screen">
      {record && <NewRecord now={record.now} before={record.before} />}
      <div className="sv-total">
        <div className="mono">{completed ? 'COMPLETOU!' : 'VOCÊ JOGOU'}</div>
        <b>{played}</b>
        <div className="mono">{played === 1 ? 'RODADA' : 'RODADAS'}</div>
        {completed && <small className="mono">LIMITE DE {SURVIVAL_MAX_ROUNDS} RODADAS</small>}
      </div>
      <ul className="sv-rows">
        {rows.map((r, i) => (
          <li key={i} className={r.passed ? 'ok' : 'bad'}>
            <span className="mono">{i + 1}</span>
            <span className="mono sv-detail">{r.detail}</span>
            <b>{r.score.toFixed(1)}</b>
            <span className="mono sv-tag">{r.passed ? 'PASSOU' : 'VIDA'}</span>
          </li>
        ))}
      </ul>
      <p className="sv-save mono" role="status">
        {saveText}
      </p>
      <div className="stack">
        <button type="button" className="btn alt" onClick={onRematch}>
          Jogar de novo
        </button>
        <Link to={`/${game}`} search={{ aba: 'ranking', quadro: 'survival' }} className="btn ghost">
          Ver ranking
        </Link>
        <Link to={`/${game}`} className="btn ghost">
          Modos do jogo
        </Link>
        <Link to="/" className="btn ghost">
          Voltar aos jogos
        </Link>
      </div>
    </section>
  );
}
