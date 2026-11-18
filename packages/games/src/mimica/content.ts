import { IM_WORDS } from '../impostor-mesa';
import type { MimWord } from './index';

/**
 * Conteúdo da Mímica (spec 089). Clássico: palavras maiores e variadas (reaproveita as famosas do Impostor e
 * acrescenta Profissões e Objetos). Speed: situações curtas e rápidas, com o tema Ações só aqui.
 */
export interface MimCategory {
  id: string;
  label: string;
  /** Aparece no Clássico / no Speed. */
  classic: boolean;
  speed: boolean;
  /** Músicas e Marcas são difíceis de mimicar: existem, mas começam desmarcados. */
  hard: boolean;
}

export const MIM_CATEGORIES: readonly MimCategory[] = [
  { id: 'animais', label: 'Animais', classic: true, speed: true, hard: false },
  { id: 'comida', label: 'Comida', classic: true, speed: true, hard: false },
  { id: 'esportes', label: 'Esportes', classic: true, speed: true, hard: false },
  { id: 'profissoes', label: 'Profissões', classic: true, speed: true, hard: false },
  { id: 'objetos', label: 'Objetos', classic: true, speed: true, hard: false },
  { id: 'acoes', label: 'Ações', classic: false, speed: true, hard: false },
  { id: 'filmes', label: 'Filmes e Séries', classic: true, speed: false, hard: false },
  { id: 'herois', label: 'Heróis e vilões', classic: true, speed: false, hard: false },
  { id: 'lugares', label: 'Lugares', classic: true, speed: false, hard: false },
  { id: 'futebol', label: 'Futebol', classic: true, speed: false, hard: false },
  { id: 'clash', label: 'Clash Royale', classic: true, speed: false, hard: false },
  { id: 'musica', label: 'Músicas e bandas', classic: true, speed: false, hard: true },
  { id: 'marcas', label: 'Marcas', classic: true, speed: false, hard: true },
];

const FROM_IMPOSTOR = ['animais', 'comida', 'esportes', 'filmes', 'herois', 'lugares', 'futebol', 'clash', 'musica', 'marcas'];

/** Clash Royale vem como "Knight (Cavaleiro)": na mesa fala-se o nome em português. */
const clean = (category: string, text: string) => {
  if (category === 'clash') return /\(([^)]+)\)/.exec(text)?.[1] ?? text;
  return text.replace(/\s*\([^)]*\)\s*$/, '');
};

const classicFromImpostor: MimWord[] = IM_WORDS.filter((w) => FROM_IMPOSTOR.includes(w.category) && w.fame === 1).map((w, i) => ({
  id: `mc-${w.category}-${i}`,
  category: w.category,
  text: clean(w.category, w.text),
  pool: 'classic' as const,
}));

const list = (pool: 'classic' | 'speed', prefix: string, category: string, items: string[]): MimWord[] =>
  items.map((text, i) => ({ id: `${prefix}-${category}-${i}`, category, text, pool }));

const CLASSIC_PROFISSOES = [
  'Astronauta andando na Lua', 'Cirurgião operando', 'Bailarina de balé', 'Piloto de avião', 'Domador de leão', 'Mágico tirando coelho da cartola',
  'Bombeiro salvando um gato', 'Salva-vidas no mar', 'Padeiro sovando a massa', 'Dentista tratando um dente', 'Pintor de parede', 'Cabeleireira cortando cabelo',
  'Maestro regendo a orquestra', 'Jogador de futebol cobrando pênalti', 'Garçom equilibrando bandejas', 'Mecânico trocando pneu', 'Fotógrafo de casamento', 'Detetive procurando pistas',
  'Pescador puxando a rede', 'Fazendeiro ordenhando a vaca', 'Palhaço de circo', 'Soldado marchando', 'Juiz de futebol', 'Cantor de ópera',
  'Arqueólogo escavando', 'Carteiro entregando carta', 'Engenheiro com o capacete', 'Jardineiro podando a roseira', 'Enfermeira medindo a febre', 'Professor escrevendo no quadro',
  'Policial dirigindo o trânsito', 'Eletricista na escada', 'Encanador desentupindo a pia', 'Cozinheiro flambando', 'Barman fazendo drinque', 'Lenhador derrubando árvore',
  'Escultor esculpindo', 'Narrador de futebol', 'Personal trainer gritando', 'Motorista de ônibus',
];
const CLASSIC_OBJETOS = [
  'Cortador de grama', 'Máquina de lavar roupa', 'Liquidificador', 'Pipa no céu', 'Pula-pula', 'Patinete', 'Telescópio', 'Balão de ar quente',
  'Chuveiro quente', 'Escada rolante', 'Guarda-sol na praia', 'Secador de cabelo', 'Ferro de passar roupa', 'Aspirador de pó', 'Bicicleta ergométrica', 'Carrinho de supermercado',
  'Montanha-russa', 'Roda-gigante', 'Pião', 'Cubo mágico', 'Varal de roupa', 'Despertador tocando', 'Fliperama', 'Barraca de camping',
  'Tobogã', 'Bumerangue', 'Pipoqueira', 'Trator', 'Guindaste', 'Caixa registradora', 'Elevador lotado', 'Catraca de ônibus',
  'Cadeira de balanço', 'Rede de dormir', 'Chaleira apitando', 'Churrasqueira', 'Furadeira', 'Gangorra', 'Violão', 'Bola de boliche',
];

const SPEED_ACOES = [
  'Jogar bola', 'Matar um mosquito', 'Escovar os dentes', 'Pescar', 'Tomar banho gelado', 'Abrir uma lata de atum', 'Trocar um pneu', 'Pentear o cabelo',
  'Andar de bicicleta', 'Tirar uma selfie', 'Lavar a louça', 'Passar aspirador', 'Fazer um bolo', 'Tocar violão', 'Dar um abraço apertado', 'Dormir em pé no ônibus',
  'Subir uma escada cansado', 'Nadar de costas', 'Remar um barco', 'Empurrar um carro quebrado', 'Pintar uma parede', 'Esperar o ônibus atrasado', 'Atender o telefone', 'Abrir um guarda-chuva com vento',
  'Fugir de uma abelha', 'Tocar bateria', 'Plantar uma árvore', 'Cortar cebola chorando', 'Passar manteiga no pão', 'Dançar funk', 'Sambar', 'Jogar videogame',
  'Bater um pênalti', 'Dirigir no trânsito', 'Pular corda', 'Tomar sorvete derretendo', 'Coçar uma picada de pernilongo', 'Escalar uma montanha', 'Surfar uma onda', 'Andar de skate',
  'Fazer uma tatuagem', 'Cortar o cabelo', 'Dar banho no cachorro', 'Passear com o cachorro', 'Carregar uma mala pesada', 'Chamar um táxi', 'Pedir silêncio', 'Espirrar forte',
  'Ter soluço', 'Bocejar', 'Acordar atrasado', 'Correr de um cachorro bravo', 'Jogar boliche', 'Atirar dardos', 'Bater um prego', 'Serrar madeira',
  'Tocar piano', 'Regar as plantas', 'Varrer a casa', 'Estender a roupa', 'Fazer a barba', 'Passar maquiagem', 'Amarrar o tênis', 'Escrever uma carta',
  'Ler no escuro com lanterna', 'Tirar o lixo', 'Jogar xadrez', 'Tomar um remédio amargo', 'Procurar a chave que sumiu', 'Dar uma topada no dedo',
];
const SPEED_ANIMAIS = [
  'Cachorro', 'Gato', 'Elefante', 'Girafa', 'Macaco', 'Cobra', 'Sapo', 'Galinha', 'Pato', 'Porco', 'Cavalo', 'Vaca', 'Ovelha', 'Leão', 'Tigre', 'Urso',
  'Panda', 'Coala', 'Canguru', 'Pinguim', 'Tubarão', 'Golfinho', 'Baleia', 'Polvo', 'Caranguejo', 'Tartaruga', 'Jacaré', 'Borboleta', 'Abelha', 'Formiga',
  'Aranha', 'Morcego', 'Coruja', 'Papagaio', 'Flamingo', 'Pavão', 'Avestruz', 'Camelo', 'Hipopótamo', 'Rinoceronte', 'Zebra', 'Lobo', 'Raposa', 'Coelho',
  'Esquilo', 'Peixe', 'Cavalo-marinho', 'Minhoca', 'Caracol', 'Águia',
];
const SPEED_COMIDA = [
  'Pizza', 'Hambúrguer', 'Sorvete', 'Pipoca estourando', 'Macarrão', 'Sushi com hashi', 'Bolo de aniversário', 'Pão quentinho', 'Queijo', 'Ovo frito', 'Banana', 'Maçã',
  'Melancia', 'Laranja', 'Abacaxi', 'Uva', 'Cenoura', 'Brócolis', 'Batata frita', 'Cachorro-quente', 'Sanduíche', 'Taco', 'Churrasco', 'Sopa quente',
  'Café', 'Leite', 'Suco de laranja', 'Chocolate', 'Biscoito', 'Pastel', 'Coxinha', 'Pamonha', 'Tapioca', 'Feijoada', 'Espiga de milho', 'Algodão-doce',
  'Picolé', 'Panqueca', 'Salada', 'Espaguete', 'Brigadeiro', 'Pudim', 'Cereal com leite', 'Mel', 'Pimenta ardida', 'Limão azedo', 'Melão', 'Coco', 'Morango', 'Sorvete de casquinha',
];
const SPEED_ESPORTES = [
  'Futebol', 'Basquete', 'Vôlei', 'Natação', 'Tênis', 'Boxe', 'Judô', 'Ginástica', 'Skate', 'Surfe', 'Corrida', 'Ciclismo', 'Golfe', 'Boliche', 'Esgrima',
  'Arco e flecha', 'Remo', 'Handebol', 'Ping-pong', 'Badminton', 'Salto com vara', 'Arremesso de peso', 'Ioga', 'Levantamento de peso', 'Patinação', 'Esqui', 'Snowboard',
  'Rúgbi', 'Beisebol', 'Hóquei', 'Mergulho', 'Escalada', 'Capoeira', 'Karatê', 'Hipismo', 'Pesca', 'Salto em distância', 'Lançamento de dardo', 'Corrida com obstáculos',
  'Queimada', 'Pular corda', 'Cabo de guerra', 'Polo aquático', 'Salto triplo', 'Maratona', 'Triatlo', 'Vôlei de praia', 'Futevôlei', 'Sinuca', 'Pole position de kart',
];
const SPEED_PROFISSOES = [
  'Médico', 'Professor', 'Bombeiro', 'Policial', 'Padeiro', 'Cozinheiro', 'Pintor', 'Dentista', 'Motorista', 'Piloto', 'Jardineiro', 'Pescador', 'Fazendeiro', 'Mágico',
  'Palhaço', 'Cantor', 'Dançarino', 'Jogador de futebol', 'Árbitro', 'Soldado', 'Astronauta', 'Cabeleireiro', 'Garçom', 'Mecânico', 'Eletricista', 'Encanador', 'Pedreiro',
  'Carteiro', 'Veterinário', 'Fotógrafo', 'Detetive', 'Ator', 'DJ', 'Lixeiro', 'Caixa de supermercado', 'Salva-vidas', 'Bailarino', 'Maestro', 'Barman', 'Açougueiro',
  'Costureiro', 'Sapateiro', 'Lenhador', 'Ferreiro', 'Escultor', 'Narrador esportivo', 'Personal trainer', 'Enfermeiro', 'Atleta olímpico', 'Cantor de rua',
];
const SPEED_OBJETOS = [
  'Telefone', 'Relógio', 'Escova de dentes', 'Guarda-chuva', 'Tesoura', 'Martelo', 'Serra', 'Óculos', 'Chapéu', 'Bicicleta', 'Carro', 'Avião', 'Barco', 'Violão',
  'Bateria', 'Microfone', 'Câmera', 'Televisão', 'Controle remoto', 'Geladeira', 'Fogão', 'Liquidificador', 'Ventilador', 'Secador de cabelo', 'Aspirador', 'Vassoura',
  'Balde', 'Chave', 'Porta', 'Janela', 'Cadeira', 'Cama', 'Travesseiro', 'Espelho', 'Lanterna', 'Bola', 'Bexiga', 'Pipa', 'Patins', 'Mochila', 'Mala',
  'Bússola', 'Binóculos', 'Escada', 'Ferro de passar', 'Máquina de lavar', 'Computador', 'Teclado', 'Mouse', 'Fone de ouvido',
];

export const MIM_WORDS: readonly MimWord[] = [
  ...classicFromImpostor,
  ...list('classic', 'mc', 'profissoes', CLASSIC_PROFISSOES),
  ...list('classic', 'mc', 'objetos', CLASSIC_OBJETOS),
  ...list('speed', 'ms', 'acoes', SPEED_ACOES),
  ...list('speed', 'ms', 'animais', SPEED_ANIMAIS),
  ...list('speed', 'ms', 'comida', SPEED_COMIDA),
  ...list('speed', 'ms', 'esportes', SPEED_ESPORTES),
  ...list('speed', 'ms', 'profissoes', SPEED_PROFISSOES),
  ...list('speed', 'ms', 'objetos', SPEED_OBJETOS),
];

export const MIM_CATEGORY_LABELS: Readonly<Record<string, string>> = Object.fromEntries(MIM_CATEGORIES.map((c) => [c.id, c.label]));

/** Temas oferecidos no estilo escolhido. */
export const mimCategoriesFor = (style: 'classic' | 'speed'): MimCategory[] => MIM_CATEGORIES.filter((c) => (style === 'classic' ? c.classic : c.speed));

/** Palavras disponíveis para o estilo e os temas escolhidos. */
export const mimPoolSize = (style: 'classic' | 'speed', categories: readonly string[]): number =>
  MIM_WORDS.filter((w) => w.pool === style && categories.includes(w.category)).length;
