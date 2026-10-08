import { useEffect, useMemo, useRef, useState } from 'react';
import {
  POINTS_BAD,
  POINTS_GOOD,
  POINTS_NEUTRAL,
  SHAPES_R,
  SHAPES_W,
  ShapesSim,
} from '@nocap/games';
import { Countdown } from '@/components/Countdown';
import {
  sendRoom,
  serverNow,
  toLocal,
  type PartyShapeItem,
  type PartySnapshot,
  type RoomSnapshot,
} from '@/lib/rooms';
import { buzz, sfx } from '@/lib/sfx';
import { Big, CommandBar, useServerNow } from './common';

interface Props {
  snapshot: RoomSnapshot;
  p: PartySnapshot;
}

type Color = PartyShapeItem['color'];
type Kind = PartyShapeItem['kind'];

const COLOR_VAR: Record<Color, string> = {
  orange: 'var(--orange)',
  blue: 'var(--blue)',
  yellow: 'var(--yellow)',
  green: 'var(--green)',
  purple: 'var(--eco-purple)',
  cyan: 'var(--eco-cyan)',
};
/** Cada cor tem também um padrão e uma letra: a regra nunca depende só de enxergar a cor. */
const COLOR_LETTER: Record<Color, string> = {
  orange: 'L',
  blue: 'A',
  yellow: 'M',
  green: 'V',
  purple: 'R',
  cyan: 'C',
};
const POINTS = { good: POINTS_GOOD, bad: POINTS_BAD, neutral: POINTS_NEUTRAL } as const;

/** Desenho de cada forma numa caixa de 100 x 100. */
function Shape({ kind }: { kind: Kind }) {
  switch (kind) {
    case 'circle':
      return <circle cx="50" cy="50" r="44" />;
    case 'triangle':
      return <polygon points="50,8 94,90 6,90" />;
    case 'square':
      return <rect x="12" y="12" width="76" height="76" rx="6" />;
    case 'rect':
      // Quase quadrado de propósito (ilusão): 88 x 70.
      return <rect x="6" y="15" width="88" height="70" rx="6" />;
    case 'diamond':
      return <polygon points="50,6 94,50 50,94 6,50" />;
    case 'star':
      return <polygon points="50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38" />;
    case 'hexagon':
      return <polygon points="27,10 73,10 96,50 73,90 27,90 4,50" />;
    case 'cross':
      return (
        <polygon points="36,6 64,6 64,36 94,36 94,64 64,64 64,94 36,94 36,64 6,64 6,36 36,36" />
      );
  }
}

/** Os padrões das cores (definidos uma vez; as peças usam por referência). */
function Patterns() {
  const base = (c: Color) => <rect width="10" height="10" style={{ fill: COLOR_VAR[c] }} />;
  const line = { stroke: 'rgb(0 0 0 / 0.28)', strokeWidth: 2.6 };
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <pattern id="pt-orange" width="10" height="10" patternUnits="userSpaceOnUse">
          {base('orange')}
        </pattern>
        <pattern id="pt-blue" width="10" height="10" patternUnits="userSpaceOnUse">
          {base('blue')}
          <circle cx="5" cy="5" r="2.2" style={{ fill: 'rgb(255 255 255 / 0.6)' }} />
        </pattern>
        <pattern id="pt-yellow" width="10" height="10" patternUnits="userSpaceOnUse">
          {base('yellow')}
          <path d="M-2,2 l4,-4 M0,10 l10,-10 M8,12 l4,-4" style={line} />
        </pattern>
        <pattern id="pt-green" width="10" height="10" patternUnits="userSpaceOnUse">
          {base('green')}
          <path d="M0,5 h10 M5,0 v10" style={line} />
        </pattern>
        <pattern id="pt-purple" width="10" height="10" patternUnits="userSpaceOnUse">
          {base('purple')}
          <path d="M-2,8 l4,4 M0,0 l10,10 M8,-2 l4,4" style={line} />
        </pattern>
        <pattern id="pt-cyan" width="10" height="10" patternUnits="userSpaceOnUse">
          {base('cyan')}
          <path d="M0,3 h10 M0,8 h10" style={line} />
        </pattern>
      </defs>
    </svg>
  );
}

/**
 * Caça-Formas: as peças andam, batem umas nas outras (nunca uma por cima da outra) e somem. O
 * movimento é a mesma simulação do servidor para todos; os pontos quem decide é o servidor.
 */
export function BigShapes({ p }: Props) {
  const times = p.times!;
  const items = p.shapes?.items ?? [];
  const simSeed = p.shapes?.simSeed ?? '';
  const area = useRef<HTMLDivElement>(null);
  const clicked = useRef(new Set<number>());
  const sim = useMemo(() => new ShapesSim(items, simSeed), [items, simSeed]);
  const [, frame] = useState(0);
  const [width, setWidth] = useState(600);
  const [flash, setFlash] = useState<{ id: number; cls: PartyShapeItem['cls'] } | null>(null);
  const [score, setScore] = useState(0);

  // Um quadro por vez: avança a simulação até o instante do servidor e redesenha.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      sim.advanceTo(Math.max(0, serverNow() - times.showAt));
      if (area.current) setWidth(area.current.clientWidth);
      frame((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim, times.showAt]);

  const click = (item: PartyShapeItem) => {
    if (clicked.current.has(item.id)) return;
    clicked.current.add(item.id);
    sendRoom('sclick', { id: item.id });
    // O servidor decide; aqui só se mostra na hora o que a pessoa acabou de fazer.
    setScore((s) => s + POINTS[item.cls]);
    setFlash({ id: item.id, cls: item.cls });
    if (item.cls === 'good') sfx.ecoPad(item.id % 4, 90);
    else if (item.cls === 'bad') {
      sfx.ecoWrong();
      buzz(60);
    }
    window.setTimeout(() => setFlash((f) => (f?.id === item.id ? null : f)), 260);
  };

  const u = width / SHAPES_W;
  const size = 2 * SHAPES_R * u;
  const started = serverNow() >= times.showAt;

  return (
    <>
      <CommandBar text={p.command ?? ''} />
      <div className="mono pshape-bar">
        <Countdown
          endsAt={toLocal(times.endsAt)}
          totalMs={times.endsAt - times.showAt}
          warnMs={6000}
          beep
          compact
        />
        <b>{score} PTS</b>
      </div>
      <Patterns />
      <div ref={area} className={`pshape-area${flash?.cls === 'bad' ? ' red' : ''}`}>
        {!started && <Big title="PREPARE" />}
        {sim.pieces
          .filter((piece) => !clicked.current.has(piece.id))
          .map((piece) => {
            const item = items[piece.id]!;
            return (
              <button
                key={piece.id}
                type="button"
                className="pshape"
                style={{
                  width: size,
                  height: size,
                  transform: `translate(${(piece.x - SHAPES_R) * u}px, ${(piece.y - SHAPES_R) * u}px)`,
                }}
                aria-label={`${item.kind} ${item.color}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  click(item);
                }}
              >
                <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
                  <g
                    style={{
                      fill: `url(#pt-${item.color})`,
                      stroke: 'var(--ink)',
                      strokeWidth: 5,
                      strokeLinejoin: 'round',
                    }}
                  >
                    <Shape kind={item.kind} />
                  </g>
                  <text
                    x="50"
                    y="60"
                    textAnchor="middle"
                    style={{
                      fontSize: 30,
                      fontWeight: 800,
                      fill: 'var(--ink)',
                      stroke: '#fff',
                      strokeWidth: 5,
                      paintOrder: 'stroke',
                    }}
                  >
                    {COLOR_LETTER[item.color]}
                  </text>
                </svg>
              </button>
            );
          })}
      </div>
      <p className="mono rm-hint">
        L laranja · A azul · M amarela · V verde · R roxa · C ciano. As peças batem umas nas outras.
      </p>
    </>
  );
}

const ms = (v: number | null) => (v === null ? '--' : `${v} ms`);

/** Arena X1: um duelo de reflexo por vez, contra outra pessoa (ou o Bot NoCap). */
export function BigX1({ snapshot, p }: Props) {
  const times = p.times!;
  const x1 = p.x1;
  const now = useServerNow(80);
  const fired = useRef(0);

  if (!x1) {
    return <Big title="AGUARDE" sub="VOCÊ NÃO ENTROU EM NENHUM DUELO" />;
  }
  const lead = x1.lead > 0 ? `+${x1.lead}` : String(x1.lead);

  if (x1.state === 'done') {
    const text = x1.result === 'win' ? 'VITÓRIA' : x1.result === 'loss' ? 'DERROTA' : 'EMPATE';
    return (
      <>
        <CommandBar text={p.command ?? ''} />
        <Big
          title={text}
          sub={`CONTRA ${x1.opponent.toUpperCase()} · ESPERANDO OS OUTROS DUELOS (${x1.finished} DE ${x1.duels})`}
        />
      </>
    );
  }

  const click = () => {
    // Um clique por disparo; antes de o botão aparecer o servidor conta largada falsa.
    if (Date.now() - fired.current < 300) return;
    fired.current = Date.now();
    sendRoom('xclick');
    buzz(10);
  };

  return (
    <>
      <CommandBar text={p.command ?? ''} />
      <div className="mono phud">
        <span>VOCÊ × {x1.opponent.toUpperCase()}</span>
        <b>PLACAR {lead}</b>
        <span>DISPARO {x1.round + 1}</span>
      </div>
      <div
        className={`px1-area ${x1.state}`}
        onPointerDown={(e) => {
          // Fora do botão: se ainda não apareceu, é largada falsa (o servidor decide).
          if (x1.state === 'wait' && e.target === e.currentTarget) click();
        }}
      >
        {x1.state === 'wait' && (
          <Big
            title={now < times.showAt ? 'PREPARE' : 'ESPERE'}
            sub="NÃO CLIQUE ANTES DE O BOTÃO VERDE APARECER"
          />
        )}
        {x1.state === 'between' && x1.last && (
          <Big
            title={
              x1.last.early === 'me'
                ? 'LARGADA FALSA'
                : x1.last.early === 'them'
                  ? 'O ADVERSÁRIO SE ADIANTOU'
                  : x1.last.won === null
                    ? 'NINGUÉM CLICOU'
                    : x1.last.won
                      ? 'PONTO SEU'
                      : 'PONTO DELE'
            }
            sub={
              x1.last.early
                ? undefined
                : `VOCÊ (${ms(x1.last.mine)}) VS (${ms(x1.last.theirs)}) ADVERSÁRIO`
            }
          />
        )}
        {x1.state === 'go' && x1.shot && (
          <button
            type="button"
            className="px1-go"
            style={{ left: `${x1.shot.x}%`, top: `${x1.shot.y}%` }}
            aria-label="Clique agora"
            onPointerDown={(e) => {
              e.preventDefault();
              click();
            }}
          >
            JÁ!
          </button>
        )}
      </div>
      <p className="mono rm-hint">
        Vence quem abrir 3 pontos de diferença. {snapshot.members.length} jogadores na arena.
      </p>
    </>
  );
}
