import { CHOICE_LOCK_SEC, newSave, type PendingChoice } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChoiceModal } from './ChoiceModal';
import { GamePage, PAGE_TITLE } from './GamePage';
import { GameScreen } from './GameScreen';
import { createGameController } from './game-controller';
import { createMemoryGameStore } from './game-store';
import type { PageName } from './game-logic';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const noop = () => {};

function screen(mutate?: (s: ReturnType<typeof newSave>) => ReturnType<typeof newSave>) {
  const initial = mutate ? mutate(newSave('teste', 0)) : newSave('teste', 0);
  const controller = createGameController({ initial, store: createMemoryGameStore(), slot: 1 });
  return html(<GameScreen controller={controller} onExit={noop} />);
}

describe('tela de jogo', () => {
  it('tem o botão central real, com nome acessível', () => {
    const markup = screen();
    expect(markup).toMatch(/<button[^>]*aria-label="Apertar o botão"/);
    expect(markup).toContain('ap-bigbtn-stem');
  });

  it('mostra poeira, colapsos e a energia no teto do primeiro passo', () => {
    const markup = screen();
    expect(markup).toContain('poeira');
    expect(markup).toContain('colapsos');
    expect(markup).toContain('0/38');
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuemax="38"');
  });

  it('a dock tem Conquistas, Grimórios e Melhorias e o botão da Árvore fica no topo', () => {
    const markup = screen();
    for (const label of ['Conquistas', 'Grimórios', 'Melhorias', 'Árvore de Habilidades']) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain('aria-label="Menu do jogo"');
  });

  it('não mostra combo nem selos no começo, e a região de avisos é role=status', () => {
    const markup = screen();
    expect(markup).not.toContain('ap-combo');
    expect(markup).not.toContain('ap-badge');
    expect(markup).toMatch(/role="status"[^>]*aria-live="polite"/);
  });

  it('o selo de Melhorias conta o que dá para comprar', () => {
    const markup = screen((s) => ({ ...s, run: { ...s.run, dust: 2000 } }));
    expect(markup).toContain('Melhorias, 1 para comprar');
  });

  it('a barra brilha quando quase cheia', () => {
    expect(screen()).not.toContain('ap-evglow');
    expect(screen((s) => ({ ...s, run: { ...s.run, energy: 55 } }))).toContain('ap-evglow');
  });

  it('sem nenhuma página nem modal abertos no começo', () => {
    const markup = screen();
    expect(markup).not.toContain('ap-sheet"');
    expect(markup).not.toContain('role="dialog"');
  });

  it('com a barra cheia abre a escolha de grimório por cima do jogo', () => {
    const markup = screen((s) => {
      const pending: PendingChoice = {
        offers: ['moon', 'mercury', 'venus'],
        openedAt: 0,
        selected: null,
        picksLeft: 1,
        rerollsLeft: 0,
      };
      return { ...s, run: { ...s.run, energy: 60, pending } };
    });
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('A energia transbordou');
  });
});

describe('páginas provisórias', () => {
  const pages: PageName[] = ['upgrades', 'grimoires', 'achievements', 'tree'];

  it.each(pages)('%s tem título, faixa de aviso e botão de fechar', (name) => {
    const markup = html(<GamePage name={name} notice="Um aviso." onClose={noop} />);
    expect(markup).toContain(PAGE_TITLE[name]);
    expect(markup).toContain('Um aviso.');
    expect(markup).toContain(`aria-label="Fechar ${PAGE_TITLE[name]}"`);
  });
});

describe('escolha de energia cheia', () => {
  const pending: PendingChoice = {
    offers: ['moon', 'mercury', 'venus'],
    openedAt: 0,
    selected: null,
    picksLeft: 1,
    rerollsLeft: 0,
  };
  const modal = (over: Partial<Parameters<typeof ChoiceModal>[0]>) =>
    html(
      <ChoiceModal
        pending={pending}
        lockRemaining={0}
        build={{}}
        paused={false}
        onSelect={noop}
        onConfirm={noop}
        {...over}
      />,
    );

  it('mostra 3 cartas e a dica do nível', () => {
    const markup = modal({});
    expect(markup.match(/<button[^>]*class="ap-pick[ "]/g)).toHaveLength(3);
    expect(markup).toContain('Lua');
    expect(markup).toContain('Pegar o mesmo de novo sobe o nível dele.');
  });

  it('bloqueada: cartas e confirmar desligados, com a barra de espera', () => {
    const markup = modal({ lockRemaining: CHOICE_LOCK_SEC });
    expect(markup.match(/<button[^>]*disabled/g)?.length).toBe(4);
    expect(markup).toContain('Aguarde um instante...');
    expect(markup).toContain('ap-lockbar');
  });

  it('livre mas sem carta marcada: só o confirmar segue desligado', () => {
    const markup = modal({});
    expect(markup.match(/<button[^>]*disabled/g)?.length).toBe(1);
    expect(markup).not.toContain('aria-pressed="true"');
  });

  it('com carta marcada, ela fica pressionada e o confirmar liga', () => {
    const markup = modal({ pending: { ...pending, selected: 'moon' } });
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).not.toMatch(/<button[^>]*disabled/);
  });

  it('grimório repetido avisa que sobe de nível', () => {
    expect(modal({ build: { moon: 2 } })).toContain('Você tem nível 2: sobe para o 3');
  });
});

describe('objetos no espaço', () => {
  const withObject = (kind: 'comet' | 'shooting-star' | 'satellite') => (s: ReturnType<typeof newSave>) => ({
    ...s,
    clock: 3,
    run: { ...s.run, objects: [{ id: 7, kind, bornAt: 0, expiresAt: 7 }], nextObjectId: 8, nextSpawnAt: 1e6 },
  });

  it('sem objetos, a camada fica escondida', () => {
    expect(screen()).toMatch(/class="ap-objs"[^>]*hidden/);
    expect(screen()).not.toContain('ap-obj-tag');
  });

  it('cada objeto é um botão com nome e recompensa antes de tocar, e barra de vida', () => {
    const markup = screen(withObject('comet'));
    expect(markup).toMatch(/<button[^>]*class="ap-obj[^"]*"[^>]*aria-label="Cometa: \+\d+ poeira\. Capturar"/);
    expect(markup).toContain('ap-obj-tag');
    expect(markup).toContain('ap-obj-life');
    expect(markup).toContain('ap-obj-pulse');
  });

  it('estrela cadente mostra energia e satélite promete o Sinal forte', () => {
    expect(screen(withObject('shooting-star'))).toMatch(/Estrela cadente: \+[\d,]+ energia/);
    expect(screen(withObject('satellite'))).toContain('Sinal forte x2 por 8 s');
  });

  it('o chip Sinal forte aparece no HUD só com o boost ativo', () => {
    expect(screen()).not.toContain('ap-signal');
    const markup = screen((s) => ({ ...s, clock: 0, run: { ...s.run, boostMult: 2, boostUntil: 50 } }));
    expect(markup).toContain('ap-signal');
    expect(markup).toContain('Sinal forte x2');
  });
});
