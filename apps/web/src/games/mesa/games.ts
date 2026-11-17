/** Os jogos da casa "Dinner Table Games": o que já existe e o que vem por aí (cada um vira um cartão no carrossel). */
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
    id: 'cidade-dorme',
    name: 'Cidade Dorme',
    desc: 'A cidade dorme, a máfia acorda. Cada um recebe um papel secreto e o celular faz de narrador.',
    facts: ['6 a 15 pessoas', 'Papéis secretos', 'Narrador automático'],
    soon: true,
    icon: 'fantasma',
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

/** Ideias de jogos de mesa para os próximos (as duas primeiras já têm cartão no carrossel). */
export const MESA_FUTURE: { name: string; text: string }[] = [
  { name: 'Cidade Dorme', text: 'Máfia contra a cidade, com narrador no celular.' },
  { name: 'Mímica', text: 'Gestos sem falar, em times, contra o relógio.' },
  { name: 'Quem Sou Eu?', text: 'O celular na testa: descubra a palavra com perguntas de sim ou não.' },
  { name: 'Palavras Proibidas', text: 'Faça todo mundo acertar sem dizer as palavras proibidas.' },
  { name: 'Mais Provável', text: 'Quem da mesa é o mais provável de...? Todos votam ao mesmo tempo.' },
  { name: 'Eu Nunca', text: 'Quem já fez? Dedos para baixo e pontos para os mais sinceros.' },
  { name: 'Verdade ou Desafio', text: 'Perguntas e desafios sorteados, do leve ao maluco.' },
  { name: 'Telefone sem Fio', text: 'Desenhe, descreva e adivinhe numa corrente de risadas.' },
  { name: 'Frase Maluca', text: 'Complete a frase com a carta mais engraçada; um da mesa julga.' },
  { name: 'Quem Conhece Quem', text: 'Perguntas sobre os amigos: acerte quem respondeu o quê.' },
];
