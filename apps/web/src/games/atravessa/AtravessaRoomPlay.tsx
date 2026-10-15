import { useEffect, useRef, useState } from 'react';
import {
  ATR_TPS,
  AtravessaSim,
  AtravessaWorld,
  atravessaRoomRules,
  atravessaStartCol,
  laneBiome,
  trainState,
  type AtravessaEnd,
  type AtravessaInput,
  type Dir,
} from '@nocap/games';
import { createAtravessaAudio } from '@/lib/atravessa-audio';
import { useAuth } from '@/lib/auth';
import {
  at,
  sendRoom,
  sendRoomQuiet,
  serverNow,
  subscribeRoom,
  type RoomSnapshot,
} from '@/lib/rooms';
import { buzz } from '@/lib/sfx';
import { attachControls } from './input';
import { meters, raceTime } from './AtravessaReveal';
import { AtravessaScene } from './scene';
import './atravessa.css';
import './atravessa-room.css';

/** Uma amostra da posição de outra pessoa, vinda do servidor (fluxo "pos"). */
interface Sample {
  tick: number;
  x: number;
  y: number;
  hop: number;
  facing: number;
  flags: number;
  best: number;
  deaths: number;
  checkpoint: number;
  finishTick: number;
  /** A linha de agora (cai quando a pessoa morre e volta ao checkpoint). */
  row: number;
}
const F_ALIVE = 1;
const F_FINISHED = 2;
const F_STALLED = 4;

/** As outras raposas aparecem este tanto atrás do relógio do mundo: dá tempo de chegarem as amostras. */
const GHOST_DELAY = 12;
/** Depois de morrer no Infinito, a tela fica um instante na própria morte antes de ir assistir. */
const SPECTATE_AFTER_MS = 1500;

const OVER_TEXT: Record<AtravessaEnd, string> = {
  veiculo: 'ATROPELADO',
  trem: 'O TREM PASSOU',
  agua: 'CAIU NA ÁGUA',
  arrastado: 'A TORA TE LEVOU',
  afundou: 'AFUNDOU',
  mordido: 'O CROCODILO MORDEU',
  atingido: 'FOI VARRIDO',
  escuridao: 'A ESCURIDÃO TE PEGOU',
  parado: 'PAROU DEMAIS',
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Onde uma pessoa está no instante `t` (ticks do mundo), entre as amostras que o servidor mandou. */
function sampleAt(list: Sample[] | undefined, t: number) {
  if (!list || list.length === 0) return null;
  const first = list[0]!;
  if (t <= first.tick) return { ...first, alive: !!(first.flags & F_ALIVE) };
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1]!;
    const b = list[i]!;
    if (t > b.tick) continue;
    const cur = t >= b.tick ? b : a;
    const bothAlive = a.flags & F_ALIVE && b.flags & F_ALIVE && Math.hypot(b.x - a.x, b.y - a.y) < 4;
    if (!bothAlive || b.tick === a.tick) return { ...cur, alive: !!(cur.flags & F_ALIVE) };
    const k = (t - a.tick) / (b.tick - a.tick);
    return {
      ...b,
      x: lerp(a.x, b.x, k),
      y: lerp(a.y, b.y, k),
      hop: lerp(a.hop, b.hop, k),
      alive: true,
    };
  }
  const last = list[list.length - 1]!;
  return { ...last, alive: !!(last.flags & F_ALIVE) };
}

interface RankRow {
  id: string;
  name: string;
  color: string;
  meters: number;
  finished: boolean;
  alive: boolean;
  me: boolean;
}

interface Ui {
  count: number | 'go' | null;
  meters: number;
  clock: string;
  rank: RankRow[];
  /** Quem a pessoa está assistindo, se estiver. */
  watching: { id: string; name: string; color: string } | null;
  spectators: number;
  over: { kind: 'dead' | 'respawn' | 'finished' | 'late'; end?: AtravessaEnd; ms?: number } | null;
  checkpoint: number;
  /** Quantos metros faltam para o próximo checkpoint (ou a chegada); null fora do Checkpoint. */
  toNext: number | null;
  nextFinish: boolean;
}

const EMPTY_UI: Ui = {
  count: null,
  meters: 0,
  clock: '0:00,00',
  rank: [],
  watching: null,
  spectators: 0,
  over: null,
  checkpoint: 0,
  toNext: null,
  nextFinish: false,
};

/**
 * A partida do Atravessa! em sala (spec 031). Cada aparelho simula o seu herói com as regras do modo
 * e avisa o servidor, 10 vezes por segundo, em que tick está e quais passos deu; o servidor espelha
 * a mesma simulação e devolve as posições de todo mundo. As outras raposas aparecem atravessáveis,
 * com a cor e o nome de cada um. No Infinito, quem morre assiste; no Checkpoint, volta ao último.
 */
export function AtravessaRoomPlay({ snapshot }: { snapshot: RoomSnapshot }) {
  const round = snapshot.round;
  if (!round || !snapshot.atravessa || snapshot.atravessa.startAt === null) return null;
  return <RoundPlay key={round.seed} snapshot={snapshot} />;
}

function RoundPlay({ snapshot }: { snapshot: RoomSnapshot }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tags = useRef(new Map<string, HTMLDivElement>());
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  const user = useAuth((s) => s.user);
  const info = snapshot.atravessa!;
  const meId = info.me ?? user?.id ?? '';
  const seed = snapshot.round!.seed;
  const [ui, setUi] = useState<Ui>(EMPTY_UI);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(true);
  /** O brilho verde da tela ao passar por um checkpoint pela primeira vez (`n` muda a cada um, para recomeçar). */
  const [pulse, setPulse] = useState(0);
  /** Só o líder encerra, e com dois toques (um toque sem querer não acaba a partida de todo mundo). */
  const [confirmEnd, setConfirmEnd] = useState(false);
  useEffect(() => {
    if (!confirmEnd) return;
    const t = window.setTimeout(() => setConfirmEnd(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmEnd]);
  const ctl = useRef<{ cycle: (dir: 1 | -1) => void } | null>(null);

  useEffect(() => {
    const el = wrap.current!;
    const cv = canvas.current!;
    const first = snapRef.current;
    const cfg = first.atravessa!;
    const startAt = cfg.startAt!;
    const slotOf = (id: string) => cfg.slots[id] ?? 0;
    const colorOf = (id: string) => cfg.colors[id] ?? '#ff6a2b';
    const nameOf = (id: string) => at(snapRef.current.members.find((m) => m.id === id)?.username);

    let scene: AtravessaScene;
    try {
      scene = new AtravessaScene(cv, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      setFailed(true);
      return;
    }
    scene.setMarks({
      checkpoints: new Set(cfg.checkpoints),
      finish: cfg.length,
      milestones: cfg.mode === 'infinito',
    });
    scene.setHeroColor(colorOf(meId));
    scene.setRemotes(first.members.filter((m) => m.id !== meId).map((m) => ({ id: m.id, color: colorOf(m.id) })));

    const world = new AtravessaWorld(seed);
    const sim = new AtravessaSim(seed, world, atravessaRoomRules(cfg.mode, cfg.size, slotOf(meId)));
    const audio = createAtravessaAudio();
    const worldTick = () => Math.floor(((serverNow() - startAt) * ATR_TPS) / 1000);
    // quem recarrega a página no meio da rodada não tem como retomar o herói: só assiste
    const late = worldTick() > 120;

    // ---- o que chega do servidor ----
    const samples = new Map<string, Sample[]>();
    const idOfSlot = new Map<number, string>(Object.entries(cfg.slots).map(([id, slot]) => [slot, id]));
    const unsubPos = subscribeRoom('pos', (m) => {
      if (!Array.isArray(m)) return;
      for (const row of m as number[][]) {
        const id = idOfSlot.get(row[0]!);
        if (!id || id === meId) continue;
        const list = samples.get(id) ?? [];
        list.push({
          tick: row[1]!,
          x: row[2]!,
          y: row[3]!,
          hop: row[4]!,
          facing: row[5]!,
          flags: row[6]!,
          best: row[7]!,
          deaths: row[8]!,
          checkpoint: row[9]!,
          finishTick: row[10]!,
          row: row[11] ?? row[7]!,
        });
        // só as últimas amostras ficam: bastam para a interpolação
        if (list.length > 12) list.shift();
        samples.set(id, list);
      }
    });
    let acked = 0;
    const unsubAck = subscribeRoom('ack', (m) => {
      const n = (m as { n?: unknown } | null)?.n;
      if (typeof n === 'number' && n > acked) acked = n;
    });

    // ---- os passos ----
    const steps: AtravessaInput[] = [];
    const pending: Dir[] = [];
    const controls = attachControls(el, (d) => {
      if (late || sim.halted || worldTick() < 0) return;
      pending.push(d);
      setHint(false);
    });
    let lastSent = -1;
    const sender = window.setInterval(() => {
      if (late || (sim.tick === 0 && steps.length === 0)) return;
      if (sim.tick === lastSent && acked >= steps.length) return;
      lastSent = sim.tick;
      sendRoomQuiet('run', { t: sim.tick, i: steps.slice(acked, acked + 64), n: acked });
    }, 100);

    const resize = () => scene.resize(el.clientWidth || 360, el.clientHeight || 640);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // ---- quem assistir ----
    let watch: string | null = null;
    let candidates: string[] = [];
    const cycle = (dir: 1 | -1) => {
      if (candidates.length === 0) return;
      const i = watch ? candidates.indexOf(watch) : -1;
      watch = candidates[(i + dir + candidates.length * 2) % candidates.length]!;
    };
    ctl.current = { cycle };

    let raf = 0;
    let last = performance.now();
    let deathWall = 0;
    let hopTick = -1;
    let landTick = -1;
    let bumps = 0;
    let frameN = 0;
    let warning = false;
    let lastUi = '';
    let lastCheckpoint = 0;
    let pulseN = 0;

    const refreshUi = () => {
      const snap = snapRef.current;
      const wt = worldTick();
      // a linha de agora (e não a maior): quem morre e volta ao checkpoint desce no ranking
      const myRow = Math.max(0, Math.min(Math.floor(sim.y), sim.row + 1));
      // o próximo ponto de parada: o próximo checkpoint que ainda não passou, ou a chegada
      const nextStop = cfg.checkpoints.find((c) => c > sim.checkpointRow) ?? cfg.length ?? 0;
      const rows: RankRow[] = snap.members.map((m) => {
        if (m.id === meId) {
          return { id: m.id, name: nameOf(m.id), color: colorOf(m.id), meters: myRow, finished: sim.finished, alive: sim.alive, me: true };
        }
        const s = samples.get(m.id)?.at(-1);
        return {
          id: m.id,
          name: nameOf(m.id),
          color: colorOf(m.id),
          meters: s?.row ?? 0,
          finished: !!(s && s.flags & F_FINISHED),
          alive: !!(s && s.flags & F_ALIVE),
          me: false,
        };
      });
      rows.sort((a, b) => Number(b.finished) - Number(a.finished) || b.meters - a.meters);
      let over: Ui['over'] = null;
      if (late) over = { kind: 'late' };
      else if (sim.finished) over = { kind: 'finished', ms: Math.round((sim.finishTick * 1000) / ATR_TPS) };
      else if (!sim.alive && cfg.mode === 'checkpoint') over = { kind: 'respawn', end: sim.end! };
      else if (!sim.alive) over = { kind: 'dead', end: sim.end! };
      const spectating = over?.kind === 'late' || over?.kind === 'finished' || over?.kind === 'dead';
      const watched = spectating && watch ? rows.find((r) => r.id === watch) : undefined;
      const clockMs = sim.finished ? (sim.finishTick * 1000) / ATR_TPS : Math.max(0, serverNow() - startAt);
      const next: Ui = {
        count: wt < 0 ? Math.ceil(-wt / ATR_TPS) : wt < 45 ? 'go' : null,
        meters: myRow,
        toNext: cfg.mode === 'checkpoint' && !sim.finished ? Math.max(0, nextStop - myRow) : null,
        nextFinish: nextStop === cfg.length,
        clock: raceTime(clockMs),
        rank: rows,
        watching: watched ? { id: watched.id, name: watched.name, color: watched.color } : null,
        spectators: candidates.length,
        over,
        checkpoint: sim.checkpointRow,
      };
      const key = JSON.stringify(next);
      if (key !== lastUi) {
        lastUi = key;
        setUi(next);
      }
    };
    const uiTimer = window.setInterval(refreshUi, 120);
    refreshUi();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const wt = worldTick();

      // o herói anda até o relógio do mundo (a largada tem hora marcada para todos)
      let n = 0;
      if (!late) {
        while (sim.tick < wt && !sim.halted && n < 1200) {
          if (pending.length) {
            for (const d of pending) {
              if (!sim.alive) break;
              steps.push({ t: sim.tick + 1, d });
              sim.input(d);
            }
            pending.length = 0;
          }
          sim.step();
          n++;
        }
      }

      const v = sim.view();
      // sons: o mesmo conjunto do solo, sem a escuridão (aqui não existe)
      if (v.step) {
        const started = sim.tick - Math.round(v.step.progress * 10);
        if (started !== hopTick) {
          hopTick = started;
          audio?.hop(v.step.dir === 0);
        }
      }
      if (v.landed) {
        const landedAt = sim.tick - v.landed.age;
        if (landedAt !== landTick) {
          landTick = landedAt;
          if (sim.alive) audio?.land(world.lane(sim.row).kind);
        }
      }
      if (v.bumps !== bumps) {
        bumps = v.bumps;
        audio?.bump();
      }
      audio?.setBiome(laneBiome(world.biomeAt(v.y)));
      if (frameN++ % 4 === 0) {
        warning = false;
        for (let r = Math.max(0, Math.floor(v.y) - 6); r <= Math.floor(v.y) + 8 && !warning; r++) {
          const lane = world.lane(r);
          if (lane.kind === 'trilho') warning = trainState(lane, sim.tick).warning;
        }
      }
      audio?.frame(0, warning, 0);

      // passou por um checkpoint (só na primeira vez de cada um): confete, anel, brilho na tela, som e vibração
      if (v.checkpoint > lastCheckpoint) {
        lastCheckpoint = v.checkpoint;
        setPulse(++pulseN);
        scene.celebrate(v.x, v.y);
        audio?.checkpoint();
        buzz(60);
      }

      // morte: o som, o tremor e o corpo; no Checkpoint a morte passa e o herói volta
      if (!sim.alive && !sim.finished) {
        if (deathWall === 0) {
          deathWall = now;
          buzz(90);
          audio?.death(sim.end!);
        }
      } else {
        deathWall = 0;
      }

      // as outras raposas, atrasadas um pouquinho no relógio para a interpolação ter amostras dos dois lados
      const gt = wt - GHOST_DELAY;
      candidates = [];
      const cur = new Map<string, { x: number; y: number }>();
      for (const m of snapRef.current.members) {
        if (m.id === meId) continue;
        const s = wt < 0 ? null : sampleAt(samples.get(m.id), gt);
        if (s) {
          cur.set(m.id, { x: s.x, y: s.y });
          if (s.alive && !(s.flags & F_STALLED)) candidates.push(m.id);
          scene.placeRemote(m.id, world, { x: s.x, y: s.y, hop: s.hop, facing: s.facing, hide: !s.alive }, dt);
        } else {
          // ainda não largou: parada na coluna de largada
          scene.placeRemote(m.id, world, { x: atravessaStartCol(slotOf(m.id)), y: 0, hop: 0, facing: 0, hide: false }, dt);
          cur.set(m.id, { x: atravessaStartCol(slotOf(m.id)), y: 0 });
        }
      }

      // quem assiste: o Infinito depois de morrer, quem chegou ao fim e quem entrou com a rodada rolando
      const dying = !sim.alive && !sim.finished && cfg.mode === 'infinito';
      const spectating = late || sim.finished || (dying && deathWall > 0 && now - deathWall > SPECTATE_AFTER_MS);
      if (spectating && candidates.length > 0 && (!watch || !candidates.includes(watch))) watch = candidates[0]!;
      const target = spectating && watch ? cur.get(watch) : undefined;

      const tick = Math.max(0, sim.halted ? wt : sim.tick);
      scene.render(
        sim,
        dt,
        now / 1000,
        !sim.alive && !sim.finished && deathWall > 0 ? { end: sim.end!, age: (now - deathWall) / 1000 } : null,
        { follow: target ?? null, hideHero: late || (spectating && !!target && !sim.finished), tick },
      );

      // os nomes em cima das raposas
      for (const m of snapRef.current.members) {
        const tag = tags.current.get(m.id);
        if (!tag) continue;
        let pos: { x: number; y: number; visible: boolean } | null = null;
        if (m.id === meId) {
          pos = late || (spectating && !!target && !sim.finished) ? null : scene.screenOf(null, v.x, v.y, 0.3 + v.hop);
          if (!sim.alive && !sim.finished) pos = null;
        } else {
          const c = cur.get(m.id);
          const s = wt < 0 ? null : sampleAt(samples.get(m.id), gt);
          if (c && (!s || s.alive)) pos = scene.screenOf(m.id, c.x, c.y);
        }
        if (pos && pos.visible) {
          tag.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px) translate(-50%, -100%)`;
          tag.style.opacity = '1';
        } else {
          tag.style.opacity = '0';
        }
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(sender);
      window.clearInterval(uiTimer);
      unsubPos();
      unsubAck();
      ro.disconnect();
      controls.dispose();
      ctl.current = null;
      scene.dispose();
      audio?.stop();
    };
    // a rodada inteira roda numa montagem só: o resto chega por `snapRef`
  }, [seed]);

  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const isHost = snapshot.hostId === meId;
  const checkpointMode = info.mode === 'checkpoint';
  const members = snapshot.members;

  return (
    <div className="at-play" ref={wrap} role="application" aria-label="Partida do Atravessa! em sala">
      <canvas ref={canvas} className="at-canvas" />

      {/* nomes em cima das raposas */}
      <div className="atr-tags" aria-hidden="true">
        {members.map((m) => (
          <div
            key={m.id}
            className={`atr-tag${m.id === meId ? ' me' : ''}`}
            style={{ ['--tag' as string]: info.colors[m.id] ?? '#ff6a2b', opacity: 0 }}
            ref={(node) => {
              if (node) tags.current.set(m.id, node);
              else tags.current.delete(m.id);
            }}
          >
            <i />
            {at(m.username)}
          </div>
        ))}
      </div>

      <div className="at-score atr-score" aria-live="off">
        <b>{ui.meters}</b>
        <small className="mono">METROS</small>
      </div>

      {checkpointMode && (
        <div className="atr-clock mono" aria-label="Tempo de corrida">
          {ui.clock}
          {info.length && (
            <small>
              {ui.meters}/{info.length} m
              {ui.checkpoint > 0 ? ` · CHECKPOINT ${ui.checkpoint}` : ''}
            </small>
          )}
        </div>
      )}

      {checkpointMode && ui.toNext !== null && (
        <div className="atr-next" aria-label="Metros até o próximo checkpoint">
          <span className="mono">{ui.nextFinish ? 'ATÉ A CHEGADA' : 'ATÉ O CHECKPOINT'}</span>
          <b>{ui.toNext} m</b>
        </div>
      )}

      <ol className="atr-rank" aria-label="Ranking ao vivo">
        {ui.rank.slice(0, 8).map((r, i) => (
          <li key={r.id} className={`${r.me ? 'me ' : ''}${!r.alive && !r.finished ? 'out' : ''}`}>
            <span className="mono pos">{i + 1}</span>
            <i style={{ background: r.color }} />
            <span className="name">{r.name}</span>
            <span className="mono val">{r.finished ? 'CHEGOU' : meters(r.meters)}</span>
          </li>
        ))}
      </ol>

      {isHost && (
        <button
          type="button"
          className={`atr-end mono${confirmEnd ? ' sure' : ''}`}
          data-sfx="select"
          onClick={() => {
            if (!confirmEnd) return setConfirmEnd(true);
            setConfirmEnd(false);
            sendRoom('endround');
          }}
        >
          {confirmEnd ? 'TOQUE DE NOVO PARA ENCERRAR' : checkpointMode ? 'ENCERRAR CORRIDA' : 'ENCERRAR RODADA'}
        </button>
      )}

      {ui.count !== null && (
        <div className="atr-count" aria-live="assertive" key={String(ui.count)}>
          {ui.count === 'go' ? 'VAI!' : ui.count}
        </div>
      )}

      {hint && ui.count === null && !ui.over && !failed && (
        <p className="at-hint mono">{touch ? 'TOQUE PARA PULAR · DESLIZE PARA O LADO' : 'W A S D OU AS SETAS'}</p>
      )}

      {pulse > 0 && <div className="atr-flash" key={pulse} aria-hidden="true" />}

      {ui.over?.kind === 'dead' && (
        <div className="at-over atr-over" role="status">
          <b>VOCÊ MORREU</b>
          <span className="mono">{OVER_TEXT[ui.over.end!]}</span>
        </div>
      )}
      {ui.over?.kind === 'respawn' && (
        <div className="at-over atr-over" role="status">
          <b>{OVER_TEXT[ui.over.end!]}</b>
          <span className="mono">VOLTANDO AO {ui.checkpoint > 0 ? `CHECKPOINT ${ui.checkpoint}` : 'INÍCIO'}</span>
        </div>
      )}
      {ui.over?.kind === 'finished' && (
        <div className="at-over atr-over win" role="status">
          <b>CHEGOU!</b>
          <span className="mono">{raceTime(ui.over.ms ?? 0)}</span>
        </div>
      )}
      {ui.over?.kind === 'late' && (
        <div className="at-over atr-over" role="status">
          <b>RODADA EM ANDAMENTO</b>
          <span className="mono">VOCÊ ENTRA NA PRÓXIMA</span>
        </div>
      )}

      {(ui.over?.kind === 'dead' || ui.over?.kind === 'finished' || ui.over?.kind === 'late') && (
        <div className="atr-watch" role="group" aria-label="Assistir">
          <button
            type="button"
            className="atr-arrow"
            aria-label="Anterior"
            data-sfx="select"
            disabled={ui.spectators < 2}
            onClick={() => ctl.current?.cycle(-1)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5 8 12l7 7" />
            </svg>
          </button>
          <div className="atr-watching">
            <span className="mono">{ui.watching ? 'ASSISTINDO' : 'ESPERANDO'}</span>
            <b>
              {ui.watching ? (
                <>
                  <i style={{ background: ui.watching.color }} />
                  {ui.watching.name}
                </>
              ) : (
                'ninguém em jogo'
              )}
            </b>
          </div>
          <button
            type="button"
            className="atr-arrow"
            aria-label="Próximo"
            data-sfx="select"
            disabled={ui.spectators < 2}
            onClick={() => ctl.current?.cycle(1)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {failed && (
        <div className="at-over" role="alert">
          <b>SEU APARELHO NÃO ABRIU O 3D</b>
        </div>
      )}
    </div>
  );
}
