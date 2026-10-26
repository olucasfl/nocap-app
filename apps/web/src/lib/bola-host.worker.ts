/// <reference lib="webworker" />
import { BOL_TEAM_COLORS, BolaMatch, type BolInfo } from '@nocap/games';

/**
 * A partida do Fut Fox do aparelho do líder (spec 048), numa thread só dela. A simulação não pode esperar a tela
 * desenhar: se o líder demorar 40 ms para pintar um quadro, os passos continuam saindo no ritmo certo e os outros
 * aparelhos recebem o estado na hora, sem rajadas.
 *
 * Mensagens de fora: `init` (monta a partida), `input` (entrada de alguém), `toBot` (alguém saiu), `end` (líder
 * encerra), `stop`. Mensagens de dentro: `frame` (`local`: o quadro como saiu; `peer`: o mesmo com os eventos dos
 * últimos 600 ms repetidos, para os aparelhos remotos, ou `null` neste passo), `roster` e `over`.
 */
interface Setup {
  teams: number;
  perTeam: number;
  durationSec: number;
  seed: string;
  humans: { id: string; name: string; team: number }[];
  bots: number[];
  away: string[];
}
type In =
  | { t: 'init'; setup: Setup; everyPeerFrame: boolean }
  | { t: 'rate'; everyPeerFrame: boolean }
  | { t: 'input'; id: string; v: unknown }
  | { t: 'toBot'; id: string }
  | { t: 'switch'; id: string; name: string; team: number; bot: string | null }
  | { t: 'end' }
  | { t: 'stop' };

const EVENT_KEEP_MS = 600;
let match: BolaMatch | null = null;
let timer = 0;
let everyPeerFrame = true;
let n = 0;
let finished = false;
const evBuf: { at: number; e: Record<string, unknown> }[] = [];
let pendingSt: unknown = null;

const post = (m: unknown) => (self as unknown as { postMessage(x: unknown): void }).postMessage(m);

function loop() {
  const m = match;
  if (!m || finished) return;
  // só sai quadro quando a partida andou: sem quadros repetidos
  if (m.tick() === 0) return;
  const frame = m.drainFrame(true);
  if (!frame) return;
  const now = Date.now();
  for (const e of frame.ev as Record<string, unknown>[]) evBuf.push({ at: now, e });
  while (evBuf.length > 0 && now - (evBuf[0] as { at: number }).at > EVENT_KEEP_MS) evBuf.shift();
  if (frame.st) pendingSt = frame.st;
  const local = JSON.stringify(frame);
  let peer: string | null = null;
  if (everyPeerFrame || n % 2 === 0 || m.over) {
    const out: Record<string, unknown> = { ...frame, ev: evBuf.map((x) => x.e) };
    if (pendingSt) {
      out.st = pendingSt;
      pendingSt = null;
    }
    peer = JSON.stringify(out);
  }
  n++;
  post({ t: 'frame', local, peer });
  if (m.over) {
    finished = true;
    post({ t: 'over', scores: [...m.world.scores], winner: m.world.winner });
    clearInterval(timer);
  }
}

self.onmessage = (ev: MessageEvent<In>) => {
  const msg = ev.data;
  switch (msg.t) {
    case 'init': {
      if (match) return;
      const s = msg.setup;
      everyPeerFrame = msg.everyPeerFrame;
      const humans: BolInfo[] = s.humans.map((h) => ({
        id: h.id,
        name: h.name,
        color: BOL_TEAM_COLORS[h.team] as number,
        team: h.team,
      }));
      match = new BolaMatch({
        teams: s.teams,
        perTeam: s.perTeam,
        durationSec: s.durationSec,
        seed: s.seed,
        humans,
        bots: s.bots,
        away: s.away,
        now: () => Date.now(),
      });
      // 8 ms: acorda duas vezes por passo e nunca atrasa um passo inteiro por causa do relógio
      timer = setInterval(loop, 8) as unknown as number;
      break;
    }
    case 'rate':
      everyPeerFrame = msg.everyPeerFrame;
      break;
    case 'input':
      match?.input(msg.id, msg.v);
      break;
    case 'toBot':
      if (match && !finished) {
        match.toBot(msg.id);
        post({ t: 'roster', rows: match.roster() });
      }
      break;
    case 'switch':
      if (match && !finished) {
        try {
          match.switchTeam(msg.id, msg.name, msg.team, msg.bot);
          post({ t: 'switched', id: msg.id, team: msg.team, ok: true });
          post({ t: 'roster', rows: match.roster() });
        } catch (e) {
          post({
            t: 'switched',
            id: msg.id,
            team: msg.team,
            ok: false,
            error: e instanceof Error ? e.message : 'Não deu para trocar de time',
          });
        }
      }
      break;
    case 'end':
      match?.endNow();
      break;
    case 'stop':
      clearInterval(timer);
      match = null;
      break;
  }
};
