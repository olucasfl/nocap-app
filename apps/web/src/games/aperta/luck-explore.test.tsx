import { LEGENDARY_OBJECTS, newSave, type PendingChoice, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChoiceModal } from './ChoiceModal';
import { cuesFor, type CueInput } from './cues';
import { eventView, radarView } from './content-logic';
import { capturedTitle, objectArt, objectName } from './game-logic';
import { EventChip, EventFx, RadarChip } from './StatusStrips';
import { SPACE_OBJECTS, SpaceObject } from './SpaceObject';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const noop = () => {};

function pending(offers: string[], over: Partial<PendingChoice> = {}): PendingChoice {
  return { offers, openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0, ...over };
}

describe('oferta com 4 cartas, trocas, descarte e pity', () => {
  const four = pending(['moon', 'mercury', 'venus', 'saturn']);

  it('mostra as 4 cartas em duas colunas', () => {
    const out = html(<ChoiceModal pending={four} lockRemaining={0} build={{}} paused={false} onSelect={noop} onConfirm={noop} />);
    expect(out.match(/class="ap-pickcell"/g)).toHaveLength(4);
    expect(out).toContain('ap-picks is-four');
  });

  it('as trocas da árvore aparecem mesmo sem troca na oferta, e o descarte e o pity têm o seu lugar', () => {
    const out = html(
      <ChoiceModal
        pending={pending(['moon', 'mercury', 'venus'])}
        lockRemaining={0}
        build={{}}
        paused={false}
        onSelect={noop}
        onConfirm={noop}
        onReroll={noop}
        rerollsAvailable={2}
        discardsLeft={1}
        onDiscard={noop}
        pityLeft={3}
      />,
    );
    expect(out.match(/Trocar esta carta/g)).toHaveLength(3);
    expect(out).toContain('Trocas disponíveis: 2');
    expect(out).toContain('Descartar a oferta (1)');
    expect(out).toContain('Lendário garantido em 3 ofertas.');
    const zero = html(<ChoiceModal pending={four} lockRemaining={0} build={{}} paused={false} onSelect={noop} onConfirm={noop} pityLeft={0} />);
    expect(zero).toContain('Esta oferta traz um lendário garantido.');
    const none = html(<ChoiceModal pending={four} lockRemaining={0} build={{}} paused={false} onSelect={noop} onConfirm={noop} />);
    expect(none).not.toContain('garantido');
    expect(none).not.toContain('Descartar');
  });
});

describe('lendários e eventos na tela', () => {
  it('os 4 lendários têm arte, nome e título de captura', () => {
    for (const def of LEGENDARY_OBJECTS) {
      expect(SPACE_OBJECTS).toContain(def.kind);
      expect(objectArt(def.kind)).toBe(def.kind);
      expect(objectName(def.kind)).toBe(def.name);
      expect(capturedTitle(def.kind)).toMatch(/capturad[oa]$/);
      const svg = html(<SpaceObject kind={objectArt(def.kind)} label="" />);
      expect(svg).toContain(`data-kind="${def.kind}"`);
      expect(svg).not.toContain('NaN');
    }
  });

  it('o chip do evento tem a barra de tempo por transform (duração em CSS, sem número) e o brilho próprio', () => {
    const s: SaveState = { ...newSave('e'), tutorial: 'done', collapses: 4, regionId: 'oort-cloud' };
    const live = { ...s, run: { ...s.run, event: { id: 'gold-rain' as const, until: 40 } } };
    const view = eventView(live, 10)!;
    expect(view).toMatchObject({ id: 'gold-rain', name: 'Chuva de ouro', remaining: 30 });
    const chip = html(<EventChip view={view} />);
    expect(chip).toContain('ap-chip-bar');
    expect(chip).toContain('animation-duration:30.0s');
    expect(chip).not.toMatch(/\b30\b[^.]/);
    expect(html(<EventFx id="eclipse" lite={false} />)).toContain('ap-evfx-eclipse');
    expect(eventView(live, 50)).toBeNull();
  });

  it('o radar só aparece com o nó e enche sem mostrar número solto', () => {
    const s: SaveState = { ...newSave('r'), tutorial: 'done', collapses: 4, regionId: 'oort-cloud' };
    expect(radarView(s)).toBeNull();
    const withNode = { ...s, tree: { 'ex-01': 1 }, run: { ...s.run, radar: 5 } };
    const view = radarView(withNode)!;
    expect(view).toMatchObject({ captures: 5, threshold: 80, fill: 0.0625 });
    const chip = html(<RadarChip view={view} />);
    expect(chip).toContain('scaleX(0.063)');
  });

  it('cada evento da árvore toca um som que já existe', () => {
    const base: CueInput = { starReady: false, eventId: null, missionDone: false, region: 'a', freshKey: null };
    const cue = (id: string) => cuesFor(base, { ...base, eventId: id });
    expect(cue('gold-rain')).toEqual(['chime']);
    expect(cue('energy-tide')).toEqual(['storm']);
    expect(cue('alignment')).toEqual(['warp']);
    expect(cue('eclipse')).toEqual(['warp']);
    expect(cue('meteor-shower')).toEqual(['shower']);
  });
});
