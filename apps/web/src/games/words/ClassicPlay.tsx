import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from '@tanstack/react-router';
import { decodePattern, keyboardState, wordKey, type Cell } from '@nocap/games';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ApiError } from '@/lib/api-client';
import { wordsAudio } from '@/lib/words-audio';
import { Pill, ResultSheet, TileLoader, useTyped, WordsShell } from './words-kit';
import { fetchAccepted, giveUpRun, MODE_LABEL, sendGuess, startRun, type ClassicMode, type RunView } from './words-api';

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
  const [askGiveUp, setAskGiveUp] = useState(false);
  const accepted = useRef<Set<string> | null>(null);
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

  // a lista de palavras aceitas chega em segundo plano: com ela, uma palavra inválida é recusada na hora
  useEffect(() => {
    void fetchAccepted().then((s) => (accepted.current = s));
  }, []);

  const say = useCallback((text: string, tone: 'bad' | 'good' | '' = 'bad') => {
    setToast({ text, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const open = run?.state === 'open';

  const busyRef = useRef(false);
  const type = useCallback((l: string) => {
    if (busyRef.current) return;
    wordsAudio.key();
    setTyped((t) => ([...t].length < LENGTH ? t + l : t));
  }, [setTyped]);
  const erase = useCallback(() => {
    if (!busyRef.current) setTyped((t) => [...t].slice(0, -1).join(''));
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
    // palavra que sabemos que não existe: recusa na hora, sem ir ao servidor
    if (accepted.current && !accepted.current.has(wordKey(word))) {
      setShake(true);
      wordsAudio.invalid();
      say('Palavra não aceita');
      window.setTimeout(() => setShake(false), 420);
      return;
    }
    // envia já: a linha fica "carregando" (animada) enquanto o servidor responde, depois vira
    busyRef.current = true;
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
      busyRef.current = false;
      setBusy(false);
    }
  }, [run, open, busy, typedRef, say, setTyped]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'Enter') void submit();
      else if (ev.key === 'Backspace') erase();
      else {
        const k = wordKey(ev.key);
        if (k.length === 1 && /[a-z]/.test(k)) type(k);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submit, type, erase, setTyped]);

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

  return (
    <WordsShell
      title={title}
      back="/words/classic"
      accent="green"
      fit
      className={`cw-${run.mode}`}
      right={open ? <Pill tone="paper">{left} {left === 1 ? 'resta' : 'restam'}</Pill> : undefined}
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
                    className={`cw-row${typingHere && shake ? ' shake' : ''}${typingHere && busy ? ' loading' : ''}${animating ? ' flip' : ''}${winRow === r && board.solvedAt === r + 1 ? ' win' : ''}`}
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
                <button type="button" className="cw-key wide" aria-label="Enviar" onClick={() => void submit()} data-testid="enter">
                  <svg viewBox="0 0 24 24" className="cw-ico" aria-hidden="true">
                    <path d="M20 5v6a3 3 0 0 1-3 3H5" />
                    <path d="M9 9l-4 5 4 5" />
                  </svg>
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
                <button type="button" className="cw-key wide" aria-label="Apagar" onClick={erase} data-testid="backspace">
                  <svg viewBox="0 0 24 24" className="cw-ico" aria-hidden="true">
                    <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" />
                    <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {run.kind === 'solo' && (
            <button type="button" className="cw-giveup" onClick={() => setAskGiveUp(true)} data-testid="giveup">
              Desistir
            </button>
          )}
        </div>
      ) : (
        <ResultSheet
          won={run.state === 'won'}
          epic={run.state === 'won' && run.used <= 2}
          stamp={run.state === 'won' ? 'Acertou' : 'Não foi dessa vez'}
          label="TENTATIVAS"
          value={run.used}
          decimals={0}
          detail={`${run.answers!.length === 1 ? 'A palavra era' : 'As palavras eram'} ${run.answers!.join(', ').toUpperCase()} · ${run.state === 'won' ? `acertou em ${run.used} de ${run.tries}` : `${run.used} de ${run.tries} tentativas usadas`}`}
        >
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

      <ConfirmDialog
        open={askGiveUp}
        title="Desistir desta palavra?"
        text="A partida termina e as respostas são reveladas."
        confirmLabel="Desistir"
        confirmSfx="back"
        cancelLabel="Continuar jogando"
        onConfirm={() => {
          setAskGiveUp(false);
          void giveUpRun(run.id).then(setRun);
        }}
        onCancel={() => setAskGiveUp(false)}
      />
    </WordsShell>
  );
}
