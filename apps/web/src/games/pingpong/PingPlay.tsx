import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PP_BOT_LEVELS,
  PP_TICK,
  PpBot,
  PpMatch,
  PpNetSim,
  createRng,
  ppIdleInput,
  PP_PAD_X,
  PP_PAD_Z,
  PP_REACH_NET,
  PP_REACH_BACK,
  ppPadStepZ,
  ppParseNetEvent,
  ppPredictCross,
  type PpBotName,
  type PpEvent,
  type PpInput,
  type PpTimedEvent,
} from '@nocap/games';
import { GameChat } from '@/components/GameChat';
import { GameMenu, GearButton, Keycap } from '@/components/GameMenu';
import { GameTips, type TipRow } from '@/components/GameTips';
import { RotateHint } from '@/components/RotateHint';
import { pingSfx } from '@/lib/ping-audio';
import { sendRoomQuiet, serverNow, subscribeRoom } from '@/lib/rooms';
import { PingFinal, type PingStats } from './PingFinal';
import { PingScene } from './PingScene';
import './ping.css';

const TIPS_KEY = 'nocap-ping-tips';

/** O nome do golpe que aparece junto da velocidade (o golpe comum não aparece). */
const STROKE_TAG: Record<string, string | undefined> = {
  drive: 'DRIVE',
  topspin: 'TOPSPIN',
  corte: 'CORTE',
  curva: 'CURVA',
  curta: 'CURTINHA',
  bloqueio: 'BLOQUEIO',
  lob: 'LOB',
  smash: 'SMASH',
};

const tipRows = (touch: boolean): TipRow[] =>
  touch
    ? [
        {
          keys: <b className="gm-tag">Arraste</b>,
          text: 'Para os lados move a raquete; para a frente ela avança até a rede (parou, ela recolhe)',
        },
        {
          keys: <b className="gm-tag">Impulso</b>,
          text: 'A força da batida é a rapidez com que você joga a raquete para a frente; a direção é para onde você bate',
        },
        {
          keys: <b className="gm-tag">Golpes</b>,
          text: 'Devagar = corte; médio = topspin; muito rápido = drive; varrer para o lado = curva; bater perto da rede = curtinha; bola alta + forte = smash',
        },
        {
          keys: <b className="gm-tag">Defesa</b>,
          text: 'Contra uma bola forte, deixe a raquete mansa: bloqueio. Recuada (para trás) a bola sobe em lob',
        },
        {
          keys: <b className="gm-tag">Saque</b>,
          text: 'A bola fica parada na sua frente: jogue a raquete para a frente e bata nela',
        },
      ]
    : [
        {
          keys: <b className="gm-tag">Mouse</b>,
          text: 'A raquete vai até onde o mouse aponta na mesa (até a rede)',
        },
        {
          keys: <b className="gm-tag">Impulso</b>,
          text: 'A força da batida é a rapidez com que você leva o mouse para a frente; a direção é para onde você bate',
        },
        {
          keys: <b className="gm-tag">Golpes</b>,
          text: 'Devagar = corte; médio = topspin; muito rápido = drive; varrer para o lado = curva; bater perto da rede = curtinha; bola alta + forte = smash',
        },
        {
          keys: <b className="gm-tag">Defesa</b>,
          text: 'Contra uma bola forte, deixe a raquete mansa: bloqueio. Recuada (para trás) a bola sobe em lob',
        },
        {
          keys: <b className="gm-tag">Saque</b>,
          text: 'A bola fica parada na sua frente: jogue a raquete para a frente e bata nela',
        },
        { keys: <Keycap k="Esc" touchHide={false} />, text: 'Menu' },
      ];

interface Hud {
  phase: 'ready' | 'play' | 'over';
  count: number;
  score: [number, number];
  server: number;
  rally: number;
  matchPhase: string;
  banner: { text: string; sub?: string; id: number; tone: 'win' | 'lose' | 'info' } | null;
  speed: { kmh: number; id: number; mine: boolean; tag?: string } | null;
}

const BOT_NAMES: Record<PpBotName, string> = {
  facil: 'Raposa Fácil',
  medio: 'Raposa Média',
  dificil: 'Raposa Difícil',
};
const BOT_COLORS: Record<PpBotName, number> = {
  facil: 0x6fd3a0,
  medio: 0xff9bd0,
  dificil: 0x9a6bff,
};

/** A partida em sala: quem joga (0 ou 1; -1 assiste), quem saca primeiro e a hora da largada no relógio da sala. */
export interface PingOnline {
  me: number;
  firstServer: number;
  startAt: number;
  names: [string, string];
  colors: [number, number];
}

/** Quantos ticks (200 ms) um ponto espera antes de aparecer: uma batida atrasada ainda pode desfazê-lo. */
const POINT_GRACE = 12;

/**
 * Uma partida do Ping Fox!: contra um bot (treino, `level`) ou em sala (`online`). Roda o motor num passo fixo de 60 Hz
 * e desenha com interpolação. Na sala a partida é a mesma `PpNetSim` da sala: só as batidas e os saques viajam.
 */
export function PingPlay({
  level = 'medio',
  online,
  onExit,
  onAgain,
  onOfflineInvite,
}: {
  level?: PpBotName;
  online?: PingOnline;
  onExit: () => void;
  onAgain?: () => void;
  onOfflineInvite?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<Hud>({
    phase: 'ready',
    count: 3,
    score: [0, 0],
    server: 0,
    rally: 0,
    matchPhase: 'serve',
    banner: null,
    speed: null,
  });
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(false);
  menuRef.current = menu;
  const [result, setResult] = useState<{
    winner: number;
    score: [number, number];
    stats: PingStats;
  } | null>(null);
  const touchDevice = useMemo(
    () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    [],
  );
  const closeMenu = () => setMenu(false);

  useEffect(() => {
    const cv = canvas.current;
    const zn = zone.current;
    if (!cv || !zn) return undefined;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seed = crypto.randomUUID();
    const rng = createRng(seed);
    // treino: a partida e o bot ficam aqui; sala: a `PpNetSim` é a mesma da sala e só as batidas viajam
    const net = online ? new PpNetSim(online.firstServer, online.me) : null;
    const match = net ? net.match : new PpMatch(rng() < 0.5 ? 0 : 1);
    const bot = net ? null : new PpBot(PP_BOT_LEVELS[level], rng);
    /** Quem sou eu na partida (quem assiste vê a mesa como o jogador 0). */
    const myIdx = online ? Math.max(0, online.me) : 0;
    const oppIdx = 1 - myIdx;
    const spectator = !!online && online.me < 0;
    const oppName = online ? (online.names[oppIdx] ?? 'Adversário') : BOT_NAMES[level];
    const scene = new PingScene(cv, match, {
      oppColor: online ? (online.colors[oppIdx] ?? 0x9a6bff) : BOT_COLORS[level],
      oppName,
      reduced,
      me: myIdx,
    });

    const me: PpInput = { ...ppIdleInput(), manual: false };
    // controle: x pela mão; z (alcance, de volta até a rede) pelo movimento "para a frente" da mão
    let zt = 0;
    let pointerDown = false;
    const clampZ = (v: number) => Math.max(-PP_REACH_BACK, Math.min(PP_REACH_NET, v));
    const keys = { l: false, r: false, u: false, d: false };
    let ready = 3;
    const readyAt = performance.now();
    let phase: Hud['phase'] = 'ready';
    let acc = 0;
    let slow = 1;
    let slowUntil = 0;
    let bannerId = 0;
    let speedId = 0;
    const stats: PingStats = {
      seconds: 0,
      longest: 0,
      fastest: 0,
      smashes: 0,
      points: [0, 0],
      hits: [0, 0],
    };
    let finished = false;

    // ---- entrada: a raquete fica sempre embaixo do dedo (ou do mouse): o ponto tocado, projetado na altura da raquete,
    // é para onde ela vai (x para os lados, z para a frente/trás). A força da batida é o impulso do avanço; a direção,
    // para onde a mão vai ----
    const aim = (e: PointerEvent) => {
      const r = zn.getBoundingClientRect();
      const p = scene.pointerToTable(
        (e.clientX - r.left) / r.width,
        (e.clientY - r.top) / r.height,
        match.pad(myIdx).y,
      );
      me.x = Math.max(-PP_PAD_X, Math.min(PP_PAD_X, scene.simX(p.x)));
      zt = clampZ(PP_PAD_Z - p.z);
      pointerDown = true;
    };
    const onDown = (e: PointerEvent) => {
      if (menuRef.current) return;
      zn.setPointerCapture?.(e.pointerId);
      aim(e);
    };
    const onMove = (e: PointerEvent) => {
      if (menuRef.current) return;
      if (e.pointerType !== 'mouse' && !pointerDown) return;
      aim(e);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') pointerDown = false;
    };
    const onCtx = (e: Event) => e.preventDefault();
    // Segurar na tela abria a lupa/seleção do iOS: bloqueia o toque longo e a seleção.
    const onTouch = (e: TouchEvent) => e.preventDefault();
    zn.addEventListener('touchstart', onTouch, { passive: false });
    zn.addEventListener('selectstart', onCtx);
    zn.addEventListener('pointerdown', onDown);
    zn.addEventListener('pointermove', onMove);
    zn.addEventListener('pointerup', onUp);
    zn.addEventListener('contextmenu', onCtx);

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.key === 'Escape' && down && !e.repeat) {
        setMenu((v) => !v);
        return;
      }
      if (menuRef.current) return;
      if (e.code === 'Space') {
        e.preventDefault();
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') keys.l = down;
      else if (k === 'arrowright' || k === 'd') keys.r = down;
      else if (k === 'arrowup' || k === 'w') keys.u = down;
      else if (k === 'arrowdown' || k === 's') keys.d = down;
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const ro = new ResizeObserver(() => {
      const r = zn.getBoundingClientRect();
      scene.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
    });
    ro.observe(zn);
    // girar o aparelho: o navegador demora a informar o tamanho novo, então confere de novo logo depois
    const remeasure = () => {
      for (const ms of [60, 300, 800]) {
        setTimeout(() => {
          const rr = zn.getBoundingClientRect();
          scene.resize(Math.max(1, Math.round(rr.width)), Math.max(1, Math.round(rr.height)));
        }, ms);
      }
    };
    window.addEventListener('orientationchange', remeasure);
    window.addEventListener('resize', remeasure);
    const r0 = zn.getBoundingClientRect();
    scene.resize(Math.max(1, Math.round(r0.width)), Math.max(1, Math.round(r0.height)));

    const react = (events: PpEvent[]) => {
      for (const e of events) {
        if (e.type === 'toss') pingSfx.toss();
        else if (e.type === 'hit') {
          const power = Math.max(0, Math.min(1, (e.kmh - 20) / 80));
          const mine = e.p === myIdx && !spectator;
          pingSfx.hit(power, e.smash, mine);
          stats.hits[e.p === 0 ? 0 : 1]++;
          if (e.smash && mine) stats.smashes++;
          if (e.kmh > stats.fastest) stats.fastest = e.kmh;
          if (mine && 'vibrate' in navigator) navigator.vibrate?.(e.smash ? 18 : 8);
          setHud((h) => ({
            ...h,
            rally: match.rally,
            speed: {
              kmh: e.kmh,
              id: ++speedId,
              mine,
              tag: e.smash
                ? 'SMASH'
                : (STROKE_TAG[e.stroke] ?? (e.quality === 'sweet' ? 'PERFEITA' : undefined)),
            },
          }));
        } else if (e.type === 'bounce') pingSfx.bounce(e.impact);
        else if (e.type === 'net') pingSfx.net();
        else if (e.type === 'fault') {
          pingSfx.fault();
          const mine = e.p === myIdx && !spectator;
          setHud((h) => ({
            ...h,
            banner: {
              text: 'Falta de saque',
              sub: mine ? 'Mais uma e o ponto é dele' : 'Errou o saque',
              id: ++bannerId,
              tone: 'info',
            },
          }));
        } else if (e.type === 'point') {
          const won = e.winner === myIdx && !spectator;
          pingSfx.point(won);
          stats.points[e.winner === 0 ? 0 : 1]++;
          if (e.rally > stats.longest) stats.longest = e.rally;
          const near = Math.max(e.score[0], e.score[1]) >= 10;
          if (near && !reduced && !net) {
            slow = 0.35;
            slowUntil = performance.now() + 900;
          }
          const who = spectator
            ? (online?.names[e.winner === 0 ? 0 : 1] ?? '')
            : e.winner === myIdx
              ? 'você'
              : oppName;
          setHud((h) => ({
            ...h,
            score: e.score,
            rally: 0,
            banner: {
              text: `Ponto de ${who}`,
              sub: e.best > 0 ? `${e.best} km/h na melhor batida` : undefined,
              id: ++bannerId,
              tone: won ? 'win' : spectator ? 'info' : 'lose',
            },
          }));
        } else if (e.type === 'game') {
          pingSfx.win(e.winner === myIdx && !spectator);
          finished = true;
          stats.seconds = match.tick / 60;
          // na sala o servidor leva ao pódio sozinho (a tela de fim é a da sala)
          if (!net) {
            window.setTimeout(() => {
              phase = 'over';
              setHud((h) => ({ ...h, phase: 'over' }));
              setResult({ winner: e.winner, score: e.score, stats: { ...stats } });
            }, 1500);
          }
        }
      }
      scene.handle(events, spectator ? -1 : myIdx);
    };

    // ---- sala: eventos de batida, raquete do outro e histórico ----
    const unsubs: (() => void)[] = [];
    /** Pontos esperando a folga de 200 ms (uma batida atrasada ainda pode desfazê-los). */
    const waiting: PpTimedEvent[] = [];
    const feed = (list: PpTimedEvent[]) => {
      const now: PpEvent[] = [];
      for (const t of list) {
        // o que aconteceu há mais de ~300 ms (voltou à sala, aba parada) não faz som nem aviso: só o placar acerta
        if (t.tick < match.tick - 20) continue;
        if (t.e.type === 'point' || t.e.type === 'game') waiting.push(t);
        else now.push(t.e);
      }
      if (now.length) react(now);
    };
    const oppTarget = { x: 0, y: 1.3, z: 0 };
    /** Já chegou o histórico da sala (quem entra no meio ou volta só começa a andar depois dele). */
    let synced = !net;
    let padSendAt = 0;
    if (net && online) {
      unsubs.push(
        subscribeRoom('pev', (m) => {
          if (!Array.isArray(m)) return;
          synced = true;
          for (const raw of m) {
            const ev = ppParseNetEvent(raw);
            if (ev) feed(net.add(ev).events);
          }
        }),
        subscribeRoom('prej', (m) => {
          const ev = ppParseNetEvent(m);
          if (ev) feed(net.remove(ev));
        }),
        subscribeRoom('ppads', (m) => {
          if (!Array.isArray(m)) return;
          for (const row of m as number[][]) {
            if (row[0] === oppIdx) {
              oppTarget.x = row[1] ?? 0;
              oppTarget.y = row[2] ?? 1.3;
              oppTarget.z = row[3] ?? 0;
            }
          }
        }),
      );
      sendRoomQuiet('psync');
    }
    const flushWaiting = () => {
      while (waiting.length > 0) {
        const t = waiting[0] as PpTimedEvent;
        if (match.tick < t.tick + POINT_GRACE) break;
        waiting.shift();
        // o ponto só vale se, passada a folga, a partida ainda o tem (senão uma batida atrasada o desfez)
        if (t.e.type === 'point') {
          const total = match.score[0] + match.score[1];
          if (total < t.e.score[0] + t.e.score[1]) continue;
        }
        react([t.e]);
      }
    };

    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const paused = !net && menuRef.current;
      if (phase === 'ready') {
        const left = online
          ? Math.ceil((online.startAt - serverNow()) / 1000)
          : 3 - Math.floor((now - readyAt) / 700);
        const shown = online ? Math.min(3, left) : left;
        if (shown !== ready) {
          ready = shown;
          if (shown >= 0 && shown <= 3) pingSfx.count(shown);
          setHud((h) => ({ ...h, count: Math.max(0, shown) }));
        }
        if (online ? serverNow() >= online.startAt : left < 0) {
          phase = 'play';
          setHud((h) => ({ ...h, phase: 'play' }));
        }
      }
      let alpha = 1;
      if (phase === 'play' && !finished) {
        // setas e WASD: lado a lado e para a frente / para trás
        const kx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
        const ky = (keys.u ? 1 : 0) - (keys.d ? 1 : 0);
        if (kx) me.x = Math.max(-PP_PAD_X, Math.min(PP_PAD_X, me.x + scene.simX(kx) * 3.2 * dt));
        if (ky) zt = clampZ(zt + ky * 9 * dt);
        me.z = zt;
        // só nos testes: uma entrada de bot (ou de um "jogador" programado) no lugar do mouse
        const forced = (window as unknown as { __pingForce?: PpInput }).__pingForce;
        if (forced) {
          me.x = forced.x;
          me.y = forced.y;
          me.serve = forced.serve;
          me.swing = forced.swing;
          me.z = undefined;
        }
        if (net && online) {
          // hora da partida pelo relógio da sala; o passo é fixo e a tela interpola entre os dois últimos
          const exact = (serverNow() - online.startAt) / (PP_TICK * 1000);
          const target = Math.floor(exact);
          const input = spectator ? null : me;
          const timed: PpTimedEvent[] = [];
          let guard = 0;
          // sem o histórico não anda (uma batida antiga que chegasse depois não teria como ser aplicada)
          while (synced && net.tick < target && guard++ < 1500) {
            if (net.tick === target - 1) scene.snap();
            // alcançando o passado (voltou à sala, aba parada): ninguém "bate" no que já passou, vale só o registro
            net.match.replay = target - net.tick > 30;
            timed.push(...net.advanceTo(net.tick + 1, input));
          }
          net.match.replay = false;
          feed(timed);
          for (const ev of net.outgoing()) sendRoomQuiet(ev.k === 'toss' ? 'ptoss' : 'phit', ev);
          flushWaiting();
          alpha = Math.max(0, Math.min(1, exact - target));
          // a raquete do outro chega a 30 vezes por segundo: aqui ela suaviza até lá
          ppPadStepZ(match.pad(oppIdx), oppTarget.x, oppTarget.y, oppTarget.z, dt);
          if (!spectator && now - padSendAt > 33) {
            padSendAt = now;
            {
              const mine = match.pad(myIdx);
              sendRoomQuiet('ppad', [
                Math.round(mine.x * 100) / 100,
                Math.round(mine.y * 100) / 100,
                Math.round(mine.reach * 100) / 100,
              ]);
            }
          }
        } else if (!paused && bot) {
          if (slow < 1 && now > slowUntil) slow = 1;
          acc += dt * slow;
          let guard = 0;
          while (acc >= 1 / 60 && guard++ < 6) {
            scene.snap();
            match.step([me, bot.input(match, 1)]);
            const ev = match.drain();
            if (ev.length) react(ev);
            acc -= 1 / 60;
          }
          if (guard >= 6) acc = 0;
          alpha = acc * 60;
        }
      }
      scene.render(dt, phase === 'play' && !paused ? alpha : 1);
      if (now - hudAt > 120) {
        hudAt = now;
        const sync = !net || waiting.length === 0;
        setHud((h) =>
          h.server === match.server &&
          h.matchPhase === match.phase &&
          h.rally === match.rally &&
          (!sync || (h.score[0] === match.score[0] && h.score[1] === match.score[1]))
            ? h
            : {
                ...h,
                server: match.server,
                matchPhase: match.phase,
                rally: match.rally,
                // o placar da sala acompanha a partida (vale depois da folga de cada ponto)
                score: sync && net ? [match.score[0], match.score[1]] : h.score,
              },
        );
      }
    };
    raf = requestAnimationFrame(frame);

    (window as unknown as { __ping?: unknown }).__ping = {
      match,
      scene,
      net,
      predict: ppPredictCross,
      Bot: PpBot,
      levels: PP_BOT_LEVELS,
    };
    return () => {
      cancelAnimationFrame(raf);
      for (const off of unsubs) off();
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('orientationchange', remeasure);
      window.removeEventListener('resize', remeasure);
      zn.removeEventListener('pointerdown', onDown);
      zn.removeEventListener('pointermove', onMove);
      zn.removeEventListener('pointerup', onUp);
      zn.removeEventListener('contextmenu', onCtx);
      zn.removeEventListener('touchstart', onTouch);
      zn.removeEventListener('selectstart', onCtx);
      ro.disconnect();
      scene.dispose();
      delete (window as unknown as { __ping?: unknown }).__ping;
    };
  }, [level, online]);

  const myIdx = online ? Math.max(0, online.me) : 0;
  const spectating = !!online && online.me < 0;
  const oppIdx = 1 - myIdx;
  const myServe =
    !spectating &&
    (hud.matchPhase === 'serve' || hud.matchPhase === 'toss') &&
    hud.server === myIdx &&
    hud.phase === 'play';
  const names = online
    ? [
        spectating ? (online.names[0] ?? '') : 'Você',
        spectating ? (online.names[1] ?? '') : (online.names[oppIdx] ?? 'Adversário'),
      ]
    : ['Você', BOT_NAMES[level]];

  return (
    <div ref={root} className="png-play" data-testid="png-play">
      <canvas ref={canvas} className="png-canvas" aria-label="Mesa de pingue-pongue" />
      <div ref={zone} className="png-zone" aria-hidden="true" />
      <div className="png-hud">
        <div className="png-score" role="status" aria-label="Placar" data-testid="png-score">
          <span className={`png-side${hud.server === myIdx ? ' is-serving' : ''}`}>
            <i aria-hidden="true" />
            <small>{names[0]}</small>
            <b>{hud.score[myIdx] ?? 0}</b>
          </span>
          <span className="png-sep" aria-hidden="true">
            :
          </span>
          <span className={`png-side is-right${hud.server === oppIdx ? ' is-serving' : ''}`}>
            <b>{hud.score[oppIdx] ?? 0}</b>
            <small>{names[1]}</small>
            <i aria-hidden="true" />
          </span>
        </div>
        <div className="png-hud-end">
          <GearButton onClick={() => setMenu(true)} testId="png-menu-btn" />
        </div>
      </div>
      {hud.rally >= 4 && hud.matchPhase === 'rally' && (
        <div className="png-rally" key={`rally-${hud.rally}`} aria-hidden="true">
          Troca <b>{hud.rally}</b>
        </div>
      )}
      {hud.speed && (
        <div
          className={`png-speed${hud.speed.mine ? ' is-mine' : ''}`}
          key={`speed-${hud.speed.id}`}
          aria-hidden="true"
        >
          {hud.speed.tag && <em>{hud.speed.tag}</em>}
          <b>{hud.speed.kmh}</b> km/h
        </div>
      )}
      {hud.banner && (
        <div
          className={`png-banner is-${hud.banner.tone}`}
          key={`banner-${hud.banner.id}`}
          role="status"
        >
          <b>{hud.banner.text}</b>
          {hud.banner.sub && <span>{hud.banner.sub}</span>}
        </div>
      )}
      {hud.phase === 'ready' && (
        <div className="png-count" aria-live="assertive">
          {hud.count > 0 ? hud.count : 'Já!'}
        </div>
      )}
      {myServe && !hud.banner && (
        <div className="png-serve-hint" data-testid="png-serve-hint">
          <b>Sua vez de sacar</b>
          <span>
            {touchDevice
              ? 'A bola fica parada na sua frente: arraste o dedo para a frente e bata nela'
              : 'A bola fica parada na sua frente: leve a raquete para a frente com o mouse e bata nela'}
          </span>
        </div>
      )}
      {!spectating &&
        hud.matchPhase === 'serve' &&
        hud.server === oppIdx &&
        hud.phase === 'play' &&
        !hud.banner && (
          <div className="png-serve-hint is-them">
            <b>{names[1]} vai sacar</b>
            <span>Prepare a raquete</span>
          </div>
        )}
      {online && <GameChat enabled />}
      <RotateHint />
      {hud.phase === 'ready' && (
        <GameTips storageKey={TIPS_KEY} rows={tipRows(touchDevice)} testId="png-tips" markOnShow />
      )}
      {menu && !result && (
        <GameMenu
          title="Menu"
          testPrefix="png-menu"
          tipsKey={TIPS_KEY}
          tips={tipRows(touchDevice)}
          online={!!online}
          onClose={closeMenu}
          onExit={onExit}
          onOfflineInvite={onOfflineInvite}
          actions={[]}
        />
      )}
      {result && (
        <PingFinal
          winner={result.winner}
          score={result.score}
          names={[names[0] as string, names[1] as string]}
          stats={result.stats}
          mode={{ kind: 'training', onAgain, onExit }}
        />
      )}
    </div>
  );
}
