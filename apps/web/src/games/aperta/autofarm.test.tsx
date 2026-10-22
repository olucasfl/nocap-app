import { UPGRADES, newSave, press, type SaveState } from '@nocap/games';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AutoGain, AutoOrbits, autoGainText, orbitsOf } from './AutoFarm';

const idx = (id: string) => UPGRADES.findIndex((u) => u.id === id);
const owning = (levels: Record<string, number>): SaveState => {
  const s = newSave('farm', 0);
  const upgradeLevels = s.run.upgradeLevels.slice();
  for (const [id, n] of Object.entries(levels)) upgradeLevels[idx(id)] = n;
  return { ...s, run: { ...s.run, upgradeLevels } };
};

describe('texto do ganho automático', () => {
  it('usa vírgula e casas só quando é pouco: +0,05, +0,1, +3,2, +120', () => {
    expect(autoGainText(0.05)).toBe('+0,05');
    expect(autoGainText(0.1)).toBe('+0,1');
    expect(autoGainText(3.24)).toBe('+3,2');
    expect(autoGainText(120)).toBe('+120');
    expect(autoGainText(0)).toBe('');
  });
});

describe('órbitas dos geradores', () => {
  it('um astro por tipo de gerador que a pessoa tem, e nenhum sem gerador', () => {
    expect(orbitsOf(newSave('farm', 0))).toEqual([]);
    expect(renderToStaticMarkup(<AutoOrbits state={newSave('farm', 0)} paused={false} />)).toBe('');
    const ids = orbitsOf(owning({ satellite: 3, probe: 1, antenna: 2 })).map((o) => o.id);
    expect(ids).toEqual(['satellite', 'probe', 'antenna']);
  });

  it('o astro cresce nos marcos de 10, 25 e 50 unidades', () => {
    const tier = (n: number) => orbitsOf(owning({ satellite: n }))[0]!.tier;
    expect([tier(1), tier(10), tier(25), tier(50)]).toEqual([1, 2, 3, 4]);
  });

  it('os de energia ganham o aro ciano', () => {
    const markup = renderToStaticMarkup(<AutoOrbits state={owning({ antenna: 1 })} paused={false} />);
    expect(markup).toContain('is-energy');
    expect(markup).toContain('aria-hidden="true"');
  });

  it('tocando as órbitas acendem; parado, apagam', () => {
    const idle = renderToStaticMarkup(<AutoOrbits state={owning({ satellite: 3 })} paused={false} />);
    expect(idle).not.toContain('is-active');
    const touched = renderToStaticMarkup(<AutoOrbits state={press(owning({ satellite: 3 }), 1)} paused={false} />);
    expect(touched).toContain('is-active');
    expect(renderToStaticMarkup(<AutoOrbits state={owning({ satellite: 3 })} paused />)).toContain('is-paused');
  });
});

describe('número que sobe', () => {
  it('não mostra nada até o primeiro segundo passar', () => {
    expect(renderToStaticMarkup(<AutoGain state={owning({ satellite: 3 })} paused={false} />)).toBe('');
  });
});

describe('CSS do farm automático', () => {
  const css = readFileSync(join(__dirname, 'autofarm.css'), 'utf8');

  it('só anima transform e opacity, sem transition, e respeita reduced-motion', () => {
    for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)) {
      for (const [, p] of body!.matchAll(/([a-z-]+)\s*:/g)) expect(['transform', 'opacity']).toContain(p);
    }
    expect(css).not.toMatch(/transition\s*:/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it('as órbitas nunca pegam o toque do botão', () => {
    expect(css).toMatch(/\.ap-orbits \{[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/\.ap-autogain \{[^}]*pointer-events:\s*none/);
  });
});
