import type { Page, Route } from '@playwright/test';

/**
 * Uma API falsa do Classic Word's, com estado, que faz o que o servidor faz (cores, tentativas, nota, 409 no
 * Daily repetido, partida aberta que continua e a próxima palavra já sorteada). Bee e Connect são offline e
 * não usam API. Serve para testar as telas de ponta a ponta sem banco nem conta de verdade.
 */
const USER = { id: 'u-test', name: 'Teste', email: 'teste@nocap.test', username: 'teste' };

type Cell = 'h' | 'n' | 'm';
const key = (w: string) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function score(answer: string, guess: string): string {
  const a = [...key(answer)];
  const g = [...key(guess)];
  const out: Cell[] = g.map(() => 'm');
  const left = new Map<string, number>();
  a.forEach((ch, i) => {
    if (g[i] === ch) out[i] = 'h';
    else left.set(ch, (left.get(ch) ?? 0) + 1);
  });
  g.forEach((ch, i) => {
    if (out[i] === 'h') return;
    const n = left.get(ch) ?? 0;
    if (n > 0) {
      out[i] = 'n';
      left.set(ch, n - 1);
    }
  });
  return out.join('');
}

const ACCEPTED: Record<string, string> = {
  amigo: 'amigo',
  casas: 'casas',
  mamae: 'mamãe',
  pedra: 'pedra',
  folha: 'folha',
  livro: 'livro',
  turbo: 'turbo',
  sabor: 'sabor',
};
const WORDS = ['amigo', 'folha', 'livro', 'pedra'];
const TRIES = { classic: 6, dueto: 7, quarteto: 9 } as const;
const COUNT = { classic: 1, dueto: 2, quarteto: 4 } as const;

interface ClassicRun {
  id: string;
  mode: keyof typeof TRIES;
  kind: 'daily' | 'solo';
  answers: string[];
  guesses: string[];
  state: 'open' | 'won' | 'lost';
}

function classicView(r: ClassicRun) {
  const tries = TRIES[r.mode];
  const boards = r.answers.map(() => ({ rows: [] as string[], solvedAt: null as number | null }));
  r.guesses.forEach((g, i) => {
    boards.forEach((b, bi) => {
      if (b.solvedAt !== null) return;
      const row = score(r.answers[bi]!, g);
      b.rows.push(row);
      if (row === 'hhhhh') b.solvedAt = i + 1;
    });
  });
  const won = boards.every((b) => b.solvedAt !== null);
  const over = won || r.guesses.length >= tries;
  const nota = over
    ? Math.round(
        (boards.reduce(
          (s, b) => s + (b.solvedAt === null ? 0 : (10 * (tries + 1 - b.solvedAt)) / tries),
          0,
        ) /
          boards.length) *
          10,
      ) / 10
    : null;
  return {
    id: r.id,
    mode: r.mode,
    kind: r.kind,
    day: r.kind === 'daily' ? '2026-10-19' : null,
    number: r.kind === 'daily' ? 1 : null,
    tries,
    used: r.guesses.length,
    state: r.state,
    guesses: r.guesses,
    boards,
    answers: r.state === 'open' ? null : r.answers,
    nota: r.state === 'open' ? null : nota,
  };
}

/** A partida acabou (todos os tabuleiros resolvidos ou tentativas esgotadas)? */
function isOver(r: ClassicRun): boolean {
  const v = classicView({ ...r, state: 'won' });
  return v.boards.every((b) => b.solvedAt !== null) || r.guesses.length >= TRIES[r.mode];
}

export interface MockOptions {
  /** O Daily do Classic já foi jogado hoje. */
  classicDailyDone?: boolean;
  /** Falha as chamadas que criam partida (para testar mensagens de erro). */
  failClassic?: boolean;
}

export async function installApi(page: Page, opts: MockOptions = {}) {
  await page.addInitScript((user) => {
    localStorage.setItem('nocap-token', 'tok');
    localStorage.setItem('nocap-user', JSON.stringify(user));
    localStorage.setItem('nocap-mute', '1');
  }, USER);

  const runs = new Map<string, ClassicRun>();
  let daily: ClassicRun | null = opts.classicDailyDone
    ? {
        id: 'daily-1',
        mode: 'classic',
        kind: 'daily',
        answers: ['amigo'],
        guesses: ['amigo'],
        state: 'won',
      }
    : null;
  let n = 0;
  let wordIdx = 0;

  const newSolo = (mode: keyof typeof TRIES): ClassicRun => {
    const answers = Array.from(
      { length: COUNT[mode] },
      (_, i) => WORDS[(wordIdx + i) % WORDS.length]!,
    );
    wordIdx = 0; // as palavras de teste são sempre as mesmas (amigo, folha...)
    const run: ClassicRun = {
      id: `solo-${++n}`,
      mode,
      kind: 'solo',
      answers,
      guesses: [],
      state: 'open',
    };
    runs.set(run.id, run);
    return run;
  };

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': '*',
      },
      body: JSON.stringify(body),
    });

  await page.route(/localhost:3333/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    if (method === 'OPTIONS') return json(route, {});
    const body = (req.postData() ? JSON.parse(req.postData()!) : {}) as Record<string, unknown>;

    if (path === '/api/auth/get-session') return json(route, { user: USER });
    // Aperta! em teste: o servidor libera só a conta do Lucas; a conta de teste dos e2e conta como liberada.
    if (path === '/me/aperta/access') return json(route, { allowed: true });
    if (path === '/me/visit') return json(route, { current: 1, best: 1, visitedToday: true });
    if (path === '/me/stats') {
      const d = { current: 0, best: 0, playedToday: false, totalScore: null };
      return json(route, {
        modes: [],
        daily: { color: d, time: d, eco: d, blocks: d, atravessa: d, wclassic: d },
        visit: { current: 1, best: 1, visitedToday: true },
      });
    }
    if (path === '/me/ping' || path === '/me/invites') return json(route, []);
    if (path === '/me/room') return json(route, { room: null });

    if (opts.failClassic && path.startsWith('/words/wclassic') && method === 'POST')
      return json(route, { message: 'Erro de teste' }, 500);

    if (path === '/words/wclassic/daily')
      return json(route, { day: '2026-10-19', number: 1, run: daily ? classicView(daily) : null });
    if (path === '/words/wclassic/modes') {
      const out: Record<string, unknown> = {};
      for (const mode of ['classic', 'dueto', 'quarteto'] as const) {
        const mine = [...runs.values()].filter((r) => r.mode === mode && r.kind === 'solo');
        const open = mine.find((r) => r.state === 'open');
        out[mode] = {
          played: mine.filter((r) => r.state !== 'open').length,
          won: mine.filter((r) => r.state === 'won').length,
          open:
            open && open.guesses.length > 0
              ? { used: open.guesses.length, tries: TRIES[mode] }
              : null,
        };
      }
      return json(route, out);
    }
    if (path === '/words/wclassic/runs' && method === 'POST') {
      const mode = body.mode as keyof typeof TRIES;
      if (body.kind === 'daily') {
        if (daily && daily.state !== 'open')
          return json(route, { message: 'Você já jogou o Daily de hoje' }, 409);
        daily ??= {
          id: 'daily-1',
          mode: 'classic',
          kind: 'daily',
          answers: ['amigo'],
          guesses: [],
          state: 'open',
        };
        return json(route, classicView(daily), 201);
      }
      // modo livre: continua a partida aberta do modo
      const open = [...runs.values()].find(
        (r) => r.mode === mode && r.kind === 'solo' && r.state === 'open',
      );
      return json(route, classicView(open ?? newSolo(mode)), 201);
    }
    const m = path.match(/^\/words\/wclassic\/runs\/([^/]+)\/(moves|finish)$/);
    if (m) {
      const run = m[1] === 'daily-1' ? daily! : runs.get(m[1]!)!;
      if (m[2] === 'finish') {
        run.state = 'lost';
        if (run.kind === 'solo') newSolo(run.mode);
        return json(route, classicView(run));
      }
      const word = ACCEPTED[key(String(body.guess))];
      if (!word) return json(route, { message: 'Essa palavra não está na lista' }, 400);
      run.guesses.push(word);
      if (isOver(run)) {
        run.state = classicView({ ...run, state: 'won' }).boards.every((b) => b.solvedAt !== null)
          ? 'won'
          : 'lost';
        if (run.kind === 'solo') newSolo(run.mode); // a próxima palavra já fica sorteada
      }
      return json(route, classicView(run));
    }

    return json(route, { message: `sem mock para ${method} ${path}` }, 404);
  });
}
