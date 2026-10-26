import { describe, expect, it } from 'vitest';
import { classicProgress, levelEngine, levelView } from './classic-engine';
import type { ClassicLevel } from './levels/levels';

const level: ClassicLevel = { id: 'c-test', t: 0, w: ['amigo'] };
const two: ClassicLevel = { id: 'd-test', t: 0, w: ['amigo', 'folha'] };

describe('motor local das fases do Classic', () => {
  it('começa aberta, com as cores certas e sem revelar a resposta', () => {
    const v = levelView('classic', level, 3, ['casas'], false);
    expect(v).toMatchObject({
      state: 'open',
      used: 1,
      tries: 6,
      answers: null,
      nota: null,
      number: 3,
    });
    expect(v.boards[0]!.rows[0]).toBe('mnmmm');
  });

  it('acertar fecha como vitória e revela as palavras', () => {
    const v = levelView('classic', level, 1, ['casas', 'amigo'], false);
    expect(v.state).toBe('won');
    expect(v.answers).toEqual(['amigo']);
    expect(v.boards[0]!.solvedAt).toBe(2);
  });

  it('gastar as tentativas fecha como derrota; desistir também', () => {
    const lost = levelView(
      'classic',
      level,
      1,
      ['casas', 'casas', 'casas', 'casas', 'casas', 'casas'],
      false,
    );
    expect(lost.state).toBe('lost');
    expect(lost.answers).toEqual(['amigo']);
    const quit = levelView('classic', level, 1, ['casas'], true);
    expect(quit.state).toBe('lost');
    expect(quit.answers).toEqual(['amigo']);
  });

  it('Dueto: dois tabuleiros e 7 tentativas', () => {
    const v = levelView('dueto', two, 1, ['amigo'], false);
    expect(v.boards).toHaveLength(2);
    expect(v.tries).toBe(7);
    expect(v.boards[0]!.solvedAt).toBe(1);
    expect(v.state).toBe('open');
  });

  it('enviar um palpite confere o dicionário, salva o progresso e marca a fase como completa ao fim', async () => {
    const engine = levelEngine('classic', level, 901);
    const start = await engine.start();
    expect(start.used).toBe(0);
    await expect(engine.send(start, 'xxxxx')).rejects.toMatchObject({ status: 400 });
    const after = await engine.send(start, 'casas');
    expect(after.used).toBe(1);
    expect(classicProgress.classic.get(901)).toMatchObject({ guesses: ['casas'] });
    expect(classicProgress.classic.get(901)?.done).toBeUndefined();
    const won = await engine.send(after, 'AMIGO');
    expect(won.state).toBe('won');
    expect(classicProgress.classic.get(901)?.done).toBe(true);
    // abrir de novo continua do mesmo ponto
    expect((await levelEngine('classic', level, 901).start()).state).toBe('won');
  });

  it('desistir salva a fase como completa', async () => {
    const engine = levelEngine('dueto', two, 902);
    const run = await engine.start();
    const quit = await engine.giveUp(run);
    expect(quit.state).toBe('lost');
    expect(classicProgress.dueto.get(902)).toMatchObject({ gaveUp: true, done: true });
  });
});
