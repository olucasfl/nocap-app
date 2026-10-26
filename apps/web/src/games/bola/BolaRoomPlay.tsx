import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { roomLink, type BolaLink, type BolaRosterRow } from '@/lib/bola-link';
import { BolaHostSession, BolaPeerSession } from '@/lib/bola-p2p';
import { leaveRoom, sendRoom, type RoomSnapshot } from '@/lib/rooms';
import { BolaPlay, type BolaSetup } from './BolaPlay';
import '../desmorona/desmorona.css';
import './bola.css';

type P2p =
  | { kind: 'none' }
  | { kind: 'host'; session: BolaHostSession }
  | { kind: 'peer'; session: BolaPeerSession; open: boolean };

/**
 * A partida do Fut Fox em sala (spec 046 e 048). Quem simula a partida? Se todos conseguirem conectar ao aparelho do
 * líder (WebRTC), ele; senão o servidor. Esta tela cuida de conectar, escolher o caminho e então desenhar a partida.
 */
export function BolaRoomPlay({ snapshot }: { snapshot: RoomSnapshot }) {
  const b = snapshot.bola;
  const navigate = useNavigate();
  const teams = b?.format.teams ?? 2;
  const perTeam = b?.format.perTeam ?? 1;
  const minutes = b?.format.minutes ?? 3;
  const setup = useMemo<BolaSetup>(() => ({ teams, perTeam, minutes }), [teams, perTeam, minutes]);
  const net = b?.net ?? 'server';
  const me = b?.me ?? '';
  const host = b?.p2pHost ?? null;
  const p2pSetup = b?.setup ?? null;
  const [p2p, setP2p] = useState<P2p>({ kind: 'none' });
  const [fail, setFail] = useState('');
  const [liveRoster, setLiveRoster] = useState<BolaRosterRow[] | null>(null);
  const sessionRef = useRef<P2p>({ kind: 'none' });

  // abre a conexão quando a partida é (ou pode vir a ser) ponto a ponto
  useEffect(() => {
    if (net === 'server' || !host || !me || !p2pSetup) return undefined;
    if (sessionRef.current.kind !== 'none') return undefined;
    if (typeof RTCPeerConnection === 'undefined') {
      // aparelho sem WebRTC: avisa o servidor, que passa a simular
      sendRoom('bp2p', { ok: false });
      return undefined;
    }
    if (me === host) {
      const s = new BolaHostSession(me, p2pSetup, (r) => sendRoom('bres', r));
      sessionRef.current = { kind: 'host', session: s };
      setP2p(sessionRef.current);
    } else {
      const s = new BolaPeerSession(host, {
        onOpen: () => {
          sessionRef.current = { kind: 'peer', session: s, open: true };
          setP2p(sessionRef.current);
          sendRoom('bp2p', { ok: true });
        },
        onFail: () => {
          sendRoom('bp2p', { ok: false });
          if (sessionRef.current.kind === 'peer')
            setFail('Não deu para conectar ao aparelho do líder.');
        },
        onClosed: () => setFail('O líder saiu da partida.'),
      });
      sessionRef.current = { kind: 'peer', session: s, open: false };
      setP2p(sessionRef.current);
      void s.start().catch(() => sendRoom('bp2p', { ok: false }));
    }
    return undefined;
  }, [net, host, me, p2pSetup]);

  // o servidor passou a simular (reserva): solta a conexão ponto a ponto
  useEffect(() => {
    if (net !== 'server' || sessionRef.current.kind === 'none') return;
    const cur = sessionRef.current;
    cur.session.dispose();
    sessionRef.current = { kind: 'none' };
    setP2p({ kind: 'none' });
    setFail('');
    setLiveRoster(null);
  }, [net]);

  // o líder começa a simular quando o servidor confirma que todos conectaram
  useEffect(() => {
    if (net === 'p2p' && p2p.kind === 'host') p2p.session.start();
  }, [net, p2p]);

  // sai da tela: fecha tudo
  useEffect(
    () => () => {
      const cur = sessionRef.current;
      if (cur.kind !== 'none') cur.session.dispose();
      sessionRef.current = { kind: 'none' };
    },
    [],
  );

  let link: BolaLink | null = null;
  if (net === 'server') link = roomLink;
  else if (net === 'p2p') {
    if (p2p.kind === 'host') link = p2p.session.link;
    else if (p2p.kind === 'peer' && p2p.open) link = p2p.session.link;
  }

  // a lista de corpos vem pelo canal do líder quando alguém vira bot
  useEffect(() => {
    if (!link?.onRoster) return undefined;
    return link.onRoster(setLiveRoster);
  }, [link]);

  if (!b) return null;
  const isHost = snapshot.hostId === b.me;
  const onExit = () => {
    void leaveRoom().then(() => navigate({ to: '/fox-cap/bola' }));
  };

  if (!link || fail) {
    return (
      <div className="dsm-screen bola-screen">
        <div className="dsm-over" role={fail ? 'alert' : 'status'} data-testid="bola-connecting">
          <div className="dsm-over-card">
            <h2>{fail ? 'Conexão perdida' : 'Conectando os aparelhos…'}</h2>
            <p>
              {fail ||
                'Os aparelhos estão se ligando ao do líder para a partida ficar sem atraso. Se algum não conseguir, o servidor assume.'}
            </p>
            <button type="button" className="dsm-btn is-ghost" onClick={onExit}>
              Sair da partida
            </button>
          </div>
        </div>
      </div>
    );
  }

  const roster = net === 'server' ? b.roster : (liveRoster ?? b.roster);
  return (
    <div className="dsm-screen bola-screen">
      <BolaPlay
        key={net}
        setup={setup}
        online={{ meId: b.me ?? '', roster, link }}
        onEnd={
          isHost
            ? () => (p2p.kind === 'host' && net === 'p2p' ? p2p.session.endNow() : sendRoom('bend'))
            : undefined
        }
        onExit={onExit}
      />
    </div>
  );
}
