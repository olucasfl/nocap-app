import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { SONGS, barStart, batidaMode, evaluateBatida, type BatidaTap } from '@nocap/games';
import { EndActions } from '@/components/EndActions';
import type { GameTab } from '@/components/GameTabs';
import { MatchSummary } from '@/components/MatchSummary';
import type { Board } from '@/lib/ranking';
import type { BatidaRunInfo } from '../types';
import { SAVE_TEXT, useSaveBatida } from '../useSaveBatida';

interface Props {
  run: BatidaRunInfo;
  taps: BatidaTap[];
  /** Recorde do Batida antes desta partida (décimos); `undefined` = sem estatísticas. */
  previousBest?: number;
  onMenu: (tab: GameTab, board?: Board) => void;
  onRematch: () => void;
}

/** Quanto tempo a música durou, em "1:05". */
const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Fim da partida do Batida: pontos, acertos por tipo, maior combo e a nota contra o recorde. */
export function BatidaFinal({ run, taps, previousBest, onMenu, onRematch }: Props) {
  // O mesmo cálculo do servidor: refaz a partida a partir dos toques.
  const song = SONGS[run.song];
  const result = useMemo(() => evaluateBatida(run.seed, song, taps), [run.seed, song, taps]);
  const save = useSaveBatida(run, taps);
  const played = Math.max(0, result.endedAtMs - barStart(song, 1));
  const notes = result.perfect + result.good + result.missed;

  return (
    <section className="screen">
      <div className="mono eco-label">ECO HERO · {song.name.toUpperCase()}</div>
      <div className="eco-total">
        <div>
          <div className="mono eco-label">PONTOS</div>
          <b>{Math.round(result.tenths / 10)}</b>
        </div>
        <div className="eco-total-side">
          <span className="eco-word">
            {result.tenths === 0
              ? 'TENTE DE NOVO'
              : result.maxCombo >= 32
                ? 'LENDA'
                : result.maxCombo >= 16
                  ? 'NO RITMO'
                  : 'BOA'}
          </span>
          <span className="mono">COMBO {result.maxCombo}</span>
        </div>
      </div>

      <dl className="bt-stats mono">
        <div>
          <dt>PERFEITOS</dt>
          <dd>{result.perfect}</dd>
        </div>
        <div>
          <dt>BONS</dt>
          <dd>{result.good}</dd>
        </div>
        <div>
          <dt>PERDIDOS</dt>
          <dd>{result.missed + result.stray}</dd>
        </div>
        <div>
          <dt>SEGURADAS</dt>
          <dd>{result.holds}</dd>
        </div>
        <div>
          <dt>DURAÇÃO</dt>
          <dd>{clock(played)}</dd>
        </div>
      </dl>
      <p className="mono eco-end">
        {notes === 0
          ? 'NENHUMA NOTA TOCADA'
          : `${notes} NOTAS · A ENERGIA ACABOU NO COMPASSO ${result.endedBar}`}
      </p>

      <MatchSummary
        game="eco"
        mode={batidaMode(run.song) as Board}
        scoreTenths={result.tenths}
        previousBest={previousBest}
        saved={save === 'saved'}
        onRanking={() => onMenu('ranking', batidaMode(run.song) as Board)}
      />
      <p className="eco-save" role="status">
        {SAVE_TEXT[save]}
      </p>
      <div className="stack">
        <button type="button" className="btn alt" data-sfx="start" onClick={onRematch}>
          Jogar de novo
        </button>
        <EndActions board={batidaMode(run.song) as Board} onMenu={onMenu} />
        <Link to="/" className="btn ghost">
          Voltar aos jogos
        </Link>
      </div>
    </section>
  );
}
