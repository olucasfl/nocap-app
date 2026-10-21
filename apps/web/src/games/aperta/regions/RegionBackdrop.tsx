import type { CSSProperties } from 'react';
import { regionArt, type RegionLayer, type RegionNode } from './regions';

type Props = {
  /** Id da região no catálogo do motor (`REGIONS`). */
  region: string;
  /** Pausa as camadas (aba escondida, aparelho fraco). */
  paused?: boolean;
  className?: string;
};

type LayerVars = CSSProperties & { '--dx': string; '--dy': string; '--dur': string };
type SkyVars = CSSProperties & Record<'--ap-sky-a' | '--ap-sky-b' | '--ap-sky-c' | '--ap-glow-a' | '--ap-glow-b', string>;

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

function Node({ node }: { node: RegionNode }) {
  switch (node.t) {
    case 'orb': {
      const { art, x, y, r, o = 1 } = node;
      return <use href={`#ap-art-${art}`} x={x - r} y={y - r} width={r * 2} height={r * 2} opacity={o} />;
    }
    case 'circle':
      return <circle cx={node.cx} cy={node.cy} r={node.r} fill={node.fill} opacity={node.o} stroke={node.stroke} strokeWidth={node.sw} />;
    case 'ellipse':
      return (
        <ellipse
          cx={node.cx}
          cy={node.cy}
          rx={node.rx}
          ry={node.ry}
          fill="none"
          stroke={node.stroke}
          strokeWidth={node.sw}
          strokeDasharray={node.dash}
          strokeLinecap={node.dash ? 'round' : undefined}
          opacity={node.o}
        />
      );
    case 'scatter':
      return (
        <>
          {scatter(node.n, node.seed).map((p, i) => {
            const r = node.r[0] + p.k * node.r[1];
            return <use key={i} href={`#ap-art-${node.art}`} x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} opacity={node.o} />;
          })}
        </>
      );
    case 'bubbles':
      return (
        <>
          {scatter(node.n, node.seed).map((p, i) => {
            const r = node.r[0] + p.k * node.r[1];
            return (
              <g key={i} opacity={node.o}>
                <circle cx={p.x} cy={p.y} r={r} fill="url(#ap-g-bubble)" stroke={node.stroke} strokeWidth={node.sw} />
                {node.shine && <ellipse cx={p.x - 16} cy={p.y - 18} rx="10" ry="6" fill="#fff" opacity=".45" />}
              </g>
            );
          })}
        </>
      );
  }
}

function Layer({ layer }: { layer: RegionLayer }) {
  const style: LayerVars = { '--dx': `${layer.dx}px`, '--dy': `${layer.dy}px`, '--dur': `${layer.dur}s` };
  return (
    <div className={`ap-layer ap-layer--${layer.depth}`} style={style}>
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
        {layer.nodes.map((node, i) => (
          <Node key={i} node={node} />
        ))}
      </svg>
    </div>
  );
}

/** Fundo da região: céu, estrelas e 2 camadas de decoração que só se movem em transform (tudo vem de `regions.ts`). */
export function RegionBackdrop({ region, paused = false, className }: Props) {
  const art = regionArt(region);
  const style: SkyVars = {
    '--ap-sky-a': art.sky.a,
    '--ap-sky-b': art.sky.b,
    '--ap-sky-c': art.sky.c,
    '--ap-glow-a': art.sky.glowA,
    '--ap-glow-b': art.sky.glowB,
  };
  return (
    <div
      className={`ap-region ap-region--${art.id}${paused ? ' is-paused' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      data-region={art.id}
      aria-hidden="true"
    >
      <div className="ap-region-glow ap-region-glow--a" />
      <div className="ap-region-glow ap-region-glow--b" />
      <div className="ap-stars ap-stars--1" />
      <div className="ap-stars ap-stars--2" />
      {art.layers.map((layer) => (
        <Layer key={layer.depth} layer={layer} />
      ))}
    </div>
  );
}
