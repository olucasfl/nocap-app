import { GuestNotice } from '@/components/GuestNotice';
import { useIsGuest } from '@/lib/auth';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  closeRoom,
  leaveRoom,
  sendRoom,
  useRoom,
  type RoomSnapshot,
  at,
  useMeId,
} from '@/lib/rooms';
import { meters, raceTime, roomColor } from '@/games/atravessa/AtravessaReveal';

/** Atravessa!: o que cada um fez. Infinito = metros somados; Checkpoint = tempo da chegada, ou a distância de quem não chegou. */
function AtravessaScore({
  info,
  id,
}: {
  info: NonNullable<RoomSnapshot['atravessa']>;
  id: string;
}) {
  const r = info.results?.[id];
  if (!r) return null;
  if (info.mode === 'infinito') return <>{meters(r.meters)}</>;
  return (
    <>
      {r.finished && r.ms !== null ? raceTime(r.ms) : meters(r.meters)}
      <small className="mono">
        {r.finished ? '' : ' · NÃO CHEGOU'}
        {r.deaths > 0 ? ` · ${r.deaths} ${r.deaths === 1 ? 'MORTE' : 'MORTES'}` : ''}
      </small>
    </>
  );
}

/**
 * Pódio da sala e votação da revanche. Todo mundo vota em "jogar de novo" ou sai; quando todos
 * que ficaram votaram, a sala volta ao lobby com as mesmas regras e o líder pode começar
 * (mudando as regras, se quiser). Os outros aguardam.
 */
export function Final({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useMeId();
  const message = useRoom((s) => s.message);
  const [closing, setClosing] = useState(false);
  const impostor =
    snapshot.game === 'impostor' || (snapshot.game === 'eco' && snapshot.mode === 'leader');
  const eco = snapshot.game === 'eco';
  const desmorona = snapshot.game === 'desmorona';
  const bola = snapshot.game === 'bola';
  const atravessa = snapshot.game === 'atravessa' ? snapshot.atravessa : undefined;
  /** Siga o Líder: no pódio entra a porcentagem (média das rodadas) e a soma de acertos; as notas de cada rodada não aparecem antes. */
  const hits = snapshot.eco?.hits;
  const max = snapshot.settings.rounds * 10;
  const mine = snapshot.members.find((m) => m.id === me);
  const voted = !!mine?.rematch;
  const guest = useIsGuest();
  const here = snapshot.members.filter((m) => m.connected);
  const votes = here.filter((m) => m.rematch).length;

  const rows = snapshot.final ?? [];
  const winner = rows[0];
  const myRow = rows.find((r) => r.userId === me);
  const nameOf = (r: { userId: string; username: string }) =>
    r.userId.startsWith('guest:') ? r.username : at(r.username);

  /** O resultado de cada um, no formato do jogo. */
  const score = (r: (typeof rows)[number]) =>
    desmorona ? (
      <small className="mono">{r.placement === 1 ? 'VENCEU' : 'CAIU'}</small>
    ) : bola ? (
      <small className="mono">
        {Math.round(r.totalTenths / 10)} {Math.round(r.totalTenths / 10) === 1 ? 'gol' : 'gols'} do
        time
      </small>
    ) : atravessa ? (
      <AtravessaScore info={atravessa} id={r.userId} />
    ) : (
      <>
        {hits || !eco ? (r.totalTenths / 10).toFixed(1) : Math.round(r.totalTenths / 10)}
        <small className="mono">
          {hits
            ? `% · ${hits[r.userId] ?? 0} ${(hits[r.userId] ?? 0) === 1 ? 'acerto' : 'acertos'}`
            : eco
              ? ' passos'
              : impostor
                ? ' pts'
                : `/${max}`}
        </small>
      </>
    );

  return (
    <section className="screen rm rm-final">
      <h1>Pódio</h1>
      <div className="rm-final-cols">
        <div className="rm-final-main">
          {winner && (
            <div className={`rm-winner${winner.userId === me ? ' me' : ''}`}>
              <div className="mono rm-label">
                {winner.userId === me ? 'VOCÊ VENCEU' : 'VENCEDOR'}
              </div>
              <div className="rm-winner-row">
                {atravessa && (
                  <span
                    className="rm-swatch"
                    style={{ background: roomColor(snapshot, winner.userId) }}
                    aria-hidden="true"
                  />
                )}
                <b>{nameOf(winner)}</b>
                <span className="rm-result-score">{score(winner)}</span>
              </div>
              {winner.userId !== me && myRow && (
                <div className="mono rm-winner-me">Você ficou em {myRow.placement}º lugar</div>
              )}
            </div>
          )}
          {rows.length > 1 && (
            <ol className="rm-podium" start={2}>
              {rows
                .filter((r) => r !== winner)
                .map((r) => (
                  <li key={r.userId} className={`rm-pod${r.userId === me ? ' me' : ''}`}>
                    <span className="mono rm-pos">{r.placement}º</span>
                    {atravessa && (
                      <span
                        className="rm-swatch"
                        style={{ background: roomColor(snapshot, r.userId) }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="rm-result-name">{nameOf(r)}</span>
                    <span className="rm-result-score">{score(r)}</span>
                  </li>
                ))}
            </ol>
          )}
          {guest && <GuestNotice />}
          <p className="mono rm-hint">Partida de sala: não entra no ranking.</p>
        </div>

        <div className="rm-final-side">
          <section className="rm-vote" aria-label="Jogar de novo">
            <div className="rm-vote-head">
              <h2>Jogar de novo?</h2>
              <span className="mono">
                {votes} de {here.length}
              </span>
            </div>
            <ul className="rm-chips">
              {snapshot.members.map((m) => (
                <li
                  key={m.id}
                  className={`rm-chip${m.rematch ? ' on' : ''}${m.connected ? '' : ' off'}`}
                >
                  {at(m.username)}
                  <small className="mono">
                    {!m.connected ? 'SEM CONEXÃO' : m.rematch ? 'QUER' : 'PENSANDO'}
                  </small>
                </li>
              ))}
            </ul>
            <p className="mono rm-hint">
              {voted
                ? 'Seu voto foi enviado. Quando todo mundo votar, o líder libera o começo.'
                : 'Quando todo mundo votar, o líder libera o começo. Quem não quer, sai.'}
            </p>
          </section>

          {message && (
            <p className="acc-failure mono" role="alert">
              {message}
            </p>
          )}
          <div className="stack">
            <button
              type="button"
              className={voted ? 'btn ghost' : 'btn alt'}
              data-sfx="toggle"
              aria-checked={voted}
              onClick={() => sendRoom('vote', { again: !voted })}
            >
              {voted ? 'Mudei de ideia' : 'Jogar de novo'}
            </button>
            <div className="lb-leave">
              <button type="button" className="lb-textbtn" data-sfx="back" onClick={leaveRoom}>
                Sair da sala
              </button>
              {mine?.isHost && (
                <button
                  type="button"
                  className="lb-textbtn danger"
                  data-sfx="remove"
                  onClick={() => setClosing(true)}
                >
                  Encerrar sala
                </button>
              )}
            </div>
            <ConfirmDialog
              open={closing}
              title="Encerrar a sala?"
              text="Todo mundo que está na sala será removido e a sala deixa de existir."
              confirmLabel="Encerrar"
              confirmSfx="remove"
              onConfirm={() => {
                setClosing(false);
                closeRoom();
              }}
              onCancel={() => setClosing(false)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
