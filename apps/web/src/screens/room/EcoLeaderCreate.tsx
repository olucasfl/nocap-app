import { useState } from 'react';
import { leaderCreateMs, ruleHolds, ruleLabel } from '@nocap/games';
import { Countdown } from '@/components/Countdown';
import { EcoBoard } from '@/games/eco/EcoBoard';
import { PadChip } from '@/games/eco/pads';
import '@/games/eco/eco.css';
import { useAuth } from '@/lib/auth';
import { sendRoom, useRoom, type RoomSnapshot } from '@/lib/rooms';
import { sfx } from '@/lib/sfx';

/** As regras da rodada, riscadas conforme o criador as cumpre. */
function RuleList({ snapshot, seq }: { snapshot: RoomSnapshot; seq?: number[] }) {
  const rules = snapshot.eco!.rules ?? [];
  return (
    <ul className="eco-rules" aria-label="Regras da rodada">
      {rules.map((r, i) => (
        <li key={i} className={seq && ruleHolds(r, seq) ? 'ok' : ''}>
          <span className="mono" aria-hidden="true">
            {seq && ruleHolds(r, seq) ? 'OK' : '..'}
          </span>
          {ruleLabel(r)}
        </li>
      ))}
    </ul>
  );
}

function CreateTimer({ snapshot }: { snapshot: RoomSnapshot }) {
  const endsAt = snapshot.round?.endsAt;
  if (!endsAt) return null;
  return (
    <Countdown
      endsAt={endsAt}
      totalMs={leaderCreateMs(snapshot.eco!.round)}
      warnMs={8000}
      beep
      label="PARA CRIAR"
    />
  );
}

/** Quem cria a rodada: monta a sequência nos botões e só envia quando cumprir as regras. */
function Creator({ snapshot }: { snapshot: RoomSnapshot }) {
  const eco = snapshot.eco!;
  const error = useRoom((s) => s.message);
  const [seq, setSeq] = useState<number[]>([]);
  const [sent, setSent] = useState(false);
  const valid = (eco.rules ?? []).every((r) => ruleHolds(r, seq));

  const add = (pad: number) => {
    if (sent || seq.length >= eco.length) return;
    sfx.ecoPad(pad, 160);
    setSeq([...seq, pad]);
  };

  return (
    <section className="screen eco-play">
      <div className="eco-hud">
        <div className="eco-status input">VOCÊ CRIA</div>
        <div className="mono eco-sub">
          {seq.length}/{eco.length} TOQUES
        </div>
      </div>
      <div className="eco-timer">
        <CreateTimer snapshot={snapshot} />
      </div>
      <RuleList snapshot={snapshot} seq={seq} />
      <EcoBoard pads={eco.pads} lit={null} fresh={null} interactive={!sent} onTap={add} />
      <div className="eco-created" aria-label="Sua sequência">
        {seq.map((p, i) => (
          <PadChip key={i} pad={p} />
        ))}
      </div>
      {error && (
        <p className="acc-failure mono" role="alert">
          {error}
        </p>
      )}
      <div className="stack">
        <button
          type="button"
          className="btn alt"
          data-sfx="start"
          disabled={!valid || sent}
          onClick={() => {
            setSent(true);
            sendRoom('submit', { sequence: seq });
            // Se o servidor recusar, a pessoa pode corrigir e enviar de novo.
            window.setTimeout(() => setSent(false), 1500);
          }}
        >
          Enviar sequência
        </button>
        <div className="eco-created-actions">
          <button
            type="button"
            className="btn ghost"
            data-sfx="back"
            disabled={seq.length === 0 || sent}
            onClick={() => setSeq(seq.slice(0, -1))}
          >
            Desfazer
          </button>
          <button
            type="button"
            className="btn ghost"
            data-sfx="remove"
            disabled={seq.length === 0 || sent}
            onClick={() => setSeq([])}
          >
            Limpar
          </button>
        </div>
      </div>
    </section>
  );
}

/** Os seguidores esperam: quem está criando e as regras da rodada. */
function Waiting({ snapshot }: { snapshot: RoomSnapshot }) {
  const eco = snapshot.eco!;
  const leader = snapshot.members.find((m) => m.id === eco.leader)?.username ?? '?';
  return (
    <section className="screen rm">
      <h1>@{leader} está criando...</h1>
      <p className="lead">
        Rodada {eco.round}: {eco.length} toques, {eco.pads} botões. Quando ele enviar, a sequência
        toca para todos e você repete.
      </p>
      <CreateTimer snapshot={snapshot} />
      <RuleList snapshot={snapshot} />
    </section>
  );
}

export function EcoLeaderCreate({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  return snapshot.eco!.leader === me ? (
    <Creator key={snapshot.eco!.round} snapshot={snapshot} />
  ) : (
    <Waiting snapshot={snapshot} />
  );
}
