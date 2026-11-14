import { useNavigate } from '@tanstack/react-router';
import { closeRoom, leaveRoom, sendRoom, useMeId, useRoom, at, type RoomSnapshot } from '@/lib/rooms';
import { GOLF_SCORE_LABEL, golfScoreName } from '@nocap/games';
import { RematchBoard } from '@/components/final/RematchBoard';
import { useTouchGuard } from '../foxgp/touch-guard';
import './minigolf.css';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const nameOf = (id: string, username: string) => (id.startsWith('guest:') ? username : at(username));

/** Pódio do Mini Golf em sala: os três primeiros em degraus, o resto em lista, o resumo e a votação de revanche. */
export function GolfRoomFinal({ snapshot }: { snapshot: RoomSnapshot }) {
  useTouchGuard();
  const me = useMeId();
  const navigate = useNavigate();
  const message = useRoom((s) => s.message);
  const info = snapshot.golf;
  const rows = [...(snapshot.final ?? [])].sort((a, b) => a.placement - b.placement);
  const mine = snapshot.members.find((m) => m.id === me);
  const looks = info?.looks ?? {};
  const results = info?.results ?? [];
  const stat = (id: string) => {
    let aces = 0, eagles = 0, fails = 0;
    for (const r of results) {
      const row = r.rows[id];
      if (!row) continue;
      const n = golfScoreName(row.s, r.par, row.h);
      if (n === 'ace') aces++;
      else if (n === 'eagle' || n === 'albatross') eagles++;
      else if (n === 'fail') fails++;
    }
    return { aces, eagles, fails };
  };
  const top = rows.slice(0, 3);
  const order = top.length === 3 ? [top[1]!, top[0]!, top[2]!] : top.length === 2 ? [top[1]!, top[0]!] : top;
  const leave = () => void navigate({ to: '/minigolf' }).then(() => leaveRoom());
  const winner = rows[0];

  return (
    <div className="mgh mg-podium" data-testid="golf-final">
      <div className="mgh-wrap">
        <div className="mgh-top">
          <div>
            <div className="mg-kick">Fim de partida · {results.length} {results.length === 1 ? 'buraco' : 'buracos'}</div>
            <h1 className="mg-disp mgh-h">Campeão: <span className="mg-ace">{winner ? nameOf(winner.userId, winner.username) : ''}</span></h1>
          </div>
        </div>
        <div className="mg-steps" aria-label="Pódio">
          {order.map((r) => {
            const first = r.placement === 1;
            const st = stat(r.userId);
            return (
              <div key={r.userId} className={`mg-step${first ? ' first' : ''}`} style={{ height: first ? 300 : r.placement === 2 ? 230 : 170 }}>
                <span className="mg-podium-ball" style={{ background: hex(looks[r.userId]?.color ?? 0xffc83d) }} aria-hidden="true" />
                <b className="mg-podium-name">{nameOf(r.userId, r.username)}{r.userId === me ? ' (você)' : ''}</b>
                <span className="mg-disp mg-podium-pos">{r.placement}</span>
                <span className="mg-podium-det">{r.totalTenths} tacadas{st.aces ? ` · ${st.aces} ACE` : ''}{st.eagles ? ` · ${st.eagles} Eagle` : ''}</span>
              </div>
            );
          })}
        </div>
        {rows.length > 3 && (
          <div className="mg-rest">
            {rows.slice(3).map((r) => (
              <div key={r.userId} className="mg-restrow">
                <span className="mg-num">{r.placement}</span>
                <span className="mg-lobby-ball" style={{ background: hex(looks[r.userId]?.color ?? 0xffc83d) }} aria-hidden="true" />
                <span className="mg-lobby-name">{nameOf(r.userId, r.username)}</span>
                <span className="mono">{r.totalTenths} tacadas</span>
              </div>
            ))}
          </div>
        )}
        {message && <p className="mgh-mut" role="alert">{message}</p>}
        <RematchBoard
          players={snapshot.members.map((m) => ({
            id: m.id,
            name: nameOf(m.id, m.username),
            connected: m.connected,
            rematch: m.rematch,
            me: m.id === me,
            avatar: <span className="mg-podium-ball" style={{ background: hex(looks[m.id]?.color ?? 0xffc83d), width: 44, height: 44 }} />,
          }))}
        />
        <div className="mgh-save">
          <button type="button" className={`mg-pill${mine?.rematch ? '' : ' pri'}`} onClick={() => sendRoom('vote', { again: !mine?.rematch })} data-testid="golf-again">
            {mine?.rematch ? 'Cancelar revanche' : 'Jogar de novo'}
          </button>
          <button type="button" className="mg-pill ghost" onClick={leave}>Sair</button>
          {mine?.isHost && <button type="button" className="mg-pill ghost" onClick={() => closeRoom()}>Fechar a sala</button>}
        </div>
        <p className="mgh-mut mg-podium-note">{rows.length > 0 ? `${GOLF_SCORE_LABEL.ace}: 1 tacada · menos tacadas ganha.` : ''}</p>
      </div>
    </div>
  );
}
