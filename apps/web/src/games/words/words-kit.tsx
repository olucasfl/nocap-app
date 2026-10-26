import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { BackButton } from '@/components/BackButton';
import './words.css';
import { Page } from '@/components/Page';

export type Accent = 'green' | 'blue' | 'yellow';

/** A moldura de toda tela do Word's: voltar, título e um cantinho à direita, com entrada animada. */
export function WordsShell({
  title,
  back = '/words',
  right,
  accent,
  children,
  className = '',
  fit = false,
}: {
  title: string;
  back?: string;
  right?: ReactNode;
  accent?: Accent;
  children: ReactNode;
  className?: string;
  /** Tela de jogo que cabe inteira na tela do celular, sem rolar. */
  fit?: boolean;
}) {
  return (
    <Page rail={!fit} className={`wd-app${fit ? ' fit' : ''}`}>
      <main className={`screen wd ${accent ? `wd-${accent}` : ''} ${className}`}>
        <header className="wd-top">
          <BackButton to={back} />
          <h1 className="wd-title">{title}</h1>
          {right && <div className="wd-right">{right}</div>}
        </header>
        {children}
      </main>
    </Page>
  );
}

/**
 * O que a pessoa está digitando. O valor também fica numa ref atualizada na hora, para o Enter ver tudo o que
 * foi digitado mesmo quando as teclas chegam mais rápido que a tela redesenha.
 */
export function useTyped() {
  const [typed, setState] = useState('');
  const ref = useRef('');
  const set = useCallback((fn: (t: string) => string) => {
    ref.current = fn(ref.current);
    setState(ref.current);
  }, []);
  return [typed, set, ref] as const;
}

/** Uma etiqueta pequena (mono) para estados: "DAILY FEITO", "5 VIDAS". */
export function Pill({
  children,
  tone = 'ink',
}: {
  children: ReactNode;
  tone?: 'ink' | 'paper' | 'good';
}) {
  return <span className={`wd-pill ${tone}`}>{children}</span>;
}

/** Abas simples (segmented) com o estilo do Word's. */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { id: T; label: string }[];
  label: string;
}) {
  return (
    <div
      className="wd-tabs"
      role="tablist"
      aria-label={label}
      style={{ '--n': tabs.length } as CSSProperties}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          data-testid={`tab-${t.id}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Os passos de "Como jogar", numerados. */
export function RulesList({ steps }: { steps: string[] }) {
  return (
    <ol className="wd-rules">
      {steps.map((s, i) => (
        <li key={i} style={{ '--i': i } as CSSProperties}>
          <b>{i + 1}</b>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** Os passos de "Como jogar", dentro de um cartão que abre e fecha. */
export function HowTo({ steps }: { steps: string[] }) {
  return (
    <details className="wd-how">
      <summary>Como jogar</summary>
      <RulesList steps={steps} />
    </details>
  );
}

/** Carregando um favo: hexágonos que acendem em sequência. */
export function HexLoader({ label = 'Montando o favo...' }: { label?: string }) {
  return (
    <div className="wd-loader hex" role="status" aria-live="polite" data-testid="loader">
      <div className="wd-hexes" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <i key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <span className="mono">{label}</span>
    </div>
  );
}

/** Carregando um puzzle: uma grade 4x4 que se organiza. */
export function GridLoader({ label = 'Embaralhando as palavras...' }: { label?: string }) {
  return (
    <div className="wd-loader grid" role="status" aria-live="polite" data-testid="loader">
      <div className="wd-grid4" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <i key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <span className="mono">{label}</span>
    </div>
  );
}

/** Carregando o Classic: uma linha de letras que viram. */
export function TileLoader({ label = 'Sorteando a palavra...' }: { label?: string }) {
  return (
    <div className="wd-loader tiles" role="status" aria-live="polite" data-testid="loader">
      <div className="wd-tileline" aria-hidden="true">
        {[...'WORDS'].map((l, i) => (
          <i key={i} style={{ '--i': i } as CSSProperties}>
            {l}
          </i>
        ))}
      </div>
      <span className="mono">{label}</span>
    </div>
  );
}

const CONFETTI_COLORS = [
  'var(--yellow)',
  'var(--orange)',
  'var(--green)',
  'var(--blue)',
  'var(--eco-purple)',
];

/** O que cada cor das casas quer dizer (usado na tela de regras e dentro do jogo). */
export function ColorLegend({ big = false }: { big?: boolean }) {
  // na tela de regras a frase inteira; dentro do jogo, curta para caber numa linha
  const items = big
    ? [
        { tone: 'hit', text: 'Letra no lugar certo' },
        { tone: 'near', text: 'Tem a letra, mas em outro lugar' },
        { tone: 'miss', text: 'Não tem essa letra' },
      ]
    : [
        { tone: 'hit', text: 'Lugar certo' },
        { tone: 'near', text: 'Outro lugar' },
        { tone: 'miss', text: 'Não tem (já foi)' },
      ];
  return (
    <ul className={`cw-legend${big ? ' big' : ''}`} aria-label="Significado das cores">
      {items.map((i) => (
        <li key={i.tone}>
          <i className={i.tone} aria-hidden="true" />
          {i.text}
        </li>
      ))}
    </ul>
  );
}

export type FilterId = 'all' | 'new' | 'open' | 'done';

const FILTER_ICON: Record<FilterId, ReactNode> = {
  all: <path d="M4 5h16M4 12h16M4 19h16" />,
  new: <path d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 18.5 12 15.6 7 18.5l1.4-5.7L4 9l5.8-.7z" />,
  open: <path d="M8 5v14l11-7z" />,
  done: <path d="M4 12.5l5 5L20 6.5" />,
};

/**
 * Filtro das fases (Todas, Novas, Em andamento, Concluídas): cada opção tem cor, ícone e a quantidade de
 * fases, e a escolhida "afunda" e se enche de cor.
 */
export function FilterBar({
  value,
  onChange,
  counts,
  className = '',
}: {
  value: FilterId;
  onChange: (id: FilterId) => void;
  counts: Record<FilterId, number>;
  className?: string;
}) {
  const items: { id: FilterId; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'new', label: 'Novas' },
    { id: 'open', label: 'Andamento' },
    { id: 'done', label: 'Completas' },
  ];
  return (
    <div className={`wd-filters ${className}`} role="group" aria-label="Filtro">
      {items.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`wd-filter ${f.id}`}
          aria-pressed={value === f.id}
          data-testid={`filter-${f.id}`}
          onClick={() => onChange(f.id)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {FILTER_ICON[f.id]}
          </svg>
          <span className="wd-filter-label">{f.label}</span>
          <b className="wd-filter-count">{counts[f.id]}</b>
        </button>
      ))}
    </div>
  );
}

export type FxKind = 'win' | 'epic' | 'gold' | 'lose' | 'spark';

/** Um número "aleatório" estável (0 a 1) para cada peça: a explosão sai igual em toda renderização. */
const jitter = (i: number, salt: number) => (((i + 1) * 9301 + salt * 49297) % 233280) / 233280;

/**
 * A comemoração dos jogos do Word's, só com `transform` e `opacity`. Mude `burst` para disparar de novo
 * (0 não mostra nada).
 *   win / epic  confete em duas ondas, anéis de luz e um brilho central (epic = mais peças e anel extra)
 *   gold        o mesmo em dourado (pangrama, Rainha)
 *   spark       faíscas pequenas, presas ao elemento pai (que precisa ser `position: relative`)
 *   lose        o tom escurece e cacos cinza caem devagar, sem festa
 */
export function Celebrate({ burst, kind = 'win' }: { burst: number; kind?: FxKind }) {
  const pieces = useMemo(() => {
    const count = kind === 'epic' ? 54 : kind === 'spark' ? 10 : kind === 'lose' ? 14 : 38;
    return Array.from({ length: count }, (_, i) => {
      const a = jitter(i, 1);
      const b = jitter(i, 2);
      const c = jitter(i, 3);
      if (kind === 'lose') {
        return {
          x: Math.round((a - 0.5) * 300),
          y: Math.round(240 + b * 320),
          r: Math.round((c - 0.5) * 520),
          s: 0.7 + b * 0.8,
          d: a * 0.5,
          w: 8 + Math.round(c * 8),
          shape: 'shard',
          color: 'var(--eco-graphite)',
        };
      }
      const angle = a * Math.PI * 2;
      const power = kind === 'spark' ? 34 + b * 40 : 80 + b * (kind === 'epic' ? 190 : 140);
      const gold = kind === 'gold';
      return {
        x: Math.round(Math.cos(angle) * power),
        y: Math.round(Math.sin(angle) * power - (kind === 'spark' ? 10 : 60)),
        r: Math.round((c - 0.5) * 900),
        s: 0.6 + c * 0.9,
        d: (i % 2) * 0.18 + b * 0.08,
        w: kind === 'spark' ? 5 + Math.round(c * 4) : 7 + Math.round(c * 7),
        shape: ['sq', 'dot', 'bar', 'star'][Math.floor(jitter(i, 4) * 4)]!,
        color: gold
          ? ['var(--yellow)', 'var(--orange)', 'var(--yellow)', 'var(--paper)'][i % 4]!
          : CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      };
    });
  }, [kind]);
  if (burst === 0) return null;
  const light = kind === 'win' || kind === 'epic' || kind === 'gold';
  return (
    <div className={`wd-fx ${kind}`} key={`${kind}-${burst}`} aria-hidden="true">
      {kind === 'lose' && <i className="veil" />}
      {light && (
        <>
          <i className="glow" />
          <i className="ring r1" />
          <i className="ring r2" />
          {kind !== 'win' && <i className="ring r3" />}
        </>
      )}
      {pieces.map((p, i) => (
        <i
          key={i}
          className={`p ${p.shape}`}
          style={
            {
              '--x': `${p.x}px`,
              '--y': `${p.y}px`,
              '--r': `${p.r}deg`,
              '--s': p.s,
              '--w': `${p.w}px`,
              background: p.shape === 'star' ? undefined : p.color,
              color: p.color,
              animationDelay: `${p.d}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Uma explosão de confete (só transform e opacity). Mude `burst` para disparar de novo; 0 não mostra nada. */
export function Confetti({ burst, count = 22 }: { burst: number; count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (Math.PI * 2 * i) / count + (i % 3) * 0.2;
        const dist = 90 + ((i * 37) % 70);
        return {
          dx: Math.round(Math.cos(angle) * dist),
          dy: Math.round(Math.sin(angle) * dist - 40),
          r: (i * 53) % 360,
          c: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
          d: (i % 5) * 0.03,
        };
      }),
    [count],
  );
  if (burst === 0) return null;
  return (
    <div className="wd-confetti" key={burst} aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={
            {
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--r': `${p.r}deg`,
              background: p.c,
              animationDelay: `${p.d}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Número que sobe de 0 até `target`. Com movimento reduzido já mostra o valor final. */
export function useCountUp(target: number, ms = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/** O resultado de uma partida: carimbo, número contando, detalhes e botões. */
export function ResultSheet({
  won,
  stamp,
  label = 'NOTA',
  value,
  decimals = 1,
  detail,
  epic = false,
  children,
}: {
  won: boolean;
  /** Vitória especial (sem erros, patente máxima...): mais peças e um anel a mais. */
  epic?: boolean;
  stamp: string;
  label?: string;
  value: number;
  decimals?: number;
  detail: string;
  children: ReactNode;
}) {
  const shown = useCountUp(value);
  return (
    <section className={`wd-result ${won ? 'won' : 'lost'}`} aria-label="Resultado">
      <Celebrate burst={1} kind={won ? (epic ? 'epic' : 'win') : 'lose'} />
      <span className="wd-shine" aria-hidden="true" />
      <div className={`wd-stamp ${won ? 'won' : 'lost'}`}>{stamp}</div>
      <div className="wd-score">
        <span className="mono">{label}</span>
        <b data-testid="nota">{shown.toFixed(decimals).replace('.', ',')}</b>
      </div>
      <div className="mono wd-detail">{detail}</div>
      <div className="wd-actions">{children}</div>
    </section>
  );
}
