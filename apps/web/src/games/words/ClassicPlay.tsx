import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { decodePattern, keyboardState, wordKey, type Cell } from '@nocap/games';
import { ApiError } from '@/lib/api-client';
import { BackButton } from '@/components/BackButton';
import { Loader } from '@/components/Loader';
import { giveUpRun, MODE_LABEL, sendGuess, shareText, startRun, type ClassicMode, type RunView } from './words-api';
import './classic.css';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const LENGTH = 5;

const fmt = (n: number) => n.toFixed(1).replace('.', ',');

export function ClassicPlay({ mode, kind }: { mode: ClassicMode; kind: 'daily' | 'solo' }) {
  const [run, setRun] = useState<RunView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flipRow, setFlipRow] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  const begin = useCallback(() => {
    setRun(null);
    setError(null);
    setTyped('');
    startRun(mode, kind)
      .then(setRun)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Não deu para começar a partida'));
  }, [mode, kind]);

  useEffect(begin, [begin]);

  const say = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const open = run?.state === 'open';

  const submit = useCallback(async () => {
    if (!run || !open || busy) return;
    if ([...typed].length < LENGTH) {
      setShake(true);
      say('Faltam letras');
      window.setTimeout(() => setShake(false), 400);
      return;
    }
    setBusy(true);
    try {
      const next = await sendGuess(run.id, typed);
      setFlipRow(next.used - 1);
      setRun(next);
      setTyped('');
      window.setTimeout(() => setFlipRow(null), 1600);
    } catch (e) {
      setShake(true);
      say(e instanceof ApiError && e.status === 400 ? 'Palavra não aceita' : 'Sem conexão. Tente de novo');
      window.setTimeout(() => setShake(false), 400);
    } finally {
      setBusy(false);
    }
  }, [run, open, busy, typed, say]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'Enter') void submit();
      else if (ev.key === 'Backspace') setTyped((t) => [...t].slice(0, -1).join(''));
      else {
        const k = wordKey(ev.key);
        if (k.length === 1 && /[a-z]/.test(k)) setTyped((t) => ([...t].length < LENGTH ? t + k : t));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submit]);

  if (error) {
    return (
      <div className="app">
        <main className="screen cw">
          <BackButton to="/words/classic" />
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

  const decoded: Cell[][][] = run.boards.map((b) => b.rows.map(decodePattern));
  const keys = run.boards.map((b, i) =>
    keyboardState(run.guesses.slice(0, b.rows.length), decoded[i]!),
  );
  const info = MODE_LABEL[run.mode];
  const left = run.tries - run.used;

  const share = async () => {
    const text = shareText(run);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* cancelou */
    }
  };

  return (
    <div className="app">
      <main className={`screen cw cw-${run.mode}`}>
        <header className="cw-top">
          <BackButton to="/words/classic" />
          <div className="cw-title">
            {run.kind === 'daily' ? `Daily #${run.number}` : info.name}
          </div>
          <div className="mono cw-left" aria-live="polite">
            {open ? `${left} ${left === 1 ? 'tentativa' : 'tentativas'}` : ''}
          </div>
        </header>

        <div className="cw-toast-slot">{toast && <div className="cw-toast" role="status">{toast}</div>}</div>

        <div className="cw-boards">
          {run.boards.map((board, b) => (
            <div className="cw-board" key={b} data-solved={board.solvedAt !== null}>
              {Array.from({ length: run.tries }, (_, r) => {
                const row = decoded[b]![r];
                const word = run.guesses[r];
                const typingHere = open && !row && board.solvedAt === null && r === run.used;
                const letters = row
                  ? [...word!]
                  : typingHere
                    ? [...typed].concat(Array(LENGTH).fill('')).slice(0, LENGTH)
                    : Array<string>(LENGTH).fill('');
                return (
                  <div
                    className={`cw-row${typingHere && shake ? ' shake' : ''}${flipRow === r && row ? ' flip' : ''}`}
                    key={r}
                  >
                    {letters.map((ch, c) => (
                      <div
                        key={c}
                        className={`cw-cell${row ? ` ${row[c]}` : ''}${ch && !row ? ' filled' : ''}`}
                        style={{ '--i': c } as React.CSSProperties}
                      >
                        {ch.toUpperCase()}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {open ? (
          <div className="cw-keyboard">
            {ROWS.map((letters, ri) => (
              <div className="cw-krow" key={ri}>
                {ri === 2 && (
                  <button type="button" className="cw-key wide" onClick={() => void submit()}>
                    Enter
                  </button>
                )}
                {[...letters].map((l) => (
                  <button
                    type="button"
                    key={l}
                    className="cw-key"
                    aria-label={l}
                    onClick={() => setTyped((t) => ([...t].length < LENGTH ? t + l : t))}
                  >
                    <span className="cw-key-bg" aria-hidden="true">
                      {keys.map((k, i) => (
                        <i key={i} className={k.get(l) ?? ''} />
                      ))}
                    </span>
                    <span className="cw-key-l">{l.toUpperCase()}</span>
                  </button>
                ))}
                {ri === 2 && (
                  <button
                    type="button"
                    className="cw-key wide"
                    aria-label="Apagar"
                    onClick={() => setTyped((t) => [...t].slice(0, -1).join(''))}
                  >
                    Apagar
                  </button>
                )}
              </div>
            ))}
            {run.kind === 'solo' && (
              <button
                type="button"
                className="cw-giveup mono"
                onClick={() => void giveUpRun(run.id).then(setRun)}
              >
                Desistir
              </button>
            )}
          </div>
        ) : (
          <section className="cw-result" aria-label="Resultado">
            <div className={`cw-stamp ${run.state}`}>{run.state === 'won' ? 'Acertou' : 'Não foi dessa vez'}</div>
            <p className="cw-answers">
              {run.answers!.length === 1 ? 'A palavra era' : 'As palavras eram'}{' '}
              <b>{run.answers!.join(', ').toUpperCase()}</b>
            </p>
            <div className="cw-score">
              <span className="mono">NOTA</span>
              <b>{fmt(run.nota ?? 0)}</b>
            </div>
            <div className="mono cw-used">
              {run.used} de {run.tries} tentativas
            </div>
            <div className="cw-actions">
              <button type="button" className="btn" onClick={() => void share()}>
                {copied ? 'Copiado' : 'Compartilhar'}
              </button>
              {run.kind === 'solo' ? (
                <button type="button" className="btn alt" onClick={begin}>
                  Jogar de novo
                </button>
              ) : (
                <Link to="/ranking" search={{ jogo: 'wclassic', modo: 'daily' }} className="btn alt">
                  Ver ranking
                </Link>
              )}
              <Link to="/words/classic" className="btn ghost">
                Voltar aos modos
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
