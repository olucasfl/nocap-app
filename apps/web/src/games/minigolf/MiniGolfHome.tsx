import { useNavigate } from '@tanstack/react-router';
import { GOLF_LEVELS, GOLF_TIERS, GOLF_TIER_LABEL, type GolfTier } from '@nocap/games';
import { useTouchGuard } from '../foxgp/touch-guard';
import { BallPreview } from './BallPreview';
import { loadBest, loadLook } from './golf-save';
import './minigolf.css';

/** Tela inicial do Mini Golf (spec 082): jogar online (em breve), offline com 30 fases, personalizar a bola. */
export function MiniGolfHome() {
  useTouchGuard();
  const navigate = useNavigate();
  const best = loadBest();
  const look = loadLook();
  const done = Object.keys(best).length;
  return (
    <div className="mgh" data-testid="mg-home">
      <div className="mgh-wrap">
        <div className="mgh-top">
          <button type="button" className="mg-pill ghost" onClick={() => void navigate({ to: '/' })}>Jogos</button>
          <span className="mg-kick">NoCap / Mini Golf</span>
        </div>
        <div className="mgh-grid">
          <div className="mgh-left">
            <h1 className="mg-disp mgh-title">Mini<br />Golf</h1>
            <p className="mgh-mut mgh-lead">30 fases para treinar sozinho, em três dificuldades. Menos tacadas ganha.</p>
            <div className="mgh-btns">
              <button type="button" className="mg-pill pri mgh-big" disabled aria-disabled="true" data-testid="mg-online">Jogar online <small>em breve</small></button>
              <button type="button" className="mg-pill mgh-mid" onClick={() => void navigate({ to: '/minigolf/jogar' })} data-testid="mg-offline">Offline: {GOLF_LEVELS} fases</button>
              <button type="button" className="mg-pill ghost mgh-mid" onClick={() => void navigate({ to: '/minigolf/bola' })} data-testid="mg-customize">Personalizar bola</button>
            </div>
          </div>
          <div className="mgh-right">
            <div className="mgh-card mgh-heroball"><BallPreview look={look} /></div>
            <div className="mgh-stats">
              <div className="mgh-card"><div className="mg-kick">Fases feitas</div><div className="mg-disp mgh-num">{done}<small>/{GOLF_LEVELS}</small></div></div>
              {(Object.keys(GOLF_TIERS) as GolfTier[]).map((t) => (
                <div key={t} className="mgh-card"><div className="mg-kick">{GOLF_TIER_LABEL[t]}</div><div className="mg-disp mgh-num">{GOLF_TIERS[t].filter((n) => best[n]).length}<small>/{GOLF_TIERS[t].length}</small></div></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
