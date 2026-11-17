import { questions, words, type Row } from './build';

const R: Row[] = [
  ['Cachorro', 'Lobo', 'tipo=casa'], ['Gato', 'Leão', 'tipo=casa'], ['Hamster', 'Coelho', 'tipo=casa'], ['Coelho', 'Hamster', 'tipo=casa'],
  ['Papagaio', 'Arara', 'tipo=ave'], ['Peixe-dourado', 'Tartaruga', 'tipo=casa'], ['Tartaruga', 'Jabuti', 'tipo=casa'],
  ['Cavalo', 'Burro', 'tipo=fazenda'], ['Vaca', 'Boi', 'tipo=fazenda'], ['Porco', 'Javali', 'tipo=fazenda'], ['Ovelha', 'Cabra', 'tipo=fazenda'],
  ['Cabra', 'Ovelha', 'tipo=fazenda'], ['Galinha', 'Pato', 'tipo=fazenda'], ['Pato', 'Ganso', 'tipo=ave'], ['Burro', 'Cavalo', 'tipo=fazenda'],
  ['Leão', 'Tigre', 'tipo=selva'], ['Tigre', 'Leão', 'tipo=selva'], ['Elefante', 'Rinoceronte', 'tipo=selva'], ['Girafa', 'Zebra', 'tipo=selva'],
  ['Zebra', 'Cavalo', 'tipo=selva'], ['Macaco', 'Gorila', 'tipo=selva'], ['Gorila', 'Chimpanzé', 'tipo=selva'], ['Urso', 'Panda', 'tipo=selva'],
  ['Panda', 'Coala', 'tipo=selva'], ['Coala', 'Panda', 'tipo=selva'], ['Lobo', 'Raposa', 'tipo=selva'], ['Raposa', 'Lobo', 'tipo=selva'],
  ['Onça-pintada', 'Leopardo', 'tipo=selva'], ['Jacaré', 'Crocodilo', 'tipo=selva'], ['Cobra', 'Lagarto', 'tipo=selva'], ['Hipopótamo', 'Rinoceronte', 'tipo=selva'],
  ['Camelo', 'Lhama', 'tipo=selva'], ['Canguru', 'Coala', 'tipo=selva'], ['Preguiça', 'Tamanduá', 'tipo=selva'], ['Capivara', 'Castor', 'tipo=selva'],
  ['Tubarão', 'Golfinho', 'tipo=mar'], ['Golfinho', 'Baleia', 'tipo=mar'], ['Baleia', 'Tubarão', 'tipo=mar'], ['Polvo', 'Lula', 'tipo=mar'],
  ['Caranguejo', 'Lagosta', 'tipo=mar'], ['Estrela-do-mar', 'Ouriço-do-mar', 'tipo=mar'], ['Foca', 'Leão-marinho', 'tipo=mar'], ['Tartaruga-marinha', 'Tartaruga', 'tipo=mar'],
  ['Água-viva', 'Polvo', 'tipo=mar'], ['Cavalo-marinho', 'Peixe-palhaço', 'tipo=mar'], ['Orca', 'Golfinho', 'tipo=mar'], ['Pinguim', 'Pelicano', 'tipo=ave'],
  ['Águia', 'Falcão', 'tipo=ave'], ['Coruja', 'Morcego', 'tipo=ave'], ['Pombo', 'Pardal', 'tipo=ave'], ['Flamingo', 'Garça', 'tipo=ave'],
  ['Tucano', 'Arara', 'tipo=ave'], ['Avestruz', 'Ema', 'tipo=ave'], ['Peru', 'Galinha', 'tipo=ave'], ['Cisne', 'Pato', 'tipo=ave'],
  ['Abelha', 'Vespa', 'tipo=selva'], ['Borboleta', 'Mariposa', 'tipo=selva'], ['Formiga', 'Cupim', 'tipo=selva'], ['Aranha', 'Escorpião', 'tipo=selva'],
  ['Sapo', 'Rã', 'tipo=selva'], ['Rato', 'Hamster', 'tipo=casa'], ['Esquilo', 'Rato', 'tipo=selva'], ['Morcego', 'Coruja', 'tipo=selva'],
];
export const animaisWords = words('animais', R);
export const animaisQuestions = questions('animais', [
  ['Qual animal você teria de estimação?', 'Qual animal você jamais teria em casa?'],
  ['Qual animal você escolheria para ser por um dia?', 'Qual animal você nunca queria ser?'],
  ['Qual animal você mais gosta de ver no zoológico?', 'Qual animal você tem mais medo?'],
  ['Qual bicho te lembra um amigo?', 'Qual bicho te lembra o professor mais chato?'],
  ['Qual animal é o mais fofo?', 'Qual animal é o mais estranho?'],
  ['Qual bicho você chamaria de rei da selva?', 'Qual bicho você acha o mais preguiçoso?'],
]);
