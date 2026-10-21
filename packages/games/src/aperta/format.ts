// Formato pt-BR dos números do Aperta! (seção 7.5). Sem Intl: o resultado precisa ser igual em
// qualquer ambiente (Node, navegador, servidor), porque os testes comparam texto.

const SUFFIXES: readonly [number, string][] = [
  [1e12, 'tri'],
  [1e9, 'bi'],
  [1e6, 'mi'],
  [1e3, 'mil'],
];

/** Três algarismos significativos, vírgula decimal, sem zeros sobrando: 1,5 / 12,3 / 123. */
function sig3(x: number): string {
  const digits = x >= 100 ? 0 : x >= 10 ? 1 : 2;
  const fixed = x.toFixed(digits);
  const trimmed = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return trimmed.replace('.', ',');
}

/**
 * Número do jogo: até 999 inteiro; depois "1,5 mil", "2 mi", "3,2 bi", "4 tri" e, a partir de
 * 1e15, notação científica ("1,5e15"). Valor inválido vira "0"; negativo ganha "-".
 */
export function formatNumber(value: number): string {
  if (Number.isNaN(value)) return '0';
  if (value < 0) return `-${formatNumber(-value)}`;
  if (!Number.isFinite(value)) return formatScientific(1e300);
  if (value < 1000) return String(Math.floor(value));
  if (value >= 1e15) return formatScientific(value);
  for (let i = 0; i < SUFFIXES.length; i++) {
    const [limit, suffix] = SUFFIXES[i] as [number, string];
    if (value < limit) continue;
    const scaled = value / limit;
    // 999,9 mil arredondaria para "1000 mil"; promove para a unidade de cima.
    if (scaled >= 999.5) {
      const higher = SUFFIXES[i - 1];
      return higher ? `1 ${higher[1]}` : formatScientific(value);
    }
    return `${sig3(scaled)} ${suffix}`;
  }
  return formatScientific(value);
}

function formatScientific(value: number): string {
  const exp = Math.floor(Math.log10(value));
  const mantissa = value / Math.pow(10, exp);
  // Mantissa que arredonda para 10 passa para a próxima potência.
  if (mantissa >= 9.995) return `1e${exp + 1}`;
  return `${sig3(mantissa)}e${exp}`;
}

/** Decimal curto para energia e multiplicadores: 1,6 / 0,25 (até `digits` casas, sem zeros sobrando). */
export function formatDecimal(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '0';
  const fixed = value.toFixed(digits);
  const trimmed = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return trimmed.replace('.', ',');
}

/** Percentual sem casas quando inteiro: 25% / 12,5%. */
export function formatPercent(pct: number): string {
  return `${formatDecimal(pct, 1)}%`;
}

/** Horas de jogo: "8 h 12 min", "45 min", "30 s". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0 s';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return `${m} min`;
  return `${total} s`;
}
