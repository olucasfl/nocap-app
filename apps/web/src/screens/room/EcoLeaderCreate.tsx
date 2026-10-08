import { useEffect, useState } from 'react';
import {
  LEADER_ANNOUNCE_MS,
  leaderCreateMs,
  ruleHolds,
  ruleLabel,
  ruleProgress,
  type LeaderRule,
} from '@nocap/games';
import { Countdown } from '@/components/Countdown';
import { EcoBoard } from '@/games/eco/EcoBoard';
import { PadChip } from '@/games/eco/pads';
import '@/games/eco/eco.css';
import { useAuth } from '@/lib/auth';
import { sendRoom, useRoom, type RoomSnapshot } from '@/lib/rooms';
import { sfx } from '@/lib/sfx';

/** O pad a que uma regra se refere (cor que precisa usar ou que está proibida). */
const padOf = (r: LeaderRule): number | null =>
  r.kind === 'useAtLeast' || r.kind === 'avoid' ? r.pad : null;

/** O botão proibido da rodada, se houver (aparece apagado no tabuleiro). */
const bannedPad = (rules: LeaderRule[]): number | null => {
  const r = rules.find((x) => x.kind === 'avoid');
  return r && r.kind === 'avoid' ? r.pad : null;
};

/**
 * As regras da rodada como lista de tarefas: cada uma com caixinha, o quanto já foi feito e, nas
 * de cor, o botão em miniatura. Quem cria vê as caixinhas se marcarem sozinhas.
 */
function RuleList({ rules, seq, title }: { rules: LeaderRule[]; seq?: number[]; title: string }) {
  const done = seq ? rules.filter((r) => ruleHolds(r, seq)).length : 0;
  return (
    <section className="eco-rulecard" aria-label={title}>
      <header>
        <b>{title}</b>
        {seq && (
          <span className="mono">
            {done}/{rules.length} FEITAS
          </span>
        )}
      </header>
      <ul className="eco-rules">
        {rules.map((r, i) => {
          const ok = !!seq && ruleHolds(r, seq);
          const progress = seq ? ruleProgress(r, seq) : null;
          const pad = padOf(r);
          return (
            <li key={i} className={ok ? 'ok' : ''}>
              <span className="eco-check" aria-hidden="true" />
              <span className="eco-rule-text">
                {ruleLabel(r)}
                {pad !== null && <PadChip pad={pad} />}
              </span>
              {progress && (
                <span className="mono eco-rule-progress">
                  {progress.done}/{progress.total}
                </span>
              )}
              <span className="sr-only">{ok ? 'cumprida' : 'ainda não cumprida'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CreateTimer({ snapshot }: { snapshot: RoomSnapshot }) {
  const endsAt = snapshot.round?.endsAt;
  if (!endsAt) return null;
  return (
    <Countdown
      endsAt={endsAt}
      totalMs={leaderCreateMs(snapshot.eco!.round) + LEADER_ANNOUNCE_MS}
      warnMs={6000}
      beep
      label="PARA CRIAR"
    />
  );
}

/** "O LÍDER É @fulano": aparece grande no começo de cada rodada e some sozinho, já com o jogo andando. */
function LeaderBanner({ name, me }: { name: string; me: boolean }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    sfx.ecoRound();
    const id = window.setTimeout(() => setShow(false), LEADER_ANNOUNCE_MS);
    return () => window.clearTimeout(id);
  }, []);
  if (!show) return null;
  return (
    <div className="eco-leader-banner" role="status" aria-live="assertive">
      <span className="mono">{me ? 'RODADA NOVA' : 'O LÍDER É'}</span>
      <b>{me ? 'É VOCÊ!' : `@${name}`}</b>
      {me && <small className="mono">Monte a sequência abaixo</small>}
    </div>
  );
}

/** Quem cria a rodada: monta a sequência nos botões e só envia quando cumprir as regras. */
function Creator({ snapshot }: { snapshot: RoomSnapshot }) {
  const eco = snapshot.eco!;
  const error = useRoom((s) => s.message);
  const [seq, setSeq] = useState<number[]>([]);
  const [sent, setSent] = useState(false);
  const rules = eco.rules ?? [];
  const banned = bannedPad(rules);
  const missing = rules.filter((r) => !ruleHolds(r, seq)).length;
  const valid = missing === 0;

  const add = (pad: number) => {
    if (sent || seq.length >= eco.length || pad === banned) return;
    sfx.ecoPad(pad, 160);
    setSeq([...seq, pad]);
  };

  return (
    <section className="screen eco-play">
      <LeaderBanner name="" me />
      <div className="eco-role">
        <b>VOCÊ É O LÍDER</b>
        <span>Toque nos botões para montar uma sequência. Os outros vão ter que repetir.</span>
      </div>
      <div className="eco-timer">
        <CreateTimer snapshot={snapshot} />
      </div>
      <RuleList rules={rules} seq={seq} title="Cumpra estas regras" />
      <EcoBoard
        pads={eco.pads}
        growing
        banned={banned}
        lit={null}
        fresh={null}
        interactive={!sent}
        onTap={add}
      />
      <div className="eco-created-wrap">
        <div className="mono eco-created-count">
          SUA SEQUÊNCIA · {seq.length}/{eco.length} TOQUES
        </div>
        <div className="eco-created" aria-label="Sua sequência">
          {seq.length === 0 && <span className="eco-created-empty">Toque nos botões...</span>}
          {seq.map((p, i) => (
            <PadChip key={i} pad={p} />
          ))}
        </div>
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
        <p className="mono eco-send-hint">
          {valid
            ? 'Tudo certo! Toque em enviar.'
            : `Falta cumprir ${missing} ${missing === 1 ? 'regra' : 'regras'} para poder enviar.`}
        </p>
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

/** Os seguidores esperam o líder enviar; quando ele envia, a sequência toca e eles repetem. */
function Waiting({ snapshot }: { snapshot: RoomSnapshot }) {
  const eco = snapshot.eco!;
  const leader = snapshot.members.find((m) => m.id === eco.leader)?.username ?? '?';
  return (
    <section className="screen rm">
      <LeaderBanner name={leader} me={false} />
      <div className="eco-role follower">
        <b>O LÍDER É @{leader}</b>
        <span>
          Ele monta uma sequência de {eco.length} toques. Quando enviar, ela toca para todos e você
          repete.
        </span>
      </div>
      <CreateTimer snapshot={snapshot} />
      <RuleList rules={eco.rules ?? []} title="Regras que ele precisa cumprir" />
    </section>
  );
}

export function EcoLeaderCreate({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const eco = snapshot.eco!;
  return eco.leader === me ? (
    <Creator key={eco.round} snapshot={snapshot} />
  ) : (
    <Waiting key={eco.round} snapshot={snapshot} />
  );
}
