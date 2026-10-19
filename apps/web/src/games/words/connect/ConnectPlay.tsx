import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { connectClass, connectHint, playConnect, type ConnectGroup } from '@nocap/games';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { wordsAudio } from '@/lib/words-audio';
import { Confetti, GridLoader, Pill, ResultSheet, RulesList, Tabs, WordsShell } from '../words-kit';
import { loadConnectLevels, seededShuffle, tierOf, toConnectPuzzle, type ConnectLevel } from '../levels/levels';
import { connectProgress, useProgress } from '../levels/progress';
import { CONNECT_RULES } from './ConnectCatalog';
import './connect.css';

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
  const [burst, setBurst] = useState(0);
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
    if (after.over) {
      later(() => wordsAudio.win(), 500);
      setBurst((b) => b + 1);
    }
  };

  /** A dica (uma por fase): mostra o nome de um grupo que ainda falta, o mais fácil. */
  const useHint = () => {
    if (!puzzle || !state || state.over || saved?.hint !== undefined) return;
    const g = connectHint(puzzle, guesses);
    if (!g) return;
    wordsAudio.tap();
    connectProgress.set(num, { guesses, ...saved, hint: g.level, at: Date.now() });
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
  const hintGroup =
    saved?.hint !== undefined && !state.over
      ? puzzle.groups.find((g) => g.level === saved.hint && !state.found.includes(g))
      : undefined;
  const hintUsed = saved?.hint !== undefined;
  const klass = connectClass(state.won, state.errors, state.gaveUp);

  return (
    <WordsShell
      title={`Fase ${num}`}
      back="/words/connect"
      accent="blue"
      className="cx-theme"
      right={<Pill tone="paper">{tier}</Pill>}
    >
      <Confetti burst={state.won ? burst : 0} />
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

          {hintGroup && (
            <div className={`cx-hint l${hintGroup.level}`} role="status" data-testid="hint-text">
              <span className="mono">Nome do conjunto</span>
              <b>{hintGroup.title}</b>
            </div>
          )}

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
              <div className="cx-aux">
                <button type="button" className="btn ghost cx-hintbtn" onClick={useHint} disabled={hintUsed} data-testid="hint">
                  {hintUsed ? 'Dica usada' : 'Dica (1 por fase)'}
                </button>
                <button type="button" className="cx-giveup mono" onClick={() => setAskGiveUp(true)} data-testid="giveup">
                  Desistir
                </button>
              </div>
            </>
          )}

          {state.over && (
            <ResultSheet
              won={state.won}
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
