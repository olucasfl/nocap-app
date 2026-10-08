import { useEffect, useRef, useState } from 'react';
import { Countdown } from '@/components/Countdown';
import { EcoBoard } from '@/games/eco/EcoBoard';
import '@/games/eco/eco.css';
import { toHex } from '@/games/color/hex';
import { PickScreen } from '@/games/color/screens/PickScreen';
import { ShowScreen } from '@/games/color/screens/ShowScreen';
import '@/games/color/color.css';
import { sendRoom, toLocal, type PartySnapshot, type RoomSnapshot } from '@/lib/rooms';
import { buzz, sfx } from '@/lib/sfx';
import { Big, CommandBar, useServerNow } from './common';

interface Props {
  snapshot: RoomSnapshot;
  p: PartySnapshot;
}

const connectedCount = (s: RoomSnapshot) => s.members.filter((m) => m.connected).length;

function Locked({ snapshot, p }: Props) {
  return (
    <>
      <CommandBar text={p.command ?? ''} />
      <Big
        title="TRAVADO"
        sub={`ESPERANDO OS OUTROS: ${p.submitted?.length ?? 0} DE ${connectedCount(snapshot)}`}
      />
    </>
  );
}

/** Mesmíssima: preparar, ver o alvo, recriar a cor e travar. Os tempos vêm do relógio do servidor. */
export function MicroColor({ snapshot, p }: Props) {
  const times = p.times!;
  const ch = p.challenge!;
  const now = useServerNow();
  if (now < times.showAt) {
    return (
      <>
        <CommandBar text={p.command ?? ''} />
        <Big title="PREPARE" />
      </>
    );
  }
  if (now < times.pickAt) {
    return (
      <>
        <CommandBar text={p.command ?? ''} />
        <ShowScreen color={toHex(ch.target!)} ms={ch.showMs!} onDone={() => undefined} />
      </>
    );
  }
  if (p.mine) return <Locked snapshot={snapshot} p={p} />;
  return (
    <PickScreen
      blind={!!ch.blind}
      start={ch.start!}
      banner={<CommandBar text={p.command ?? ''} />}
      onLock={(guess) => sendRoom('submit', { color: guess })}
      deadline={{ endsAt: toLocal(times.endsAt), totalMs: times.endsAt - times.pickAt }}
    />
  );
}

const fmt = (ms: number) => (ms / 1000).toFixed(2).replace('.', ',');

/** Já Deu?: ver o alvo, COMEÇAR e PARAR. O servidor mede; o relógio mostrado é só para a pegadinha. */
export function MicroTime({ snapshot, p }: Props) {
  const times = p.times!;
  const ch = p.challenge!;
  const now = useServerNow();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, tick] = useState(0);
  const running = startedAt !== null || !!p.started;
  // O relógio mostrado anda mais depressa ou devagar (Tempo Falso) e some depois de 1 s (Cego).
  useEffect(() => {
    if (startedAt === null || !ch.showClock) return;
    const id = window.setInterval(() => tick((n) => n + 1), 60);
    return () => window.clearInterval(id);
  }, [startedAt, ch.showClock]);

  if (now < times.showAt) {
    return (
      <>
        <CommandBar text={p.command ?? ''} />
        <Big title="PREPARE" />
      </>
    );
  }
  if (now < times.pickAt) {
    return (
      <>
        <CommandBar text={p.command ?? ''} />
        <Big title={fmt(ch.targetMs!)} sub="ESTE É O ALVO (EM SEGUNDOS)" />
      </>
    );
  }
  if (p.mine) return <Locked snapshot={snapshot} p={p} />;

  const real = startedAt === null ? 0 : Date.now() - startedAt;
  const hidden = ch.hideAfterMs != null && real > ch.hideAfterMs;
  return (
    <>
      <CommandBar text={p.command ?? ''} />
      {ch.showClock ? (
        <div className="pclock" aria-label="Relógio">
          <span className="mono">ALVO {fmt(ch.targetMs!)}</span>
          <b>{running && !hidden ? fmt(real * (ch.factor ?? 1)) : '- , - -'}</b>
        </div>
      ) : (
        <Big title={fmt(ch.targetMs!)} sub={running ? 'CONTANDO...' : 'ALVO'} />
      )}
      <div className="stack">
        {!running ? (
          <button
            type="button"
            className="btn alt"
            data-sfx="start"
            onClick={() => {
              setStartedAt(Date.now());
              sendRoom('tbegin');
            }}
          >
            Começar
          </button>
        ) : (
          <button type="button" className="btn" data-sfx="select" onClick={() => sendRoom('tstop')}>
            Parar
          </button>
        )}
      </div>
    </>
  );
}

/** Ecooo: a sequência acende para todos; depois cada um repete, sem aviso de certo ou errado. */
export function MicroEco({ snapshot, p }: Props) {
  const times = p.times!;
  const ch = p.challenge!;
  const now = useServerNow();
  const [lit, setLit] = useState<number | null>(null);
  const [done, setDone] = useState(0);
  const played = useRef(false);

  // A reprodução começa no instante marcado pelo servidor (convertido para o relógio daqui).
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    const timers: number[] = [];
    const base = toLocal(times.showAt) + 600;
    const step = ch.stepMs ?? 600;
    const on = Math.round(step * 0.64);
    ch.sequence!.forEach((pad, k) => {
      const at = Math.max(0, base + k * step - Date.now());
      timers.push(
        window.setTimeout(() => {
          setLit(pad);
          sfx.ecoPad(pad, on);
        }, at),
        window.setTimeout(() => setLit(null), at + on),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [times.showAt, ch.sequence, ch.stepMs]);

  const picking = now >= times.pickAt;
  if (picking && p.mine) return <Locked snapshot={snapshot} p={p} />;
  return (
    <>
      <CommandBar text={p.command ?? ''} />
      <div className="mono pcount">
        {picking ? `${done} / ${ch.length}` : now < times.showAt ? 'PREPARE' : 'OBSERVE'}
      </div>
      <EcoBoard
        pads={ch.pads ?? 4}
        lit={lit}
        interactive={picking}
        onTap={(pad) => {
          if (!picking) return;
          // Acende ao tocar, mas não diz se acertou.
          setLit(pad);
          sfx.ecoPad(pad, 120);
          buzz(8);
          window.setTimeout(() => setLit(null), 140);
          setDone((n) => n + 1);
          sendRoom('etap', { pad });
        }}
      />
      {picking && (
        <Countdown
          endsAt={toLocal(times.endsAt)}
          totalMs={times.endsAt - times.pickAt}
          warnMs={4000}
          compact
        />
      )}
    </>
  );
}

/** Digitação Ligeira: a palavra e o campo. Na Mão Boba, mexer no campo já custa pontos. */
export function MicroTyping({ snapshot, p }: Props) {
  const times = p.times!;
  const ch = p.challenge!;
  const now = useServerNow();
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const trap = p.variant === 'maohoba';
  const picking = now >= times.pickAt;

  if (picking && p.mine) {
    return (
      <>
        <CommandBar text={p.command ?? ''} />
        <Big
          title={trap ? 'VOCÊ MEXEU' : 'ENVIADO'}
          sub={`ESPERANDO OS OUTROS: ${p.submitted?.length ?? 0} DE ${connectedCount(snapshot)}`}
        />
      </>
    );
  }
  const send = () => {
    if (!picking) return;
    sendRoom('type', { text, touched, submit: true });
  };
  return (
    <>
      <CommandBar text={p.command ?? ''} />
      <div className="pword" aria-label="Palavra">
        {ch.word}
      </div>
      {picking && (
        <Countdown
          endsAt={toLocal(times.endsAt)}
          totalMs={times.endsAt - times.pickAt}
          warnMs={3000}
          compact
        />
      )}
      <form
        className="ch-form"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          className="ch-input"
          value={text}
          disabled={!picking}
          autoFocus={picking}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
          aria-label="Digite aqui"
          placeholder={picking ? 'Digite aqui' : 'Espere...'}
          onChange={(e) => {
            setText(e.target.value);
            if (!touched) {
              setTouched(true);
              // Mão Boba: mexer no campo já vale: avisa o servidor na hora.
              if (trap) sendRoom('type', { text: e.target.value, touched: true, submit: false });
            }
          }}
        />
        <button type="submit" className="ch-send" disabled={!picking || !text.trim()}>
          Enviar
        </button>
      </form>
    </>
  );
}
