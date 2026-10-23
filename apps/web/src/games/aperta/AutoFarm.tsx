import { GENERATOR_MILESTONES, UPGRADES, autoRates, formatDecimal, formatNumber, type SaveState } from '@nocap/games';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AstroMedal } from './AstroMedal';
import { upgradeAstro } from './upgrades-logic';
import './autofarm.css';

/** "+0,1", "+3,2", "+120": o que os geradores renderam no último segundo (com vírgula quando é pouco). */
export function autoGainText(perSec: number): string {
  if (!(perSec > 0)) return '';
  if (perSec < 0.1) return `+${formatDecimal(perSec, 2)}`;
  if (perSec < 10) return `+${formatDecimal(perSec, 1)}`;
  return `+${formatNumber(perSec)}`;
}

interface Pop {
  id: number;
  text: string;
}

const POP_MS = 1100;

/**
 * Ao lado do contador de poeira: a cada segundo sobe "+0,1" com o que os geradores renderam, em ciano
 * (o dourado é do toque). Só aparece se há gerador rendendo; com o jogo parado ou a escolha aberta, nada.
 */
export function AutoGain({ state, paused }: { state: SaveState; paused: boolean }) {
  const [pops, setPops] = useState<Pop[]>([]);
  const rate = autoRates(state).dust;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const id = useRef(0);

  useEffect(() => {
    if (paused) return undefined;
    const timer = window.setInterval(() => {
      const text = autoGainText(rateRef.current);
      if (!text) return;
      const popId = (id.current += 1);
      setPops((list) => [...list.slice(-2), { id: popId, text }]);
      window.setTimeout(() => setPops((list) => list.filter((p) => p.id !== popId)), POP_MS);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused]);

  if (pops.length === 0) return null;
  return (
    <span className="ap-autogain" aria-hidden="true">
      {pops.map((p) => (
        <b key={p.id} className="ap-autogain-pop">
          {p.text}
        </b>
      ))}
    </span>
  );
}

interface Orbit {
  id: string;
  astro: ReturnType<typeof upgradeAstro>;
  energy: boolean;
  /** 1 até 4: cresce nos marcos de 10, 25 e 50 unidades. */
  tier: number;
}

/** Um corpo por tipo de gerador que a pessoa tem, na ordem em que os comprou (o catálogo). */
export function orbitsOf(state: SaveState): Orbit[] {
  const orbits: Orbit[] = [];
  UPGRADES.forEach((def, i) => {
    if (def.kind === 'touch' || def.kind === 'perk') return;
    const level = state.run.upgradeLevels[i] ?? 0;
    if (level <= 0) return;
    const tier = 1 + GENERATOR_MILESTONES.filter((m) => level >= m).length;
    orbits.push({ id: def.id, astro: upgradeAstro(def.id), energy: def.kind === 'energy', tier });
  });
  return orbits;
}

/**
 * O farm automático à vista: cada tipo de gerador vira um astro que gira em volta do botão. Gira sempre na
 * mesma velocidade; tocando, os corpos brilham cheios, e parado ficam apagados (é o que o ganho faz). Só
 * `transform` e `opacity` animam, e sem movimento (reduced-motion) os corpos ficam parados.
 */
export function AutoOrbits({ state, paused }: { state: SaveState; paused: boolean }) {
  const orbits = orbitsOf(state);
  if (orbits.length === 0) return null;
  const rates = autoRates(state);
  const cls = `ap-orbits${rates.active ? ' is-active' : ''}${rates.surge ? ' is-surge' : ''}${paused ? ' is-paused' : ''}`;
  return (
    <div className={cls} aria-hidden="true">
      {orbits.map((o, i) => {
        const style = {
          '--s': `${112 + i * 9}%`,
          '--d': `${16 + i * 4}s`,
          '--phase': `${(i * 0.37) % 1}`,
          '--z': `${6 + o.tier * 1.4}%`,
        } as CSSProperties;
        return (
          <span key={o.id} className={`ap-orbit${o.energy ? ' is-energy' : ''}`} style={style}>
            <span className="ap-orbit-body">
              <AstroMedal astro={o.astro} trim={o.energy ? 'var(--space-cyan)' : undefined} />
            </span>
          </span>
        );
      })}
    </div>
  );
}
