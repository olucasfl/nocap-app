import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BackButton } from '@/components/BackButton';
import './words.css';

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
    <div className={`app wd-app${fit ? ' fit' : ''}`}>
      <main className={`screen wd ${accent ? `wd-${accent}` : ''} ${className}`}>
        <header className="wd-top">
          <BackButton to={back} />
          <h1 className="wd-title">{title}</h1>
          {right && <div className="wd-right">{right}</div>}
        </header>
        {children}
      </main>
    </div>
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
export function Pill({ children, tone = 'ink' }: { children: ReactNode; tone?: 'ink' | 'paper' | 'good' }) {
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
    <div className="wd-tabs" role="tablist" aria-label={label} style={{ '--n': tabs.length } as CSSProperties}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} data-testid={`tab-${t.id}`} onClick={() => onChange(t.id)}>
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

const CONFETTI_COLORS = ['var(--yellow)', 'var(--orange)', 'var(--green)', 'var(--blue)', 'var(--eco-purple)'];

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
        <i key={i} style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--r': `${p.r}deg`, background: p.c, animationDelay: `${p.d}s` } as CSSProperties} />
      ))}
    </div>
  );
}

/** Número que sobe de 0 até `target`. Com movimento reduzido já mostra o valor final. */
export function useCountUp(target: number, ms = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
