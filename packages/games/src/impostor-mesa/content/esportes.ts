import { questions, words, type Row } from './build';

const R: Row[] = [
  ['Futebol', 'Futsal', 'tipo=modalidade'], ['Futsal', 'Futebol', 'tipo=modalidade'], ['Vôlei', 'Vôlei de praia', 'tipo=modalidade'], ['Vôlei de praia', 'Futevôlei', 'tipo=modalidade'],
  ['Basquete', 'Handebol', 'tipo=modalidade'], ['Handebol', 'Basquete', 'tipo=modalidade'], ['Tênis', 'Tênis de mesa', 'tipo=modalidade'], ['Tênis de mesa', 'Badminton', 'tipo=modalidade'],
  ['Natação', 'Polo aquático', 'tipo=modalidade'], ['Atletismo', 'Maratona', 'tipo=modalidade'], ['Judô', 'Karatê', 'tipo=modalidade'], ['Karatê', 'Judô', 'tipo=modalidade'],
  ['Boxe', 'MMA', 'tipo=modalidade'], ['MMA', 'Boxe', 'tipo=modalidade'], ['Jiu-jitsu', 'Judô', 'tipo=modalidade'], ['Ginástica', 'Dança', 'tipo=modalidade'],
  ['Surfe', 'Skate', 'tipo=modalidade'], ['Skate', 'Patinete', 'tipo=modalidade'], ['Ciclismo', 'Motocross', 'tipo=modalidade'], ['Fórmula 1', 'Kart', 'tipo=modalidade'],
  ['Golfe', 'Minigolfe', 'tipo=modalidade'], ['Beisebol', 'Críquete', 'tipo=modalidade'], ['Futebol americano', 'Rúgbi', 'tipo=modalidade'], ['Rúgbi', 'Futebol americano', 'tipo=modalidade'],
  ['Hóquei', 'Patinação', 'tipo=modalidade'], ['Esqui', 'Snowboard', 'tipo=modalidade'], ['Snowboard', 'Esqui', 'tipo=modalidade'], ['Remo', 'Canoagem', 'tipo=modalidade'],
  ['Xadrez', 'Damas', 'tipo=modalidade'], ['Esgrima', 'Tiro com arco', 'tipo=modalidade'], ['Escalada', 'Montanhismo', 'tipo=modalidade'], ['Corrida', 'Caminhada', 'tipo=modalidade'],
  ['Bola de futebol', 'Bola de vôlei', 'tipo=equipamento'], ['Bola de basquete', 'Bola de handebol', 'tipo=equipamento'], ['Raquete', 'Taco de beisebol', 'tipo=equipamento'],
  ['Chuteira', 'Tênis de corrida', 'tipo=equipamento'], ['Luva de boxe', 'Luva de goleiro', 'tipo=equipamento'], ['Prancha de surfe', 'Skate', 'tipo=equipamento'],
  ['Capacete', 'Joelheira', 'tipo=equipamento'], ['Rede', 'Trave', 'tipo=equipamento'], ['Apito', 'Cartão amarelo', 'tipo=equipamento'], ['Cartão vermelho', 'Cartão amarelo', 'tipo=equipamento'],
  ['Medalha de ouro', 'Troféu', 'tipo=equipamento'], ['Trave', 'Cesta de basquete', 'tipo=equipamento'], ['Cesta de basquete', 'Rede de vôlei', 'tipo=equipamento'], ['Bicicleta', 'Patins', 'tipo=equipamento'],
  ['Copa do Mundo', 'Olimpíada', 'tipo=evento'], ['Olimpíada', 'Copa do Mundo', 'tipo=evento'], ['Champions League', 'Libertadores', 'tipo=evento'], ['Libertadores', 'Champions League', 'tipo=evento'],
  ['Brasileirão', 'Copa do Brasil', 'tipo=evento'], ['Super Bowl', 'NBA', 'tipo=evento'], ['NBA', 'Super Bowl', 'tipo=evento'], ['Roland Garros', 'Wimbledon', 'tipo=evento'],
  ['Wimbledon', 'Roland Garros', 'tipo=evento'], ['Grande Prêmio de Fórmula 1', 'Indy 500', 'tipo=evento'], ['Tour de France', 'São Silvestre', 'tipo=evento'], ['Copa América', 'Eurocopa', 'tipo=evento'],
];
export const esportesWords = words('esportes', R);
export const esportesQuestions = questions('esportes', [
  ['Qual esporte você assiste com mais prazer?', 'Qual esporte você acha o mais chato de assistir?'],
  ['Qual esporte você jogaria bem?', 'Qual esporte você jamais conseguiria praticar?'],
  ['Qual esporte você praticava na escola?', 'Qual esporte você sempre fugia nas aulas?'],
  ['Qual esporte merecia mais torcida?', 'Qual esporte devia sair das Olimpíadas?'],
  ['Qual evento esportivo você iria ver ao vivo?', 'Qual evento esportivo você nem de graça iria?'],
  ['Qual esporte é o mais radical?', 'Qual esporte é o mais calmo?'],
]);
