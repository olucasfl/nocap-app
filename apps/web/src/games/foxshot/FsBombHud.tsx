import { bindLabel, fsSettings } from './fs-settings';
import './fs-bomb-hud.css';

/** O que o HUD do modo Bomba mostra (spec 059). */
export interface BombHud {
  round: number;
  winRounds: number;
  /** Placar de rounds (TR e CT). */
  tr: number;
  ct: number;
  mySide: 'tr' | 'ct';
  phase: 'buy' | 'live' | 'planted' | 'end' | 'over';
  /** Segundos que faltam na fase (compra, round ou bomba). */
  time: number;
  money: number;
  /** 0 a 1: plantando / desarmando. */
  plant: number;
  defuse: number;
  site: string | null;
  carrier: boolean;
  /** Frase grande no meio (fim do round) e dica pequena. */
  banner: string | null;
  hint: string | null;
  alliesAlive: number;
  foesAlive: number;
  /** Tem o alicate de desarme (desarma em metade do tempo). */
  kit: boolean;
  /** Sobe a cada troca de lados (meio da partida): reinicia a animação. 0 = nunca trocou. */
  swapKey?: number;
  /** Modo PvP: sem bomba e sem dinheiro (a loja é grátis). */
  pvp?: boolean;
}

const mmss = (t: number) => {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const PHASE: Record<BombHud['phase'], string> = { buy: 'COMPRA', live: '', planted: 'BOMBA PLANTADA', end: '', over: '' };

/** Placar de rounds, tempo, dinheiro, barra de plantar/desarmar e avisos do modo Bomba. */
export function FsBombHud({ b }: { b: BombHud }) {
  const urgent = b.phase === 'planted' && b.time <= 10;
  return (
    <div className="fb" data-testid="fb-hud" data-phase={b.phase}>
      {/* compra: tela escura que vai sumindo nos últimos 4 s e some de vez quando libera (só opacity) */}
      <div className="fb-dim" data-testid="fb-dim" style={{ opacity: b.phase === 'buy' ? Math.min(1, Math.max(0, b.time / 4)) : 0 }} />
      <div className="fb-top">
        <span className="fb-score tr" data-testid="fb-tr">TR <b>{b.tr}</b></span>
        <span className={`fb-clock${urgent ? ' urgent' : ''}${b.phase === 'planted' ? ' planted' : ''}`} data-testid="fb-clock">
          {mmss(b.time)}
          {PHASE[b.phase] && <small>{PHASE[b.phase]}</small>}
        </span>
        <span className="fb-score ct" data-testid="fb-ct"><b>{b.ct}</b> CT</span>
      </div>
      <div className="fb-sub mono">
        Round {b.round} · primeiro a {b.winRounds} · você é {b.mySide === 'tr' ? 'TERRORISTA' : 'CONTRA-TERRORISTA'} · vivos {b.alliesAlive} x {b.foesAlive}
      </div>
      {!!b.swapKey && <FsSideSwap key={b.swapKey} side={b.mySide} round={b.round} />}
      <div className="fb-money" data-testid="fb-money">{b.pvp ? 'US$ ∞' : `US$ ${b.money}`}</div>
      {b.carrier && b.phase !== 'planted' && <div className="fb-carry mono">VOCÊ TEM A BOMBA · segure {bindLabel(fsSettings().binds.bomb)} nos pátios A ou B</div>}
      {b.plant > 0 && (
        <div className="fb-bar" data-testid="fb-plant">
          <span>PLANTANDO</span>
          <i style={{ transform: `scaleX(${Math.min(1, b.plant)})` }} />
        </div>
      )}
      {b.defuse > 0 && (
        <div className="fb-bar defuse" data-testid="fb-defuse">
          <span>DESARMANDO</span>
          <i style={{ transform: `scaleX(${Math.min(1, b.defuse)})` }} />
        </div>
      )}
      {b.hint && <div className="fb-hint mono">{b.hint}</div>}
      {b.banner && <div className="fb-banner" data-testid="fb-banner">{b.banner}</div>}
    </div>
  );
}

/**
 * Troca de lados no meio da partida: uma faixa laranja e uma azul se cruzam pela tela, o título entra e o seu novo time
 * aparece em destaque. Só transform e opacity (e só fade com movimento reduzido); some sozinha em 4 s.
 */
export function FsSideSwap({ side, round }: { side: 'tr' | 'ct'; round: number }) {
  const tr = side === 'tr';
  return (
    <div className="fb-swap" data-testid="fb-swap" role="status" aria-live="polite">
      <div className="fb-swap-dim" />
      <div className="fb-swap-band t" />
      <div className="fb-swap-band ct" />
      <div className="fb-swap-card">
        <small className="mono">METADE DA PARTIDA · ROUND {round}</small>
        <h2>TROCA DE LADOS</h2>
        <div className="fb-swap-arrows" aria-hidden="true">
          <i className="t" />
          <svg viewBox="0 0 64 32" width="64" height="32">
            <path d="M4 10h44M40 2l10 8-10 8" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M60 22H16M24 14L14 22l10 8" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <i className="ct" />
        </div>
        <p className={`fb-swap-now ${tr ? 't' : 'ct'}`}>
          <span>Agora você é</span>
          <b>{tr ? 'TERRORISTA' : 'CONTRA-TERRORISTA'}</b>
        </p>
      </div>
    </div>
  );
}
