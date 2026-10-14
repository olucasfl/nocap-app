import { useEffect, useMemo, useRef, useState } from 'react';
import type { SinalEnd, SinalEvent, SinalView } from '@nocap/games';
import { useAuth } from '@/lib/auth';
import { buzz, holdAudio } from '@/lib/sfx';
import { createSinalAudio } from '@/lib/sinal-audio';
import { leaveRoom, sendRoomQuiet, toLocal, type RoomSnapshot } from '@/lib/rooms';
import { attachControls } from './controls';
import { clamp, type Ctx } from './draw-art';
import { drawScene, type Notice } from './draw-scene';
import { makeLayout, type Layout } from './camera';
import './sinal.css';

/** Para onde o desenho de quem corre "anda" até o ponto novo (15 quadros por segundo vindos do servidor). */
const EASE = 18;
/** Quanto tempo cada queda fica no placar de mortes. */
const FEED_MS = 7000;

const ease = (cur: number, target: number, dt: number) =>
  Math.abs(target - cur) > 6 ? target : cur + (target - cur) * Math.min(1, dt * EASE);

/**
 * A corrida do Sinal Vermelho em sala: todo mundo no mesmo mapa. O servidor manda o estado (15 vezes
 * por segundo) e recebe só o analógico; aqui só se desenha, com o movimento suavizado, e se mostra
 * o botão de empurrar quando há alguém ao alcance.
 */
export function SinalRoomPlay({ snapshot }: { snapshot: RoomSnapshot }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  const me = useAuth((s) => s.user?.id);
  const meRef = useRef(me);
  meRef.current = me;
  const [now, setNow] = useState(() => Date.now());
  const [finishedAt, setFinishedAt] = useState(0);
  const [pushUi, setPushUi] = useState<{ show: boolean; leftMs: number }>({ show: false, leftMs: 0 });
  const pushRef = useRef<() => void>(() => undefined);

  const sinal = snapshot.sinal;
  const names = useMemo(
    () => Object.fromEntries(snapshot.members.map((m) => [m.id, m.username])),
    [snapshot.members],
  );

  // quando eu cruzo a linha, o aviso "CHEGOU!" aparece um instante
  const iFinished = !!snapshot.sinal?.mine?.finished;
  useEffect(() => {
    setFinishedAt(iFinished ? Date.now() : 0);
  }, [iFinished]);

  // o relógio da tela: contagem e tempo de espera do botão de empurrar
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = wrap.current!;
    const cv = canvas.current!;
    const c = cv.getContext('2d')!;
    const audio = createSinalAudio();
    let audioMap = '';
    let layout: Layout = makeLayout(360, 640, false);
    const controls = attachControls(el, () => layout);
    let layoutTouch = controls.touch();

    const resize = () => {
      const w = el.clientWidth || 360;
      const h = el.clientHeight || 640;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      layoutTouch = controls.touch();
      layout = makeLayout(w, h, layoutTouch);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // posições desenhadas (suavizadas) de cada um
    const shown = new Map<string, { x: number; y: number }>();
    let shownDark = 0;
    let lastTarget: string | null = null;
    let lastSeq = 0;
    let lastIn: [number, number] = [0, 0];
    let face = 0;
    let warn = 0;
    let avisoSince = 0;
    let prevVigia = '';
    let prevX = 0;
    let prevY = 0;
    let walking = false;
    let jolt = 0;
    let prevHidden = false;
    let pushLabel = '';
    let death: { reason: SinalEnd; at: number } | null = null;
    let pushFx: { at: number; dx: number; dy: number } | null = null;
    let prevDead = false;
    let raf = 0;
    let last = performance.now();

    pushRef.current = () => {
      const s = snapRef.current.sinal;
      if (s?.push?.target) sendRoomQuiet('push');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.key.toLowerCase() === 'e') {
        e.preventDefault();
        pushRef.current();
      }
    };
    window.addEventListener('keydown', onKey);

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (controls.touch() !== layoutTouch) resize();
      const snap = snapRef.current;
      const s = snap.sinal;
      const view = s?.view as SinalView | null | undefined;
      if (!s || !view) return;
      const myId = meRef.current;
      const alive = s.players?.find((p) => p.id === myId && !p.dead && !p.finished);

      // o analógico: só manda quando muda, e só quem ainda corre
      if (alive && snap.phase === 'play') {
        const [vx, vy] = controls.vector();
        const m = Math.hypot(vx, vy);
        const k = m > 1 ? 1 / m : 1;
        const ax = Math.round(clamp(vx * k * 100, -100, 100));
        const ay = Math.round(clamp(vy * k * 100, -100, 100));
        if (ax !== lastIn[0] || ay !== lastIn[1]) {
          lastIn = [ax, ay];
          sendRoomQuiet('move', { x: ax, y: ay });
        }
      }

      // a animação de perder é de quem perde: dura um instante e some, e a tela passa a mostrar outro mapa
      if (s.mine?.dead && !prevDead && s.mine.reason) death = { reason: s.mine.reason, at: t };
      prevDead = !!s.mine?.dead;
      if (death && t - death.at > 1500) death = null;

      // eventos novos do mapa que está na tela (som e tranco), sem repetir os velhos
      const target = s.target ?? null;
      const events = (s.events ?? []) as (SinalEvent & { n: number })[];
      if (target !== lastTarget) {
        lastTarget = target;
        lastSeq = events.length ? events[events.length - 1]!.n : 0;
        shown.clear();
      }
      for (const e of events) {
        if (e.n <= lastSeq) continue;
        lastSeq = e.n;
        audio?.event(e);
        if (e.kind === 'choque') {
          jolt = Math.max(jolt, e.size);
          buzz(Math.round(15 + 35 * e.size));
        } else if (e.kind === 'empurrou') {
          buzz(25);
          // a direção do empurrão na tela: de você para quem estava ao alcance
          const me = s.players?.find((p) => p.id === target);
          const to = s.players?.find((p) => p.id === s.push?.target);
          let dx = 0;
          let dy = -1;
          if (me && to) {
            const len = Math.hypot(to.x - me.x, to.y - me.y) || 1;
            dx = (to.x - me.x) / len;
            dy = -(to.y - me.y) / len;
          }
          pushFx = { at: t, dx, dy };
        } else if (e.kind === 'fim') {
          buzz(120);
        } else if (e.kind === 'chegou') {
          buzz(60);
        }
      }
      jolt = Math.max(0, jolt - dt * 3.2);

      // suaviza o boneco que a tela segue, e a escuridão
      const mine = shown.get('__target') ?? { x: view.x, y: view.y };
      mine.x = ease(mine.x, view.x, dt);
      mine.y = ease(mine.y, view.y, dt);
      shown.set('__target', mine);
      shownDark = shownDark === 0 || Math.abs(view.darkY - shownDark) > 6 ? view.darkY : ease(shownDark, view.darkY, dt);
      const drawn: SinalView = { ...view, x: mine.x, y: mine.y, darkY: shownDark };

      const others = (s.players ?? [])
        .filter((p) => p.id !== target && !p.dead && !p.finished)
        .map((p) => {
          const cur = shown.get(p.id) ?? { x: p.x, y: p.y };
          cur.x = ease(cur.x, p.x, dt);
          cur.y = ease(cur.y, p.y, dt);
          shown.set(p.id, cur);
          return {
            id: p.id,
            x: cur.x,
            y: cur.y,
            hidden: p.hidden,
            stunned: p.stunned,
            color: s.colors[p.id] ?? '#f4f4ef',
            name: names[p.id] ?? '?',
          };
        });
      // quem estava aqui e saiu da lista não deixa rastro
      for (const k of [...shown.keys()]) {
        if (k !== '__target' && !others.some((o) => o.id === k)) shown.delete(k);
      }

      walking = Math.hypot(mine.x - prevX, mine.y - prevY) > 0.01;
      prevX = mine.x;
      prevY = mine.y;
      face += clamp((view.vigia === 'olhando' ? 1 : 0) - face, -dt * 6, dt * 6);
      if (view.vigia === 'aviso' && prevVigia !== 'aviso') avisoSince = t;
      prevVigia = view.vigia;
      const targetWarn = view.vigia === 'aviso' ? clamp((t - avisoSince) / 700, 0.15, 1) : 0;
      warn += (targetWarn - warn) * Math.min(1, dt * 10);
      if (view.hidden && !prevHidden) audio?.rustle();
      prevHidden = view.hidden;
      if (view.course.map !== audioMap) {
        audioMap = view.course.map;
        audio?.setMap(view.course.map);
      }
      audio?.darkness(view.y - view.darkY);
      audio?.moving(walking && !view.hidden);

      const notices: Notice[] = [];
      // o botão de empurrar: aparece só com alguém ao alcance
      const push = s.push;
      const label = push?.target && alive ? (Date.now() >= toLocal(push.readyAt) ? 'ok' : 'wait') : '';
      if (label !== pushLabel) {
        pushLabel = label;
        setPushUi({
          show: !!label,
          leftMs: label === 'wait' && push ? Math.max(0, toLocal(push.readyAt) - Date.now()) : 0,
        });
      }

      drawScene(c as Ctx, {
        layout,
        view: drawn,
        color: s.colors[target ?? ''] ?? undefined,
        t: t / 1000,
        face,
        warn,
        walking,
        joy: { show: controls.touch(), ...controls.joy() },
        keysHint: false,
        best: null,
        notices,
        jolt,
        others,
        pushTarget: alive && push?.target ? push.target : null,
        death: death ? { reason: death.reason, age: clamp((t - death.at) / 1300, 0, 1) } : null,
        pushFx: pushFx && t - pushFx.at < 550 ? { age: (t - pushFx.at) / 550, dx: pushFx.dx, dy: pushFx.dy } : null,
      });
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      holdAudio(false);
      ro.disconnect();
      controls.dispose();
      audio?.stop();
    };
  }, []);

  const mineP = sinal?.players?.find((p) => p.id === me);
  // quem caiu ou chegou assiste a quem ainda corre e pode trocar de pessoa
  const amOut = !!mineP && (mineP.dead || !!mineP.finished);
  const alivePlayers = (sinal?.players ?? []).filter((p) => !p.dead && !p.finished);
  // Placar: os 3 primeiros e, se você está do 4º para trás, a sua posição logo depois (ex.: 1º, 2º, 3º ... 7º)
  // (quem já chegou fica na frente, na ordem em que chegou)
  const ranked = [...(sinal?.players ?? [])].sort((a, b) => {
    if (!!a.finished !== !!b.finished) return a.finished ? -1 : 1;
    if (a.finished && b.finished) return (a.place ?? 99) - (b.place ?? 99);
    return b.meters - a.meters;
  });
  const myIdx = ranked.findIndex((p) => p.id === me);
  const board = ranked.slice(0, 3).map((p, i) => ({ p, rank: i + 1, gap: false }));
  if (myIdx >= 3) board.push({ p: ranked[myIdx]!, rank: myIdx + 1, gap: myIdx > 3 });
  const countdown =
    snapshot.phase === 'show' && sinal?.endsAt
      ? Math.max(0, Math.ceil((toLocal(sinal.endsAt) - now) / 1000))
      : 0;
  // o aviso de chegada: some sozinho depois de uns 2,5 s
  const finishedBanner = !!sinal?.mine?.finished && finishedAt > 0 && now - finishedAt < 2500;
  const waitLeft =
    pushUi.show && sinal?.push ? Math.max(0, toLocal(sinal.push.readyAt) - now) : 0;

  const watchNext = (dir: 1 | -1) => {
    if (alivePlayers.length === 0) return;
    const i = alivePlayers.findIndex((p) => p.id === sinal?.target);
    const next = alivePlayers[(i + dir + alivePlayers.length) % alivePlayers.length]!;
    sendRoomQuiet('watch', { id: next.id });
  };

  return (
    <div className="sv-play" ref={wrap} role="application" aria-label="Corrida do Sinal Vermelho">
      <canvas ref={canvas} className="sv-canvas" />

      <ol className="svr-board mono" aria-label="Quem está na frente">
        {board.map(({ p, rank, gap }) => (
          <li key={p.id} className={`${p.dead ? 'dead' : ''}${p.id === me ? ' me' : ''}${gap ? ' gap' : ''}`}>
            <em>{rank}º</em>
            <i style={{ background: sinal?.colors[p.id] }} />
            <span>@{names[p.id]}</span>
            <b>{p.finished ? 'CHEGOU' : `${p.meters} m`}</b>
          </li>
        ))}
      </ol>

      <ul className="svr-feed mono" aria-label="Quem caiu" aria-live="polite">
        {(sinal?.feed ?? [])
          .filter((f) => now - toLocal(f.at) < FEED_MS)
          .slice(-3)
          .map((f) => (
            <li key={f.n} className={f.id === me ? 'me' : ''}>
              <i style={{ background: sinal?.colors[f.id] }} />
              <span>
                <b>@{names[f.id] ?? '?'}</b>{' '}
                {f.kind === 'chegada'
                  ? `chegou na linha de chegada em ${f.place}º lugar`
                  : (f.by ? `foi empurrado por @${names[f.by] ?? '?'} e ` : '') +
                    (f.reason === 'vigia'
                      ? f.by
                        ? 'o Vigia viu'
                        : 'foi visto pelo Vigia'
                      : f.by
                        ? 'a escuridão pegou'
                        : 'foi engolido pela escuridão')}
                {' · '}
                {f.meters} m
              </span>
            </li>
          ))}
      </ul>

      <button
        type="button"
        className="svr-leave mono"
        onClick={() => {
          if (window.confirm('Sair da sala? Você perde a corrida.')) void leaveRoom();
        }}
      >
        SAIR
      </button>

      {countdown > 0 && (
        <div className="sv-banner" aria-live="assertive">
          <b>{countdown}</b>
          <span>PREPARE-SE · OLHE O VIGIA LÁ EM CIMA</span>
        </div>
      )}
      {countdown === 0 && snapshot.phase === 'show' && (
        <div className="sv-banner" aria-live="assertive">
          <b>VAI!</b>
        </div>
      )}

      {finishedBanner && (
        <div className="sv-banner" aria-live="assertive">
          <b>CHEGOU!</b>
          <span>{sinal?.mine?.place}º LUGAR</span>
        </div>
      )}

      {amOut && snapshot.phase === 'play' && (
        <div className="svr-spec">
          <span className="mono">
            {sinal?.finishing ? 'FASE ENCERRADA' : mineP?.finished ? 'VOCÊ CHEGOU' : 'VOCÊ CAIU'} · ASSISTINDO @
            {names[sinal?.target ?? ''] ?? '...'}
          </span>
          {alivePlayers.length > 1 && (
            <span className="svr-spec-btns">
              <button type="button" onClick={() => watchNext(-1)} aria-label="Assistir o anterior">
                ‹
              </button>
              <button type="button" onClick={() => watchNext(1)} aria-label="Assistir o próximo">
                ›
              </button>
            </span>
          )}
        </div>
      )}

      {pushUi.show && (
        <button
          type="button"
          className={`svr-push${waitLeft > 0 ? ' wait' : ''}`}
          data-sfx="select"
          disabled={waitLeft > 0}
          onClick={() => pushRef.current()}
          aria-label="Empurrar"
        >
          <b>EMPURRAR</b>
          <small className="mono">{waitLeft > 0 ? `${(waitLeft / 1000).toFixed(1)} s` : 'ESPAÇO'}</small>
        </button>
      )}
    </div>
  );
}
