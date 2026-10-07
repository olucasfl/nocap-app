import { buzz, sfx } from './sfx';

/**
 * Faixas da nota (0 a 10, 1 casa). CRAVOU é só o 10: 9,6 é "quase perfeito", não cravou.
 * Cada faixa tem nome, cor, animação (classe CSS `g-<id>`), som e frases irônicas.
 */
export type GradeId =
  'perfect' | 'near' | 'great' | 'good' | 'pass' | 'meh' | 'bad' | 'awful' | 'zero';

export interface Grade {
  id: GradeId;
  /** Palavra do carimbo. */
  word: string;
  /** Nota mínima da faixa. */
  min: number;
}

/** Da melhor para a pior. */
export const GRADES: Grade[] = [
  { id: 'perfect', word: 'cravou', min: 10 },
  { id: 'near', word: 'quase perfeito', min: 9 },
  { id: 'great', word: 'mandou bem', min: 8 },
  { id: 'good', word: 'dá pro gasto', min: 7 },
  { id: 'pass', word: 'passa na raça', min: 6 },
  { id: 'meh', word: 'meh', min: 5 },
  { id: 'bad', word: 'foi na fé', min: 3 },
  { id: 'awful', word: 'que isso?', min: 1 },
  { id: 'zero', word: 'zerou', min: 0 },
];

export function gradeOf(score: number): Grade {
  // A nota já vem com 1 casa; o arredondamento evita 9,9999 virar "quase" por erro de ponto flutuante.
  const s = Math.round(score * 10) / 10;
  return GRADES.find((g) => s >= g.min) ?? GRADES[GRADES.length - 1]!;
}

type Lines = { any: string[]; color: string[]; time: string[] };

const LINES: Record<GradeId, Lines> = {
  perfect: {
    any: [
      'No cap. Perfeição técnica.',
      'Isso foi suspeito. Mas eu aplaudo.',
      'Os olhos da águia ficaram com inveja.',
    ],
    color: ['Você é um scanner ou o quê?', 'A cor se sentiu vista.'],
    time: ['Você engoliu um relógio?', 'O cronômetro pediu seu autógrafo.'],
  },
  near: {
    any: [
      'A um suspiro da perfeição.',
      'O perfeito mandou lembranças.',
      'Faltou só o 0,1 do orgulho.',
    ],
    color: ['Quase leu a mente da cor.'],
    time: ['Foi por um piscar de olhos.'],
  },
  great: {
    any: [
      'Mandou bem, confesso.',
      'Pode se achar um pouquinho.',
      'Tá aí alguém que presta atenção.',
    ],
    color: ['Seus olhos merecem um café.'],
    time: ['Seu relógio interno está em dia.'],
  },
  good: {
    any: ['Deu pro gasto.', 'Não foi mal. Também não foi bom.', 'Nota de quem acompanha a novela.'],
    color: ['A cor ficou "parecida", é isso.'],
    time: ['Perto o bastante para ninguém reclamar.'],
  },
  pass: {
    any: [
      'Passou raspando, igual na escola.',
      'Aprovado no conselho de classe.',
      'Cumpriu a tabela.',
    ],
    color: ['Era uma cor, não uma sugestão.'],
    time: ['O tempo passou. Você também.'],
  },
  meh: {
    any: ['Meh. Literalmente.', 'Nem frio nem quente: morno.', 'A média agradece a visita.'],
    color: ['A cor está sorrindo amarelo.'],
    time: ['Foi um tempo. Existiu.'],
  },
  bad: {
    any: [
      'Foi na fé, né? Respeito a coragem.',
      'Hm. Você estava olhando pra tela?',
      'Chutou? Seja sincero.',
    ],
    color: ['Isso é outra cor, mas tudo bem.'],
    time: ['Você contou em outra unidade?'],
  },
  awful: {
    any: ['Esse número pediu pra sair.', 'Que ousadia.', 'Quem te viu, quem te vê.'],
    color: ['A cor chorou no banheiro.'],
    time: ['O tempo ficou ofendido.'],
  },
  zero: {
    any: [
      'Você jogou de olhos fechados?',
      'Parabéns, você inventou outra realidade.',
      'Zero. Redondinho.',
    ],
    color: ['O alvo está processando você.', 'Inventou uma cor nova. Registra.'],
    time: ['Isso não foi contar, foi torcer.', 'O relógio pediu um tempo (de você).'],
  },
};

/** Uma frase da faixa, do jogo ou geral. `rng` entra para o teste ser determinístico. */
export function gradeLine(
  id: GradeId,
  game: 'color' | 'time',
  rng: () => number = Math.random,
): string {
  const l = LINES[id];
  const pool = [...l.any, ...l[game]];
  return pool[Math.floor(rng() * pool.length)]!;
}

/** Todas as frases (para testes e para conferir que nenhuma faixa ficou sem). */
export const allLines = (id: GradeId) => [...LINES[id].any, ...LINES[id].color, ...LINES[id].time];

/** O som (e a vibração) de cada faixa. Só no resultado, nunca na contagem do Tempo. */
export function playGrade(id: GradeId) {
  switch (id) {
    case 'perfect':
      sfx.perfect();
      buzz(70);
      break;
    case 'near':
      sfx.near();
      buzz(40);
      break;
    case 'great':
      sfx.win();
      buzz(30);
      break;
    case 'good':
    case 'pass':
      sfx.coin();
      buzz(20);
      break;
    case 'meh':
      sfx.meh();
      break;
    case 'bad':
      sfx.boing();
      break;
    case 'awful':
      sfx.awful();
      buzz(50);
      break;
    case 'zero':
      sfx.zero();
      buzz(80);
      break;
  }
}
