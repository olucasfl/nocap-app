import { test } from '@playwright/test';
import { loginAs } from './account';
test('dbg', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  page.on('console', (m) => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 300)); });
  page.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 400)));
  await loginAs(page, 'Ana');
  await page.goto('/fox-cap/counter-fox');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await page.getByTestId('cfh-play').click();
  await page.getByTestId('cfh-online').click();
  await page.getByTestId('cfh-create').click();
  await page.waitForTimeout(6000);
  console.log('url', page.url(), 'html', (await page.content()).length, (await page.locator('body').innerText()).slice(0, 200));
});
