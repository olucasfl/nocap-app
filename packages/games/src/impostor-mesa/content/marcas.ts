import { questions, words, type Row } from './build';

const R: Row[] = [
  ['Apple', 'Samsung', 'tipo=tecnologia'], ['Samsung', 'Apple', 'tipo=tecnologia'], ['Google', 'Bing', 'tipo=tecnologia'], ['Microsoft', 'Apple', 'tipo=tecnologia'],
  ['Netflix', 'Disney+', 'tipo=entretenimento'], ['Disney+', 'Netflix', 'tipo=entretenimento'], ['YouTube', 'TikTok', 'tipo=entretenimento'], ['TikTok', 'Instagram', 'tipo=entretenimento'],
  ['Instagram', 'Facebook', 'tipo=tecnologia'], ['Facebook', 'Instagram', 'tipo=tecnologia'], ['WhatsApp', 'Telegram', 'tipo=tecnologia'], ['Spotify', 'YouTube Music', 'tipo=entretenimento'],
  ['PlayStation', 'Xbox', 'tipo=tecnologia'], ['Xbox', 'PlayStation', 'tipo=tecnologia'], ['Nintendo', 'PlayStation', 'tipo=entretenimento'], ['Tesla', 'Toyota', 'tipo=tecnologia'],
  ['Amazon', 'Mercado Livre', 'tipo=tecnologia'], ['Uber', '99', 'tipo=tecnologia'], ['iFood', 'Uber Eats', 'tipo=tecnologia'], ['Nubank', 'Itaú', 'tipo=tecnologia'],
  ['Coca-Cola', 'Pepsi', 'tipo=comida'], ['Pepsi', 'Coca-Cola', 'tipo=comida'], ['McDonald\'s', 'Burger King', 'tipo=comida'], ['Burger King', 'McDonald\'s', 'tipo=comida'],
  ['KFC', 'Bob\'s', 'tipo=comida'], ['Subway', 'McDonald\'s', 'tipo=comida'], ['Starbucks', 'Nespresso', 'tipo=comida'], ['Nutella', 'Ovomaltine', 'tipo=comida'],
  ['Oreo', 'Bono', 'tipo=comida'], ['Kit Kat', 'Bis', 'tipo=comida'], ['Bis', 'Kit Kat', 'tipo=comida'], ['Lacta', 'Garoto', 'tipo=comida'],
  ['Red Bull', 'Monster', 'tipo=comida'], ['Heineken', 'Skol', 'tipo=comida'], ['Skol', 'Brahma', 'tipo=comida'], ['Pringles', 'Ruffles', 'tipo=comida'],
  ['Nike', 'Adidas', 'tipo=roupa'], ['Adidas', 'Nike', 'tipo=roupa'], ['Puma', 'Adidas', 'tipo=roupa'], ['Havaianas', 'Rider', 'tipo=roupa'],
  ['Zara', 'Renner', 'tipo=roupa'], ['Gucci', 'Louis Vuitton', 'tipo=roupa'], ['Louis Vuitton', 'Gucci', 'tipo=roupa'], ['Rolex', 'Casio', 'tipo=roupa'],
  ['Ray-Ban', 'Oakley', 'tipo=roupa'], ['Converse', 'Vans', 'tipo=roupa'], ['Vans', 'Converse', 'tipo=roupa'], ['Lacoste', 'Ralph Lauren', 'tipo=roupa'],
  ['Disney', 'Pixar', 'tipo=entretenimento'], ['Pixar', 'DreamWorks', 'tipo=entretenimento'], ['Lego', 'Playmobil', 'tipo=entretenimento'], ['Barbie', 'Hot Wheels', 'tipo=entretenimento'],
  ['Hot Wheels', 'Barbie', 'tipo=entretenimento'], ['Globo', 'SBT', 'tipo=entretenimento'], ['HBO', 'Netflix', 'tipo=entretenimento'], ['Ferrari', 'Lamborghini', 'tipo=tecnologia'],
  ['Lamborghini', 'Ferrari', 'tipo=tecnologia'], ['Volkswagen', 'Fiat', 'tipo=tecnologia'], ['Fiat', 'Volkswagen', 'tipo=tecnologia'], ['Toyota', 'Honda', 'tipo=tecnologia'],
];
export const marcasWords = words('marcas', R);
export const marcasQuestions = questions('marcas', [
  ['Qual marca você mais usa no dia a dia?', 'Qual marca você nunca compraria?'],
  ['Qual marca de tênis você usaria?', 'Qual marca de tênis você acha cara demais?'],
  ['Qual marca de refrigerante você pediria?', 'Qual marca de refrigerante você recusaria?'],
  ['Qual aplicativo você abre primeiro de manhã?', 'Qual aplicativo você apagaria do celular?'],
  ['Qual marca você mais admira?', 'Qual propaganda você achou a mais chata?'],
  ['Qual lanchonete você escolheria?', 'Qual lanchonete você evitaria?'],
]);
