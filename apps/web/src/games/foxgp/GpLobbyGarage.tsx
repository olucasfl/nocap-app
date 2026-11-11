import { useEffect, useRef, useState } from 'react';
import { sendRoom, sendRoomQuiet, type RoomSnapshot } from '@/lib/rooms';
import { GpGarage } from './GpGarage';
import { hexNum } from './format';
import { hex6, loadGarage, paintForRoom } from './garage';
import './theme.css';

/**
 * No lobby do Fox GP: manda a pintura da sua garagem para a sala (os outros veem o seu carro) e mostra o botão Garagem,
 * que muda a cor do pelo e a pintura e manda de novo.
 */
export function GpLobbyGarage({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const [open, setOpen] = useState(false);
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !me) return;
    sent.current = true;
    const g = loadGarage();
    sendRoomQuiet('gpaint', paintForRoom(g.paint));
    // a cor do pelo da garagem, se estiver livre na sala
    const colors = snapshot.foxgp?.colors ?? {};
    const taken = Object.entries(colors).some(([id, hex]) => id !== me && hex === hex6(g.fur));
    if (!taken && colors[me] !== hex6(g.fur)) sendRoomQuiet('color', { hex: hex6(g.fur) });
  }, [me, snapshot.foxgp?.colors]);
  const taken = Object.entries(snapshot.foxgp?.colors ?? {})
    .filter(([id]) => id !== me)
    .map(([, hex]) => hexNum(hex));
  return (
    <>
      <button type="button" className="gp-tbtn is-primary gp-lobby-garage" onClick={() => setOpen(true)} data-testid="gp-lobby-garage">
        Garagem
      </button>
      {open && (
        <GpGarage
          takenFurs={taken}
          onClose={() => setOpen(false)}
          onSave={(g) => {
            sendRoom('gpaint', paintForRoom(g.paint));
            sendRoom('color', { hex: hex6(g.fur) });
          }}
        />
      )}
    </>
  );
}
