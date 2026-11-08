/// <reference lib="webworker" />
import { FS_NET_HZ, FsNetSim, fsNetParseInput } from '@nocap/games';

/**
 * A partida do Counter Fox no aparelho do líder (spec 060), numa thread só dela: a simulação não espera a tela desenhar.
 * Passos de 1/60 s no relógio de parede (com recuperação limitada), quadro a cerca de 30 por segundo.
 *
 * De fora: `init` (monta a partida e espera `delayMs` até a contagem acabar), `input` (entrada de alguém), `toBot` (alguém
 * saiu), `stop`. De dentro: `frames` (um texto JSON `{f, s, e}` por pessoa, eventos dos últimos 600 ms repetidos com número
 * `n` para o canal sem garantia) e `status` (placar, a cada 2 s e no fim).
 */
type Opts = ConstructorParameters<typeof FsNetSim>[0];
type In =
  | { t: 'init'; opts: Opts; delayMs: number }
  | { t: 'input'; id: string; v: unknown }
  | { t: 'toBot'; id: string }
  | { t: 'stop' };

const STEP_MS = 1000 / FS_NET_HZ;
const MAX_CATCHUP = 6;
const EVENT_KEEP_MS = 600;
let sim: FsNetSim | null = null;
let timer = 0;
let startAt = 0;
let evSeq = 0;
const evBuf:{ at: number; n: number; e: Record<string, unknown> }[] = [];
let finished = false;
let lastStatus = 0;
let sentOver = false;

const post = (m: unknown) => (self as unknown as { postMessage(x: unknown): void }).postMessage(m);

function loop() {
  const s = sim;
  if (!s || finished) return;
  const now = Date.now();
  if (now < startAt) return;
  const want = Math.floor((now - startAt) / STEP_MS);
  let n = 0;
  let stepped = 0;
  while (s.tick < want && n++ < MAX_CATCHUP && !s.over) {
    s.step();
    stepped++;
    // 30 quadros por segundo: um a cada dois passos
    if (s.tick % 2 === 0) emit(s, now);
  }
  // se atrasou demais, descarta o atraso (não corre atrás do tempo perdido)
  if (s.tick < want - 30) startAt = now - s.tick * STEP_MS;
  if (stepped > 0 && now - lastStatus > 2000) {
    lastStatus = now;
    post({ t: 'status', rows: s.results(), over: false });
  }
  if (s.over && !sentOver) {
    sentOver = true;
    emit(s, now);
    post({ t: 'status', rows: s.results(), over: true });
    // o último quadro vai mais vezes (o canal não garante entrega)
    let i = 0;
    const again = setInterval(() => {
      emit(s, Date.now());
      if (++i >= 4) {
        clearInterval(again);
        finished = true;
        clearInterval(timer);
      }
    }, 150);
  }
}


function emit(s: FsNetSim, now: number) {
  for (const e of s.drainEvents()) evBuf.push({ at: now, n: ++evSeq, e: { ...(e as unknown as Record<string, unknown>), n: evSeq } });
  while (evBuf.length > 0 && now - evBuf[0]!.at > EVENT_KEEP_MS) evBuf.shift();
  const f = JSON.stringify(s.frame());
  const e = JSON.stringify(evBuf.map((x) => x.e));
  const texts: Record<string, string> = {};
  for (const r of s.roster) if (!r.bot) texts[r.id] = `{"f":${f},"s":${JSON.stringify(s.selfState(r.id))},"e":${e}}`;
  // quem só assiste (espectador) recebe o mesmo quadro sem o corpo próprio
  texts['*'] = `{"f":${f},"s":null,"e":${e}}`;
  post({ t: 'frames', texts });
}

self.onmessage = (ev: MessageEvent<In>) => {
  const msg = ev.data;
  switch (msg.t) {
    case 'init': {
      if (sim) return;
      sim = new FsNetSim(msg.opts);
      startAt = Date.now() + Math.max(0, msg.delayMs);
      // 8 ms: acorda duas vezes por passo e nunca atrasa um passo inteiro por causa do relógio
      timer = setInterval(loop, 8) as unknown as number;
      break;
    }
    case 'input': {
      const inp = fsNetParseInput(msg.v);
      if (inp && sim && !finished) sim.pushInput(msg.id, inp);
      break;
    }
    case 'toBot':
      if (sim && !finished) sim.takeOver(msg.id);
      break;
    case 'stop':
      clearInterval(timer);
      sim = null;
      finished = true;
      break;
  }
};
