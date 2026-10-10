import { countUnit, modeMax } from './stats';

export type Verdict = 'first' | 'record' | 'tie' | 'below';

export interface Comparison {
  verdict: Verdict;
  /** O recorde depois desta partida (décimos). */
  best: number;
  /** Quanto a nota ficou acima (recorde) ou abaixo do recorde de antes (décimos). */
  diff: number;
}

/**
 * Esta partida contra o recorde que existia antes dela. O primeiro jogo de um modo cria o recorde
 * (não o bate); igualar não conta como bater.
 */
export function compareToBest(previous: number | undefined, now: number): Comparison {
  if (previous === undefined || previous <= 0) return { verdict: 'first', best: now, diff: 0 };
  if (now > previous) return { verdict: 'record', best: now, diff: now - previous };
  if (now === previous) return { verdict: 'tie', best: previous, diff: 0 };
  return { verdict: 'below', best: previous, diff: previous - now };
}

/** Valor para mostrar: "28.4" nos pontos, "7" nas contagens (rodadas e passos). */
export function scoreValue(game: string, mode: string, tenths: number): string {
  return countUnit(game, mode) ? String(Math.round(tenths / 10)) : (tenths / 10).toFixed(1);
}

/** Unidade ao lado do valor: "/30" nos pontos, "rodadas" ou "passos" nas contagens. */
export function scoreUnit(game: string, mode: string): string {
  const unit = countUnit(game, mode);
  if (unit) return unit;
  const max = modeMax(game, mode);
  return max ? `/${max}` : 'pts';
}

/**
 * Larguras (0 a 100) da nota e do recorde na barra de comparação. Nos modos com máximo, a barra
 * vai até ele; nas contagens (sem máximo) vai um pouco além do maior valor, para sobrar espaço.
 */
export function meterPercents(
  game: string,
  mode: string,
  now: number,
  best: number,
): { now: number; best: number } {
  const known = countUnit(game, mode) ? undefined : modeMax(game, mode);
  const top = (known ?? Math.max(now, best, 10) * 1.2) * (known ? 10 : 1);
  const pct = (v: number) => Math.max(0, Math.min(100, Math.round((v / top) * 100)));
  return { now: pct(now), best: pct(best) };
}

/** Frase do veredito, na linguagem do jogo ("pontos" ou "rodadas"/"passos"). */
export function verdictText(game: string, mode: string, c: Comparison): string {
  const unit = countUnit(game, mode);
  const gap = unit
    ? `${Math.max(1, Math.round(c.diff / 10))} ${unit === 'rodadas' ? 'rodada(s)' : unit === 'passos' ? 'passo(s)' : 'ponto(s)'}`
    : `${(c.diff / 10).toFixed(1)} ponto${c.diff === 10 ? '' : 's'}`;
  switch (c.verdict) {
    case 'first':
      return 'Primeira partida neste modo: o seu recorde começa aqui.';
    case 'record':
      return `Novo recorde: ${gap} acima do anterior.`;
    case 'tie':
      return 'Igualou o seu recorde. Mais um pouco e ele cai.';
    case 'below':
      return `Faltaram ${gap} para bater o seu recorde.`;
  }
}
