import type { ImQuestion, ImWord } from '../index';
import { animaisQuestions, animaisWords } from './animais';
import { clashQuestions, clashWords } from './clash';
import { comidaQuestions, comidaWords } from './comida';
import { esportesQuestions, esportesWords } from './esportes';
import { filmesQuestions, filmesWords } from './filmes';
import { futebolQuestions, futebolWords } from './futebol';
import { heroisQuestions, heroisWords } from './herois';
import { lugaresQuestions, lugaresWords } from './lugares';
import { marcasQuestions, marcasWords } from './marcas';
import { musicaQuestions, musicaWords } from './musica';

export interface ImCategory {
  id: string;
  label: string;
  /** Opções de personalização: por etiqueta, os valores que o host pode marcar. */
  filters: readonly { tag: string; label: string; options: readonly { value: string; label: string }[] }[];
}

const o = (value: string, label: string) => ({ value, label });
const origem = { tag: 'origem', label: 'De onde', options: [o('brasil', 'Brasil'), o('mundo', 'Mundo todo')] } as const;

export const IM_CATEGORIES: readonly ImCategory[] = [
  { id: 'comida', label: 'Comida', filters: [{ tag: 'tipo', label: 'O que entra', options: [o('prato', 'Pratos'), o('doce', 'Doces'), o('bebida', 'Bebidas'), o('fruta', 'Frutas'), o('lanche', 'Lanches')] }] },
  { id: 'animais', label: 'Animais', filters: [{ tag: 'tipo', label: 'Onde vivem', options: [o('casa', 'De casa'), o('fazenda', 'Fazenda'), o('selva', 'Selva'), o('mar', 'Mar'), o('ave', 'Aves')] }] },
  { id: 'lugares', label: 'Lugares', filters: [{ tag: 'tipo', label: 'O que entra', options: [o('cidade', 'Cidades'), o('pais', 'Países')] }, origem] },
  { id: 'marcas', label: 'Marcas', filters: [{ tag: 'tipo', label: 'Tipo', options: [o('tecnologia', 'Tecnologia'), o('comida', 'Comida e bebida'), o('roupa', 'Roupa e esporte'), o('entretenimento', 'Entretenimento')] }] },
  { id: 'esportes', label: 'Esportes', filters: [{ tag: 'tipo', label: 'O que entra', options: [o('modalidade', 'Modalidades'), o('equipamento', 'Equipamentos'), o('evento', 'Eventos')] }] },
  { id: 'filmes', label: 'Filmes e Séries', filters: [{ tag: 'tipo', label: 'O que entra', options: [o('filme', 'Filmes'), o('serie', 'Séries'), o('animacao', 'Animações')] }, origem] },
  { id: 'herois', label: 'Heróis e vilões', filters: [{ tag: 'tipo', label: 'Quem entra', options: [o('heroi', 'Heróis'), o('vilao', 'Vilões')] }, { tag: 'universo', label: 'Universo', options: [o('marvel', 'Marvel'), o('dc', 'DC'), o('outros', 'Outros')] }] },
  { id: 'musica', label: 'Músicas e bandas', filters: [{ tag: 'tipo', label: 'O que entra', options: [o('banda', 'Bandas'), o('cantor', 'Cantores'), o('musica', 'Músicas')] }, origem] },
  { id: 'clash', label: 'Clash Royale', filters: [{ tag: 'tipo', label: 'Cartas', options: [o('tropa', 'Tropas'), o('feitico', 'Feitiços'), o('construcao', 'Construções')] }] },
  {
    id: 'futebol',
    label: 'Futebol',
    filters: [
      {
        tag: 'group',
        label: 'O que entra',
        options: [o('jogador-brasil', 'Jogadores do Brasil'), o('jogador-mundo', 'Jogadores do mundo'), o('time-brasil', 'Times do Brasil'), o('time-mundo', 'Times do mundo'), o('selecao', 'Seleções')],
      },
    ],
  },
];

export const IM_WORDS: readonly ImWord[] = [
  ...comidaWords, ...animaisWords, ...lugaresWords, ...marcasWords, ...esportesWords,
  ...filmesWords, ...heroisWords, ...musicaWords, ...clashWords, ...futebolWords,
];
export const IM_QUESTIONS: readonly ImQuestion[] = [
  ...comidaQuestions, ...animaisQuestions, ...lugaresQuestions, ...marcasQuestions, ...esportesQuestions,
  ...filmesQuestions, ...heroisQuestions, ...musicaQuestions, ...clashQuestions, ...futebolQuestions,
];
export const IM_CATEGORY_LABELS: Readonly<Record<string, string>> = Object.fromEntries(IM_CATEGORIES.map((c) => [c.id, c.label]));
