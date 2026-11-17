/** Imagens do Impostor (Fluent Emoji 3D, Microsoft, MIT: docs/CREDITS-IMPOSTOR.md). */
export const PEOPLE = ["cantora", "heroi", "vila", "mago", "astronauta", "ninja", "detetive", "cozinheiro", "artista", "genio", "vampiro", "cientista", "bombeiro", "piloto", "malabarista", "elfo", "realeza", "smoking"] as const;
export const ANIMALS = ["raposa", "gato", "cachorro", "leao", "tigre", "urso", "panda", "coala", "sapo", "macaco", "coruja", "pinguim", "unicornio", "lobo", "porco", "coelho", "dragao", "alien", "robo", "fantasma"] as const;
export const AVATARS: readonly string[] = [...PEOPLE, ...ANIMALS];

export const avatarSrc = (slug: string) => `/impostor/av/${slug}.png`;
export const iconSrc = (slug: string) => `/impostor/ic/${slug}.png`;

/** Cor fixa de cada jogador (a ficha atrás do personagem). */
export const COLORS = [
  '#ff6a2b', '#2f5bff', '#ffd23f', '#33c27f', '#ff9ecf', '#8f6bff', '#19c3e6', '#ff5a3c',
  '#b8f03a', '#ff8fab', '#f9a825', '#7e57c2', '#26a69a', '#ef5350', '#42a5f5',
] as const;

export const CATEGORY_ICONS: Readonly<Record<string, string>> = {
  comida: 'comida', animais: 'animais', lugares: 'lugares', marcas: 'marcas', esportes: 'esportes',
  filmes: 'filmes', herois: 'herois', musica: 'musica', clash: 'clash', futebol: 'futebol',
};

/** Todas as imagens, para carregar antes de precisar (a troca de tela não pode piscar). */
export function preloadImages(): void {
  for (const a of AVATARS) new Image().src = avatarSrc(a);
  for (const i of [...Object.values(CATEGORY_ICONS), 'jogo', 'lupa', 'coroa', 'trofeu', 'prata', 'bronze', 'olhos', 'ampulheta', 'cartas', 'confete', 'fantasma']) new Image().src = iconSrc(i);
}
