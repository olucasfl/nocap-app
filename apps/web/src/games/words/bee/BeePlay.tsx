import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { wordKey } from '@nocap/games';
import { ApiError } from '@/lib/api-client';
import { BackButton } from '@/components/BackButton';
import { Loader } from '@/components/Loader';
import { wordsAudio } from '@/lib/words-audio';
import { BEE_RANK_STEPS, REJECT_TEXT, finishBee, sendBeeWord, startBee, type BeeView } from './bee-api';
import './bee.css';

/** Hexágono de ponta para cima centrado em (cx, cy) com raio `r`. */
function hex(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

const OUTER: [number, number][] = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 90);
  return [150 + 84 * Math.cos(a), 140 + 84 * Math.sin(a)];
});

export function BeePlay() {
  const [run, setRun] = useState<BeeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [order, setOrder] = useState<string[]>([]);
  const [toast, setToast] = useState<{ text: string; good: boolean } | null>(null);
  const [latest, setLatest] = useState<string | null>(null);
  const [wave, setWave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    startBee()
      .then((r) => {
        setRun(r);
        setOrder(r.letters);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Não deu para abrir o favo'));
  }, []);

  const say = useCallback((text: string, good = false) => {
    setToast({ text, good });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  const allowed = useMemo(() => new Set(run ? [run.center, ...run.letters] : []), [run]);
  const open = !!run && !run.closed;

  const submit = useCallback(async () => {
    if (!run || !open || busy) return;
    if (typed.length === 0) return;
    setBusy(true);
    try {
      const move = await sendBeeWord(run.id, typed);
      if (move.result === 'rejected') {
        wordsAudio.invalid();
        say(REJECT_TEXT[move.reason]);
      } else {
        const rankUp = move.run.rank.id !== run.rank.id;
        setRun(move.run);
        setLatest(move.shown);
        if (move.pangram) {
          setWave(true);
          window.setTimeout(() => setWave(false), 1200);
        }
        say(move.pangram ? `Pangrama! +${move.points}` : `+${move.points}`, true);
        if (move.pangram || rankUp) wordsAudio.win();
        else wordsAudio.row('hh');
      }
      setTyped('');
    } catch (e) {
      say(e instanceof ApiError && e.status === 409 ? 'O dia fechou' : 'Sem conexão. Tente de novo');
    } finally {
      setBusy(false);
    }
  }, [run, open, busy, typed, say]);

  const add = useCallback(
    (l: string) => {
      wordsAudio.key();
      setTyped((t) => (t.length < 20 ? t + l : t));
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'Enter') void submit();
      else if (ev.key === 'Backspace') setTyped((t) => t.slice(0, -1));
      else {
        const k = wordKey(ev.key);
        if (k.length === 1 && allowed.has(k)) add(k);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, allowed, add, submit]);

  if (error) {
    return (
      <div className="app">
        <main className="screen cw">
          <BackButton to="/words/bee" />
          <p className="cw-error">{error}</p>
        </main>
      </div>
    );
  }
  if (!run) {
    return (
      <div className="app">
        <Loader />
      </div>
    );
  }

  const shuffle = () => {
    setOrder((o) => {
      const next = [...o];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j]!, next[i]!];
      }
      return next;
    });
  };

  const rankIndex = BEE_RANK_STEPS.findIndex((s) => s.id === run.rank.id);
  const sorted = [...run.found].sort((a, b) => a.localeCompare(b, 'pt'));
  const h = run.hints;

  return (
    <div className="app">
      <main className="screen cw bee">
        <header className="cw-top">
          <BackButton to="/words/bee" />
          <div className="cw-title">Daily #{run.number}</div>
          <div className="mono cw-left">{run.points} pts</div>
        </header>

        <div className="bee-rank" aria-label={`Patente: ${run.rank.name}`}>
          <div className="bee-rank-name">{run.rank.name}</div>
          <div className="bee-steps" aria-hidden="true">
            {BEE_RANK_STEPS.map((s, i) => (
              <i key={s.id} className={i <= rankIndex ? 'on' : ''} />
            ))}
          </div>
        </div>

        <div className="cw-toast-slot">
          {toast && (
            <div className={`cw-toast${toast.good ? ' good' : ''}`} role="status">
              {toast.text}
            </div>
          )}
        </div>

        <div className="bee-word" aria-live="polite">
          {[...typed].map((ch, i) => (
            <span key={i} className={ch === run.center ? 'center' : allowed.has(ch) ? '' : 'out'}>
              {ch.toUpperCase()}
            </span>
          ))}
          {open && <span className="bee-caret" aria-hidden="true" />}
        </div>

        {open ? (
          <>
            <svg className={`bee-hive${wave ? ' wave' : ''}`} viewBox="0 0 300 280" role="group" aria-label="Letras do favo">
              <g className="bee-hex center" onClick={() => add(run.center)} role="button" tabIndex={0} aria-label={`${run.center}, letra do centro`}>
                <polygon points={hex(153, 143, 40)} className="shadow" />
                <polygon points={hex(150, 140, 40)} className="face" />
                <text x={150} y={150} textAnchor="middle">
                  {run.center.toUpperCase()}
                </text>
                <circle cx={150} cy={166} r={3} className="dot" />
              </g>
              {order.map((l, i) => {
                const [x, y] = OUTER[i]!;
                return (
                  <g
                    key={l}
                    className="bee-hex"
                    style={{ transform: `translate(${x - 150}px, ${y - 140}px)` }}
                    onClick={() => add(l)}
                    role="button"
                    tabIndex={0}
                    aria-label={l}
                  >
                    <polygon points={hex(153, 143, 40)} className="shadow" />
                    <polygon points={hex(150, 140, 40)} className="face" />
                    <text x={150} y={150} textAnchor="middle">
                      {l.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="bee-actions">
              <button type="button" className="btn ghost" onClick={() => setTyped((t) => t.slice(0, -1))}>
                Apagar
              </button>
              <button type="button" className="btn ghost" onClick={shuffle}>
                Embaralhar
              </button>
              <button type="button" className="btn alt" disabled={busy} onClick={() => void submit()}>
                Enviar
              </button>
            </div>
          </>
        ) : (
          <section className="cw-result" aria-label="Resultado">
            <div className="cw-stamp won">{run.rank.name}</div>
            <div className="cw-score">
              <span className="mono">NOTA</span>
              <b>{run.nota.toFixed(1).replace('.', ',')}</b>
            </div>
            <div className="mono cw-used">
              {run.points} de {run.max} pontos · {run.found.length} de {run.hints.total} palavras
            </div>
            <div className="cw-actions">
              <Link to="/ranking" search={{ jogo: 'wbee', modo: 'daily' }} className="btn alt">
                Ver ranking
              </Link>
              <Link to="/words/bee" className="btn ghost">
                Voltar
              </Link>
            </div>
          </section>
        )}

        <details className="bee-panel" open={!open}>
          <summary>
            {run.found.length} {run.found.length === 1 ? 'palavra' : 'palavras'}
          </summary>
          <div className="bee-found">
            {sorted.map((w) => (
              <span key={w} className={w === latest ? 'latest' : ''}>
                {w}
              </span>
            ))}
            {sorted.length === 0 && <span className="mono">Nenhuma ainda</span>}
          </div>
        </details>

        {open && (
          <details className="bee-panel">
            <summary>Dicas</summary>
            <div className="bee-hints mono">
              <div>
                Faltam {h.left} de {h.total} palavras · pangramas {h.pangrams - h.pangramsLeft}/{h.pangrams}
              </div>
              <div>Por tamanho: {Object.entries(h.bySize).map(([n, c]) => `${n} letras ${c}`).join(' · ') || 'nenhuma'}</div>
              <div>
                Por inicial: {Object.entries(h.byInitial).map(([l, c]) => `${l.toUpperCase()} ${c}`).join(' · ') || 'nenhuma'}
              </div>
            </div>
          </details>
        )}

        {run.closed && run.all && (
          <details className="bee-panel">
            <summary>Todas as palavras do favo</summary>
            <div className="bee-found">
              {[...run.all]
                .sort((a, b) => a.localeCompare(b, 'pt'))
                .map((w) => (
                  <span key={w} className={run.found.includes(w) ? 'latest' : ''}>
                    {w}
                  </span>
                ))}
            </div>
          </details>
        )}

        {open && (
          <button
            type="button"
            className="cw-giveup mono"
            onClick={() => {
              if (!confirmEnd) {
                setConfirmEnd(true);
                window.setTimeout(() => setConfirmEnd(false), 3000);
                return;
              }
              void finishBee(run.id).then(setRun);
            }}
          >
            {confirmEnd ? 'Toque de novo para encerrar' : 'Encerrar o dia'}
          </button>
        )}
      </main>
    </div>
  );
}
