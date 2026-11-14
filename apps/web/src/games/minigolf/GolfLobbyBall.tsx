import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { GOLF_BALL_COLOR_NAMES, GOLF_BALL_COLORS } from '@nocap/games';
import { sendRoom, type RoomSnapshot } from '@/lib/rooms';
import { GOLF_CHANGED, loadLook } from './golf-save';
import './minigolf.css';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Lobby do Mini Golf: manda a sua bola para a sala (e de novo se você a mudar) e mostra a bola de cada um. */
export function GolfLobbyBall({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const navigate = useNavigate();
  useEffect(() => {
    const send = () => sendRoom('glook', loadLook());
    send();
    window.addEventListener(GOLF_CHANGED, send);
    return () => window.removeEventListener(GOLF_CHANGED, send);
  }, []);
  const looks = snapshot.golf?.looks ?? {};
  return (
    <section className="mg-lobby" aria-label="Bolas da sala" data-testid="golf-lobby">
      <div className="mg-lobby-head">
        <h3 className="mono">Bolas da sala</h3>
        <button type="button" className="mg-pill ghost" onClick={() => void navigate({ to: '/minigolf/bola', search: { volta: 'sala' } })} data-testid="golf-customize">
          Personalizar minha bola
        </button>
      </div>
      <ul>
        {snapshot.members.map((m) => {
          const l = looks[m.id];
          const i = l ? GOLF_BALL_COLORS.indexOf(l.color as (typeof GOLF_BALL_COLORS)[number]) : -1;
          return (
            <li key={m.id}>
              <span className="mg-lobby-ball" style={{ background: hex(l?.color ?? 0xffc83d) }} aria-hidden="true" />
              <span className="mg-lobby-name">{m.username}{m.id === me ? ' (você)' : ''}</span>
              <span className="mono mg-lobby-det">{l ? `${i >= 0 ? GOLF_BALL_COLOR_NAMES[i] : 'Cor livre'} · ${l.finish}` : ''}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
