import { UPGRADES, autoRates, formatDecimal, formatNumber, type SaveState } from '@nocap/games';
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
export function AutoGain({
  state,
  paused,
  kind = 'dust',
}: {
  state: SaveState;
  paused: boolean;
  kind?: 'dust' | 'energy';
}) {
  const [pops, setPops] = useState<Pop[]>([]);
  const rates = autoRates(state);
  const rate = kind === 'energy' ? rates.energy * 60 : rates.dust;
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
    <span className={`ap-autogain${kind === 'energy' ? ' is-energy' : ''}`} aria-hidden="true">
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
  /** 1 a 3: cresce com os níveis do gerador (metade e completo). */
  tier: number;
}

/** Um corpo por tipo de gerador que a pessoa tem, na ordem em que os comprou (o catálogo). */
export function orbitsOf(state: SaveState): Orbit[] {
  const orbits: Orbit[] = [];
  UPGRADES.forEach((def, i) => {
    if (def.kind === 'item') return;
    const level = state.run.upgradeLevels[i] ?? 0;
    if (level <= 0) return;
    // O astro cresce com o gerador: 1 até a metade dos níveis, 2 passando dela, 3 completo.
    const tier = 1 + (level >= def.max ? 2 : level * 2 >= def.max ? 1 : 0);
    orbits.push({ id: def.id, astro: upgradeAstro(def.id), energy: def.kind === 'energy', tier });
  });
  return orbits;
}

/**
 * O farm automático à vista: cada tipo de gerador vira um astro que gira em volta do botão. Gira sempre na
 * mesma velocidade e sempre brilham cheios: os geradores rendem o máximo com ou sem toque (24/10/2026). Só
 * `transform` e `opacity` animam, e sem movimento (reduced-motion) os corpos ficam parados.
 */
export function AutoOrbits({ state, paused }: { state: SaveState; paused: boolean }) {
  const orbits = orbitsOf(state);
  if (orbits.length === 0) return null;
  const rates = autoRates(state);
  const cls = `ap-orbits is-active${rates.surge ? ' is-surge' : ''}${paused ? ' is-paused' : ''}`;
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

/**
 * A taxa real dos geradores, sempre à vista (spec 041, A7): "+8,8/s" ao lado da poeira e "+0,5/s" com um raio ao lado da
 * barra de energia. Vem de `autoRates`, a mesma conta do motor, já com o limite do toque.
 */
export function RateTag({ state, kind }: { state: SaveState; kind: 'dust' | 'energy' }) {
  const rates = autoRates(state);
  const rate = kind === 'energy' ? rates.energy * 60 : rates.dust;
  if (!(rate > 0)) return null;
  const text =
    rate < 0.1 ? formatDecimal(rate, 2) : rate < 10 ? formatDecimal(rate, 1) : formatNumber(rate);
  return (
    <span
      className={`ap-ratetag${kind === 'energy' ? ' is-energy' : ''}`}
      aria-label={`${kind === 'energy' ? 'Energia' : 'Poeira'} automática: ${text} por ${kind === 'energy' ? 'minuto' : 'segundo'}`}
    >
      {kind === 'energy' && (
        <svg viewBox="0 0 16 20" width="11" height="14" aria-hidden="true">
          <path d="M10 1L2 11h5l-1 8 8-11H9z" fill="currentColor" />
        </svg>
      )}
      +{text}/{kind === 'energy' ? 'min' : 's'}
    </span>
  );
}
