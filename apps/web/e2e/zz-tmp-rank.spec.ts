import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';
const SP = '/tmp/claude-0/-home-user-nocap-app/599484f6-d22b-5257-a81d-39f0e3e6d941/scratchpad/';
for (const [name, w, h] of [['port', 390, 844], ['land', 844, 390]] as const) {
  test(`mobile ${name}`, async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop');
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await installApi(page);
    await page.addInitScript(() => { localStorage.setItem('nocap-mute', '1'); localStorage.setItem('nocap-golf-best', JSON.stringify({ 1: 2, 2: 3, 3: 1 })); localStorage.setItem('nocap-golf-progress', '4'); });
    for (const [tag, url] of [['home', '/minigolf'], ['fases', '/minigolf/fases'], ['bola', '/minigolf/bola']] as const) {
      await page.goto(url);
      await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: SP + `m-${name}-${tag}.png` });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log(`${name} ${tag} overflow-x=${over}`);
    }
    await page.goto('/minigolf/jogar?fase=1');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: SP + `m-${name}-play.png` });
    // gesto: puxa a bola com um dedo e toca com outro => cancela; arrastar fora da bola gira a câmera
    const res = await page.evaluate(async () => {
      const w = window as any; const sc = w.__mgScene, ball = w.__mgBall;
      const cv = document.querySelector('canvas') as HTMLCanvasElement; const r = cv.getBoundingClientRect();
      const v = new (sc.camera.position.constructor)(ball.pos[0], ball.pos[1], ball.pos[2]).project(sc.camera);
      const bx = r.left + ((v.x + 1) / 2) * r.width, by = r.top + ((1 - v.y) / 2) * r.height;
      const ev = (type: string, id: number, x: number, y: number) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true }));
      const top = () => (document.querySelector('.mg-top') as HTMLElement).innerText;
      const t0 = top(); const yaw0 = sc.yaw;
      ev('pointerdown', 1, r.left + 40, r.top + 200); ev('pointermove', 1, r.left + 140, r.top + 200); ev('pointerup', 1, r.left + 140, r.top + 200);
      const yawChanged = Math.abs(sc.yaw - yaw0) > 0.1;
      ev('pointerdown', 1, bx, by); ev('pointermove', 1, bx, by + 120); ev('pointerdown', 2, r.left + 30, r.top + 30); ev('pointerup', 1, bx, by + 120);
      await new Promise((r) => setTimeout(r, 400));
      const cancelled = top() === t0;
      ev('pointerdown', 1, bx, by); ev('pointermove', 1, bx, by + 120); ev('pointerup', 1, bx, by + 120);
      await new Promise((r) => setTimeout(r, 500));
      return { yawChanged, cancelled, shot: top() !== t0 };
    });
    console.log(name, JSON.stringify(res));
    expect(res.yawChanged).toBe(true);
    expect(res.cancelled).toBe(true);
    expect(res.shot).toBe(true);
    await ctx.close();
  });
}
