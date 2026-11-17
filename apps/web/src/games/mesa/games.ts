/** Os jogos da casa "Social Table Games": o que já existe e o que vem por aí (cada um vira um cartão no carrossel). */
export interface MesaGameStep { icon: string; title: string; text: string }

export interface MesaGameInfo {
  id: string;
  name: string;
  desc: string;
  facts: string[];
  soon: boolean;
  /** Ícone grande do cartão "em breve". */
  icon?: string;
  steps?: MesaGameStep[];
}

export const MESA_GAMES: MesaGameInfo[] = [
  {
    id: 'impostor',
    name: 'Impostor',
    desc: 'O jogo de dedução para jogar em roda: ache quem está fingindo saber a palavra.',
    facts: ['3 a 15 pessoas', '3 modos de jogo', '10 temas', 'Sem anúncio'],
    soon: false,
    steps: [
      { icon: 'olhos', title: 'Veja o seu papel', text: 'Todo mundo recebe a mesma palavra secreta, menos o impostor.' },
      { icon: 'ampulheta', title: 'Deem dicas e debatam', text: 'Uma palavra por pessoa, rodada a rodada. Depois, conversem.' },
      { icon: 'lupa', title: 'Votem no impostor', text: 'Quem acerta o impostor ganha pontos. O ranking soma as partidas.' },
    ],
  },
  {
    id: 'frase-maluca',
    name: 'Frase Maluca',
    desc: 'Complete a frase com a carta mais engraçada; um da mesa julga a melhor a cada rodada.',
    facts: ['3 a 12 pessoas', 'Cartas de frases', 'Um juiz por rodada'],
    soon: true,
    icon: 'cartas',
  },
  {
    id: 'mimica',
    name: 'Mímica',
    desc: 'Um mostra a palavra só com gestos e a galera adivinha antes de o tempo acabar. Em times.',
    facts: ['4 a 12 pessoas', 'Em times', 'Palavras por tema'],
    soon: true,
    icon: 'confete',
  },
];
