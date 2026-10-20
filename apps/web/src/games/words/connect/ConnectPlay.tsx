import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { connectClass, connectHint, playConnect, type ConnectGroup } from '@nocap/games';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { wordsAudio } from '@/lib/words-audio';
import { Celebrate, GridLoader, Pill, ResultSheet, RulesList, Tabs, WordsShell } from '../words-kit';
import { loadConnectLevels, seededShuffle, tierOf, toConnectPuzzle, type ConnectLevel } from '../levels/levels';
import { connectProgress, useProgress } from '../levels/progress';
import { CONNECT_RULES } from './ConnectCatalog';
import './connect.css';

/** Agrupa o tamanho das palavras em faixas: a letra não muda de tamanho a cada palavra, só quando precisa. */
const bucket = (n: number) => (n <= 6 ? 6 : n <= 8 ? 8 : n);

const VOWELS = 'aeiouáâãàéêíóôõú';
/**
 * Palavra comprida (CHURRASQUEIRA) não cabe numa casa estreita do celular: ganha um hífen opcional perto do
 * meio, que só aparece se ela precisar quebrar em duas linhas. O texto continua o mesmo (`data-word`).
 */
function softBreak(word: string): string {
  if (word.includes(' ') || word.length <= 8) return word;
  const mid = Math.round(word.length / 2);
  for (const d of [0, 1, -1, 2, -2]) {
    const i = mid + d;
    if (i >= 3 && i <= word.length - 3 && Math.max(i, word.length - i) <= Math.ceil(word.length / 2) + 1 && VOWELS.includes(word[i - 1]!.toLowerCase()) && !VOWELS.includes(word[i]!.toLowerCase())) {
      return `${word.slice(0, i)}\u00ad${word.slice(i)}`;
    }
  }
  return `${word.slice(0, mid)}\u00ad${word.slice(mid)}`;
}
/** O tamanho da letra pede o maior pedaço que cabe numa linha (já contando o hífen). */
const longest = (w: string) => (w.includes(' ') || w.length <= 8 ? Math.max(...w.split(' ').map((x) => x.length)) : Math.ceil(w.length / 2) + 1);

/** O popup da dica: o nome de um conjunto que falta, num cartão especial. Dá para abrir de novo quando quiser. */
function HintPopup({ group, found, fancy, onClose }: { group: ConnectGroup; found: boolean; fancy: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="cx-pop" role="presentation" onClick={onClose} data-testid="hint-popup">
      <div
        className={`cx-pop-card l${group.level}${fancy ? '' : ' calm'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Dica do Connect Word's"
        onClick={(e) => e.stopPropagation()}
      >
        {fancy && <span className="cx-pop-rays" aria-hidden="true" />}
        {fancy && <Celebrate burst={1} kind="gold" />}
        <div className="cx-pop-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
          </svg>
        </div>
        <span className="mono cx-pop-kicker">Dica do Connect Word&apos;s</span>
        <span className="mono cx-pop-label">Nome do conjunto</span>
        <b className="cx-pop-title" data-testid="hint-text">
          {group.title}
        </b>
        <p className="mono cx-pop-note">
          {found ? 'Você já achou esse grupo.' : 'Quatro palavras da grade combinam com esse nome.'}
        </p>
        <button type="button" className="btn alt cx-pop-ok" onClick={onClose} autoFocus>
          Entendi
        </button>
      </div>
    </div>
  );
}

function Band({ group, missed = false }: { group: ConnectGroup; missed?: boolean }) {
  return (
    <div className={`cx-band l${group.level}${missed ? ' missed' : ''}`} data-testid={`band-${group.level}`}>
      <span className="cx-badge" aria-label={`Nível ${group.level}`}>
        {group.level}
      </span>
      <b>{group.title}</b>
      <span>{group.words.join(' · ')}</span>
    </div>
  );
}

/**
 * Uma fase do Connect: 16 palavras e 4 grupos. Não há vidas: cada palpite errado soma 1 ao contador de
 * erros. Há uma dica por fase (o nome de um grupo que falta) e dá para desistir (com confirmação), o que
 * revela as palavras. Tudo é salvo no aparelho a cada passo.
 */
export function ConnectPlay() {
  const { n } = useParams({ strict: false }) as { n?: string };
  const num = Number(n);
  const [levels, setLevels] = useState<ConnectLevel[] | null>(null);
  const progress = useProgress(connectProgress);
  const [order, setOrder] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [toast, setToast] = useState<{ text: string; tone: 'good' | 'bad' | '' } | null>(null);
  const [shake, setShake] = useState(false);
  const [spark, setSpark] = useState(0);
  const [hintOpen, setHintOpen] = useState<false | 'first' | 'again'>(false);
  const [tab, setTab] = useState<'game' | 'rules'>('game');
  const [askGiveUp, setAskGiveUp] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    void loadConnectLevels().then(setLevels);
    return () => timers.current.forEach(window.clearTimeout);
  }, []);

  const level = levels?.[num - 1];
  const puzzle = useMemo(() => (level ? toConnectPuzzle(level) : null), [level]);
  const saved = progress[String(num)];
  const guesses = saved?.guesses ?? [];
  const gaveUp = saved?.gaveUp ?? false;
  const state = useMemo(() => (puzzle ? playConnect(puzzle, guesses, { gaveUp }) : null), [puzzle, guesses, gaveUp]);

  useEffect(() => {
    if (level) setOrder(seededShuffle(level.g.flatMap((g) => g.w), level.id));
    setPicked([]);
    setTab('game');
    setAskGiveUp(false);
  }, [level]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const say = useCallback(
    (text: string, tone: 'good' | 'bad' | '' = 'bad') => {
      setToast({ text, tone });
      later(() => setToast(null), 1800);
    },
    [later],
  );

  const toggle = (w: string) => {
    if (picked.includes(w)) wordsAudio.deselect();
    else wordsAudio.select();
    setPicked((p) => (p.includes(w) ? p.filter((x) => x !== w) : p.length >= 4 ? [...p.slice(1), w] : [...p, w]));
  };

  const submit = () => {
    if (!puzzle || !state || state.over || picked.length !== 4) return;
    const next = [...guesses, picked];
    let after;
    try {
      after = playConnect(puzzle, next);
    } catch {
      return;
    }
    const result = after.results[after.results.length - 1]!;
    if (result === 'repeat') {
      say('Você já tentou esse grupo', '');
      setPicked([]);
      return;
    }
    connectProgress.set(num, { ...saved, guesses: next, at: Date.now() });
    setPicked([]);
    if (result === 'correct') {
      setSpark((n) => n + 1);
      const g = after.found[after.found.length - 1]!;
      wordsAudio.group(g.level);
      say(g.title, 'good');
    } else {
      wordsAudio.heartLoss();
      if (result === 'one_away') {
        wordsAudio.oneAway();
        say('Falta uma! +1 erro', 'bad');
      } else say('Esse não é um grupo. +1 erro', 'bad');
      setShake(true);
      later(() => setShake(false), 420);
    }
    if (after.over) later(() => wordsAudio.win(), 500);
  };

  /** A dica (uma por fase): mostra o nome de um grupo que ainda falta, o mais fácil. */
  const useHint = () => {
    if (!puzzle || !state || state.over) return;
    const first = saved?.hint === undefined;
    if (first) {
      const g = connectHint(puzzle, guesses);
      if (!g) return;
      connectProgress.set(num, { guesses, ...saved, hint: g.level, at: Date.now() });
    }
    wordsAudio.tap();
    // o espetáculo (raios, faíscas, selo girando) é só da primeira vez; depois o popup abre calmo
    setHintOpen(first ? 'first' : 'again');
  };

  const giveUp = () => {
    setAskGiveUp(false);
    if (!state || state.over) return;
    connectProgress.set(num, { guesses, ...saved, gaveUp: true, at: Date.now() });
    wordsAudio.lose();
  };

  const shuffle = () =>
    setOrder((o) => {
      const arr = [...(o ?? [])];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      }
      return arr;
    });

  if (!levels || (level && !order)) {
    return (
      <WordsShell title={`Fase ${num}`} back="/words/connect" accent="blue" className="cx-theme">
        <GridLoader />
      </WordsShell>
    );
  }
  if (!level || !puzzle || !state) {
    return (
      <WordsShell title="Connect Word's" back="/words/connect" accent="blue" className="cx-theme">
        <p className="wd-error">Essa fase não existe.</p>
        <Link to="/words/connect" className="btn alt">
          Ver as fases
        </Link>
      </WordsShell>
    );
  }

  const left = new Set(state.left);
  const words = (order ?? []).filter((w) => left.has(w));
  const levelsFound = [1, 2, 3, 4].map((l) => state.found.find((g) => g.level === l));
  const missing = 4 - state.found.length;
  const reveal = state.over ? puzzle.groups.filter((g) => !state.found.includes(g)) : [];
  const hasNext = num < levels.length;
  const tier = tierOf(level);
  const hintGroup = saved?.hint !== undefined ? puzzle.groups.find((g) => g.level === saved.hint) : undefined;
  const hintFound = !!hintGroup && state.found.includes(hintGroup);
  const hintUsed = saved?.hint !== undefined;
  const klass = connectClass(state.won, state.errors, state.gaveUp);

  return (
    <WordsShell
      title={`Fase ${num}`}
      back="/words/connect"
      accent="blue"
      fit
      className="cx-theme"
      right={<Pill tone="paper">{tier}</Pill>}
    >
      <Tabs
        label="Seções"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'game', label: 'Jogar' },
          { id: 'rules', label: 'Regras' },
        ]}
      />

      {tab === 'rules' ? (
        <section className="wd-panel" data-testid="rules">
          <RulesList steps={CONNECT_RULES} />
        </section>
      ) : (
        <>
          <section className="cx-status" aria-label="Progresso e erros">
            <div className="cx-progress">
              <span className="mono">
                {state.found.length} de 4 grupos{!state.over && missing > 0 ? ` · faltam ${missing}` : ''}
              </span>
              <div className="cx-dots" aria-hidden="true">
                {levelsFound.map((g, i) => (
                  <i key={i} className={g ? `l${g.level}` : ''} />
                ))}
              </div>
            </div>
            <div className="cx-errors" data-testid="errors" aria-label={`${state.errors} ${state.errors === 1 ? 'erro' : 'erros'}`}>
              <span className="mono">Erros</span>
              <b key={state.errors} className={state.errors > 0 ? 'bump' : ''} data-testid="error-count">
                {state.errors}
              </b>
            </div>
          </section>

          <div className="wd-toast-slot" aria-live="polite">
            {toast && (
              <div className={`wd-toast ${toast.tone}`} role="status" key={toast.text + toast.tone}>
                {toast.text}
              </div>
            )}
          </div>

          <div className="cx-found">
            <Celebrate burst={spark} kind="spark" />
            {state.found.map((g) => (
              <Band key={g.title} group={g} />
            ))}
            {reveal.map((g) => (
              <Band key={g.title} group={g} missed />
            ))}
          </div>

          {!state.over && (
            <>
              <div className="cx-gridwrap">
              <div
                className={`cx-grid${shake ? ' shake' : ''}`}
                style={{ '--rows': Math.ceil(words.length / 4) } as CSSProperties}
                role="group"
                aria-label="Palavras"
                data-testid="grid"
              >
                {words.map((w, i) => {
                  const at = picked.indexOf(w);
                  return (
                    <button
                      key={w}
                      type="button"
                      data-word={w}
                      className={`cx-word${at >= 0 ? ' on' : ''}`}
                      style={{ '--i': i, '--len': bucket(longest(w)) } as CSSProperties}
                      aria-pressed={at >= 0}
                      onClick={() => toggle(w)}
                    >
                      {at >= 0 && <span className="order">{at + 1}</span>}
                      {softBreak(w)}
                    </button>
                  );
                })}
              </div>
              </div>
              <div className="cx-controls">
                <div className="cx-actions">
                  <button type="button" className="cx-btn shuffle" onClick={shuffle} data-testid="shuffle">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 7h3.5c3.5 0 5 10 8.5 10H21M3 17h3.5c1.4 0 2.4-1.5 3.3-3.2M21 7h-6c-1.4 0-2.4 1.5-3.3 3.2" />
                      <path d="M18 4l3 3-3 3M18 14l3 3-3 3" />
                    </svg>
                    Embaralhar
                  </button>
                  <button type="button" className="cx-btn clear" onClick={() => setPicked([])} data-testid="clear">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                    Limpar
                  </button>
                  <button type="button" className="cx-btn send" disabled={picked.length !== 4} onClick={submit} data-testid="submit">
                    Enviar {picked.length}/4
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 12.5l5 5L20 6.5" />
                    </svg>
                  </button>
                </div>
                <div className="cx-aux">
                  <button
                    type="button"
                    className={`cx-btn hint${hintUsed ? ' seen' : ''}`}
                    onClick={useHint}
                    aria-label={hintUsed ? 'Ver a dica' : 'Usar a dica (1 por fase)'}
                    data-testid="hint"
                  >
                    {hintUsed ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
                      </svg>
                    )}
                    {hintUsed ? 'Ver dica' : 'Dica'}
                  </button>
                  <button type="button" className="cx-btn giveup" onClick={() => setAskGiveUp(true)} data-testid="giveup">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
                    </svg>
                    Desistir
                  </button>
                </div>
              </div>
            </>
          )}

          {state.over && (
            <ResultSheet
              won={state.won}
              epic={state.won && state.errors === 0}
              stamp={klass.name}
              label="ERROS"
              value={state.errors}
              decimals={0}
              detail={
                state.won
                  ? `${state.errors === 0 ? 'Sem nenhum erro' : state.errors === 1 ? '1 erro' : `${state.errors} erros`} · fase ${num} concluída`
                  : `Você desistiu · ${state.found.length} de 4 grupos${state.errors > 0 ? ` · ${state.errors} ${state.errors === 1 ? 'erro' : 'erros'}` : ''} · fase ${num}`
              }
            >
              {hasNext && (
                <Link to="/words/connect/fase/$n" params={{ n: String(num + 1) }} className="btn alt" data-testid="next">
                  Próxima fase
                </Link>
              )}
              <Link to="/words/connect" className="btn ghost" data-testid="back-catalog">
                Ver todas as fases
              </Link>
            </ResultSheet>
          )}
        </>
      )}

      {hintOpen && hintGroup && (
        <HintPopup group={hintGroup} found={hintFound} fancy={hintOpen === 'first'} onClose={() => setHintOpen(false)} />
      )}

      <ConfirmDialog
        open={askGiveUp}
        title="Desistir desta fase?"
        text="As palavras que faltam serão reveladas e a fase termina como Desistência."
        confirmLabel="Desistir"
        confirmSfx="back"
        cancelLabel="Continuar jogando"
        onConfirm={giveUp}
        onCancel={() => setAskGiveUp(false)}
      />
    </WordsShell>
  );
}
