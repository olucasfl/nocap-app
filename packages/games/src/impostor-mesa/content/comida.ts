import { questions, words, type Row } from './build';

const R: Row[] = [
  ['Pizza', 'Lasanha', 'tipo=prato'], ['Lasanha', 'Macarrão', 'tipo=prato'], ['Hambúrguer', 'Cachorro-quente', 'tipo=lanche'],
  ['Cachorro-quente', 'Hambúrguer', 'tipo=lanche'], ['Sushi', 'Sashimi', 'tipo=prato'], ['Feijoada', 'Strogonoff', 'tipo=prato'],
  ['Strogonoff', 'Feijoada', 'tipo=prato'], ['Churrasco', 'Costela', 'tipo=prato'], ['Macarrão', 'Lasanha', 'tipo=prato'],
  ['Arroz com feijão', 'Feijoada', 'tipo=prato'], ['Coxinha', 'Pastel', 'tipo=lanche'], ['Pastel', 'Coxinha', 'tipo=lanche'],
  ['Pão de queijo', 'Esfiha', 'tipo=lanche'], ['Batata frita', 'Onion rings', 'tipo=lanche'], ['Pipoca', 'Batata frita', 'tipo=lanche'],
  ['Tapioca', 'Crepe', 'tipo=lanche'], ['Misto quente', 'Sanduíche natural', 'tipo=lanche'], ['Taco', 'Burrito', 'tipo=prato'],
  ['Omelete', 'Ovo mexido', 'tipo=prato'], ['Sopa', 'Caldo verde', 'tipo=prato'], ['Salada', 'Sopa', 'tipo=prato'],
  ['Moqueca', 'Bobó de camarão', 'tipo=prato'], ['Acarajé', 'Tapioca', 'tipo=lanche'], ['Bolo de chocolate', 'Brownie', 'tipo=doce'],
  ['Brigadeiro', 'Beijinho', 'tipo=doce'], ['Beijinho', 'Brigadeiro', 'tipo=doce'], ['Pudim', 'Mousse', 'tipo=doce'],
  ['Sorvete', 'Picolé', 'tipo=doce'], ['Picolé', 'Sorvete', 'tipo=doce'], ['Açaí', 'Sorvete', 'tipo=doce'],
  ['Chocolate', 'Bombom', 'tipo=doce'], ['Donut', 'Rosquinha', 'tipo=doce'], ['Churros', 'Donut', 'tipo=doce'],
  ['Paçoca', 'Pé de moleque', 'tipo=doce'], ['Pé de moleque', 'Paçoca', 'tipo=doce'], ['Panqueca', 'Waffle', 'tipo=doce'],
  ['Waffle', 'Panqueca', 'tipo=doce'], ['Algodão doce', 'Pipoca doce', 'tipo=doce'], ['Cookie', 'Biscoito', 'tipo=doce'],
  ['Torta de limão', 'Cheesecake', 'tipo=doce'], ['Coca-Cola', 'Pepsi', 'tipo=bebida'], ['Guaraná', 'Fanta', 'tipo=bebida'],
  ['Suco de laranja', 'Limonada', 'tipo=bebida'], ['Café', 'Chá', 'tipo=bebida'], ['Chá', 'Café', 'tipo=bebida'],
  ['Leite', 'Iogurte', 'tipo=bebida'], ['Milk-shake', 'Vitamina', 'tipo=bebida'], ['Água de coco', 'Suco de uva', 'tipo=bebida'],
  ['Cerveja', 'Chopp', 'tipo=bebida'], ['Caipirinha', 'Mojito', 'tipo=bebida'], ['Vinho', 'Champanhe', 'tipo=bebida'],
  ['Banana', 'Maçã', 'tipo=fruta'], ['Maçã', 'Pera', 'tipo=fruta'], ['Morango', 'Cereja', 'tipo=fruta'],
  ['Melancia', 'Melão', 'tipo=fruta'], ['Uva', 'Jabuticaba', 'tipo=fruta'], ['Abacaxi', 'Manga', 'tipo=fruta'],
  ['Manga', 'Mamão', 'tipo=fruta'], ['Laranja', 'Tangerina', 'tipo=fruta'], ['Limão', 'Laranja', 'tipo=fruta'],
  ['Abacate', 'Pepino', 'tipo=fruta'], ['Coco', 'Abacaxi', 'tipo=fruta'], ['Cenoura', 'Beterraba', 'tipo=fruta', 2],
];
export const comidaWords = words('comida', R);
export const comidaQuestions = questions('comida', [
  ['Qual comida você pediria às 3 da manhã?', 'Qual comida você pediria num primeiro encontro?'],
  ['Qual seria a sua última refeição?', 'Qual comida você faria para impressionar a sogra?'],
  ['Qual comida você levaria para a praia?', 'Qual comida você levaria para um acampamento?'],
  ['Qual comida você comeria todo dia por um mês sem enjoar?', 'Qual comida você aguentaria comer só por uma semana?'],
  ['Qual doce você roubaria da mesa de uma festa?', 'Qual doce você daria de presente?'],
  ['Qual bebida você pediria num dia muito quente?', 'Qual bebida você pediria num dia de chuva?'],
  ['Qual fruta você levaria na mochila?', 'Qual fruta você colocaria numa salada?'],
  ['Qual comida você mais comia na casa da sua avó?', 'Qual comida você mais pedia na lanchonete da escola?'],
  ['Qual lanche você escolheria no cinema?', 'Qual lanche você escolheria num jogo de futebol?'],
  ['Qual prato você pediria primeiro num rodízio?', 'Qual prato você deixaria por último num rodízio?'],
]);
