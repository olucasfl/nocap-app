import type { CSSProperties, ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { clock } from '@/components/final/math';
import { FinalShell, type FinalTone } from '@/components/final/FinalShell';
import { RematchActions, RematchPanel, type RematchRoom } from '@/components/final/RematchPanel';
import { useCountUp } from '@/components/final/useCountUp';
import './atr-final.css';

/** Faixas de estrada que correm no cabeçalho (só `transform`). */
const roadDeco = Array.from({ length: 4 }, (_, i) => (
  <i key={i} className="atrf-lane" style={{ '--k': i } as CSSProperties} />
));

export const VERDICT: Record<string, string> = {
  veiculo: 'Atropelado',
  trem: 'O trem passou',
  agua: 'Caiu na água',
  arrastado: 'A tora te levou',
  afundou: 'Afundou',
  mordido: 'O crocodilo mordeu',
  atingido: 'Foi varrido',
  parado: 'Parou demais',
};

/** Fim do Atravessa! sozinho (Infinito): como acabou, as linhas, o recorde, o tempo e o ritmo. */
export function AtravessaSoloFinal({
  end,
  rows,
  seconds,
  before,
  guest,
  note,
  busy,
  onAgain,
  onMenu,
}: {
  end: string | null;
  rows: number;
  /** Tempo de corrida (s). */
  seconds: number;
  /** Recorde anterior, em linhas (0 = nenhum). */
  before: number;
  guest: boolean;
  /** Aviso de salvamento (SaveNote). */
  note: ReactNode;
  busy: boolean;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const shown = useCountUp(rows, 350, 1000);
  const isRecord = !guest && rows > before;
  const best = Math.max(rows, before);
  const tone: FinalTone = isRecord ? 'win' : 'draw';
  return (
    <FinalShell
      theme="atr"
      tone={tone}
      kicker="Atravessa! · Infinito"
      title={VERDICT[end ?? 'parado'] ?? 'Fim de jogo'}
      sub={isRecord ? (before > 0 ? 'Novo recorde!' : 'Seu primeiro recorde!') : undefined}
      label="Resultado do Atravessa!"
      testId="atr-final"
      deco={roadDeco}
      footer={
        <div className="fz-btns">
          <button
            type="button"
            className="fz-btn"
            disabled={busy}
            onClick={onAgain}
            data-sfx="start"
            data-testid="final-again"
          >
            {busy ? 'Preparando…' : 'Jogar de novo'}
          </button>
          {!guest && (
            <Link
              to="/ranking"
              search={{ jogo: 'atravessa', modo: 'infinito' } as never}
              className="fz-btn is-ghost"
              data-sfx="select"
            >
              Ver ranking
            </Link>
          )}
          <button type="button" className="fz-btn is-ghost" onClick={onMenu} data-sfx="back">
            Voltar
          </button>
        </div>
      }
    >
      <div className="fz-cols is-solo">
        <div className="fz-main">
          <div className="atrf-hero">
            {isRecord && (
              <span className="atrf-badge">{before > 0 ? 'Novo recorde' : 'Primeiro recorde'}</span>
            )}
            <span className="atrf-label">Linhas atravessadas</span>
            <b className="atrf-big" data-testid="atr-final-rows" aria-label={`${rows} linhas`}>
              {shown}
            </b>
            {!guest && (
              <span className="atrf-hint">
                {isRecord
                  ? before > 0
                    ? `+${rows - before} sobre o recorde anterior`
                    : 'Esse é o seu primeiro resultado'
                  : `Faltaram ${best - rows + 1} para bater seu recorde`}
              </span>
            )}
          </div>
          <ul className="fz-stats" aria-label="Números da corrida">
            <li style={{ '--d': '300ms' } as CSSProperties}>
              <small>Tempo</small>
              <b>{clock(seconds)}</b>
              <span>de corrida</span>
            </li>
            {!guest && (
              <li style={{ '--d': '540ms' } as CSSProperties}>
                <small>Recorde</small>
                <b>{best}</b>
                <span>linhas</span>
              </li>
            )}
          </ul>
          <div className="atrf-note">{note}</div>
        </div>
      </div>
    </FinalShell>
  );
}

export interface AtrFinalRow {
  id: string;
  name: string;
  color: string;
  you: boolean;
  place: number;
  /** O resultado em texto (metros ou tempo). */
  value: string;
  /** Detalhe embaixo do resultado (mortes, "não chegou"…). */
  note?: string;
  /** De 0 a 1: o tamanho da barra. */
  fraction: number;
}

export interface AtrFinalStat {
  label: string;
  value: string;
  detail: string;
}

/** Fim do Atravessa! em sala (Infinito ou Checkpoint): classificação, destaques e votação de revanche. */
export function AtravessaRoomFinal({
  mode,
  rows,
  stats,
  room,
}: {
  mode: 'infinito' | 'checkpoint';
  rows: AtrFinalRow[];
  stats: AtrFinalStat[];
  room: RematchRoom;
}) {
  const winner = rows[0];
  const me = rows.find((r) => r.you);
  const tone: FinalTone = !me ? 'watch' : me.place === 1 ? 'win' : 'lose';
  const title =
    tone === 'win'
      ? 'Você venceu!'
      : tone === 'lose'
        ? `Você ficou em ${me?.place}º`
        : `${winner?.name ?? 'Alguém'} venceu`;
  const sub =
    tone === 'lose' && winner
      ? `${winner.name} levou a melhor com ${winner.value}.`
      : tone === 'win'
        ? mode === 'checkpoint'
          ? 'Primeiro a cruzar a linha.'
          : 'Ninguém atravessou mais que você.'
        : undefined;
  return (
    <FinalShell
      theme="atr"
      tone={tone}
      kicker={`Atravessa! · ${mode === 'checkpoint' ? 'Checkpoint' : 'Infinito'} · sala`}
      title={title}
      sub={sub}
      label="Resultado do Atravessa!"
      testId="atr-final"
      deco={roadDeco}
      footer={<RematchActions room={room} />}
    >
      <div className="fz-cols">
        <div className="fz-main">
          {stats.length > 0 && (
            <ul className="fz-stats" aria-label="Destaques">
              {stats.map((s, i) => (
                <li key={s.label} style={{ '--d': `${300 + i * 120}ms` } as CSSProperties}>
                  <small>{s.label}</small>
                  <b>{s.value}</b>
                  <span>{s.detail}</span>
                </li>
              ))}
            </ul>
          )}
          <ol className="fz-list" aria-label="Classificação">
            {rows.map((r, i) => (
              <li
                key={r.id}
                className={`fz-row${r.you ? ' is-you' : ''}${r.place === 1 ? ' is-first' : ''}`}
                style={{ '--d': `${400 + i * 70}ms` } as CSSProperties}
                data-testid={`atr-final-row-${i}`}
              >
                <span className="fz-pos">{r.place}º</span>
                <span className="fz-dot" style={{ background: r.color }} aria-hidden="true" />
                <span className="fz-name">
                  {r.name}
                  {r.you && r.name.toLowerCase() !== 'você' && <small>você</small>}
                </span>
                <span className="fz-val">
                  {r.value}
                  {r.note && <small>{r.note}</small>}
                </span>
                <span className="fz-bar" aria-hidden="true">
                  <i style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, r.fraction))})` }} />
                </span>
              </li>
            ))}
          </ol>
        </div>
        <aside>
          <RematchPanel room={room} />
        </aside>
      </div>
    </FinalShell>
  );
}
