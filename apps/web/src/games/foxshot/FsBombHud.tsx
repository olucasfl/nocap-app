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
      <div className="fb-money" data-testid="fb-money">US$ {b.money}</div>
      {b.carrier && b.phase !== 'planted' && <div className="fb-carry mono">VOCÊ TEM A BOMBA · segure E nos pátios A ou B</div>}
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
