import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  MIM_MAX_PLAYERS, MIM_MAX_ROUNDS, MIM_MAX_TEAMS, MIM_MIN_PLAYERS, MIM_MIN_ROUNDS, MIM_MIN_TEAMS, MIM_POINTS, MIM_SECONDS_CHOICES, MIM_SPEED_SKIPS,
  mimCategoriesFor, mimEstimateMinutes, mimPoolSize, mimRanking, mimRemainingToAssign, mimSpeedCurrent, mimSpeedSkipsLeft, mimWinners,
  type MimSession,
} from '@nocap/games';
import { AVATARS, COLORS, CATEGORY_ICONS, PEOPLE, iconSrc } from '../impostor/assets';
import { play } from '../impostor/audio';
import { Alert, ArrowIcon, CheckIcon, Coin, Icon, PlusIcon, Primary, Sheet, Stepper, TopBar, Words, useAsk, useFlash } from '../impostor/ui';
import { Count } from '../impostor/screens';
import { correctCount, mimerId, poolOk, sideBy, sidesOf, sidesOk, totalTurns, type Action, type Side, type State } from './state';

interface P {
  s: State;
  d: (a: Action) => void;
  exit: () => void;
}

/** Atalhos de teste: com `mm-fast`, nada de contagem 3-2-1 nem cartelas, e o relógio dura `mm-secs` segundos (padrão 4). */
export const fast = (): boolean => {
  try {
    return localStorage.getItem('mm-fast') === '1';
  } catch {
    return false;
  }
};

export const ICONS: Readonly<Record<string, string>> = { ...CATEGORY_ICONS, profissoes: 'profissoes', objetos: 'objetos', acoes: 'acoes' };

const fmtClock = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

/** Time e pessoa são fichas redondas de cor fixa com um personagem (o mesmo conjunto do Impostor). */
export function Chip({ side, size = 'md', className = '' }: { s?: State; side: Side; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  return <Coin avatar={side.avatar} color={side.color} size={size} className={className} />;
}

const PencilIcon = ({ big }: { big?: boolean }) => (
  <span className={`im-edit${big ? ' big' : ''}`} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg></span>
);

/** Folha com os personagens: os que já estão com outro time ou pessoa ficam esmaecidos (igual ao Impostor). */
function AvatarSheet({ title, current, taken, color, onPick, onClose }: { title: string; current: string; taken: Set<string>; color: number; onPick: (a: string) => void; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="im-avgrid" role="listbox" aria-label="Personagens">
        {AVATARS.map((a) => {
          const mine = a === current;
          const used = taken.has(a) && !mine;
          return (
            <button key={a} type="button" role="option" aria-selected={mine} disabled={used} className="im-avopt" data-on={mine} onClick={() => { play('select'); onPick(a); onClose(); }}>
              <Coin avatar={a} color={color} size="md" />
            </button>
          );
        })}
      </div>
      <p className="im-sub small">{PEOPLE.length} pessoas e {AVATARS.length - PEOPLE.length} bichos. Os esmaecidos já estão com outro jogador.</p>
    </Sheet>
  );
}

function useLeave(d: (a: Action) => void) {
  const ask = useAsk();
  return () =>
    ask({ title: 'Sair da partida?', text: 'O turno em andamento se perde. O placar fica como está e vocês voltam às regras.', confirm: 'Sair da partida', cancel: 'Continuar jogando', danger: true, onConfirm: () => d({ type: 'leave' }) });
}

const HELP = [
  ['Sem falar', 'Quem faz a mímica não fala, não faz som e não escreve no ar.'],
  ['Sem apontar', 'Não vale apontar para objetos, pessoas ou letras. O corpo todo vale.'],
  ['Sem pistas', 'Quem faz a mímica não diz "sim" nem "não" para os palpites.'],
];

function HelpSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Regras da mímica" onClose={onClose}>
      <ul className="mm-rules">
        {HELP.map(([t, x]) => <li key={t}><b>{t}</b><span>{x}</span></li>)}
      </ul>
      <Primary sound="confirm" onClick={onClose}>Entendi</Primary>
    </Sheet>
  );
}

const HelpBtn = ({ onOpen }: { onOpen: () => void }) => (
  <button type="button" className="im-iconbtn" aria-label="Regras da mímica" data-testid="mm-help" onClick={() => { play('tap'); onOpen(); }}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 9a2.5 2.5 0 114 2c-.9.7-1.5 1.2-1.5 2.4M12 17h.01" /></svg>
  </button>
);

/* ---------- Modo ---------- */
const COMBO_TEXT: Record<string, string> = {
  'teams-classic': 'Uma palavra por vez. O time tem o tempo para acertar. Se não acertar, os outros times podem roubar uma parte dos pontos.',
  'solo-classic': 'Uma palavra por vez, e todo mundo tenta adivinhar ao mesmo tempo. Quem acertar primeiro ganha pontos, e quem fez a mímica também.',
  'teams-speed': 'Muitas palavras curtas num minuto. O time da mímica soma um ponto por palavra acertada. Dá para pular até 3.',
  'solo-speed': 'Muitas palavras curtas num minuto. Quem faz a mímica ganha mais por palavra, quem acerta ganha menos. Dá para pular até 3.',
};

export function ModeScreen({ s, d, exit }: P) {
  const [help, setHelp] = useState(false);
  return (
    <div className="im-screen" data-testid="mm-mode">
      <TopBar onBack={exit} center={<span className="im-status">Mímica</span>} right={<HelpBtn onOpen={() => setHelp(true)} />} />
      <div className="im-body">
        <h2 className="im-t"><Words text="Como vamos jogar?" /></h2>
        <div className="mm-seg" role="radiogroup" aria-label="Quem joga contra quem">
          {([['teams', 'Em times'], ['solo', 'Cada um por si']] as const).map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={s.format === id} data-testid={`mm-fmt-${id}`} onClick={() => { play('select'); d({ type: 'mode', format: id, style: s.style }); }}>
              {label}
            </button>
          ))}
        </div>
        <div className="im-cards">
          {([
            ['classic', 'Clássico', 'Palavras maiores e variadas, uma de cada vez.', 'cartas'],
            ['speed', 'Speed', 'Palavras rápidas, o máximo que der em um minuto.', 'ampulheta'],
          ] as const).map(([id, label, text, icon], i) => (
            <button key={id} type="button" className="im-card im-rise" style={{ '--d': i + 1 } as CSSProperties} aria-pressed={s.style === id} data-testid={`mm-style-${id}`} onClick={() => { play('select'); d({ type: 'mode', format: s.format, style: id }); }}>
              <Icon name={icon} size={56} className="mm-card-ic" />
              <span className="im-card-t"><b>{label}</b><small>{text}</small></span>
              <span className="im-ok" aria-hidden="true"><CheckIcon /></span>
            </button>
          ))}
        </div>
        <p className="mm-note" key={`${s.format}-${s.style}`} data-testid="mm-combo">{COMBO_TEXT[`${s.format}-${s.style}`]}</p>
      </div>
      <div className="im-foot"><Primary testId="mm-continue" onClick={() => d({ type: 'go', phase: 'sides' })}>Continuar <ArrowIcon /></Primary></div>
      {help && <HelpSheet onClose={() => setHelp(false)} />}
    </div>
  );
}

/* ---------- Times ou jogadores ---------- */
function TeamsPanel({ s, d }: P) {
  const [picking, setPicking] = useState<string | null>(null);
  const cur = s.teams.find((t) => t.id === picking);
  return (
    <>
      <ul className="im-plist" data-testid="mm-teams">
        {s.teams.map((t, i) => (
          <li key={t.id} className="im-prow mm-trow" style={{ '--i': i } as CSSProperties}>
            <button type="button" className="im-coinbtn" aria-label={`Trocar o personagem de ${t.name}`} data-testid={`mm-team-av-${i}`} onClick={() => { play('tap'); setPicking(t.id); }}>
              <Coin avatar={t.avatar} color={t.color} size="sm" />
              <PencilIcon />
            </button>
            <label className="mm-namefield">
              <span className="mm-namelabel">Nome do time {i + 1}</span>
              <span className="mm-nameinput">
                <input value={t.name} maxLength={16} aria-label={`Nome do time ${i + 1}`} data-testid={`mm-team-${i}`} onChange={(e) => d({ type: 'renameTeam', id: t.id, name: e.target.value })} />
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>
              </span>
            </label>
            <button type="button" className="im-x" aria-label={`Remover ${t.name}`} disabled={s.teams.length <= MIM_MIN_TEAMS} onClick={() => { play('remove'); d({ type: 'removeTeam', id: t.id }); }}>×</button>
          </li>
        ))}
      </ul>
      {s.teams.length < MIM_MAX_TEAMS && (
        <button type="button" className="im-chip add mm-addteam" data-testid="mm-addteam" onClick={() => { play('add'); d({ type: 'addTeam' }); }}>
          <PlusIcon /> Adicionar time
        </button>
      )}
      <p className="im-sub small">Toque no nome para editar e na foto para trocar o personagem. Cada time precisa de pelo menos 2 pessoas.</p>
      {cur && (
        <AvatarSheet title={`Personagem de ${cur.name}`} current={cur.avatar} taken={new Set(s.teams.map((t) => t.avatar))} color={cur.color} onPick={(a) => d({ type: 'setAvatar', id: cur.id, avatar: a })} onClose={() => setPicking(null)} />
      )}
    </>
  );
}

function PlayersPanel({ s, d }: P) {
  const [name, setName] = useState('');
  const [picking, setPicking] = useState<string | null>(null);
  const [flash, show, clear] = useFlash();
  const taken = new Set(s.players.map((p) => p.avatar));
  const pick = () => {
    const free = AVATARS.filter((a) => !taken.has(a));
    return free[Math.floor(Math.random() * free.length)] ?? AVATARS[0]!;
  };
  const [draft, setDraft] = useState(pick);
  useEffect(() => { if (taken.has(draft)) setDraft(pick()); }, [s.players.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return show('Digite o nome de quem vai jogar.');
    if (s.players.length >= MIM_MAX_PLAYERS) return show(`A mesa lotou: no máximo ${MIM_MAX_PLAYERS} jogadores.`);
    if (s.players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return show(`Já tem alguém chamado ${n}. Use outro nome.`);
    clear();
    play('add');
    d({ type: 'addPlayer', name: n, avatar: draft });
    setName('');
  };
  const cur = s.players.find((p) => p.id === picking);
  return (
    <>
      <ul className="im-plist" data-testid="mm-players">
        {s.players.map((p, i) => (
          <li key={p.id} className="im-prow" style={{ '--i': i } as CSSProperties}>
            <button type="button" className="im-coinbtn" aria-label={`Trocar o personagem de ${p.name}`} onClick={() => { play('tap'); setPicking(p.id); }}><Coin avatar={p.avatar} color={i} size="sm" /><PencilIcon /></button>
            <b>{p.name}</b>
            <button type="button" className="im-x" aria-label={`Remover ${p.name}`} onClick={() => { play('remove'); d({ type: 'removePlayer', id: p.id }); }}>×</button>
          </li>
        ))}
      </ul>
      {s.players.length < MIM_MAX_PLAYERS && (
        <form className="im-add im-addrow" onSubmit={submit}>
          <button type="button" className="im-draft" aria-label="Escolher o personagem" data-testid="mm-draft" onClick={() => { play('tap'); setPicking('new'); }}><Coin avatar={draft} color={s.players.length} size="md" /><PencilIcon big /></button>
          <input data-testid="mm-name" value={name} onChange={(e) => { setName(e.target.value); clear(); }} placeholder="Nome" maxLength={14} autoComplete="off" enterKeyHint="done" aria-label="Nome do jogador" />
          <button className="im-iconbtn pri" aria-label="Adicionar jogador" data-testid="mm-add"><PlusIcon /></button>
        </form>
      )}
      {flash && <Alert n={flash.n}>{flash.m}</Alert>}
      {picking && (
        <AvatarSheet title={cur ? `Personagem de ${cur.name}` : 'Escolha o personagem'} current={cur ? cur.avatar : draft} taken={taken} color={cur ? cur.color : s.players.length} onPick={(a) => (cur ? d({ type: 'setAvatar', id: cur.id, avatar: a }) : setDraft(a))} onClose={() => setPicking(null)} />
      )}
    </>
  );
}

export function SidesScreen({ s, d }: P) {
  const [flash, show, clear] = useFlash();
  const teams = s.format === 'teams';
  const sides = sidesOf(s);
  const goOn = () => {
    if (teams) {
      if (s.teams.some((t) => !t.name.trim())) return show('Todo time precisa de um nome.');
      const names = s.teams.map((t) => t.name.trim().toLowerCase());
      if (new Set(names).size !== names.length) return show('Dois times estão com o mesmo nome. Troque um deles.');
    }
    if (!sidesOk(s)) return show(teams ? `São precisos pelo menos ${MIM_MIN_TEAMS} times.` : `São precisos pelo menos ${MIM_MIN_PLAYERS} jogadores. Faltam ${MIM_MIN_PLAYERS - sides.length}.`);
    clear();
    play('start');
    d({ type: 'go', phase: 'cats' });
  };
  const few = !sidesOk(s);
  return (
    <div className="im-screen" data-testid="mm-sides">
      <TopBar onBack={() => d({ type: 'go', phase: 'mode', back: true })} center={<span className="im-status">{teams ? 'Times' : 'Jogadores'}</span>} />
      <div className="im-body">
        <h2 className="im-t"><Words text={teams ? 'Quem joga em cada time?' : 'Quem vai jogar?'} /></h2>
        <p className={`im-sub center${few ? ' warn' : ''}`}>
          {teams ? `${s.teams.length} times · de ${MIM_MIN_TEAMS} a ${MIM_MAX_TEAMS}` : `${s.players.length} na mesa · de ${MIM_MIN_PLAYERS} a ${MIM_MAX_PLAYERS}`}
        </p>
        {teams ? <TeamsPanel s={s} d={d} exit={() => undefined} /> : <PlayersPanel s={s} d={d} exit={() => undefined} />}
      </div>
      {flash && <div className="im-foot-alert"><Alert n={flash.n}>{flash.m}</Alert></div>}
      <div className="im-foot"><Primary sound={null} testId="mm-continue" className={few ? 'soft' : ''} onClick={goOn}>Continuar <ArrowIcon /></Primary></div>
    </div>
  );
}

/* ---------- Temas ---------- */
export function CatsScreen({ s, d }: P) {
  const [flash, show, clear] = useFlash();
  const cats = mimCategoriesFor(s.style);
  const n = s.settings.categories.filter((c) => cats.some((x) => x.id === c)).length;
  const size = mimPoolSize(s.style, s.settings.categories);
  const goOn = () => {
    if (n === 0) return show('Escolha pelo menos 1 tema. Toque nos cartões acima.');
    if (!poolOk(s)) return show(`Só ${size} palavras com essa escolha. Escolha mais temas.`);
    clear();
    play('start');
    d({ type: 'go', phase: 'cfg' });
  };
  return (
    <div className="im-screen" data-testid="mm-cats">
      <TopBar onBack={() => d({ type: 'go', phase: 'sides', back: true })} center={<span className="im-status">Temas</span>} />
      <div className="im-body">
        <h2 className="im-t"><Words text="O que vamos mimicar?" /></h2>
        <div className={`im-meter${n === 0 ? ' empty' : ''}`} key={n} aria-live="polite">
          <span className="im-meter-n"><b>{n}</b> de {cats.length} temas · {size} palavras</span>
          <span className="im-meter-dots" aria-hidden="true">{cats.map((c, i) => <i key={c.id} className={i < n ? 'on' : ''} />)}</span>
        </div>
        <div className="im-tiles">
          {cats.map((c, i) => {
            const on = s.settings.categories.includes(c.id);
            return (
              <div key={c.id} className="im-tilewrap im-rise" style={{ '--d': (i % 6) + 1 } as CSSProperties}>
                <button type="button" className="im-tile" aria-pressed={on} data-testid={`mm-cat-${c.id}`} onClick={() => { play('select'); clear(); d({ type: 'toggleCategory', id: c.id }); }}>
                  <Icon name={ICONS[c.id] ?? 'jogo'} size={64} className="im-tile-ic" />
                  <span>{c.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {(flash || s.error) && <div className="im-foot-alert"><Alert n={flash?.n ?? 0}>{flash?.m ?? s.error}</Alert></div>}
      <div className="im-foot"><Primary sound={null} testId="mm-continue" className={n === 0 ? 'soft' : ''} onClick={goOn}>Continuar <ArrowIcon /></Primary></div>
    </div>
  );
}

/* ---------- Regras da partida ---------- */
export function CfgScreen({ s, d }: P) {
  const [help, setHelp] = useState(false);
  const sides = sidesOf(s).length;
  const turns = totalTurns(s);
  const mins = mimEstimateMinutes(s.style, s.settings.seconds, sides, s.settings.rounds);
  const unit = s.format === 'teams' ? 'time' : 'pessoa';
  return (
    <div className="im-screen" data-testid="mm-cfg">
      <TopBar onBack={() => d({ type: 'go', phase: 'cats', back: true })} center={<span className="im-status">Regras</span>} right={<HelpBtn onOpen={() => setHelp(true)} />} />
      <div className="im-body">
        <h2 className="im-t"><Words text="Quase lá" /></h2>
        <div className="im-rows">
          <div className="im-row">
            <span><b>Rodadas</b><small>Cada {unit} faz {s.style === 'classic' ? 'uma mímica' : 'um turno'} por rodada</small></span>
            <Stepper value={s.settings.rounds} label="rodadas" min={MIM_MIN_ROUNDS} max={MIM_MAX_ROUNDS} onChange={(n) => d({ type: 'settings', patch: { rounds: n } })} />
          </div>
          <div className="im-row mm-timerow">
            <span><b>Tempo {s.style === 'classic' ? 'da mímica' : 'do turno'}</b><small>Define quanto tempo cada vez dura</small></span>
            <div className="im-pills" role="radiogroup" aria-label="Tempo">
              {MIM_SECONDS_CHOICES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={s.settings.seconds === t} className="im-pill" aria-pressed={s.settings.seconds === t} data-testid={`mm-sec-${t}`} onClick={() => { play('select'); d({ type: 'settings', patch: { seconds: t } }); }}>{t}s</button>
              ))}
            </div>
          </div>
        </div>
        <div className="mm-sum" data-testid="mm-sum">
          <b>{turns}</b> {s.style === 'classic' ? (turns === 1 ? 'mímica' : 'mímicas') : (turns === 1 ? 'turno' : 'turnos')}
          <span> · cerca de <b>{mins}</b> min</span>
        </div>
      </div>
      {s.error && <div className="im-foot-alert"><Alert n={1}>{s.error}</Alert></div>}
      <div className="im-foot"><Primary testId="mm-start" onClick={() => d({ type: 'start' })}>Começar o jogo <ArrowIcon /></Primary></div>
      {help && <HelpSheet onClose={() => setHelp(false)} />}
    </div>
  );
}

/* ---------- Ranking ---------- */
/** Placar com barras que crescem e linhas que trocam de lugar (só transform e opacity). */
export function Board({ s, from, to, gain }: { s: State; from: MimSession; to: MimSession; gain?: Record<string, number> }) {
  const rows = mimRanking(to);
  const was = new Map(mimRanking(from).map((r, i) => [r.id, i]));
  const max = Math.max(1, ...rows.map((r) => r.score));
  return (
    <ul className="mm-board" style={{ '--n': rows.length } as CSSProperties} data-testid="mm-board">
      {rows.map((r, i) => {
        const side = sideBy(s, r.id);
        const y0 = (was.get(r.id) ?? i) - i;
        const g = gain?.[r.id] ?? 0;
        return (
          <li key={r.id} className={`mm-brow${r.position === 1 ? ' top' : ''}${g > 0 ? ' up' : ''}`} style={{ '--y': i, '--y0': y0, '--w0': (from.scores[r.id] ?? 0) / max, '--w1': r.score / max } as CSSProperties} data-testid={`mm-brow-${i}`}>
            <span className="mm-pos">{r.position}</span>
            <Chip s={s} side={side} size="sm" />
            <span className="mm-bmid"><b>{side.name}</b><span className="mm-bar"><i /></span></span>
            <span className="mm-score"><Count from={from.scores[r.id] ?? 0} to={r.score} delay={500} /></span>
            {g > 0 && <span className="mm-gain" aria-label={`mais ${g} ${g === 1 ? 'ponto' : 'pontos'}`}>+{g}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function RankSheet({ s, onClose }: { s: State; onClose: () => void }) {
  return (
    <Sheet title="Placar" onClose={onClose}>
      <Board s={s} from={s.session} to={s.session} />
      <Primary sound="confirm" onClick={onClose}>Fechar</Primary>
    </Sheet>
  );
}

const RankBtn = ({ onOpen }: { onOpen: () => void }) => (
  <button type="button" className="im-iconbtn" aria-label="Ver o placar" data-testid="mm-rank" onClick={() => { play('tap'); onOpen(); }}>
    <img src={iconSrc('trofeu')} alt="" width="26" height="26" draggable={false} />
  </button>
);

/* ---------- Passar o celular ---------- */
export function PassScreen({ s, d }: P) {
  const [rank, setRank] = useState(false);
  const leave = useLeave(d);
  const side = sideBy(s, mimerId(s));
  const turn = s.schedule[s.turn]!;
  const teams = s.format === 'teams';
  return (
    <div className="im-screen mm-pass" data-testid="mm-pass">
      <TopBar onBack={leave} leave center={<span className="im-status">Rodada {turn.round} de {s.settings.rounds}</span>} right={<RankBtn onOpen={() => setRank(true)} />} />
      <div className="im-body im-mid">
        <Chip s={s} side={side} size="xl" className="mm-big" />
        <p className="im-instr">{teams ? 'Vez do time' : 'Vez de'}</p>
        <h2 className="im-name" data-testid="mm-who">{side.name}</h2>
        <p className="im-sub center">
          {teams
            ? 'O time escolhe quem faz a mímica. Só essa pessoa olha o celular. Os outros viram o rosto até ela começar.'
            : 'Pegue o celular e veja a palavra sem ninguém espiar. Os outros adivinham.'}
        </p>
        <p className="mm-count">{s.style === 'classic' ? 'Mímica' : 'Turno'} {turn.index + 1} de {s.schedule.length}</p>
      </div>
      <div className="im-foot"><Primary testId="mm-ready" sound="pass" onClick={() => d({ type: 'ready' })}>{teams ? 'Vamos lá' : 'Sou eu'} <ArrowIcon /></Primary></div>
      {rank && <RankSheet s={s} onClose={() => setRank(false)} />}
    </div>
  );
}

/* ---------- Escolher a palavra (Clássico) ---------- */
export function ChooseScreen({ s, d }: P) {
  const leave = useLeave(d);
  const labels = useMemo(() => Object.fromEntries(mimCategoriesFor('classic').map((c) => [c.id, c.label])), []);
  return (
    <div className="im-screen" data-testid="mm-choose">
      <TopBar onBack={leave} leave center={<span className="im-status">Só você olha</span>} />
      <div className="im-body">
        <h2 className="im-t"><Words text="Escolha uma palavra" /></h2>
        <p className="im-sub center">Toque na palavra que vai mimicar. O relógio começa em seguida.</p>
        <div className="mm-options">
          {s.cur?.options.map((w, i) => (
            <button key={w.id} type="button" className="mm-opt im-rise" style={{ '--d': i + 1 } as CSSProperties} data-testid={`mm-opt-${i}`} onClick={() => { play('select'); d({ type: 'choose', id: w.id }); }}>
              <Icon name={ICONS[w.category] ?? 'jogo'} size={48} className="mm-opt-ic" />
              <span><small>{labels[w.category]}</small><b>{w.text}</b></span>
              <span className="mm-opt-go" aria-hidden="true"><ArrowIcon /></span>
            </button>
          ))}
        </div>
      </div>
      <div className="im-foot" />
    </div>
  );
}

/* ---------- Jogando ---------- */
/** Contagem 3-2-1 antes do relógio (com `mm-fast` e "reduzir movimento" fica curta). */
function useCountdown(): number | null {
  const [n, setN] = useState<number | null>(fast() ? null : 3);
  useEffect(() => {
    if (n === null) return undefined;
    play(n === 0 ? 'start' : 'tick');
    const t = window.setTimeout(() => setN(n === 0 ? null : n - 1), n === 0 ? 450 : 750);
    return () => window.clearTimeout(t);
  }, [n]);
  return n;
}

function useClock(seconds: number, run: boolean, onEnd: () => void): number {
  const [left, setLeft] = useState(seconds);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const lastRef = useRef(seconds);
  useEffect(() => {
    if (!run) return undefined;
    const end = Date.now() + seconds * 1000;
    setLeft(seconds);
    const t = window.setInterval(() => {
      const l = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      if (l <= 5 && l > 0 && l !== lastRef.current) play('tick', 0.7);
      lastRef.current = l;
      setLeft(l);
      if (l <= 0) {
        window.clearInterval(t);
        play('timeup');
        endRef.current();
      }
    }, 200);
    return () => window.clearInterval(t);
  }, [run, seconds]);
  return left;
}

export function PlayScreen({ s, d }: P) {
  const leave = useLeave(d);
  const side = sideBy(s, mimerId(s));
  const seconds = fast() ? Number((() => { try { return localStorage.getItem('mm-secs'); } catch { return null; } })() ?? 4) : s.settings.seconds;
  const count = useCountdown();
  const run = count === null;
  const left = useClock(seconds, run, () => d({ type: 'timeup' }));
  const [peek, setPeek] = useState(false);
  const speed = s.style === 'speed';
  const t = s.cur?.speed ?? null;
  const word = speed ? (t ? mimSpeedCurrent(t) : null) : s.cur?.word ?? null;
  const urgent = run && left <= 10;
  return (
    <div className={`im-screen mm-play${urgent ? ' urgent' : ''}`} data-testid="mm-play" data-running={run}>
      <TopBar onBack={leave} leave center={<span className="mm-who"><Chip s={s} side={side} size="sm" /><b>{side.name}</b></span>} right={<span className="mm-clock" data-testid="mm-clock" aria-live="off">{fmtClock(run ? left : seconds)}</span>} />
      <div className="mm-timebar" aria-hidden="true">
        {run && <i style={{ '--dur': `${seconds}s` } as CSSProperties} key="bar" />}
      </div>
      <div className="im-body im-mid mm-stage">
        {!run && count !== null && (
          <div className={`mm-count321${count === 0 ? ' go' : ''}`} key={count} role="status" data-testid="mm-321">{count === 0 ? 'Valendo!' : count}</div>
        )}
        {run && (speed ? (
          <>
            <p className="mm-kicker">Palavra {correctCount(s) + (t?.skipped.length ?? 0) + 1}</p>
            <div className="mm-wordcard speed" key={word?.id} data-testid="mm-word">{word?.text ?? 'Acabaram as palavras'}</div>
            <p className="mm-tally"><b data-testid="mm-hits">{correctCount(s)}</b> {correctCount(s) === 1 ? 'acerto' : 'acertos'}</p>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`mm-peek${peek ? ' on' : ''}`}
              data-testid="mm-peek"
              aria-pressed={peek}
              onPointerDown={() => setPeek(true)}
              onPointerUp={() => setPeek(false)}
              onPointerLeave={() => setPeek(false)}
              onPointerCancel={() => setPeek(false)}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setPeek(true); }}
              onKeyUp={() => setPeek(false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {peek ? <b className="mm-peekword" data-testid="mm-word">{word?.text}</b> : <><Icon name="olhos" size={72} className="mm-eyes" /><b>Segure para ver a palavra</b><small>Solte para esconder</small></>}
            </button>
            <p className="mm-donts">Sem falar, sem som e sem apontar.</p>
          </>
        ))}
      </div>
      <div className="im-foot mm-actions">
        {run && speed && t && (
          <div className="mm-btnrow">
            <button type="button" className="im-btn ghost mm-skip" data-testid="mm-skip" disabled={mimSpeedSkipsLeft(t) <= 0 || !word} onClick={() => { play('tap'); d({ type: 'speedSkip' }); }}>
              Pular <span className="mm-skipn">{mimSpeedSkipsLeft(t)}/{MIM_SPEED_SKIPS}</span>
            </button>
            <Primary testId="mm-hit" sound="confirm" disabled={!word} onClick={() => d({ type: 'speedHit' })}>Acertou <CheckIcon /></Primary>
          </div>
        )}
        {run && !speed && (
          <Primary testId="mm-hit" sound="confirm" onClick={() => d({ type: 'hit' })}>{s.format === 'teams' ? 'Acertamos!' : 'Alguém acertou'} <CheckIcon /></Primary>
        )}
        {run && speed && (
          <button type="button" className="im-link mm-end" data-testid="mm-end" onClick={() => d({ type: 'timeup' })}>Encerrar o turno</button>
        )}
      </div>
    </div>
  );
}

/* ---------- Depois do tempo ---------- */
export function JudgeScreen({ s, d }: P) {
  const side = sideBy(s, mimerId(s));
  return (
    <div className="im-screen mm-judge" data-testid="mm-judge">
      <TopBar center={<span className="im-status">Fim do tempo</span>} />
      <div className="im-body im-mid">
        <Chip side={side} size="lg" className="mm-big" />
        <p className="im-instr">Acabou o tempo de</p>
        <h2 className="im-t" data-testid="mm-judge-who"><Words text={`${side.name} acertou a palavra?`} /></h2>
        <p className="im-sub center">Quem fez a mímica sabe a resposta e decide.</p>
      </div>
      <div className="im-foot">
        <Primary testId="mm-judge-yes" sound="confirm" onClick={() => d({ type: 'judge', guessed: true })}>Sim, acertou <CheckIcon /></Primary>
        <Primary testId="mm-judge-no" tone="ghost" sound="tap" onClick={() => d({ type: 'judge', guessed: false })}>Não acertou</Primary>
      </div>
    </div>
  );
}

/**
 * O time da vez não acertou. Com 2 times só existe um outro time, então a pergunta é sempre sobre ele (sim ou não).
 * Com 3 ou mais, pergunta se algum time sabe a palavra e a mesa marca quais times acertaram.
 */
export function StealScreen({ s, d }: P) {
  const me = mimerId(s);
  const others = s.teams.filter((t) => t.id !== me);
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => { play('select'); setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };
  const back = () => d({ type: 'go', phase: 'judge', back: true });
  if (others.length === 1) {
    const other = others[0]!;
    return (
      <div className="im-screen mm-judge" data-testid="mm-steal">
        <TopBar onBack={back} center={<span className="im-status">Hora de roubar</span>} />
        <div className="im-body im-mid">
          <Chip side={other} size="lg" className="mm-big" />
          <p className="im-instr">Agora é a vez de</p>
          <h2 className="im-t" data-testid="mm-steal-who"><Words text={`${other.name} acertou a palavra?`} /></h2>
          <p className="im-sub center">Vale {MIM_POINTS.teamsSteal} ponto para quem roubar.</p>
        </div>
        <div className="im-foot">
          <Primary testId="mm-steal-yes" sound="confirm" onClick={() => d({ type: 'steal', ids: [other.id] })}>Sim, acertou <CheckIcon /></Primary>
          <Primary testId="mm-steal-no" tone="ghost" sound="tap" onClick={() => d({ type: 'steal', ids: [] })}>Não acertou</Primary>
        </div>
      </div>
    );
  }
  return (
    <div className="im-screen mm-steal3" data-testid="mm-steal">
      <TopBar onBack={back} center={<span className="im-status">Hora de roubar</span>} />
      <div className="im-body">
        <h2 className="im-t" data-testid="mm-steal-who"><Words text="Algum time sabe a palavra?" /></h2>
        <p className="im-sub">Todos falam a resposta ao mesmo tempo e quem fez a mímica confirma. Toque nos times que acertaram (pode ser mais de um). Cada um ganha {MIM_POINTS.teamsSteal} ponto.</p>
        <ul className="mm-picks">
          {others.map((t, i) => (
            <li key={t.id} className="im-rise" style={{ '--d': i + 1 } as CSSProperties}>
              <button type="button" className="im-choice mm-pickbtn" aria-pressed={sel.includes(t.id)} data-testid={`mm-steal-${t.id}`} onClick={() => toggle(t.id)}>
                <Coin avatar={t.avatar} color={t.color} size="sm" />
                <span className="im-choice-t">{t.name} acertou</span>
                <span className="im-tick" aria-hidden="true"><CheckIcon /></span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="im-foot">
        <Primary testId="mm-steal-ok" sound="confirm" disabled={sel.length === 0} onClick={() => d({ type: 'steal', ids: sel })}>
          {sel.length === 0 ? 'Marque o time que acertou' : `Confirmar (${sel.length} ${sel.length === 1 ? 'time' : 'times'})`} <ArrowIcon />
        </Primary>
        <Primary testId="mm-steal-none" tone="ghost" sound="tap" onClick={() => d({ type: 'steal', ids: [] })}>Nenhum time sabe</Primary>
      </div>
    </div>
  );
}

/** Individual: quem acertou primeiro. */
export function PickScreen({ s, d }: P) {
  const me = mimerId(s);
  const others = s.players.filter((p) => p.id !== me);
  return (
    <div className="im-screen" data-testid="mm-pick">
      <TopBar center={<span className="im-status">Quem acertou?</span>} />
      <div className="im-body">
        <h2 className="im-t"><Words text="Quem acertou primeiro?" /></h2>
        <p className="im-sub">Quem acertou ganha {MIM_POINTS.soloGuesser} pontos e quem fez a mímica ganha {MIM_POINTS.soloMimer}.</p>
        <ul className="im-plist">
          {others.map((p, i) => (
            <li key={p.id} className="im-rise" style={{ '--d': (i % 6) + 1 } as CSSProperties}>
              <button type="button" className="im-prow mm-prowbtn" data-testid={`mm-pick-${i}`} onClick={() => { play('confirm'); d({ type: 'pick', id: p.id }); }}>
                <Coin avatar={p.avatar} color={p.color} size="sm" /><b>{p.name}</b><ArrowIcon />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="im-foot"><Primary tone="ghost" testId="mm-pick-none" sound="tap" onClick={() => d({ type: 'pick', id: null })}>Ninguém acertou</Primary></div>
    </div>
  );
}

/** Speed individual: distribui os acertos entre quem adivinhou, sem ter parado o turno. */
export function AssignScreen({ s, d }: P) {
  const me = mimerId(s);
  const total = correctCount(s);
  const others = s.players.filter((p) => p.id !== me);
  const [by, setBy] = useState<Record<string, number>>({});
  const left = mimRemainingToAssign(total, by);
  const set = (id: string, n: number) => setBy((p) => ({ ...p, [id]: Math.max(0, n) }));
  return (
    <div className="im-screen" data-testid="mm-assign">
      <TopBar center={<span className="im-status">Quem acertou?</span>} />
      <div className="im-body">
        <h2 className="im-t"><Words text="Quem acertou o quê?" /></h2>
        <p className={`mm-left${left === 0 ? ' done' : ''}`} data-testid="mm-left" aria-live="polite">
          {left === 0 ? 'Tudo distribuído' : <>Faltam <b>{left}</b> de {total}</>}
        </p>
        <ul className="im-plist">
          {others.map((p, i) => (
            <li key={p.id} className="im-prow mm-arow im-rise" style={{ '--d': (i % 6) + 1 } as CSSProperties}>
              <Coin avatar={p.avatar} color={p.color} size="sm" />
              <b>{p.name}</b>
              <div className="im-stepper">
                <button type="button" aria-label={`Menos um acerto de ${p.name}`} disabled={(by[p.id] ?? 0) <= 0} onClick={() => { play('select'); set(p.id, (by[p.id] ?? 0) - 1); }}>−</button>
                <output aria-label={`Acertos de ${p.name}`} data-testid={`mm-as-${i}`}>{by[p.id] ?? 0}</output>
                <button type="button" aria-label={`Mais um acerto de ${p.name}`} disabled={left <= 0} onClick={() => { play('select'); set(p.id, (by[p.id] ?? 0) + 1); }}>+</button>
              </div>
            </li>
          ))}
        </ul>
        <p className="im-sub small">O que sobrar fica sem dono: só quem fez a mímica pontua por essas palavras.</p>
      </div>
      <div className="im-foot"><Primary testId="mm-assign-ok" sound="confirm" onClick={() => d({ type: 'assign', guessedBy: by })}>Ver os pontos <ArrowIcon /></Primary></div>
    </div>
  );
}

/* ---------- Resultado do turno ---------- */
function Confetti() {
  return (
    <div className="mm-confetti" aria-hidden="true">
      {Array.from({ length: 26 }, (_, i) => <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--d': `${(i % 7) * 0.12}s`, '--r': `${(i * 53) % 360}deg`, '--c': COLORS[i % COLORS.length] } as CSSProperties} />)}
    </div>
  );
}

export function ResultScreen({ s, d }: P) {
  const side = sideBy(s, mimerId(s));
  const last = s.turn + 1 >= s.schedule.length;
  const next = !last ? sideBy(s, s.schedule[s.turn + 1]!.side) : null;
  const gained = Object.values(s.gain).some((n) => n > 0);
  const speed = s.style === 'speed';
  const okWords = s.shown.filter((x) => x.ok);
  useEffect(() => {
    const t = window.setTimeout(() => play(s.shift === 'brusque' ? 'rankbig' : 'rankcalm'), 500);
    if (gained) play('win', 0.6);
    return () => window.clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="im-screen mm-result" data-testid="mm-result">
      <TopBar center={<span className="im-status">Resultado</span>} />
      <div className="im-body">
        <div className="mm-reveal im-rise" style={{ '--d': 0 } as CSSProperties}>
          {speed ? (
            <>
              <p className="im-instr">{side.name}</p>
              <h2 className="im-t" data-testid="mm-res-title">{okWords.length} {okWords.length === 1 ? 'palavra' : 'palavras'}</h2>
              <ul className="mm-words">{s.shown.map(({ word, ok }) => <li key={word.id} className={ok ? 'ok' : 'skip'}>{word.text}</li>)}</ul>
            </>
          ) : (
            <>
              <p className="im-instr">A palavra era</p>
              <h2 className="im-name mm-theword" data-testid="mm-res-title">{s.shown[0]?.word.text}</h2>
              {!gained && <p className="im-sub center">Ninguém acertou desta vez.</p>}
            </>
          )}
        </div>
        <Board s={s} from={s.before} to={s.session} gain={s.gain} />
      </div>
      <div className="im-foot">
        <Primary testId="mm-next" sound="start" onClick={() => d({ type: 'next' })}>
          {last ? 'Ver o resultado final' : `Próximo: ${next?.name}`} <ArrowIcon />
        </Primary>
      </div>
      {gained && s.shift === 'brusque' && <Confetti />}
    </div>
  );
}

/* ---------- Final ---------- */
export function FinalScreen({ s, d, exit }: P) {
  const rows = mimRanking(s.session);
  const winners = mimWinners(s.session);
  const byPos = [1, 2, 3].map((p) => rows.filter((r) => r.position === p));
  const order = [byPos[1]!, byPos[0]!, byPos[2]!];
  const tie = winners.length > 1;
  useEffect(() => { play('win'); }, []);
  return (
    <div className="im-screen mm-final" data-testid="mm-final">
      <TopBar onBack={exit} center={<span className="im-status">Fim de jogo</span>} />
      <div className="im-body">
        <div className="mm-champ im-rise" style={{ '--d': 0 } as CSSProperties}>
          <img src={iconSrc('coroa')} alt="" width="64" height="64" draggable={false} />
          <h2 className="im-t" data-testid="mm-champ">
            {tie ? 'Empate!' : `${sideBy(s, winners[0]!).name} venceu`}
          </h2>
          {tie && <p className="im-sub center">{winners.map((w) => sideBy(s, w).name).join(' e ')} dividem o primeiro lugar.</p>}
        </div>
        <div className="mm-podium" data-testid="mm-podium">
          {order.map((col, i) => {
            const pos = i === 1 ? 1 : i === 0 ? 2 : 3;
            return (
              <div key={pos} className={`mm-pcol p${pos}`} style={{ '--i': pos } as CSSProperties}>
                <div className="mm-pwho">
                  {col.map((r) => <Chip key={r.id} s={s} side={sideBy(s, r.id)} size={pos === 1 ? 'lg' : 'md'} />)}
                  {col.length > 0 && <b>{col.map((r) => sideBy(s, r.id).name).join(', ')}</b>}
                  {col.length > 0 && <small>{col[0]!.score} pts</small>}
                </div>
                <div className="mm-block"><span>{pos}</span></div>
              </div>
            );
          })}
        </div>
        <Board s={s} from={s.session} to={s.session} />
      </div>
      <div className="im-foot">
        <Primary testId="mm-again" sound="start" onClick={() => d({ type: 'again' })}>Jogar de novo <ArrowIcon /></Primary>
        <Primary tone="ghost" testId="mm-rules" sound="tap" onClick={() => d({ type: 'go', phase: 'cfg', back: true })}>Mudar as regras</Primary>
      </div>
      <Confetti />
    </div>
  );
}
