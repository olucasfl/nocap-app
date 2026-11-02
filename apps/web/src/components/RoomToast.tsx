import { useRoom } from '@/lib/rooms';

/** Aviso rápido por cima de qualquer tela (quem saiu da sala, sala encerrada). */
export function RoomToast() {
  const notice = useRoom((s) => s.notice);
  if (!notice) return null;
  return (
    <p key={notice.id} className="rm-toast mono" role="status" data-testid="room-toast">
      {notice.text}
    </p>
  );
}
