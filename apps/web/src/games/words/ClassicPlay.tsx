import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { decodePattern, keyboardState, wordKey, type Cell } from '@nocap/games';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ApiError } from '@/lib/api-client';
import { wordsAudio } from '@/lib/words-audio';
import { ClassicEnd } from './ClassicEnd';
import { ColorLegend, Pill, TileLoader, WordsShell } from './words-kit';
import type { ReactNode } from 'react';
import type { ClassicEngine } from './classic-engine';
import { MODE_LABEL, type ClassicMode, type RunView } from './words-api';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const LENGTH = 5;

/**
 * A tela de jogo do Classic. Serve ao Daily (servidor) e às fases (aparelho): `engine` diz de onde vem a
 * partida, `endActions` os botões do fim e `title`/`back` o cabeçalho.
 */
export function ClassicPlay({
  mode,
  engine,
  title: fixedTitle,
  back = '/words/classic',
  loading,
  endActions,
}: {
  mode: ClassicMode;
  engine: ClassicEngine;
  /** Título do cabeçalho; sem ele, usa "Daily #N". */
  title?: string;
  back?: string;
  loading: string;
  endActions: (run: RunView) => ReactNode;
}) {
  const [run, setRun] = useState<RunView | null>(null);
  const [error, setError] = useState<string | null>(null);
  // a linha que está sendo escrita: 5 casas, cada uma com uma letra ou vazia, e a casa selecionada (`cursor`). A pessoa
  // pode escolher a casa (toque, clique ou setas) e escrever ali, sem ter que digitar a palavra toda desde a 1ª letra
  const [slots, setSlotsState] = useState<string[]>(() => Array<string>(LENGTH).fill(''));
  const [cursor, setCursorState] = useState(0);
  const slotsRef = useRef<string[]>(slots);
  const cursorRef = useRef(0);
  const setEntry = useCallback((next: string[], at: number) => {
    slotsRef.current = next;
    cursorRef.current = at;
    setSlotsState(next);
    setCursorState(at);
  }, []);
  const clearEntry = useCallback(() => {
    setEntry(Array<string>(LENGTH).fill(''), 0);
  }, [setEntry]);
  const [toast, setToast] = useState<{ text: string; tone: 'bad' | 'good' | '' } | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flipRow, setFlipRow] = useState<number | null>(null);
  const [winRow, setWinRow] = useState<number | null>(null);
  const [askGiveUp, setAskGiveUp] = useState(false);
  // o resultado só aparece depois que a última linha termina de virar
  const [resultReady, setResultReady] = useState(true);
  const [endCollapsed, setEndCollapsed] = useState(false);
  const accepted = useRef<Set<string> | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const begin = useCallback(() => {
    setRun(null);
    setError(null);
    setResultReady(true);
    setEndCollapsed(false);
    clearEntry();
    engine
      .start()
      .then(setRun)
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : 'Não deu para começar a partida'),
      );
  }, [engine, clearEntry]);

  useEffect(begin, [begin]);

  // a lista de palavras aceitas chega em segundo plano: com ela, uma palavra inválida é recusada na hora
  useEffect(() => {
    void engine.accepted().then((s) => (accepted.current = s));
  }, [engine]);

  const say = useCallback((text: string, tone: 'bad' | 'good' | '' = 'bad') => {
    setToast({ text, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const open = run?.state === 'open';

  const busyRef = useRef(false);
  /** Põe a letra na casa selecionada e a seleção sempre volta uma casa. */
  const type = useCallback(
    (l: string) => {
      if (busyRef.current) return;
      wordsAudio.key();
      const next = [...slotsRef.current];
      const at = cursorRef.current;
      next[at] = l;
      let to = at;
      // passa para a próxima casa vazia; no fim, conta de novo a partir da primeira
      for (let k = 1; k < LENGTH; k++) {
        const i = (at + k) % LENGTH;
        if (next[i] === '') {
          to = i;
          break;
        }
      }
      setEntry(next, to);
    },
    [setEntry],
  );
  /** Apaga a letra da casa selecionada; a seleção sempre volta uma casa. */
  const erase = useCallback(() => {
    if (busyRef.current) return;
    const next = [...slotsRef.current];
    const at = cursorRef.current;
    if (next[at] !== '') {
      next[at] = '';
      setEntry(next, Math.max(0, at - 1));
    } else if (at > 0) {
      next[at - 1] = '';
      setEntry(next, at - 1);
    }
  }, [setEntry]);
  /** Seleciona uma casa da linha (toque, clique ou seta). */
  const pick = useCallback(
    (i: number) => {
      if (busyRef.current) return;
      setEntry([...slotsRef.current], Math.max(0, Math.min(LENGTH - 1, i)));
    },
    [setEntry],
  );

  const submit = useCallback(async () => {
    if (!run || !open || busy) return;
    const word = slotsRef.current.join('');
    if (slotsRef.current.some((l) => l === '')) {
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
      const next = await engine.send(run, word);
      setFlipRow(next.used - 1);
      const fresh = next.boards.find((b) => b.rows[next.used - 1] !== undefined)?.rows[
        next.used - 1
      ];
      if (fresh) wordsAudio.row(fresh);
      if (next.state !== 'open') {
        // espera as casas virarem (e a dancinha da vitória) antes de dizer se acertou ou perdeu
        setResultReady(false);
        setEndCollapsed(false);
        window.setTimeout(
          () => {
            setResultReady(true);
            if (next.state === 'won') wordsAudio.win();
            else wordsAudio.lose();
          },
          next.state === 'won' ? 2700 : 2200,
        );
      }
      if (next.state === 'won') setWinRow(next.used - 1);
      setRun(next);
      clearEntry();
      window.setTimeout(() => setFlipRow(null), 1800);
    } catch (e) {
      setShake(true);
      wordsAudio.invalid();
      say(
        e instanceof ApiError && e.status === 400
          ? 'Palavra não aceita'
          : 'Sem conexão. Tente de novo',
      );
      window.setTimeout(() => setShake(false), 420);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [run, open, busy, say, clearEntry]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'Enter') void submit();
      else if (ev.key === 'Backspace') erase();
      else if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        pick(cursorRef.current - 1);
      } else if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        pick(cursorRef.current + 1);
      } else {
        const k = wordKey(ev.key);
        if (k.length === 1 && /[a-z]/.test(k)) type(k);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submit, type, erase, pick]);

  if (error) {
    return (
      <WordsShell title="Classic Word's" back={back} accent="green">
        <p className="wd-error">{error}</p>
      </WordsShell>
    );
  }
  if (!run) {
    return (
      <WordsShell
        title={fixedTitle ?? MODE_LABEL[mode].name}
        back={back}
        accent="green"
        className="cw-theme"
      >
        <TileLoader label={loading} />
      </WordsShell>
    );
  }

  const decoded: Cell[][][] = run.boards.map((b) => b.rows.map(decodePattern));
  const keys = run.boards.map((b, i) =>
    keyboardState(run.guesses.slice(0, b.rows.length), decoded[i]!),
  );
  // letras que já sabemos que não existem (cinza em todos os tabuleiros ainda abertos): ficam marcadas como
  // "já foi", mas continuam clicáveis (a pessoa pode testar palavras só para eliminar letras)
  const open0 = run.boards.map((b, i) => (b.solvedAt === null ? i : -1)).filter((i) => i >= 0);
  const used = new Set<string>();
  for (const l of ROWS.join('')) {
    if (open0.length > 0 && open0.every((i) => keys[i]!.get(l) === 'miss')) used.add(l);
  }
  const info = MODE_LABEL[run.mode];
  const left = run.tries - run.used;
  const title = fixedTitle ?? (run.kind === 'daily' ? `Daily #${run.number}` : info.name);

  return (
    <WordsShell
      title={title}
      back={back}
      accent="green"
      fit
      className={`cw-${run.mode}`}
      right={
        open ? (
          <Pill tone="paper">
            {left} {left === 1 ? 'resta' : 'restam'}
          </Pill>
        ) : undefined
      }
    >
      <div className="wd-toast-slot" aria-live="polite">
        {toast && (
          <div className={`wd-toast ${toast.tone}`} role="status" key={toast.text + Date.now()}>
            {toast.text}
          </div>
        )}
      </div>

      <div className="cw-stage">
        <div
          className="cw-boards"
          style={{ '--rows': run.tries } as CSSProperties}
          data-testid="boards"
        >
          {run.boards.map((board, b) => (
            <div
              className="cw-board"
              key={b}
              data-solved={board.solvedAt !== null}
              data-testid={`board-${b}`}
            >
              {Array.from({ length: run.tries }, (_, r) => {
                const row = decoded[b]![r];
                const word = run.guesses[r];
                const typingHere = open && !row && board.solvedAt === null && r === run.used;
                const letters = row
                  ? [...word!]
                  : typingHere
                    ? slots
                    : Array<string>(LENGTH).fill('');
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
                        className={`cw-tile${row ? ' rev' : ''}${ch && !row ? ' filled' : ''}${typingHere && c === cursor ? ' cur' : ''}${typingHere ? ' pick' : ''}`}
                        style={{ '--i': c } as CSSProperties}
                        {...(typingHere
                          ? {
                              role: 'button',
                              tabIndex: -1,
                              'aria-label': `Casa ${c + 1}${ch ? `: ${ch.toUpperCase()}` : ', vazia'}`,
                              'aria-pressed': c === cursor,
                              'data-testid': `slot-${b}-${c}`,
                              onClick: () => pick(c),
                            }
                          : {})}
                      >
                        <div className="cw-card">
                          <div className="cw-face front">{ch}</div>
                          <div
                            className={`cw-face back ${row ? row[c] : ''}`}
                            data-cell={row ? row[c] : undefined}
                          >
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

      {/* no celular deitado o tabuleiro ocupa a esquerda e o teclado (ou o resultado) a direita: ver `.cw-side` */}
      <div className="cw-side">
        {open || !resultReady ? (
          <>
            <ColorLegend />
            <div className={`cw-dock${open ? '' : ' locked'}`}>
              {ROWS.map((letters, ri) => (
                <div className="cw-krow" key={ri}>
                  {ri === 2 && (
                    <button
                      type="button"
                      className="cw-key wide"
                      aria-label="Enviar"
                      onClick={() => void submit()}
                      data-testid="enter"
                    >
                      <svg viewBox="0 0 24 24" className="cw-ico" aria-hidden="true">
                        <path d="M20 5v6a3 3 0 0 1-3 3H5" />
                        <path d="M9 9l-4 5 4 5" />
                      </svg>
                    </button>
                  )}
                  {[...letters].map((l) => {
                    const colored = keys.some((k) => k.has(l));
                    return (
                      <button
                        type="button"
                        key={l}
                        className={`cw-key${colored ? ' has-color' : ''}${used.has(l) ? ' used' : ''}`}
                        aria-label={used.has(l) ? `${l} (já foi: não tem na palavra)` : l}
                        data-testid={`key-${l}`}
                        onClick={() => type(l)}
                      >
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
                    <button
                      type="button"
                      className="cw-key wide"
                      aria-label="Apagar"
                      onClick={erase}
                      data-testid="backspace"
                    >
                      <svg viewBox="0 0 24 24" className="cw-ico" aria-hidden="true">
                        <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" />
                        <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {engine.canGiveUp && (
                <button
                  type="button"
                  className="cw-giveup"
                  onClick={() => setAskGiveUp(true)}
                  data-testid="giveup"
                >
                  Desistir
                </button>
              )}
            </div>
          </>
        ) : (
          <ClassicEnd
            run={run}
            collapsed={endCollapsed}
            onToggle={() => setEndCollapsed((c) => !c)}
            actions={endActions(run)}
          />
        )}
      </div>

      <ConfirmDialog
        open={askGiveUp}
        title="Desistir desta palavra?"
        text="A partida termina e as respostas são reveladas."
        confirmLabel="Desistir"
        confirmSfx="back"
        cancelLabel="Continuar jogando"
        onConfirm={() => {
          setAskGiveUp(false);
          void engine.giveUp(run).then(setRun);
        }}
        onCancel={() => setAskGiveUp(false)}
      />
    </WordsShell>
  );
}
