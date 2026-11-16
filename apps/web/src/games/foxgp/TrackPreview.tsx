import { gpTrack, gpTrackDefFor, type GpPhysicsMode } from '@nocap/games';
import { gpTrackName } from './vehicles';
import './trackpreview.css';

/** A pista que vale para a escolha de uma sala ou de um treino (Arcade com poderes: Castle Circuit; sem poderes: Bala Track). */
export function gpPreviewId(
  physics: GpPhysicsMode,
  track: string | null | undefined,
  powers: boolean,
): string {
  return gpTrackDefFor(physics, track, powers).id;
}

/**
 * Foto da pista antes de entrar (spec 086): a imagem gerada da largada, o nome, o tamanho e o estilo. Aparece na escolha
 * do treino e no lobby da sala, para o líder e para todos que entram.
 */
export function TrackPreview({
  physics,
  track,
  powers,
  compact = false,
}: {
  physics: GpPhysicsMode;
  track?: string | null;
  powers: boolean;
  compact?: boolean;
}) {
  const id = gpPreviewId(physics, track, powers);
  const def = gpTrackDefFor(physics, track, powers);
  const km = (gpTrack(def).length / 1000).toFixed(2).replace('.', ',');
  const name = gpTrackName(physics, id);
  // o desenho da pista num canto: ajuda a diferenciar pistas de cenário parecido
  const tr = gpTrack(def);
  const step = Math.max(1, Math.floor(tr.n / 120));
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < tr.n; i += step) {
    x0 = Math.min(x0, tr.x[i]!);
    x1 = Math.max(x1, tr.x[i]!);
    z0 = Math.min(z0, tr.z[i]!);
    z1 = Math.max(z1, tr.z[i]!);
  }
  const sc = 52 / Math.max(x1 - x0, z1 - z0, 1);
  const d =
    Array.from({ length: Math.ceil(tr.n / step) }, (_, k) => {
      const i = k * step;
      return `${k ? 'L' : 'M'}${(4 + (tr.x[i]! - x0) * sc).toFixed(1)} ${(4 + (tr.z[i]! - z0) * sc).toFixed(1)}`;
    }).join('') + 'Z';
  const style =
    physics === 'real'
      ? 'Realista · F1'
      : powers
        ? 'Arcade · com poderes'
        : 'Arcade · corrida pura';
  return (
    <figure
      className="gp-trackprev"
      data-compact={compact ? '1' : undefined}
      data-testid="gp-track-preview"
      data-track={id}
    >
      <img
        src={`/foxgp/preview/${id}.webp`}
        alt={`Foto da pista ${name}`}
        width={640}
        height={360}
        loading="lazy"
        decoding="async"
      />
      <svg className="gp-trackprev-map" viewBox="0 0 60 60" aria-hidden="true">
        <path d={d} fill="none" stroke="#0b0e17" strokeWidth="5" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinejoin="round" />
        <circle
          cx={4 + (tr.x[0]! - x0) * sc}
          cy={4 + (tr.z[0]! - z0) * sc}
          r="3"
          fill="#ff7d26"
          stroke="#0b0e17"
          strokeWidth="1.2"
        />
      </svg>
      <figcaption>
        <b>{name}</b>
        <span>
          {km} km · {style}
        </span>
      </figcaption>
    </figure>
  );
}
