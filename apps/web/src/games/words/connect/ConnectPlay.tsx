import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { CONNECT_LIVES, playConnect, type ConnectGroup } from '@nocap/games';
import { wordsAudio } from '@/lib/words-audio';
import { Confetti, GridLoader, Pill, ResultSheet, RulesList, Tabs, WordsShell } from '../words-kit';
import { loadConnectLevels, seededShuffle, tierOf, toConnectPuzzle, type ConnectLevel } from '../levels/levels';
import { connectProgress, useProgress } from '../levels/progress';
import { CONNECT_RULES } from './ConnectCatalog';
import './connect.css';

/** Um coração de vida (cheio ou perdido). */
function Heart({ lost }: { lost: boolean }) {
  return (
    <svg className={`cx-heart${lost ? ' lost' : ''}`} viewBox="0 0 24 22" aria-hidden="true" data-testid={lost ? 'heart-lost' : 'heart'}>
      <path d="M12 20.5C5 15.2 2.2 11.7 2.2 7.6 2.2 4.6 4.5 2.4 7.3 2.4c1.9 0 3.7 1 4.7 2.8 1-1.8 2.8-2.8 4.7-2.8 2.8 0 5.1 2.2 5.1 5.2 0 4.1-2.8 7.6-9.8 12.9z" />
    </svg>
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

/** Uma fase do Connect: 16 palavras, 4 grupos, 5 vidas. Cada palpite é salvo no aparelho. */
export function ConnectPlay() {
  const { n } = useParams({ strict: false }) as { n?: string };
  const num = Number(n);
  const [levels, setLevels] = useState<ConnectLevel[] | null>(null);
  const progress = useProgress(connectProgress);
  const [order, setOrder] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [toast, setToast] = useState<{ text: string; tone: 'good' | 'bad' | '' } | null>(null);
  const [shake, setShake] = useState(false);
  const [burst, setBurst] = useState(0);
  const [lastLost, setLastLost] = useState(-1);
  const [tab, setTab] = useState<'game' | 'rules'>('game');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    void loadConnectLevels().then(setLevels);
    return () => timers.current.forEach(window.clearTimeout);
  }, []);

  const level = levels?.[num - 1];
  const puzzle = useMemo(() => (level ? toConnectPuzzle(level) : null), [level]);
  const guesses = progress[String(num)]?.guesses ?? [];
  const state = useMemo(() => (puzzle ? playConnect(puzzle, guesses) : null), [puzzle, guesses]);

  useEffect(() => {
    if (level) setOrder(seededShuffle(level.g.flatMap((g) => g.w), level.id));
    setPicked([]);
    setTab('game');
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
    connectProgress.set(num, { guesses: next, at: Date.now() });
    setPicked([]);
    if (result === 'correct') {
      const g = after.found[after.found.length - 1]!;
      wordsAudio.group(g.level);
      say(g.title, 'good');
    } else {
      wordsAudio.heartLoss();
      if (result === 'one_away') {
        wordsAudio.oneAway();
        say('Falta uma!', 'bad');
      } else say('Esse não é um grupo', 'bad');
      setShake(true);
      setLastLost(after.errors - 1);
      later(() => setShake(false), 420);
    }
    if (after.over) {
      later(() => (after.won ? wordsAudio.win() : wordsAudio.lose()), 500);
      if (after.won) setBurst((b) => b + 1);
    }
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
  const tier = tierOf(num - 1, levels.length);

  return (
    <WordsShell
      title={`Fase ${num}`}
      back="/words/connect"
      accent="blue"
      className="cx-theme"
      right={<Pill tone="paper">{tier}</Pill>}
    >
      <Confetti burst={burst} />
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
          <section className="cx-status" aria-label="Progresso e vidas">
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
            <div className="cx-lives" data-testid="lives" aria-label={`${state.lives} de ${CONNECT_LIVES} vidas`}>
              <span className="mono">Vidas</span>
              <div className="cx-hearts">
                {Array.from({ length: CONNECT_LIVES }, (_, i) => (
                  <span key={i} className={i === lastLost ? 'breaking' : ''}>
                    <Heart lost={i >= state.lives} />
                  </span>
                ))}
              </div>
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
            {state.found.map((g) => (
              <Band key={g.title} group={g} />
            ))}
            {reveal.map((g) => (
              <Band key={g.title} group={g} missed />
            ))}
          </div>

          {!state.over && (
            <>
              <div className={`cx-grid${shake ? ' shake' : ''}`} role="group" aria-label="Palavras" data-testid="grid">
                {words.map((w, i) => {
                  const at = picked.indexOf(w);
                  return (
                    <button
                      key={w}
                      type="button"
                      className={`cx-word${at >= 0 ? ' on' : ''}${w.length > 9 ? ' long' : ''}`}
                      style={{ '--i': i } as CSSProperties}
                      aria-pressed={at >= 0}
                      onClick={() => toggle(w)}
                    >
                      {at >= 0 && <span className="order">{at + 1}</span>}
                      {w}
                    </button>
                  );
                })}
              </div>
              <div className="cx-actions">
                <button type="button" className="btn ghost" onClick={shuffle} data-testid="shuffle">
                  Embaralhar
                </button>
                <button type="button" className="btn ghost" onClick={() => setPicked([])} data-testid="clear">
                  Limpar
                </button>
                <button type="button" className="btn alt" disabled={picked.length !== 4} onClick={submit} data-testid="submit">
                  Enviar {picked.length}/4
                </button>
              </div>
            </>
          )}

          {state.over && (
            <ResultSheet
              won={state.won}
              stamp={state.won ? 'Conectou tudo' : 'Não foi dessa vez'}
              label={state.won ? 'ERROS' : 'GRUPOS'}
              value={state.won ? state.errors : state.found.length}
              decimals={0}
              detail={state.won ? `fase ${num} concluída` : `${state.found.length} de 4 grupos · fase ${num}`}
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
    </WordsShell>
  );
}
