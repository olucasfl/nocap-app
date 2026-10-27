import { useEffect, useMemo, useRef, useState } from 'react';
import { BOL_TEAM_COLORS, BOL_TEAM_NAMES } from '@nocap/games';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { StatRow } from './BolaStats';
import './bola-final.css';

/** Uma pessoa da sala (só humanos votam na revanche). */
export interface FinalMember {
  id: string;
  name: string;
  team: number;
  connected: boolean;
  rematch: boolean;
  host: boolean;
}

export type FinalMode =
  | { kind: 'training'; onAgain?: () => void; onExit: () => void }
  | {
      kind: 'room';
      members: FinalMember[];
      voted: boolean;
      isHost: boolean;
      message?: string;
      onVote: (again: boolean) => void;
      onLeave: () => void;
      onClose: () => void;
    };

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Conta de 0 até `to` (o número "sobe" depois de um atraso); com movimento reduzido já mostra o valor final. */
function useCountUp(to: number, delayMs: number, durMs = 900): number {
  const [v, setV] = useState(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setV(to);
      return undefined;
    }
    let raf = 0;
    const t0 = performance.now() + delayMs;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / durMs));
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delayMs, durMs]);
  return v;
}

/** Pontos de "jogou bem": gols pesam mais, depois assistências, mortais que chutaram e toques; gol contra tira. */
const rating = (r: StatRow) =>
  r.goals * 3 + r.assists * 2 + r.kicks * 0.6 + r.touches * 0.05 - r.ownGoals * 2;

const COLS: {
  key: 'goals' | 'assists' | 'ownGoals' | 'touches' | 'kicks';
  short: string;
  long: string;
}[] = [
  { key: 'goals', short: 'G', long: 'Gols' },
  { key: 'assists', short: 'A', long: 'Assistências' },
  { key: 'ownGoals', short: 'GC', long: 'Gols contra' },
  { key: 'touches', short: 'T', long: 'Toques na bola' },
  { key: 'kicks', short: 'M', long: 'Mortais que chutaram' },
];

function TeamCard({
  team,
  score,
  place,
  possession,
  winner,
  mine,
  index,
}: {
  team: number;
  score: number;
  place: number;
  possession: number;
  winner: boolean;
  mine: boolean;
  index: number;
}) {
  const shown = useCountUp(score, 450 + index * 160);
  return (
    <li
      className={`bf-team${winner ? ' is-winner' : ''}${mine ? ' is-mine' : ''}`}
      style={
        {
          '--d': `${index * 120}ms`,
          '--tc': css(BOL_TEAM_COLORS[team] ?? 0xffffff),
        } as React.CSSProperties
      }
    >
      <span className="bf-place">{place}º</span>
      <span className="bf-team-name">
        {BOL_TEAM_NAMES[team]}
        {mine && <small>seu time</small>}
        {winner && <small className="bf-win-tag">vencedor</small>}
      </span>
      <b className="bf-score" aria-label={`${score} gols`}>
        {shown}
      </b>
      <span className="bf-poss" title="Posse de bola">
        <span className="bf-poss-bar" aria-hidden="true">
          <i
            style={{
              transform: `scaleX(${possession / 100})`,
              animationDelay: `${600 + index * 160}ms`,
            }}
          />
        </span>
        <small>{possession}% da bola</small>
      </span>
    </li>
  );
}

/**
 * Tela do fim da partida do Fut Fox (treino e sala): o resultado, o placar de cada time com os números subindo, as
 * estatísticas de cada raposa por time, os destaques, a posse de bola e, na sala, quem já topou jogar de novo, com os
 * botões de votar, sair e (o líder) encerrar. Tudo que anima é só `transform` e `opacity`.
 */
export function BolaFinal({
  scores,
  winner,
  rows,
  possession,
  myTeam,
  meId,
  clock,
  mode,
}: {
  scores: number[];
  winner: number;
  rows: StatRow[];
  possession: number[];
  /** Time de quem olha (-1 = espectador). */
  myTeam: number;
  meId: string;
  /** Duração da partida, para o rodapé do título (ex.: "3:00"). */
  clock: string;
  mode: FinalMode;
}) {
  const [closing, setClosing] = useState(false);
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, []);

  const total = possession.reduce((a, b) => a + b, 0);
  const pct = (t: number) => (total > 0 ? Math.round(((possession[t] ?? 0) / total) * 100) : 0);

  // posição de cada time (empate divide a posição) e a ordem em que aparecem
  const teams = useMemo(() => {
    const list = scores.map((s, t) => ({ t, s }));
    list.sort((a, b) => b.s - a.s || a.t - b.t);
    return list.map((x) => ({ ...x, place: 1 + list.filter((y) => y.s > x.s).length }));
  }, [scores]);

  const tone: 'win' | 'lose' | 'draw' | 'watch' =
    winner < 0 ? 'draw' : myTeam < 0 ? 'watch' : winner === myTeam ? 'win' : 'lose';
  const title =
    tone === 'draw'
      ? 'Empate!'
      : tone === 'win'
        ? 'Vitória!'
        : tone === 'lose'
          ? 'Derrota'
          : `Time ${BOL_TEAM_NAMES[winner]} venceu`;
  const sub =
    tone === 'draw'
      ? 'Ninguém levou a melhor.'
      : tone === 'win'
        ? 'Seu time levou a melhor.'
        : tone === 'lose'
          ? `Time ${BOL_TEAM_NAMES[winner]} venceu desta vez.`
          : 'Fim de partida.';

  const byTeam = (t: number) =>
    rows
      .filter((r) => r.team === t)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || rating(b) - rating(a));
  const best = [...rows].sort((a, b) => rating(b) - rating(a))[0];
  const mvp = best && rating(best) > 0 ? best.id : null;
  const top = (key: 'goals' | 'assists' | 'touches') => {
    const r = [...rows].sort((a, b) => b[key] - a[key])[0];
    return r && r[key] > 0 ? r : null;
  };
  const awards = [
    { label: 'Artilheiro', one: 'gol', many: 'gols', key: 'goals' as const },
    { label: 'Garçom', one: 'assistência', many: 'assistências', key: 'assists' as const },
    { label: 'Mais toques', one: 'toque', many: 'toques', key: 'touches' as const },
  ].flatMap((a) => {
    const r = top(a.key);
    return r ? [{ ...a, r, v: r[a.key] }] : [];
  });

  const room = mode.kind === 'room' ? mode : null;
  const here = room ? room.members.filter((m) => m.connected) : [];
  const votes = here.filter((m) => m.rematch).length;
  const everyone = room ? room.members.every((m) => !m.connected || m.rematch) : false;

  return (
    <div
      className="bf"
      role="dialog"
      aria-modal="true"
      aria-label="Resultado da partida"
      data-testid="bola-final"
    >
      <div className="bf-card" data-tone={tone}>
        <header className="bf-head">
          <span className="bf-kicker">Fim de partida · {clock}</span>
          <h2 className="bf-title" aria-label={title}>
            {[...title].map((ch, i) => (
              <i key={i} aria-hidden="true" style={{ '--i': i } as React.CSSProperties}>
                {ch === ' ' ? ' ' : ch}
              </i>
            ))}
          </h2>
          <p className="bf-sub">{sub}</p>
        </header>

        <ol className="bf-teams" aria-label="Placar">
          {teams.map((x, i) => (
            <TeamCard
              key={x.t}
              team={x.t}
              score={x.s}
              place={x.place}
              possession={pct(x.t)}
              winner={winner === x.t}
              mine={myTeam === x.t}
              index={i}
            />
          ))}
        </ol>

        {awards.length > 0 && (
          <ul className="bf-awards" aria-label="Destaques">
            {awards.map((a, i) => (
              <li key={a.label} style={{ '--d': `${700 + i * 140}ms` } as React.CSSProperties}>
                <small>{a.label}</small>
                <b style={{ color: css(BOL_TEAM_COLORS[a.r.team] ?? 0x1b1535) }}>{a.r.name}</b>
                <span>
                  {a.v} {a.v === 1 ? a.one : a.many}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="bf-cols">
          <section className="bf-players" aria-label="Estatísticas dos jogadores">
            <div className="bf-row bf-row-head" role="row">
              <span>Jogador</span>
              {COLS.map((c) => (
                <abbr key={c.key} title={c.long}>
                  {c.short}
                </abbr>
              ))}
            </div>
            {teams.map((x) => {
              const list = byTeam(x.t);
              if (list.length === 0) return null;
              return (
                <div
                  key={x.t}
                  className="bf-block"
                  style={{ '--tc': css(BOL_TEAM_COLORS[x.t] ?? 0xffffff) } as React.CSSProperties}
                >
                  <div className="bf-block-head">
                    <i aria-hidden="true" />
                    <b>{BOL_TEAM_NAMES[x.t]}</b>
                    <span>
                      {x.s} {x.s === 1 ? 'gol' : 'gols'}
                    </span>
                  </div>
                  {list.map((r, i) => (
                    <div
                      key={r.id}
                      className={`bf-row${r.id === meId ? ' is-you' : ''}`}
                      style={{ '--d': `${500 + i * 70}ms` } as React.CSSProperties}
                    >
                      <span className="bf-name">
                        {r.name}
                        {r.id === meId && r.name.toLowerCase() !== 'você' && <small>você</small>}
                        {r.bot && <small className="is-bot">bot</small>}
                        {r.id === mvp && <small className="is-mvp">MVP</small>}
                      </span>
                      {COLS.map((c) => (
                        <span
                          key={c.key}
                          className={`bf-num${c.key === 'goals' && r.goals > 0 ? ' is-hot' : ''}${c.key === 'ownGoals' && r.ownGoals > 0 ? ' is-bad' : ''}`}
                        >
                          {r[c.key]}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
            <p className="bf-legend">
              G gols · A assistências · GC gols contra · T toques na bola · M mortais que chutaram
            </p>
          </section>

          <aside className="bf-side">
            {room ? (
              <section className="bf-vote" aria-label="Jogar de novo">
                <div className="bf-vote-head">
                  <h3>Jogar de novo?</h3>
                  <span data-testid="bola-final-count">
                    {votes} de {here.length}
                  </span>
                </div>
                <div className="bf-meter" aria-hidden="true">
                  <i style={{ transform: `scaleX(${here.length ? votes / here.length : 0})` }} />
                </div>
                <ul className="bf-members">
                  {room.members.map((m) => {
                    const state = !m.connected ? 'off' : m.rematch ? 'yes' : 'wait';
                    return (
                      <li key={m.id} data-state={state} className={m.id === meId ? 'is-you' : ''}>
                        <i
                          aria-hidden="true"
                          style={{ background: css(BOL_TEAM_COLORS[m.team] ?? 0x9a97b5) }}
                        />
                        <span className="bf-mname">
                          {m.name}
                          {m.host && <small>líder</small>}
                          {m.id === meId && m.name.toLowerCase() !== 'você' && <small>você</small>}
                        </span>
                        <b>
                          {state === 'yes' ? 'Quer jogar' : state === 'wait' ? 'Pensando…' : 'Saiu'}
                        </b>
                      </li>
                    );
                  })}
                </ul>
                <p className="bf-hint">
                  {everyone
                    ? 'Todo mundo topou. A sala volta ao lobby com as mesmas regras.'
                    : room.voted
                      ? 'Seu voto foi enviado. Quando todo mundo votar, a sala volta ao lobby.'
                      : 'Quando todo mundo votar, a sala volta ao lobby. Quem não quer, sai.'}
                </p>
                {room.message && (
                  <p className="bf-error" role="alert">
                    {room.message}
                  </p>
                )}
                <div className="bf-btns">
                  <button
                    ref={primary}
                    type="button"
                    className={`bf-btn${room.voted ? ' is-ghost' : ''}`}
                    aria-pressed={room.voted}
                    onClick={() => room.onVote(!room.voted)}
                    data-testid="bola-final-vote"
                  >
                    {room.voted ? 'Mudei de ideia' : 'Jogar de novo'}
                  </button>
                  <button
                    type="button"
                    className="bf-btn is-ghost"
                    onClick={room.onLeave}
                    data-testid="bola-final-leave"
                  >
                    Sair da sala
                  </button>
                  {room.isHost && (
                    <button
                      type="button"
                      className="bf-btn is-danger"
                      onClick={() => setClosing(true)}
                      data-testid="bola-final-close"
                    >
                      Encerrar sala
                    </button>
                  )}
                </div>
                <ConfirmDialog
                  open={closing}
                  title="Encerrar a sala?"
                  text="Todo mundo que está na sala será removido e a sala deixa de existir."
                  confirmLabel="Encerrar"
                  confirmSfx="remove"
                  onConfirm={() => {
                    setClosing(false);
                    room.onClose();
                  }}
                  onCancel={() => setClosing(false)}
                />
              </section>
            ) : (
              <section className="bf-vote" aria-label="Próximo passo">
                <div className="bf-vote-head">
                  <h3>E agora?</h3>
                </div>
                <p className="bf-hint">Treino contra bots: não entra no ranking.</p>
                <div className="bf-btns">
                  <button
                    ref={primary}
                    type="button"
                    className="bf-btn"
                    onClick={mode.kind === 'training' ? mode.onAgain : undefined}
                    data-testid="bola-again"
                  >
                    Jogar de novo
                  </button>
                  <button
                    type="button"
                    className="bf-btn is-ghost"
                    onClick={mode.kind === 'training' ? mode.onExit : undefined}
                    data-testid="bola-final-exit"
                  >
                    Voltar
                  </button>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
