import { toggleMute, useMuted } from '@/lib/sfx';
import { Speaker } from './icons';

export function MuteButton() {
  const muted = useMuted();
  return (
    <button
      type="button"
      className="chip"
      aria-label={muted ? 'Ligar som' : 'Desligar som'}
      aria-pressed={muted}
      onClick={toggleMute}
    >
      <Speaker off={muted} />
    </button>
  );
}
