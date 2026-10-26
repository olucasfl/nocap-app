import type { CSSProperties, ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from './icons';
import './game-hub.css';

/**
 * As peças das telas de abertura dos jogos (Block's, Atravessa!...), no mesmo estilo do Word's: um banner
 * colorido com a arte, abas "Jogar / Como jogar", cartões grandes e regras em passos numerados.
 */
export type HubAccent = 'yellow' | 'red' | 'green' | 'blue' | 'orange';

export function HubHero({
  accent,
  art,
  title,
  text,
  stats,
}: {
  accent: HubAccent;
  art: ReactNode;
  title: string;
  text: string;
  stats?: { label: string; value: string }[];
}) {
  return (
    <section className={`gh-hero ${accent}`} data-testid="hub-hero">
      <div className="gh-hero-art">{art}</div>
      <div className="gh-hero-text">
        <h1>{title}</h1>
        <p className="mono">{text}</p>
        {stats && stats.length > 0 && (
          <dl className="gh-stats">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="mono">{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

export function HubTabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { id: T; label: string }[];
}) {
  return (
    <div
      className="gh-tabs"
      role="tablist"
      aria-label="Seções"
      style={{ '--n': tabs.length } as CSSProperties}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          data-testid={`tab-${t.id}`}
          data-sfx="select"
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Um cartão grande de modo: arte, nome, descrição, uma etiqueta (recorde) e o chamado para jogar. */
export function HubCard({
  tone,
  art,
  name,
  desc,
  tag,
  tags,
  cta,
  onClick,
  to,
  search,
  disabled,
  testId,
}: {
  tone: HubAccent;
  art: ReactNode;
  name: string;
  desc: string;
  tag?: string;
  /** Etiquetas curtas do modo (tamanho, tempo, offline...). */
  tags?: string[];
  cta: string;
  onClick?: () => void;
  to?: string;
  search?: Record<string, string>;
  disabled?: boolean;
  testId?: string;
}) {
  const body = (
    <>
      <span className="gh-card-art" aria-hidden="true">
        {art}
      </span>
      <span className="gh-card-body">
        <b>{name}</b>
        <span className="mono">{desc}</span>
        {(tags?.length || tag) && (
          <span className="gh-card-tags">
            {tags?.map((t) => (
              <span key={t} className="gh-card-tag mono">
                {t}
              </span>
            ))}
            {tag && <span className="gh-card-tag mono hot">{tag}</span>}
          </span>
        )}
      </span>
      <span className="gh-card-go">
        {cta} <ArrowRight />
      </span>
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        search={search}
        className={`gh-card ${tone}`}
        data-sfx="start"
        data-testid={testId}
      >
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={`gh-card ${tone}`}
      data-sfx="start"
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
    >
      {body}
    </button>
  );
}

/**
 * Cartão de modo com duas ações: o botão principal (jogar) e um "Como jogar?" que abre as regras. Sem navegar: quem usa
 * decide o que o "jogar" faz.
 */
export function HubModeCard({
  tone,
  art,
  name,
  desc,
  tags,
  cta = 'Jogar',
  onPlay,
  onHelp,
  testId,
  helpTestId,
}: {
  tone: HubAccent;
  art: ReactNode;
  name: string;
  desc: string;
  tags?: string[];
  cta?: string;
  onPlay: () => void;
  onHelp: () => void;
  testId?: string;
  helpTestId?: string;
}) {
  return (
    <article className={`gh-card gh-mode ${tone}`}>
      <span className="gh-card-art" aria-hidden="true">
        {art}
      </span>
      <span className="gh-card-body">
        <b>{name}</b>
        <span className="mono">{desc}</span>
        {tags && tags.length > 0 && (
          <span className="gh-card-tags">
            {tags.map((t) => (
              <span key={t} className="gh-card-tag mono">
                {t}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="gh-mode-go">
        <button
          type="button"
          className="gh-mode-play"
          data-sfx="start"
          onClick={onPlay}
          data-testid={testId}
        >
          {cta} <ArrowRight />
        </button>
        <button
          type="button"
          className="gh-mode-help"
          data-sfx="select"
          onClick={onHelp}
          data-testid={helpTestId}
        >
          Como jogar?
        </button>
      </span>
    </article>
  );
}

/** Regras em passos numerados. */
export function HubSteps({ steps, title }: { steps: string[]; title?: string }) {
  return (
    <section className="gh-panel">
      {title && <h3>{title}</h3>}
      <ol className="gh-steps">
        {steps.map((t, i) => (
          <li key={i} style={{ '--i': i } as CSSProperties}>
            <b>{i + 1}</b>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Um aviso curto (controles, conta): faixa tracejada. */
export function HubNote({ children }: { children: ReactNode }) {
  return <p className="gh-note mono">{children}</p>;
}
