import {
  MIM_DEFAULT_SECONDS, MIM_MAX_PLAYERS, MIM_MAX_ROUNDS, MIM_MAX_TEAMS, MIM_MIN_ROUNDS, MIM_WORDS, mimApply, mimDrawDeck, mimDrawOptions,
  mimNewSession, mimPoolSize, mimSchedule, mimScoreClassicSolo, mimScoreClassicTeams, mimScoreSpeedSolo, mimScoreSpeedTeams, mimShift, mimSidesValid,
  mimSpeedCorrect, mimSpeedSkip, mimSpeedStart,
  type MimFormat, type MimPoints, type MimSession, type MimSettings, type MimSpeedTurn, type MimStyle, type MimTurn, type MimWord,
} from '@nocap/games';
import { AVATARS } from '../impostor/assets';

export type Phase =
  | 'mode' | 'sides' | 'cats' | 'cfg' | 'pass' | 'choose' | 'play' | 'judge' | 'steal' | 'pick' | 'assign' | 'result' | 'final';

/** Time (nome + cor fixa) ou pessoa (nome + personagem); o `id` é o que o calendário e o ranking usam. */
export interface Side {
  id: string;
  name: string;
  avatar: string;
  color: number;
}

/** O turno em andamento: o que a pessoa da mímica vê e o que foi decidido até agora. */
export interface Cur {
  options: MimWord[];
  word: MimWord | null;
  speed: MimSpeedTurn | null;
  /** Clássico em Times: o time acertou? (null = ainda não se sabe). */
  guessed: boolean | null;
  stealers: string[];
  guesser: string | null;
}

export interface State {
  phase: Phase;
  back: boolean;
  format: MimFormat;
  style: MimStyle;
  teams: Side[];
  players: Side[];
  settings: Pick<MimSettings, 'seconds' | 'rounds' | 'categories'>;
  seed: string;
  schedule: MimTurn[];
  turn: number;
  session: MimSession;
  /** Antes do último turno, para animar o ranking. */
  before: MimSession;
  used: string[];
  cur: Cur | null;
  gain: MimPoints;
  shift: 'calm' | 'brusque';
  /** Palavras que apareceram no último turno (para mostrar no resultado). */
  shown: { word: MimWord; ok: boolean }[];
  error: string | null;
  /** A fase de onde viemos e se o último turno acabou por tempo (as cartelas de transição dependem disso). */
  prev: Phase | null;
  timedOut: boolean;
}

const KEY = 'nocap-mimica-setup';
const TEAM_NAMES = ['Time Laranja', 'Time Azul', 'Time Amarelo', 'Time Verde', 'Time Rosa'];

const randomSeed = () => Math.random().toString(36).slice(2, 10);
let uid = 0;
const newId = () => `m${Date.now().toString(36)}${(uid++).toString(36)}`;

export const sidesOf = (s: State): Side[] => (s.format === 'teams' ? s.teams : s.players);
export const sideBy = (s: State, id: string): Side => sidesOf(s).find((x) => x.id === id) ?? sidesOf(s)[0]!;
export const mimerId = (s: State): string => s.schedule[s.turn]?.side ?? sidesOf(s)[0]!.id;
export const settingsFull = (s: State): MimSettings => ({ format: s.format, style: s.style, ...s.settings });

/** Nenhum tema vem marcado: a pessoa escolhe a cada partida. */
export const defaultCategories = (_style: MimStyle): string[] => [];

const defaultTeams = (): Side[] => {
  const taken = new Set<string>();
  return [0, 1].map((i) => {
    const avatar = freeAvatar(taken);
    taken.add(avatar);
    return { id: newId(), name: TEAM_NAMES[i]!, avatar, color: i };
  });
};

export function initial(): State {
  let format: MimFormat = 'teams';
  let style: MimStyle = 'classic';
  let seconds = MIM_DEFAULT_SECONDS.classic;
  let rounds = 3;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as { format?: MimFormat; style?: MimStyle; seconds?: number; rounds?: number };
      if (v.format === 'teams' || v.format === 'solo') format = v.format;
      if (v.style === 'classic' || v.style === 'speed') style = v.style;
      if (typeof v.seconds === 'number') seconds = v.seconds;
      if (typeof v.rounds === 'number') rounds = Math.min(MIM_MAX_ROUNDS, Math.max(MIM_MIN_ROUNDS, v.rounds));
    }
  } catch {
    /* sem memória salva: começa do padrão */
  }
  const empty = mimNewSession([]);
  return {
    phase: 'mode', back: false, format, style, teams: defaultTeams(), players: [], settings: { seconds, rounds, categories: defaultCategories(style) },
    seed: randomSeed(), schedule: [], turn: 0, session: empty, before: empty, used: [], cur: null, gain: {}, shift: 'calm', shown: [], error: null, prev: null, timedOut: false,
  };
}

export function saveSetup(s: State): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ format: s.format, style: s.style, seconds: s.settings.seconds, rounds: s.settings.rounds }));
  } catch {
    /* sem armazenamento: tudo bem */
  }
}

export type Action =
  | { type: 'go'; phase: Phase; back?: boolean }
  | { type: 'mode'; format: MimFormat; style: MimStyle }
  | { type: 'addTeam' }
  | { type: 'removeTeam'; id: string }
  | { type: 'renameTeam'; id: string; name: string }
  | { type: 'addPlayer'; name: string; avatar?: string }
  | { type: 'removePlayer'; id: string }
  | { type: 'setAvatar'; id: string; avatar: string }
  | { type: 'toggleCategory'; id: string }
  | { type: 'settings'; patch: Partial<State['settings']> }
  | { type: 'start' }
  | { type: 'ready' }
  | { type: 'choose'; id: string }
  | { type: 'hit' }
  | { type: 'timeup' }
  /** Fim do tempo no Clássico em Times: o time da vez acertou? Se não, vem o roubo. */
  | { type: 'judge'; guessed: boolean }
  | { type: 'steal'; ids: string[] }
  | { type: 'pick'; id: string | null }
  | { type: 'speedHit' }
  | { type: 'speedSkip' }
  | { type: 'assign'; guessedBy: Record<string, number> }
  | { type: 'next' }
  | { type: 'again' }
  | { type: 'leave' }
  | { type: 'reset' };

export const poolOk = (s: State): boolean => mimPoolSize(s.style, s.settings.categories) >= (s.style === 'classic' ? 12 : 30);
export const sidesOk = (s: State): boolean => mimSidesValid(s.format, sidesOf(s).length);
export const totalTurns = (s: State): number => sidesOf(s).length * s.settings.rounds;

function freeAvatar(taken: Set<string>): string {
  const free = AVATARS.filter((a) => !taken.has(a));
  return free[Math.floor(Math.random() * free.length)] ?? AVATARS[0]!;
}

function emptyCur(): Cur {
  return { options: [], word: null, speed: null, guessed: null, stealers: [], guesser: null };
}

/** Fecha o turno: calcula os pontos, soma no ranking e gasta as palavras mostradas. */
function finish(s: State, points: MimPoints, shown: { word: MimWord; ok: boolean }[]): State {
  const session = mimApply(s.session, points);
  return {
    ...s, phase: 'result', back: false, before: s.session, session, gain: points, shift: mimShift(s.session, session), shown,
    used: [...s.used, ...shown.map((x) => x.word.id)],
  };
}

/** Ações do turno só valem na fase em que fazem sentido (um toque atrasado depois do fim não pode pontuar de novo). */
const ONLY_IN: Partial<Record<Action['type'], Phase>> = {
  hit: 'play', timeup: 'play', speedHit: 'play', speedSkip: 'play', judge: 'judge', steal: 'steal', pick: 'pick', assign: 'assign', choose: 'choose',
};

export function reducer(s: State, a: Action): State {
  const next = step(s, a);
  return next.phase !== s.phase ? { ...next, prev: s.phase } : next;
}

function step(s: State, a: Action): State {
  const need = ONLY_IN[a.type];
  if (need && s.phase !== need) return s;
  switch (a.type) {
    case 'go':
      return { ...s, phase: a.phase, back: !!a.back, error: null };
    case 'mode': {
      const style = a.style;
      return { ...s, format: a.format, style, settings: { ...s.settings, seconds: style === s.style ? s.settings.seconds : MIM_DEFAULT_SECONDS[style], categories: style === s.style ? s.settings.categories : defaultCategories(style) } };
    }
    case 'addTeam': {
      if (s.teams.length >= MIM_MAX_TEAMS) return s;
      const used = new Set(s.teams.map((t) => t.color));
      const color = [0, 1, 2, 3, 4].find((c) => !used.has(c)) ?? s.teams.length;
      return { ...s, teams: [...s.teams, { id: newId(), name: TEAM_NAMES[color] ?? `Time ${s.teams.length + 1}`, avatar: freeAvatar(new Set(s.teams.map((t) => t.avatar))), color }] };
    }
    case 'removeTeam':
      return { ...s, teams: s.teams.filter((t) => t.id !== a.id) };
    case 'renameTeam':
      return { ...s, teams: s.teams.map((t) => (t.id === a.id ? { ...t, name: a.name } : t)) };
    case 'addPlayer': {
      if (s.players.length >= MIM_MAX_PLAYERS) return s;
      const avatar = a.avatar ?? freeAvatar(new Set(s.players.map((p) => p.avatar)));
      return { ...s, players: [...s.players, { id: newId(), name: a.name, avatar, color: s.players.length }] };
    }
    case 'removePlayer':
      return { ...s, players: s.players.filter((p) => p.id !== a.id).map((p, i) => ({ ...p, color: i })) };
    case 'setAvatar':
      return { ...s, teams: s.teams.map((t) => (t.id === a.id ? { ...t, avatar: a.avatar } : t)), players: s.players.map((p) => (p.id === a.id ? { ...p, avatar: a.avatar } : p)) };
    case 'toggleCategory': {
      const on = s.settings.categories.includes(a.id);
      return { ...s, settings: { ...s.settings, categories: on ? s.settings.categories.filter((c) => c !== a.id) : [...s.settings.categories, a.id] } };
    }
    case 'settings':
      return { ...s, settings: { ...s.settings, ...a.patch } };
    case 'start': {
      const sides = sidesOf(s);
      if (!mimSidesValid(s.format, sides.length) || !poolOk(s)) return { ...s, error: 'Faltam jogadores ou palavras para começar.' };
      const empty = mimNewSession(sides.map((x) => x.id));
      return {
        ...s, phase: 'pass', back: false, seed: randomSeed(), schedule: mimSchedule(sides.map((x) => x.id), s.settings.rounds), turn: 0,
        session: empty, before: empty, used: [], cur: emptyCur(), gain: {}, shift: 'calm', shown: [], error: null, timedOut: false,
      };
    }
    case 'ready': {
      const cfg = settingsFull(s);
      try {
        if (s.style === 'classic') {
          const options = mimDrawOptions({ words: MIM_WORDS, settings: cfg, used: s.used, seed: s.seed, turnIndex: s.turn });
          return { ...s, phase: 'choose', back: false, cur: { ...emptyCur(), options } };
        }
        const deck = mimDrawDeck({ words: MIM_WORDS, settings: cfg, used: s.used, seed: s.seed, turnIndex: s.turn });
        return { ...s, phase: 'play', back: false, cur: { ...emptyCur(), speed: mimSpeedStart(deck) } };
      } catch {
        return { ...s, error: 'Poucas palavras nos temas escolhidos.', phase: 'cats' };
      }
    }
    case 'choose': {
      if (!s.cur) return s;
      const word = s.cur.options.find((w) => w.id === a.id) ?? null;
      return word ? { ...s, phase: 'play', back: false, cur: { ...s.cur, word } } : s;
    }
    case 'hit': {
      // Clássico: "Acertamos" (times) ou "Alguém acertou" (individual)
      if (!s.cur?.word) return s;
      if (s.format === 'teams') return finish(s, mimScoreClassicTeams({ mimer: mimerId(s), guessed: true, stealers: [] }), [{ word: s.cur.word, ok: true }]);
      return { ...s, phase: 'pick', back: false };
    }
    case 'timeup': {
      if (!s.cur) return s;
      if (s.style === 'classic') return { ...s, phase: s.format === 'teams' ? 'judge' : 'pick', back: false, timedOut: true };
      return endSpeed({ ...s, timedOut: true });
    }
    case 'judge': {
      if (!s.cur?.word) return s;
      if (a.guessed) return finish(s, mimScoreClassicTeams({ mimer: mimerId(s), guessed: true, stealers: [] }), [{ word: s.cur.word, ok: true }]);
      return { ...s, phase: 'steal', back: false };
    }
    case 'steal': {
      if (!s.cur?.word) return s;
      const pts = mimScoreClassicTeams({ mimer: mimerId(s), guessed: false, stealers: a.ids });
      return finish({ ...s, cur: { ...s.cur, stealers: a.ids } }, pts, [{ word: s.cur.word, ok: a.ids.length > 0 }]);
    }
    case 'pick': {
      if (!s.cur?.word) return s;
      const pts = mimScoreClassicSolo({ mimer: mimerId(s), guesser: a.id });
      return finish({ ...s, cur: { ...s.cur, guesser: a.id } }, pts, [{ word: s.cur.word, ok: a.id !== null }]);
    }
    case 'speedHit':
      return s.cur?.speed ? { ...s, cur: { ...s.cur, speed: mimSpeedCorrect(s.cur.speed) } } : s;
    case 'speedSkip':
      return s.cur?.speed ? { ...s, cur: { ...s.cur, speed: mimSpeedSkip(s.cur.speed) } } : s;
    case 'assign': {
      if (!s.cur?.speed) return s;
      const t = s.cur.speed;
      return finish(s, mimScoreSpeedSolo({ mimer: mimerId(s), correct: t.correct.length, guessedBy: a.guessedBy }), speedShown(t));
    }
    case 'next': {
      const turn = s.turn + 1;
      if (turn >= s.schedule.length) return { ...s, phase: 'final', back: false, turn, cur: null };
      return { ...s, phase: 'pass', back: false, turn, cur: emptyCur(), timedOut: false };
    }
    case 'again': {
      const sides = sidesOf(s);
      const empty = mimNewSession(sides.map((x) => x.id));
      return { ...s, phase: 'pass', back: false, seed: randomSeed(), schedule: mimSchedule(sides.map((x) => x.id), s.settings.rounds), turn: 0, session: empty, before: empty, used: [], cur: emptyCur(), gain: {}, shown: [], timedOut: false };
    }
    case 'leave':
      return { ...s, phase: 'cfg', back: true, cur: null, turn: 0, schedule: [] };
    case 'reset':
      return { ...initial(), players: s.players, teams: s.teams };
  }
}

const speedShown = (t: MimSpeedTurn): { word: MimWord; ok: boolean }[] => {
  const ok = new Set(t.correct);
  return t.deck.slice(0, t.at).map((word) => ({ word, ok: ok.has(word.id) }));
};

function endSpeed(s: State): State {
  const t = s.cur?.speed;
  if (!t) return s;
  const correct = t.correct.length;
  if (s.format === 'solo' && correct > 0) return { ...s, phase: 'assign', back: false };
  const pts = s.format === 'teams' ? mimScoreSpeedTeams({ mimer: mimerId(s), correct }) : mimScoreSpeedSolo({ mimer: mimerId(s), correct, guessedBy: {} });
  return finish(s, pts, speedShown(t));
}

/** Pontos de quem acertou no Speed Individual dependem da tela "Quem acertou?"; sem acertos vai direto ao resultado. */
export const correctCount = (s: State): number => s.cur?.speed?.correct.length ?? 0;
