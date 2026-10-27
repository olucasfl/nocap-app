import { expect, test } from '@playwright/test';

/** O chat por cima da partida (aparência, número de mensagens, tecla T, celular em pé e deitado). Estado de sala injetado. */
const SIZES = [
  { name: 'pe-390', w: 390, h: 844 },
  { name: 'deitado-844', w: 844, h: 390 },
  { name: 'deitado-568', w: 568, h: 320 },
  { name: 'desktop', w: 1280, h: 720 },
];

for (const sz of SIZES) {
  test.describe(sz.name, () => {
    test.use({
      viewport: { width: sz.w, height: sz.h },
      hasTouch: sz.name !== 'desktop',
      isMobile: sz.name !== 'desktop',
    });
    test(`chat ${sz.name}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await page.addInitScript(() => {
        (window as unknown as { __gameChatDemo: boolean }).__gameChatDemo = true;
      });
      await page.goto('/fox-cap');
      await page
        .getByRole('button', { name: 'Agora não' })
        .click({ timeout: 1200 })
        .catch(() => undefined);
      await page.getByTestId('foxcap-desmorona').click();
      await page.getByTestId('dsm-start').click();
      await expect(page.getByTestId('dsm-play')).toBeVisible();
      await page
        .getByTestId('game-tips-ok')
        .click({ timeout: 8000 })
        .catch(() => undefined);
      await page.evaluate(() => {
        const w = window as unknown as {
          __gameChatDemo: boolean;
          __room: { setState: (s: unknown) => void };
        };
        w.__gameChatDemo = true;
        w.__room.setState({
          snapshot: {
            chat: { open: true, muted: [] },
            hostId: 'x',
            members: [],
            desmorona: { slots: { a: 0 }, colors: { a: '#ff7d26', b: '#4fc3f7' }, dead: {} },
          },
          chat: [{ id: 1, userId: 'a', username: 'ana', text: 'bora', at: Date.now() }],
          unread: 0,
        });
      });
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const w = window as unknown as { __room: { setState: (s: unknown) => void } };
        w.__room.setState({
          chat: [
            { id: 1, userId: 'a', username: 'ana', text: 'bora', at: Date.now() },
            {
              id: 2,
              userId: 'b',
              username: 'bia',
              text: 'quem pisou no meio? kkk',
              at: Date.now(),
            },
            { id: 3, userId: 'b', username: 'bia', text: 'cuidado com a borda', at: Date.now() },
          ],
          unread: 12,
        });
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/chat-${sz.name}-1-aviso.png` });
      await expect(page.getByTestId('game-chat-count')).toHaveText('12');
      await page.waitForTimeout(5600);
      await page.screenshot({ path: `test-results/chat-${sz.name}-2-so-botao.png` });
      // tecla T abre (e o campo já fica pronto); T de novo não fecha enquanto se digita, Esc fecha
      await page.keyboard.press('t');
      await expect(page.getByTestId('game-chat-panel')).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `test-results/chat-${sz.name}-3-aberto.png` });
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).toBe('INPUT');
      const box = await page.getByTestId('game-chat-panel').boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(sz.w + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(sz.h + 1);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('game-chat-panel')).toHaveCount(0);
    });
  });
}
