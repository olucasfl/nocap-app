import { describe, expect, it } from 'vitest';
import { HALF, PLAYER_R } from '@nocap/games';
import { circleHitsRect, makeLayout, screenX, screenY } from './camera';

const SIZES: [number, number][] = [
  [360, 640],
  [390, 844],
  [412, 915],
  [320, 568],
  [640, 360],
  [844, 390],
  [768, 1024],
  [1280, 720],
];

describe('câmera do Sinal Vermelho', () => {
  it('o analógico nunca tapa o boneco, em qualquer tela, retrato ou paisagem, em qualquer ponto do corredor', () => {
    for (const [w, h] of SIZES) {
      const l = makeLayout(w, h, true);
      expect(l.zone).not.toBeNull();
      for (let wx = -HALF; wx <= HALF; wx += 0.25) {
        const hits = circleHitsRect(screenX(l, wx), l.heroY, PLAYER_R * l.ppm * 1.4, l.zone!);
        expect(hits, `${w}x${h} x=${wx}`).toBe(false);
      }
    }
  });

  it('o boneco fica um pouco acima do meio da tela, longe do Vigia, com espaço para ver o que vem pela frente', () => {
    for (const [w, h] of SIZES) {
      const l = makeLayout(w, h, true);
      expect(l.heroY).toBeLessThanOrEqual(h * 0.52 + 1e-9);
      expect(l.heroY).toBeGreaterThan(h * 0.2);
    }
    const l = makeLayout(360, 640, false);
    expect(l.heroY).toBeCloseTo(332.8, 6);
    // em tela alta e sem analógico, o Vigia (no topo) fica a uma boa distância do boneco
    const tall = makeLayout(390, 844, false);
    expect(tall.heroY - (112 + 150 * tall.vigiaScale * 1.25)).toBeGreaterThan(80);
  });

  it('mostra mais ou menos 18 m de largura e 32 m de altura, sem passar disso', () => {
    const l = makeLayout(360, 640, true);
    expect(l.w / l.ppm).toBeGreaterThanOrEqual(17.5);
    expect(l.h / l.ppm).toBeGreaterThanOrEqual(31.9);
    // no computador (tela larga) vê-se mais dos lados
    const wide = makeLayout(1280, 720, false);
    expect(wide.w / wide.ppm).toBeGreaterThan(30);
  });

  it('sem analógico (computador) não há zona reservada', () => {
    expect(makeLayout(1280, 720, false).zone).toBeNull();
  });

  it('o mapa do mundo para a tela: o que está à frente fica acima do boneco', () => {
    const l = makeLayout(360, 640, true);
    expect(screenY(l, 10, 0)).toBeLessThan(l.heroY);
    expect(screenY(l, -5, 0)).toBeGreaterThan(l.heroY);
    expect(screenX(l, 0)).toBe(180);
  });
});
