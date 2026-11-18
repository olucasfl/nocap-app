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
  ['Qual marca você usaria o resto da vida sem trocar?', 'Qual marca você trocaria amanhã por uma mais barata?'],
  ['Qual marca tem o melhor anúncio?', 'Qual marca tem o melhor logo?'],
  ['Qual marca você escolheria para patrocinar o seu canal?', 'Qual marca você escolheria para estampar na sua camisa?'],
  ['Qual marca dá mais status?', 'Qual marca dá mais confiança?'],
  ['Qual marca você levaria para uma ilha deserta?', 'Qual marca você sentiria mais falta se sumisse amanhã?'],
  ['Qual marca você compraria de olhos fechados?', 'Qual marca você acha cara demais para o que entrega?'],
  ['Qual marca você daria de presente no Natal?', 'Qual marca você pediria de presente no Natal?'],
  ['Qual marca seria o melhor emprego?', 'Qual marca seria o pior chefe?'],
  ['Qual marca você vê todo dia?', 'Qual marca é a que mais leva o seu dinheiro?'],
  ['Qual marca seria o melhor patrocinador de um time?', 'Qual marca faria o melhor filme?'],
]);
