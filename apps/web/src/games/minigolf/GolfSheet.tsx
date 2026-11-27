import { golfParOf, golfScoreName, type GolfScoreName } from '@nocap/games';
import { at, type GolfRoomState, type RoomSnapshot } from '@/lib/rooms';
import './minigolf.css';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const nameOf = (id: string, username: string) => (id.startsWith('guest:') ? username : at(username));
const nameClass = (n: GolfScoreName) => (n === 'ace' ? 'mg-ace' : n === 'albatross' || n === 'eagle' ? 'mg-eagle' : n === 'birdie' ? 'mg-ok' : n === 'par' ? '' : 'mg-calm');

/** O placar em tabela do Mini Golf em sala: uma coluna por buraco, o par embaixo do número, ordenado por total. `hole` destaca o buraco atual (null no fim da partida). */
export function GolfSheet({ info, members, me, hole }: { info: GolfRoomState; members: RoomSnapshot['members']; me: string; hole: number | null }) {
  const ranked = [...members].sort((a, b) => (info.totals[a.id] ?? 0) - (info.totals[b.id] ?? 0));
  return (
    <div className="mg-sheet" data-testid="golf-sheet">
      <table>
        <thead>
          <tr>
            <th className="mg-sheet-name">Buraco</th>
            {info.levels.map((lv, k) => (
              <th key={k} className={k === hole ? 'now' : ''}>{k + 1}</th>
            ))}
            <th className="mg-sheet-total">Total</th>
          </tr>
          <tr className="mg-sheet-par">
            <th className="mg-sheet-name">Par</th>
            {info.levels.map((lv, k) => (
              <th key={k} className={k === hole ? 'now' : ''}>{info.results[k]?.par ?? golfParOf(lv)}</th>
            ))}
            <th className="mg-sheet-total">{info.levels.reduce((n, lv, k) => n + (info.results[k]?.par ?? golfParOf(lv)), 0)}</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((m, i) => (
            <tr key={m.id} className={m.id === me ? 'me' : ''}>
              <td className="mg-sheet-name">
                <span className="mg-num">{i + 1}</span>
                <span className="mg-lobby-ball" style={{ background: hex(info.looks[m.id]?.color ?? 0xffc83d) }} aria-hidden="true" />
                <span className="mg-lobby-name">{nameOf(m.id, m.username)}</span>
              </td>
              {info.levels.map((lv, k) => {
                const r = info.results[k];
                const row = r?.rows[m.id];
                if (row) {
                  const n = golfScoreName(row.s, r!.par, row.h);
                  return <td key={k} className={`mg-cell ${nameClass(n)}`}>{row.h ? row.s : 'X'}</td>;
                }
                // o buraco em andamento mostra as tacadas de agora, apagadas, até fechar
                const live = k === hole && !r && info.stage === 'play' ? info.strokes[m.id] : 0;
                return <td key={k} className="mg-cell mg-mut">{live ? live : ''}</td>;
              })}
              <td className="mg-sheet-total">{info.totals[m.id] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
