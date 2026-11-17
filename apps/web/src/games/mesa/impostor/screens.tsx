import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  IM_CATEGORIES, IM_MAX_PLAYERS, IM_MIN_POOL, IM_MAX_ROUNDS, IM_MIN_PLAYERS, IM_WHITE_MIN_PLAYERS, imImpostorLimit, guessIsRight, guessNeedsJudgement, leaders, sessionRanking,
  type ImMode,
} from '@nocap/games';
import { AVATARS, CATEGORY_ICONS, PEOPLE } from './assets';
import { play } from './audio';
import { clueRounds, poolOk, poolSize, type Action, type Player, type State } from './state';
import { Alert, ArrowIcon, CheckIcon, Coin, GearIcon, Icon, PlusIcon, Primary, Sheet, Steps, Stepper, Switch, TopBar, Words, useAsk, useFlash } from './ui';

interface P {
  s: State;
  d: (a: Action) => void;
  exit: () => void;
}

/** Sair no meio da partida: pede confirmação e volta ao menu sem contar a partida (o ranking fica). */
function useLeave(d: (a: Action) => void) {
  const ask = useAsk();
  return () =>
    ask({
      title: 'Sair da partida?',
      text: 'Esta partida se perde e ninguém ganha pontos. O ranking da sessão fica como está.',
      confirm: 'Sair da partida',
      cancel: 'Continuar jogando',
      danger: true,
      onConfirm: () => d({ type: 'leave' }),
    });
}

/** Uma foto aleatória que ninguém da mesa usa. */
function randomFree(taken: Set<string>): string {
  const free = AVATARS.filter((a) => !taken.has(a));
  return free[Math.floor(Math.random() * free.length)] ?? AVATARS[0]!;
}

const idx = (s: State, id: string) => Math.max(0, s.players.findIndex((p) => p.id === id));
const by = (s: State, id: string): Player => s.players.find((p) => p.id === id) ?? s.players[0]!;
const coinOf = (s: State, id: string, size: 'sm' | 'md' | 'lg' | 'xl' = 'sm', className = '', style?: CSSProperties) => {
  const p = by(s, id);
  return <Coin avatar={p.avatar} color={idx(s, id)} size={size} className={className} style={style} />;
};

/* ---------- Jogadores ---------- */
export function PlayersScreen({ s, d, exit }: P) {
  const [name, setName] = useState('');
  const [picking, setPicking] = useState<string | null>(null);
  const [flash, show, clear] = useFlash();
  const ask = useAsk();
  const takenNow = new Set(s.players.map((p) => p.avatar));
  /** A foto de quem vai entrar: já vem uma aleatória sorteada; dá para trocar antes de adicionar. */
  const [draft, setDraft] = useState(() => randomFree(takenNow));
  const draftTaken = takenNow.has(draft);
  useEffect(() => {
    if (draftTaken) setDraft(randomFree(takenNow));
  }, [draftTaken]);  
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return show('Digite o nome de quem vai jogar.');
    if (s.players.length >= IM_MAX_PLAYERS) return show(`A mesa lotou: no máximo ${IM_MAX_PLAYERS} jogadores.`);
    if (s.players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return show(`Já tem alguém chamado ${n}. Use outro nome para não confundir.`);
    clear();
    play('add');
    d({ type: 'addPlayer', name: n, avatar: draft });
    setDraft(randomFree(new Set([...takenNow, draft])));
    setName('');
  };
  const remove = (p: Player) => {
    const doIt = () => { play('remove'); d({ type: 'removePlayer', id: p.id }); };
    if (s.session.games > 0)
      ask({ title: `Tirar ${p.name} da mesa?`, text: 'Ele sai do ranking e perde os pontos que fez nesta sessão.', confirm: 'Tirar da mesa', danger: true, onConfirm: doIt });
    else doIt();
  };
  const goOn = () => {
    if (s.players.length < IM_MIN_PLAYERS) return show(`São precisos pelo menos ${IM_MIN_PLAYERS} jogadores. Faltam ${IM_MIN_PLAYERS - s.players.length}.`);
    play('start');
    d({ type: 'go', phase: 'cats' });
  };
  const cur = s.players.find((p) => p.id === picking);
  const few = s.players.length < IM_MIN_PLAYERS;
  return (
    <div className="im-screen" data-testid="im-players">
      <TopBar onBack={s.session.games > 0 ? () => d({ type: 'go', phase: 'score', back: true }) : exit} center={<Steps at={1} />} />
      <div className="im-body">
        <div className="im-main">
          <h2 className="im-t"><Words text={s.session.games > 0 ? 'Quem joga agora?' : 'Quem vai jogar?'} /></h2>
          <p className={`im-sub center${few ? ' warn' : ''}`}>{s.players.length} na mesa · mínimo {IM_MIN_PLAYERS}, máximo {IM_MAX_PLAYERS}</p>
          <ul className="im-plist">
            {s.players.map((p, i) => (
              <li key={p.id} className="im-prow" style={{ '--i': i } as CSSProperties}>
                <button type="button" className="im-coinbtn" aria-label={`Trocar o personagem de ${p.name}`} onClick={() => { play('tap'); setPicking(p.id); }}>
                  <Coin avatar={p.avatar} color={i} size="sm" />
                  <span className="im-edit" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg></span>
                </button>
                <b>{p.name}</b>
                <button type="button" className="im-x" aria-label={`Remover ${p.name}`} onClick={() => remove(p)}>×</button>
              </li>
            ))}
          </ul>
          {s.players.length < IM_MAX_PLAYERS && (
            <>
            <form className="im-add im-addrow" onSubmit={submit}>
              <button type="button" className="im-draft" aria-label="Escolher a foto de quem vai entrar" data-testid="im-draft" onClick={() => { play('tap'); setPicking('new'); }}>
                <Coin avatar={draft} color={s.players.length} size="md" />
                <span className="im-edit big" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg></span>
              </button>
              <input id="im-name" data-testid="im-name" value={name} onChange={(e) => { setName(e.target.value); clear(); }} placeholder="Nome" maxLength={14} autoComplete="off" enterKeyHint="done" aria-label="Nome do jogador" aria-invalid={!!flash} />
              <button className="im-iconbtn pri" aria-label="Adicionar jogador" data-testid="im-add"><PlusIcon /></button>
            </form>
            <p className="im-sub center small">Toque na foto para trocar. Se não escolher, vem uma aleatória.</p>
            </>
          )}
        </div>
      </div>
      {flash && <div className="im-foot-alert"><Alert n={flash.n}>{flash.m}</Alert></div>}
      <div className="im-foot">
        <Primary sound={null} testId="im-continue" onClick={goOn} className={few ? 'soft' : ''}>
          Continuar · {s.players.length} <ArrowIcon />
        </Primary>
      </div>
      {picking && (
        <Sheet title={cur ? `Personagem de ${cur.name}` : 'Foto de quem vai entrar'} onClose={() => setPicking(null)}>
          <div className="im-avgrid" role="listbox" aria-label="Personagens">
            {AVATARS.map((a) => {
              const current = cur ? cur.avatar : draft;
              const mine = a === current;
              const used = takenNow.has(a) && !mine;
              return (
                <button key={a} type="button" role="option" aria-selected={mine} disabled={used} className="im-avopt" data-on={mine} onClick={() => { play('select'); if (cur) d({ type: 'setAvatar', id: cur.id, avatar: a }); else setDraft(a); setPicking(null); }}>
                  <Coin avatar={a} color={cur ? idx(s, cur.id) : s.players.length} size="md" />
                </button>
              );
            })}
          </div>
          <p className="im-sub small">{PEOPLE.length} pessoas e {AVATARS.length - PEOPLE.length} bichos. Os esmaecidos já estão com outro jogador.</p>
        </Sheet>
      )}
    </div>
  );
}

/* ---------- Modo ---------- */
export const MODES: { id: ImMode; label: string; desc: string; tone: string; icon: string }[] = [
  { id: 'classic', label: 'Clássico', desc: 'Todos veem a palavra. Menos o impostor.', tone: '#ff6a2b', icon: 'modo-classico' },
  { id: 'similar', label: 'Palavra parecida', desc: 'O impostor recebe outra palavra, parecida. Ele nem sabe.', tone: '#2f5bff', icon: 'modo-parecida' },
  { id: 'white', label: 'Sem palavra', desc: 'Dois impostores: um recebe uma palavra parecida e nem sabe que é impostor; o outro não recebe nada e precisa disfarçar.', tone: '#ffd23f', icon: 'modo-semword' },
  { id: 'wrong', label: 'Resposta errada', desc: 'Todos respondem. Um recebeu outra pergunta.', tone: '#33c27f', icon: 'modo-errada' },
];

/** Opções de uma categoria (futebol: jogadores, times, seleções, Brasil ou mundo...). Usada antes de começar e nos ajustes. */
export function CategorySheet({ s, d, id, onClose }: { s: State; d: (a: Action) => void; id: string; onClose: () => void }) {
  const cat = IM_CATEGORIES.find((c) => c.id === id)!;
  const size = poolSize(s);
  return (
    <Sheet title={cat.label} onClose={onClose} icon={<Icon name={CATEGORY_ICONS[cat.id]!} size={64} className="im-sheet-ic" />}>
      {cat.filters.map((f) => {
        const cur = s.settings.filters?.[cat.id]?.[f.tag] ?? [];
        const all = cur.length === 0;
        return (
          <div key={f.tag} className="im-opt">
            <span className="im-opt-h">{f.label}{all && <em>tudo incluído</em>}</span>
            <div className="im-choices">
              {f.options.map((o, i) => {
                const on = all || cur.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    className="im-choice"
                    style={{ '--i': i } as CSSProperties}
                    aria-pressed={on}
                    data-testid={`im-f-${cat.id}-${o.value}`}
                    onClick={() => { play(on ? 'off' : 'on'); d({ type: 'filter', category: cat.id, tag: f.tag, value: o.value }); }}
                  >
                    <span className="im-tick" aria-hidden="true"><CheckIcon /></span>
                    <span className="im-choice-t">{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="im-poolcount" key={size} aria-live="polite"><b>{size}</b> palavras no sorteio</p>
      <Primary sound="confirm" onClick={onClose}>Pronto</Primary>
    </Sheet>
  );
}

/* ---------- Categorias ---------- */
export function CatsScreen({ s, d }: P) {
  const [sheet, setSheet] = useState<string | null>(null);
  const [flash, show, clear] = useFlash();
  const [shake, setShake] = useState(0);
  const n = s.settings.categories.length;
  const total = IM_CATEGORIES.length;
  const size = poolSize(s);
  const goOn = () => {
    if (n === 0) {
      setShake((v) => v + 1);
      return show('Escolha pelo menos 1 tema para sortear. Toque nos cartões acima.');
    }
    if (!poolOk(s)) return show(`Só ${size} palavras com essa escolha: precisa de pelo menos ${IM_MIN_POOL}. Escolha mais temas ou libere as opções de cada tema.`);
    play('start');
    d({ type: 'go', phase: 'cfg' });
  };
  return (
    <div className="im-screen" data-testid="im-cats">
      <TopBar onBack={() => d({ type: 'go', phase: 'players', back: true })} center={<Steps at={2} />} />
      <div className="im-body">
        <div>
          <p className="im-instr" data-testid="im-instr">Selecione os temas para sortear</p>
          <h2 className="im-t"><Words text="O que vamos sortear?" /></h2>
        </div>
        <div className={`im-meter${n === 0 ? ' empty' : ''}`} key={n} aria-live="polite" data-testid="im-meter">
          <span className="im-meter-n"><b>{n}</b> de {total} temas</span>
          <span className="im-meter-dots" aria-hidden="true">{Array.from({ length: total }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>
        </div>
        <div className={`im-tiles${shake ? ' shake' : ''}`} key={`t${shake}`}>
          {IM_CATEGORIES.map((c, i) => {
            const on = s.settings.categories.includes(c.id);
            return (
              <div key={c.id} className="im-tilewrap im-rise" style={{ '--d': (i % 6) + 1 } as CSSProperties}>
                <button type="button" className="im-tile" aria-pressed={on} data-testid={`im-cat-${c.id}`} onClick={() => { play('select'); clear(); d({ type: 'toggleCategory', id: c.id }); }}>
                  <Icon name={CATEGORY_ICONS[c.id]!} size={64} className="im-tile-ic" />
                  <span>{c.label}</span>
                </button>
                {on && (
                  <button type="button" className="im-gear" aria-label={`Personalizar ${c.label}`} data-testid={`im-gear-${c.id}`} onClick={() => { play('tap'); setSheet(c.id); }}>
                    <GearIcon />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {flash && <div className="im-foot-alert"><Alert n={flash.n}>{flash.m}</Alert></div>}
      <div className="im-foot"><Primary sound={null} testId="im-continue" className={n === 0 ? 'soft' : ''} onClick={goOn}>Continuar <ArrowIcon /></Primary></div>
      {sheet && <CategorySheet s={s} d={d} id={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

/* ---------- Ajustes ---------- */
export const fmtTime = (n: number) => (n === 0 ? 'Livre' : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`);
export const TIMES = [0, 30, 60, 90, 120, 180, 240, 300];

export function CfgScreen({ s, d }: P) {
  const [sheet, setSheet] = useState<string | null>(null);
  const [flash, show] = useFlash();
  const start = () => {
    if (s.settings.categories.length === 0) return show('Nenhum tema escolhido. Toque em "Trocar temas" e escolha pelo menos 1.');
    if (!poolOk(s)) return show(`Poucas palavras (${poolSize(s)}). Escolha mais temas ou libere as opções de cada tema.`);
    play('shuffle');
    d({ type: 'start' });
  };
  const c = s.settings;
  const max = imImpostorLimit(s.players.length);
  const imp = c.impostors === 'random' ? 0 : Math.min(c.impostors, max);
  const ti = Math.max(0, TIMES.indexOf(c.talkSeconds));
  const cur = MODES.find((m) => m.id === c.mode)!;
  const tooFew = s.players.length < IM_WHITE_MIN_PLAYERS;
  const rows = [
    c.mode === 'wrong' ? null : <div className="im-row" key="rd"><div><b>Rodadas de dicas</b><small>Quantas vezes cada um dá sua dica. Em cada rodada, cada pessoa diz uma palavra sobre o tema, uma de cada vez.</small></div><Stepper value={c.rounds} label="rodadas" min={1} max={IM_MAX_ROUNDS} onChange={(n) => d({ type: 'settings', patch: { rounds: n } })} /></div>,
    <div className="im-row" key="im"><div><b>Impostores</b><small>{imp === 0 ? 'Número surpresa' : `Máximo para ${s.players.length}: ${max}`}</small></div>
      <Stepper value={imp} label="impostores" min={0} max={max} format={(n) => (n === 0 ? '?' : String(n))} onChange={(n) => d({ type: 'settings', patch: { impostors: n === 0 ? 'random' : n } })} /></div>,
    <div className="im-row" key="tm"><div><b>Debate</b><small>Depois das dicas, todos conversam por esse tempo para descobrir quem é o impostor. Depois vem a votação.</small></div><Stepper value={ti} label="tempo do debate" min={0} max={TIMES.length - 1} format={(n) => fmtTime(TIMES[n]!)} onChange={(n) => d({ type: 'settings', patch: { talkSeconds: TIMES[n]! } })} /></div>,
  ];
  if (c.mode === 'classic' && c.categories.length > 2) rows.push(<div className="im-row" key="hint"><div><b>Dica de categoria</b><small>O impostor vê o tema da palavra. Só aparece com mais de 2 temas.</small></div><Switch on={c.hint} label="Dica de categoria" onChange={(v) => d({ type: 'settings', patch: { hint: v } })} /></div>);
  if (c.mode !== 'wrong') rows.push(<div className="im-row" key="last"><div><b>Última chance</b><small>Se o impostor for pego, ainda tenta acertar a palavra. Acertando, ganha poucos pontos (os inocentes ganham mais). Escapar sem ser pego vale muito mais.</small></div><Switch on={c.lastChance} label="Última chance" onChange={(v) => d({ type: 'settings', patch: { lastChance: v } })} /></div>);
  return (
    <div className="im-screen" data-testid="im-cfg">
      <TopBar onBack={() => d({ type: 'go', phase: 'cats', back: true })} center={<Steps at={3} />} />
      <div className="im-body">
        <h2 className="im-t"><Words text="Como vai ser?" /></h2>
        <div className="im-modes" role="radiogroup" aria-label="Modo de jogo">
          {MODES.map((m, i) => {
            const off = m.id === 'white' && tooFew;
            return (
              <button key={m.id} type="button" role="radio" aria-checked={c.mode === m.id} className="im-mode im-rise" style={{ '--d': i + 1, '--c': m.tone } as CSSProperties} aria-disabled={off} data-testid={`im-mode-${m.id}`} onClick={() => { if (off) { play('off'); show(`"Sem palavra" precisa de pelo menos ${IM_WHITE_MIN_PLAYERS} jogadores. Vocês são ${s.players.length}.`); return; } play('select'); d({ type: 'settings', patch: { mode: m.id } }); }}>
                <Icon name={m.icon} size={64} className="im-mode-ic" />
                <b>{m.label}</b>
              </button>
            );
          })}
        </div>
        <p className="im-modedesc" key={c.mode} aria-live="polite">{cur.desc}</p>
        <div className="im-rows">{rows.filter(Boolean).map((r, i) => <div key={i} className="im-rise" style={{ '--d': i + 1 } as CSSProperties}>{r}</div>)}</div>
        <div className="im-row themes">
          <div className="im-themes-h"><b>Temas</b><small>Escolha o que entra em cada tema</small></div>
          <div className="im-pills">
            {c.categories.map((id) => {
              const cat = IM_CATEGORIES.find((x) => x.id === id)!;
              return (
                <div key={id} className="im-themeline">
                  <span className="im-chip static"><Icon name={CATEGORY_ICONS[id]!} size={28} />{cat.label}</span>
                  <button type="button" className="im-edtheme" data-testid={`im-cfg-theme-${id}`} aria-label={`Editar tema ${cat.label}`} onClick={() => { play('tap'); setSheet(id); }}><GearIcon />Editar tema</button>
                </div>
              );
            })}
            <button type="button" className="im-chip add" data-testid="im-cfg-themes-edit" onClick={() => { play('back'); d({ type: 'go', phase: 'cats', back: true }); }}>Trocar temas</button>
          </div>
        </div>
      </div>
      {(flash || s.error) && <div className="im-foot-alert"><Alert n={flash?.n ?? 0}>{flash?.m ?? s.error}</Alert></div>}
      <div className="im-foot"><Primary sound={null} testId="im-start" onClick={start}>Começar <ArrowIcon /></Primary></div>
      {sheet && <CategorySheet s={s} d={d} id={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

/* ---------- Passar o celular e revelar o papel ---------- */
export function RevealScreen({ s, d }: P) {
  const leave = useLeave(d);
  const p = s.players[s.seen]!;
  const role = s.round!.roles[p.id]!;
  const [on, setOn] = useState(false);
  const [seen, setSeen] = useState(false);
  const last = s.seen === s.players.length - 1;
  const wrong = s.round!.mode === 'wrong';
  useEffect(() => { play('pass'); }, [s.seen]);
  const tag = role.kind === 'white' ? 'Você está' : role.kind === 'impostor' && role.knowsRole ? (role.hint ? 'Tema' : 'Você é o') : wrong ? 'Sua pergunta' : 'A palavra é';
  const text = role.kind === 'white' ? 'Sem palavra' : role.kind === 'impostor' && role.knowsRole ? (role.hint ?? 'Impostor') : (role.text ?? '');
  const show = () => { if (!on) { setOn(true); play('reveal'); } };
  const hide = () => { if (on) { setOn(false); setSeen(true); } };
  const outsider = role.kind !== 'civil' && role.knowsRole;
  return (
    <div className="im-screen im-centered" data-testid="im-reveal">
      <TopBar leave onBack={leave} center={<span className="im-status">{s.seen + 1} de {s.players.length}</span>} />
      <div className="im-body im-mid">
        <div className="im-who">
          <Coin avatar={p.avatar} color={s.seen} size="lg" className="im-rise" />
          <div>
            <p className="im-hint im-rise" style={{ '--d': 2 } as CSSProperties}>Passe o celular para</p>
            <div className="im-name"><Words text={p.name} /></div>
          </div>
        </div>
        <button
          type="button"
          className={`im-hold${on ? ' on' : ''}`}
          aria-label={`${p.name}: segure para ver o seu papel`}
          data-testid="im-hold"
          onPointerDown={(e) => { e.preventDefault(); show(); }}
          onPointerUp={hide}
          onPointerLeave={hide}
          onPointerCancel={hide}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); show(); } }}
          onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') hide(); }}
        >
          <span className="im-lbl">Segure<br />para ver</span>
          <span className={`im-secret${outsider ? ' bad' : ''}`} aria-live="polite">
            <small>{on ? tag : ''}</small>
            <strong className={wrong ? 'q' : ''} data-testid="im-secret">{on ? text : ''}</strong>
            {on && role.theme && !wrong && <em className="im-theme">Tema: {role.theme}</em>}
          </span>
        </button>
        <p className="im-hint" style={{ opacity: seen ? 1 : 0.55 }}>{seen ? 'Solte e passe adiante' : 'Só você olha. Ninguém mais.'}</p>
      </div>
      <div className="im-foot">
        <Primary testId="im-seen" disabled={!seen} onClick={() => d({ type: 'seen' })} sound="confirm">{last ? 'Todos viram' : 'Já vi'} <ArrowIcon /></Primary>
      </div>
    </div>
  );
}

/* ---------- Rodadas de dicas ---------- */
/** Instruções da rodada de dicas, adaptadas ao modo sorteado e à rodada. */
function briefText(mode: string, round: number): { head: string; body: string } {
  const again = round > 1 ? ' Sem repetir nada do que já foi dito.' : '';
  switch (mode) {
    case 'similar':
      return {
        head: round > 1 ? 'Mais uma volta de palavras' : 'Cada um diz uma palavra',
        body: `Cada um diz uma palavra que lembre a palavra que recebeu, sem deixar na cara qual é.${again} Cuidado: o impostor tem uma palavra parecida e nem sabe que é o impostor.`,
      };
    case 'white':
      return {
        head: round > 1 ? 'Mais uma volta de palavras' : 'Cada um diz uma palavra',
        body: `Cada um diz uma palavra que lembre a sua, sem entregar qual é.${again} Um impostor recebeu uma palavra parecida; o outro não recebeu nada e vai tentar disfarçar escutando os outros.`,
      };
    case 'wrong':
      return {
        head: round > 1 ? 'Mais uma volta de respostas' : 'Cada um responde',
        body: `Cada um responde em voz alta, em poucas palavras, a pergunta que recebeu.${again} Uma pessoa recebeu uma pergunta diferente: reparem em quem responde estranho.`,
      };
    default:
      return {
        head: round > 1 ? 'Mais uma volta de palavras' : 'Cada um diz uma palavra',
        body: `Cada um diz uma palavra para fazer referência à palavra que recebeu, mas sem deixar na cara qual é.${again} O impostor não sabe a palavra e precisa disfarçar.`,
      };
  }
}

export function CluesScreen({ s, d }: P) {
  const leave = useLeave(d);
  const order = s.round!.order;
  const N = clueRounds(s);
  const lastRound = s.clueRound >= N;
  const mode = s.round!.mode;
  const wrong = mode === 'wrong';
  const status = <span className="im-status">Rodada {s.clueRound} de {N}</span>;
  if (s.clueStep === 'brief') {
    const b = briefText(mode, s.clueRound);
    return (
      <div className="im-screen im-centered" data-testid="im-clues">
        <TopBar leave onBack={leave} center={status} />
        <div className="im-body im-mid">
          <Icon name="ampulheta" size={96} className="im-hourglass big" />
          <div className="im-briefbox">
            <span className="im-banner">Rodada {s.clueRound}</span>
            <h2 className="im-t"><Words text={b.head} /></h2>
            <p className="im-sub" data-testid="im-brief">{b.body}</p>
          </div>
        </div>
        <div className="im-foot"><Primary testId="im-next" onClick={() => d({ type: 'clueNext' })}>Próximo <ArrowIcon /></Primary></div>
      </div>
    );
  }
  return (
    <div className="im-screen" data-testid="im-clues">
      <TopBar leave onBack={leave} center={status} />
      <div className="im-body">
        <div className="im-main">
          <h2 className="im-t"><Words text={wrong ? 'Agora cada um responde a sua pergunta' : 'Hora de dizer as palavras'} /></h2>
          <p className="im-sub center">{wrong ? 'Um de cada vez, em voz alta, nesta ordem. Quando todo mundo responder, toque em próximo.' : 'Um de cada vez, nesta ordem. Quando todo mundo disser a sua, toque em próximo.'}</p>
          <ol className="im-order">
            {order.map((id, i) => {
              const p = by(s, id);
              return (
                <li key={id} className="im-prow" style={{ '--i': i } as CSSProperties}>
                  <span className="im-n">{i + 1}</span>
                  <Coin avatar={p.avatar} color={idx(s, id)} size="sm" />
                  <b>{p.name}</b>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <div className="im-foot"><Primary testId="im-next" sound={lastRound ? 'start' : 'tap'} onClick={() => d({ type: 'clueNext' })}>{lastRound ? 'Ir para o debate' : 'Próximo'} <ArrowIcon /></Primary></div>
    </div>
  );
}

/* ---------- Debate ---------- */
export function TalkScreen({ s, d }: P) {
  const leave = useLeave(d);
  const ask = useAsk();
  const total = s.settings.talkSeconds;
  const [left, setLeft] = useState(total);
  const ended = useRef(false);
  useEffect(() => {
    if (total === 0) return;
    const t = window.setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(t);
  }, [total]);
  useEffect(() => {
    if (total === 0) return;
    if (left > 0 && left <= 10) play('tick');
    if (left === 0 && !ended.current) { ended.current = true; play('timeup'); }
  }, [left, total]);
  const C = 2 * Math.PI * 105;
  const low = total > 0 && left <= 10 && left > 0;
  return (
    <div className="im-screen im-centered" data-testid="im-talk">
      <TopBar leave onBack={leave} center={<span className="im-status">Debate</span>} />
      <div className="im-body im-mid">
        {total > 0 ? (
          <div className={`im-timer${low ? ' low' : ''}`} role="timer" aria-label="Tempo do debate">
            <svg viewBox="0 0 240 240" aria-hidden="true"><circle className="tr" cx="120" cy="120" r="105" /><circle className="pr" cx="120" cy="120" r="105" strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} /></svg>
            <output>{left === 0 ? 'Tempo!' : fmtTime(left)}</output>
            <Icon name="ampulheta" size={44} className="im-hourglass" />
          </div>
        ) : (
          <div className="im-timer free"><Icon name="ampulheta" size={120} className="im-hourglass big" /></div>
        )}
        <p className="im-sub">{s.round!.mode === 'wrong' ? 'Todos responderam. Quem recebeu outra pergunta?' : `Fim das ${clueRounds(s)} rodadas. Quem está escondendo algo?`}</p>
      </div>
      <div className="im-foot"><Primary testId="im-tovote" onClick={() => (total > 0 && left > 0 ? ask({ title: 'Ainda tem tempo de debate', text: 'Todo mundo já conversou o que queria? A votação é secreta e não dá para voltar.', confirm: 'Ir votar', cancel: 'Voltar ao debate', onConfirm: () => d({ type: 'go', phase: 'vote' }) }) : d({ type: 'go', phase: 'vote' }))}>Ir para a votação <ArrowIcon /></Primary></div>
    </div>
  );
}

/* ---------- Voto secreto ---------- */
export function VoteScreen({ s, d }: P) {
  const leave = useLeave(d);
  const me = s.players[s.voter]!;
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { play('pass'); }, [s.voter]);
  const last = s.voter === s.players.length - 1;
  if (s.voteStep === 'pass') {
    return (
      <div className="im-screen im-centered" data-testid="im-votepass">
        <TopBar leave onBack={leave} center={<span className="im-status">Votação secreta · {s.voter + 1} de {s.players.length}</span>} />
        <div className="im-body im-mid">
          <Coin avatar={me.avatar} color={s.voter} size="xl" className="im-pop" />
          <div>
            <p className="im-hint im-rise" style={{ '--d': 2 } as CSSProperties}>Passe o celular para</p>
            <div className="im-name"><Words text={me.name} /></div>
          </div>
          <p className="im-sub im-rise" style={{ '--d': 4 } as CSSProperties}>Só {me.name} olha agora. O voto é secreto.</p>
        </div>
        <div className="im-foot"><Primary testId="im-voteready" sound="pass" onClick={() => d({ type: 'voteReady' })}>Sou eu, votar <ArrowIcon /></Primary></div>
      </div>
    );
  }
  return (
    <div className="im-screen" data-testid="im-vote">
      <TopBar leave onBack={leave} center={<span className="im-status">Votação secreta · {s.voter + 1} de {s.players.length}</span>} />
      <div className="im-body">
        <div className="im-whovotes">
          <Coin avatar={me.avatar} color={s.voter} size="md" />
          <div><p className="im-hint">Passe o celular para</p><b className="im-votername">{me.name}</b></div>
          <Icon name="lupa" size={52} className="im-lupa" />
        </div>
        <h2 className="im-t"><Words text="Quem é o impostor?" /></h2>
        <div className="im-vgrid">
          {s.players.map((p, i) => p.id === me.id ? null : (
            <button key={p.id} type="button" className="im-vote im-rise" style={{ '--d': (i % 4) + 1 } as CSSProperties} aria-pressed={sel === p.id} data-testid={`im-vote-${p.id}`} onClick={() => { play('select'); setSel(p.id); }}>
              <Coin avatar={p.avatar} color={i} size="lg" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="im-foot">
        <Primary disabled={!sel} testId="im-cast" sound="vote" onClick={() => sel && d({ type: 'castVote', target: sel })}>
          {sel ? (last ? 'Confirmar e ver o resultado' : 'Confirmar voto') : 'Escolha alguém'}
        </Primary>
      </div>
    </div>
  );
}

/* ---------- Resultado, chute e placar ---------- */
function Confetti() {
  const bits = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: Math.round(Math.random() * 100), dl: (Math.random() * 0.8).toFixed(2), c: i % 6 })), []);
  const cols = ['#ff6a2b', '#2f5bff', '#ffd23f', '#33c27f', '#ff9ecf', '#8f6bff'];
  return <div className="im-conf" aria-hidden="true">{bits.map((b, i) => <i key={i} style={{ left: `${b.x}%`, animationDelay: `${b.dl}s`, background: cols[b.c] }} />)}</div>;
}

/** Revelação com tensão: pergunta, suspense, quem é, quem votou, veredito. */
export function ResultScreen({ s, d }: P) {
  const r = s.result!;
  const leave = useLeave(d);
  const guessing = r.canGuess.length > 0;
  const win = r.innocentsWin;
  const many = r.outsiders.length > 1;
  // quem acertou aparece primeiro; depois quem votou em outra pessoa
  const hitOf = (id: string) => r.outsiders.includes(s.votes[id] ?? '');
  const voters = s.players.filter((p) => !r.outsiders.includes(p.id)).sort((a, b) => Number(hitOf(b.id)) - Number(hitOf(a.id)));
  // 0 suspense · 1 nomes · 2 quem votou · 3 veredito e botão
  const [stage, setStage] = useState(0);
  const asking = s.resultStep === 'ask';
  useEffect(() => {
    if (asking) return undefined;
    setStage(0);
    const rowsMs = voters.length * 320 + 500;
    const ts = [
      window.setTimeout(() => { setStage(1); play('reveal'); }, 2600),
      window.setTimeout(() => setStage(2), 4400),
      window.setTimeout(() => { setStage(3); if (!guessing) play(win ? 'win' : 'lose'); }, 4400 + rowsMs),
    ];
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, [asking, voters.length, guessing, win]);
  const skip = () => { setStage(3); play(guessing ? 'reveal' : win ? 'win' : 'lose'); };

  if (asking) {
    return (
      <div className="im-screen im-centered" data-testid="im-result">
        <TopBar leave onBack={leave} center={<span className="im-status">Resultado</span>} />
        <div className="im-body im-mid">
          <Icon name="lupa" size={120} className="im-hourglass big" />
          <h2 className="im-t"><Words text="Todos votaram" /></h2>
          <p className="im-sub">{many ? 'Já podem revelar os impostores desta rodada?' : 'Já podem revelar o impostor desta rodada?'}</p>
        </div>
        <div className="im-foot"><Primary testId="im-revealnow" sound="start" onClick={() => d({ type: 'revealNow' })}>{many ? 'Revelar os impostores' : 'Revelar o impostor'} <ArrowIcon /></Primary></div>
      </div>
    );
  }

  const names = r.outsiders.map((id) => by(s, id).name);
  return (
    <div className={`im-screen im-centered im-tense${stage >= 1 ? ' lit' : ''}`} data-testid="im-result" data-stage={stage}>
      {stage >= 3 && !guessing && win && <Confetti />}
      <TopBar center={<span className="im-status">Resultado</span>} />
      <div className="im-body im-mid im-revbody">
        <p className="im-suspense" aria-live="polite">
          {many ? 'Os impostores são' : 'O impostor é'}
          {stage === 0 && <span className="im-dots" aria-hidden="true"><i /><i /><i /></span>}
        </p>
        {stage >= 1 && (
          <div className="im-slam" data-testid="im-culprits">
            <div className="im-reveal">{r.outsiders.map((id, i) => <span key={id} style={{ '--i': i } as CSSProperties}>{coinOf(s, id, many ? 'lg' : 'xl')}</span>)}</div>
            <h2 className="im-culprit">{names.join(' e ')}</h2>
          </div>
        )}
        {stage >= 2 && (
          <ul className="im-voters" aria-label={many ? 'Quem votou neles' : 'Quem votou nele'}>
            {voters.map((p, i) => {
              const hit = hitOf(p.id);
              return (
                <li key={p.id} className={`im-voter ${hit ? 'hit' : 'miss'}`} style={{ '--i': i } as CSSProperties}>
                  {coinOf(s, p.id, 'sm')}
                  <b>{p.name}</b>
                  <span>{hit ? <><CheckIcon /> votou nele</> : 'votou em outro'}</span>
                </li>
              );
            })}
          </ul>
        )}
        {stage >= 3 && (
          <div className="im-verdict" data-testid="im-verdict">
            <span className={`im-banner${!guessing && !win ? ' bad' : guessing ? ' warn' : ''}`}>{guessing ? 'Última chance' : win ? 'Inocentes venceram' : 'Impostor venceu'}</span>
            <p className="im-sub">{guessing ? (many ? 'Os impostores pegos ainda podem tentar acertar a palavra.' : `${names[0]} foi pego, mas ainda pode tentar acertar a palavra.`) : win ? 'Todos os impostores foram pegos.' : r.caught.length ? 'Pelo menos um impostor escapou.' : 'Ninguém pegou o impostor.'}</p>
          </div>
        )}
      </div>
      <div className="im-foot">
        {stage < 3
          ? <button type="button" className="im-link" data-testid="im-skip" onClick={skip}>Pular a revelação</button>
          : guessing
            ? <Primary tone="blue" testId="im-guess" onClick={() => d({ type: 'go', phase: 'guess' })}>{r.canGuess.length === 1 ? `${by(s, r.canGuess[0]!).name} vai chutar` : 'Chutar a palavra'}</Primary>
            : <Primary testId="im-score" onClick={() => d({ type: 'finish' })}>Ver ranking <ArrowIcon /></Primary>}
      </div>
    </div>
  );
}

export function GuessScreen({ s, d }: P) {
  const leave = useLeave(d);
  const ask = useAsk();
  const [flash, show] = useFlash();
  const id = s.result!.canGuess[s.guessIdx]!;
  const p = by(s, id);
  const [text, setText] = useState('');
  useEffect(() => setText(''), [id]);
  const send = () => {
    if (!text.trim()) return show('Digite um chute, ou toque em "Passar a vez".');
    play('vote');
    d({ type: 'guess', text });
  };
  return (
    <div className="im-screen im-centered" data-testid="im-guessscreen">
      <TopBar leave onBack={leave} center={<span className="im-status">Última chance</span>} />
      <div className="im-body im-mid">
        {coinOf(s, id, 'xl', 'im-rise')}
        <h2 className="im-t"><Words text={`${p.name}, qual era a palavra?`} /></h2>
        <form className="im-add wide" onSubmit={(e) => { e.preventDefault(); send(); }}>
 <input id="im-guess" data-testid="im-guess-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Digite o seu chute" autoComplete="off" autoCapitalize="none" maxLength={40} aria-label="Chute da palavra" aria-invalid={!!flash} />
        </form>
      </div>
      {flash && <div className="im-foot-alert"><Alert n={flash.n}>{flash.m}</Alert></div>}
      <div className="im-foot">
        <Primary testId="im-guess-send" sound={null} onClick={send}>Chutar <ArrowIcon /></Primary>
        <button type="button" className="im-link" data-testid="im-guess-skip" onClick={() => ask({ title: 'Passar sem chutar?', text: 'Sem chute, a última chance é perdida e o impostor não ganha esses pontos.', confirm: 'Passar a vez', danger: true, onConfirm: () => d({ type: 'guess', text: '' }) })}>Passar a vez</button>
      </div>
    </div>
  );
}

/** Número que sobe de `from` até `to` (só o texto muda; nada de layout animado). */
function Count({ to, from, delay }: { to: number; from: number; delay: number }) {
  const [v, setV] = useState(from);
  useEffect(() => {
    if (from === to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return undefined; }
    let raf = 0;
    const t0 = performance.now() + delay;
    const dur = 900;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / dur));
      setV(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, from, delay]);
  return <>{v}</>;
}

/** Depois do chute: mostra se acertou ou errou; chute parecido vai para o grupo decidir. */
export function GuessResScreen({ s, d }: P) {
  const r = s.result!;
  const word = s.round!.civilText;
  const items = r.canGuess.map((id) => {
    const text = (s.guesses[id] ?? '').trim();
    const exact = guessIsRight(text, word);
    const ask = guessNeedsJudgement(text, word);
    const ok = exact || s.judged[id] === true;
    return { id, text, exact, ask, ok, open: ask && s.judged[id] === undefined };
  });
  const pending = items.some((i) => i.open);
  const anyRight = items.some((i) => i.ok);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 900);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => { if (shown && !pending) play(anyRight ? 'win' : 'lose'); }, [shown, pending, anyRight]);
  return (
    <div className="im-screen im-centered" data-testid="im-guessres" data-pending={pending ? '1' : '0'}>
      <TopBar center={<span className="im-status">Última chance</span>} />
      <div className="im-body im-mid im-revbody">
        <p className="im-suspense">A palavra era</p>
        <h2 className="im-culprit">{word}</h2>
        <ul className="im-guesslist">
          {items.map((i) => (
            <li key={i.id} className={`im-gcard ${i.open ? 'open' : i.ok ? 'ok' : 'no'}`}>
              <div className="im-grow">{coinOf(s, i.id, 'md')}<div><b>{by(s, i.id).name}</b><small>{i.text ? `respondeu “${i.text}”` : 'não chutou'}</small></div></div>
              {i.open ? (
                <div className="im-judge" data-testid={`im-judge-${i.id}`}>
                  <p className="im-sub">A palavra era <b>{word}</b>. {by(s, i.id).name} respondeu <b>{i.text}</b>. Para todos: vale?</p>
                  <div className="im-judgebtns">
                    <button type="button" className="im-chip yes" data-testid={`im-judge-yes-${i.id}`} onClick={() => { play('confirm'); d({ type: 'judge', id: i.id, ok: true }); }}>Vale</button>
                    <button type="button" className="im-chip no" data-testid={`im-judge-no-${i.id}`} onClick={() => { play('off'); d({ type: 'judge', id: i.id, ok: false }); }}>Não vale</button>
                  </div>
                </div>
              ) : (
                <span className={`im-verdictpill ${i.ok ? 'ok' : 'no'}`} data-testid={`im-guess-${i.ok ? 'ok' : 'no'}`}>{i.ok ? (i.exact ? 'ACERTOU' : 'ACERTOU · o grupo aceitou') : 'ERROU'}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="im-foot">
        <Primary disabled={pending} testId="im-guess-done" onClick={() => d({ type: 'finish' })}>{pending ? 'Decidam se vale' : 'Ver ranking'} <ArrowIcon /></Primary>
      </div>
    </div>
  );
}

export function ScoreScreen({ s, d }: P) {
  const ask = useAsk();
  const rows = sessionRanking(s.session);
  const lead = new Set(leaders(s.session).length === rows.length ? [] : leaders(s.session));
  const r = s.result!;
  const word = s.round!.civilText;
  useEffect(() => {
    play(r.innocentsWin ? 'win' : 'lose');
    const t = window.setTimeout(() => play(s.shift === 'brusque' ? 'rankbig' : 'rankcalm'), 1400);
    return () => window.clearTimeout(t);
  }, [r.innocentsWin, s.shift]);
  return (
    <div className="im-screen" data-testid="im-score">
      <TopBar center={<span className="im-status">Partida {s.session.games}</span>} />
      <div className="im-body">
        <div>
          <h2 className="im-t"><Words text={r.innocentsWin ? 'Inocentes venceram' : 'Impostores venceram'} /></h2>
          <p className="im-sub im-rise" style={{ '--d': 2 } as CSSProperties}>A palavra era <b>{word}</b>{s.round!.outsiderText && s.round!.mode !== 'wrong' ? ` · parecida: ${s.round!.outsiderText}` : ''}</p>
        </div>
        <ol className="im-score" aria-label="Ranking da sessão">
          {rows.map((row, i) => {
            const g = s.gains[row.id] ?? 0;
            return (
              <li key={row.id} className={`im-srow${lead.has(row.id) ? ' lead' : ''}`} style={{ '--i': i } as CSSProperties}>
                <span className="im-pos">{row.position}</span>
                <span className="im-cw">{coinOf(s, row.id, 'sm')}{lead.has(row.id) && <Icon name="coroa" size={34} className="im-crown" />}</span>
                <b>{by(s, row.id).name}</b>
                {g > 0 && <span className="im-gain">+{g}</span>}
                <span className="im-pts"><Count to={row.points} from={row.points - g} delay={900} /><small>pts</small></span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="im-foot im-endfoot">
        <Primary testId="im-more" onClick={() => d({ type: 'go', phase: 'players' })}>Continuar jogando <ArrowIcon /></Primary>
        <Primary tone="ghost" sound="shuffle" testId="im-again" onClick={() => d({ type: 'start' })}>Tudo igual, outra partida</Primary>
        <button type="button" className="im-link" data-testid="im-end" onClick={() => ask({ title: 'Encerrar a partida?', text: `O ranking final aparece e a sessão termina (${s.session.games} ${s.session.games === 1 ? 'partida jogada' : 'partidas jogadas'}).`, confirm: 'Encerrar', danger: true, onConfirm: () => d({ type: 'go', phase: 'final' }) })}>Encerrar partida</button>
      </div>
    </div>
  );
}

/* ---------- Ranking final ---------- */
export function FinalScreen({ s, d, exit }: P) {
  const ask = useAsk();
  const rows = sessionRanking(s.session);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  useEffect(() => { play('win'); }, []);
  const medal = (pos: number) => (pos === 1 ? 'trofeu' : pos === 2 ? 'prata' : 'bronze');
  return (
    <div className="im-screen" data-testid="im-final">
      <Confetti />
      <TopBar center={<span className="im-status">{s.session.games} {s.session.games === 1 ? 'partida' : 'partidas'}</span>} />
      <div className="im-body">
        <h2 className="im-t"><Words text="Ranking final" /></h2>
        <div className="im-podium">
          {podium.map((row, i) => (
            <div key={row.id} className={`im-pod p${row.position}`} style={{ '--i': i } as CSSProperties}>
              <Icon name={medal(i + 1)} size={56} className="im-medal" />
              {coinOf(s, row.id, 'lg')}
              <b>{by(s, row.id).name}</b>
              <span className="im-pts">{row.points}<small>pts</small></span>
            </div>
          ))}
        </div>
        {rest.length > 0 && (
          <ol className="im-score" start={4}>
            {rest.map((row, i) => (
              <li key={row.id} className="im-srow" style={{ '--i': i } as CSSProperties}>
                <span className="im-pos">{row.position}</span>{coinOf(s, row.id, 'sm')}<b>{by(s, row.id).name}</b>
                <span className="im-pts">{row.points}<small>pts</small></span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="im-foot">
        <Primary testId="im-new" sound={null} onClick={() => ask({ title: 'Começar uma nova sessão?', text: 'O ranking atual será apagado. Os jogadores continuam na mesa.', confirm: 'Nova sessão', danger: true, onConfirm: () => d({ type: 'reset' }) })}>Nova sessão <ArrowIcon /></Primary>
        <button type="button" className="im-link" onClick={() => { play('back'); exit(); }}>Sair</button>
      </div>
    </div>
  );
}

/* ---------- Ranking sempre à vista ---------- */
export function RankChip({ s, onOpen }: { s: State; onOpen: () => void }) {
  if (s.session.games === 0) return null;
  const rows = sessionRanking(s.session).slice(0, 3);
  return (
    <button type="button" className="im-rankchip" aria-label="Ver o ranking da sessão" data-testid="im-rank" onClick={() => { play('tap'); onOpen(); }}>
      <Icon name="coroa" size={26} />
      {rows.map((r) => <span key={r.id} className="im-rc">{coinOf(s, r.id, 'sm')}<b>{r.points}</b></span>)}
    </button>
  );
}

export function RankSheet({ s, onClose }: { s: State; onClose: () => void }) {
  const rows = sessionRanking(s.session);
  const lead = new Set(leaders(s.session).length === rows.length ? [] : leaders(s.session));
  return (
    <Sheet title={`Ranking · ${s.session.games} ${s.session.games === 1 ? 'partida' : 'partidas'}`} onClose={onClose}>
      <ol className="im-score compact">
        {rows.map((row) => (
          <li key={row.id} className={`im-srow${lead.has(row.id) ? ' lead' : ''}`}>
            <span className="im-pos">{row.position}</span><span className="im-cw">{coinOf(s, row.id, 'sm')}{lead.has(row.id) && <Icon name="coroa" size={34} className="im-crown" />}</span><b>{by(s, row.id).name}</b>
            <span className="im-pts">{row.points}<small>pts</small></span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}
