import type { CSSProperties, ReactNode } from 'react';
import type { AstroId } from './astros';

/** Regiões dos colapsos 0 a 5 (spec 038, seção 5.4). As demais chegam com v1.1 e v1.2. */
export const REGION_IDS = [0, 1, 2, 3, 4, 5] as const;
export type RegionId = (typeof REGION_IDS)[number];

export type RegionInfo = {
  id: RegionId;
  name: string;
  /** Cor do brilho do botão nesta região. */
  buttonGlow: string;
};

export const REGIONS: Record<RegionId, RegionInfo> = {
  0: { id: 0, name: 'Sistema Solar interno', buttonGlow: '#5ce1ff' },
  1: { id: 1, name: 'Cinturão de Asteroides', buttonGlow: '#ffb86b' },
  2: { id: 2, name: 'Júpiter e Saturno', buttonGlow: '#ffd98a' },
  3: { id: 3, name: 'Cinturão de Kuiper', buttonGlow: '#9fe0ff' },
  4: { id: 4, name: 'Nuvem de Oort', buttonGlow: '#c3a6ff' },
  5: { id: 5, name: 'Alfa Centauro', buttonGlow: '#ffd45a' },
};

type Props = {
  region: RegionId;
  /** Pausa as camadas (aba escondida, aparelho fraco). */
  paused?: boolean;
  className?: string;
};

type LayerVars = CSSProperties & { '--dx': string; '--dy': string; '--dur': string };

/** Astro do sprite posicionado pelo centro, em coordenadas do viewBox 1000x1000. */
function Orb({ art, x, y, r, o = 1 }: { art: AstroId; x: number; y: number; r: number; o?: number }) {
  return <use href={`#ap-art-${art}`} x={x - r} y={y - r} width={r * 2} height={r * 2} opacity={o} />;
}

function Layer({ depth, dx, dy, dur, children }: { depth: 'mid' | 'near'; dx: number; dy: number; dur: number; children: ReactNode }) {
  const style: LayerVars = { '--dx': `${dx}px`, '--dy': `${dy}px`, '--dur': `${dur}s` };
  return (
    <div className={`ap-layer ap-layer--${depth}`} style={style}>
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
        {children}
      </svg>
    </div>
  );
}

/** Pontos de uma faixa de rochas/gelo/bolhas, sem aleatoriedade (o render é estável). */
function scatter(n: number, seed: number) {
  const out: { x: number; y: number; k: number }[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const x = 40 + (s / 4294967296) * 920;
    s = (s * 1664525 + 1013904223) % 4294967296;
    const y = 40 + (s / 4294967296) * 920;
    s = (s * 1664525 + 1013904223) % 4294967296;
    out.push({ x, y, k: s / 4294967296 });
  }
  return out;
}

function Layers({ region }: { region: RegionId }) {
  switch (region) {
    case 0:
      return (
        <>
          <Layer depth="mid" dx={-26} dy={14} dur={90}>
            <circle cx="60" cy="70" r="260" fill="url(#ap-g-sun-y)" opacity=".55" />
            <ellipse cx="60" cy="70" rx="330" ry="170" fill="none" stroke="#7fa0ff" strokeWidth="2" opacity=".25" />
            <ellipse cx="60" cy="70" rx="560" ry="310" fill="none" stroke="#7fa0ff" strokeWidth="2" opacity=".2" />
            <ellipse cx="60" cy="70" rx="800" ry="470" fill="none" stroke="#7fa0ff" strokeWidth="2" opacity=".15" />
            <Orb art="mercury" x={250} y={150} r={22} />
            <Orb art="venus" x={480} y={290} r={34} />
            <Orb art="mars" x={820} y={420} r={28} />
          </Layer>
          <Layer depth="near" dx={34} dy={-18} dur={70}>
            <Orb art="moon" x={170} y={800} r={70} />
            <Orb art="mars" x={900} y={860} r={46} o={0.9} />
          </Layer>
        </>
      );
    case 1:
      return (
        <>
          <Layer depth="mid" dx={-40} dy={10} dur={85}>
            {scatter(16, 11).map((p, i) => (
              <Orb key={i} art="rock" x={p.x} y={p.y} r={14 + p.k * 20} o={0.55} />
            ))}
          </Layer>
          <Layer depth="near" dx={46} dy={-22} dur={60}>
            {scatter(6, 77).map((p, i) => (
              <Orb key={i} art="rock" x={p.x} y={p.y} r={34 + p.k * 40} o={0.9} />
            ))}
          </Layer>
        </>
      );
    case 2:
      return (
        <>
          <Layer depth="mid" dx={-22} dy={16} dur={100}>
            <Orb art="jupiter" x={170} y={820} r={330} />
            <Orb art="saturn" x={820} y={190} r={170} />
          </Layer>
          <Layer depth="near" dx={40} dy={-14} dur={64}>
            <circle cx="620" cy="620" r="12" fill="#f2d070" />
            <circle cx="660" cy="640" r="8" fill="#e8e0d0" />
            <circle cx="500" cy="720" r="10" fill="#c9b8a0" />
            <circle cx="300" cy="360" r="6" fill="#fff" opacity=".8" />
          </Layer>
        </>
      );
    case 3:
      return (
        <>
          <Layer depth="mid" dx={-32} dy={12} dur={95}>
            <ellipse cx="500" cy="500" rx="560" ry="150" fill="none" stroke="#9fe0ff" strokeWidth="26" strokeDasharray="2 18" strokeLinecap="round" opacity=".35" />
            <Orb art="ice" x={780} y={260} r={26} o={0.8} />
            <circle cx="780" cy="260" r="44" fill="none" stroke="#9fe0ff" strokeWidth="1.5" opacity=".3" />
            {scatter(10, 5).map((p, i) => (
              <Orb key={i} art="ice" x={p.x} y={p.y} r={10 + p.k * 14} o={0.55} />
            ))}
          </Layer>
          <Layer depth="near" dx={38} dy={-20} dur={62}>
            {scatter(5, 91).map((p, i) => (
              <Orb key={i} art="ice" x={p.x} y={p.y} r={30 + p.k * 36} o={0.85} />
            ))}
          </Layer>
        </>
      );
    case 4:
      return (
        <>
          <Layer depth="mid" dx={-24} dy={18} dur={110}>
            <circle cx="500" cy="120" r="14" fill="#fff6d0" />
            <circle cx="500" cy="120" r="46" fill="url(#ap-g-sun-y)" opacity=".5" />
            {scatter(14, 23).map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={12 + p.k * 22} fill="url(#ap-g-bubble)" stroke="#cdb8ff" strokeWidth="1.5" opacity=".6" />
            ))}
          </Layer>
          <Layer depth="near" dx={36} dy={-24} dur={68}>
            {scatter(6, 58).map((p, i) => (
              <g key={i} opacity=".85">
                <circle cx={p.x} cy={p.y} r={40 + p.k * 50} fill="url(#ap-g-bubble)" stroke="#e6dcff" strokeWidth="2.5" />
                <ellipse cx={p.x - 16} cy={p.y - 18} rx="10" ry="6" fill="#fff" opacity=".45" />
              </g>
            ))}
          </Layer>
        </>
      );
    case 5:
      return (
        <>
          <Layer depth="mid" dx={-20} dy={12} dur={100}>
            <circle cx="360" cy="360" r="190" fill="url(#ap-g-sun-y)" />
            <circle cx="620" cy="450" r="140" fill="url(#ap-g-sun-o)" />
            <circle cx="360" cy="360" r="60" fill="#fffbe0" />
            <circle cx="620" cy="450" r="44" fill="#fff0d0" />
          </Layer>
          <Layer depth="near" dx={32} dy={-16} dur={64}>
            <circle cx="800" cy="720" r="70" fill="url(#ap-g-sun-r)" />
            <circle cx="800" cy="720" r="20" fill="#ffd0c0" />
            <ellipse cx="800" cy="720" rx="150" ry="46" fill="none" stroke="#ffb09a" strokeWidth="2" opacity=".35" />
            <Orb art="mars" x={690} y={760} r={32} />
          </Layer>
        </>
      );
  }
}

/** Fundo da região atual: céu, estrelas e 2 camadas de decoração que só se movem em transform. */
export function RegionBackdrop({ region, paused = false, className }: Props) {
  return (
    <div
      className={`ap-region ap-region--${region}${paused ? ' is-paused' : ''}${className ? ` ${className}` : ''}`}
      data-region={region}
      aria-hidden="true"
    >
      <div className="ap-region-glow ap-region-glow--a" />
      <div className="ap-region-glow ap-region-glow--b" />
      <div className="ap-stars ap-stars--1" />
      <div className="ap-stars ap-stars--2" />
      <Layers region={region} />
    </div>
  );
}
