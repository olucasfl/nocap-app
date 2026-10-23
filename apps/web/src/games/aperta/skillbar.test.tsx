import { newSave, activateSkill, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChoiceModal } from './ChoiceModal';
import { SkillBar } from './SkillBar';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const noop = () => {};

function save(tree: Record<string, number>): SaveState {
  const s = newSave('b');
  return { ...s, tutorial: 'done', collapses: 4, regionId: 'oort-cloud', clock: 100, tree, sparks: { legacy: 50, spent: 0 }, run: { ...s.run, picks: 5, dust: 1e6, dustLife: 1e6 } };
}

describe('barra de habilidades', () => {
  it('não aparece sem nenhum nó que dá botão', () => {
    expect(html(<SkillBar state={save({})} now={100} onUse={noop} onAutoBuy={noop} />)).toBe('');
  });

  it('um botão por habilidade, com nome acessível, alvo de 48 px, dica de 1ª vez e recarga por transform', () => {
    const s = save({ 'au-01': 1, 'sk-01': 2, 'sk-05': 2 });
    const out = html(<SkillBar state={s} now={100} onUse={noop} onAutoBuy={noop} />);
    expect(out.match(/<button[^>]*class="ap-skill[ "]/g)).toHaveLength(2);
    expect(out).toContain('Autoclick.');
    expect(out).toContain('Pulso.');
    expect(out).toContain('2 de 3 cargas'.replace('2', '3'));
    expect(out).toContain('Nova habilidade: toque no botão para usar');
    expect(out).toContain('scaleX(0.000)');
    const used = activateSkill(s, 'autoclick', 100);
    const after = html(<SkillBar state={used} now={110} onUse={noop} onAutoBuy={noop} />);
    expect(after).not.toContain('Nova habilidade');
    expect(after).toContain('is-active');
    expect(after).toContain('Ligada agora.');
    expect(after).toMatch(/aria-disabled="true"/);
    expect(after).toMatch(/scaleX\(0\.9\d\d\)/);
  });

  it('a Compra automática mostra o liga/desliga e o limite', () => {
    const out = html(<SkillBar state={{ ...save({ 'au-03': 1 }), run: { ...save({}).run, autoBuy: { on: true, limit: 40 } } }} now={100} onUse={noop} onAutoBuy={noop} />);
    expect(out).toContain('Compra automática: ligada');
    expect(out).toContain('40%');
    expect(out).toContain('Diminuir o limite de preço');
  });

  it('a Escolha sugerida destaca a carta, com o motivo só quando o nó existe', () => {
    const pending = { offers: ['moon', 'mercury', 'venus'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
    const plain = html(<ChoiceModal pending={pending} lockRemaining={0} build={{}} paused={false} onSelect={noop} onConfirm={noop} suggestion={{ id: 'mercury', gainPct: null }} />);
    expect(plain.match(/is-suggested/g)).toHaveLength(1);
    expect(plain).toContain('Sugerida');
    expect(plain).not.toContain('de ganho');
    const why = html(<ChoiceModal pending={pending} lockRemaining={0} build={{}} paused={false} onSelect={noop} onConfirm={noop} suggestion={{ id: 'mercury', gainPct: 12.4 }} />);
    expect(why).toContain('Sugerida: +12% de ganho');
    expect(html(<ChoiceModal pending={pending} lockRemaining={0} build={{}} paused={false} onSelect={noop} onConfirm={noop} />)).not.toContain('Sugerida');
  });
});
