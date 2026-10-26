/**
 * O último jogo aberto (spec 045): o Hub mostra "Continuar" com ele. Só o caminho da tela do jogo e o nome ficam
 * guardados no aparelho; nada vai para o servidor.
 */
const KEY = 'nocap-last-game';

const GAMES: { prefix: string; name: string; to: string }[] = [
  { prefix: '/cor', name: 'Mesmíssima', to: '/cor' },
  { prefix: '/tempo', name: 'Já Deu?', to: '/tempo' },
  { prefix: '/eco', name: 'Ecooo', to: '/eco' },
  { prefix: '/atravessa', name: 'Atravessa!', to: '/atravessa' },
  { prefix: '/fox-cap/desmorona', name: 'Desmorona!', to: '/fox-cap/desmorona' },
  { prefix: '/fox-cap', name: 'Fox Cap!', to: '/fox-cap' },
  { prefix: '/blocks', name: "Block's", to: '/blocks' },
  { prefix: '/words/classic', name: "Classic Word's", to: '/words/classic' },
  { prefix: '/words/connect', name: "Connect Word's", to: '/words/connect' },
  { prefix: '/words/bee', name: "Bee Word's", to: '/words/bee' },
  { prefix: '/words', name: "Word's", to: '/words' },
  { prefix: '/arcade/aperta', name: 'Aperta!', to: '/arcade/aperta' },
];

export interface LastGame {
  name: string;
  to: string;
}

/** Qual jogo é esta rota (ou nada, se não for uma tela de jogo). */
export function gameOfPath(pathname: string): LastGame | null {
  const g = GAMES.find((x) => pathname === x.prefix || pathname.startsWith(`${x.prefix}/`));
  return g ? { name: g.name, to: g.to } : null;
}

export function rememberGame(pathname: string): void {
  const g = gameOfPath(pathname);
  if (!g) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(g));
  } catch {
    /* sem armazenamento: o "continuar" só não aparece */
  }
}

export function lastGame(): LastGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as Partial<LastGame>;
    return typeof g.name === 'string' && typeof g.to === 'string' && gameOfPath(g.to) ? { name: g.name, to: g.to } : null;
  } catch {
    return null;
  }
}
