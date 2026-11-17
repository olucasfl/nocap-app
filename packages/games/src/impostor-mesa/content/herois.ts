import { questions, words, type Row } from './build';

/** tipo = heroi|vilao; universo = marvel|dc|outros. */
const R: Row[] = [
  ['Homem-Aranha', 'Batman', 'tipo=heroi,universo=marvel'], ['Homem de Ferro', 'Batman', 'tipo=heroi,universo=marvel'], ['Capitão América', 'Superman', 'tipo=heroi,universo=marvel'],
  ['Thor', 'Hulk', 'tipo=heroi,universo=marvel'], ['Hulk', 'Thor', 'tipo=heroi,universo=marvel'], ['Viúva Negra', 'Mulher-Maravilha', 'tipo=heroi,universo=marvel'],
  ['Pantera Negra', 'Aquaman', 'tipo=heroi,universo=marvel'], ['Doutor Estranho', 'Homem de Ferro', 'tipo=heroi,universo=marvel'], ['Capitã Marvel', 'Mulher-Maravilha', 'tipo=heroi,universo=marvel'],
  ['Wolverine', 'Deadpool', 'tipo=heroi,universo=marvel'], ['Deadpool', 'Wolverine', 'tipo=heroi,universo=marvel'], ['Homem-Formiga', 'Homem-Aranha', 'tipo=heroi,universo=marvel'],
  ['Groot', 'Rocket', 'tipo=heroi,universo=marvel'],
  ['Batman', 'Homem de Ferro', 'tipo=heroi,universo=dc'], ['Superman', 'Capitão América', 'tipo=heroi,universo=dc'], ['Mulher-Maravilha', 'Viúva Negra', 'tipo=heroi,universo=dc'],
  ['Flash', 'Superman', 'tipo=heroi,universo=dc'], ['Aquaman', 'Pantera Negra', 'tipo=heroi,universo=dc'], ['Lanterna Verde', 'Homem de Ferro', 'tipo=heroi,universo=dc'],
  ['Robin', 'Batman', 'tipo=heroi,universo=dc'], ['Mulher-Gato', 'Arlequina', 'tipo=heroi,universo=dc'], ['Shazam', 'Superman', 'tipo=heroi,universo=dc'], ['Supergirl', 'Mulher-Maravilha', 'tipo=heroi,universo=dc'],
  ['Goku', 'Naruto', 'tipo=heroi,universo=outros'], ['Naruto', 'Goku', 'tipo=heroi,universo=outros'], ['Luffy', 'Naruto', 'tipo=heroi,universo=outros'], ['Sonic', 'Mario', 'tipo=heroi,universo=outros'],
  ['Mario', 'Sonic', 'tipo=heroi,universo=outros'], ['Link', 'Mario', 'tipo=heroi,universo=outros', 2], ['Pikachu', 'Charmander', 'tipo=heroi,universo=outros'], ['Mônica', 'Magali', 'tipo=heroi,universo=outros'],
  ['Cebolinha', 'Cascão', 'tipo=heroi,universo=outros'], ['Zorro', 'Batman', 'tipo=heroi,universo=outros'], ['Power Rangers', 'Tartarugas Ninja', 'tipo=heroi,universo=outros'],
  ['Thanos', 'Darkseid', 'tipo=vilao,universo=marvel'], ['Loki', 'Coringa', 'tipo=vilao,universo=marvel'], ['Ultron', 'Brainiac', 'tipo=vilao,universo=marvel'], ['Venom', 'Coringa', 'tipo=vilao,universo=marvel'],
  ['Duende Verde', 'Coringa', 'tipo=vilao,universo=marvel'], ['Magneto', 'Lex Luthor', 'tipo=vilao,universo=marvel'], ['Doutor Destino', 'Lex Luthor', 'tipo=vilao,universo=marvel'], ['Caveira Vermelha', 'Thanos', 'tipo=vilao,universo=marvel', 2],
  ['Coringa', 'Pinguim', 'tipo=vilao,universo=dc'], ['Pinguim', 'Charada', 'tipo=vilao,universo=dc'], ['Charada', 'Pinguim', 'tipo=vilao,universo=dc'], ['Arlequina', 'Mulher-Gato', 'tipo=vilao,universo=dc'],
  ['Lex Luthor', 'Magneto', 'tipo=vilao,universo=dc'], ['Bane', 'Coringa', 'tipo=vilao,universo=dc'], ['Darkseid', 'Thanos', 'tipo=vilao,universo=dc'], ['Duas-Caras', 'Coringa', 'tipo=vilao,universo=dc'],
  ['Darth Vader', 'Imperador Palpatine', 'tipo=vilao,universo=outros'], ['Voldemort', 'Darth Vader', 'tipo=vilao,universo=outros'], ['Sauron', 'Voldemort', 'tipo=vilao,universo=outros'], ['Freddy Krueger', 'Jason', 'tipo=vilao,universo=outros'],
  ['Jason', 'Freddy Krueger', 'tipo=vilao,universo=outros'], ['Chucky', 'Annabelle', 'tipo=vilao,universo=outros'], ['Bowser', 'Wario', 'tipo=vilao,universo=outros'], ['Capitão Gancho', 'Barba Negra', 'tipo=vilao,universo=outros'],
  ['Malévola', 'Cruella', 'tipo=vilao,universo=outros'], ['Cruella', 'Malévola', 'tipo=vilao,universo=outros'], ['Scar', 'Malévola', 'tipo=vilao,universo=outros'], ['Gru', 'Megamente', 'tipo=vilao,universo=outros'],
  ['Freeza', 'Cell', 'tipo=vilao,universo=outros'], ['Team Rocket', 'Bowser', 'tipo=vilao,universo=outros', 2],
];
export const heroisWords = words('herois', R);
export const heroisQuestions = questions('herois', [
  ['Qual super-poder você escolheria?', 'Qual super-poder você acha inútil?'],
  ['Qual herói você seria?', 'Qual herói você nunca seria?'],
  ['Qual vilão tem o melhor plano?', 'Qual vilão é o mais engraçado?'],
  ['Quem ganharia uma luta entre heróis?', 'Quem perderia uma luta entre vilões?'],
  ['Qual herói tem a roupa mais legal?', 'Qual herói tem a roupa mais estranha?'],
  ['Qual personagem você levaria para uma ilha deserta?', 'Qual personagem você deixaria longe da ilha?'],
]);
