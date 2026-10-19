import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from '@tanstack/react-router';
import { decodePattern, keyboardState, wordKey, type Cell } from '@nocap/games';
import { ApiError } from '@/lib/api-client';
import { wordsAudio } from '@/lib/words-audio';
import { shareImage } from './share-image';
import { Pill, ResultSheet, TileLoader, useTyped, WordsShell } from './words-kit';
import { giveUpRun, MODE_LABEL, sendGuess, shareText, startRun, type ClassicMode, type RunView } from './words-api';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const LENGTH = 5;

export function ClassicPlay({ mode, kind }: { mode: ClassicMode; kind: 'daily' | 'solo' }) {
  const [run, setRun] = useState<RunView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped, typedRef] = useTyped();
  const [toast, setToast] = useState<{ text: string; tone: 'bad' | 'good' | '' } | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flipRow, setFlipRow] = useState<number | null>(null);
  const [winRow, setWinRow] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  const begin = useCallback(() => {
    setRun(null);
    setError(null);
    setTyped(() => '');
    startRun(mode, kind)
      .then(setRun)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Não deu para começar a partida'));
  }, [mode, kind]);

  useEffect(begin, [begin]);

  const say = useCallback((text: string, tone: 'bad' | 'good' | '' = 'bad') => {
    setToast({ text, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const open = run?.state === 'open';

  const type = useCallback((l: string) => {
    wordsAudio.key();
    setTyped((t) => ([...t].length < LENGTH ? t + l : t));
  }, [setTyped]);

  const submit = useCallback(async () => {
    if (!run || !open || busy) return;
    const word = typedRef.current;
    if ([...word].length < LENGTH) {
      setShake(true);
      wordsAudio.invalid();
      say('Faltam letras');
      window.setTimeout(() => setShake(false), 420);
      return;
    }
    setBusy(true);
    try {
      const next = await sendGuess(run.id, word);
      setFlipRow(next.used - 1);
      const fresh = next.boards.find((b) => b.rows[next.used - 1] !== undefined)?.rows[next.used - 1];
      if (fresh) wordsAudio.row(fresh);
      if (next.state !== 'open') window.setTimeout(() => (next.state === 'won' ? wordsAudio.win() : wordsAudio.lose()), 1500);
      if (next.state === 'won') setWinRow(next.used - 1);
      setRun(next);
      setTyped(() => '');
      window.setTimeout(() => setFlipRow(null), 1800);
    } catch (e) {
      setShake(true);
      wordsAudio.invalid();
      say(e instanceof ApiError && e.status === 400 ? 'Palavra não aceita' : 'Sem conexão. Tente de novo');
      window.setTimeout(() => setShake(false), 420);
    } finally {
      setBusy(false);
    }
  }, [run, open, busy, typedRef, say, setTyped]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'Enter') void submit();
      else if (ev.key === 'Backspace') setTyped((t) => [...t].slice(0, -1).join(''));
      else {
        const k = wordKey(ev.key);
        if (k.length === 1 && /[a-z]/.test(k)) type(k);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submit, type]);

  if (error) {
    return (
      <WordsShell title="Classic Word's" back="/words/classic" accent="green">
        <p className="wd-error">{error}</p>
      </WordsShell>
    );
  }
  if (!run) {
    return (
      <WordsShell title={kind === 'daily' ? 'Daily' : MODE_LABEL[mode].name} back="/words/classic" accent="green" className="cw-theme">
        <TileLoader label={kind === 'daily' ? 'Abrindo o Daily...' : 'Sorteando a palavra...'} />
      </WordsShell>
    );
  }

  const decoded: Cell[][][] = run.boards.map((b) => b.rows.map(decodePattern));
  const keys = run.boards.map((b, i) => keyboardState(run.guesses.slice(0, b.rows.length), decoded[i]!));
  const info = MODE_LABEL[run.mode];
  const left = run.tries - run.used;
  const title = run.kind === 'daily' ? `Daily #${run.number}` : info.name;

  const share = async () => {
    const text = shareText(run);
    try {
      const blob = await shareImage(run);
      const file = blob ? new File([blob], 'classic-words.png', { type: 'image/png' }) : null;
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
      else if (navigator.share) await navigator.share({ text });
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
    <WordsShell
      title={title}
      back="/words/classic"
      accent="green"
      className={`cw-${run.mode}`}
      right={open ? <Pill tone="paper">{left} {left === 1 ? 'tentativa' : 'tentativas'}</Pill> : undefined}
    >
      <div className="wd-toast-slot" aria-live="polite">
        {toast && (
          <div className={`wd-toast ${toast.tone}`} role="status" key={toast.text + Date.now()}>
            {toast.text}
          </div>
        )}
      </div>

      <div className="cw-stage">
        <div className="cw-boards" style={{ '--rows': run.tries } as CSSProperties} data-testid="boards">
          {run.boards.map((board, b) => (
            <div className="cw-board" key={b} data-solved={board.solvedAt !== null} data-testid={`board-${b}`}>
              {Array.from({ length: run.tries }, (_, r) => {
                const row = decoded[b]![r];
                const word = run.guesses[r];
                const typingHere = open && !row && board.solvedAt === null && r === run.used;
                const letters = row ? [...word!] : typingHere ? [...typed].concat(Array(LENGTH).fill('')).slice(0, LENGTH) : Array<string>(LENGTH).fill('');
                const animating = flipRow === r && !!row;
                return (
                  <div
                    className={`cw-row${typingHere && shake ? ' shake' : ''}${animating ? ' flip' : ''}${winRow === r && board.solvedAt === r + 1 ? ' win' : ''}`}
                    key={r}
                    data-testid={row ? `row-${b}-${r}` : undefined}
                  >
                    {letters.map((ch, c) => (
                      <div
                        key={`${c}-${ch}`}
                        className={`cw-tile${row ? ' rev' : ''}${ch && !row ? ' filled' : ''}${typingHere && c === [...typed].length ? ' cur' : ''}`}
                        style={{ '--i': c } as CSSProperties}
                      >
                        <div className="cw-card">
                          <div className="cw-face front">{ch}</div>
                          <div className={`cw-face back ${row ? row[c] : ''}`} data-cell={row ? row[c] : undefined}>
                            {row ? ch : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {open ? (
        <div className="cw-dock">
          {ROWS.map((letters, ri) => (
            <div className="cw-krow" key={ri}>
              {ri === 2 && (
                <button type="button" className="cw-key wide" onClick={() => void submit()} data-testid="enter">
                  Enter
                </button>
              )}
              {[...letters].map((l) => {
                const colored = keys.some((k) => k.has(l));
                return (
                  <button type="button" key={l} className={`cw-key${colored ? ' has-color' : ''}`} aria-label={l} data-testid={`key-${l}`} onClick={() => type(l)}>
                    <span className="cw-key-bg" aria-hidden="true">
                      {keys.map((k, i) => (
                        <i key={i} className={k.get(l) ?? ''} />
                      ))}
                    </span>
                    <span className="cw-key-l">{l.toUpperCase()}</span>
                  </button>
                );
              })}
              {ri === 2 && (
                <button type="button" className="cw-key wide" aria-label="Apagar" onClick={() => setTyped((t) => [...t].slice(0, -1).join(''))} data-testid="backspace">
                  Apagar
                </button>
              )}
            </div>
          ))}
          {run.kind === 'solo' && (
            <button type="button" className="cw-giveup mono" onClick={() => void giveUpRun(run.id).then(setRun)} data-testid="giveup">
              Desistir
            </button>
          )}
        </div>
      ) : (
        <ResultSheet
          won={run.state === 'won'}
          stamp={run.state === 'won' ? 'Acertou' : 'Não foi dessa vez'}
          value={run.nota ?? 0}
          detail={`${run.answers!.length === 1 ? 'A palavra era' : 'As palavras eram'} ${run.answers!.join(', ').toUpperCase()} · ${run.used} de ${run.tries}`}
        >
          <button type="button" className="btn" onClick={() => void share()}>
            {copied ? 'Copiado' : 'Compartilhar'}
          </button>
          {run.kind === 'solo' ? (
            <button type="button" className="btn alt" onClick={begin} data-testid="again">
              Próxima palavra
            </button>
          ) : (
            <Link to="/ranking" search={{ jogo: 'wclassic', modo: 'daily' }} className="btn alt">
              Ver ranking
            </Link>
          )}
          <Link to="/words/classic" className="btn ghost">
            Voltar aos modos
          </Link>
        </ResultSheet>
      )}
    </WordsShell>
  );
}
