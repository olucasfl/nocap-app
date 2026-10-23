import { UPGRADES, newSave, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChoiceModal } from './ChoiceModal';
import { GrimoiresPage } from './GrimoiresPage';
import { RegionMenu } from './RegionMenu';
import { EventChip, MissionChip, NewInSpace } from './StatusStrips';
import { createGameController } from './game-controller';
import { createMemoryGameStore } from './game-store';
import {
  cardGain,
  eventView,
  gaiaPreviews,
  missionView,
  newInSpaceKey,
  newInSpaceView,
  regionMenuItems,
} from './content-logic';
import { REGION_ART, RegionBackdrop, regionArt } from './regions';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

function atCollapse(k: number, over: Partial<SaveState> = {}): SaveState {
  const s = newSave('conteudo', 0);
  const region = [...REGION_ART].reverse()[5 - Math.min(5, k)]!;
  return { ...s, tutorial: 'done', collapses: k, regionId: region.id, ...over };
}

describe('regiões em dados', () => {
  it('há uma arte por região do motor, com 2 camadas e cores próprias', () => {
    expect(REGION_ART.map((r) => r.id)).toEqual([
      'inner-solar-system',
      'asteroid-belt',
      'jupiter-saturn',
      'kuiper-belt',
      'oort-cloud',
      'alpha-centauri',
    ]);
    expect(new Set(REGION_ART.map((r) => r.sky.a)).size).toBe(REGION_ART.length);
    for (const r of REGION_ART) expect(r.layers.map((l) => l.depth)).toEqual(['mid', 'near']);
  });

  it('id desconhecido cai no Sistema Solar interno', () => {
    expect(regionArt('nao-existe').id).toBe('inner-solar-system');
  });

  it('as cores do céu viram variáveis CSS na região', () => {
    const markup = html(<RegionBackdrop region="kuiper-belt" />);
    expect(markup).toContain('--ap-sky-a:#1a4a72');
    expect(markup).toContain('data-region="kuiper-belt"');
  });
});

describe('menu de regiões', () => {
  it('lista só as regiões já abertas, marcando a atual', () => {
    expect(regionMenuItems(atCollapse(0)).map((i) => i.art.id)).toEqual(['inner-solar-system']);
    const items = regionMenuItems(atCollapse(3, { regionId: 'asteroid-belt' }));
    expect(items.map((i) => i.art.id)).toEqual(['inner-solar-system', 'asteroid-belt', 'jupiter-saturn', 'kuiper-belt']);
    expect(items.filter((i) => i.current).map((i) => i.art.id)).toEqual(['asteroid-belt']);
  });

  it('renderiza um botão por região e marca a atual', () => {
    const markup = html(<RegionMenu items={regionMenuItems(atCollapse(2))} onPick={() => {}} onClose={() => {}} />);
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('Cinturão de Asteroides');
    expect(markup).toContain('Júpiter e Saturno');
    expect(markup).not.toContain('Nuvem de Oort');
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it('o controlador troca a região e salva; região fechada é recusada', async () => {
    const store = createMemoryGameStore();
    const ctl = createGameController({ initial: atCollapse(2), store, slot: 1, perf: () => 1000 });
    ctl.setRegion('asteroid-belt');
    expect(ctl.getSnapshot().state.regionId).toBe('asteroid-belt');
    ctl.setRegion('oort-cloud');
    expect(ctl.getSnapshot().state.regionId).toBe('asteroid-belt');
    await ctl.save(true);
    expect((await store.load(1))?.regionId).toBe('asteroid-belt');
  });
});

describe('faixa "Novo no espaço"', () => {
  it('aparece depois de um colapso, com a região primeiro, e some ao dispensar', () => {
    const s = atCollapse(2);
    const view = newInSpaceView(s)!;
    expect(view.key).toBe(newInSpaceKey(2));
    expect(view.items[0]).toMatchObject({ kind: 'region', name: 'Júpiter e Saturno' });
    const markup = html(<NewInSpace view={view} onDismiss={() => {}} />);
    for (const name of ['Calisto', 'Encélado', 'Sonda Voyager', 'Favorito', 'Chuva de meteoros']) expect(markup).toContain(name);
    expect(newInSpaceView({ ...s, seenUnlocks: [view.key] })).toBeNull();
  });

  it('não aparece no início do jogo nem durante o tutorial', () => {
    expect(newInSpaceView(atCollapse(0))).toBeNull();
    expect(newInSpaceView(atCollapse(1, { tutorial: 3 }))).toBeNull();
  });

  it('o controlador guarda a chave no save', async () => {
    const store = createMemoryGameStore();
    const ctl = createGameController({ initial: atCollapse(1), store, slot: 1, perf: () => 1000 });
    ctl.dismissNew(newInSpaceKey(1));
    ctl.dismissNew(newInSpaceKey(1));
    expect(ctl.getSnapshot().state.seenUnlocks).toEqual([newInSpaceKey(1)]);
    expect(newInSpaceView(ctl.getSnapshot().state)).toBeNull();
  });
});

describe('missão e evento na tela', () => {
  it('a missão mostra o progresso; cumprida, mostra o prêmio', () => {
    const s = atCollapse(4);
    const open = { ...s, run: { ...s.run, mission: { id: 'capture-10', progress: 3, done: false, doneAt: -1e9 } } };
    expect(missionView(open)).toMatchObject({ progress: 3, target: 10, done: false });
    expect(html(<MissionChip view={missionView(open)!} />)).toContain('(3/10)');
    const done = { ...s, run: { ...s.run, mission: { id: 'capture-10', progress: 10, done: true, doneAt: -1e9 } } };
    expect(html(<MissionChip view={missionView(done)!} />)).toContain('Missão cumprida');
    expect(missionView(s)).toBeNull();
  });

  it('o evento aparece só enquanto vale e não tem cronômetro', () => {
    const s = atCollapse(4);
    const live = { ...s, run: { ...s.run, event: { id: 'solar-storm' as const, until: 100 } } };
    expect(eventView(live, 90)).toMatchObject({ name: 'Tempestade solar' });
    expect(eventView(live, 100)).toBeNull();
    const markup = html(<EventChip view={eventView(live, 90)!} />);
    expect(markup).toContain('Tempestade solar');
    expect(markup).not.toMatch(/\d+ ?s\b.*restan/i);
    expect(markup).not.toContain('<progress');
  });
});

describe('Favorito no álbum', () => {
  const s = atCollapse(2, { album: ['moon', 'mars'], favorite: 'mars' });

  it('mostra o botão só depois do colapso 2 e só nos descobertos', () => {
    const open = html(<GrimoiresPage state={s} onFavorite={() => {}} />);
    expect(open.match(/class="ap-fav"/g)).toHaveLength(2);
    expect(open).toContain('Marcar Lua como favorito');
    expect(open).toContain('Tirar Marte dos favoritos');
    expect(html(<GrimoiresPage state={{ ...s, collapses: 1 }} onFavorite={() => {}} />)).not.toContain('ap-fav');
    expect(html(<GrimoiresPage state={s} />)).not.toContain('ap-fav');
  });

  it('o controlador marca e desmarca', () => {
    const ctl = createGameController({ initial: s, store: createMemoryGameStore(), slot: 1, perf: () => 1000 });
    ctl.setFavorite('moon');
    expect(ctl.getSnapshot().state.favorite).toBe('moon');
    ctl.setFavorite('venus');
    expect(ctl.getSnapshot().state.favorite).toBe('moon');
    ctl.setFavorite(null);
    expect(ctl.getSnapshot().state.favorite).toBeNull();
  });
});

describe('Observatório Gaia: a carta mostra o efeito', () => {
  const withGaia = (k = 5) => {
    const s = atCollapse(k);
    const levels = s.run.upgradeLevels.slice();
    levels[UPGRADES.findIndex((u) => u.id === 'gaia')] = 1;
    return { ...s, run: { ...s.run, upgradeLevels: levels } };
  };

  it('sem Gaia só aparece o que muda nos números, sem a frase de efeito de ocasião', () => {
    const p = gaiaPreviews(atCollapse(5), ['vesta', 'moon']);
    for (const text of Object.values(p)) expect(text).not.toContain('sem mudança');
  });

  it('com Gaia, cada carta diz o que muda nos números da vida', () => {
    const p = gaiaPreviews(withGaia(), ['sirius', 'mars', 'moon']);
    expect(p.sirius).toMatch(/^Poeira por toque no combo máximo: \+0 -> \+2/);
    expect(p.mars).toContain('Estrela cadente: 2 toques -> 4 toques');
    expect(p.moon).toContain('A cada 10 toques, poeira: x1 -> x2');
  });

  it('o cálculo vem do motor: pegar de novo sobe o nível', () => {
    const s = withGaia();
    const lv1 = { ...s, run: { ...s.run, build: { sirius: 1 } } };
    expect(cardGain(s, 'sirius')).not.toEqual(cardGain(lv1, 'sirius'));
  });

  it('toque especial (Deimos) mostra o antes e o depois, também ao subir de nível', () => {
    const s = withGaia();
    expect(cardGain(s, 'deimos')).toMatch(/^A cada 15 toques, poeira: x1 -> x/);
    const lv2 = { ...s, run: { ...s.run, build: { deimos: 2 } } };
    const g = cardGain(lv2, 'deimos');
    expect(g).toMatch(/^A cada 15 toques, poeira: x[\d,]+ -> x[\d,]+$/);
    const [from, to] = g!.match(/x[\d,]+/g)!;
    expect(to).not.toEqual(from);
  });

  it('a escolha mostra a linha extra', () => {
    const s = withGaia();
    const pending = { offers: ['sirius'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
    const markup = html(
      <ChoiceModal
        pending={pending}
        lockRemaining={0}
        build={{}}
        paused={false}
        onSelect={() => {}}
        onConfirm={() => {}}
        gain={gaiaPreviews(s, pending.offers)}
      />,
    );
    expect(markup).toContain('ap-pick-gain');
    expect(markup).toContain('Poeira por toque no combo máximo');
  });
});
