import { useRef, useState, type CSSProperties } from 'react';
import { Countdown } from '@/components/Countdown';
import {
  sendRoom,
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

const COLOR_VAR: Record<PartyShapeItem['color'], string> = {
  orange: 'var(--orange)',
  blue: 'var(--blue)',
  yellow: 'var(--yellow)',
  green: 'var(--green)',
};
/** Cada cor tem também um padrão e uma letra: a regra nunca depende só de enxergar a cor. */
const COLOR_LETTER: Record<PartyShapeItem['color'], string> = {
  orange: 'L',
  blue: 'A',
  yellow: 'M',
  green: 'V',
};
const POINTS = { good: 100, bad: -150, neutral: -50 } as const;

/** Caça-Formas: peças aparecem e somem; clique nas certas e evite as proibidas. */
export function BigShapes({ p }: Props) {
  const times = p.times!;
  const items = p.shapes?.items ?? [];
  const now = useServerNow(60);
  const clicked = useRef(new Set<number>());
  const [flash, setFlash] = useState<{ id: number; cls: PartyShapeItem['cls'] } | null>(null);
  const [score, setScore] = useState(0);
  const elapsed = now - times.showAt;

  const click = (item: PartyShapeItem) => {
    if (clicked.current.has(item.id)) return;
    clicked.current.add(item.id);
    sendRoom('sclick', { id: item.id });
    // O servidor decide; aqui só se mostra na hora o que a pessoa acabou de fazer.
    setScore((s) => s + POINTS[item.cls]);
    setFlash({ id: item.id, cls: item.cls });
    if (item.cls === 'good') sfx.ecoPad(item.id % 4, 90);
    else {
      sfx.ecoWrong();
      buzz(60);
    }
    window.setTimeout(() => setFlash((f) => (f?.id === item.id ? null : f)), 260);
  };

  return (
    <>
      <CommandBar text={p.command ?? ''} />
      <div className="mono pshape-bar">
        <Countdown
          endsAt={toLocal(times.endsAt)}
          totalMs={times.endsAt - times.showAt}
          warnMs={5000}
          compact
        />
        <b>{score} PTS</b>
      </div>
      <div className={`pshape-area${flash?.cls === 'bad' ? ' red' : ''}`}>
        {elapsed < 0 && <Big title="PREPARE" />}
        {items
          .filter((i) => elapsed >= i.at && elapsed <= i.at + i.life && !clicked.current.has(i.id))
          .map((i) => (
            <button
              key={i.id}
              type="button"
              className={`pshape ${i.kind} ${i.color}`}
              style={
                {
                  left: `${i.x}%`,
                  top: `${i.y}%`,
                  '--c': COLOR_VAR[i.color],
                } as CSSProperties
              }
              aria-label={`${i.kind} ${i.color}`}
              onPointerDown={(e) => {
                e.preventDefault();
                click(i);
              }}
            >
              <span className="mono">{COLOR_LETTER[i.color]}</span>
            </button>
          ))}
      </div>
      <p className="mono rm-hint">L = laranja · A = azul · M = amarela · V = verde</p>
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
