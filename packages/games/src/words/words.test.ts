import { describe, expect, it } from 'vitest';
import {
  CLASSIC_MODE_INFO,
  buildDictionary,
  classicNota,
  classicTenths,
  decodePattern,
  encodePattern,
  isSolved,
  isWordText,
  keyboardState,
  playClassic,
  scoreGuess,
  colorKey,
  wordKey,
  type Cell,
} from './index';

const row = (answer: string, guess: string) => encodePattern(scoreGuess(answer, guess));

describe('texto', () => {
  it('a chave tira acento, ç e maiúsculas', () => {
    expect(wordKey('Avião')).toBe('aviao');
    expect(wordKey('coração')).toBe('coracao');
    expect(wordKey('  É ')).toBe('e');
    expect(wordKey('aviao')).toBe(wordKey('avião'));
  });

  it('reconhece texto de palavra', () => {
    expect(isWordText('avião')).toBe(true);
    expect(isWordText('Coração')).toBe(true);
    expect(isWordText('a b')).toBe(false);
    expect(isWordText('a1')).toBe(false);
    expect(isWordText('')).toBe(false);
  });

  it('o dicionário liga a chave à forma correta e guarda a primeira', () => {
    const d = buildDictionary(['avião', 'aviao', 'coração']);
    expect(d.get('aviao')).toBe('avião');
    expect(d.get('coracao')).toBe('coração');
  });
});

describe('cores de um palpite', () => {
  it('tudo certo, tudo errado e lugares trocados', () => {
    expect(row('amigo', 'amigo')).toBe('hhhhh');
    expect(row('amigo', 'turbs')).toBe('mmmmm');
    expect(row('amigo', 'oimag')).toBe('nnnnn');
  });

  it('letra repetida no palpite só é pintada tantas vezes quanto aparece na resposta', () => {
    // amigo tem um m: o 1º m do palpite é amarelo e o 2º fica cinza
    expect(row('amigo', 'mamae')).toBe('nnmmm');
  });

  it('duas letras iguais para uma só na resposta: a do lugar certo fica verde e a outra cinza (regra do Wordle/Termo)', () => {
    // folha tem um o só (2ª casa): o o do lugar certo é verde e o outro, cinza, nunca amarelo
    expect(row('folha', 'coroa')).toBe('mhmmh');
    expect(row('folha', 'ooxxx')).toBe('mhmmm');
    // sem verde, o amarelo vai para a 1ª ocorrência e a outra fica cinza
    expect(row('folha', 'oxoxx')).toBe('nmmmm');
    // duas letras na resposta: as duas podem pintar
    expect(row('bolso', 'ooxxx')).toBe('nhmmm');
  });

  it('tabela de repetições', () => {
    // a resposta tem 3 letras a e o palpite só tem a
    expect(row('arara', 'aaaaa')).toBe('hmhmh');
    // o verde consome a letra; o amarelo usa só o que sobrou
    expect(row('abcde', 'aabbb')).toBe('hmnmm');
    expect(row('abcde', 'eeeee')).toBe('mmmmh');
    // resposta com duas letras s e palpite com uma: amarela
    expect(row('casas', 'sabor')).toBe('nhmmm');
    // duas na resposta e cinco no palpite: só as duas no lugar certo ficam verdes
    expect(row('bolos', 'ooooo')).toBe('mhmhm');
    // o s da posição 0 não tem mais s para consumir (o último s já é verde)
    expect(row('lobos', 'solos')).toBe('mhnhh');
    // resposta toda de a
    expect(row('aaaaa', 'abaca')).toBe('hmhmh');
    // sem verdes, cada letra amarela consome uma da resposta
    expect(row('ababa', 'baaab')).toBe('nnhnn');
  });

  it('acento não muda a cor: aviao e avião são a mesma palavra', () => {
    expect(row('avião', 'aviao')).toBe('hhhhh');
    // (o servidor sempre pinta a forma correta da palavra, com ç: `coracao` chega como `coração`)
    expect(row('coração', 'coração')).toBe('hhhhhhh');
    expect(row('ação', 'ação')).toBe('hhhh');
    expect(row('avião', 'aviao')).toBe('hhhhh');
  });

  it('palpite e resposta de tamanhos diferentes é erro', () => {
    expect(() => scoreGuess('amigo', 'casa')).toThrow();
  });

  it('codifica e decodifica uma linha', () => {
    const cells = scoreGuess('amigo', 'mamae');
    expect(decodePattern(encodePattern(cells))).toEqual(cells);
    expect(() => decodePattern('hx')).toThrow();
    expect(isSolved(scoreGuess('amigo', 'amigo'))).toBe(true);
    expect(isSolved(scoreGuess('amigo', 'amiga'))).toBe(false);
  });
});

describe('teclado', () => {
  it('guarda a melhor situação de cada letra: verde vence amarelo, que vence cinza', () => {
    const guesses = ['mamae', 'amigo'];
    const rows: Cell[][] = guesses.map((g) => scoreGuess('amigo', g));
    const state = keyboardState(guesses, rows);
    expect(state.get('a')).toBe('hit');
    expect(state.get('m')).toBe('hit');
    expect(state.get('e')).toBe('miss');
    expect(state.get('o')).toBe('hit');
  });
});

describe('nota do Classic', () => {
  it('uma palavra de 6 tentativas: acertar no 3º dá 6,7', () => {
    expect(classicNota([3], 6)).toBe(6.7);
    expect(classicNota([1], 6)).toBe(10);
    expect(classicNota([6], 6)).toBe(1.7);
    expect(classicNota([null], 6)).toBe(0);
  });

  it('a tabela da spec', () => {
    const dueto = [1, 2, 3, 4, 5, 6, 7].map((k) => classicNota([k, k], 7));
    expect(dueto).toEqual([10, 8.6, 7.1, 5.7, 4.3, 2.9, 1.4]);
    const quarteto = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => classicNota([k, k, k, k], 9));
    expect(quarteto).toEqual([10, 8.9, 7.8, 6.7, 5.6, 4.4, 3.3, 2.2, 1.1]);
  });

  it('quarteto acertando só 2 no 5º e 7º palpites dá 2,2', () => {
    expect(classicNota([5, 7, null, null], 9)).toBe(2.2);
  });

  it('nota em décimos', () => {
    expect(classicTenths(6.7)).toBe(67);
    expect(classicTenths(10)).toBe(100);
  });
});

describe('partida do Classic', () => {
  it('1 palavra: vitória no 3º palpite', () => {
    const s = playClassic('classic', ['amigo'], ['casas', 'sabor', 'amigo']);
    expect(s.won).toBe(true);
    expect(s.over).toBe(true);
    expect(s.used).toBe(3);
    expect(s.boards[0]!.solvedAt).toBe(3);
    expect(s.nota).toBe(6.7);
  });

  it('1 palavra: em andamento não tem nota e a derrota gasta as 6 tentativas', () => {
    const open = playClassic('classic', ['amigo'], ['casas']);
    expect(open.over).toBe(false);
    expect(open.nota).toBe(0);
    const lost = playClassic('classic', ['amigo'], ['casas', 'sabor', 'turbo', 'pedra', 'folha', 'livro']);
    expect(lost.over).toBe(true);
    expect(lost.won).toBe(false);
    expect(lost.used).toBe(6);
    expect(lost.nota).toBe(0);
  });

  it('o mesmo palpite vale para os dois tabuleiros do Dueto e o resolvido trava', () => {
    const s = playClassic('dueto', ['amigo', 'folha'], ['amigo', 'casas', 'folha']);
    expect(s.boards[0]!.solvedAt).toBe(1);
    expect(s.boards[0]!.rows).toHaveLength(1); // travou no 1º palpite
    expect(s.boards[1]!.rows).toHaveLength(3);
    expect(s.boards[1]!.solvedAt).toBe(3);
    expect(s.won).toBe(true);
    // (10 x 7/7 + 10 x 5/7) / 2 = 8,57
    expect(s.nota).toBe(8.6);
  });

  it('Quarteto tem 9 tentativas e 4 tabuleiros', () => {
    expect(CLASSIC_MODE_INFO.quarteto).toEqual({ words: 4, tries: 9 });
    const s = playClassic('quarteto', ['amigo', 'folha', 'livro', 'pedra'], ['amigo', 'folha']);
    expect(s.boards.map((b) => b.solvedAt)).toEqual([1, 2, null, null]);
    expect(s.over).toBe(false);
  });

  it('depois de acabar, palpites a mais são ignorados', () => {
    const s = playClassic('classic', ['amigo'], ['amigo', 'casas']);
    expect(s.used).toBe(1);
    expect(s.guesses).toEqual(['amigo']);
  });

  it('erros de uso: quantidade de respostas e tamanho do palpite', () => {
    expect(() => playClassic('dueto', ['amigo'], [])).toThrow();
    expect(() => playClassic('classic', ['amigo'], ['casa'])).toThrow();
  });
});

describe('o ç é uma letra à parte nas cores', () => {
  it('um ç no palpite só pinta quando a resposta tem ç; um c comum não pinta o ç', () => {
    // resposta com ç: o ç do palpite acerta, e o c de outra palavra não conta
    expect(row('braço', 'braço')).toBe('hhhhh');
    const barcoVsBraco = scoreGuess('braço', 'barco');
    // o c de "barco" (posição 4) NÃO é o ç da resposta: cinza
    expect(barcoVsBraco[3]).toBe('miss');
    // resposta com c comum: o ç do palpite fica cinza, mesmo havendo um c na resposta
    const bracoVsBarco = scoreGuess('barco', 'braço');
    expect(bracoVsBarco[3]).toBe('miss');
    // c com c continua normal (amarelo quando está em outro lugar)
    expect(scoreGuess('cacho', 'chaco')[0]).toBe('hit');
  });

  it('o ç do palpite não pinta a tecla do c (o teclado não tem ç)', () => {
    const rows = [scoreGuess('barco', 'braço')];
    const kb = keyboardState(['braço'], rows);
    expect(kb.has('c')).toBe(false);
    expect(kb.get('ç')).toBe('miss');
    expect(kb.get('b')).toBe('hit');
  });

  it('só o ç é especial: os outros acentos continuam sem importar', () => {
    expect(scoreGuess('avião', 'aviao')).toEqual(['hit', 'hit', 'hit', 'hit', 'hit']);
    expect(colorKey('Coração')).toBe('coraçao');
    expect(wordKey('Coração')).toBe('coracao');
  });
});
