import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FS_MATCH_BOTS, FS_MATCH_MINUTES, FS_POINTS } from '@nocap/games';
import { ChatPanel } from '@/components/Chat';
import { chatColor } from '@/components/GameChat';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MIN_SEARCH, fetchFriends, searchUsers } from '@/lib/friends';
import { useAuth } from '@/lib/auth';
import { closeRoom, inviteFriend, leaveRoom, sendRoom, useMeId, useRoom, type RoomSnapshot } from '@/lib/rooms';
import { CounterFoxLogo } from '@/games/foxshot/CounterFoxLogo';
import { CounterFoxBackdrop } from '@/games/foxshot/CounterFoxBackdrop';
import '@/games/foxshot/counterfox-hub.css';

type Tab = 'sala' | 'jogadores' | 'modo' | 'convidar' | 'chat';
const TABS: [Tab, string][] = [
  ['sala', 'Sala'],
  ['jogadores', 'Jogadores'],
  ['modo', 'Modo'],
  ['convidar', 'Convidar'],
  ['chat', 'Chat'],
];

const FONTS = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Saira+Stencil+One&display=swap';

/** Cor de cada raposa no lobby (por ordem de chegada). */
const FUR = ['#ff8a3d', '#6fd6ff', '#9be15d', '#ff6fae', '#ffd24a', '#b28cff', '#ff6a5a', '#5ee0c1', '#f0f0f0', '#ffa64a'];

/** O que falta para começar o mata-mata (uma linha). */
function hint(s: RoomSnapshot): { text: string; ok: boolean } {
  const humans = s.members.filter((m) => m.connected);
  const bots = s.foxshot?.bots ?? 0;
  if (humans.length + bots < 2) return { text: 'Coloque ao menos 1 bot ou chame um amigo', ok: false };
  const waiting = humans.filter((m) => !m.isHost && !m.ready && !m.committed).length;
  if (waiting > 0) return { text: `Falta${waiting > 1 ? 'm' : ''} ${waiting} marcar "pronto"`, ok: false };
  return { text: 'Tudo certo: pode começar', ok: true };
}

function Invite({ snapshot }: { snapshot: RoomSnapshot }) {
  const user = useAuth((st) => st.user);
  const invited = useRoom((s) => s.invited);
  const friends = useQuery({ queryKey: ['friends'], queryFn: fetchFriends, enabled: !!user });
  const [handle, setHandle] = useState('');
  const [term, setTerm] = useState('');
  const [done, setDone] = useState('');
  const found = useQuery({ queryKey: ['user-search', term], queryFn: () => searchUsers(term), enabled: term.length >= MIN_SEARCH });
  const link = `${location.origin}/sala/${snapshot.code}`;
  const inRoom = new Set(snapshot.members.map((m) => m.username));
  const list = (friends.data?.friends ?? []).filter((f) => !inRoom.has(f.username));
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(what);
      window.setTimeout(() => setDone(''), 1800);
    } catch {
      /* sem permissão: o texto continua na tela */
    }
  };
  const row = (u: string) => (
    <li key={u} className="cfl-inv-row">
      <span>@{u}</span>
      {invited.includes(u) ? (
        <em>Enviado</em>
      ) : (
        <button type="button" className="cfl-mini" data-sfx="send" onClick={() => inviteFriend(u)}>
          Chamar
        </button>
      )}
    </li>
  );
  return (
    <div className="cfl-pane" data-testid="cfl-invite">
      <div className="cfl-share">
        <div className="cfl-code-sm">
          <small>CÓDIGO</small>
          <b>{snapshot.code}</b>
        </div>
        <button type="button" className="cfl-mini" onClick={() => void copy(snapshot.code, 'code')} data-sfx="send" data-testid="cfl-copy-code">
          {done === 'code' ? 'Copiado' : 'Copiar código'}
        </button>
        <button type="button" className="cfl-mini" onClick={() => void copy(link, 'link')} data-sfx="send" data-testid="cfl-copy-link">
          {done === 'link' ? 'Link copiado' : 'Copiar link'}
        </button>
      </div>
      <p className="cfl-note">Quem recebe o link entra direto, mesmo sem conta.</p>
      {user ? (
        <>
          <h4>Procurar por @usuário</h4>
          <form
            className="cfl-search"
            onSubmit={(e) => {
              e.preventDefault();
              setTerm(handle.trim().replace(/^@/, '').toLowerCase());
            }}
          >
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@amigo" aria-label="Procurar por usuário" autoCapitalize="none" autoCorrect="off" />
            <button type="submit" className="cfl-mini">
              Buscar
            </button>
          </form>
          {found.isSuccess && (found.data ?? []).filter((u) => !inRoom.has(u.username)).length === 0 && <p className="cfl-note">Ninguém encontrado.</p>}
          <ul className="cfl-inv">{(found.data ?? []).filter((u) => !inRoom.has(u.username)).map((u) => row(u.username))}</ul>
          <h4>Seus amigos</h4>
          {friends.isPending ? <p className="cfl-note">Carregando...</p> : list.length === 0 ? <p className="cfl-note">Nenhum amigo para chamar agora. Use o link acima.</p> : <ul className="cfl-inv">{list.map((f) => row(f.username))}</ul>}
        </>
      ) : (
        <p className="cfl-note">Crie uma conta para chamar amigos do NoCap direto daqui.</p>
      )}
    </div>
  );
}

/** A sala do Counter Fox (spec 057): lobby com tema próprio. Abas Sala, Jogadores, Modo, Convidar e Chat. */
export function CounterFoxLobby({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useMeId();
  const unread = useRoom((s) => s.unread);
  const [tab, setTab] = useState<Tab>('sala');
  const [closing, setClosing] = useState(false);
  const leader = snapshot.hostId === me;
  const mine = snapshot.members.find((m) => m.id === me);
  const minutes = snapshot.foxshot?.minutes ?? 5;
  const bots = snapshot.foxshot?.bots ?? 0;
  const humans = snapshot.members.length;
  const h = hint(snapshot);
  const err = useRoom((s) => s.message);

  useEffect(() => {
    if (document.querySelector('link[data-cfh-fonts]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONTS;
    l.setAttribute('data-cfh-fonts', '1');
    document.head.appendChild(l);
  }, []);

  const maxBots = Math.min(FS_MATCH_BOTS.max, 10 - humans);
  const slots = useMemo(() => Array.from({ length: Math.max(0, Math.min(bots, 10 - humans)) }, (_, i) => i), [bots, humans]);

  return (
    <main className="cfh cfl" data-testid="cfl" data-tab={tab}>
      <CounterFoxBackdrop />
      <div className="cfl-wrap">
        <header className="cfl-head">
          <CounterFoxLogo compact />
          <div className="cfl-chips">
            <span className="cfl-chip">Mata-mata</span>
            <span className="cfl-chip">Duna</span>
            <span className="cfl-chip">{minutes} min</span>
            <span className="cfl-chip">{humans + Math.min(bots, 10 - humans)}/10</span>
          </div>
          <div className="cfl-code" data-testid="cfl-code">
            <small>SALA</small>
            <b>{snapshot.code}</b>
          </div>
        </header>

        <nav className="cfl-tabs" role="tablist" aria-label="Seções da sala">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`cfl-tab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)} data-sfx="tab" data-testid={`cfl-tab-${id}`}>
              {label}
              {id === 'jogadores' && <small>{humans}</small>}
              {id === 'chat' && unread > 0 && tab !== 'chat' && <small className="hot">{unread > 9 ? '9+' : unread}</small>}
            </button>
          ))}
        </nav>

        <section className="cfl-body">
          {tab === 'sala' && (
            <div className="cfl-pane cfl-room" data-testid="cfl-sala">
              <div className="cfl-bigcode" aria-label={`Código da sala ${snapshot.code}`}>
                {snapshot.code.split('').map((c, i) => (
                  <i key={i} style={{ ['--i' as string]: i }}>
                    {c}
                  </i>
                ))}
              </div>
              <p className="cfl-note">Passe este código (ou o link, na aba Convidar) para os amigos entrarem.</p>
              <dl className="cfl-facts">
                <div><dt>Jogo</dt><dd>Counter Fox</dd></div>
                <div><dt>Modo</dt><dd>Mata-mata</dd></div>
                <div><dt>Mapa</dt><dd>Duna</dd></div>
                <div><dt>Tempo</dt><dd>{minutes} minutos</dd></div>
                <div><dt>Bots</dt><dd>{bots}</dd></div>
                <div><dt>Pontos</dt><dd>Abate {FS_POINTS.kill} · Assist. {FS_POINTS.assist}</dd></div>
              </dl>
              <p className={`cfl-hint${h.ok ? ' ok' : ''}`} data-testid="cfl-hint">{h.text}</p>
            </div>
          )}

          {tab === 'jogadores' && (
            <div className="cfl-pane" data-testid="cfl-players">
              <ul className="cfl-grid">
                {snapshot.members.map((m, i) => (
                  <li key={m.id} className={`cfl-card${m.connected ? '' : ' off'}${m.id === me ? ' me' : ''}`} style={{ ['--fur' as string]: FUR[i % FUR.length], ['--d' as string]: `${i * 50}ms` }} data-testid={`cfl-player-${m.username}`}>
                    <span className="cfl-av" aria-hidden="true">{m.username.slice(0, 1).toUpperCase()}</span>
                    <b>{m.username}{m.id === me ? ' (você)' : ''}</b>
                    <em className={m.isHost ? 'lead' : m.ready || m.committed ? 'ok' : ''}>{!m.connected ? 'Desconectado' : m.isHost ? 'Líder' : m.ready || m.committed ? 'Pronto' : 'Esperando'}</em>
                    {leader && m.id !== me && (
                      <button type="button" className="cfl-x" onClick={() => sendRoom('kick', { id: m.id })} data-sfx="remove" aria-label={`Remover ${m.username}`}>
                        Remover
                      </button>
                    )}
                  </li>
                ))}
                {slots.map((i) => (
                  <li key={`b${i}`} className="cfl-card bot" style={{ ['--fur' as string]: '#7d8aa8' }}>
                    <span className="cfl-av" aria-hidden="true">B</span>
                    <b>Bot {i + 1}</b>
                    <em>Computador</em>
                  </li>
                ))}
                {humans + slots.length < 10 && (
                  <li className="cfl-card empty">
                    <button type="button" onClick={() => setTab('convidar')} data-sfx="tab">
                      <span>+</span>
                      Convidar
                    </button>
                  </li>
                )}
              </ul>
            </div>
          )}

          {tab === 'modo' && (
            <div className="cfl-pane" data-testid="cfl-mode">
              <button type="button" className="cfl-mode on" aria-pressed="true" disabled>
                <b>Mata-mata</b>
                <span>Todos contra todos no Duna. Abate vale {FS_POINTS.kill} pontos, assistência {FS_POINTS.assist}. Vence quem tiver mais pontos no fim.</span>
              </button>
              <h4>Duração</h4>
              <div className="cfh-pills" role="radiogroup" aria-label="Duração">
                {FS_MATCH_MINUTES.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={minutes === m} disabled={!leader} className={`cfh-pill${minutes === m ? ' on' : ''}`} onClick={() => sendRoom('configure', { minutes: m })} data-testid={`cfl-min-${m}`}>
                    {m} min
                  </button>
                ))}
              </div>
              <h4>Bots para completar ({humans} pessoas na sala)</h4>
              <div className="cfh-pills" role="radiogroup" aria-label="Bots">
                {Array.from({ length: FS_MATCH_BOTS.max + 1 }, (_, i) => i).map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={bots === n} disabled={!leader || n > maxBots} className={`cfh-pill${bots === n ? ' on' : ''}`} onClick={() => sendRoom('configure', { bots: n })} data-testid={`cfl-bots-${n}`}>
                    {n}
                  </button>
                ))}
              </div>
              {!leader && <p className="cfl-note">Só o líder muda as regras.</p>}
            </div>
          )}

          {tab === 'convidar' && <Invite snapshot={snapshot} />}

          {tab === 'chat' && (
            <div className="cfl-pane cfl-chat" data-testid="cfl-chat">
              <ChatPanel snapshot={snapshot} colorOf={(id) => chatColor(snapshot, id)} />
            </div>
          )}
        </section>

        {err && <p className="cfh-err" role="alert">{err}</p>}

        <footer className="cfl-foot">
          <button type="button" className="cfh-btn danger" onClick={() => void leaveRoom()} data-sfx="back" data-testid="cfl-leave">
            <span>Sair</span>
          </button>
          {leader && (
            <button type="button" className="cfh-btn danger" onClick={() => setClosing(true)} data-sfx="remove" data-testid="cfl-close">
              <span>Encerrar</span>
            </button>
          )}
          <span className="cfl-spacer" />
          {leader ? (
            <button type="button" className="cfh-btn main" disabled={!h.ok} onClick={() => sendRoom('start')} data-sfx="start" data-testid="cfl-start">
              <span>Começar</span>
              <small>{h.ok ? 'todo mundo pronto' : h.text}</small>
            </button>
          ) : (
            <button type="button" className={`cfh-btn main${mine?.ready ? ' on' : ''}`} onClick={() => sendRoom('ready', { ready: !mine?.ready })} data-sfx="select" data-testid="cfl-ready">
              <span>{mine?.ready ? 'Pronto!' : 'Marcar pronto'}</span>
              <small>{mine?.ready ? 'toque para desmarcar' : 'avise o líder'}</small>
            </button>
          )}
        </footer>
      </div>
      <ConfirmDialog
        open={closing}
        title="Encerrar a sala?"
        text="Todo mundo será removido e a sala deixa de existir."
        confirmLabel="Encerrar"
        confirmSfx="remove"
        onConfirm={() => {
          setClosing(false);
          closeRoom();
        }}
        onCancel={() => setClosing(false)}
      />
    </main>
  );
}
