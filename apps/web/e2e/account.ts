import type { Page } from '@playwright/test';

/** Entra como uma conta de teste (o Counter Fox só aceita quem tem conta). Com o servidor de salas de teste, "e2e-<nome>" vira a conta <nome>. */
export async function loginAs(page: Page, name = 'teste') {
  await page.addInitScript((n) => {
    localStorage.setItem('nocap-token', `e2e-${n}`);
    localStorage.setItem('nocap-user', JSON.stringify({ id: `e2e-${n}`, name: n, email: `${n}@teste.nocap`, username: n }));
    localStorage.setItem('nocap-mute', '1');
  }, name);
}
