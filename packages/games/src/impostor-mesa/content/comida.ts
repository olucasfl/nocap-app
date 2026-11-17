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
  ['Qual é o seu prato favorito?', 'Qual prato você nunca comeria de novo?'],
  ['Qual comida você pediria no seu aniversário?', 'Qual comida você pediria num dia de tristeza?'],
  ['Qual lanche você come mais?', 'Qual lanche você acha o mais enjoativo?'],
  ['Qual doce você escolheria numa festa?', 'Qual doce você nunca escolheria numa festa?'],
  ['Qual bebida pediria num restaurante?', 'Qual bebida você acha a mais estranha?'],
  ['Qual fruta você mais gosta?', 'Qual fruta você menos gosta?'],
]);
