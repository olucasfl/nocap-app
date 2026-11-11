/** Contas puras da tela do Fox GP (com teste). */

/** Tempo de volta em "m:ss.mmm" (ex.: 41234 → "0:41.234"). */
export function lapClock(ms: number): string {
  const v = Math.max(0, Math.round(ms));
  const m = Math.floor(v / 60_000);
  const s = Math.floor((v % 60_000) / 1000);
  const r = v % 1000;
  return `${m}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
}

/** Tempo de corrida curto em "m:ss.d" (ex.: 62300 → "1:02.3"). */
export function raceClock(ms: number): string {
  const v = Math.max(0, Math.floor(ms / 100));
  const m = Math.floor(v / 600);
  const s = Math.floor((v % 600) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${v % 10}`;
}

/** Diferença para o líder: "+1.234" (segundos com milésimos); null vira "—". */
export function gapText(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec)) return '—';
  return `+${sec.toFixed(sec >= 10 ? 1 : 3)}`;
}

/** Cor css a partir do número da cor do pelo. */
export const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Cor do número em hex "#ff7d26" para número. */
export const hexNum = (hex: string | undefined, fallback = 0xff7d26) => {
  const n = Number.parseInt((hex ?? '').replace('#', ''), 16);
  return Number.isFinite(n) ? n : fallback;
};

/** O pelo é azulado? Então o boné é laranja (a mesma regra do `buildHero`). */
export function bluish(color: number): boolean {
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return false;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return h > 0.5 && h < 0.8;
}
