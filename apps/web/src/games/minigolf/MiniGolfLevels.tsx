import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  GOLF_LEVELS,
  GOLF_ORDER,
  GOLF_SCORE_LABEL,
  GOLF_TIERS,
  GOLF_TIER_LABEL,
  golfParOf,
  golfScoreName,
  type GolfScoreName,
  type GolfTier,
} from '@nocap/games';
import { useTouchGuard } from '../foxgp/touch-guard';
import { GOLF_CHANGED, loadBest, loadProgress } from './golf-save';
import './minigolf.css';

const scoreClass = (n: GolfScoreName) => (n === 'ace' ? 'mg-ace' : n === 'albatross' || n === 'eagle' ? 'mg-eagle' : n === 'birdie' ? 'mg-ok' : n === 'par' ? '' : 'mg-calm');

/** Todas as fases do offline (spec 082): o que já foi feito (com a melhor marca), a que está em andamento e as que faltam. Jogar só começa ao escolher uma. */
export function MiniGolfLevels() {
  useTouchGuard();
  const navigate = useNavigate();
  const [bests, setBests] = useState(loadBest());
  const progress = loadProgress();
  useEffect(() => {
    const sync = () => setBests(loadBest());
    window.addEventListener(GOLF_CHANGED, sync);
    return () => window.removeEventListener(GOLF_CHANGED, sync);
  }, []);
  const done = GOLF_ORDER.filter((n) => bests[n]).length;
  // "continuar": a que ficou em andamento; senão a primeira que falta, na ordem das dificuldades
  const next = progress ?? GOLF_ORDER.find((n) => !bests[n]) ?? GOLF_ORDER[0]!;
  const play = (n: number) => void navigate({ to: '/minigolf/jogar', search: { fase: n } });

  return (
    <div className="mgl" data-testid="mg-levels-page">
      <div className="mgl-wrap">
        <div className="mgh-top">
          <button type="button" className="mg-pill ghost" onClick={() => void navigate({ to: '/minigolf' })}>Voltar</button>
          <span className="mg-kick">NoCap / Mini Golf / Offline</span>
        </div>
        <div className="mgl-head">
          <div>
            <div className="mg-kick">Offline</div>
            <h1 className="mg-disp mgl-title">{GOLF_LEVELS} fases</h1>
            <div className="mgl-bar" aria-hidden="true"><i style={{ width: `${(done / GOLF_LEVELS) * 100}%` }} /></div>
            <div className="mgh-mut">{done} de {GOLF_LEVELS} feitas{progress ? ` · fase ${progress} em andamento` : ''}</div>
          </div>
          <button type="button" className="mg-pill pri" onClick={() => play(next)} data-testid="mg-continue">
            {progress ? `Continuar fase ${next}` : done === 0 ? 'Começar pela fase 1' : `Próxima: fase ${next}`}
          </button>
        </div>
        {(Object.keys(GOLF_TIERS) as GolfTier[]).map((t) => (
          <section key={t} className="mgl-tier" data-testid={`mg-tier-${t}`}>
            <div className="mgl-tier-h">
              <h2 className="mg-disp">{GOLF_TIER_LABEL[t]}</h2>
              <span className="mgh-mut">{GOLF_TIERS[t].filter((n) => bests[n]).length}/{GOLF_TIERS[t].length} feitas</span>
            </div>
            <div className="mgl-grid">
              {GOLF_TIERS[t].map((n) => {
                const best = bests[n];
                const par = golfParOf(n);
                const name = best ? golfScoreName(best, par, true) : null;
                const state = n === progress ? 'doing' : best ? 'done' : 'todo';
                const pips = best ? Math.min(best, 8) : 0;
                return (
                  <button key={n} type="button" className={`mgl-lv ${state}`} onClick={() => play(n)} data-testid={`mg-lv-${n}`} aria-label={`Fase ${n}, par ${par}, ${state === 'done' ? `feita em ${best} tacadas` : state === 'doing' ? 'em andamento' : 'ainda não feita'}`}>
                    <span className="mgl-lv-top">
                      <span className="mgl-lv-n">{n}</span>
                      <span className={`mgl-ico ${state}`} aria-hidden="true">
                        {state === 'done' ? (
                          <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : state === 'doing' ? (
                          <i className="mgl-ball" />
                        ) : (
                          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2.6" /></svg>
                        )}
                      </span>
                    </span>
                    {state === 'done' && name ? (
                      <>
                        <span className="mgl-strokes"><b>{best}</b><small>{best === 1 ? 'tacada' : 'tacadas'}</small></span>
                        <span className="mgl-pips" aria-hidden="true">
                          {Array.from({ length: pips }, (_, i) => (
                            <i key={i} className={i < par ? 'in' : 'over'} />
                          ))}
                        </span>
                        <span className={`mgl-lv-tag ${scoreClass(name)}`}>{GOLF_SCORE_LABEL[name]} · par {par}</span>
                      </>
                    ) : state === 'doing' ? (
                      <>
                        <span className="mgl-lv-tag now">Fazendo agora</span>
                        <span className="mgl-lv-par">Par {par}</span>
                      </>
                    ) : (
                      <>
                        <span className="mgl-lv-tag">Ainda não fez</span>
                        <span className="mgl-lv-par">Par {par}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
