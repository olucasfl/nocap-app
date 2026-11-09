import { useMemo } from 'react';
import { SONGS, barStart, batidaMode, evaluateBatida, type BatidaTap } from '@nocap/games';
import { ReflexFinal } from '@/components/ReflexFinal';
import type { GameTab } from '@/components/GameTabs';
import { MatchSummary } from '@/components/MatchSummary';
import type { Board } from '@/lib/ranking';
import type { BatidaRunInfo } from '../types';
import { SaveNote } from '@/components/GuestNotice';
import { useSaveBatida } from '../useSaveBatida';

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

  const board = batidaMode(run.song) as Board;
  const word =
    result.tenths === 0
      ? 'TENTE DE NOVO'
      : result.maxCombo >= 32
        ? 'LENDA'
        : result.maxCombo >= 16
          ? 'NO RITMO'
          : 'BOA';
  return (
    <ReflexFinal
      modeLabel={`Eco Hero · ${song.name}`}
      heroLabel="PONTOS"
      heroValue={Math.round(result.tenths / 10)}
      heroWord={word}
      heroNote={`COMBO ${result.maxCombo}`}
      detailsTitle="Como foi a música"
      details={
        <>
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
        </>
      }
      record={
        <MatchSummary
          game="eco"
          mode={board}
          part="record"
          scoreTenths={result.tenths}
          previousBest={previousBest}
          saved={save === 'saved'}
          onRanking={() => onMenu('ranking', board)}
        />
      }
      ranking={
        <MatchSummary
          game="eco"
          mode={board}
          part="ranking"
          scoreTenths={result.tenths}
          previousBest={previousBest}
          saved={save === 'saved'}
          onRanking={() => onMenu('ranking', board)}
        />
      }
      save={<SaveNote className="eco-save" save={save} />}
      again={onRematch}
      againLabel="Jogar de novo"
      board={board}
      onMenu={onMenu}
    />
  );
}
