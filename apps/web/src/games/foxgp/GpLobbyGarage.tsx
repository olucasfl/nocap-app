import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { sendRoom, sendRoomQuiet, type RoomSnapshot } from '@/lib/rooms';
import { GpCarPreview } from './GpCarPreview';
import { GpGarage } from './GpGarage';
import { carForRoom, carFromRoom, hex6, loadGarage } from './garage';
import './theme.css';
import './foxgp.css';

/**
 * No lobby do Fox GP (spec 081, Fase 8): cada um entra com o carro da própria garagem (sem escolher cor; cores repetidas
 * são normais). Manda o carro (pelo, F1 e kart) para a sala ao entrar e ao salvar a garagem; a sala usa o veículo do
 * modo (o líder troca a física e o veículo de todos muda sozinho).
 */
export function GpLobbyGarage({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const [open, setOpen] = useState(false);
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !me) return;
    sent.current = true;
    sendRoomQuiet('gpaint', carForRoom(loadGarage()));
  }, [me]);
  const vehicle = snapshot.foxgp?.physics === 'real' ? 'f1' : 'kart';
  return (
    <>
      <button type="button" className="gp-tbtn is-primary gp-lobby-garage" onClick={() => setOpen(true)} data-testid="gp-lobby-garage">
        Garagem
      </button>
      {open && (
        <GpGarage vehicle={vehicle} onClose={() => setOpen(false)} onSave={(g) => sendRoom('gpaint', carForRoom(g))} />
      )}
    </>
  );
}

/**
 * Os carros da sala na lista de jogadores: um selo pequeno (carroceria, detalhe e número) e "Ver carro", que abre o carro
 * 3D da pessoa numa prévia só (um renderizador por vez).
 */
export function GpRoomCars({ snapshot }: { snapshot: RoomSnapshot }) {
  const [see, setSee] = useState<string | null>(null);
  const kart = snapshot.foxgp?.physics !== 'real';
  const cars = snapshot.foxgp?.paints ?? {};
  const shown = see ? carFromRoom(cars[see]) : null;
  const who = snapshot.members.find((m) => m.id === see);
  return (
    <section className="gp-room-cars" aria-label="Os carros da sala" data-testid="gp-room-cars">
      <h3>Carros ({kart ? 'kart' : 'F1'})</h3>
      <ul>
        {snapshot.members.map((m) => {
          const car = carFromRoom(cars[m.id]);
          const body = car ? (kart ? car.kart.body : car.f1.body) : 0x3a3f4b;
          const accent = car ? (kart ? car.kart.stripe : car.f1.accent) : 0x1b1535;
          const num = car ? (kart ? car.kart.number : car.f1.number) : null;
          return (
            <li key={m.id}>
              <span className="gp-car-badge" style={{ background: hex6(body), borderColor: hex6(accent) }} aria-hidden="true">
                {num ?? '–'}
              </span>
              <span className="gp-car-name">{m.username}</span>
              <button type="button" disabled={!car} onClick={() => setSee(m.id)} data-testid={`gp-see-${m.id}`}>
                Ver carro
              </button>
            </li>
          );
        })}
      </ul>
      {(() => {
        const fill = snapshot.foxgp?.fill ?? 0;
        const n = fill === 0 ? 0 : Math.max(0, Math.min(12, fill) - snapshot.members.length);
        return n > 0 ? (
          <p className="gp-room-bots" data-testid="gp-room-bots">
            + {n} {n === 1 ? 'bot' : 'bots'} na largada
          </p>
        ) : null;
      })()}
      {see &&
        shown &&
        createPortal(
          <div className="gp-see" role="dialog" aria-modal="true" aria-label={`Carro de ${who?.username ?? ''}`} onClick={() => setSee(null)}>
            <div className="gp-see-card" onClick={(e) => e.stopPropagation()}>
              <span className="gp-kicker">{who?.username}</span>
              <GpCarPreview
                fur={shown.fur}
                paint={shown.f1}
                kart={shown.kart}
                vehicle={kart ? 'kart' : 'f1'}
                className="gp-see-car"
                label={`O carro de ${who?.username ?? ''}`}
              />
              <button type="button" className="gp-tbtn" onClick={() => setSee(null)}>
                Fechar
              </button>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
