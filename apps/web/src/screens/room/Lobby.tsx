import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFriends } from '@/lib/friends';
import { inviteFriend, leaveRoom, sendRoom, useRoom, type RoomSnapshot } from '@/lib/rooms';
import { useAuth } from '@/lib/auth';

const ROUNDS = [1, 3, 5, 7, 10];
const SHOW = [400, 1000, 3000, 5000];
const PICK = [15_000, 30_000, 60_000];

/** Modos de cada jogo na sala, com uma linha que explica cada um. */
const MODES: Record<'color' | 'time', { id: string; label: string; note: string }[]> = {
  color: [
    { id: 'classic', label: 'Clássico', note: 'A cor aparece e some. Recrie de memória.' },
    { id: 'flash', label: 'Flash', note: 'A cor pisca por 0,4 s: confie no olho.' },
    { id: 'blind', label: 'Às cegas', note: 'Ninguém vê a cor que monta. Só a revelação mostra.' },
  ],
  time: [
    { id: 'classic', label: 'Clássico', note: 'Alvos de 1 a 18 s, alternando curtos e longos.' },
    { id: 'strict', label: 'Sem estourar', note: 'Passou do alvo, a rodada vale zero.' },
    { id: 'sequence', label: 'Sequência', note: 'Alvos curtos (2 a 6 s), um atrás do outro.' },
  ],
};

const seconds = (ms: number) => `${ms / 1000}s`.replace('.', ',');

function Options<T extends string | number>({
  label,
  values,
  current,
  format,
  onPick,
  disabled,
}: {
  label: string;
  values: T[];
  current: T;
  format: (v: T) => string;
  onPick: (v: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="rm-opt">
      <div className="mono rm-label">{label}</div>
      <div className="rm-seg" role="radiogroup" aria-label={label}>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={current === v}
            disabled={disabled}
            onClick={() => onPick(v)}
          >
            {format(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Amigos que ainda não estão na sala, com botão de chamar. */
function InviteFriends({ snapshot }: { snapshot: RoomSnapshot }) {
  const invited = useRoom((s) => s.invited);
  const friends = useQuery({ queryKey: ['friends'], queryFn: fetchFriends });
  const inRoom = new Set(snapshot.members.map((m) => m.username));
  const list = (friends.data?.friends ?? []).filter((f) => !inRoom.has(f.username));
  if (list.length === 0) return null;
  return (
    <div>
      <div className="mono rm-label">CHAMAR AMIGOS</div>
      <ul className="fr-list">
        {list.map((f) => (
          <li key={f.username} className="fr-row">
            <span className="fr-name">@{f.username}</span>
            {invited.includes(f.username) ? (
              <span className="mono fr-state">CONVITE ENVIADO</span>
            ) : (
              <button type="button" className="fr-btn" onClick={() => inviteFriend(f.username)}>
                Convidar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Lobby({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const message = useRoom((s) => s.message);
  const [copied, setCopied] = useState(false);
  const isHost = snapshot.hostId === me;
  const mine = snapshot.members.find((m) => m.id === me);
  const others = snapshot.members.filter((m) => m.connected && m.id !== snapshot.hostId);
  const canStart =
    snapshot.members.filter((m) => m.connected).length >= 2 && others.every((m) => m.ready);
  const link = `${location.origin}/sala/${snapshot.code}`;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'NoCap',
          text: `Entra na minha sala ${snapshot.game === 'time' ? 'do Tempo' : 'da Cor'}: ${snapshot.code}`,
          url: link,
        });
      } else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* cancelou o compartilhamento */
    }
  };

  const configure = (patch: Partial<RoomSnapshot['settings']> | { mode: string }) =>
    sendRoom('configure', patch);

  return (
    <section className="screen rm">
      <div className="rm-code">
        <div className="mono rm-label">CÓDIGO DA SALA</div>
        <b>{snapshot.code}</b>
        <button type="button" className="fr-btn ghost" data-sfx="send" onClick={() => void share()}>
          {copied ? 'Link copiado' : 'Convidar'}
        </button>
      </div>

      <div>
        <div className="mono rm-label">
          JOGADORES · {snapshot.members.length}/{snapshot.maxPlayers}
        </div>
        <ul className="fr-list">
          {snapshot.members.map((m) => (
            <li key={m.id} className="fr-row">
              <span className="fr-name">
                @{m.username}
                {m.isHost && <span className="mono rm-badge">HOST</span>}
                {m.id === me && <span className="mono rm-badge you">VOCÊ</span>}
              </span>
              <span className="fr-actions">
                {!m.connected ? (
                  <span className="mono fr-state">SEM CONEXÃO</span>
                ) : m.isHost ? null : (
                  <span className={`mono rm-ready${m.ready ? ' on' : ''}`}>
                    {m.ready ? 'PRONTO' : 'ESPERANDO'}
                  </span>
                )}
                {isHost && !m.isHost && (
                  <button
                    type="button"
                    className="fr-btn ghost"
                    onClick={() => sendRoom('kick', { id: m.id })}
                  >
                    Expulsar
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <InviteFriends snapshot={snapshot} />

      <div className="rm-rules">
        <div className="mono rm-label">REGRAS{isHost ? '' : ' (DEFINIDAS PELO HOST)'}</div>
        <Options
          label="MODO"
          values={MODES[snapshot.game].map((m) => m.id)}
          current={snapshot.mode}
          format={(id) => MODES[snapshot.game].find((m) => m.id === id)?.label ?? id}
          disabled={!isHost}
          onPick={(v) => configure({ mode: v })}
        />
        <p className="mono rm-mode-note">
          {MODES[snapshot.game].find((m) => m.id === snapshot.mode)?.note}
        </p>
        <Options
          label="RODADAS"
          values={ROUNDS}
          current={snapshot.settings.rounds}
          format={String}
          disabled={!isHost}
          onPick={(v) => configure({ rounds: v })}
        />
        {snapshot.game === 'color' && (
          <>
            {snapshot.mode !== 'flash' && (
              <Options
                label="TEMPO PARA DECORAR"
                values={SHOW}
                current={snapshot.settings.showMs}
                format={seconds}
                disabled={!isHost}
                onPick={(v) => configure({ showMs: v })}
              />
            )}
            <Options
              label="TEMPO PARA RECRIAR"
              values={PICK}
              current={snapshot.settings.pickMs}
              format={seconds}
              disabled={!isHost}
              onPick={(v) => configure({ pickMs: v })}
            />
          </>
        )}
      </div>

      {message && (
        <p className="acc-failure mono" role="alert">
          {message}
        </p>
      )}

      <div className="stack">
        {isHost ? (
          <button
            type="button"
            className="btn alt"
            data-sfx="start"
            disabled={!canStart}
            onClick={() => sendRoom('start')}
          >
            Começar
          </button>
        ) : mine?.committed ? (
          <p className="mono rm-hint">Você topou jogar de novo. Aguardando o líder iniciar...</p>
        ) : (
          <button
            type="button"
            className={mine?.ready ? 'btn ghost' : 'btn alt'}
            data-sfx="toggle"
            aria-checked={!!mine?.ready}
            onClick={() => sendRoom('ready', { ready: !mine?.ready })}
          >
            {mine?.ready ? 'Não estou pronto' : 'Estou pronto'}
          </button>
        )}
        {isHost && !canStart && (
          <p className="mono rm-hint">Precisa de 2 pessoas, todas marcando "pronto".</p>
        )}
        {isHost && canStart && others.length > 0 && others.every((m) => m.committed) && (
          <p className="mono rm-hint">
            Todo mundo topou jogar de novo. Ajuste as regras, se quiser, e comece.
          </p>
        )}
        <button type="button" className="btn ghost" data-sfx="back" onClick={leaveRoom}>
          Sair da sala
        </button>
      </div>
    </section>
  );
}
