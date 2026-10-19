import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { ApiError } from '@/lib/api-client';
import { BackButton } from '@/components/BackButton';
import { Loader } from '@/components/Loader';
import { wordsAudio } from '@/lib/words-audio';
import { LIVES, connectShareText, sendConnect, startConnect, type ConnectGroup, type ConnectView } from './connect-api';
import '../classic.css';
import './connect.css';

const marks = (level: number) => '●'.repeat(level);

function Band({ group, missed = false }: { group: ConnectGroup; missed?: boolean }) {
  return (
    <div className={`cn-band l${group.level}${missed ? ' missed' : ''}`}>
      <b>{group.title}</b>
      <span>{group.words.join(', ')}</span>
      <div className="cn-marks" aria-label={`Nível ${group.level}`}>
        {marks(group.level)}
      </div>
    </div>
  );
}

export function ConnectPlay() {
  const [run, setRun] = useState<ConnectView | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const { tipo } = useSearch({ strict: false }) as { tipo?: string };
  const free = tipo === 'livre';

  const begin = useCallback(() => {
    setRun(null);
    setPicked([]);
    startConnect(free ? 'free' : 'daily')
      .then((r) => {
        setRun(r);
        setOrder(r.words);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Não deu para abrir o puzzle'));
  }, [free]);

  useEffect(begin, [begin]);

  const say = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const toggle = (w: string) => {
    wordsAudio.key();
    setPicked((p) => (p.includes(w) ? p.filter((x) => x !== w) : p.length >= 4 ? [...p.slice(1), w] : [...p, w]));
  };

  const submit = async () => {
    if (!run || run.over || busy || picked.length !== 4) return;
    setBusy(true);
    try {
      const move = await sendConnect(run.id, picked);
      setRun(move.run);
      setOrder((o) => o.filter((w) => move.run.words.includes(w)));
      setPicked([]);
      if (move.result === 'correct') wordsAudio.row('hhh');
      else if (move.result === 'repeat') say('Você já tentou esse grupo');
      else {
        wordsAudio.invalid();
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
        say(move.result === 'one_away' ? 'Falta uma' : 'Esse não é um grupo');
      }
      if (move.run.over) (move.run.won ? wordsAudio.win : wordsAudio.lose)();
    } catch (e) {
      say(e instanceof ApiError && e.status === 409 ? 'A partida já acabou' : 'Sem conexão. Tente de novo');
    } finally {
      setBusy(false);
    }
  };

  const shuffle = () =>
    setOrder((o) => {
      const next = [...o];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j]!, next[i]!];
      }
      return next;
    });

  const share = async () => {
    if (!run) return;
    const text = connectShareText(run);
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

  if (error) {
    return (
      <div className="app">
        <main className="screen cw">
          <BackButton to="/words/connect" />
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

  return (
    <div className="app">
      <main className="screen cw">
        <header className="cw-top">
          <BackButton to="/words/connect" />
          <div className="cw-title">{free ? `Livre #${run.number}` : `Daily #${run.number}`}</div>
          <span />
        </header>

        <div className="cn-lives" aria-label={`${run.lives} vidas`}>
          {Array.from({ length: LIVES }, (_, i) => (
            <i key={i} className={i >= run.lives ? 'lost' : ''} />
          ))}
        </div>

        <div className="cw-toast-slot">{toast && <div className="cw-toast" role="status">{toast}</div>}</div>

        <div className="cn-found">
          {run.found.map((g) => (
            <Band key={g.title} group={g} />
          ))}
          {run.reveal?.map((g) => <Band key={g.title} group={g} missed />)}
        </div>

        {!run.over && (
          <>
            <div className={`cn-grid${shake ? ' shake' : ''}`} role="group" aria-label="Palavras">
              {order.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`cn-word${picked.includes(w) ? ' on' : ''}${w.length > 9 ? ' long' : ''}`}
                  aria-pressed={picked.includes(w)}
                  onClick={() => toggle(w)}
                >
                  {w}
                </button>
              ))}
            </div>
            <div className="cn-actions">
              <button type="button" className="btn ghost" onClick={shuffle}>
                Embaralhar
              </button>
              <button type="button" className="btn ghost" onClick={() => setPicked([])}>
                Limpar
              </button>
              <button type="button" className="btn alt" disabled={busy || picked.length !== 4} onClick={() => void submit()}>
                Enviar
              </button>
            </div>
          </>
        )}

        {run.over && (
          <section className="cw-result" aria-label="Resultado">
            <div className={`cw-stamp ${run.won ? 'won' : 'lost'}`}>{run.won ? 'Conectou tudo' : 'Não foi dessa vez'}</div>
            <div className="cw-score">
              <span className="mono">NOTA</span>
              <b>{(run.nota ?? 0).toFixed(1).replace('.', ',')}</b>
            </div>
            <div className="mono cw-used">{run.errors} erro(s) · {run.found.length} de 4 grupos</div>
            <div className="cw-actions">
              <button type="button" className="btn" onClick={() => void share()}>
                {copied ? 'Copiado' : 'Compartilhar'}
              </button>
              {free ? (
                <button type="button" className="btn alt" onClick={begin}>
                  Jogar outro puzzle
                </button>
              ) : (
                <Link to="/ranking" search={{ jogo: 'wconnect', modo: 'daily' }} className="btn alt">
                  Ver ranking
                </Link>
              )}
              <Link to="/words/connect" className="btn ghost">
                Voltar
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
