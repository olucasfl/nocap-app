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
      <figcaption>
        <b>{name}</b>
        <span>
          {km} km · {style}
        </span>
      </figcaption>
    </figure>
  );
}
