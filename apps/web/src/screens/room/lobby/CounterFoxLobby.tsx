import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FS_MAP_NAMES, FS_MATCH_BOTS, FS_MATCH_MINUTES, FS_POINTS, type FsMapId } from '@nocap/games';
import { ChatPanel } from '@/components/Chat';
import { chatColor } from '@/components/GameChat';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MIN_SEARCH, fetchFriends, searchUsers } from '@/lib/friends';
import { useAuth } from '@/lib/auth';
import { GamePicker } from './GamePicker';
import { CF_TO_SHELL, SHELL_TO_CF, tabMemo, type LobbyTab } from './LobbyShell';
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
  const humans = s.members.filter((m) => m.connected && !(s.foxshot?.kind === 'bomb' && s.foxshot.teams?.[m.id] === 2));
  const bots = s.foxshot?.kind === 'bomb' ? (s.foxshot.botsCt ?? 0) + (s.foxshot.botsTr ?? 0) : (s.foxshot?.bots ?? 0);
  if (humans.length < 1) return { text: 'Escolha um time na aba Sala para jogar', ok: false };
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
  // a aba aberta fica guardada por sala: ao trocar de jogo e voltar (ou o contrário) a pessoa continua na mesma aba
  const [tab, setTabState] = useState<Tab>(() => {
    const m = tabMemo.get(snapshot.code);
    return (m && m in CF_TO_SHELL ? m : m && m in SHELL_TO_CF ? SHELL_TO_CF[m as LobbyTab] : 'sala') as Tab;
  });
  const setTab = (t: Tab) => {
    tabMemo.set(snapshot.code, t);
    setTabState(t);
  };
  const [closing, setClosing] = useState(false);
  const leader = snapshot.hostId === me;
  const mine = snapshot.members.find((m) => m.id === me);
  const minutes = snapshot.foxshot?.minutes ?? 5;
  const kind = snapshot.foxshot?.kind ?? 'none';
  const bomb = kind === 'bomb';
  const pvp = bomb && !!snapshot.foxshot?.pvp;
  const botsCt = snapshot.foxshot?.botsCt ?? 0;
  const botsTr = snapshot.foxshot?.botsTr ?? 0;
  const bots = bomb ? botsCt + botsTr : (snapshot.foxshot?.bots ?? 0);
  const winRounds = snapshot.foxshot?.winRounds ?? 8;
  const mapId = (snapshot.foxshot?.map ?? 'duna') as FsMapId;
  const roundSec = snapshot.foxshot?.roundSec ?? 115;
  const teams = snapshot.foxshot?.teams ?? {};
  /** Time de uma pessoa no modo Bomba: o escolhido; sem escolha, alterna pela ordem de entrada. */
  // quem não escolheu time entra no que tem menos gente (igual à sala), então a conta bate com a partida
  const teamMap = (() => {
    const out = new Map<string, 0 | 1>();
    const cnt: [number, number] = [0, 0];
    for (const m of snapshot.members) {
      const t = teams[m.id];
      if (t === 0 || t === 1) {
        out.set(m.id, t);
        cnt[t]++;
      }
    }
    for (const m of snapshot.members) {
      if (out.has(m.id) || teams[m.id] === 2) continue;
      const t: 0 | 1 = cnt[0] <= cnt[1] ? 0 : 1;
      out.set(m.id, t);
      cnt[t]++;
    }
    return { out, cnt };
  })();
  const teamOfMember = (id: string, _i: number): 0 | 1 => teamMap.out.get(id) ?? 0;
  /** Cada time tem no máximo 5: os bots só completam o que sobra do lado de cada um. */
  const capCt = Math.max(0, 5 - teamMap.cnt[0]);
  const capTr = Math.max(0, 5 - teamMap.cnt[1]);
  /** Quem escolheu espectar no modo Bomba (assiste, não joga). */
  const specs = snapshot.members.filter((m) => bomb && teams[m.id] === 2);
  const humans = snapshot.members.length - specs.length;
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
            <span className="cfl-chip">{kind === 'none' ? 'Sem modo' : pvp ? 'PvP' : bomb ? 'Bomba' : 'Mata-mata'}</span>
            <span className="cfl-chip">Duna</span>
            {kind !== 'none' && <span className="cfl-chip">{pvp ? `${winRounds} pontos` : bomb ? `até ${winRounds} rounds` : `${minutes} min`}</span>}
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
                <div><dt>Modo</dt><dd>{kind === 'none' ? 'Escolha um' : pvp ? 'PvP' : bomb ? 'Bomba' : 'Mata-mata'}</dd></div>
                <div><dt>Mapa</dt><dd>{FS_MAP_NAMES[mapId]}</dd></div>
                {bomb ? (
                  <>
                    <div><dt>{pvp ? 'Pontos' : 'Rounds'}</dt><dd>primeiro a {winRounds}</dd></div>
                    <div><dt>Round</dt><dd>{Math.floor(roundSec / 60)}:{String(roundSec % 60).padStart(2, '0')}</dd></div>
                  </>
                ) : (
                  <div><dt>Tempo</dt><dd>{minutes} minutos</dd></div>
                )}
                <div><dt>Bots</dt><dd>{bots}</dd></div>
                {!bomb && <div><dt>Pontos</dt><dd>Abate {FS_POINTS.kill} · Assist. {FS_POINTS.assist}</dd></div>}
              </dl>
              {kind === 'dm' && (
                <div className="cfl-board dm" data-testid="cfl-dmboard">
                  <section className="cfl-team dm">
                    <h4>
                      <span>Jogadores</span>
                      <b>{humans + bots}/10</b>
                    </h4>
                    <ul>
                      {snapshot.members.map((m) => (
                        <li key={m.id} className={`p${m.id === me ? ' me' : ''}`}>
                          <i aria-hidden="true">{m.username.slice(0, 1).toUpperCase()}</i>
                          <b>{m.username}{m.id === me ? ' (você)' : ''}</b>
                          <em>{m.isHost ? 'Líder' : ''}</em>
                        </li>
                      ))}
                      {Array.from({ length: Math.max(0, Math.min(bots, 10 - humans)) }, (_, i) => (
                        <li key={`b${i}`} className="bot">
                          <i aria-hidden="true">B</i>
                          <b>Bot {i + 1}</b>
                          <em>Computador</em>
                        </li>
                      ))}
                      {Array.from({ length: Math.max(0, 10 - humans - bots) }, (_, i) => (
                        <li key={`f${i}`} className="free"><span>Vaga</span></li>
                      ))}
                    </ul>
                    {leader ? (
                      <div className="cfl-botctl" role="radiogroup" aria-label="Bots" data-testid="cfl-dmbots">
                        <span>Bots</span>
                        <div className="cfh-pills">
                          {Array.from({ length: FS_MATCH_BOTS.max + 1 }, (_, i) => i).map((n) => (
                            <button key={n} type="button" role="radio" aria-checked={bots === n} disabled={n > maxBots} className={`cfh-pill${bots === n ? ' on' : ''}`} onClick={() => sendRoom('configure', { bots: n })} data-testid={`cfl-bots-${n}`}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="cfl-note">Só o líder escolhe os bots.</p>
                    )}
                  </section>
                </div>
              )}
              {bomb && (
                <div className="cfl-board" data-testid="cfl-board">
                  {([1, 0] as const).map((t) => {
                    const key = t === 1 ? 'tr' : 'ct';
                    const people = snapshot.members.filter((m) => teamMap.out.get(m.id) === t && teams[m.id] !== 2);
                    const nBots = t === 1 ? botsTr : botsCt;
                    const free = Math.max(0, 5 - people.length - nBots);
                    const iAmHere = !!mine && people.some((m) => m.id === mine.id);
                    return (
                      <section key={key} className={`cfl-team ${key}`} data-testid={`cfl-team-${key}`}>
                        <h4>
                          <span>{t === 1 ? 'Terroristas' : 'Contra-terroristas'}</span>
                          <b>{people.length + nBots}/5</b>
                        </h4>
                        <ul>
                          {people.map((m) => (
                            <li key={m.id} className={`p${m.id === me ? ' me' : ''}`} data-testid={`cfl-slot-${key}-${m.username}`}>
                              <i aria-hidden="true">{m.username.slice(0, 1).toUpperCase()}</i>
                              <b>{m.username}{m.id === me ? ' (você)' : ''}</b>
                              <em>{m.isHost ? 'Líder' : ''}</em>
                            </li>
                          ))}
                          {Array.from({ length: nBots }, (_, i) => (
                            <li key={`b${i}`} className="bot">
                              <i aria-hidden="true">B</i>
                              <b>Bot</b>
                              <em>Computador</em>
                            </li>
                          ))}
                          {Array.from({ length: free }, (_, i) => (
                            <li key={`f${i}`} className="free">
                              {iAmHere || !mine ? (
                                <span>Vaga</span>
                              ) : (
                                <button type="button" onClick={() => sendRoom('fsteam', { id: mine.id, team: t })} data-sfx="tab" data-testid={`cfl-join-${key}`}>
                                  Vaga · entrar aqui
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                        {leader && (
                          <div className="cfl-botctl" role="group" aria-label={`Bots ${t === 1 ? 'terroristas' : 'contra-terroristas'}`}>
                            <span>Bots</span>
                            <button type="button" disabled={nBots <= 0} onClick={() => sendRoom('configure', t === 1 ? { botsTr: nBots - 1 } : { botsCt: nBots - 1 })} aria-label="Tirar um bot" data-testid={`cfl-botdown-${key}`}>−</button>
                            <b data-testid={`cfl-botn-${key}`}>{nBots}</b>
                            <button type="button" disabled={free <= 0} onClick={() => sendRoom('configure', t === 1 ? { botsTr: nBots + 1 } : { botsCt: nBots + 1 })} aria-label="Pôr um bot" data-testid={`cfl-botup-${key}`}>+</button>
                          </div>
                        )}
                      </section>
                    );
                  })}
                  <section className="cfl-spec" data-testid="cfl-spec">
                    <h4>
                      <span>Espectando</span>
                      <b>{specs.length}</b>
                    </h4>
                    <ul>
                      {specs.map((m) => (
                        <li key={m.id} className="p">
                          <i aria-hidden="true">{m.username.slice(0, 1).toUpperCase()}</i>
                          <b>{m.username}{m.id === me ? ' (você)' : ''}</b>
                        </li>
                      ))}
                      {specs.length === 0 && <li className="free"><span>Ninguém</span></li>}
                    </ul>
                    {mine && teams[mine.id] !== 2 && (
                      <button type="button" className="cfl-specbtn" onClick={() => sendRoom('fsteam', { id: mine.id, team: 2 })} data-sfx="tab" data-testid="cfl-join-spec">
                        Espectar
                      </button>
                    )}
                  </section>
                </div>
              )}
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
                      <span className="cfl-teamtag" data-testid={`cfl-tag-${m.username}`}>
                        {teams[m.id] === 2 ? 'Espectando' : teamOfMember(m.id, i) === 1 ? 'TR' : 'CT'}
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
              <button type="button" className={`cfl-mode${kind === 'dm' ? ' on' : ''}`} aria-pressed={kind === 'dm'} disabled={!leader} onClick={() => sendRoom('configure', { kind: 'dm', pvp: false, map: 'duna', winRounds: 8, roundSec: 115 })} data-testid="cfl-mode-dm">
                <b>Mata-mata{kind === 'dm' && <em className="cfl-sel"> · selecionado</em>}</b>
                <span>Todos contra todos no Duna. Abate vale {FS_POINTS.kill} pontos, assistência {FS_POINTS.assist}. Vence quem tiver mais pontos no fim.</span>
              </button>
              <button type="button" className={`cfl-mode${bomb && !pvp ? ' on' : ''}`} aria-pressed={bomb && !pvp} disabled={!leader} onClick={() => sendRoom('configure', { kind: 'bomb', pvp: false, map: 'duna', winRounds: 8, roundSec: 115 })} data-testid="cfl-mode-bomb">
                <b>Bomba{bomb && !pvp && <em className="cfl-sel"> · selecionado</em>}</b>
                <span>Rounds de TR contra CT: os terroristas plantam a bomba, os contra-terroristas impedem. Compra só na base, dinheiro finito. Os times e os bots ficam na aba Sala.</span>
              </button>
              <button type="button" className={`cfl-mode${pvp ? ' on' : ''}`} aria-pressed={pvp} disabled={!leader} onClick={() => sendRoom('configure', { kind: 'bomb', pvp: true, map: 'pvp', winRounds: 5, roundSec: 120 })} data-testid="cfl-mode-pvp">
                <b>PvP{pvp && <em className="cfl-sel"> · selecionado</em>}</b>
                <span>1x1, 2x2, 2x1 e mais, na arena de blocos: sem bomba, dinheiro infinito na compra. Morreu, assiste; o time que cair inteiro perde o ponto. Times, bots e quem só assiste ficam na aba Sala.</span>
              </button>
              {kind === 'none' ? (
                <p className="cfl-note" data-testid="cfl-mode-none">{leader ? 'Escolha um modo para ver as regras dele.' : 'O líder ainda vai escolher o modo.'}</p>
              ) : bomb ? (
                <>
                  <h4>{pvp ? 'Pontos para vencer' : 'Rounds para vencer'}</h4>
                  <div className="cfh-pills" role="radiogroup" aria-label="Rounds para vencer">
                    {(pvp ? [1, 3, 5, 10, 15, 20, 30] : [4, 6, 8, 10, 13]).map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={winRounds === n} disabled={!leader} className={`cfh-pill${winRounds === n ? ' on' : ''}`} onClick={() => sendRoom('configure', { winRounds: n })} data-testid={`cfl-rounds-${n}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <h4>Tempo do round</h4>
                  <div className="cfh-pills" role="radiogroup" aria-label="Tempo do round">
                    {(pvp ? [30, 60, 90, 120, 180, 300] : [60, 90, 115, 150, 180]).map((n) => (
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
