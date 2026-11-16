import { describe, expect, it } from 'vitest';
import { activityFor, activityText } from './activity';

describe('atividade pela tela', () => {
  it('cada jogo vira o seu id', () => {
    expect(activityFor('/cor')).toEqual({ state: 'game', game: 'color' });
    expect(activityFor('/words/classic/fase/classic/1')).toEqual({ state: 'game', game: 'words' });
    expect(activityFor('/fox-cap/counter-fox')).toEqual({ state: 'game', game: 'counterfox' });
    expect(activityFor('/minigolf/jogar')).toEqual({ state: 'game', game: 'minigolf' });
  });
  it('o Fox Cap escolhe o jogo pela busca', () => {
    expect(activityFor('/fox-cap', 'foxgp')).toEqual({ state: 'game', game: 'foxgp' });
    expect(activityFor('/fox-cap', 'atravessa')).toEqual({ state: 'game', game: 'atravessa' });
    expect(activityFor('/fox-cap', null)).toEqual({ state: 'menu', game: null });
  });
  it('sala e menu', () => {
    expect(activityFor('/sala/ABCD')).toEqual({ state: 'room', game: null });
    expect(activityFor('/')).toEqual({ state: 'menu', game: null });
    expect(activityFor('/amigos')).toEqual({ state: 'menu', game: null });
  });
  it('o texto que os amigos veem', () => {
    expect(activityText({ state: 'game', game: 'foxgp' })).toBe('jogando Fox GP');
    expect(activityText({ state: 'room', game: null })).toBe('numa sala');
    expect(activityText({ state: 'menu', game: null })).toBe('no menu');
    expect(activityText(null)).toBeNull();
  });
});
