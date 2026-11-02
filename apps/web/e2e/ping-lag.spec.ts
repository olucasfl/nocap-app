import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Ping Fox! em sala com DUAS janelas de verdade e atraso de rede injetado (cada janela atrasa o que envia e o que recebe pelo
 * WebSocket). Cada janela é jogada por um bot do próprio jogo e mede, quadro a quadro, o que aparece na tela: pulos da bola,
 * a bola caindo da mesa e voltando, a raquete do adversário. Só roda com `E2E_ROOMS=1` (veja `ping-online.spec.ts`).
 */
test.skip(!process.env.E2E_ROOMS, 'precisa do servidor de salas (E2E_ROOMS=1)');
test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});
test.setTimeout(300_000);

/** Atrasa tudo o que passa pelo WebSocket da página (ida e volta), mantendo a ordem. */
const lagScript = (oneWayMs: number, jitterMs: number, spikeProb = 0, spikeMs = 0) => `
(() => {
  const NativeWS = window.WebSocket;
  const delay = () => Math.max(0, ${oneWayMs} + (Math.random() - 0.5) * 2 * ${jitterMs} + (Math.random() < ${spikeProb} ? ${spikeMs} : 0));
  class LagWS extends EventTarget {
    constructor(url, protocols) {
      // só a conexão da sala (o servidor de salas) é atrasada; o resto (como o recarregar do vite) passa direto
      if (!String(url).includes(':3340')) return protocols === undefined ? new NativeWS(url) : new NativeWS(url, protocols);
      super();
      this._ws = protocols === undefined ? new NativeWS(url) : new NativeWS(url, protocols);
      this._ws.binaryType = this.binaryType = 'arraybuffer';
      this.onopen = this.onmessage = this.onclose = this.onerror = null;
      let inLast = 0;
      this._ws.addEventListener('message', (e) => {
        const at = Math.max(inLast, performance.now() + delay());
        inLast = at;
        setTimeout(() => this._emit('message', new MessageEvent('message', { data: e.data })), Math.max(0, at - performance.now()));
      });
      for (const t of ['open', 'close', 'error']) this._ws.addEventListener(t, (e) => this._emit(t, e));
      this._outLast = 0;
    }
    _emit(type, e) {
      const h = this['on' + type];
      if (typeof h === 'function') h.call(this, e);
      this.dispatchEvent(type === 'message' ? e : type === 'close' ? new CloseEvent('close', { code: e.code, reason: e.reason, wasClean: e.wasClean }) : new Event(type));
    }
    send(raw) {
      // o cliente reaproveita o mesmo buffer depois de enviar: copia agora, envia depois
      const data =
        raw instanceof ArrayBuffer
          ? raw.slice(0)
          : ArrayBuffer.isView(raw)
            ? new Uint8Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
            : raw;
      const at = Math.max(this._outLast, performance.now() + delay());
      this._outLast = at;
      setTimeout(() => { if (this._ws.readyState === 1) this._ws.send(data); }, Math.max(0, at - performance.now()));
    }
    close(c, r) { this._ws.close(c, r); }
    get readyState() { return this._ws.readyState; }
    get bufferedAmount() { return this._ws.bufferedAmount; }
    get url() { return this._ws.url; }
    get protocol() { return this._ws.protocol; }
    get extensions() { return this._ws.extensions; }
  }
  LagWS.CONNECTING = 0; LagWS.OPEN = 1; LagWS.CLOSING = 2; LagWS.CLOSED = 3;
  window.WebSocket = LagWS;
})();`;

async function nick(page: Page, name: string) {
  await page.getByRole('dialog').locator('input').first().fill(name);
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
}

/** O "jogador": um bot do jogo no lugar do mouse. */
const drive = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as {
      __ping: {
        match: { lastHitter: number };
        net: { localPlayer: number };
        Bot: new (lv: unknown, rng: () => number) => { input(m: unknown, p: number): unknown };
        levels: Record<string, unknown>;
      };
      __pingForce?: unknown;
    };
    const g = w.__ping;
    const me = g.net.localPlayer;
    const bot = new g.Bot(g.levels.medio, Math.random);
    setInterval(() => {
      w.__pingForce = bot.input(g.match, me);
    }, 16);
  });

/** Anota, quadro a quadro, o que aparece na tela (hora comum entre as duas janelas = `Date.now()`). */
const record = (page: Page, ms: number) =>
  page.evaluate(async (dur) => {
    const g = (
      window as unknown as {
        __ping: {
          scene: {
            ball: { position: { x: number; y: number; z: number } };
            pads: ({ g: { position: { x: number; y: number; z: number } } } | undefined)[];
            view?: { lag: number; holdT: number };
          };
          match: {
            phase: string;
            expect: number;
            lastHitter: number;
            bounces: number[];
            rally: number;
            ball: { x: number; y: number; z: number; vz: number };
            pad(p: number): { x: number; reach: number };
          };
          net: { localPlayer: number };
        };
      }
    ).__ping;
    const me = g.net.localPlayer;
    const rows: number[][] = [];
    const t0 = performance.now();
    await new Promise<void>((done) => {
      const f = (t: number) => {
        const b = g.scene.ball.position;
        const m = g.match;
        // [hora, fase(1=troca), bolaX, bolaY, bolaZ (na tela), simY, simZ, lag, hold, minhaRaqX, minhaReach, advRaqX, advReach, expect, rally]
        rows.push([
          Date.now(),
          m.phase === 'rally' ? 1 : 0,
          b.x,
          b.y,
          b.z,
          m.ball.y,
          m.ball.z,
          g.scene.view?.lag ?? 0,
          g.scene.view?.holdT ?? -1,
          m.pad(me).x,
          m.pad(me).reach,
          m.pad(1 - me).x,
          m.pad(1 - me).reach,
          m.expect,
          m.rally,
          g.scene.pads[1]?.g.position.x ?? 0,
          g.scene.pads[1]?.g.position.y ?? 0,
          g.scene.pads[1]?.g.position.z ?? 0,
        ]);
        if (t - t0 < dur) requestAnimationFrame(f);
        else done();
      };
      requestAnimationFrame(f);
    });
    return { me, rows };
  }, ms);

type Rec = Awaited<ReturnType<typeof record>>;

/** Quanto atrasa (ms) o que um vê da raquete do outro: acha o atraso que menos erra e mede o erro sem atraso. */
function paddleLag(own: Rec, seen: Rec) {
  const ownT = own.rows.map((r) => r[0]!);
  const at = (t: number): number[] | null => {
    let lo = 0;
    let hi = ownT.length - 1;
    if (t < ownT[0]! || t > ownT[hi]!) return null;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ownT[mid]! <= t) lo = mid;
      else hi = mid;
    }
    return own.rows[lo]!;
  };
  // x da raquete: a de quem joga de 1 aparece espelhada na tela, mas o x do jogo é o mesmo nos dois aparelhos
  const err = (tau: number) => {
    let sum = 0;
    let n = 0;
    for (const r of seen.rows) {
      if (!r[1]) continue;
      const o = at(r[0]! - tau);
      if (!o) continue;
      sum += Math.abs(r[11]! - o[9]!) + Math.abs(r[12]! - o[10]!);
      n++;
    }
    return n ? sum / n : Infinity;
  };
  let best = 0;
  let bestErr = Infinity;
  for (let tau = 0; tau <= 500; tau += 10) {
    const e = err(tau);
    if (e < bestErr) {
      bestErr = e;
      best = tau;
    }
  }
  return {
    lagMs: best,
    errNow: Math.round(err(0) * 100) / 100,
    errBest: Math.round(bestErr * 100) / 100,
  };
}

function ballStats(rec: Rec) {
  const R = rec.rows;
  let jumps = 0;
  let worst = 0;
  let fallThenBack = 0;
  let fastFrames = 0;
  for (let i = 1; i < R.length; i++) {
    const a = R[i - 1]!;
    const b = R[i]!;
    if (!a[1] || !b[1]) continue;
    const dt = Math.max(0.001, (b[0]! - a[0]!) / 1000);
    const d = Math.hypot(b[2]! - a[2]!, b[3]! - a[3]!, b[4]! - a[4]!);
    const extra = d - 26 * dt;
    worst = Math.max(worst, extra);
    if (extra > 0.4) jumps++;
    // bola desenhada abaixo da mesa durante a troca e que depois volta a aparecer acima dela na mesma troca
    if (a[3]! < 0.85 && b[3]! >= 0.85 && a[14] === b[14]) fallThenBack++;
    if (d / dt > 40) fastFrames++;
  }
  // quando a bola passa a sair da raquete do adversário (o atraso da bola desenhada sobe), onde está a raquete dele na tela?
  let hits = 0;
  let padGap = 0;
  let padGapMax = 0;
  for (let i = 1; i < R.length; i++) {
    const a = R[i - 1]!;
    const b = R[i]!;
    if (a[7]! < 0.5 && b[7]! >= 1) {
      const d = Math.hypot(b[2]! - b[15]!, b[3]! - b[16]!, b[4]! - b[17]!);
      hits++;
      padGap += d;
      padGapMax = Math.max(padGapMax, d);
    }
  }
  return {
    jumps,
    worst: Math.round(worst * 100) / 100,
    fallThenBack,
    fastFrames,
    saidas: hits,
    raqueteNaSaida: Math.round((padGap / Math.max(1, hits)) * 100) / 100,
    raqueteNaSaidaMax: Math.round(padGapMax * 100) / 100,
  };
}

test('duas janelas com atraso de rede: a bola e a raquete do adversário andam lisas', async ({
  browser,
}) => {
  const mk = async (
    oneWay: number,
    jitter: number,
  ): Promise<{ ctx: BrowserContext; page: Page }> => {
    const ctx = await browser.newContext({
      viewport: { width: 480, height: 270 },
      deviceScaleFactor: 1,
      locale: 'pt-BR',
    });
    await ctx.addInitScript(
      'window.__pingLowFx = true;' + (process.env.LAG_NOSNAP ? 'window.__pingNoSnap = true;' : ''),
    );
    await ctx.addInitScript(
      lagScript(
        oneWay,
        jitter,
        Number(process.env.LAG_SPIKE ?? 0),
        Number(process.env.LAG_SPIKE_MS ?? 350),
      ),
    );
    return { ctx, page: await ctx.newPage() };
  };
  const lead = Number(process.env.LAG_LEAD ?? 20);
  const other = Number(process.env.LAG_OTHER ?? 80);
  const jit = Number(process.env.LAG_JITTER ?? 15);
  const { page: A } = await mk(lead, jit);
  await A.goto('/fox-cap');
  await A.getByRole('button', { name: 'Agora não' })
    .click({ timeout: 8000 })
    .catch(() => undefined);
  await A.getByText('Com amigos', { exact: true }).first().click();
  await A.getByTestId('foxcap-friends').click();
  await nick(A, 'Ana');
  await A.waitForURL(/\/sala\//);
  const code = A.url().split('/sala/')[1]!.slice(0, 4);
  const { page: B } = await mk(other, jit);
  await B.goto('/fox-cap');
  await B.getByRole('button', { name: 'Agora não' })
    .click({ timeout: 8000 })
    .catch(() => undefined);
  await B.getByText('Com amigos', { exact: true }).first().click();
  await B.getByLabel('Código da sala').fill(code);
  await B.getByRole('button', { name: 'Entrar', exact: true }).click();
  await nick(B, 'Bia');
  await B.waitForURL(/\/sala\//);
  await A.getByRole('tab', { name: /Regras/i }).click();
  await A.getByTestId('pick-pingpong').click();
  await B.getByRole('button', { name: /ESTOU PRONTO/i }).click();
  await A.getByRole('button', { name: /COMEÇAR/i }).click();
  await A.getByTestId('png-play').waitFor({ timeout: 30_000 });
  await B.getByTestId('png-play').waitFor({ timeout: 30_000 });
  await drive(A);
  await drive(B);
  await A.waitForTimeout(12_000); // contagem + primeiras trocas
  const [ra, rb] = await Promise.all([record(A, 40_000), record(B, 40_000)]);
  // o que o líder (A) vê do outro (B) e vice-versa
  const aSeesB = paddleLag(rb, ra);
  const bSeesA = paddleLag(ra, rb);
  console.log(
    'LAG tela do líder(' + lead + 'ms)',
    JSON.stringify(ballStats(ra)),
    'raquete do outro:',
    JSON.stringify(aSeesB),
  );
  console.log(
    'LAG tela do outro(' + other + 'ms)',
    JSON.stringify(ballStats(rb)),
    'raquete do líder:',
    JSON.stringify(bSeesA),
  );
  expect(ra.rows.length).toBeGreaterThan(200);
  // trava de regressão com a rede simulada (líder 20 ms, outro 80 ms, picos de 350 ms): a versão aprovada pelo Lucas
  // (rodada 38) fica nestes números com bots; piorar muito daqui é piorar o jogo
  for (const [nome, r] of [
    ['líder', ballStats(ra)],
    ['outro', ballStats(rb)],
  ] as const) {
    expect(r.fallThenBack, `${nome}: bola caiu da mesa e voltou`).toBeLessThanOrEqual(3);
    expect(r.jumps, `${nome}: pulos da bola`).toBeLessThanOrEqual(10);
    expect(r.worst, `${nome}: maior salto da bola (m)`).toBeLessThan(1.6);
    expect(r.fastFrames, `${nome}: quadros com a bola impossivelmente rápida`).toBeLessThanOrEqual(
      16,
    );
  }
});
