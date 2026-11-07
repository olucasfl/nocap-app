import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FS_MATCH_BOTS, FS_MATCH_MINUTES, FS_POINTS } from '@nocap/games';
import { ChatPanel } from '@/components/Chat';
import { chatColor } from '@/components/GameChat';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MIN_SEARCH, fetchFriends, searchUsers } from '@/lib/friends';
import { useAuth } from '@/lib/auth';
import { GamePicker } from './GamePicker';
import { closeRoom, inviteFriend, leaveRoom, sendRoom, useMeId, useRoom, type RoomSnapshot } from '@/lib/rooms';
import { CounterFoxLogo } from '@/games/foxshot/CounterFoxLogo';
import { CounterFoxBackdrop } from '@/games/foxshot/CounterFoxBackdrop';
import '@/games/foxshot/counterfox-hub.css';

type Tab = 'sala' | 'jogadores' | 'modo' | 'convidar' | 'chat' | 'jogos';
const TABS: [Tab, string][] = [
  ['sala', 'Sala'],
  ['jogadores', 'Jogadores'],
  ['modo', 'Modo'],
  ['convidar', 'Convidar'],
  ['chat', 'Chat'],
  ['jogos', 'Outros jogos'],
];

const FONTS = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Saira+Stencil+One&display=swap';

/** Cor de cada raposa no lobby: por ordem de chegada alterna contra-terrorista (azul) e terrorista (laranja), como na partida. */
const FUR = ['#3f82ff', '#ff8a3d'];

/** O que falta para começar o mata-mata (uma linha). */
function hint(s: RoomSnapshot): { text: string; ok: boolean } {
  if ((s.foxshot?.kind ?? 'none') === 'none') return { text: 'Escolha o modo de jogo na aba Modo', ok: false };
  const humans = s.members.filter((m) => m.connected);
  const bots = s.foxshot?.kind === 'bomb' ? (s.foxshot.botsCt ?? 0) + (s.foxshot.botsTr ?? 0) : (s.foxshot?.bots ?? 0);
  if (humans.length + bots < 2) return { text: 'Coloque ao menos 1 bot ou chame um amigo', ok: false };
  const waiting = humans.filter((m) => !m.isHost && !m.ready && !m.committed).length;
  if (waiting > 0) return { text: `Falta${waiting > 1 ? 'm' : ''} ${waiting} marcar "pronto"`, ok: false };
  return { text: 'Tudo certo: pode começar', ok: true };
}

/** Convidar: igual às outras salas do NoCap (enviar o link, copiar, procurar por @usuário, chamar e chamar de novo). */
function Invite({ snapshot }: { snapshot: RoomSnapshot }) {
  const user = useAuth((st) => st.user);
  const invited = useRoom((s) => s.invited);
  const invitedEver = useRoom((s) => s.invitedEver);
  const friends = useQuery({ queryKey: ['friends'], queryFn: fetchFriends, enabled: !!user });
  const [handle, setHandle] = useState('');
  const [filter, setFilter] = useState('');
  const [term, setTerm] = useState('');
  const [done, setDone] = useState('');
  const found = useQuery({ queryKey: ['user-search', term], queryFn: () => searchUsers(term), enabled: term.length >= MIN_SEARCH });
  const link = `${location.origin}/sala/${snapshot.code}`;
  const message = `Entra na minha sala do Counter Fox: ${snapshot.code} ${link}`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const inRoom = new Set(snapshot.members.map((m) => m.username));
  const all = friends.data?.friends ?? [];
  const list = all.filter((f) => !inRoom.has(f.username)).filter((f) => f.username.includes(filter.trim().toLowerCase().replace(/^@/, '')));
  const results = (found.data ?? []).filter((u) => !inRoom.has(u.username));
  const flash = (what: string) => {
    setDone(what);
    window.setTimeout(() => setDone(''), 1800);
  };
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(what);
    } catch {
      /* sem permissão: o texto continua na tela */
    }
  };
  const share = async () => {
    if (!canShare) return copy(message, 'share');
    try {
      await navigator.share({ title: 'NoCap', text: message, url: link });
    } catch {
      /* cancelou a folha de compartilhar */
    }
  };
  const row = (u: string, badge?: string) => (
    <li key={u} className="cfl-inv-row">
      <span>
        @{u}
        {badge && <small className="mono"> {badge}</small>}
      </span>
      {invited.includes(u) ? (
        <em>Enviado</em>
      ) : (
        <button type="button" className="cfl-mini" data-sfx="send" onClick={() => inviteFriend(u)} data-testid={`cfl-call-${u}`}>
          {invitedEver.includes(u) ? 'Chamar de novo' : 'Chamar'}
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
        <button type="button" className="cfl-mini" onClick={() => void share()} data-sfx="send" data-testid="cfl-share">
          {done === 'share' ? 'Mensagem copiada' : 'Enviar convite'}
        </button>
        <button type="button" className="cfl-mini" onClick={() => void copy(snapshot.code, 'code')} data-sfx="send" data-testid="cfl-copy-code">
          {done === 'code' ? 'Copiado' : 'Copiar código'}
        </button>
        <button type="button" className="cfl-mini" onClick={() => void copy(link, 'link')} data-sfx="send" data-testid="cfl-copy-link">
          {done === 'link' ? 'Link copiado' : 'Copiar link'}
        </button>
      </div>
      <p className="cfl-note">Quem recebe o link entra direto, mesmo sem conta. Dá para convidar também com a partida rolando: a pessoa escolhe entre jogar e espectar.</p>
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
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={`@usuário (mín. ${MIN_SEARCH} letras)`} aria-label="Procurar por usuário" autoCapitalize="none" autoCorrect="off" data-testid="cfl-search" />
            <button type="submit" className="cfl-mini" disabled={handle.trim().replace(/^@/, '').length < MIN_SEARCH}>
              Buscar
            </button>
          </form>
          {found.isFetching && <p className="cfl-note">Procurando...</p>}
          {found.isError && <p className="cfl-note">Não deu para pesquisar. Tente de novo.</p>}
          {found.isSuccess && results.length === 0 && <p className="cfl-note">Ninguém encontrado.</p>}
          {results.length > 0 && <ul className="cfl-inv">{results.map((u) => row(u.username, u.state === 'friends' ? 'amigo' : undefined))}</ul>}
          <h4>Seus amigos</h4>
          {all.length >= 8 && <input className="cfl-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar amigo" aria-label="Buscar amigo" autoCapitalize="none" autoCorrect="off" />}
          {friends.isPending ? (
            <p className="cfl-note">Carregando...</p>
          ) : list.length === 0 ? (
            <p className="cfl-note">{all.length === 0 ? 'Você ainda não tem amigos no NoCap. Use o link acima.' : filter ? 'Ninguém com esse nome.' : 'Todos os seus amigos já estão na sala.'}</p>
          ) : (
            <ul className="cfl-inv">{list.map((f) => row(f.username))}</ul>
          )}
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
  const kind = snapshot.foxshot?.kind ?? 'none';
  const bomb = kind === 'bomb';
  const botsCt = snapshot.foxshot?.botsCt ?? 0;
  const botsTr = snapshot.foxshot?.botsTr ?? 0;
  const bots = bomb ? botsCt + botsTr : (snapshot.foxshot?.bots ?? 0);
  const winRounds = snapshot.foxshot?.winRounds ?? 8;
  const roundSec = snapshot.foxshot?.roundSec ?? 115;
  const teams = snapshot.foxshot?.teams ?? {};
  /** Time de uma pessoa no modo Bomba: o escolhido; sem escolha, alterna pela ordem de entrada. */
  const teamOfMember = (id: string, i: number): 0 | 1 => teams[id] ?? ((i % 2) as 0 | 1);
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
            <span className="cfl-chip">{kind === 'none' ? 'Sem modo' : bomb ? 'Bomba' : 'Mata-mata'}</span>
            <span className="cfl-chip">Duna</span>
            {kind !== 'none' && <span className="cfl-chip">{bomb ? `até ${winRounds} rounds` : `${minutes} min`}</span>}
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
                <div><dt>Modo</dt><dd>{kind === 'none' ? 'Escolha um' : bomb ? 'Bomba' : 'Mata-mata'}</dd></div>
                <div><dt>Mapa</dt><dd>Duna</dd></div>
                {bomb ? (
                  <>
                    <div><dt>Rounds</dt><dd>primeiro a {winRounds}</dd></div>
                    <div><dt>Round</dt><dd>{Math.floor(roundSec / 60)}:{String(roundSec % 60).padStart(2, '0')}</dd></div>
                  </>
                ) : (
                  <div><dt>Tempo</dt><dd>{minutes} minutos</dd></div>
                )}
                <div><dt>Bots</dt><dd>{bots}</dd></div>
                {!bomb && <div><dt>Pontos</dt><dd>Abate {FS_POINTS.kill} · Assist. {FS_POINTS.assist}</dd></div>}
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
                    {bomb && (
                      <span className="cfl-teams" role="group" aria-label={`Time de ${m.username}`}>
                        {([0, 1] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            className={`cfh-pill${teamOfMember(m.id, i) === t ? ' on' : ''}`}
                            disabled={m.id !== me && !leader}
                            aria-pressed={teamOfMember(m.id, i) === t}
                            onClick={() => sendRoom('fsteam', { id: m.id, team: t })}
                            data-testid={`cfl-team-${m.username}-${t === 1 ? 'tr' : 'ct'}`}
                          >
                            {t === 1 ? 'TR' : 'CT'}
                          </button>
                        ))}
                      </span>
                    )}
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
              <button type="button" className={`cfl-mode${kind === 'dm' ? ' on' : ''}`} aria-pressed={kind === 'dm'} disabled={!leader} onClick={() => sendRoom('configure', { kind: 'dm' })} data-testid="cfl-mode-dm">
                <b>Mata-mata{kind === 'dm' && <em className="cfl-sel"> · selecionado</em>}</b>
                <span>Todos contra todos no Duna. Abate vale {FS_POINTS.kill} pontos, assistência {FS_POINTS.assist}. Vence quem tiver mais pontos no fim.</span>
              </button>
              <button type="button" className={`cfl-mode${bomb ? ' on' : ''}`} aria-pressed={bomb} disabled={!leader} onClick={() => sendRoom('configure', { kind: 'bomb' })} data-testid="cfl-mode-bomb">
                <b>Bomba{bomb && <em className="cfl-sel"> · selecionado</em>}</b>
                <span>Rounds de TR contra CT: os terroristas plantam a bomba, os contra-terroristas impedem. Compra só na base, dinheiro finito. Escolha o time na aba Jogadores.</span>
              </button>
              {kind === 'none' ? (
                <p className="cfl-note" data-testid="cfl-mode-none">{leader ? 'Escolha um modo para ver as regras dele.' : 'O líder ainda vai escolher o modo.'}</p>
              ) : bomb ? (
                <>
                  <h4>Rounds para vencer</h4>
                  <div className="cfh-pills" role="radiogroup" aria-label="Rounds para vencer">
                    {[4, 6, 8, 10, 13].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={winRounds === n} disabled={!leader} className={`cfh-pill${winRounds === n ? ' on' : ''}`} onClick={() => sendRoom('configure', { winRounds: n })} data-testid={`cfl-rounds-${n}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <h4>Tempo do round</h4>
                  <div className="cfh-pills" role="radiogroup" aria-label="Tempo do round">
                    {[60, 90, 115, 150, 180].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={roundSec === n} disabled={!leader} className={`cfh-pill${roundSec === n ? ' on' : ''}`} onClick={() => sendRoom('configure', { roundSec: n })} data-testid={`cfl-rsec-${n}`}>
                        {Math.floor(n / 60)}:{String(n % 60).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h4>Duração</h4>
                  <div className="cfh-pills" role="radiogroup" aria-label="Duração">
                    {FS_MATCH_MINUTES.map((m) => (
                      <button key={m} type="button" role="radio" aria-checked={minutes === m} disabled={!leader} className={`cfh-pill${minutes === m ? ' on' : ''}`} onClick={() => sendRoom('configure', { minutes: m })} data-testid={`cfl-min-${m}`}>
                        {m} min
                      </button>
                    ))}
                  </div>
                </>
              )}
              {bomb ? (
                <>
                  <h4>Bots contra-terroristas (só entram se você quiser)</h4>
                  <div className="cfh-pills" role="radiogroup" aria-label="Bots contra-terroristas">
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={botsCt === n} disabled={!leader || n + botsTr + humans > 10} className={`cfh-pill${botsCt === n ? ' on' : ''}`} onClick={() => sendRoom('configure', { botsCt: n })} data-testid={`cfl-botsct-${n}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <h4>Bots terroristas</h4>
                  <div className="cfh-pills" role="radiogroup" aria-label="Bots terroristas">
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={botsTr === n} disabled={!leader || n + botsCt + humans > 10} className={`cfh-pill${botsTr === n ? ' on' : ''}`} onClick={() => sendRoom('configure', { botsTr: n })} data-testid={`cfl-botstr-${n}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
              <h4>Bots para completar ({humans} pessoas na sala)</h4>
              <div className="cfh-pills" role="radiogroup" aria-label="Bots">
                {Array.from({ length: FS_MATCH_BOTS.max + 1 }, (_, i) => i).map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={bots === n} disabled={!leader || n > maxBots} className={`cfh-pill${bots === n ? ' on' : ''}`} onClick={() => sendRoom('configure', { bots: n })} data-testid={`cfl-bots-${n}`}>
                    {n}
                  </button>
                ))}
              </div>
                </>
              )}
              {!leader && <p className="cfl-note">Só o líder muda as regras.</p>}
            </div>
          )}

          {tab === 'convidar' && <Invite snapshot={snapshot} />}

          {tab === 'jogos' && (
            <div className="cfl-pane" data-testid="cfl-games">
              <GamePicker snapshot={snapshot} me={me} />
            </div>
          )}

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
