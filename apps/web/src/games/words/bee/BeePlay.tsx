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
import { Celebrate, HexLoader, Pill, ResultSheet, RulesList, useTyped, WordsShell } from '../words-kit';
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
  const [fx, setFx] = useState<{ n: number; kind: 'win' | 'gold' }>({ n: 0, kind: 'win' });
  const [spark, setSpark] = useState(0);
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
    setSpark((n) => n + 1);
    later(() => setBuzz(false), 700);
    if (check.pangram) {
      wordsAudio.pangram();
      setWave(true);
      setFx((f) => ({ n: f.n + 1, kind: 'gold' }));
      later(() => setWave(false), 1200);
      setBanner('Pangrama!');
      later(() => setBanner(null), 1800);
    } else if (after.id !== before.id) {
      wordsAudio.rankUp();
      setFx((f) => ({ n: f.n + 1, kind: 'win' }));
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
      <Celebrate burst={fx.n} kind={fx.kind} />

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
        <div className={`bz-banner${banner === 'Pangrama!' ? ' gold' : ''}`} role="status" key={banner}>
          <i className="bz-banner-star" aria-hidden="true" />
          {banner}
          <i className="bz-banner-star r" aria-hidden="true" />
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
            <Celebrate burst={spark} kind="spark" />
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
            <button type="button" className="bz-act mix" onClick={shuffle} data-testid="shuffle" aria-label="Embaralhar">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 7h3.5c3.5 0 5 10 8.5 10H21M3 17h3.5c1.4 0 2.4-1.5 3.3-3.2M21 7h-6c-1.4 0-2.4 1.5-3.3 3.2" />
                <path d="M18 4l3 3-3 3M18 14l3 3-3 3" />
              </svg>
              <span>Embaralhar</span>
            </button>
            <button type="button" className="bz-act send" onClick={submit} data-testid="submit">
              Enviar
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
            </button>
            <button type="button" className="bz-act del" onClick={() => setTyped((t) => t.slice(0, -1))} data-testid="delete" aria-label="Apagar">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" />
                <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
              </svg>
              <span>Apagar</span>
            </button>
          </div>

          {genius >= 1 && (
            <button type="button" className="bz-finish" onClick={conclude} data-testid="end">
              {confirmEnd ? 'Toque de novo para concluir' : 'Você chegou ao Gênio. Concluir a fase'}
            </button>
          )}
        </>
      ) : (
        <ResultSheet won epic={genius >= 1} stamp={rank.name} label="PONTOS" value={points} decimals={0} detail={`${found.length} de ${hints.total} palavras · fase ${num}`}>
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

      <div className="bz-tabs" role="tablist" aria-label="Informações da fase">
        <button type="button" role="tab" aria-selected={tab === 'words'} className="bz-tab words" data-testid="tab-words" onClick={() => setTab('words')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
          </svg>
          <span>Palavras</span>
          <small>
            {found.length}/{hints.total}
          </small>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'hints'} className="bz-tab hints" data-testid="tab-hints" onClick={() => setTab('hints')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
          </svg>
          <span>{closed ? 'Todas' : 'Dicas'}</span>
          {!closed && <small>{1 + (hints.needMap === 0 ? 1 : 0) + (hints.needPairs === 0 ? 1 : 0)}/3</small>}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'rules'} className="bz-tab rules" data-testid="tab-rules" onClick={() => setTab('rules')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11" />
          </svg>
          <span>Regras</span>
        </button>
      </div>

      {tab === 'words' && (
        <section className="bz-found-panel" aria-label="Palavras achadas">
          <div className="bz-found-head">
            <b>
              {found.length} de {hints.total} palavras
            </b>
            <span className="mono">
              {level.p.filter((w) => found.includes(w)).length}/{level.p.length} pangrama
            </span>
          </div>
          <div className="bz-found-bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${found.length / Math.max(1, hints.total)})` }} />
          </div>
          <div className="bz-found" data-testid="found">
            {sorted.map((w) => (
              <span key={w} className={`${w === latest ? 'latest' : ''}${level.p.includes(w) ? ' pangram' : ''}`}>
                {w}
              </span>
            ))}
            {sorted.length === 0 && <span className="empty">Nenhuma ainda. Toque nas letras do favo e envie.</span>}
          </div>
        </section>
      )}
      {tab === 'hints' &&
        (closed ? (
          <div className="bz-found" data-testid="all">
            {[...level.w]
              .sort((a, b) => a.localeCompare(b, 'pt'))
              .map((w) => (
                <span key={w} className={`${found.includes(w) ? 'got' : ''}${level.p.includes(w) ? ' pangram' : ''}`}>
                  {w}
                </span>
              ))}
          </div>
        ) : (
          <div className="bz-hints" data-testid="hints">
            <div className="bz-hints-banner" aria-hidden="true">
              <span>
                <svg viewBox="0 0 24 24">
                  <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
                </svg>
              </span>
              <div>
                <b>Dicas da fase</b>
                <small className="mono">Quanto mais você acha, mais dicas abrem</small>
              </div>
            </div>
            <div className="bz-hint-big">
              <b>{hints.left}</b> palavras faltando de {hints.total}
            </div>
            <div className="bz-hint-pang">
              Pangramas: <b>{hints.pangrams - hints.pangramsLeft}</b> de {hints.pangrams}
            </div>

            <section className="bz-hint-block" aria-label="Quantidade de letras">
              <h4>Quantas letras</h4>
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

            <section className="bz-hint-block" aria-label="Mapa das palavras">
              <h4>Começa com... e tem N letras</h4>
              {hints.needMap > 0 ? (
                <p className="bz-lock" data-testid="hint-map-lock">
                  <b>Bloqueado.</b> Ache mais {hints.needMap} {hints.needMap === 1 ? 'palavra' : 'palavras'} para abrir o mapa.
                </p>
              ) : (
                <div
                  className="bz-map"
                  data-testid="hint-map"
                  role="table"
                  aria-label="Palavras que faltam, por letra inicial e tamanho"
                  style={{ '--cols': hints.map.sizes.length + 2 } as CSSProperties}
                >
                  <div className="bz-map-row head" role="row">
                    <span className="bz-map-corner" role="columnheader" aria-label="Letra inicial" />
                    {hints.map.sizes.map((n) => (
                      <b key={n} className="bz-map-head" role="columnheader">
                        {n}
                      </b>
                    ))}
                    <b className="bz-map-head" role="columnheader">
                      Σ
                    </b>
                  </div>
                  {hints.map.letters.map((l, r) => (
                    <div key={l} className="bz-map-row" role="row">
                      <b className="bz-chip" role="rowheader">
                        {l.toUpperCase()}
                      </b>
                      {hints.map.cells[r]!.map((n, c) => (
                        <span key={c} className={`bz-map-cell${n > 0 ? ' has' : ''}`} role="cell">
                          {n > 0 ? n : '·'}
                        </span>
                      ))}
                      <span className="bz-map-cell sum" role="cell">
                        {hints.map.rowTotals[r]}
                      </span>
                    </div>
                  ))}
                  <div className="bz-map-row foot" role="row">
                    <span className="bz-chip sum" role="rowheader">
                      Σ
                    </span>
                    {hints.map.colTotals.map((n, c) => (
                      <span key={c} className="bz-map-cell sum" role="cell">
                        {n}
                      </span>
                    ))}
                    <span className="bz-map-cell sum" role="cell">
                      {hints.left}
                    </span>
                  </div>
                </div>
              )}
            </section>

            <section className="bz-hint-block" aria-label="Começo das palavras">
              <h4>Duas primeiras letras</h4>
              {hints.needPairs > 0 ? (
                <p className="bz-lock" data-testid="hint-pairs-lock">
                  <b>Bloqueado.</b> Ache mais {hints.needPairs} {hints.needPairs === 1 ? 'palavra' : 'palavras'} para ver como as palavras começam.
                </p>
              ) : (
                <ul className="bz-pairs" data-testid="hint-pairs">
                  {hints.pairs.map(({ prefix, count }) => (
                    <li key={prefix}>
                      <b>{prefix.toUpperCase()}</b>
                      <span>{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ))}
      {tab === 'rules' && (
        <section className="wd-panel bz-rules" data-testid="rules">
          <h3>Como pontua</h3>
          <ul className="bz-points-legend">
            <li>
              <b>4</b> letras<span>1 pt</span>
            </li>
            <li>
              <b>5+</b> letras<span>1 pt por letra</span>
            </li>
            <li className="pang">
              Pangrama<span>+7 pts</span>
            </li>
          </ul>
          <h3>Regras</h3>
          <RulesList steps={BEE_RULES} />
        </section>
      )}
    </WordsShell>
  );
}
