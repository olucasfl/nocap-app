import { formatDecimal, objectPreview, pinsFirstObject, type GameObject, type SaveState } from '@nocap/games';
import { useRef, type CSSProperties } from 'react';
import { SpaceObject, SPACE_OBJECT_COLOR } from './SpaceObject';
import { objectArt, objectName, rewardText, type LaneBook, type SignalView } from './game-logic';

interface Props {
  state: SaveState;
  now: number;
  paused: boolean;
  /** Vagas dos objetos (a tela de jogo guarda o livro para o anel da captura sair do mesmo lugar). */
  lanes: LaneBook;
  onCapture: (id: number) => void;
}

interface ItemProps {
  object: GameObject;
  state: SaveState;
  now: number;
  paused: boolean;
  lanes: LaneBook;
  onCapture: (id: number) => void;
}

function FieldObject({ object, state, now, paused, lanes, onCapture }: ItemProps) {
  // A barra de vida roda em CSS (transform); o atraso fixa de onde ela parte e não pode mudar depois.
  const elapsed = useRef(Math.max(0, now - object.bornAt));
  const slot = lanes.slot(object.id);
  const art = objectArt(object.kind);
  const reward = rewardText(objectPreview(state, object.kind));
  const life = object.expiresAt - object.bornAt;
  const pinned = pinsFirstObject(state);
  const style = {
    left: `${slot.x}%`,
    top: `${slot.y}%`,
    '--ob-color': SPACE_OBJECT_COLOR[art],
    '--ob-dx': `${slot.dx}px`,
    '--ob-dy': `${slot.dy}px`,
    '--ob-drift': `${slot.drift}s`,
    '--ob-life': `${life}s`,
    '--ob-elapsed': `-${elapsed.current}s`,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`ap-obj${paused ? ' is-paused' : ''}${pinned ? ' is-pinned' : ''}`}
      {...(pinned ? { 'data-tut': 'first-object' } : {})}
      style={style}
      data-kind={art}
      aria-label={`${objectName(object.kind)}: ${reward}. Capturar`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        onCapture(object.id);
      }}
      // Pointer já capturou; o clique sem posição (detail 0) vem do teclado ou de leitor de tela.
      onClick={(e) => {
        if (e.detail === 0) onCapture(object.id);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="ap-obj-drift">
        <i className="ap-obj-pulse" aria-hidden="true" />
        <SpaceObject kind={art} size={60} glow />
      </span>
      <span className="ap-obj-life" aria-hidden="true">
        <i />
      </span>
      <span className="ap-obj-tag" aria-hidden="true">
        {reward}
      </span>
    </button>
  );
}

/** Os objetos que cruzam o campo: a recompensa aparece antes de tocar (spec 038, 4.5). */
export function FieldObjects({ state, now, paused, lanes, onCapture }: Props) {
  const { objects, pending } = state.run;
  lanes.sync(objects.map((o) => o.id));
  return (
    <div className="ap-objs" role="group" aria-label="Objetos no espaço" hidden={objects.length === 0 || pending !== null}>
      {objects.map((o) => (
        <FieldObject key={o.id} object={o} state={state} now={now} paused={paused} lanes={lanes} onCapture={onCapture} />
      ))}
    </div>
  );
}

/**
 * Chip "Sinal forte" do HUD (satélite). A barra roda em CSS: o tempo que faltava na hora de montar
 * fica guardado, senão cada atualização da tela reiniciaria a animação. O chip se remonta a cada satélite novo.
 */
export function SignalChip({ signal, paused }: { signal: SignalView; paused: boolean }) {
  const total = useRef(Math.max(signal.remaining, 0.1));
  const mult = formatDecimal(signal.mult, 1);
  return (
    <div className="ap-signal" role="status" aria-label={`Sinal forte x${mult} ativo`}>
      <b>Sinal forte x{mult}</b>
      <span className="ap-signal-bar" aria-hidden="true">
        <i className={paused ? 'is-paused' : undefined} style={{ '--sg-total': `${total.current}s` } as CSSProperties} />
      </span>
    </div>
  );
}
