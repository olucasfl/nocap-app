import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import {
  BEE_RANKS,
  beeHints,
  beeMaxPoints,
  beeRank,
  beeScore,
  checkBeeWord,
  wordKey,
  type BeeReject,
} from '@nocap/games';
import { wordsAudio } from '@/lib/words-audio';
import { Confetti, HexLoader, Pill, ResultSheet, RulesList, Tabs, useTyped, WordsShell } from '../words-kit';
import { loadBeeLevels, tierOf, toBeePuzzle, type BeeLevel } from '../levels/levels';
import { beeProgress, useProgress } from '../levels/progress';
import { BeeMascot, hexPoints } from './BeeArt';
import { BEE_RULES } from './BeeCatalog';
import './bee.css';

const REJECT_TEXT: Record<BeeReject, string> = {
  short: 'Muito curta',
  center: 'Falta a letra do centro',
  letters: 'Tem letra fora do favo',
  dup: 'Já achada',
  notlisted: 'Não está na lista',
};

const OUTER: [number, number][] = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 90);
  return [150 + 84 * Math.cos(a), 140 + 84 * Math.sin(a)];
});

function Hex({ x, y, letter, center, onPress }: { x: number; y: number; letter: string; center?: boolean; onPress: () => void }) {
  return (
    <g
      className={`bz-hex${center ? ' center' : ''}`}
      style={{ transform: `translate(${x - 150}px, ${y - 140}px)` }}
      onClick={onPress}
      onKeyDown={(e) => (e.key === ' ' ? onPress() : undefined)}
      role="button"
      tabIndex={0}
      aria-label={center ? `${letter}, letra do centro` : letter}
      data-testid={center ? 'hex-center' : `hex-${letter}`}
    >
      <g className="hx">
        <polygon points={hexPoints(153, 143, 40)} className="shadow" />
        <polygon points={hexPoints(150, 140, 40)} className="face" />
        <text x={150} y={151} textAnchor="middle">
          {letter.toUpperCase()}
        </text>
      </g>
    </g>
  );
}

interface Float {
  id: number;
  text: string;
  big: boolean;
}

/** Uma fase do Bee: o favo, as palavras, a patente. Tudo salvo no aparelho a cada palavra. */
export function BeePlay() {
  const { n } = useParams({ strict: false }) as { n?: string };
  const num = Number(n);
  const [levels, setLevels] = useState<BeeLevel[] | null>(null);
  const progress = useProgress(beeProgress);
  const [typed, setTyped, typedRef] = useTyped();
  const [order, setOrder] = useState<string[]>([]);
  const [toast, setToast] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const [latest, setLatest] = useState<string | null>(null);
  const [floats, setFloats] = useState<Float[]>([]);
  const [wave, setWave] = useState(false);
  const [buzz, setBuzz] = useState(false);
  const [burst, setBurst] = useState(0);
  const [shake, setShake] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [tab, setTab] = useState<'words' | 'hints' | 'rules'>('words');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const timers = useRef<number[]>([]);
  const floatId = useRef(0);

  useEffect(() => {
    void loadBeeLevels().then(setLevels);
    return () => timers.current.forEach(window.clearTimeout);
  }, []);

  const level = levels?.[num - 1];
  const puzzle = useMemo(() => (level ? toBeePuzzle(level) : null), [level]);
  useEffect(() => {
    if (level) setOrder(level.l);
    setTyped(() => '');
    setLatest(null);
    setTab('words');
  }, [level]);

  const saved = progress[String(num)];
  const found = saved?.found ?? [];
  const closed = saved?.closed ?? false;
  const open = !!level && !closed;
  const allowed = useMemo(() => new Set(level ? [level.c, ...level.l] : []), [level]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const say = useCallback(
    (text: string, tone: 'good' | 'bad') => {
      setToast({ text, tone });
      later(() => setToast(null), 1500);
    },
    [later],
  );

  const add = useCallback(
    (l: string) => {
      wordsAudio.honey(l === level?.c ? 0 : (order.indexOf(l) + 1) % 7);
      setTyped((t) => (t.length < 20 ? t + l : t));
    },
    [level, order, setTyped],
  );

  const submit = useCallback(() => {
    const word = typedRef.current;
    if (!puzzle || !open || word.length === 0) return;
    const check = checkBeeWord(puzzle, found, word);
    if (!check.ok) {
      wordsAudio.beeReject();
      setShake(true);
      later(() => setShake(false), 420);
      // uma palavra que existe no favo mas ficou fora desta fase (as fases fáceis só usam palavras comuns)
      const outside = check.reason === 'notlisted' && (level?.x ?? []).some((w) => wordKey(w) === wordKey(word));
      say(outside ? 'Existe, mas não vale nesta fase' : REJECT_TEXT[check.reason], 'bad');
      setTyped(() => '');
      return;
    }
    const before = beeRank(beeScore(puzzle, found), beeMaxPoints(puzzle));
    const next = [...found, check.shown];
    const after = beeRank(beeScore(puzzle, next), beeMaxPoints(puzzle));
    const complete = next.length === puzzle.words.length;
    beeProgress.set(num, { found: next, closed: complete, at: Date.now() });
    setLatest(check.shown);
    setTyped(() => '');
    const id = ++floatId.current;
    setFloats((f) => [...f, { id, text: `+${check.points}`, big: check.pangram }]);
    later(() => setFloats((f) => f.filter((x) => x.id !== id)), 1200);
    setBuzz(true);
    later(() => setBuzz(false), 700);
    if (check.pangram) {
      wordsAudio.pangram();
      setWave(true);
      setBurst((b) => b + 1);
      later(() => setWave(false), 1200);
      setBanner('Pangrama!');
      later(() => setBanner(null), 1800);
    } else if (after.id !== before.id) {
      wordsAudio.rankUp();
      setBurst((b) => b + 1);
      setBanner(after.name);
      later(() => setBanner(null), 2000);
    } else wordsAudio.beeFound(check.points);
    say(check.pangram ? `Pangrama! +${check.points}` : `+${check.points}`, 'good');
  }, [puzzle, open, typedRef, found, num, later, say, setTyped, level]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'Enter') submit();
      else if (ev.key === 'Backspace') setTyped((t) => t.slice(0, -1));
      else {
        const k = wordKey(ev.key);
        if (k.length === 1 && allowed.has(k)) add(k);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, allowed, add, submit]);

  if (!levels) {
    return (
      <WordsShell title={`Fase ${num}`} back="/words/bee" accent="yellow" className="bee-theme">
        <HexLoader />
      </WordsShell>
    );
  }
  if (!level || !puzzle) {
    return (
      <WordsShell title="Bee Word's" back="/words/bee" accent="yellow" className="bee-theme">
        <p className="wd-error">Essa fase não existe.</p>
        <Link to="/words/bee" className="btn alt">
          Ver as fases
        </Link>
      </WordsShell>
    );
  }

  const points = beeScore(puzzle, found);
  const max = beeMaxPoints(puzzle);
  const rank = beeRank(points, max);
  const rankIndex = BEE_RANKS.findIndex((r) => r.id === rank.id);
  const genius = Math.min(1, points / (0.7 * max));
  const hints = beeHints(puzzle, found);
  const maxInitial = Math.max(1, ...hints.initials.map((x) => x.count));
  const maxSize = Math.max(1, ...hints.sizes.map((x) => x.count));
  const sorted = [...found].sort((a, b) => a.localeCompare(b, 'pt'));
  const tier = tierOf(level);
  const hasNext = num < levels.length;

  const shuffle = () =>
    setOrder((o) => {
      const next = [...o];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j]!, next[i]!];
      }
      return next;
    });

  const conclude = () => {
    if (!confirmEnd) {
      setConfirmEnd(true);
      later(() => setConfirmEnd(false), 3000);
      return;
    }
    beeProgress.set(num, { found, closed: true, at: Date.now() });
    setBurst((b) => b + 1);
    wordsAudio.win();
  };

  return (
    <WordsShell
      title={`Fase ${num}`}
      back="/words/bee"
      accent="yellow"
      fit
      className={`bee-theme${tab !== 'words' ? ' info' : ''}`}
      right={<Pill tone="paper">{tier}</Pill>}
    >
      <Confetti burst={burst} />

      <section className={`bz-rankcard${buzz ? ' buzz' : ''}`} aria-label={`Patente: ${rank.name}`} data-testid="rank">
        <BeeMascot className="bz-rank-bee" flying={buzz || open} />
        <div className="bz-rank-body">
          <div className="bz-rankrow">
            <span className="bz-rankname">{rank.name}</span>
            <span className="bz-points">
              <b key={points}>{points}</b> / {max} pts
            </span>
          </div>
          <div className={`bz-meter${genius >= 1 ? ' genius' : ''}`} aria-hidden="true">
            <i style={{ transform: `scaleX(${genius})` }} />
            <em style={{ left: '100%' }} />
          </div>
          <div className="bz-steps" aria-hidden="true">
            {BEE_RANKS.map((r, i) => (
              <i key={r.id} className={i < rankIndex ? 'on' : i === rankIndex ? 'on now' : ''} />
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

      {banner && (
        <div className="bz-banner" role="status" key={banner}>
          {banner}
        </div>
      )}

      {open ? (
        <>
          <div className={`bz-word${shake ? ' shake' : ''}`} aria-live="polite" data-testid="word">
            {floats.map((f) => (
              <span key={f.id} className={`bz-float${f.big ? ' big' : ''}`} aria-hidden="true">
                {f.text}
              </span>
            ))}
            {[...typed].map((ch, i) => (
              <span key={`${i}-${ch}`} className={`bz-letter ${ch === level.c ? 'center' : allowed.has(ch) ? '' : 'out'}`}>
                {ch.toUpperCase()}
              </span>
            ))}
            <span className="bz-caret" aria-hidden="true" />
          </div>

          <div className="bz-hive-wrap">
            <svg className={`bz-hive${wave ? ' wave' : ''}`} viewBox="0 0 300 280" role="group" aria-label="Letras do favo">
              <Hex x={150} y={140} letter={level.c} center onPress={() => add(level.c)} />
              {order.map((l, i) => (
                <Hex key={l} x={OUTER[i]![0]} y={OUTER[i]![1]} letter={l} onPress={() => add(l)} />
              ))}
            </svg>
          </div>

          <div className="bz-actions">
            <button type="button" className="btn ghost" onClick={() => setTyped((t) => t.slice(0, -1))} data-testid="delete">
              Apagar
            </button>
            <button type="button" className="btn ghost" onClick={shuffle} data-testid="shuffle">
              Embaralhar
            </button>
            <button type="button" className="btn alt" onClick={submit} data-testid="submit">
              Enviar
            </button>
          </div>

          {genius >= 1 && (
            <button type="button" className="bz-finish" onClick={conclude} data-testid="end">
              {confirmEnd ? 'Toque de novo para concluir' : 'Você chegou ao Gênio. Concluir a fase'}
            </button>
          )}
        </>
      ) : (
        <ResultSheet won stamp={rank.name} label="PONTOS" value={points} decimals={0} detail={`${found.length} de ${hints.total} palavras · fase ${num}`}>
          {hasNext ? (
            <Link to="/words/bee/fase/$n" params={{ n: String(num + 1) }} className="btn alt" data-testid="next">
              Próxima fase
            </Link>
          ) : null}
          <Link to="/words/bee" className="btn ghost" data-testid="back-catalog">
            Ver todas as fases
          </Link>
        </ResultSheet>
      )}

      <Tabs
        label="Informações da fase"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'words', label: 'Palavras' },
          { id: 'hints', label: closed ? 'Todas' : 'Dicas' },
          { id: 'rules', label: 'Regras' },
        ]}
      />

      {tab === 'words' && (
        <div className="bz-found" data-testid="found">
          {sorted.map((w) => (
            <span key={w} className={`${w === latest ? 'latest' : ''}${level.p.includes(w) ? ' pangram' : ''}`}>
              {w}
            </span>
          ))}
          {sorted.length === 0 && <span className="empty">Nenhuma ainda. Toque nas letras do favo.</span>}
        </div>
      )}
      {tab === 'hints' &&
        (closed ? (
          <div className="bz-found" data-testid="all">
            {[...level.w]
              .sort((a, b) => a.localeCompare(b, 'pt'))
              .map((w) => (
                <span key={w} className={`${found.includes(w) ? 'latest' : ''}${level.p.includes(w) ? ' pangram' : ''}`}>
                  {w}
                </span>
              ))}
          </div>
        ) : (
          <div className="bz-hints" data-testid="hints">
            <div className="bz-hint-big">
              <b>{hints.left}</b> palavras faltando de {hints.total}
            </div>
            <div className="bz-hint-pang">
              Pangramas: <b>{hints.pangrams - hints.pangramsLeft}</b> de {hints.pangrams}
            </div>

            <section className="bz-hint-block" aria-label="Começa com">
              <h4>Começa com</h4>
              <ul className="bz-initials" data-testid="hint-initials">
                {hints.initials.map(({ letter, count }) => (
                  <li key={letter} style={{ '--w': count / maxInitial } as CSSProperties}>
                    <span className="bz-chip">{letter.toUpperCase()}</span>
                    <i aria-hidden="true" />
                    <b>
                      {count} {count === 1 ? 'vez' : 'vezes'}
                    </b>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bz-hint-block" aria-label="Quantidade de letras">
              <h4>Quantidade de letras</h4>
              <ul className="bz-sizes" data-testid="hint-sizes">
                {hints.sizes.map(({ size, count }) => (
                  <li key={size} style={{ '--w': count / maxSize } as CSSProperties}>
                    <span>{size} letras</span>
                    <i aria-hidden="true" />
                    <b>
                      {count} {count === 1 ? 'palavra' : 'palavras'}
                    </b>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ))}
      {tab === 'rules' && (
        <section className="wd-panel" data-testid="rules">
          <RulesList steps={BEE_RULES} />
        </section>
      )}
    </WordsShell>
  );
}
