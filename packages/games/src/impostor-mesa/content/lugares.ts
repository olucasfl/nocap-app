import { questions, words, type Row } from './build';

/** tipo = cidade|pais; origem = brasil|mundo (países fora do Brasil são "mundo"). */
const R: Row[] = [
  ['Rio de Janeiro', 'São Paulo', 'tipo=cidade,origem=brasil'], ['São Paulo', 'Rio de Janeiro', 'tipo=cidade,origem=brasil'],
  ['Salvador', 'Recife', 'tipo=cidade,origem=brasil'], ['Recife', 'Fortaleza', 'tipo=cidade,origem=brasil'], ['Fortaleza', 'Natal', 'tipo=cidade,origem=brasil'],
  ['Brasília', 'Belo Horizonte', 'tipo=cidade,origem=brasil'], ['Belo Horizonte', 'Brasília', 'tipo=cidade,origem=brasil'],
  ['Curitiba', 'Porto Alegre', 'tipo=cidade,origem=brasil'], ['Porto Alegre', 'Curitiba', 'tipo=cidade,origem=brasil'],
  ['Manaus', 'Belém', 'tipo=cidade,origem=brasil'], ['Belém', 'Manaus', 'tipo=cidade,origem=brasil'], ['Florianópolis', 'Balneário Camboriú', 'tipo=cidade,origem=brasil'],
  ['Gramado', 'Campos do Jordão', 'tipo=cidade,origem=brasil'], ['Foz do Iguaçu', 'Bonito', 'tipo=cidade,origem=brasil'], ['Natal', 'Fortaleza', 'tipo=cidade,origem=brasil'],
  ['Goiânia', 'Campo Grande', 'tipo=cidade,origem=brasil', 2], ['Paris', 'Londres', 'tipo=cidade,origem=mundo'], ['Londres', 'Paris', 'tipo=cidade,origem=mundo'],
  ['Nova York', 'Los Angeles', 'tipo=cidade,origem=mundo'], ['Los Angeles', 'Nova York', 'tipo=cidade,origem=mundo'], ['Miami', 'Orlando', 'tipo=cidade,origem=mundo'],
  ['Orlando', 'Miami', 'tipo=cidade,origem=mundo'], ['Las Vegas', 'Miami', 'tipo=cidade,origem=mundo'], ['Tóquio', 'Pequim', 'tipo=cidade,origem=mundo'],
  ['Pequim', 'Tóquio', 'tipo=cidade,origem=mundo'], ['Roma', 'Veneza', 'tipo=cidade,origem=mundo'], ['Veneza', 'Roma', 'tipo=cidade,origem=mundo'],
  ['Madri', 'Barcelona', 'tipo=cidade,origem=mundo'], ['Barcelona', 'Madri', 'tipo=cidade,origem=mundo'], ['Lisboa', 'Porto', 'tipo=cidade,origem=mundo'],
  ['Buenos Aires', 'Montevidéu', 'tipo=cidade,origem=mundo'], ['Dubai', 'Abu Dhabi', 'tipo=cidade,origem=mundo'], ['Cairo', 'Dubai', 'tipo=cidade,origem=mundo'],
  ['Berlim', 'Amsterdã', 'tipo=cidade,origem=mundo'], ['Amsterdã', 'Berlim', 'tipo=cidade,origem=mundo'], ['Moscou', 'Berlim', 'tipo=cidade,origem=mundo'],
  ['Sydney', 'Melbourne', 'tipo=cidade,origem=mundo'], ['Cidade do México', 'Cancún', 'tipo=cidade,origem=mundo'], ['Cancún', 'Punta Cana', 'tipo=cidade,origem=mundo'],
  ['Santiago', 'Buenos Aires', 'tipo=cidade,origem=mundo'], ['Seul', 'Tóquio', 'tipo=cidade,origem=mundo'], ['Istambul', 'Atenas', 'tipo=cidade,origem=mundo'],
  ['Brasil', 'Argentina', 'tipo=pais,origem=brasil'], ['Argentina', 'Brasil', 'tipo=pais,origem=mundo'], ['Estados Unidos', 'Canadá', 'tipo=pais,origem=mundo'],
  ['Canadá', 'Estados Unidos', 'tipo=pais,origem=mundo'], ['México', 'Cuba', 'tipo=pais,origem=mundo'], ['França', 'Itália', 'tipo=pais,origem=mundo'],
  ['Itália', 'França', 'tipo=pais,origem=mundo'], ['Espanha', 'Portugal', 'tipo=pais,origem=mundo'], ['Portugal', 'Espanha', 'tipo=pais,origem=mundo'],
  ['Alemanha', 'Holanda', 'tipo=pais,origem=mundo'], ['Inglaterra', 'Escócia', 'tipo=pais,origem=mundo'], ['Japão', 'China', 'tipo=pais,origem=mundo'],
  ['China', 'Japão', 'tipo=pais,origem=mundo'], ['Índia', 'Paquistão', 'tipo=pais,origem=mundo'], ['Rússia', 'Ucrânia', 'tipo=pais,origem=mundo'],
  ['Egito', 'Marrocos', 'tipo=pais,origem=mundo'], ['Austrália', 'Nova Zelândia', 'tipo=pais,origem=mundo'], ['Chile', 'Peru', 'tipo=pais,origem=mundo'],
  ['Uruguai', 'Paraguai', 'tipo=pais,origem=mundo'], ['Colômbia', 'Venezuela', 'tipo=pais,origem=mundo'], ['Grécia', 'Turquia', 'tipo=pais,origem=mundo'],
  ['Suíça', 'Áustria', 'tipo=pais,origem=mundo'], ['Coreia do Sul', 'Japão', 'tipo=pais,origem=mundo'], ['África do Sul', 'Egito', 'tipo=pais,origem=mundo'],
];
export const lugaresWords = words('lugares', R);
export const lugaresQuestions = questions('lugares', [
  ['Qual lugar você levaria alguém para passear?', 'Qual lugar você nunca visitaria?'],
  ['Para qual país você viajaria amanhã?', 'Em qual país você nunca moraria?'],
  ['Qual cidade é a mais bonita?', 'Qual cidade é a mais barulhenta?'],
  ['Onde você passaria as férias?', 'Onde você não passaria nem um fim de semana?'],
  ['Qual lugar tem a melhor comida?', 'Qual lugar tem o pior trânsito?'],
  ['Qual cidade você gostaria de conhecer?', 'Qual cidade você já cansou de ouvir falar?'],
]);
