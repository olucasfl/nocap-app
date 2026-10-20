import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

interface BeeLevel {
  id: string;
  c: string;
  l: string[];
  w: string[];
  p: string[];
}
interface ConnectLevel {
  id: string;
  g: { l: number; t: string; w: string[] }[];
}
const levelsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'games', 'words', 'levels');
const BEE = JSON.parse(readFileSync(join(levelsDir, 'bee-levels.json'), 'utf8')) as BeeLevel[];
const CONNECT = JSON.parse(readFileSync(join(levelsDir, 'connect-levels.json'), 'utf8')) as ConnectLevel[];

const key = (w: string) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Toda tela do Word's precisa caber na largura e não pode ter erro de JavaScript. */
function watch(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
  });
  return errors;
}

async function noOverflow(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, 'a página não pode ter rolagem horizontal').toBeLessThanOrEqual(1);
}

/** Abre uma partida do Classic e espera o tabuleiro (o teclado só vale depois de carregar). */
const openPlay = async (page: Page, url: string) => {
  await page.goto(url);
  await expect(page.getByTestId('board-0')).toBeVisible();
};

const type = async (page: Page, text: string) => {
  for (const ch of text) await page.keyboard.press(ch);
};

test.beforeEach(async ({ page }) => {
  await installApi(page);
});

test.describe("Hub do Word's", () => {
  test('a Home tem o cartão do Word\'s e a página mostra os três jogos', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/');
    const card = page.locator('.hub-card-words');
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/words$/);
    for (const id of ['classic', 'connect', 'bee']) await expect(page.getByTestId(`game-${id}`)).toBeVisible();
    await expect(page.getByTestId('game-bee')).toContainText('200 fases');
    await expect(page.getByTestId('game-connect')).toContainText('130 fases');
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

  test('o botão Voltar leva para a tela anterior em cada nível', async ({ page }) => {
    await page.goto('/words');
    await page.getByRole('link', { name: /voltar/i }).click();
    await expect(page).toHaveURL('/');
    await page.goto('/words/bee/fase/1');
    await page.getByRole('link', { name: /voltar/i }).click();
    await expect(page).toHaveURL('/words/bee');
    await page.getByRole('link', { name: /voltar/i }).click();
    await expect(page).toHaveURL('/words');
    await page.goto('/words/connect/fase/1');
    await page.getByRole('link', { name: /voltar/i }).click();
    await expect(page).toHaveURL('/words/connect');
  });

  test('cada cartão abre a página do jogo', async ({ page }) => {
    for (const [id, url] of [
      ['classic', /\/words\/classic$/],
      ['connect', /\/words\/connect$/],
      ['bee', /\/words\/bee$/],
    ] as const) {
      await page.goto('/words');
      await page.getByTestId(`game-${id}`).click();
      await expect(page).toHaveURL(url);
      await noOverflow(page);
    }
  });
});

test.describe("Classic Word's", () => {
  test('a página destaca os 3 modos e tem o botão do Daily', async ({ page }) => {
    await page.goto('/words/classic');
    for (const [m, label] of [['classic', '1 palavra'], ['dueto', '2 palavras'], ['quarteto', '4 palavras']] as const) {
      await expect(page.getByTestId(`mode-${m}`)).toBeVisible();
      await expect(page.getByTestId(`mode-card-${m}`)).toContainText(label);
    }
    await expect(page.getByTestId('play-daily')).toContainText('Jogar o Daily');
    await noOverflow(page);
  });

  test('as cores do palpite aparecem na linha e no teclado (verde, amarelo, cinza)', async ({ page }) => {
    const errors = watch(page);
    await openPlay(page, '/words/classic/jogar?tipo=solo&modo=classic');
    await expect(page.getByTestId('board-0')).toBeVisible();
    // resposta: AMIGO; palpite CASAS -> miss, near, miss, miss, miss
    await type(page, 'casas');
    await page.keyboard.press('Enter');
    const row = page.getByTestId('row-0-0');
    await expect(row).toBeVisible();
    const cells = row.locator('.cw-face.back');
    const states = await cells.evaluateAll((els) => els.map((e) => e.getAttribute('data-cell')));
    expect(states).toEqual(['miss', 'near', 'miss', 'miss', 'miss']);
    await page.waitForTimeout(1900);
    // depois de virar: a casa do A está amarela e visível (o lado colorido ficou para a frente)
    expect(await cells.nth(1).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(255, 210, 63)');
    expect(await cells.nth(0).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(58, 58, 54)');
    const flipped = await row.locator('.cw-card').nth(1).evaluate((e) => getComputedStyle(e).transform);
    expect(flipped).not.toBe('none');
    await expect(page.getByTestId('key-a').locator('i.near')).toHaveCount(1);
    await expect(page.getByTestId('key-c').locator('i.miss')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('letra cinza fica marcada como "já foi", mas continua clicável', async ({ page }) => {
    await openPlay(page, '/words/classic/jogar?tipo=solo&modo=classic');
    await type(page, 'casas');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('row-0-0')).toBeVisible();
    await expect(page.getByTestId('key-c')).toHaveClass(/used/);
    await expect(page.getByTestId('key-m')).not.toHaveClass(/used/);
    await page.getByTestId('key-c').click();
    await expect(page.locator('.cw-tile.filled')).toHaveCount(1);
  });

  test('a legenda das cores aparece no jogo e a aba Como jogar explica', async ({ page }) => {
    await openPlay(page, '/words/classic/jogar?tipo=solo&modo=classic');
    await expect(page.getByText('Lugar certo')).toBeVisible();
    await expect(page.getByText('Outro lugar')).toBeVisible();
    await expect(page.getByText('Não tem (já foi)')).toBeVisible();
    await page.goto('/words/classic');
    await page.getByTestId('tab-regras').click();
    await expect(page.getByText('Tem a letra, mas em outro lugar')).toBeVisible();
  });

  test('o resultado só aparece depois da última linha virar', async ({ page }) => {
    await openPlay(page, '/words/classic/jogar?tipo=solo&modo=classic');
    await type(page, 'amigo');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('row-0-0')).toBeVisible();
    // a linha está virando: ainda não dá o veredito
    await expect(page.getByTestId('end')).toHaveCount(0);
    await expect(page.getByTestId('end')).toBeVisible({ timeout: 6000 });
    await expect(page.getByLabel('A palavra era AMIGO')).toBeVisible();
    await page.getByRole('button', { name: 'Ver tabuleiro' }).click();
    await expect(page.getByTestId('end-bar')).toBeVisible();
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.getByTestId('end')).toBeVisible();
  });

  test('palavra fora da lista balança, avisa e não gasta tentativa', async ({ page }) => {
    await openPlay(page, '/words/classic/jogar?tipo=solo&modo=classic');
    await type(page, 'xxxxx');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Palavra não aceita')).toBeVisible();
    await expect(page.getByText('6 restam')).toBeVisible();
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Faltam letras')).toBeVisible();
  });

  test('vencer mostra em quantas tentativas acertou (sem nota) e a próxima palavra já está sorteada', async ({ page }) => {
    await openPlay(page, '/words/classic/jogar?tipo=solo&modo=classic');
    await type(page, 'amigo');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('end-title')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('nota')).toHaveText('1', { timeout: 5000 });
    await expect(page.getByText('Compartilhar')).toHaveCount(0);
    await expect(page.getByLabel('A palavra era AMIGO')).toBeVisible();
    await page.getByTestId('again').click();
    await expect(page.getByTestId('board-0')).toBeVisible();
    await expect(page.getByText('6 restam')).toBeVisible();
    await expect(page.locator('.cw-row[data-testid]')).toHaveCount(0);
  });

  test('a partida fica salva: sair e voltar continua de onde parou', async ({ page }) => {
    await page.goto('/words/classic');
    await page.getByTestId('mode-classic').click();
    await expect(page.getByTestId('board-0')).toBeVisible();
    await type(page, 'casas');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('row-0-0')).toBeVisible();
    await page.goto('/words/classic');
    await expect(page.getByTestId('mode-card-classic')).toContainText('Em andamento 1/6');
    await page.getByTestId('mode-classic').click();
    await expect(page.getByTestId('row-0-0')).toBeVisible();
    await expect(page.getByText('5 restam')).toBeVisible();
  });

  test('o teclado da tela funciona (letras, apagar e enter)', async ({ page }) => {
    await openPlay(page, '/words/classic/jogar?tipo=solo&modo=classic');
    for (const l of 'amigu') await page.getByTestId(`key-${l}`).click();
    await page.getByTestId('backspace').click();
    await page.getByTestId('key-o').click();
    await page.getByTestId('enter').click();
    await expect(page.getByTestId('end-title')).toBeVisible({ timeout: 8000 });
  });

  test('Dueto: o mesmo palpite vale nos dois tabuleiros e o resolvido trava', async ({ page }) => {
    await openPlay(page, '/words/classic/jogar?tipo=solo&modo=dueto');
    await expect(page.getByTestId('board-1')).toBeVisible();
    await type(page, 'amigo');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('row-0-0')).toBeVisible();
    await expect(page.getByTestId('row-1-0')).toBeVisible();
    await type(page, 'folha');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('row-1-1')).toBeVisible();
    await expect(page.getByTestId('row-0-1')).toHaveCount(0);
    await expect(page.getByTestId('end-title')).toBeVisible({ timeout: 8000 });
    await noOverflow(page);
  });

  test('Quarteto cabe na tela com 4 tabuleiros', async ({ page }) => {
    await openPlay(page, '/words/classic/jogar?tipo=solo&modo=quarteto');
    for (let i = 0; i < 4; i++) await expect(page.getByTestId(`board-${i}`)).toBeVisible();
    await noOverflow(page);
    const box = await page.getByTestId('boards').boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    const tile = await page.locator('.cw-tile').first().boundingBox();
    expect(tile!.width).toBeGreaterThanOrEqual(24);
  });

  test('desistir mostra a palavra e fecha a partida', async ({ page }) => {
    await openPlay(page, '/words/classic/jogar?tipo=solo&modo=classic');
    await page.getByTestId('giveup').click();
    await expect(page.getByTestId('end-title')).toContainText('desistiu');
    await expect(page.getByLabel('A palavra era AMIGO')).toBeVisible();
  });

  test('Daily: jogar, terminar e ver "já jogou" na página', async ({ page }) => {
    await page.goto('/words/classic');
    await page.getByTestId('play-daily').click();
    await expect(page.getByTestId('board-0')).toBeVisible();
    await type(page, 'amigo');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('end-title')).toBeVisible({ timeout: 8000 });
    await page.goto('/words/classic');
    await expect(page.getByTestId('daily-card')).toContainText('Concluído hoje');
    await expect(page.getByTestId('play-daily')).toHaveCount(0);
  });

  test('erro do servidor ao começar mostra mensagem e permite voltar', async ({ page }) => {
    await installApi(page, { failClassic: true });
    await page.goto('/words/classic/jogar?tipo=solo&modo=classic');
    await expect(page.getByText('Erro de teste')).toBeVisible();
    await expect(page.getByRole('link', { name: /voltar/i })).toBeVisible();
  });
});

test.describe("Bee Word's (fases offline)", () => {
  const first = BEE[0]!;
  const letter = (page: Page, l: string) => page.getByTestId(l === first.c ? 'hex-center' : `hex-${l}`);
  const typeWord = async (page: Page, w: string) => {
    for (const ch of key(w)) await letter(page, ch).click();
  };
  const plain = first.w.filter((w) => !first.p.includes(w));

  test('o catálogo mostra todas as fases, com filtros e progresso', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/words/bee');
    await expect(page.getByTestId('bee-hero')).toContainText('200 favos');
    await expect(page.locator('[data-testid^="level-"]')).toHaveCount(200);
    await expect(page.getByTestId('level-1')).toHaveAttribute('data-status', 'new');
    await page.getByTestId('filter-done').click();
    await expect(page.locator('[data-testid^="level-"]')).toHaveCount(0);
    await page.getByTestId('filter-all').click();
    await page.getByTestId('tab-regras').click();
    await expect(page.getByText('Toda palavra tem 4 letras ou mais')).toBeVisible();
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

  test('jogar uma fase: acertos pontuam, erros mostram o motivo, e tudo fica salvo', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/words/bee');
    await page.getByTestId('level-1').click();
    await expect(page).toHaveURL(/\/words\/bee\/fase\/1$/);
    await expect(page.getByTestId('hex-center')).toBeVisible();
    const w1 = plain[0]!;
    await typeWord(page, w1);
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('found')).toContainText(w1);
    await expect(page.getByTestId('rank')).toContainText(' / ');
    // curta e fora da lista
    await typeWord(page, key(first.w[0]!).slice(0, 3));
    await page.getByTestId('submit').click();
    await expect(page.getByText('Muito curta')).toBeVisible();
    await typeWord(page, w1);
    await page.getByTestId('submit').click();
    await expect(page.getByText('Já achada')).toBeVisible();
    // sair e voltar: a fase continua de onde parou
    await page.goto('/words/bee');
    await expect(page.getByTestId('level-1')).toHaveAttribute('data-status', 'open');
    await expect(page.getByTestId('continue')).toContainText('Continuar');
    await page.getByTestId('level-1').click();
    await expect(page.getByTestId('found')).toContainText(w1);
    // recarregar a página também mantém
    await page.reload();
    await expect(page.getByTestId('found')).toContainText(w1);
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

  test('o pangrama mostra o banner e as dicas contam o que falta sem mostrar palavras', async ({ page }) => {
    await page.goto('/words/bee/fase/1');
    await page.getByTestId('tab-hints').click();
    const hints = page.getByTestId('hints');
    await expect(hints).toContainText(`${first.w.length}`);
    await expect(hints).not.toContainText(first.p[0]!);
    await typeWord(page, first.p[0]!);
    await page.getByTestId('submit').click();
    await expect(page.getByText('Pangrama!').first()).toBeVisible();
  });

  test('achar todas as palavras conclui a fase, mostra o resultado e libera a próxima', async ({ page }) => {
    await page.goto('/words/bee/fase/1');
    await expect(page.getByTestId('hex-center')).toBeVisible();
    for (const w of first.w) {
      await type(page, key(w));
      await page.keyboard.press('Enter');
    }
    await expect(page.getByTestId('nota')).toBeVisible();
    await expect(page.getByText('Rainha das Abelhas').first()).toBeVisible();
    await expect(page.getByTestId('next')).toBeVisible();
    await page.getByTestId('back-catalog').click();
    await expect(page.getByTestId('level-1')).toHaveAttribute('data-status', 'done');
    await page.getByTestId('filter-done').click();
    await expect(page.locator('[data-testid^="level-"]')).toHaveCount(1);
  });

  test('o teclado físico, apagar e embaralhar funcionam', async ({ page }) => {
    await page.goto('/words/bee/fase/1');
    await expect(page.getByTestId('hex-center')).toBeVisible();
    await page.keyboard.press(first.c);
    await expect(page.getByTestId('word')).toContainText(first.c.toUpperCase());
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('word')).not.toContainText(first.c.toUpperCase());
    await page.getByTestId('shuffle').click();
    await expect(page.getByTestId('hex-center')).toBeVisible();
  });

  test('fase que não existe mostra aviso', async ({ page }) => {
    await page.goto('/words/bee/fase/9999');
    await expect(page.getByText('Essa fase não existe')).toBeVisible();
  });
});

test.describe("Connect Word's (fases offline)", () => {
  const first = CONNECT[0]!;
  const word = (page: Page, w: string) => page.locator(`.cx-word[data-word="${w}"]`);
  const pick = async (page: Page, words: string[]) => {
    for (const w of words) await word(page, w).click();
  };
  const others = first.g.flatMap((g) => g.w);

  test('o catálogo mostra todas as fases ordenadas e com status', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/words/connect');
    await expect(page.getByTestId('connect-hero')).toContainText('166 puzzles');
    await expect(page.locator('[data-testid^="level-"]')).toHaveCount(166);
    await expect(page.getByTestId('level-1')).toHaveAttribute('data-status', 'new');
    await page.getByTestId('tab-regras').click();
    await expect(page.getByText('Não há vidas')).toBeVisible();
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

  test('não há vidas: a tela mostra o contador de erros e o progresso', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/words/connect/fase/1');
    await expect(page.getByTestId('errors')).toContainText('Erros');
    await expect(page.getByTestId('error-count')).toHaveText('0');
    await expect(page.getByTestId('heart')).toHaveCount(0);
    await expect(page.getByText('0 de 4 grupos')).toBeVisible();
    await expect(page.locator('.cx-word')).toHaveCount(16);
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

  test('acertar trava o grupo; "falta uma" e erro somam erro; repetido não custa; tudo salvo', async ({ page }) => {
    await page.goto('/words/connect/fase/1');
    const [g1, g2, g3] = first.g;
    await pick(page, g1!.w);
    await page.getByTestId('submit').click();
    await expect(page.getByTestId(`band-${g1!.l}`)).toContainText(g1!.t);
    await expect(page.locator('.cx-word')).toHaveCount(12);
    // 3 do grupo 2 + 1 do grupo 3 = falta uma
    const oneAway = [...g2!.w.slice(0, 3), g3!.w[0]!];
    await pick(page, oneAway);
    await page.getByTestId('submit').click();
    await expect(page.getByText('Falta uma!')).toBeVisible();
    await expect(page.getByTestId('error-count')).toHaveText('1');
    await pick(page, oneAway);
    await page.getByTestId('submit').click();
    await expect(page.getByText('Você já tentou esse grupo')).toBeVisible();
    await expect(page.getByTestId('error-count')).toHaveText('1');
    // sair e voltar: continua de onde parou
    await page.goto('/words/connect');
    await expect(page.getByTestId('level-1')).toHaveAttribute('data-status', 'open');
    await page.getByTestId('level-1').click();
    await expect(page.locator('.cx-word')).toHaveCount(12);
    await expect(page.getByTestId('error-count')).toHaveText('1');
    await page.reload();
    await expect(page.getByTestId('error-count')).toHaveText('1');
  });

  test('o botão Enviar só liga com 4 palavras e Limpar desmarca', async ({ page }) => {
    await page.goto('/words/connect/fase/1');
    const submit = page.getByTestId('submit');
    await expect(submit).toBeDisabled();
    await pick(page, others.slice(0, 2));
    await expect(submit).toContainText('2/4');
    await page.getByTestId('clear').click();
    await expect(submit).toContainText('0/4');
    await pick(page, others.slice(0, 4));
    await expect(submit).toBeEnabled();
  });

  test('vencer os 4 grupos conclui a fase e libera a próxima', async ({ page }) => {
    await page.goto('/words/connect/fase/1');
    for (const g of first.g) {
      await pick(page, g.w);
      await page.getByTestId('submit').click();
      await expect(page.getByTestId(`band-${g.l}`)).toBeVisible();
    }
    await expect(page.getByText('Perfeito')).toBeVisible();
    await expect(page.getByTestId('next')).toBeVisible();
    await page.getByTestId('back-catalog').click();
    await expect(page.getByTestId('level-1')).toHaveAttribute('data-status', 'done');
  });

  test('errar muito não acaba o jogo: só soma erros e dá para concluir', async ({ page }) => {
    await page.goto('/words/connect/fase/1');
    const [g1, g2, g3, g4] = first.g;
    for (let i = 0; i < 4; i++) {
      await pick(page, [g1!.w[i % 4]!, g2!.w[i % 4]!, g3!.w[(i + 1) % 4]!, g4!.w[(i + 2) % 4]!]);
      await page.getByTestId('submit').click();
      await page.waitForTimeout(100);
    }
    await expect(page.getByTestId('submit')).toBeVisible();
    for (const g of first.g) {
      await pick(page, g.w);
      await page.getByTestId('submit').click();
      await expect(page.getByTestId(`band-${g.l}`)).toBeVisible();
    }
    await expect(page.getByTestId('error-count')).not.toHaveText('0');
  });

  test('a dica mostra o nome de um conjunto que falta, uma vez por fase', async ({ page }) => {
    await page.goto('/words/connect/fase/1');
    await page.getByTestId('hint').click();
    await expect(page.getByTestId('hint-text')).toContainText(first.g.slice().sort((x, y) => x.l - y.l)[0]!.t);
    await page.getByRole('button', { name: 'Entendi' }).click();
    // a dica pode ser vista de novo, sempre que quiser
    await page.getByTestId('hint').click();
    await expect(page.getByTestId('hint-text')).toBeVisible();
  });

  test('desistir pede confirmação, classifica como Desistência e revela os grupos', async ({ page }) => {
    await page.goto('/words/connect/fase/1');
    await page.getByTestId('giveup').click();
    await page.getByRole('button', { name: 'Continuar jogando' }).click();
    await expect(page.getByTestId('grid')).toBeVisible();
    await page.getByTestId('giveup').click();
    await page.getByRole('button', { name: 'Desistir', exact: true }).last().click();
    await expect(page.getByText('Desistência').first()).toBeVisible();
    for (const g of first.g) await expect(page.getByTestId(`band-${g.l}`)).toBeVisible();
  });

  test('fase que não existe mostra aviso', async ({ page }) => {
    await page.goto('/words/bee/fase/9999');
    await expect(page.getByText('Essa fase não existe')).toBeVisible();
  });
});

test.describe("Connect Word's (fases offline)", () => {
  const first = CONNECT[0]!;
  const word = (page: Page, w: string) => page.locator(`.cx-word[data-word="${w}"]`);
  const pick = async (page: Page, words: string[]) => {
    for (const w of words) await word(page, w).click();
  };
  const others = first.g.flatMap((g) => g.w);

  test('o catálogo mostra todas as fases ordenadas e com status', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/words/connect');
    await expect(page.getByTestId('connect-hero')).toContainText('166 puzzles');
    await expect(page.locator('[data-testid^="level-"]')).toHaveCount(166);
    await expect(page.getByTestId('level-1')).toHaveAttribute('data-status', 'new');
    await page.getByTestId('tab-regras').click();
    await expect(page.getByText('Não há vidas')).toBeVisible();
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

  test('não há vidas: a tela mostra o contador de erros e o progresso', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/words/connect/fase/1');
    await expect(page.getByTestId('errors')).toContainText('Erros');
    await expect(page.getByTestId('error-count')).toHaveText('0');
    await expect(page.getByTestId('heart')).toHaveCount(0);
    await expect(page.getByText('0 de 4 grupos')).toBeVisible();
    await expect(page.locator('.cx-word')).toHaveCount(16);
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

  test('acertar trava o grupo; "falta uma" e erro somam erro; repetido não custa; tudo salvo', async ({ page }) => {
    await page.goto('/words/connect/fase/1');
    const [g1, g2, g3] = first.g;
    await pick(page, g1!.w);
    await page.getByTestId('submit').click();
    await expect(page.getByTestId(`band-${g1!.l}`)).toContainText(g1!.t);
    await expect(page.locator('.cx-word')).toHaveCount(12);
    // 3 do grupo 2 + 1 do grupo 3 = falta uma
    const oneAway = [...g2!.w.slice(0, 3), g3!.w[0]!];
    await pick(page, oneAway);
    await page.getByTestId('submit').click();
    await expect(page.getByText('Falta uma!')).toBeVisible();
    await expect(page.getByTestId('error-count')).toHaveText('1');
    await pick(page, oneAway);
    await page.getByTestId('submit').click();
    await expect(page.getByText('Você já tentou esse grupo')).toBeVisible();
    await expect(page.getByTestId('error-count')).toHaveText('1');
    // sair e voltar: continua de onde parou
    await page.goto('/words/connect');
    await expect(page.getByTestId('level-1')).toHaveAttribute('data-status', 'open');
    await page.getByTestId('level-1').click();
    await expect(page.locator('.cx-word')).toHaveCount(12);
    await expect(page.getByTestId('error-count')).toHaveText('1');
    await page.reload();
    await expect(page.getByTestId('error-count')).toHaveText('1');
  });

  test('o botão Enviar só liga com 4 palavras e Limpar desmarca', async ({ page }) => {
    await page.goto('/words/connect/fase/1');
    const submit = page.getByTestId('submit');
    await expect(submit).toBeDisabled();
    await pick(page, others.slice(0, 2));
    await expect(submit).toContainText('2/4');
    await page.getByTestId('clear').click();
    await expect(submit).toContainText('0/4');
    await pick(page, others.slice(0, 4));
    await expect(submit).toBeEnabled();
  });

  test('vencer os 4 grupos conclui a fase e libera a próxima', async ({ page }) => {
    await page.goto('/words/connect/fase/1');
    for (const g of first.g) {
      await pick(page, g.w);
      await page.getByTestId('submit').click();
      await expect(page.getByTestId(`band-${g.l}`)).toBeVisible();
    }
    await expect(page.getByText('Perfeito')).toBeVisible();
    await expect(page.getByTestId('next')).toBeVisible();
    await page.getByTestId('back-catalog').click();
    await expect(page.getByTestId('level-1')).toHaveAttribute('data-status', 'done');
  });

  test('fase que não existe mostra aviso', async ({ page }) => {
    await page.goto('/words/connect/fase/9999');
    await expect(page.getByText('Essa fase não existe')).toBeVisible();
  });
});
