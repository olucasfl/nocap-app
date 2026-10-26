import { useState } from 'react';
import { BOL_TEAM_COLORS, BOL_TEAM_NAMES, type BolStats } from '@nocap/games';

export interface StatRow extends BolStats {
  id: string;
  name: string;
  team: number;
  bot: boolean;
}

type Key = 'goals' | 'assists' | 'ownGoals' | 'touches' | 'kicks';

const COLS: { key: Key; short: string; long: string }[] = [
  { key: 'goals', short: 'G', long: 'Gols' },
  { key: 'assists', short: 'A', long: 'Assistências' },
  { key: 'ownGoals', short: 'GC', long: 'Gols contra' },
  { key: 'touches', short: 'T', long: 'Toques na bola' },
  { key: 'kicks', short: 'M', long: 'Mortais que chutaram' },
];

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * Tabela de estatísticas (Tab ou menu): um bloco por time, com gols, posse de bola e uma linha por raposa. Clique no título
 * de uma coluna para ordenar e no de um time para recolher.
 */
export function BolaStats({
  rows,
  scores,
  possession,
  clock,
  meId,
  pinned,
  onClose,
}: {
  rows: StatRow[];
  scores: number[];
  possession: number[];
  clock: string;
  meId: string;
  /** Aberta pelo menu: tem botão de fechar (o Tab só mostra enquanto está apertado). */
  pinned: boolean;
  onClose: () => void;
}) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'goals', dir: -1 });
  const [folded, setFolded] = useState<Record<number, boolean>>({});
  const total = possession.reduce((a, b) => a + b, 0);
  const pct = (t: number) => (total > 0 ? Math.round(((possession[t] ?? 0) / total) * 100) : 0);
  const order = (a: StatRow, b: StatRow) => {
    const d = (b[sort.key] - a[sort.key]) * -sort.dir;
    if (d !== 0) return d;
    return b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name);
  };
  const click = (key: Key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));
  return (
    <div
      className="bola-stats"
      role="dialog"
      aria-label="Estatísticas da partida"
      data-testid="bola-stats"
    >
      <header>
        <h2>Estatísticas</h2>
        <span className="mono">{clock}</span>
        {pinned && (
          <button
            type="button"
            className="bola-x"
            onClick={onClose}
            aria-label="Fechar estatísticas"
          >
            Fechar
          </button>
        )}
      </header>
      <div className="bola-poss" role="img" aria-label="Posse de bola por time">
        {scores.map((_, t) => (
          <i
            key={t}
            style={{ flexGrow: Math.max(pct(t), 1), background: css(BOL_TEAM_COLORS[t] as number) }}
          >
            {pct(t) >= 12 ? `${pct(t)}%` : ''}
          </i>
        ))}
      </div>
      <p className="bola-poss-label">Posse de bola</p>
      {scores.map((score, t) => {
        const list = rows.filter((r) => r.team === t).sort(order);
        const open = !folded[t];
        return (
          <section
            key={t}
            className="bola-stat-team"
            style={{ borderColor: css(BOL_TEAM_COLORS[t] as number) }}
          >
            <button
              type="button"
              className="bola-stat-head"
              style={{ background: css(BOL_TEAM_COLORS[t] as number) }}
              aria-expanded={open}
              onClick={() => setFolded((f) => ({ ...f, [t]: open }))}
            >
              <b>Time {BOL_TEAM_NAMES[t]}</b>
              <span>
                {score} {score === 1 ? 'gol' : 'gols'} · {pct(t)}% posse
              </span>
              <em aria-hidden="true">{open ? '−' : '+'}</em>
            </button>
            {open && (
              <table>
                <thead>
                  <tr>
                    <th scope="col">Raposa</th>
                    {COLS.map((c) => (
                      <th key={c.key} scope="col" title={c.long}>
                        <button
                          type="button"
                          onClick={() => click(c.key)}
                          aria-label={`Ordenar por ${c.long}`}
                        >
                          {c.short}
                          {sort.key === c.key ? (sort.dir === -1 ? ' ▾' : ' ▴') : ''}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id} className={r.id === meId ? 'is-me' : ''}>
                      <th scope="row">
                        {r.name}
                        {r.bot ? <small>bot</small> : null}
                      </th>
                      {COLS.map((c) => (
                        <td key={c.key}>{r[c.key]}</td>
                      ))}
                    </tr>
                  ))}
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={COLS.length + 1}>Sem jogadores</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
      <p className="bola-legend">G gols · A assistências · GC gols contra · T toques · M mortais</p>
    </div>
  );
}
