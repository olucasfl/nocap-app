import { TUTORIAL, newSave, type SaveState } from '@nocap/games';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TutorialCoach, TutorialInline } from './Tutorial';
import { GameScreen } from './GameScreen';
import { StoryScreen } from './StoryScreen';
import { createGameController } from './game-controller';
import { createMemoryGameStore } from './game-store';
import { coachView } from './tutorial-logic';

const noop = () => {};
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

function screen(patch: Partial<SaveState>) {
  const initial = { ...newSave('teste', 0), ...patch };
  const controller = createGameController({ initial, store: createMemoryGameStore(), slot: 1 });
  return html(<GameScreen controller={controller} onExit={noop} />);
}

describe('tela de jogo no tutorial', () => {
  it('um save novo abre só com o botão central, a poeira, a barra e a dica; sem dock nem véu', () => {
    const markup = screen({});
    expect(markup).toContain('data-tut="press"');
    expect(markup).toContain('Pular tutorial');
    expect(markup).not.toContain('ap-dock');
    expect(markup).not.toContain('data-tut="tree"');
    expect(markup).not.toContain('ap-tut-veil');
    expect(markup).not.toMatch(/Melhorias|Grimórios|Conquistas|Árvore de Habilidades/);
    expect(markup).not.toMatch(/colapso/);
    expect(markup).toContain('poeira');
    expect(markup).toContain('Energia');
  });

  it('o passo 2 mostra só o botão Melhorias, com o cartão de parabéns', () => {
    const markup = screen({ tutorial: TUTORIAL.UPGRADE, ui: { unlocked: ['upgrades'], hints: [] } });
    expect(markup).toContain('data-tut="dock-upgrades"');
    expect(markup).not.toContain('data-tut="dock-grimoires"');
    expect(markup).not.toContain('data-tut="dock-achievements"');
    expect(markup).toContain('Parabéns!');
    expect(markup).toContain('Você já pode comprar sua primeira melhoria.');
    expect(markup).toContain('Pular tutorial');
  });

  it('com o tutorial concluído aparecem todos os botões e nenhuma dica', () => {
    const markup = screen({ tutorial: 'done' });
    for (const target of ['press', 'dock-upgrades', 'dock-grimoires', 'dock-achievements', 'tree']) expect(markup).toContain(`data-tut="${target}"`);
    expect(markup).not.toContain('ap-tut');
    expect(markup).not.toContain('Pular tutorial');
  });

  it('retomar no jogo livre sem gatilho: sem dica, e só o que já foi liberado', () => {
    const markup = screen({ tutorial: TUTORIAL.FREE, ui: { unlocked: ['upgrades', 'grimoires'], hints: [] } });
    expect(markup).toContain('data-tut="dock-grimoires"');
    expect(markup).not.toContain('data-tut="dock-achievements"');
    expect(markup).not.toContain('ap-tut-card');
  });

  it('a escolha do 1º grimório leva o cartão dentro do modal', () => {
    const base = newSave('teste', 0);
    const pending = { offers: ['moon', 'mercury', 'venus'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
    const markup = screen({ tutorial: TUTORIAL.CHOOSE, run: { ...base.run, pending }, ui: { unlocked: ['upgrades', 'grimoires'], hints: [] } });
    expect(markup).toContain('ap-tut-inline');
    expect(markup).toContain('Você ganhou seu primeiro grimório!');
    expect(markup).toContain('Pular tutorial');
  });
});

describe('peças do tutorial', () => {
  it('o cartão do jogo livre tem Entendi discreto e o do roteiro não tem', () => {
    const free = { ...newSave('t', 0), tutorial: TUTORIAL.FREE, achievements: ['tap-1', 'tap-100'] };
    const view = coachView(free, null);
    expect(view).not.toBeNull();
    const markup = html(<TutorialCoach view={view!} onDismiss={noop} onSkip={noop} skipInCard={false} />);
    expect(markup).toContain('Entendi');
    expect(markup).not.toContain('Pular tutorial');
    const guided = coachView({ ...newSave('t', 0), tutorial: TUTORIAL.UPGRADE }, null);
    const guidedMarkup = html(<TutorialCoach view={guided!} onDismiss={noop} onSkip={noop} skipInCard={true} />);
    expect(guidedMarkup).not.toContain('Entendi');
    expect(guidedMarkup).toContain('Pular tutorial');
  });

  it('a dica do passo 1 tem cartão com o passo e o texto, e sem alvo medido não escurece nem bloqueia', () => {
    const view = coachView(newSave('t', 0), null)!;
    const markup = html(<TutorialCoach view={view} onDismiss={noop} onSkip={noop} skipInCard={false} />);
    expect(markup).toContain('ap-tut-card');
    expect(markup).toContain('Passo 1 de 6');
    expect(markup).toContain('Bem-vindo à Perigeu');
    // Falha aberta: o alvo ainda não foi medido (render de servidor), então nada bloqueia a tela.
    expect(markup).toContain('data-blocking="false"');
    expect(markup).not.toContain('ap-tut-block');
    expect(markup).not.toContain('ap-tut-dim');
  });

  it('o cartão da escolha explica carta, bloqueio e confirmar', () => {
    const pending = { offers: ['moon'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
    const base = newSave('t', 0);
    const view = coachView({ ...base, tutorial: TUTORIAL.CHOOSE, run: { ...base.run, pending } }, null)!;
    const markup = html(<TutorialInline view={view} onSkip={noop} />);
    expect(markup).toContain('marcá-la');
    expect(markup).toContain('1,6 s');
    expect(markup).toContain('Escolher');
  });
});

describe('história', () => {
  it('abre na primeira cena, com a ilustração e o progresso de 4 registros', () => {
    const markup = html(<StoryScreen onDone={noop} />);
    expect(markup).toContain('Registro 1 de 4');
    expect(markup).toContain('ap-scene');
    expect(markup).toContain('Ano 2187');
    expect(markup).not.toContain('st-books');
  });
});

describe('CSS do tutorial', () => {
  const css = readFileSync(join(__dirname, 'tutorial.css'), 'utf8');

  it('os keyframes só animam transform e opacity', () => {
    const blocks = [...css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)];
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    for (const [, body] of blocks) {
      for (const [, p] of body!.matchAll(/([a-z-]+)\s*:/g)) expect(['transform', 'opacity'], `propriedade ${p}`).toContain(p);
    }
    expect(css).not.toMatch(/transition\s*:/);
  });

  it('respeita prefers-reduced-motion', () => {
    const reduced = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(reduced).toMatch(/\.ap-tut-glow[\s\S]*animation:\s*none/);
    expect(reduced).toMatch(/\.ap-tut-arrow[\s\S]*animation:\s*none/);
    expect(reduced).toMatch(/\.ap-dock-in[\s\S]*animation:\s*none/);
  });

  it('nada escurece a tela nem prende o toque: o contêiner deixa passar e só o cartão pega', () => {
    expect(css).toMatch(/\.ap-tut \{[^}]*z-index:\s*60[^}]*pointer-events:\s*none/);
    expect(css).not.toMatch(/veil/);
    expect(css).not.toMatch(/rgba\(2,\s*3,\s*10/);
    expect(css).toMatch(/\.ap-tut-card \{[^}]*pointer-events:\s*auto/);
  });

  it('os botões do cartão têm alvo de toque de pelo menos 44 px e são discretos (sem fundo cheio)', () => {
    expect(css).toMatch(/\.ap-tut-ok,\s*\.ap-tut-skip \{[^}]*min-height:\s*(4[4-9]|[5-9]\d)px[^}]*background:\s*transparent/);
  });

  it('usa só os tokens do tema espaço (sem cor solta)', () => {
    const withoutRgba = css.replace(/rgba?\([^)]*\)/g, '');
    expect(withoutRgba).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
