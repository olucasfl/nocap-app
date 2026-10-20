import type { CSSProperties } from 'react';
import './streak-flame.css';

/** Faixas de sequência: cada uma troca as cores do fogo (2-5, 6-15, 16-30, 31-60, 61+). */
export const flameTier = (days: number): 1 | 2 | 3 | 4 | 5 =>
  days >= 61 ? 5 : days >= 31 ? 4 : days >= 16 ? 3 : days >= 6 ? 2 : 1;

/** Uma língua de fogo de desenho animado: contorno, miolo e brasa, com a ponta curvada. */
const OUTER = 'M20 59C6 59 1 45 9 33C13 27 11 19 17 5C19 13 25 15 27 23C29 19 31 17 32 11C40 24 41 37 35 47C32 55 27 59 20 59Z';
const MID = 'M20 58C10 58 6 47 12 38C15 33 14 27 18 18C20 24 25 26 27 32C29 30 30 28 31 25C36 35 35 45 31 51C28 56 25 58 20 58Z';
const CORE = 'M20 57C14 57 11 50 15 44C17 41 17 37 20 32C22 37 26 39 26 45C26 52 24 57 20 57Z';

/** [posição % no topo, largura px, altura px, atraso s, duração s] */
const TOP: [number, number, number, number, number][] = [
  [5, 26, 36, 0, 0.9],
  [17, 30, 48, 0.25, 1.1],
  [29, 28, 40, 0.5, 0.85],
  [41, 32, 56, 0.1, 1.2],
  [53, 28, 42, 0.6, 0.95],
  [65, 32, 52, 0.3, 1.05],
  [77, 28, 40, 0.7, 0.9],
  [89, 30, 46, 0.15, 1.15],
];

function Tongue({ w, h, delay, dur, style }: { w: number; h: number; delay: number; dur: number; style: CSSProperties }) {
  return (
    <svg
      className="sf-t"
      viewBox="0 0 40 60"
      preserveAspectRatio="none"
      style={{ width: w, height: h, animationDelay: `${-delay}s`, animationDuration: `${dur}s`, ...style }}
    >
      <path className="sf-o" d={OUTER} />
      <path className="sf-m" d={MID} />
      <path className="sf-c" d={CORE} style={{ animationDelay: `${-delay * 0.7}s` }} />
    </svg>
  );
}

/**
 * Fogo de desenho animado em volta do cilindro da sequência de dias (o pai precisa ser `position: relative`).
 * Só formas SVG animadas por CSS (transform e opacity); a cor muda com a faixa de dias.
 */
export function StreakFlame({ days }: { days: number }) {
  return (
    <span className={`sf sf-t${flameTier(days)}`} aria-hidden="true">
      <span className="sf-glow" />
      {TOP.map(([x, w, h, d, s]) => (
        <Tongue key={x} w={w} h={h} delay={d} dur={s} style={{ left: `calc(${x}% - ${w / 2}px)`, bottom: 'calc(100% - 9px)' }} />
      ))}
      <Tongue w={22} h={30} delay={0.2} dur={0.8} style={{ left: -11, bottom: 6, rotate: '-52deg' }} />
      <Tongue w={22} h={30} delay={0.5} dur={0.9} style={{ right: -11, bottom: 6, rotate: '52deg' }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className="sf-spark" style={{ left: `${14 + i * 18}%`, animationDelay: `${-i * 0.55}s` }} />
      ))}
    </span>
  );
}
