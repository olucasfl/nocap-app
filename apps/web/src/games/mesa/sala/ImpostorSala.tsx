import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { IM_CATEGORIES, IM_MAX_ROUNDS, IM_MIN_PLAYERS, IM_WHITE_MIN_PLAYERS, imImpostorLimit, type ImMode } from '@nocap/games';
import { InvitePanel } from '@/screens/room/lobby/InvitePanel';
import { leaveRoom, sendRoom } from '@/lib/rooms';
import { RankSlot } from '../impostor/ui';
import { CATEGORY_ICONS, preloadImages } from '../impostor/assets';
import { SalaChatButton } from './SalaChat';
import { nameOf, useLooks, type Snap } from './looks';
import { play, preloadSounds } from '../impostor/audio';
import { CategorySheet, MODES, TIMES, fmtTime } from '../impostor/screens';
import type { Action, State } from '../impostor/state';
import { Alert, AskCtx, ArrowIcon, Coin, Confirm, GearIcon, Icon, Primary, Stepper, Switch, TopBar, Words, useAsk, useFlash, type AskCfg } from '../impostor/ui';
import '../impostor/impostor.css';

type Cfg = { rounds: number; impostors: number; talkMs: number; hint: boolean; lastChance: boolean; categories: string[]; filters: Record<string, Record<string, string[]>> };

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
  const key = `${phase}-${snapshot.mesa?.stage ?? ''}-${snapshot.mesa?.speaker ?? ''}-${snapshot.mesa?.clueRound ?? 0}`;
  return (
    <div className="im-app" data-testid="sala-app" data-phase={phase}>
      <div className="im-lamp" aria-hidden="true" />
      <AskCtx.Provider value={askFn}>
        <RankSlot.Provider value={<SalaChatButton snap={snapshot} />}>
        <div key={key} className="im-view">
          {phase === 'lobby' && <Lobby snap={snapshot} />}
          {phase === 'show' && <SeeRole snap={snapshot} />}
          {phase === 'play' && <Clues snap={snapshot} />}
          {phase === 'pick' && <Debate snap={snapshot} />}
          {phase === 'vote' && <Vote snap={snapshot} />}
          {phase === 'reveal' && <Reveal snap={snapshot} />}
          {phase === 'final' && <Final snap={snapshot} />}
        </div>
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
  const max = imImpostorLimit(Math.max(connected.length, IM_MIN_PLAYERS));
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
                    <button type="button" className="im-x" aria-label={`Tirar ${m.username}`} onClick={() => ask({ title: `Tirar ${m.username} da sala?`, text: 'Ele sai da sala e precisa do código para voltar.', confirm: 'Tirar da sala', danger: true, onConfirm: () => sendRoom('kick', { id: m.id }) })}>×</button>
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
                <p className="im-modedesc" key={mode}>{MODES.find((m) => m.id === mode)?.desc}{tooFew ? ` "Sem palavra" só com ${IM_WHITE_MIN_PLAYERS} ou mais.` : ''}</p>
                <div className="im-rows">
                  <div className="im-row"><div><b>Rodadas de dicas</b><small>Quantas vezes cada um dá sua dica. Em cada rodada, cada pessoa diz uma palavra sobre o tema, uma de cada vez.</small></div><Stepper value={cfg.rounds} label="rodadas" min={1} max={IM_MAX_ROUNDS} onChange={(n) => set({ rounds: n })} /></div>
                  <div className="im-row"><div><b>Impostores</b><small>{imp === 0 ? 'Número surpresa' : `Máximo para ${connected.length}: ${max}`}</small></div><Stepper value={imp} label="impostores" min={0} max={max} format={(n) => (n === 0 ? '?' : String(n))} onChange={(n) => set({ impostors: n })} /></div>
                  <div className="im-row"><div><b>Debate</b><small>Depois das dicas, todos conversam por esse tempo para descobrir quem é o impostor. Depois vem a votação.</small></div><Stepper value={ti} label="tempo do debate" min={0} max={TIMES.length - 1} format={(n) => fmtTime(TIMES[n]!)} onChange={(n) => set({ talkMs: TIMES[n]! * 1000 })} /></div>
                  {mode === 'classic' && <div className="im-row"><div><b>Dica de categoria</b><small>O impostor vê o tema</small></div><Switch on={cfg.hint} label="Dica de categoria" onChange={(v) => set({ hint: v })} /></div>}
                  <div className="im-row"><div><b>Última chance</b><small>Se o impostor for pego, ainda tenta acertar a palavra. Acertando, ganha poucos pontos (os inocentes ganham mais). Escapar sem ser pego vale muito mais.</small></div><Switch on={cfg.lastChance} label="Última chance" onChange={(v) => set({ lastChance: v })} /></div>
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
                <p className="im-sub">Só o líder muda as regras.</p>
                <div className="im-rows">
                  <div className="im-row"><div><b>{MODES.find((m) => m.id === mode)?.label}</b><small>{MODES.find((m) => m.id === mode)?.desc}</small></div></div>
                  <div className="im-row"><div><b>{cfg.rounds} {cfg.rounds === 1 ? 'rodada' : 'rodadas'} de dicas</b><small>{cfg.impostors === 0 ? 'Impostores: surpresa' : `${cfg.impostors} ${cfg.impostors === 1 ? 'impostor' : 'impostores'}`} · debate {fmtTime(Math.round(cfg.talkMs / 1000))}</small></div></div>
                  <div className="im-row themes"><div className="im-themes-h"><b>Temas</b></div>
                    <div className="im-pills">
                      {cfg.categories.length === 0 && <span className="im-sub">O líder ainda não escolheu.</span>}
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
          <span className={`im-secret${outsider ? ' bad' : ''}`} aria-live="polite"><small>{on ? tag : ''}</small><strong className={wrong ? 'q' : ''} data-testid="sala-secret">{on ? text : ''}</strong></span>
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
  const total = snap.settings.rounds;
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

/* ---------- Voto secreto ---------- */
function Vote({ snap }: { snap: Snap }) {
  const mesa = snap.mesa!;
  const me = snap.me ?? '';
  const looks = useLooks(snap);
  const leave = useLeaveRoom();
  const left = useCountdown(snap.round?.endsAt ?? null);
  const [sel, setSel] = useState<string | null>(mesa.myVote ?? null);
  const voted = mesa.voted ?? [];
  const iVoted = voted.includes(me);
  const inGame = mesa.participants?.some((p) => p.id === me);
  return (
    <div className="im-screen" data-testid="sala-vote">
      <TopBar leave onBack={leave} center={<span className="im-status">Votação secreta · {voted.length} de {mesa.participants?.length ?? 0}{left !== null ? ` · ${left} s` : ''}</span>} />
      <div className="im-body">
        <h2 className="im-t im-lupa-t"><Icon name="lupa" size={52} className="im-lupa" /><Words text="Quem é o impostor?" /></h2>
        <div className="im-vgrid">
          {(mesa.participants ?? []).map((p, i) => p.id === me ? null : (
            <button key={p.id} type="button" className="im-vote im-rise" style={{ '--d': (i % 4) + 1 } as CSSProperties} aria-pressed={sel === p.id} disabled={!inGame} data-testid={`sala-vote-${p.id}`} onClick={() => { play('select'); setSel(p.id); }}>
              <Coin avatar={looks(p.id).avatar} color={looks(p.id).color} size="lg" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="im-foot">
        <Primary disabled={!sel || !inGame} sound="vote" testId="sala-cast" onClick={() => sel && sendRoom('cast', { id: sel })}>
          {!sel ? 'Escolha alguém' : iVoted && mesa.myVote === sel ? 'Voto enviado. Toque para trocar' : iVoted ? 'Trocar o meu voto' : 'Confirmar voto'}
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
  const left = useCountdown(snap.round?.endsAt ?? null);
  const [text, setText] = useState('');
  const [flash, show] = useFlash();
  const guessing = mesa.stage === 'guess';
  const canGuessMe = !!r?.canGuess.includes(me) && !(mesa.guessed ?? []).includes(me);
  const win = r?.innocentsWin === true;
  useEffect(() => {
    if (guessing) play('reveal');
    else if (r) play(win ? 'win' : 'lose');
  }, [guessing, win, r]);
  useEffect(() => {
    if (mesa.stage !== 'score') return undefined;
    const t = window.setTimeout(() => play(mesa.session.ranking.some((x) => x.position === 1 && x.points > 0) ? 'rankcalm' : 'rankcalm'), 1200);
    return () => window.clearTimeout(t);
  }, [mesa.stage, mesa.session.ranking]);
  if (!r) return <Waiting snap={snap} text="Contando os votos..." />;
  const lead = new Set(mesa.session.leaders);
  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return show('Digite um chute.');
    play('vote');
    sendRoom('guess', { text });
  };
  if (guessing) {
    return (
      <div className="im-screen im-centered" data-testid="sala-guess">
        <TopBar leave onBack={leave} center={<span className="im-status">Última chance{left !== null ? ` · ${left} s` : ''}</span>} />
        <div className="im-body im-mid">
          <span className="im-banner warn">Última chance</span>
          <h2 className="im-t"><Words text={r.canGuess.length === 1 ? `Pegaram ${nameOf(snap, r.canGuess[0]!)}` : 'Pegaram os impostores'} /></h2>
          <div className="im-reveal">{r.canGuess.map((id, i) => <span key={id} style={{ '--i': i } as CSSProperties}><Coin avatar={looks(id).avatar} color={looks(id).color} size="lg" /></span>)}</div>
          {canGuessMe ? (
            <form className="im-add wide" onSubmit={send}>
              <input id="sala-guess" data-testid="sala-guess-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Qual era a palavra?" autoComplete="off" autoCapitalize="none" maxLength={40} aria-label="Chute da palavra" aria-invalid={!!flash} />
            </form>
          ) : <p className="im-sub">Esperando o chute...</p>}
        </div>
        {flash && <div className="im-foot-alert"><Alert n={flash.n}>{flash.m}</Alert></div>}
        <div className="im-foot">{canGuessMe && <Primary sound={null} testId="sala-guess-send" onClick={() => send()}>Chutar <ArrowIcon /></Primary>}</div>
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
        ) : <p className="im-sub center">Esperando o líder: continuar ou encerrar.</p>}
      </div>
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
