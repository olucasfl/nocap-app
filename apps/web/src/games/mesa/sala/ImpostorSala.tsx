import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { IM_CATEGORIES, IM_ELIM_MAX_ROUNDS, IM_MAX_ROUNDS, IM_MIN_PLAYERS, IM_WHITE_MIN_PLAYERS, imImpostorLimit, type ImMode } from '@nocap/games';
import { InvitePanel } from '@/screens/room/lobby/InvitePanel';
import { leaveRoom, sendRoom } from '@/lib/rooms';
import { RankSlot } from '../impostor/ui';
import { CATEGORY_ICONS, preloadImages } from '../impostor/assets';
import { SalaChatButton } from './SalaChat';
import { nameOf, useLooks, type Snap } from './looks';
import { play, preloadSounds } from '../impostor/audio';
import { CategorySheet, MODES, TIMES, fmtTime } from '../impostor/screens';
import type { Action, State } from '../impostor/state';
import { Alert, AskCtx, Ceremony, ArrowIcon, Coin, Confirm, GearIcon, Icon, Primary, Stepper, Switch, TopBar, Words, useAsk, useFlash, type AskCfg } from '../impostor/ui';
import '../impostor/impostor.css';

type Cfg = { rounds: number; impostors: number; talkMs: number; hint: boolean; voteMode: 'final' | 'elim'; revealRoles: boolean; categories: string[]; filters: Record<string, Record<string, string[]>> };

/** O Impostor em sala (spec 088): lobby, partida e ranking com o mesmo visual do modo Mesa, cada pessoa no seu celular. */
export function ImpostorSala({ snapshot }: { snapshot: Snap }) {
  const [ask, setAsk] = useState<AskCfg | null>(null);
  const askFn = useCallback((c: AskCfg) => setAsk(c), []);
  useEffect(() => {
    preloadImages();
    const first = () => preloadSounds();
    window.addEventListener('pointerdown', first, { once: true });
    return () => window.removeEventListener('pointerdown', first);
  }, []);
  const phase = snapshot.phase;
  // cartelas de transição, iguais às da mesa
  const mesaS = snapshot.mesa;
  const games = mesaS?.session.games ?? 0;
  const wrong = mesaS?.mode === 'wrong';
  const sp: { key: string; title: string; sub: string } | null =
    phase === 'show' ? { key: `show-${games}`, title: `${games + 1}ª partida`, sub: 'Cada um vê o seu papel' }
    : phase === 'play' ? { key: `play-${games}-${mesaS?.clueRound ?? 1}`, title: wrong ? 'Hora de responder' : 'Hora de dizer', sub: wrong ? 'Uma resposta de cada um' : 'Uma palavra de cada um' }
    : phase === 'pick' ? { key: `pick-${games}`, title: 'Debate', sub: 'Conversem e descubram' }
    : phase === 'vote' ? { key: `vote-${games}-${mesaS?.clueRound ?? 1}-${mesaS?.revote ? 'r' : ''}`, title: mesaS?.voteMode === 'elim' ? (mesaS.revote ? 'Desempate' : 'Hora de eliminar') : 'Hora de votar', sub: mesaS?.revote ? 'Só nos empatados' : 'Um de cada vez' }
    : phase === 'reveal' && mesaS?.stage === 'score' ? { key: `score-${games}`, title: 'Ranking', sub: 'Os pontos desta partida' }
    : null;
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const noSplash = (() => { try { return localStorage.getItem('im-nosplash') === '1'; } catch { return false; } })();
  const showSplash = !!sp && sp.key !== doneKey && !noSplash;
  useEffect(() => {
    if (!sp || sp.key === doneKey) return undefined;
    const ms = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 700 : 1500;
    const t = window.setTimeout(() => setDoneKey(sp.key), ms);
    return () => window.clearTimeout(t);
  }, [sp?.key, doneKey]);
  const key = `${phase}-${snapshot.mesa?.stage ?? ''}-${snapshot.mesa?.speaker ?? ''}-${snapshot.mesa?.clueRound ?? 0}`;
  return (
    <div className="im-app" data-testid="sala-app" data-phase={phase}>
      <div className="im-lamp" aria-hidden="true" />
      <AskCtx.Provider value={askFn}>
        <RankSlot.Provider value={<SalaChatButton snap={snapshot} />}>
        {showSplash && sp ? (
          <div className="im-splash" data-testid="sala-splash" key={sp.key} onClick={() => setDoneKey(sp.key)}>
            <span className="im-splash-bar" aria-hidden="true" />
            <span className="im-splash-t" role="status">{sp.title}</span>
            <span className="im-splash-s">{sp.sub}</span>
          </div>
        ) : (
        <div key={key} className="im-view">
          {phase === 'lobby' && <Lobby snap={snapshot} />}
          {phase === 'show' && <SeeRole snap={snapshot} />}
          {phase === 'play' && <Clues snap={snapshot} />}
          {phase === 'pick' && <Debate snap={snapshot} />}
          {phase === 'vote' && <Vote snap={snapshot} />}
          {phase === 'reveal' && <Reveal snap={snapshot} />}
          {phase === 'final' && <Final snap={snapshot} />}
        </div>
        )}
        </RankSlot.Provider>
        {ask && <Confirm cfg={ask} onClose={() => setAsk(null)} />}
      </AskCtx.Provider>
    </div>
  );
}

/* ---------- Sair da sala ---------- */
function useLeaveRoom() {
  const ask = useAsk();
  return () =>
    ask({
      title: 'Sair da sala?',
      text: 'Você deixa a mesa. Se a partida estiver rolando, ela segue sem você.',
      confirm: 'Sair da sala',
      cancel: 'Ficar',
      danger: true,
      onConfirm: () => void leaveRoom(),
    });
}

/* ---------- Lobby ---------- */
function Lobby({ snap }: { snap: Snap }) {
  const me = snap.me ?? undefined;
  const isHost = snap.hostId === me;
  const mine = snap.members.find((m) => m.id === me);
  const looks = useLooks(snap);
  const leave = useLeaveRoom();
  const ask = useAsk();
  const [tab, setTab] = useState<'mesa' | 'regras' | 'convidar'>('mesa');
    const [sheet, setSheet] = useState<string | null>(null);
  const [flash, show, clear] = useFlash();
  const cfg = snap.settings as unknown as Cfg;
  const mode = snap.mode as ImMode;
  const connected = snap.members.filter((m) => m.connected);
  const tooFew = connected.length < IM_WHITE_MIN_PLAYERS;
  const lacking = connected.filter((m) => !m.isHost && !m.ready).length;
  const elimMode = cfg.voteMode === 'elim';
  const max = imImpostorLimit(Math.max(connected.length, IM_MIN_PLAYERS), cfg.voteMode);
  const imp = Math.min(cfg.impostors, max);
  const ti = Math.max(0, TIMES.indexOf(Math.round(cfg.talkMs / 1000)));
  const [copied, setCopied] = useState(false);

  const set = (patch: Record<string, unknown>) => {
    clear();
    sendRoom('configure', patch);
  };
  /** O sheet de temas fala o idioma do modo Mesa (reducer); aqui cada ação vira uma regra enviada à sala. */
  const adapter = useMemo(() => {
    const s = { settings: { ...cfg, mode, talkSeconds: cfg.talkMs / 1000 }, players: snap.members } as unknown as State;
    const d = (a: Action) => {
      if (a.type === 'filter') {
        const cur = cfg.filters?.[a.category]?.[a.tag] ?? [];
        const next = cur.includes(a.value) ? cur.filter((v) => v !== a.value) : [...cur, a.value];
        sendRoom('configure', { filters: { ...cfg.filters, [a.category]: { ...cfg.filters?.[a.category], [a.tag]: next } } });
      } else if (a.type === 'toggleCategory') {
        const has = cfg.categories.includes(a.id);
        sendRoom('configure', { categories: has ? cfg.categories.filter((c) => c !== a.id) : [...cfg.categories, a.id] });
      }
    };
    return { s, d };
  }, [cfg, mode, snap.members]);

  const start = () => {
    if (cfg.categories.length === 0) {
      setTab('regras');
      return show('Escolha pelo menos 1 tema na aba Regras antes de começar.');
    }
    if (connected.length < IM_MIN_PLAYERS) return show(`São precisos pelo menos ${IM_MIN_PLAYERS} jogadores. Faltam ${IM_MIN_PLAYERS - connected.length}.`);
    if (lacking > 0) return show(`Falta gente marcar "pronto" (${lacking}).`);
    play('shuffle');
    sendRoom('start');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snap.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      play('confirm');
    } catch {
      /* sem permissão: o código está na tela */
    }
  };

  return (
    <div className="im-screen" data-testid="sala-lobby">
      <TopBar leave onBack={leave} center={<button type="button" className="im-code" aria-label="Copiar o código da sala" data-testid="sala-code" onClick={copy}>{copied ? 'Copiado' : snap.code}</button>} right={<span className="im-toprow"><SalaChatButton snap={snap} /></span>} />
      <div className="im-body">
        <h2 className="im-t"><Words text={tab === 'mesa' ? 'Sala do Impostor' : tab === 'regras' ? 'Como vai ser?' : 'Chame a galera'} /></h2>
        <div className="im-seg" role="tablist" aria-label="Sala">
          <button type="button" role="tab" aria-selected={tab === 'mesa'} onClick={() => { play('select'); setTab('mesa'); }} data-testid="sala-tab-mesa">Jogadores · {connected.length}</button>
          <button type="button" role="tab" aria-selected={tab === 'regras'} onClick={() => { play('select'); setTab('regras'); }} data-testid="sala-tab-regras">Regras</button>
          <button type="button" role="tab" aria-selected={tab === 'convidar'} onClick={() => { play('select'); setTab('convidar'); }} data-testid="sala-tab-convidar">Convidar</button>
        </div>
        {tab === 'convidar' && <div className="im-invite" data-testid="sala-invite-panel"><InvitePanel snapshot={snap} /></div>}

        {tab === 'mesa' && (
          <ul className="im-plist">
            {snap.members.map((m, i) => {
              const lk = looks(m.id);
              return (
                <li key={m.id} className="im-prow" style={{ '--i': i } as CSSProperties}>
                  <Coin avatar={lk.avatar} color={lk.color} size="sm" />
                  <b>{m.id === me ? `${m.username} (você)` : m.username}{m.isHost && <span className="im-tag">líder</span>}</b>
                  <span className={`im-state${m.isHost || m.ready || m.committed ? ' ok' : ''}`}>{!m.connected ? 'saiu' : m.isHost ? '' : m.ready || m.committed ? 'pronto' : 'esperando'}</span>
                  {isHost && !m.isHost && (
                    <button type="button" className="im-x" aria-label={`Tirar ${m.username}`} onClick={() => ask({ title: `Tirar ${m.username} da sala?`, text: 'A pessoa sai da sala e precisa do código para voltar.', confirm: 'Tirar da sala', danger: true, onConfirm: () => sendRoom('kick', { id: m.id }) })}>×</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {tab === 'regras' && (
          <>
            {isHost ? (
              <>
                <div className="im-modes" role="radiogroup" aria-label="Modo de jogo">
                  {MODES.map((m) => {
                    const off = m.id === 'white' && tooFew;
                    return (
                      <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className="im-mode" style={{ '--c': m.tone } as CSSProperties} aria-disabled={off} data-testid={`sala-mode-${m.id}`} onClick={() => { if (off) { play('off'); show(`"Sem palavra" precisa de pelo menos ${IM_WHITE_MIN_PLAYERS} jogadores. Vocês são ${connected.length}.`); return; } play('select'); set({ mode: m.id }); }}>
                        <Icon name={m.icon} size={64} className="im-mode-ic" />
                        <b>{m.label}</b>
                      </button>
                    );
                  })}
                </div>
                <p className="im-modedesc" key={mode}>{MODES.find((m) => m.id === mode)?.desc}</p>
                <div className="im-rows">
                  <div className="im-row votemode"><div><b>Como votar</b><small>{elimMode ? 'A cada rodada a mesa vota e uma pessoa é eliminada. Quem sai só assiste. Inocentes vencem eliminando todos os impostores; impostores vencem se sobrarem tantos quanto os inocentes ou se as rodadas acabarem.' : 'Todos dão as dicas nas rodadas, depois conversam e votam uma vez só em quem acham que é o impostor.'}</small></div>
                    <div className="im-seg im-seg2" role="radiogroup" aria-label="Como votar">
                      {([['final', 'Voto final'], ['elim', 'Eliminação']] as const).map(([v, label]) => (
                        <button key={v} type="button" role="radio" aria-checked={cfg.voteMode === v} data-testid={`sala-howvote-${v}`} onClick={() => { play('select'); set({ voteMode: v }); }}>{label}</button>
                      ))}
                    </div></div>
                  {(mode !== 'wrong' || elimMode) && <div className="im-row"><div><b>Rodadas de dicas</b><small>{elimMode ? 'Cada rodada termina com uma eliminação.' : 'Quantas vezes cada um dá sua dica. Em cada rodada, cada pessoa diz uma palavra sobre o tema, uma de cada vez.'}</small></div><Stepper value={elimMode && imp > 0 ? Math.max(cfg.rounds, imp + 1) : cfg.rounds} label="rodadas" min={1} max={elimMode ? IM_ELIM_MAX_ROUNDS : IM_MAX_ROUNDS} onChange={(n) => set({ rounds: n })} /></div>}
                  <div className="im-row"><div><b>Impostores</b><small>{imp === 0 ? 'Número surpresa' : `Máximo para ${connected.length}: ${max}${elimMode ? ' (menos da metade da mesa)' : ''}`}</small></div><Stepper value={imp} label="impostores" min={0} max={max} format={(n) => (n === 0 ? '?' : String(n))} onChange={(n) => set({ impostors: n })} /></div>
                  {!elimMode && <div className="im-row"><div><b>Debate</b><small>Depois das dicas, todos conversam por esse tempo para descobrir quem é o impostor. Depois vem a votação.</small></div><Stepper value={ti} label="tempo do debate" min={0} max={TIMES.length - 1} format={(n) => fmtTime(TIMES[n]!)} onChange={(n) => set({ talkMs: TIMES[n]! * 1000 })} /></div>}
                  {elimMode && (cfg.impostors === 0 || imp >= 2) && <div className="im-row"><div><b>Mostrar quem era</b><small>Ao eliminar alguém, a tela mostra se era inocente ou impostor. Desligado, o papel de quem sai fica em segredo e o jogo só revela no fim.</small></div><Switch on={cfg.revealRoles} label="Mostrar quem era" onChange={(v) => set({ revealRoles: v })} /></div>}
                  {mode === 'classic' && cfg.categories.length > 2 && <div className="im-row"><div><b>Dica de categoria</b><small>O impostor vê o tema da palavra. Só aparece com mais de 2 temas.</small></div><Switch on={cfg.hint} label="Dica de categoria" onChange={(v) => set({ hint: v })} /></div>}
                </div>
                <p className="im-instr" data-testid="sala-instr">Selecione os temas para sortear</p>
                <div className="im-tiles">
                  {IM_CATEGORIES.map((c) => {
                    const on = cfg.categories.includes(c.id);
                    return (
                      <div key={c.id} className="im-tilewrap">
                        <button type="button" className="im-tile" aria-pressed={on} data-testid={`sala-cat-${c.id}`} onClick={() => { play('select'); clear(); adapter.d({ type: 'toggleCategory', id: c.id }); }}>
                          <Icon name={CATEGORY_ICONS[c.id]!} size={64} className="im-tile-ic" />
                          <span>{c.label}</span>
                        </button>
                        {on && <button type="button" className="im-edtheme" data-testid={`sala-edit-${c.id}`} aria-label={`Editar tema ${c.label}`} onClick={() => { play('tap'); setSheet(c.id); }}><GearIcon />Editar tema</button>}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="im-readonly">
                <p className="im-sub">Só quem criou a sala muda as regras.</p>
                <div className="im-rows">
                  <div className="im-row"><div><b>{MODES.find((m) => m.id === mode)?.label}</b><small>{MODES.find((m) => m.id === mode)?.desc}</small></div></div>
                  <div className="im-row"><div><b>{elimMode ? 'Eliminação a cada rodada' : mode === 'wrong' ? 'Cada um responde uma vez' : `${cfg.rounds} ${cfg.rounds === 1 ? 'rodada' : 'rodadas'} de dicas`}</b><small>{cfg.impostors === 0 ? 'Impostores: surpresa' : `${cfg.impostors} ${cfg.impostors === 1 ? 'impostor' : 'impostores'}`} · debate {fmtTime(Math.round(cfg.talkMs / 1000))}</small></div></div>
                  <div className="im-row themes"><div className="im-themes-h"><b>Temas</b></div>
                    <div className="im-pills">
                      {cfg.categories.length === 0 && <span className="im-sub">Quem criou a sala ainda não escolheu.</span>}
                      {cfg.categories.map((id) => (
                        <span key={id} className="im-chip static"><Icon name={CATEGORY_ICONS[id]!} size={28} />{IM_CATEGORIES.find((c) => c.id === id)?.label}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {flash && <div className="im-foot-alert"><Alert n={flash.n}>{flash.m}</Alert></div>}
      <div className="im-foot">
        {isHost ? (
          <Primary sound={null} testId="sala-start" onClick={start}>Começar <ArrowIcon /></Primary>
        ) : (
          <Primary sound="confirm" tone={mine?.ready || mine?.committed ? 'ghost' : 'orange'} testId="sala-ready" onClick={() => sendRoom('ready', { ready: !(mine?.ready || mine?.committed) })}>
            {mine?.ready || mine?.committed ? 'Pronto! Toque para desfazer' : 'Estou pronto'}
          </Primary>
        )}
      </div>
      {sheet && <CategorySheet s={adapter.s} d={adapter.d} id={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

/* ---------- Ver o papel ---------- */
function SeeRole({ snap }: { snap: Snap }) {
  const mesa = snap.mesa!;
  const me = mesa.me;
  const looks = useLooks(snap);
  const leave = useLeaveRoom();
  const [on, setOn] = useState(false);
  const [looked, setLooked] = useState(!!me?.wasSeen);
  useEffect(() => { play('pass'); }, []);
  if (!me) return <Waiting snap={snap} text="A partida já começou. Você entra na próxima." />;
  const wrong = mesa.mode === 'wrong';
  const tag = me.kind === 'white' ? 'Você está' : me.kind === 'impostor' && me.knowsRole ? (me.hint ? 'Tema' : 'Você é o') : wrong ? 'Sua pergunta' : 'A palavra é';
  const text = me.kind === 'white' ? 'Sem palavra' : me.kind === 'impostor' && me.knowsRole ? (me.hint ?? 'Impostor') : (me.text ?? '');
  const show = () => { if (!on) { setOn(true); play('reveal'); } };
  const hide = () => { if (on) { setOn(false); setLooked(true); } };
  const outsider = me.kind !== 'civil' && me.knowsRole;
  const lk = looks(snap.me!);
  const done = mesa.seen?.length ?? 0;
  const total = mesa.participants?.length ?? 0;
  return (
    <div className="im-screen im-centered" data-testid="sala-role">
      <TopBar leave onBack={leave} center={<span className="im-status">{done} de {total} viram</span>} />
      <div className="im-body im-mid">
        <Coin avatar={lk.avatar} color={lk.color} size="lg" className="im-rise" />
        <p className="im-hint">Só você olha. Segure o círculo.</p>
        <button type="button" className={`im-hold${on ? ' on' : ''}`} aria-label="Segure para ver o seu papel" data-testid="sala-hold"
          onPointerDown={(e) => { e.preventDefault(); show(); }} onPointerUp={hide} onPointerLeave={hide} onPointerCancel={hide} onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); show(); } }} onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') hide(); }}>
          <span className="im-lbl">Segure<br />para ver</span>
          <span className={`im-secret${outsider ? ' bad' : ''}`} aria-live="polite"><small>{on ? tag : ''}</small><strong className={wrong ? 'q' : ''} data-testid="sala-secret">{on ? text : ''}</strong>{on && me.theme && <em className="im-theme">Tema: {me.theme}</em>}</span>
        </button>
      </div>
      <div className="im-foot">
        {mesa.seen?.includes(snap.me!) ? <p className="im-sub">Pronto! Esperando os outros...</p> : (
          <Primary testId="sala-seen" disabled={!looked} sound="confirm" onClick={() => sendRoom('seen')}>Já vi <ArrowIcon /></Primary>
        )}
      </div>
    </div>
  );
}

function Waiting({ text }: { snap?: Snap; text: string }) {
  const leave = useLeaveRoom();
  return (
    <div className="im-screen im-centered" data-testid="sala-wait">
      <TopBar leave onBack={leave} />
      <div className="im-body im-mid"><Icon name="ampulheta" size={96} className="im-hourglass big" /><p className="im-sub">{text}</p></div>
      <div className="im-foot" />
    </div>
  );
}

/* ---------- Dicas na vez ---------- */
function Clues({ snap }: { snap: Snap }) {
  const mesa = snap.mesa!;
  const me = snap.me ?? '';
  const looks = useLooks(snap);
  const leave = useLeaveRoom();
  const [word, setWord] = useState('');
  const [flash, show] = useFlash();
  const mine = mesa.speaker === me;
  const total = mesa.elim ? mesa.elim.total : mesa.mode === 'wrong' ? 1 : snap.settings.rounds;
  const out = !!mesa.alive && !mesa.alive.includes(me) && !!mesa.participants?.some((p) => p.id === me);
  const speaker = mesa.speaker ? { id: mesa.speaker, name: nameOf(snap, mesa.speaker) } : null;
  const left = useCountdown(snap.round?.endsAt ?? null);
  useEffect(() => { if (mine) play('pass'); }, [mine]);
  const send = (e?: FormEvent) => {
    e?.preventDefault();
    const w = word.trim();
    if (!w) return show('Digite a sua dica (uma palavra só).');
    if (/\s/.test(w)) return show('A dica é uma palavra só, sem espaços.');
    play('vote');
    sendRoom('clue', { word: w });
    setWord('');
  };
  const clues = (mesa.clues ?? []).filter((c) => c.word);
  return (
    <div className="im-screen" data-testid="sala-clues">
      <TopBar leave onBack={leave} center={<span className="im-status">Rodada {mesa.clueRound} de {total}</span>} />
      <div className="im-body">
        {out && <p className="im-sub center" data-testid="sala-out">Você foi eliminado(a). Agora só assiste.</p>}
        {speaker && (
          <div className="im-whovotes">
            <Coin avatar={looks(speaker.id).avatar} color={looks(speaker.id).color} size="md" />
            <div><p className="im-hint">{mine ? 'É a sua vez' : 'Vez de'}</p><b className="im-votername">{mine ? 'Dê a sua dica' : speaker.name}</b></div>
            <Icon name="olhos" size={44} className="im-eyes" />
          </div>
        )}
        {mine ? (
          <form className="im-add wide" onSubmit={send}>
            <input id="sala-clue" data-testid="sala-clue-input" value={word} onChange={(e) => setWord(e.target.value)} placeholder="Uma palavra" maxLength={24} autoComplete="off" autoCapitalize="none" aria-label="Sua dica" aria-invalid={!!flash} />
            <button className="im-iconbtn pri" aria-label="Enviar dica" data-testid="sala-clue-send"><ArrowIcon /></button>
          </form>
        ) : (
          <p className="im-sub center">Espere a dica de {speaker?.name ?? 'quem está na vez'}. {left !== null && `(${left} s)`}</p>
        )}
        <ul className="im-clues" aria-label="Dicas até agora">
          {clues.map((c, i) => (
            <li key={i} className="im-clue">
              <Coin avatar={looks(c.id).avatar} color={looks(c.id).color} size="sm" />
              <span className="im-clue-n">{nameOf(snap, c.id)}</span>
              <b>{c.word}</b>
              <small>R{c.round}</small>
            </li>
          ))}
          {clues.length === 0 && <li className="im-sub center">As dicas aparecem aqui.</li>}
        </ul>
      </div>
      {flash && <div className="im-foot-alert"><Alert n={flash.n}>{flash.m}</Alert></div>}
      <div className="im-foot">{mine && <Primary sound={null} testId="sala-clue-send2" onClick={() => send()}>Enviar dica <ArrowIcon /></Primary>}</div>
    </div>
  );
}

function useCountdown(endsAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === null) return undefined;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [endsAt]);
  if (endsAt === null) return null;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/* ---------- Debate ---------- */
function Debate({ snap }: { snap: Snap }) {
  const mesa = snap.mesa!;
  const me = snap.me ?? '';
  const looks = useLooks(snap);
  const leave = useLeaveRoom();
  const total = Math.round((snap.settings as unknown as Cfg).talkMs / 1000);
  const left = useCountdown(snap.round?.endsAt ?? null);
  const wanted = mesa.wantVote ?? [];
  const mineWant = wanted.includes(me);
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (left !== null && left > 0 && left <= 10 && lastTick.current !== left) { lastTick.current = left; play('tick'); }
    if (left === 0 && lastTick.current !== 0) { lastTick.current = 0; play('timeup'); }
  }, [left]);
  const C = 2 * Math.PI * 105;
  const low = left !== null && left <= 10 && left > 0;
  const clues = (mesa.clues ?? []).filter((c) => c.word);
  return (
    <div className="im-screen im-centered" data-testid="sala-debate">
      <TopBar leave onBack={leave} center={<span className="im-status">Debate · {wanted.length} de {mesa.participants?.length ?? 0} querem votar</span>} />
      <div className="im-body im-mid">
        {total > 0 && left !== null ? (
          <div className={`im-timer${low ? ' low' : ''}`} role="timer" aria-label="Tempo do debate">
            <svg viewBox="0 0 240 240" aria-hidden="true"><circle className="tr" cx="120" cy="120" r="105" /><circle className="pr" cx="120" cy="120" r="105" strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} /></svg>
            <output>{left === 0 ? 'Tempo!' : fmtTime(left)}</output>
            <Icon name="ampulheta" size={44} className="im-hourglass" />
          </div>
        ) : <div className="im-timer free"><Icon name="ampulheta" size={120} className="im-hourglass big" /></div>}
        <ul className="im-clues compact" aria-label="Dicas da partida">
          {clues.map((c, i) => (
            <li key={i} className="im-clue"><Coin avatar={looks(c.id).avatar} color={looks(c.id).color} size="sm" /><span className="im-clue-n">{nameOf(snap, c.id)}</span><b>{c.word}</b></li>
          ))}
        </ul>
      </div>
      <div className="im-foot">
        <Primary sound="confirm" tone={mineWant ? 'ghost' : 'orange'} disabled={!mesa.participants?.some((p) => p.id === me)} testId="sala-tovote" onClick={() => sendRoom('tovote')}>
          {mineWant ? 'Esperando os outros...' : 'Quero votar'} {!mineWant && <ArrowIcon />}
        </Primary>
      </div>
    </div>
  );
}

/* ---------- Voto ---------- */
function Vote({ snap }: { snap: Snap }) {
  const mesa = snap.mesa!;
  const me = snap.me ?? '';
  const looks = useLooks(snap);
  const leave = useLeaveRoom();
  const left = useCountdown(snap.round?.endsAt ?? null);
  const elim = mesa.voteMode === 'elim';
  const alive = mesa.alive ?? (mesa.participants ?? []).map((p) => p.id);
  const canVote = alive.includes(me);
  const cands = (mesa.cands ?? alive).filter((id) => id !== me);
  const [sel, setSel] = useState<string | null>(mesa.myVote ?? null);
  const tieKey = (mesa.cands ?? []).join(',');
  useEffect(() => { setSel(null); }, [tieKey, mesa.revote]);
  const voted = mesa.voted ?? [];
  const iVoted = voted.includes(me);
  const tieNames = (mesa.cands ?? []).map((id) => nameOf(snap, id)).join(' e ');
  return (
    <div className="im-screen" data-testid="sala-vote">
      <TopBar leave onBack={leave} center={<span className="im-status">{elim ? 'Eliminação' : 'Votação'} · {voted.length} de {alive.length}{left !== null ? ` · ${left} s` : ''}</span>} />
      <div className="im-body">
        <h2 className="im-t im-lupa-t"><Icon name="lupa" size={52} className="im-lupa" /><Words text={elim ? 'Quem vai ser eliminado(a)?' : 'Quem é o impostor?'} /></h2>
        {elim && mesa.revote && <span className="im-banner warn" data-testid="sala-tie">Empate! Só vale votar em {tieNames}</span>}
        {!canVote && <p className="im-sub center" data-testid="sala-out">Você foi eliminado(a). Agora só assiste à votação.</p>}
        <div className="im-vgrid">
          {cands.map((id, i) => (
            <button key={id} type="button" className="im-vote im-rise" style={{ '--d': (i % 4) + 1 } as CSSProperties} aria-pressed={sel === id} disabled={!canVote} data-testid={`sala-vote-${id}`} onClick={() => { play('select'); setSel(id); }}>
              <Coin avatar={looks(id).avatar} color={looks(id).color} size="lg" />
              <span>{nameOf(snap, id)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="im-foot">
        <Primary disabled={!sel || !canVote} sound="vote" testId="sala-cast" onClick={() => sel && sendRoom('cast', { id: sel })}>
          {!canVote ? 'Só assistindo' : !sel ? 'Escolha alguém' : iVoted && mesa.myVote === sel ? 'Voto enviado. Toque para trocar' : iVoted ? 'Trocar o meu voto' : 'Confirmar voto'}
        </Primary>
      </div>
    </div>
  );
}

/* ---------- Resultado ---------- */
function Reveal({ snap }: { snap: Snap }) {
  const mesa = snap.mesa!;
  const r = mesa.result;
  const me = snap.me ?? '';
  const looks = useLooks(snap);
  const leave = useLeaveRoom();
  const ask = useAsk();
  const isHost = snap.hostId === me;
  const win = r?.innocentsWin === true;
  const onReveal = useCallback(() => play('reveal'), []);
  useEffect(() => {
    if (mesa.stage !== 'score') return undefined;
    const t = window.setTimeout(() => play('rankcalm'), 500);
    return () => window.clearTimeout(t);
  }, [mesa.stage]);
  if (mesa.stage === 'elim' && mesa.elim) return <ElimView snap={snap} />;
  if (!r) return <Waiting snap={snap} text="Contando os votos..." />;
  const lead = new Set(mesa.session.leaders);
  if (mesa.stage === 'reveal') {
    const outsiders = r.outsiders ?? [];
    const hit = (id: string) => outsiders.includes(r.votes?.[id] ?? '');
    const voters = (mesa.participants ?? []).filter((p) => !outsiders.includes(p.id)).sort((a, b) => Number(hit(b.id)) - Number(hit(a.id)));
    return (
      <div className="im-screen im-centered im-tense lit" data-testid="sala-reveal">
        <TopBar center={<span className="im-status">Resultado</span>} />
        <div className="im-body im-mid im-revbody">
          <Ceremony
            many={outsiders.length > 1}
            onReveal={onReveal}
            culprits={outsiders.map((id) => ({ id, name: nameOf(snap, id), coin: <Coin avatar={looks(id).avatar} color={looks(id).color} size={outsiders.length > 1 ? 'lg' : 'xl'} /> }))}
            voters={voters.map((p) => ({ id: p.id, name: p.name, coin: <Coin avatar={looks(p.id).avatar} color={looks(p.id).color} size="sm" />, hit: hit(p.id) }))}
          />
        </div>
        <div className="im-foot"><p className="im-sub center">Já já vem o ranking...</p></div>
      </div>
    );
  }
  const rows = mesa.session.ranking;
  const outs = r.outsiders ?? [];
  return (
    <div className="im-screen" data-testid="sala-score">
      <TopBar leave onBack={leave} center={<span className="im-status">Partida {mesa.session.games}</span>} />
      <div className="im-body">
        <div>
          <h2 className="im-t"><Words text={win ? 'Inocentes venceram' : 'Impostores venceram'} /></h2>
          <p className="im-sub im-rise" style={{ '--d': 2 } as CSSProperties}>A palavra era <b>{r.word}</b>{r.similar && mesa.mode !== 'wrong' ? ` · parecida: ${r.similar}` : ''}</p>
          <p className="im-sub im-rise" style={{ '--d': 3 } as CSSProperties}>{outs.length === 1 ? 'O impostor era' : 'Os impostores eram'}: {outs.map((id) => nameOf(snap, id)).join(', ')}</p>
        </div>
        <ol className="im-score" aria-label="Ranking da sessão">
          {rows.map((row, i) => {
            const g = r.gains?.[row.id] ?? 0;
            return (
              <li key={row.id} className={`im-srow${lead.has(row.id) ? ' lead' : ''}`} style={{ '--i': i } as CSSProperties}>
                <span className="im-pos">{row.position}</span>
                <span className="im-cw"><Coin avatar={looks(row.id).avatar} color={looks(row.id).color} size="sm" />{lead.has(row.id) && <Icon name="coroa" size={34} className="im-crown" />}</span>
                <b>{nameOf(snap, row.id)}</b>
                {g > 0 && <span className="im-gain">+{g}</span>}
                <span className="im-pts">{row.points}<small>pts</small></span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="im-foot im-endfoot">
        {isHost ? (
          <>
            <Primary testId="sala-continue" onClick={() => sendRoom('continue')}>Continuar jogando <ArrowIcon /></Primary>
            <button type="button" className="im-link" data-testid="sala-end" onClick={() => ask({ title: 'Encerrar a partida?', text: 'O ranking final aparece para todos e a sessão termina.', confirm: 'Encerrar', danger: true, onConfirm: () => sendRoom('end') })}>Encerrar partida</button>
          </>
        ) : <p className="im-sub center">Esperando quem criou a sala: continuar ou encerrar.</p>}
      </div>
    </div>
  );
}

/* ---------- Eliminação: quem saiu nesta rodada ---------- */
function ElimView({ snap }: { snap: Snap }) {
  const mesa = snap.mesa!;
  const el = mesa.elim!;
  const step = el.steps[el.steps.length - 1]!;
  const looks = useLooks(snap);
  const leave = useLeaveRoom();
  const winner = el.winner;
  const isOutsider = step.role !== null && step.role !== 'civil';
  const out = looks(step.out);
  const voteList = Object.entries(step.votes).filter(([, t]) => t === step.out).map(([v]) => nameOf(snap, v));
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const ts = [
      window.setTimeout(() => { setStage(1); play('reveal'); }, 2200),
      window.setTimeout(() => setStage(2), 3800),
      window.setTimeout(() => { setStage(3); if (winner) play(winner === 'innocents' ? 'win' : 'lose'); }, 5400),
    ];
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, [winner]);
  const lastOne = el.steps.length >= el.total;
  return (
    <div className={`im-screen im-centered im-tense${stage >= 1 ? ' lit' : ''}`} data-testid="sala-elimres" data-stage={stage}>
      <TopBar leave onBack={leave} center={<span className="im-status">Rodada {step.round} de {el.total}</span>} />
      <div className="im-body im-mid im-revbody">
        <p className="im-suspense" aria-live="polite">
          {step.drawn ? 'Empate de novo. O sorteio escolheu' : step.revote ? 'Depois do empate, saiu' : 'Foi eliminado(a)'}
          {stage === 0 && <span className="im-dots" aria-hidden="true"><i /><i /><i /></span>}
        </p>
        {stage >= 1 && (
          <div className="im-slam" data-testid="sala-elim-out">
            <div className="im-reveal"><Coin avatar={out.avatar} color={out.color} size="xl" /></div>
            <h2 className="im-culprit">{nameOf(snap, step.out)}</h2>
            <p className="im-sub">{voteList.length > 0 ? `Votaram nele(a): ${voteList.join(', ')}` : 'Ninguém votou: o sorteio decidiu'}</p>
          </div>
        )}
        {stage >= 2 && (
          <div className={`im-rolecard ${step.role ? (isOutsider ? 'bad' : 'ok') : 'hidden'}`} data-testid="sala-rolecard">
            <b>{step.role ? (isOutsider ? (step.role === 'white' ? 'Era o(a) impostor(a) sem palavra' : 'Era impostor(a)') : 'Era inocente') : 'O papel continua em segredo'}</b>
          </div>
        )}
        {stage >= 3 && (
          <div className="im-verdict" data-testid="sala-elim-verdict">
            {winner ? (
              <>
                <span className={`im-banner${winner === 'innocents' ? '' : ' bad'}`}>{winner === 'innocents' ? 'Inocentes venceram' : 'Impostores venceram'}</span>
                <p className="im-sub">{winner === 'innocents' ? `Os inocentes acharam ${el.outsiders === 1 ? 'o impostor' : 'todos os impostores'}.` : lastOne ? 'As rodadas acabaram e ainda havia impostor na mesa.' : 'Sobraram tantos impostores quanto inocentes.'}</p>
              </>
            ) : <p className="im-sub">A partida continua.</p>}
          </div>
        )}
      </div>
      <div className="im-foot"><p className="im-sub center">{winner ? 'Já já vem o ranking...' : 'Já já começa a próxima rodada...'}</p></div>
    </div>
  );
}

/* ---------- Ranking final ---------- */
function Final({ snap }: { snap: Snap }) {
  const mesa = snap.mesa!;
  const me = snap.me ?? '';
  const looks = useLooks(snap);
  const ask = useAsk();
  const mine = snap.members.find((m) => m.id === me);
  const rows = mesa.session.ranking;
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  useEffect(() => { play('win'); }, []);
  const medal = (pos: number) => (pos === 1 ? 'trofeu' : pos === 2 ? 'prata' : 'bronze');
  return (
    <div className="im-screen" data-testid="sala-final">
      <TopBar center={<span className="im-status">{mesa.session.games} {mesa.session.games === 1 ? 'partida' : 'partidas'}</span>} />
      <div className="im-body">
        <h2 className="im-t"><Words text="Ranking final" /></h2>
        <div className="im-podium">
          {podium.map((row, i) => (
            <div key={row.id} className={`im-pod p${row.position}`} style={{ '--i': i } as CSSProperties}>
              <Icon name={medal(row.position)} size={56} className="im-medal" />
              <Coin avatar={looks(row.id).avatar} color={looks(row.id).color} size="lg" />
              <b>{nameOf(snap, row.id)}</b>
              <span className="im-pts">{row.points}<small>pts</small></span>
            </div>
          ))}
        </div>
        {rest.length > 0 && (
          <ol className="im-score" start={4}>
            {rest.map((row, i) => (
              <li key={row.id} className="im-srow" style={{ '--i': i } as CSSProperties}>
                <span className="im-pos">{row.position}</span><Coin avatar={looks(row.id).avatar} color={looks(row.id).color} size="sm" /><b>{nameOf(snap, row.id)}</b>
                <span className="im-pts">{row.points}<small>pts</small></span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="im-foot">
        <Primary testId="sala-again" sound="confirm" tone={mine?.rematch ? 'ghost' : 'orange'} onClick={() => sendRoom('vote', { again: !mine?.rematch })}>
          {mine?.rematch ? 'Esperando os outros...' : 'Nova sessão'} {!mine?.rematch && <ArrowIcon />}
        </Primary>
        <button type="button" className="im-link" data-testid="sala-quit" onClick={() => ask({ title: 'Sair da sala?', text: 'Você deixa a sala e o ranking.', confirm: 'Sair da sala', danger: true, onConfirm: () => void leaveRoom() })}>Sair da sala</button>
      </div>
    </div>
  );
}
