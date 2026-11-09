import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { Board } from '@/lib/ranking';
import type { GameTab } from './GameTabs';
import './reflex-final.css';

/**
 * O fim de partida dos jogos de reflexo e precisão (Mesmíssima, Já Deu?, Ecooo; spec 069): em vez de uma pilha de blocos, cada
 * coisa no seu cartão. No celular: nota, recorde, detalhes, ranking e uma barra de botões presa embaixo. No computador: a nota e o
 * recorde à esquerda, os detalhes e o ranking à direita, e os botões embaixo.
 */
export function ReflexFinal({
  modeLabel,
  heroLabel,
  heroValue,
  heroUnit,
  heroWord,
  heroNote,
  detailsTitle,
  details,
  record,
  ranking,
  save,
  again,
  againLabel = 'Revanche',
  board,
  onMenu,
  testId,
}: {
  modeLabel: string;
  heroLabel: string;
  heroValue: ReactNode;
  heroUnit?: string;
  /** A palavra da faixa ("mandou bem", "ECO PERFEITO"...). */
  heroWord?: ReactNode;
  heroNote?: ReactNode;
  detailsTitle: string;
  details: ReactNode;
  /** O cartão da nota contra o recorde (não vale no Daily). */
  record?: ReactNode;
  /** O lugar no ranking (ou o painel do Daily). */
  ranking?: ReactNode;
  save?: ReactNode;
  /** Jogar de novo; sem isso (Daily) o botão some. */
  again?: () => void;
  againLabel?: string;
  board?: Board;
  onMenu: (tab: GameTab, board?: Board) => void;
  testId?: string;
}) {
  return (
    <section className="screen rf" data-testid={testId ?? 'reflex-final'}>
      <header className="rf-head">
        <span className="mono rf-chip">{modeLabel}</span>
        <h1>Fim da partida</h1>
      </header>

      <div className="rf-grid">
        <div className="rf-col rf-main">
          <section className="rf-card rf-hero" aria-label="Sua pontuação">
            <span className="mono rf-label">{heroLabel}</span>
            <b className="rf-score">
              {heroValue}
              {heroUnit && <small className="mono">{heroUnit}</small>}
            </b>
            {heroWord && <span className="rf-word">{heroWord}</span>}
            {heroNote && <span className="mono rf-note">{heroNote}</span>}
          </section>
          {record}
          {save}
        </div>
        <div className="rf-col rf-side">
          <section className="rf-card" aria-label={detailsTitle}>
            <h2 className="rf-h">{detailsTitle}</h2>
            {details}
          </section>
          {ranking}
        </div>
      </div>

      <ReflexActions again={again} againLabel={againLabel} board={board} onMenu={onMenu} />
    </section>
  );
}

/** A barra de botões do fim de partida: jogar de novo, ranking, modos e jogos. */
export function ReflexActions({
  again,
  againLabel = 'Revanche',
  board,
  onMenu,
}: {
  again?: () => void;
  againLabel?: string;
  board?: Board;
  onMenu: (tab: GameTab, board?: Board) => void;
}) {
  return (
    <nav className="rf-actions" aria-label="O que fazer agora">
      {again && (
        <button
          type="button"
          className="btn alt"
          data-sfx="start"
          onClick={again}
          data-testid="final-again"
        >
          {againLabel}
        </button>
      )}
      <button
        type="button"
        className="btn ghost"
        data-sfx="select"
        onClick={() => onMenu('ranking', board)}
      >
        Ranking
      </button>
      <button
        type="button"
        className="btn ghost"
        data-sfx="back"
        onClick={() => onMenu('modes')}
        data-testid="final-modes"
      >
        Modos
      </button>
      <Link to="/" className="btn ghost">
        Jogos
      </Link>
    </nav>
  );
}
