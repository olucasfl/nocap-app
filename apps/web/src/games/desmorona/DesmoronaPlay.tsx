import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DSM_DT,
  DSM_LAYERS,
  DsmWorld,
  botInput,
  newBotMemory,
  createRng,
  type DsmInput,
  type DsmPlayerInfo,
  type DsmWavePattern,
} from '@nocap/games';
import { GameChat } from '@/components/GameChat';
import { gameChatOpen } from '@/lib/game-chat-state';
import { GameMenu, GearButton, Keycap, NetBadge } from '@/components/GameMenu';
import { GameTips, type TipRow } from '@/components/GameTips';
import { RotateHint } from '@/components/RotateHint';
import { IcCamera, IcJump } from '@/games/bola/BolaIcons';
import { dsmSfx } from '@/lib/desmorona-audio';
import { currentRtt, sendRoomQuiet, serverNow, subscribeRoom } from '@/lib/rooms';
import { DsmControls, STICK_RADIUS } from './controls';
import { DsmScene } from './scene';

/** Cores de pelo das raposas (a primeira é a sua, laranja como no Atravessa). */
const FURS = [0xff7d26, 0xb98cff, 0x4fc3f7, 0x7be07b, 0xffd23f, 0xff6f91, 0xf5f5f5, 0x8d6e63];
const BOT_NAMES = ['Faísca', 'Pipoca', 'Trufa', 'Ruivo', 'Brisa', 'Nuvem', 'Cacau'];
const COUNTDOWN = 3.4;
const TIPS_KEY = 'nocap-dsm-tips';

/** Os controles do Desmorona!: a primeira partida e o item "Controles" do menu mostram estes. */
const tipRows = (touch: boolean): TipRow[] =>
  touch
    ? [
        { keys: <b className="gm-tag">Joystick</b>, text: 'Arraste na metade esquerda para andar' },
        { keys: <IcJump size={20} />, text: 'Toque em Pular; de novo no ar, pulo duplo' },
        {
          keys: <b className="gm-tag">Corra</b>,
          text: 'Andar quebra o chão: não pare, e pule os buracos',
        },
        {
          keys: <b className="gm-tag">Menu</b>,
          text: 'Botão Menu: convidar, comandos, som e sair',
        },
        {
          keys: <b className="gm-tag">Chat</b>,
          text: 'Botão do balão (em sala): abre e fecha o chat',
        },
        {
          keys: <b className="gm-tag">‹ ›</b>,
          text: 'Depois de cair: troca quem você assiste',
        },
      ]
    : [
        {
          keys: (
            <>
              <Keycap k="W" touchHide={false} />
              <Keycap k="A" touchHide={false} />
              <Keycap k="S" touchHide={false} />
              <Keycap k="D" touchHide={false} />
            </>
          ),
          text: 'Andar (o chão quebra por onde você passa)',
        },
        {
          keys: <Keycap k="Espaço" wide touchHide={false} />,
          text: 'Pular; de novo no ar, pulo duplo',
        },
        { keys: <IcCamera size={20} />, text: 'O mouse gira a câmera (clique para prender)' },
        {
          keys: <Keycap k="Esc" touchHide={false} />,
          text: 'Menu: convidar, comandos, som e sair',
        },
        {
          keys: <Keycap k="T" touchHide={false} />,
          text: 'Abre e fecha o chat da sala (Enter também abre; Esc fecha)',
        },
        {
          keys: <b className="gm-tag">‹ ›</b>,
          text: 'Depois de cair: troca quem você assiste (botões na tela)',
        },
      ];

export interface DsmResult {
  winnerId: string;
  standings: { id: string; name: string; you: boolean }[];
  seconds: number;
}

interface Hud {
  alive: number;
  total: number;
  layer: number;
  phase: 'ready' | 'play' | 'over';
  count: number;
  note: string;
  /** Onda de queda em aviso (barra regressiva e texto). */
  wave: { index: number; pattern: DsmWavePattern; secs: number; fell: boolean } | null;
  dead: boolean;
  watching: string;
}

/** O que cada formato de onda pede da pessoa (pt-BR). */
const WAVE_TEXT: Record<DsmWavePattern, string> = {
  fatia: 'Uma fatia vai cair: saia das áreas vermelhas',
  metade: 'Metade do chão vai cair: vá para o outro lado',
  anel: 'Um anel vai cair: fuja para dentro ou para fora',
  chuva: 'Blocos vão cair: fique longe dos vermelhos',
  borda: 'A borda vai cair: vá para o meio',
  tudo: 'Tudo vai cair: desça para a camada de baixo',
};

const seedOf = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

/** Partida em sala: a seed, a hora da largada (relógio do servidor) e as raposas na ordem das vagas. */
export interface DsmOnline {
  seed: string;
  startAt: number;
  meId: string;
  infos: DsmPlayerInfo[];
}

/** Quanto tempo as raposas dos outros ficam "atrasadas" na tela para o movimento sair liso. */
const SMOOTH = 14;
const POS_EVERY_MS = 66;
/** Quanto tempo um toque de pulo espera uma chance de valer (pousar, ou o pulo duplo estar livre). */
const JUMP_BUFFER_MS = 140;

/** Uma partida do Desmorona! (treino contra bots). Solta a raposa do ar, roda o motor e desenha a cena. */
export function DesmoronaPlay({
  bots = 0,
  online,
  dead,
  onExit,
  onAgain,
  onOfflineInvite,
}: {
  bots?: number;
  online?: DsmOnline;
  /** Online: quem a sala já deu como caído (vem do estado da sala). */
  dead?: string[];
  onExit: () => void;
  onAgain?: () => void;
  /** Partida offline: "Convidar" leva para criar uma sala com amigos. */
  onOfflineInvite?: () => void;
}) {
  const deadRef = useRef<string[]>([]);
  deadRef.current = dead ?? [];
  const total = online ? online.infos.length : bots + 1;
  const canvas = useRef<HTMLCanvasElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<Hud>({
    alive: total,
    total,
    layer: 1,
    phase: 'ready',
    count: 3,
    note: '',
    wave: null,
    dead: false,
    watching: '',
  });
  const [stick, setStick] = useState<{ ox: number; oy: number; x: number; y: number } | null>(null);
  const [locked, setLocked] = useState(false);
  const mouseUser = useMemo(
    () =>
      typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches,
    [],
  );
  const [result, setResult] = useState<DsmResult | null>(null);
  const controls = useMemo(() => new DsmControls(), []);
  const spectate = useRef({ index: 0 });
  /** Eliminado e assistindo: o mouse fica solto (para os botões), mas o Esc ainda abre o menu. */
  const spectating = useRef(false);
  const api = useRef<{ next: (d: number) => void } | null>(null);
  const noteTimer = useRef<number | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(false);
  menuRef.current = menu;
  const [showNet, setShowNet] = useState(() => {
    try {
      // ligado por padrão (o painel mostra o ping); a pessoa desliga no menu
      return localStorage.getItem('nocap-dsm-net') !== '0';
    } catch {
      return true;
    }
  });
  const [ping, setPing] = useState(0);
  const touchDevice = useMemo(
    () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    [],
  );
  useEffect(() => {
    if (!online || !showNet) return undefined;
    const t = window.setInterval(() => setPing(Math.round(currentRtt())), 1000);
    return () => window.clearInterval(t);
  }, [online, showNet]);
  // sem o mouse preso, o Esc do teclado abre o menu (com ele preso, o navegador o consome e soltar o mouse já abre)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.code === 'Escape' &&
        !menuRef.current &&
        (controls.allowLock || spectating.current) &&
        !gameChatOpen()
      )
        setMenu(true);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [controls]);
  const closeMenu = () => {
    setMenu(false);
    // o clique em "Continuar" é um gesto: dá para prender o mouse de novo
    if (mouseUser) controls.requestLock();
  };

  useEffect(() => {
    const el = canvas.current;
    const zoneEl = zone.current;
    if (!el || !zoneEl) return undefined;
    const meId = online?.meId ?? 'me';
    const infos: DsmPlayerInfo[] = online?.infos ?? [
      { id: 'me', name: 'Você', color: FURS[0] as number },
      ...Array.from({ length: bots }, (_, i) => ({
        id: `bot${i}`,
        name: BOT_NAMES[i] ?? `Raposa ${i + 1}`,
        color: FURS[(i + 1) % FURS.length] as number,
        bot: true,
      })),
    ];
    const seed = online?.seed ?? seedOf();
    const world = new DsmWorld(seed, infos);
    if (online) world.goOnline(meId);
    // só no desenvolvimento: os testes de ponta a ponta leem o mundo para conferir o pulo
    if (import.meta.env.DEV) (window as unknown as { __dsm?: DsmWorld }).__dsm = world;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new DsmScene(el, world, reduced);
    const mem = new Map(
      world.players
        .filter((p) => p.bot)
        .map((p, i) => [p.id, newBotMemory((i % 4) * 0.15, i % 3 === 0 ? 0.5 : 0)]),
    );
    const rng = createRng(`${seed}:bots`);
    controls.attach(zoneEl, setStick);
    if (root.current) {
      controls.attachLook(root.current, (l) => {
        setLocked(l);
        // Esc solta o mouse: abre o menu (menos quando a partida acabou de soltar por conta própria)
        if (!l && controls.allowLock && !menuRef.current && !gameChatOpen()) setMenu(true);
      });
      // o clique em Jogar/Começar acabou de acontecer: o navegador ainda aceita prender o mouse
      if (mouseUser) controls.requestLock();
    }
    let yaw = 0;
    let pitch = 0.5;
    controls.allowLock = true;

    let phase: Hud['phase'] = 'ready';
    const readyAt = performance.now();
    let lastCount = 4;
    let focus = meId;
    let acc = 0;
    let last = performance.now();
    let hudAt = 0;
    let jumpUntil = 0;
    let raf = 0;
    let note = '';
    /** A onda em aviso: quando começou, quando cai e qual toque da contagem é o próximo. */
    let waveUi: {
      index: number;
      pattern: DsmWavePattern;
      from: number;
      fallAt: number;
      fell: boolean;
      hideAt: number;
      tick: number;
    } | null = null;
    const say = (text: string) => {
      note = text;
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
      noteTimer.current = window.setTimeout(() => {
        note = '';
      }, 2600);
    };

    const focusList = () => world.players.filter((p) => p.alive && p.id !== meId);
    api.current = {
      next: (d) => {
        const list = focusList();
        if (list.length === 0) return;
        spectate.current.index = (spectate.current.index + d + list.length) % list.length;
        focus = (list[spectate.current.index] as { id: string }).id;
      },
    };

    const resize = () => {
      const r = el.getBoundingClientRect();
      scene.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const me = () => world.players.find((p) => p.id === meId)!;

    // ---- online: posições dos outros, ladrilhos pisados e quem caiu ----
    const targets = new Map<
      string,
      {
        x: number;
        y: number;
        z: number;
        vx: number;
        vz: number;
        heading: number;
        grounded: boolean;
        layer: number;
        air: boolean;
        at: number;
      }
    >();
    const unsubs: (() => void)[] = [];
    let posTimer = 0;
    if (online) {
      const idOfSlot = new Map(infos.map((p, i) => [i, p.id]));
      unsubs.push(
        subscribeRoom('pos', (m) => {
          if (!Array.isArray(m)) return;
          for (const row of m as number[][]) {
            const id = idOfSlot.get(row[0] as number);
            if (!id || id === meId) continue;
            const flags = row[7] as number;
            targets.set(id, {
              x: row[1]!,
              y: row[2]!,
              z: row[3]!,
              vx: row[4]!,
              vz: row[5]!,
              heading: row[6]!,
              grounded: (flags & 1) === 1,
              layer: (flags >> 1) & 15,
              air: (flags & 32) !== 0,
              at: performance.now(),
            });
          }
        }),
        subscribeRoom('dpushed', (m) => {
          const k = m as { kx?: number; kz?: number } | null;
          if (k && typeof k.kx === 'number' && typeof k.kz === 'number') {
            world.applyKnock(meId, k.kx, k.kz);
            dsmSfx.bump(true);
            scene.shakeNow(0.5);
          }
        }),
        subscribeRoom('dsteps', (m) => {
          if (!Array.isArray(m)) return;
          for (const row of m as number[][])
            world.applyStep(row[0]!, row[1]!, row[2]!, row[3]! / 1000);
        }),
      );
      sendRoomQuiet('dsync');
      posTimer = window.setInterval(() => {
        const m = me();
        if (!m.alive || phase !== 'play') return;
        const layer = Math.max(0, m.grounded ? m.layer : m.deepest);
        sendRoomQuiet('dpos', [
          m.x,
          m.y,
          m.z,
          m.vx,
          m.vz,
          m.heading,
          (m.grounded ? 1 : 0) + layer * 2 + (m.airJumped ? 32 : 0),
        ]);
      }, POS_EVERY_MS);
    }
    /** Suaviza as raposas dos outros em direção ao último relato (com um pouco de extrapolação). */
    const driveRemotes = (dt: number, now: number) => {
      const k = 1 - Math.exp(-dt * SMOOTH);
      for (const p of world.players) {
        if (!p.remote || !p.alive) continue;
        const t = targets.get(p.id);
        if (!t) continue;
        const age = Math.min(0.15, (now - t.at) / 1000);
        const tx = t.x + t.vx * age;
        const tz = t.z + t.vz * age;
        const first = p.deepest < 0 && !p.grounded && p.y > 12;
        const far = Math.hypot(p.x - tx, p.z - tz) > 6;
        const f = first || far ? 1 : k;
        world.setRemote(p.id, {
          x: p.x + (tx - p.x) * f,
          y: p.y + (t.y - p.y) * Math.max(f, 0.5),
          z: p.z + (tz - p.z) * f,
          vx: t.vx,
          vz: t.vz,
          heading: t.heading,
          grounded: t.grounded,
          layer: t.layer,
          airJumped: t.air,
        });
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (phase === 'ready') {
        const left = online
          ? (online.startAt - serverNow()) / 1000
          : COUNTDOWN - (now - readyAt) / 1000;
        const n = Math.ceil(left - 0.4);
        if (n !== lastCount && n >= 0 && n <= 3) {
          lastCount = n;
          dsmSfx.count(n === 0 ? 0 : n);
        }
        if (left <= 0) phase = 'play';
        else {
          // contagem: as raposas ficam paradas no ar
          scene.render(dt, focus);
          if (now - hudAt > 100) {
            hudAt = now;
            setHud((h) => ({ ...h, phase: 'ready', count: Math.max(0, n) }));
          }
          raf = requestAnimationFrame(frame);
          return;
        }
      }
      if (!document.hidden && !world.ended) {
        if (!online && !menuRef.current) acc += dt;
        const m = me();
        const input = m.alive ? controls.read() : { mx: 0, mz: 0, jump: false };
        // o toque fica guardado por um instante: um quadro sem passo da simulação não pode engolir o pulo
        if (input.jump) jumpUntil = now + JUMP_BUFFER_MS;
        input.jump = false;
        // a câmera gira com o mouse, o dedo (metade direita) ou Q e E; o movimento é sempre relativo a ela
        // igual à câmera solta do Fut Fox: um quadro nunca gira mais que isso, e a altura vai do quase rente ao quase de cima
        const cap = 0.3 * Math.max(1, dt * 60);
        yaw += Math.max(-cap, Math.min(cap, controls.takeYaw(dt)));
        pitch = Math.min(
          1.25,
          Math.max(0.12, pitch + Math.max(-0.2, Math.min(0.2, controls.takePitch()))),
        );
        scene.setYaw(yaw);
        scene.setPitch(pitch);
        if (import.meta.env.DEV) (window as unknown as { __dsmYaw?: number }).__dsmYaw = yaw;
        if (input.mx !== 0 || input.mz !== 0) {
          const sy = Math.sin(yaw);
          const cy = Math.cos(yaw);
          const mx = input.mx * cy + input.mz * sy;
          const mz = -input.mx * sy + input.mz * cy;
          input.mx = mx;
          input.mz = mz;
        }
        if (online) {
          // o relógio do jogo é o da sala: todo mundo vê o chão cair na mesma hora
          const target = (serverNow() - online.startAt) / 1000;
          acc = Math.min(Math.max(0, target - world.t), 1);
          driveRemotes(dt, now);
          for (const id of deadRef.current) if (id !== meId || m.alive) world.markDead(id);
        }
        while (acc >= DSM_DT) {
          acc -= DSM_DT;
          const mm = me();
          if (jumpUntil > now && mm.alive && (mm.grounded || !mm.airJumped)) {
            input.jump = true;
            jumpUntil = 0;
            if (mm.grounded || mm.coyote > 0) dsmSfx.jump();
          }
          const inputs: Record<string, DsmInput> = { [meId]: input };
          for (const p of world.players)
            if (p.bot) inputs[p.id] = botInput(world, p, mem.get(p.id)!, rng);
          world.step(DSM_DT, inputs);
          input.jump = false;
        }
        const events = world.drainEvents();
        if (events.length > 0) {
          scene.handle(events, focus);
          const mp = me();
          for (const e of events) {
            if (e.type === 'step' && e.id === meId) {
              dsmSfx.step();
              if (online) sendRoomQuiet('dstep', { l: e.layer, q: e.q, r: e.r });
            } else if (e.type === 'break') {
              const t = world.tile(e.layer, e.q, e.r);
              if (t) dsmSfx.crumble(Math.max(0, 1 - Math.hypot(t.x - mp.x, t.z - mp.z) / 22));
            } else if (e.type === 'land' && e.id === meId) dsmSfx.land(e.layer > 0);
            else if (e.type === 'fall' && e.id === meId) {
              dsmSfx.fall();
              say(`Você caiu para a camada ${e.layer + 1}`);
            } else if (e.type === 'airjump') {
              dsmSfx.airJump(e.id === meId);
            } else if (e.type === 'push') {
              if (online && e.from === meId)
                sendRoomQuiet('dpush', { to: e.to, kx: e.kx, kz: e.kz });
              if (e.from === meId || e.to === meId) {
                dsmSfx.bump(e.from === meId);
                if (e.to === meId) scene.shakeNow(0.5);
              } else dsmSfx.bump(false);
            } else if (e.type === 'wave') {
              // as áreas marcadas ficam vermelhas e piscando até cair: o aviso na tela conta o tempo que resta (a onda vem uma
              // vez por camada com gente; o texto é o da camada em que você está)
              const mine = me();
              const myLayer = mine.grounded ? mine.layer : Math.max(0, mine.deepest);
              if (!waveUi || waveUi.index !== e.index) dsmSfx.waveWarn();
              if (!waveUi || waveUi.index !== e.index || e.layer === myLayer) {
                waveUi = {
                  index: e.index,
                  pattern: e.pattern,
                  from: world.t,
                  fallAt: e.fallAt,
                  fell: false,
                  hideAt: 0,
                  tick: 3,
                };
              }
            } else if (e.type === 'wavefall') {
              dsmSfx.wave();
              if (waveUi) {
                waveUi.fell = true;
                waveUi.hideAt = now + 1400;
              }
            } else if (e.type === 'dead') {
              dsmSfx.dead(e.id === meId);
              if (e.id === meId) {
                if (online) sendRoomQuiet('ddead');
                spectating.current = true;
                controls.allowLock = false;
                controls.releaseLock();
                say('Você foi eliminado. Assista os outros!');
                const list = focusList();
                focus = (list[0] as { id: string } | undefined)?.id ?? meId;
                spectate.current.index = 0;
              } else if (e.id === focus) {
                const list = focusList();
                focus = (list[0] as { id: string } | undefined)?.id ?? meId;
              }
            }
          }
        }
      }
      scene.render(dt, focus);
      if (world.ended && phase !== 'over') {
        phase = 'over';
        spectating.current = false;
        const st = world.standings();
        dsmSfx.win(world.winnerId === meId);
        controls.allowLock = false;
        controls.releaseLock();
        setResult({
          winnerId: world.winnerId ?? '',
          standings: st.map((p) => ({ id: p.id, name: p.name, you: p.id === meId })),
          seconds: world.t,
        });
      }
      // toques da contagem da onda: 3, 2, 1 s e meio segundo antes de cair
      if (waveUi && !waveUi.fell) {
        const left = waveUi.fallAt - world.t;
        if (waveUi.tick > 0 && left <= waveUi.tick) {
          dsmSfx.waveTick(false);
          waveUi.tick = waveUi.tick > 1 ? waveUi.tick - 1 : 0;
        } else if (waveUi.tick === 0 && left <= 0.5) {
          dsmSfx.waveTick(true);
          waveUi.tick = -1;
        }
      }
      if (waveUi && waveUi.fell && now > waveUi.hideAt) waveUi = null;
      if (now - hudAt > 120) {
        hudAt = now;
        const m = me();
        // morto, a camada mostrada é a de quem você está assistindo
        const seen = !m.alive ? (world.players.find((p) => p.id === focus) ?? m) : m;
        const watching = !m.alive ? (world.players.find((p) => p.id === focus)?.name ?? '') : '';
        setHud({
          alive: world.alivePlayers().length,
          total: world.players.length,
          layer: Math.max(1, (seen.grounded ? seen.layer : Math.max(0, seen.deepest)) + 1),
          phase,
          count: 0,
          note,
          wave: waveUi
            ? {
                index: waveUi.index,
                pattern: waveUi.pattern,
                secs: Math.max(0.5, waveUi.fallAt - waveUi.from),
                fell: waveUi.fell,
              }
            : null,
          dead: !m.alive,
          watching,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(posTimer);
      for (const off of unsubs) off();
      ro.disconnect();
      controls.detach();
      scene.dispose();
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    };
  }, [bots, controls, online]);

  const knob = stick
    ? (() => {
        const dx = stick.x - stick.ox;
        const dy = stick.y - stick.oy;
        const len = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, len / STICK_RADIUS);
        return { x: (dx / len) * k * STICK_RADIUS, y: (dy / len) * k * STICK_RADIUS };
      })()
    : null;

  return (
    <div ref={root} className="dsm-play" data-testid="dsm-play">
      <canvas ref={canvas} className="dsm-canvas" aria-label="Arena do Desmorona!" />
      <div ref={zone} className="dsm-zone" aria-hidden="true">
        {stick && knob && (
          <div className="dsm-stick" style={{ left: stick.ox, top: stick.oy }}>
            <i className="dsm-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
          </div>
        )}
      </div>
      <div className="dsm-hud">
        <div className="dsm-pill" role="status">
          Vivos <b>{hud.alive}</b>/{hud.total}
        </div>
        <div className="dsm-pill is-layer">
          Camada <b>{hud.layer}</b>/{DSM_LAYERS}
        </div>
        <div className="dsm-hud-end">
          <GearButton onClick={() => setMenu(true)} testId="dsm-menu-btn" />
        </div>
      </div>
      {hud.phase === 'ready' && (
        <div className="dsm-count" aria-live="assertive">
          {hud.count > 0 ? hud.count : 'Já!'}
        </div>
      )}
      {mouseUser && !locked && hud.phase === 'play' && !hud.dead && !result && (
        <div className="dsm-lockhint">
          Aperte uma tecla ou clique para a câmera seguir o mouse (Esc solta)
        </div>
      )}
      {hud.note && hud.phase !== 'ready' && <div className="dsm-note">{hud.note}</div>}
      {hud.wave && hud.phase === 'play' && !result && (
        <div className="dsm-wave" key={hud.wave.index} data-fell={hud.wave.fell ? '1' : '0'}>
          <b>{hud.wave.fell ? 'Caiu!' : 'Onda de queda'}</b>
          <span>{WAVE_TEXT[hud.wave.pattern]}</span>
          <span className="dsm-wave-bar" aria-hidden="true">
            <i style={{ animationDuration: `${hud.wave.secs}s` }} />
          </span>
        </div>
      )}
      {hud.dead && !result && (
        <div className="dsm-spec">
          <button type="button" onClick={() => api.current?.next(-1)} aria-label="Raposa anterior">
            ‹
          </button>
          <span>
            Assistindo <b>{hud.watching}</b>
          </span>
          <button type="button" onClick={() => api.current?.next(1)} aria-label="Próxima raposa">
            ›
          </button>
        </div>
      )}
      {!hud.dead && hud.phase !== 'over' && (
        <button
          type="button"
          className="dsm-jump"
          aria-label="Pular"
          onPointerDown={(e) => {
            e.preventDefault();
            controls.pressJump();
          }}
        >
          Pular
        </button>
      )}
      {online && showNet && !result && (
        <NetBadge
          mode="servidor"
          items={[{ text: `${ping} ms`, title: 'ida e volta até o servidor' }]}
        />
      )}
      {!result && <RotateHint />}
      {hud.phase === 'ready' && !result && (
        <GameTips storageKey={TIPS_KEY} rows={tipRows(touchDevice)} testId="dsm-tips" markOnShow />
      )}
      <GameChat enabled={!!online && !result} onClosed={(was) => was && controls.resumeLock()} />
      {menu && !result && (
        <GameMenu
          title="Menu"
          testPrefix="dsm-menu"
          tipsKey={TIPS_KEY}
          tips={tipRows(touchDevice)}
          online={!!online}
          net={
            online
              ? {
                  on: showNet,
                  toggle: () =>
                    setShowNet((v) => {
                      try {
                        localStorage.setItem('nocap-dsm-net', v ? '0' : '1');
                      } catch {
                        /* sem armazenamento: vale só nesta partida */
                      }
                      return !v;
                    }),
                }
              : undefined
          }
          onClose={closeMenu}
          onExit={onExit}
          onOfflineInvite={onOfflineInvite}
          actions={[]}
        />
      )}
      {result && (
        <div className="dsm-over" role="dialog" aria-modal="true" aria-label="Resultado">
          <div className="dsm-over-card">
            <h2>
              {result.winnerId === 'me'
                ? 'Você venceu!'
                : `${result.standings[0]?.name ?? 'Alguém'} venceu`}
            </h2>
            <ol>
              {result.standings.map((s, i) => (
                <li key={s.id} className={s.you ? 'is-you' : ''}>
                  <span>{i + 1}º</span> {s.name}
                  {s.you ? ' (você)' : ''}
                </li>
              ))}
            </ol>
            <div className="dsm-over-btns">
              {onAgain && (
                <button type="button" className="dsm-btn" onClick={onAgain} data-testid="dsm-again">
                  Jogar de novo
                </button>
              )}
              <button type="button" className="dsm-btn is-ghost" onClick={onExit}>
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
