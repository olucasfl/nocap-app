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
}: {
  title: string;
  back?: string;
  right?: ReactNode;
  accent?: Accent;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="app wd-app">
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
  children,
}: {
  won: boolean;
  stamp: string;
  label?: string;
  value: number;
  decimals?: number;
  detail: string;
  children: ReactNode;
}) {
  const shown = useCountUp(value);
  return (
    <section className="wd-result" aria-label="Resultado">
      <Confetti burst={won ? 1 : 0} />
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
