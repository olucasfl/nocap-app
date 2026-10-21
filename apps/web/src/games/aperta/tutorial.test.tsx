import { newSave } from '@nocap/games';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FirstGrimoireModal, TutorialOverlay } from './Tutorial';
import { GameScreen } from './GameScreen';
import { createGameController } from './game-controller';
import { createMemoryGameStore } from './game-store';
import { tutorialView } from './tutorial-logic';

const noop = () => {};
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

function screen(tutorial: number | 'done') {
  const initial = { ...newSave('teste', 0), tutorial };
  const controller = createGameController({ initial, store: createMemoryGameStore(), slot: 1 });
  return html(<GameScreen controller={controller} onExit={noop} />);
}

describe('tutorial na tela de jogo', () => {
  it('um save novo abre com o véu e o cartão do passo 1, com Pular tutorial', () => {
    const markup = screen(1);
    expect(markup).toContain('ap-tut-card');
    expect(markup).toContain('Tutorial · passo 1 de 5');
    expect(markup).toContain('Aperte o botão');
    expect(markup).toContain('Pular tutorial');
  });

  it('com o tutorial concluído não há véu nem cartão', () => {
    const markup = screen('done');
    expect(markup).not.toContain('ap-tut');
    expect(markup).not.toContain('Pular tutorial');
  });

  it('os alvos existem na tela: botão, dock de Melhorias e de Grimórios', () => {
    const markup = screen('done');
    for (const target of ['press', 'dock-upgrades', 'dock-grimoires']) expect(markup).toContain(`data-tut="${target}"`);
  });

  it('o passo 2 mostra o livro da Lua com Entendi', () => {
    const markup = screen(2);
    expect(markup).toContain('Primeiro grimório');
    expect(markup).toContain('data-tut="ok"');
    expect(markup).toContain('Entendi');
    expect(markup).toContain('Tutorial · passo 2 de 5');
  });

  it('retomar no passo 5 aponta para o ícone de grimórios', () => {
    const markup = screen(5);
    expect(markup).toContain('Tutorial · passo 5 de 5');
    expect(markup).toContain('Agora os grimórios');
  });
});

describe('peças do tutorial', () => {
  it('o cartão do passo 5 com a página aberta ganha Começar a jogar', () => {
    const markup = html(<TutorialOverlay view={tutorialView(5, 'grimoires')} onSkip={noop} onFinish={noop} />);
    expect(markup).toContain('Começar a jogar');
    expect(markup).toContain('Pular tutorial');
    expect(html(<TutorialOverlay view={tutorialView(1, null)} onSkip={noop} onFinish={noop} />)).not.toContain('Começar a jogar');
  });

  it('o modal da Lua tem papel de diálogo com nome', () => {
    const markup = html(<FirstGrimoireModal onDone={noop} />);
    expect(markup).toMatch(/role="dialog"[^>]*aria-labelledby="ap-first-title"/);
    expect(markup).toContain('Lua');
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
  });

  it('o véu captura toque e fica acima de tudo; o resto do overlay não atrapalha o alvo', () => {
    expect(css).toMatch(/\.ap-tut \{[^}]*z-index:\s*60[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/\.ap-tut-veil \{[^}]*pointer-events:\s*auto/);
  });

  it('o botão de pular tem alvo de toque de pelo menos 44 px', () => {
    expect(css).toMatch(/\.ap-tut-skip \{[^}]*min-height:\s*(4[4-9]|[5-9]\d)px/);
  });

  it('usa só os tokens do tema espaço (sem cor solta)', () => {
    const withoutRgba = css.replace(/rgba?\([^)]*\)/g, '');
    expect(withoutRgba).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
