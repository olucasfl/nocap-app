import { test } from '@playwright/test';
import { installApi } from './mock-api';
test('shot', async ({ page }) => {
  await installApi(page);
  await page.goto('/words/classic');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/Users/LUCAS~1.LEA/AppData/Local/Temp/claude/C--Users-lucas-leandro-Documents-nocap-app/38ee8f9f-4e0f-4fd6-b356-2c6367f90863/scratchpad/shot-classic2.png' });
});
