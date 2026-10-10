import { describe, expect, it } from 'vitest';
import { compareToBest, meterPercents, scoreUnit, scoreValue, verdictText } from './match-summary';

describe('esta partida contra o recorde', () => {
  it('o primeiro jogo do modo cria o recorde, não o bate', () => {
    expect(compareToBest(undefined, 250)).toEqual({ verdict: 'first', best: 250, diff: 0 });
    expect(compareToBest(0, 250).verdict).toBe('first');
  });

  it('acima do recorde: novo recorde com a diferença', () => {
    expect(compareToBest(250, 284)).toEqual({ verdict: 'record', best: 284, diff: 34 });
  });

  it('igual não é recorde novo', () => {
    expect(compareToBest(250, 250)).toEqual({ verdict: 'tie', best: 250, diff: 0 });
  });

  it('abaixo: o recorde fica e diz quanto faltou', () => {
    expect(compareToBest(250, 211)).toEqual({ verdict: 'below', best: 250, diff: 39 });
  });
});

describe('valores e frases', () => {
  it('pontos com uma casa; contagens inteiras', () => {
    expect(scoreValue('color', 'classic', 284)).toBe('28.4');
    expect(scoreValue('color', 'survival', 70)).toBe('7');
    expect(scoreValue('eco', 'classic', 120)).toBe('12');
  });

  it('a unidade vem do modo', () => {
    expect(scoreUnit('color', 'classic')).toBe('/30');
    expect(scoreUnit('color', 'quick')).toBe('/10');
    expect(scoreUnit('color', 'survival')).toBe('rodadas');
    expect(scoreUnit('eco', 'escalada')).toBe('passos');
  });

  it('a frase do veredito usa a linguagem do jogo', () => {
    expect(verdictText('color', 'classic', compareToBest(250, 211))).toBe(
      'Faltaram 3.9 pontos para bater o seu recorde.',
    );
    expect(verdictText('color', 'classic', compareToBest(250, 284))).toBe(
      'Novo recorde: 3.4 pontos acima do anterior.',
    );
    expect(verdictText('color', 'survival', compareToBest(100, 70))).toBe(
      'Faltaram 3 rodada(s) para bater o seu recorde.',
    );
    expect(verdictText('eco', 'classic', compareToBest(undefined, 50))).toMatch(/Primeira partida/);
    expect(verdictText('color', 'classic', compareToBest(250, 250))).toMatch(/Igualou/);
  });
});

describe('barra de comparação', () => {
  it('vai até o máximo do modo', () => {
    // Clássico: máximo 30 pontos = 300 décimos.
    expect(meterPercents('color', 'classic', 150, 240)).toEqual({ now: 50, best: 80 });
    expect(meterPercents('color', 'classic', 300, 300)).toEqual({ now: 100, best: 100 });
  });

  it('nas contagens não há máximo: sobra espaço depois do maior valor', () => {
    const m = meterPercents('color', 'survival', 70, 100);
    expect(m.best).toBeLessThan(100);
    expect(m.now).toBeLessThan(m.best);
  });

  it('nunca passa de 0 a 100', () => {
    expect(meterPercents('color', 'classic', 999, 999).now).toBe(100);
    expect(meterPercents('color', 'classic', 0, 0).now).toBe(0);
  });
});
