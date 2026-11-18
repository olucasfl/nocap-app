import { questions, words, type Row } from './build';

/** tipo = banda|cantor|musica; origem = brasil|mundo. */
const R: Row[] = [
  ['The Beatles', 'Rolling Stones', 'tipo=banda,origem=mundo'], ['Queen', 'Led Zeppelin', 'tipo=banda,origem=mundo'], ['Rolling Stones', 'The Beatles', 'tipo=banda,origem=mundo'],
  ['Coldplay', 'Imagine Dragons', 'tipo=banda,origem=mundo'], ['Imagine Dragons', 'Coldplay', 'tipo=banda,origem=mundo'], ['Linkin Park', 'Green Day', 'tipo=banda,origem=mundo'],
  ['Nirvana', 'Pearl Jam', 'tipo=banda,origem=mundo'], ['Metallica', 'Iron Maiden', 'tipo=banda,origem=mundo'], ['AC/DC', 'Guns N\' Roses', 'tipo=banda,origem=mundo'],
  ['Guns N\' Roses', 'AC/DC', 'tipo=banda,origem=mundo'], ['U2', 'Coldplay', 'tipo=banda,origem=mundo'], ['BTS', 'Blackpink', 'tipo=banda,origem=mundo'],
  ['Blackpink', 'BTS', 'tipo=banda,origem=mundo'], ['Maroon 5', 'OneRepublic', 'tipo=banda,origem=mundo'], ['ABBA', 'Bee Gees', 'tipo=banda,origem=mundo'],
  ['Legião Urbana', 'Capital Inicial', 'tipo=banda,origem=brasil'], ['Capital Inicial', 'Legião Urbana', 'tipo=banda,origem=brasil'], ['Titãs', 'Paralamas do Sucesso', 'tipo=banda,origem=brasil'],
  ['Paralamas do Sucesso', 'Titãs', 'tipo=banda,origem=brasil'], ['Charlie Brown Jr.', 'Skank', 'tipo=banda,origem=brasil'], ['Skank', 'Charlie Brown Jr.', 'tipo=banda,origem=brasil'],
  ['Os Mutantes', 'Secos & Molhados', 'tipo=banda,origem=brasil', 2], ['Raimundos', 'Charlie Brown Jr.', 'tipo=banda,origem=brasil'], ['Jota Quest', 'Skank', 'tipo=banda,origem=brasil'],
  ['Michael Jackson', 'Prince', 'tipo=cantor,origem=mundo'], ['Elvis Presley', 'Frank Sinatra', 'tipo=cantor,origem=mundo'], ['Madonna', 'Cher', 'tipo=cantor,origem=mundo'],
  ['Beyoncé', 'Rihanna', 'tipo=cantor,origem=mundo'], ['Rihanna', 'Beyoncé', 'tipo=cantor,origem=mundo'], ['Taylor Swift', 'Ariana Grande', 'tipo=cantor,origem=mundo'],
  ['Ariana Grande', 'Taylor Swift', 'tipo=cantor,origem=mundo'], ['Ed Sheeran', 'Justin Bieber', 'tipo=cantor,origem=mundo'], ['Justin Bieber', 'Ed Sheeran', 'tipo=cantor,origem=mundo'],
  ['Shakira', 'Jennifer Lopez', 'tipo=cantor,origem=mundo'], ['Eminem', 'Snoop Dogg', 'tipo=cantor,origem=mundo'], ['Bruno Mars', 'The Weeknd', 'tipo=cantor,origem=mundo'],
  ['Lady Gaga', 'Katy Perry', 'tipo=cantor,origem=mundo'], ['Katy Perry', 'Lady Gaga', 'tipo=cantor,origem=mundo'], ['Adele', 'Sam Smith', 'tipo=cantor,origem=mundo'],
  ['Billie Eilish', 'Olivia Rodrigo', 'tipo=cantor,origem=mundo'], ['Dua Lipa', 'Ariana Grande', 'tipo=cantor,origem=mundo'], ['Drake', 'Travis Scott', 'tipo=cantor,origem=mundo'],
  ['Roberto Carlos', 'Erasmo Carlos', 'tipo=cantor,origem=brasil'], ['Caetano Veloso', 'Gilberto Gil', 'tipo=cantor,origem=brasil'], ['Gilberto Gil', 'Caetano Veloso', 'tipo=cantor,origem=brasil'],
  ['Anitta', 'Ludmilla', 'tipo=cantor,origem=brasil'], ['Ludmilla', 'Anitta', 'tipo=cantor,origem=brasil'], ['Ivete Sangalo', 'Claudia Leitte', 'tipo=cantor,origem=brasil'],
  ['Claudia Leitte', 'Ivete Sangalo', 'tipo=cantor,origem=brasil'], ['Jorge e Mateus', 'Henrique e Juliano', 'tipo=cantor,origem=brasil'], ['Henrique e Juliano', 'Jorge e Mateus', 'tipo=cantor,origem=brasil'],
  ['Marília Mendonça', 'Maiara e Maraisa', 'tipo=cantor,origem=brasil'], ['Gusttavo Lima', 'Luan Santana', 'tipo=cantor,origem=brasil'], ['Luan Santana', 'Gusttavo Lima', 'tipo=cantor,origem=brasil'],
  ['Zezé Di Camargo e Luciano', 'Chitãozinho e Xororó', 'tipo=cantor,origem=brasil'], ['Chitãozinho e Xororó', 'Zezé Di Camargo e Luciano', 'tipo=cantor,origem=brasil'], ['Tim Maia', 'Jorge Ben Jor', 'tipo=cantor,origem=brasil'],
  ['Seu Jorge', 'Jorge Ben Jor', 'tipo=cantor,origem=brasil'], ['Alok', 'Vintage Culture', 'tipo=cantor,origem=brasil'], ['Pabllo Vittar', 'Gloria Groove', 'tipo=cantor,origem=brasil'], ['Gal Costa', 'Maria Bethânia', 'tipo=cantor,origem=brasil'],
  ['Bohemian Rhapsody', 'Stairway to Heaven', 'tipo=musica,origem=mundo'], ['Billie Jean', 'Thriller', 'tipo=musica,origem=mundo'], ['Thriller', 'Billie Jean', 'tipo=musica,origem=mundo'],
  ['Shape of You', 'Perfect', 'tipo=musica,origem=mundo'], ['Despacito', 'Gasolina', 'tipo=musica,origem=mundo'], ['Happy Birthday', 'Parabéns pra Você', 'tipo=musica,origem=mundo'],
  ['Parabéns pra Você', 'Happy Birthday', 'tipo=musica,origem=brasil'], ['Garota de Ipanema', 'Aquarela do Brasil', 'tipo=musica,origem=brasil'], ['Evidências', 'Fé em Deus', 'tipo=musica,origem=brasil', 2],
  ['Ai Se Eu Te Pego', 'Fugidinha', 'tipo=musica,origem=brasil'], ['Asa Branca', 'O Xote das Meninas', 'tipo=musica,origem=brasil', 2],
];
export const musicaWords = words('musica', R);
export const musicaQuestions = questions('musica', [
  ['Qual música você colocaria para começar uma festa?', 'Qual música você colocaria para terminar a festa?'],
  ['Qual música tocaria no seu casamento?', 'Qual música tocaria na sua formatura?'],
  ['Qual música você cantaria no karaokê?', 'Qual música você nunca cantaria no karaokê?'],
  ['Qual música ou banda você ouviria numa viagem de carro?', 'Qual música ou banda você ouviria na academia?'],
  ['Qual artista você levaria para um show de cem mil pessoas?', 'Qual artista você levaria para tocar na sua casa?'],
  ['Qual música traz a lembrança mais forte?', 'Qual música você mais pulou na vida?'],
  ['Qual artista teria o melhor show?', 'Qual artista teria a melhor entrevista?'],
  ['Qual música você mandaria para um amor?', 'Qual música você mandaria para um ex?'],
  ['Qual música você ouviria ao acordar?', 'Qual música você ouviria antes de dormir?'],
  ['Qual é a música ou banda mais conhecida do mundo?', 'Qual é a música ou banda mais difícil de cantar?'],
]);
