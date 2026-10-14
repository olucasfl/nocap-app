import type { SinalMapId } from '@nocap/games';

/** O boneco padrão de cada mapa (a cor própria só existe no online). */
export const HERO_COLOR: Record<SinalMapId, string> = {
  horta: '#e5303a',
  neon: '#2f5bff',
  deserto: '#ff9d4d',
};

/** Nome, cores e identidade de cada mapa. */
export const MAP_STYLE: Record<
  SinalMapId,
  { name: string; vigia: string; hero: string; ember: string; dark: string; rim: string }
> = {
  horta: { name: 'Horta Maluca', vigia: 'Espantalho', hero: 'Tomate', ember: '#ffd23f', dark: '#0d1a12', rim: '#ffd23f' },
  neon: { name: 'Rua Neon', vigia: 'Semáforo', hero: 'Entregador', ember: '#25c7e8', dark: '#07071a', rim: '#25c7e8' },
  deserto: {
    name: 'Ruínas do Deserto',
    vigia: 'Totem Coruja',
    hero: 'Raposa',
    ember: '#ff9ecf',
    dark: '#1a0f24',
    rim: '#ff9ecf',
  },
};

/** A paleta do cenário de cada mapa: chão, borda, fundo e a luz que cobre tudo. */
export interface Pal {
  /** Fora do corredor. */
  outer: string;
  outer2: string;
  /** Dentro do corredor (o caminho). */
  path: string;
  path2: string;
  /** A borda (cerca, meio-fio, muro). */
  edge: string;
  edge2: string;
  accent: string;
  /** A cor da névoa de longe (perto do Vigia) e a tinta da luz que cobre tudo. */
  haze: string;
  tint: string;
  tintAlpha: number;
}

export const PAL: Record<SinalMapId, Pal> = {
  horta: {
    outer: '#4a8a3e',
    outer2: '#3b7234',
    path: '#c29a62',
    path2: '#a97f4b',
    edge: '#8a5a2e',
    edge2: '#5e3b1c',
    accent: '#ffd23f',
    haze: '#cfe9ff',
    tint: '#ffd9a0',
    tintAlpha: 0.1,
  },
  neon: {
    outer: '#1b2038',
    outer2: '#141a2e',
    path: '#2d3350',
    path2: '#252a44',
    edge: '#4a5278',
    edge2: '#2c3252',
    accent: '#25c7e8',
    haze: '#3a2470',
    tint: '#3a2aa0',
    tintAlpha: 0.22,
  },
  deserto: {
    outer: '#dca85e',
    outer2: '#c8924b',
    path: '#ecc784',
    path2: '#dcb06a',
    edge: '#9a7650',
    edge2: '#6e5236',
    accent: '#ff9ecf',
    haze: '#ffd7a8',
    tint: '#ff9a55',
    tintAlpha: 0.16,
  },
};
