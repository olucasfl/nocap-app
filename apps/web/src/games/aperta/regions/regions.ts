import type { AstroId } from '../astros';

/** Um elemento de uma camada, em coordenadas do viewBox 1000x1000. */
export type RegionNode =
  | { t: 'orb'; art: AstroId; x: number; y: number; r: number; o?: number }
  | {
      t: 'circle';
      cx: number;
      cy: number;
      r: number;
      fill: string;
      o?: number;
      stroke?: string;
      sw?: number;
    }
  | {
      t: 'ellipse';
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      stroke: string;
      sw: number;
      o?: number;
      dash?: string;
    }
  /** Astros espalhados com posição derivada da semente (o render é estável, sem aleatoriedade). */
  | {
      t: 'scatter';
      n: number;
      seed: number;
      art: AstroId;
      r: [min: number, span: number];
      o: number;
    }
  | {
      t: 'bubbles';
      n: number;
      seed: number;
      r: [min: number, span: number];
      o: number;
      stroke: string;
      sw: number;
      shine?: boolean;
    };

export interface RegionLayer {
  depth: 'mid' | 'near';
  /** Deslocamento do vai e vem (px) e a duração de um ciclo (s); só `transform`. */
  dx: number;
  dy: number;
  dur: number;
  nodes: RegionNode[];
}

/** Um cenário em dados (spec 038, 5.4): céu, brilho do botão e as 2 camadas de decoração. */
export interface RegionArt {
  /** Mesmo id do catálogo do motor (`REGIONS` em `@nocap/games`). */
  id: string;
  name: string;
  /** Cores do céu e das duas manchas de luz; viram variáveis CSS na região. */
  sky: { a: string; b: string; c: string; glowA: string; glowB: string };
  /** Cor do brilho do botão nesta região. */
  buttonGlow: string;
  layers: [RegionLayer, RegionLayer];
}

const SUN_GLOW = 'url(#ap-g-sun-y)';

/** Regiões dos colapsos 0 a 5 (v1). As demais chegam com v1.1 e v1.2 (etapas 14 e 15). */
export const REGION_ART: readonly RegionArt[] = [
  {
    id: 'inner-solar-system',
    name: 'Sistema Solar interno',
    sky: { a: '#1a2766', b: '#0a1030', c: '#04060f', glowA: '#5b2e91', glowB: '#1b4f9c' },
    buttonGlow: '#5ce1ff',
    layers: [
      {
        depth: 'mid',
        dx: -26,
        dy: 14,
        dur: 90,
        nodes: [
          { t: 'circle', cx: 60, cy: 70, r: 260, fill: SUN_GLOW, o: 0.55 },
          { t: 'ellipse', cx: 60, cy: 70, rx: 330, ry: 170, stroke: '#7fa0ff', sw: 2, o: 0.25 },
          { t: 'ellipse', cx: 60, cy: 70, rx: 560, ry: 310, stroke: '#7fa0ff', sw: 2, o: 0.2 },
          { t: 'ellipse', cx: 60, cy: 70, rx: 800, ry: 470, stroke: '#7fa0ff', sw: 2, o: 0.15 },
          { t: 'orb', art: 'mercury', x: 250, y: 150, r: 22 },
          { t: 'orb', art: 'venus', x: 480, y: 290, r: 34 },
          { t: 'orb', art: 'mars', x: 820, y: 420, r: 28 },
        ],
      },
      {
        depth: 'near',
        dx: 34,
        dy: -18,
        dur: 70,
        nodes: [
          { t: 'orb', art: 'moon', x: 170, y: 800, r: 70 },
          { t: 'orb', art: 'mars', x: 900, y: 860, r: 46, o: 0.9 },
        ],
      },
    ],
  },
  {
    id: 'asteroid-belt',
    name: 'Cinturão de Asteroides',
    sky: { a: '#3a2518', b: '#1c110c', c: '#070408', glowA: '#8a5a2a', glowB: '#5a3a22' },
    buttonGlow: '#ffb86b',
    layers: [
      {
        depth: 'mid',
        dx: -40,
        dy: 10,
        dur: 85,
        nodes: [{ t: 'scatter', n: 16, seed: 11, art: 'rock', r: [14, 20], o: 0.55 }],
      },
      {
        depth: 'near',
        dx: 46,
        dy: -22,
        dur: 60,
        nodes: [{ t: 'scatter', n: 6, seed: 77, art: 'rock', r: [34, 40], o: 0.9 }],
      },
    ],
  },
  {
    id: 'jupiter-saturn',
    name: 'Júpiter e Saturno',
    sky: { a: '#3a2a4a', b: '#151633', c: '#05060f', glowA: '#a8683a', glowB: '#3a4a9a' },
    buttonGlow: '#ffd98a',
    layers: [
      {
        depth: 'mid',
        dx: -22,
        dy: 16,
        dur: 100,
        nodes: [
          { t: 'orb', art: 'jupiter', x: 170, y: 820, r: 330 },
          { t: 'orb', art: 'saturn', x: 820, y: 190, r: 170 },
        ],
      },
      {
        depth: 'near',
        dx: 40,
        dy: -14,
        dur: 64,
        nodes: [
          { t: 'circle', cx: 620, cy: 620, r: 12, fill: '#f2d070' },
          { t: 'circle', cx: 660, cy: 640, r: 8, fill: '#e8e0d0' },
          { t: 'circle', cx: 500, cy: 720, r: 10, fill: '#c9b8a0' },
          { t: 'circle', cx: 300, cy: 360, r: 6, fill: '#fff', o: 0.8 },
        ],
      },
    ],
  },
  {
    id: 'kuiper-belt',
    name: 'Cinturão de Kuiper',
    sky: { a: '#1a4a72', b: '#0a1d3a', c: '#030812', glowA: '#2a7ab0', glowB: '#1a3a8a' },
    buttonGlow: '#9fe0ff',
    layers: [
      {
        depth: 'mid',
        dx: -32,
        dy: 12,
        dur: 95,
        nodes: [
          {
            t: 'ellipse',
            cx: 500,
            cy: 500,
            rx: 560,
            ry: 150,
            stroke: '#9fe0ff',
            sw: 26,
            o: 0.35,
            dash: '2 18',
          },
          { t: 'orb', art: 'ice', x: 780, y: 260, r: 26, o: 0.8 },
          {
            t: 'circle',
            cx: 780,
            cy: 260,
            r: 44,
            fill: 'none',
            stroke: '#9fe0ff',
            sw: 1.5,
            o: 0.3,
          },
          { t: 'scatter', n: 10, seed: 5, art: 'ice', r: [10, 14], o: 0.55 },
        ],
      },
      {
        depth: 'near',
        dx: 38,
        dy: -20,
        dur: 62,
        nodes: [{ t: 'scatter', n: 5, seed: 91, art: 'ice', r: [30, 36], o: 0.85 }],
      },
    ],
  },
  {
    id: 'oort-cloud',
    name: 'Nuvem de Oort',
    sky: { a: '#34185e', b: '#160a30', c: '#040108', glowA: '#6a36b0', glowB: '#2a1a7a' },
    buttonGlow: '#c3a6ff',
    layers: [
      {
        depth: 'mid',
        dx: -24,
        dy: 18,
        dur: 110,
        nodes: [
          { t: 'circle', cx: 500, cy: 120, r: 14, fill: '#fff6d0' },
          { t: 'circle', cx: 500, cy: 120, r: 46, fill: SUN_GLOW, o: 0.5 },
          { t: 'bubbles', n: 14, seed: 23, r: [12, 22], o: 0.6, stroke: '#cdb8ff', sw: 1.5 },
        ],
      },
      {
        depth: 'near',
        dx: 36,
        dy: -24,
        dur: 68,
        nodes: [
          {
            t: 'bubbles',
            n: 6,
            seed: 58,
            r: [40, 50],
            o: 0.85,
            stroke: '#e6dcff',
            sw: 2.5,
            shine: true,
          },
        ],
      },
    ],
  },
  {
    id: 'alpha-centauri',
    name: 'Alfa Centauro',
    sky: { a: '#5a3a30', b: '#1c1a3e', c: '#05060f', glowA: '#c8821c', glowB: '#3a4aa0' },
    buttonGlow: '#ffd45a',
    layers: [
      {
        depth: 'mid',
        dx: -20,
        dy: 12,
        dur: 100,
        nodes: [
          { t: 'circle', cx: 360, cy: 360, r: 190, fill: SUN_GLOW },
          { t: 'circle', cx: 620, cy: 450, r: 140, fill: 'url(#ap-g-sun-o)' },
          { t: 'circle', cx: 360, cy: 360, r: 60, fill: '#fffbe0' },
          { t: 'circle', cx: 620, cy: 450, r: 44, fill: '#fff0d0' },
        ],
      },
      {
        depth: 'near',
        dx: 32,
        dy: -16,
        dur: 64,
        nodes: [
          { t: 'circle', cx: 800, cy: 720, r: 70, fill: 'url(#ap-g-sun-r)' },
          { t: 'circle', cx: 800, cy: 720, r: 20, fill: '#ffd0c0' },
          { t: 'ellipse', cx: 800, cy: 720, rx: 150, ry: 46, stroke: '#ffb09a', sw: 2, o: 0.35 },
          { t: 'orb', art: 'mars', x: 690, y: 760, r: 32 },
        ],
      },
    ],
  },
];

const BY_ID = new Map(REGION_ART.map((r) => [r.id, r]));

/** O cenário de uma região; id desconhecido cai no Sistema Solar interno. */
export function regionArt(id: string): RegionArt {
  return BY_ID.get(id) ?? (REGION_ART[0] as RegionArt);
}
