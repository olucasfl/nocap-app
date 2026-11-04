import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { CounterFoxEmblem } from './CounterFoxLogo';
import './counterfox-card.css';

const FONTS = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Saira+Stencil+One&display=swap';

/** O cartão premium do Counter Fox no Fox Cap!: fica em primeiro lugar, com um botão só (Jogar), que leva ao menu do jogo. */
export function CounterFoxCard() {
  useEffect(() => {
    if (document.querySelector('link[data-cfh-fonts]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONTS;
    l.setAttribute('data-cfh-fonts', '1');
    document.head.appendChild(l);
  }, []);
  return (
    <article className="cfc" data-testid="foxcap-counterfox-card">
      <div className="cfc-sky" aria-hidden="true">
        <i className="cfc-moon" />
        <svg className="cfc-dunes" viewBox="0 0 600 120" preserveAspectRatio="none">
          <path d="M0 80 Q120 30 260 70 T520 60 T600 80 V120 H0Z" fill="#2a1630" />
          <path d="M0 100 Q160 60 330 95 T600 90 V120 H0Z" fill="#120b1c" />
        </svg>
        <span className="cfc-ring" />
      </div>
      <CounterFoxEmblem size={92} className="cfc-emblem" />
      <div className="cfc-body">
        <small>NOVO · TIRO EM PRIMEIRA PESSOA</small>
        <h2>
          <span>COUNTER</span> <b>FOX</b>
        </h2>
        <p>Mata-mata das raposas no mapa Duna. Offline, com bots, ou online com os amigos. Tem mapa de treino.</p>
        <div className="cfc-tags">
          <span>Mata-mata</span>
          <span>Até 10 jogadores</span>
          <span>Online</span>
        </div>
      </div>
      <Link to="/fox-cap/counter-fox" className="cfc-play" data-sfx="start" data-testid="foxcap-counterfox">
        <span>Jogar</span>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
        </svg>
      </Link>
    </article>
  );
}
