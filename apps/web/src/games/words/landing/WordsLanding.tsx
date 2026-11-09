import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Backdrop, Emblem, Showcase, type WordsGame } from './WordsLandingArt';
import '@/components/game-landing.css';
import './words-landing.css';

export type { WordsGame };

/** Tema de cada jogo do Word's (cores, nome em duas linhas e frase). Spec 065. */
export const WORDS_LANDING: Record<
  WordsGame,
  { name: string; line1: string; line2: string; tag: string; a: string; b: string; show: string }
> = {
  classic: {
    name: "Classic Word's",
    line1: 'CLASSIC',
    line2: "WORD'S",
    tag: 'ACHE A PALAVRA SECRETA',
    a: '#3fcf7d',
    b: '#0f5a3a',
    show: 'Cinco letras, cores como pista e poucas tentativas. Jogue 1, 2 ou 4 palavras de uma vez.',
  },
  connect: {
    name: "Connect Word's",
    line1: 'CONNECT',
    line2: "WORD'S",
    tag: 'LIGUE 4 GRUPOS ESCONDIDOS',
    a: '#8b7bff',
    b: '#2a1d7a',
    show: '16 palavras, 4 grupos e uma única divisão certa. Cuidado com as palavras que servem a dois grupos.',
  },
  bee: {
    name: "Bee Word's",
    line1: 'BEE',
    line2: "WORD'S",
    tag: 'ACHE TODAS AS PALAVRAS DO FAVO',
    a: '#ffd23f',
    b: '#7a5a0b',
    show: 'Sete letras, uma delas no centro de toda palavra. Ache o pangrama e suba até Rainha das Abelhas.',
  },
};

const FONTS =
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Saira+Stencil+One&display=swap';

/**
 * A tela própria de cada jogo do Word's, no desenho das telas do Fox Cap! (`GameLanding`): botões à esquerda, cenário animado
 * do jogo ao fundo e um quadro (ou o catálogo de fases) à direita. Quem usa decide a tela aberta (`screen`) e o que mostrar;
 * aqui ficam o portal, a trava de rolagem da página de trás e o Escape.
 */
export function WordsLanding({
  game,
  screen,
  onBack,
  left,
  right,
  pane = 'show',
}: {
  game: WordsGame;
  screen: string;
  /** Voltar um passo: do submenu para o menu, do menu para a página do Word's. */
  onBack: () => void;
  left: ReactNode;
  /** O que fica à direita; sem isso, o quadro do jogo. */
  right?: ReactNode;
  pane?: 'show' | 'levels';
}) {
  const t = WORDS_LANDING[game];

  useEffect(() => {
    if (document.querySelector('link[data-cfh-fonts]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONTS;
    l.setAttribute('data-cfh-fonts', '1');
    document.head.appendChild(l);
  }, []);

  useEffect(() => {
    document.body.classList.add('gx-open');
    const html = document.documentElement;
    const body = document.body;
    const prev = [html.style.overflow, body.style.overflow];
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      document.body.classList.remove('gx-open');
      html.style.overflow = prev[0] ?? '';
      body.style.overflow = prev[1] ?? '';
    };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onBack();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onBack]);

  return createPortal(
    <main
      className={`gx wl wl-${game}`}
      data-testid={`wl-${game}`}
      data-game={game}
      data-screen={screen}
      data-pane={pane}
      style={{ '--gl-a': t.a, '--gl-b': t.b } as CSSProperties}
    >
      <Backdrop game={game} />
      <div className="gx-wrap">
        {screen === 'main' ? (
          <>
            <div className="gx-left">
              <Logo game={game} compact={false} />
              {left}
            </div>
            <aside className="gx-right">{right ?? <Showcase game={game} text={t.show} />}</aside>
          </>
        ) : (
          <>
            <div className="wl-corner">
              <Logo game={game} compact />
            </div>
            <div className="wl-stage" data-pane={pane}>
              {left}
              {right}
            </div>
          </>
        )}
      </div>
    </main>,
    document.body,
  );
}

function Logo({ game, compact }: { game: WordsGame; compact: boolean }) {
  const t = WORDS_LANDING[game];
  return (
    <header className={`gx-logo${compact ? ' compact' : ''}`}>
      <Emblem game={game} />
      <h1>
        <span>{t.line1}</span>
        <b>{t.line2}</b>
      </h1>
      <p>{t.tag}</p>
    </header>
  );
}

/** Botão inclinado do menu (mesmo desenho do Fox Cap!). */
export function WlBtn({
  title,
  sub,
  onClick,
  main = false,
  danger = false,
  testid,
  sfx = 'select',
}: {
  title: string;
  sub?: string;
  onClick: () => void;
  main?: boolean;
  danger?: boolean;
  testid?: string;
  sfx?: string;
}) {
  return (
    <button
      type="button"
      className={`gx-btn${main ? ' main' : ''}${danger ? ' danger' : ''}`}
      onClick={onClick}
      data-sfx={sfx}
      data-testid={testid}
    >
      <b>{title}</b>
      {sub && <span>{sub}</span>}
    </button>
  );
}

/** Painel de uma subtela: voltar, título e o conteúdo. */
export function WlPanel({
  title,
  lead,
  onBack,
  testid,
  children,
}: {
  title: string;
  lead?: string;
  onBack: () => void;
  testid?: string;
  children?: ReactNode;
}) {
  return (
    <section className="gx-panel" data-testid={testid}>
      <button
        type="button"
        className="gx-back"
        onClick={onBack}
        data-sfx="back"
        data-testid="wl-back"
      >
        ‹ Voltar
      </button>
      <h2>{title}</h2>
      {lead && <p className="lead">{lead}</p>}
      {children}
    </section>
  );
}

/** Barra de progresso e três números (concluídas, em andamento, novas). */
export function WlMeter({
  done,
  open,
  total,
  doneLabel = 'concluídas',
}: {
  done: number;
  open: number;
  total: number;
  doneLabel?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="wl-meter" data-testid="wl-meter">
      <div className="wl-bar" role="img" aria-label={`${pct}% concluído`}>
        <i style={{ transform: `scaleX(${total > 0 ? done / total : 0})` }} />
      </div>
      <div className="wl-nums">
        <span>
          <b>{done}</b> {doneLabel}
        </span>
        <span>
          <b>{open}</b> em andamento
        </span>
        <span>
          <b>{Math.max(0, total - done - open)}</b> novas
        </span>
      </div>
    </div>
  );
}
